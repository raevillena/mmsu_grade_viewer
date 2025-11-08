import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseClient";
import { validateToken } from "@/lib/auth";
import { MoodleClient } from "@/lib/moodle/client";

interface PotentialUser {
  id: number;
  fullname: string;
  email?: string;
  profileimageurl?: string;
  profileimageurlsmall?: string;
  username?: string;
  idnumber?: string;
  department?: string;
}

type PotentialUsersResponse = PotentialUser[];

/**
 * POST /api/moodle/sync-emails
 * Fetch and store student data from Moodle (independent of grade records)
 * This fetches all potential users from Moodle and stores them in the cache
 */
export async function POST(request: NextRequest) {
  console.log("[Moodle Sync] Starting bulk student data fetch from Moodle...");

  try {
    const accessToken = request.cookies.get("access_token")?.value;

    if (!accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const refreshToken = request.cookies.get("refresh_token")?.value;
    const userId = request.cookies.get("user_id")?.value;
    const userRole = request.cookies.get("user_role")?.value;
    const validation = await validateToken(accessToken, refreshToken, userId, userRole);

    if (!validation.valid || !validation.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins can sync
    if (validation.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { courseid, enrolid } = body;

    if (!courseid || !enrolid) {
      return NextResponse.json(
        { error: "courseid and enrolid are required" },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseClient();
    const client = MoodleClient.fromEnv();

    // Login to Moodle if credentials are provided
    if (process.env.MOODLE_LOGIN_USERNAME && process.env.MOODLE_LOGIN_PASSWORD) {
      console.log("[Moodle Sync] Logging in to Moodle...");
      await client.login();
      console.log("[Moodle Sync] Login successful");
    }

    const sesskey = await client.fetchSesskey();
    console.log("[Moodle Sync] Sesskey retrieved");

    let totalFetched = 0;
    let created = 0;
    let updated = 0;
    let skipped = 0;
    let page = 0;
    const perPage = 200;
    const errors: string[] = [];

    // Fetch all users with pagination
    while (true) {
      console.log(`[Moodle Sync] Fetching page ${page} (${perPage} per page)...`);

      try {
        const payload = await client.callService<PotentialUsersResponse>(
          "core_enrol_get_potential_users",
          {
            courseid: Number(courseid),
            enrolid: Number(enrolid),
            search: "",
            searchanywhere: true,
            page,
            perpage: perPage,
          },
          { sesskey }
        );

        console.log(`[Moodle Sync] Page ${page}: Retrieved ${payload.length} users`);

        if (payload.length === 0) {
          console.log("[Moodle Sync] No more users to fetch");
          break;
        }

        // Process each user
        for (const user of payload) {
          try {
            // Skip if no email
            if (!user.email) {
              skipped++;
              continue;
            }

            // Use idnumber as student_number if available, otherwise use username or email as fallback
            const studentNumber = user.idnumber || user.username || user.email.split("@")[0];

            // Check if entry already exists
            const { data: existing, error: lookupError } = await supabase
              .from("student_email_cache")
              .select("id")
              .eq("student_number", studentNumber)
              .single();

            if (lookupError && lookupError.code !== "PGRST116") {
              console.error(`[Moodle Sync] Error looking up ${studentNumber}:`, lookupError);
              errors.push(`${user.fullname}: Lookup error`);
              continue;
            }

            const cacheEntry = {
              student_number: studentNumber,
              email: user.email,
              fullname: user.fullname,
              moodle_user_id: user.id,
              last_synced_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };

            if (existing) {
              // Update existing entry
              const { error: updateError } = await supabase
                .from("student_email_cache")
                .update(cacheEntry)
                .eq("id", existing.id);

              if (updateError) {
                console.error(`[Moodle Sync] Error updating ${studentNumber}:`, updateError);
                errors.push(`${user.fullname}: Update error`);
              } else {
                updated++;
              }
            } else {
              // Create new entry
              const { error: insertError } = await supabase
                .from("student_email_cache")
                .insert(cacheEntry);

              if (insertError) {
                console.error(`[Moodle Sync] Error inserting ${studentNumber}:`, insertError);
                errors.push(`${user.fullname}: Insert error`);
              } else {
                created++;
              }
            }

            totalFetched++;
          } catch (userError) {
            console.error(`[Moodle Sync] Error processing user ${user.id}:`, userError);
            errors.push(`${user.fullname || "Unknown"}: Processing error`);
          }
        }

        // If we got fewer than perPage, we've reached the end
        if (payload.length < perPage) {
          console.log("[Moodle Sync] Reached last page");
          break;
        }

        page++;
      } catch (pageError) {
        console.error(`[Moodle Sync] Error fetching page ${page}:`, pageError);
        errors.push(`Page ${page}: ${pageError instanceof Error ? pageError.message : "Unknown error"}`);
        break;
      }
    }

    console.log("[Moodle Sync] Sync completed:", {
      totalFetched,
      created,
      updated,
      skipped,
      errors: errors.length,
    });

    return NextResponse.json({
      success: true,
      data: {
        total: totalFetched,
        created,
        updated,
        skipped,
        errors: errors.length,
        errorDetails: errors.slice(0, 10), // Return first 10 errors
      },
    });
  } catch (error) {
    console.error("[Moodle Sync] Fatal error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
