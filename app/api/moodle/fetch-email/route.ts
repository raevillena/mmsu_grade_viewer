import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseClient";
import { validateToken } from "@/lib/auth";
import { MoodleClient } from "@/lib/moodle/client";

interface PotentialUser {
  id: number;
  fullname: string;
  email?: string;
  username?: string;
  idnumber?: string;
}

type PotentialUsersResponse = PotentialUser[];

/**
 * POST /api/moodle/fetch-email
 * Fetch a single student's email from Moodle by student number
 */
export async function POST(request: NextRequest) {
  console.log("[Moodle Fetch Email] Starting email fetch...");

  try {
    const accessToken = request.cookies.get("access_token")?.value;

    if (!accessToken) {
      console.error("[Moodle Fetch Email] No access token found");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const refreshToken = request.cookies.get("refresh_token")?.value;
    const userId = request.cookies.get("user_id")?.value;
    const userRole = request.cookies.get("user_role")?.value;
    const validation = await validateToken(accessToken, refreshToken, userId, userRole);

    if (!validation.valid || !validation.user) {
      console.error("[Moodle Fetch Email] Token validation failed");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only teachers and admins can fetch emails
    if (validation.user.role !== "teacher" && validation.user.role !== "admin") {
      console.error("[Moodle Fetch Email] Forbidden: User role is", validation.user.role);
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { student_number, courseid, enrolid } = body;

    console.log("[Moodle Fetch Email] Request parameters:", {
      student_number,
      courseid,
      enrolid,
    });

    if (!student_number) {
      console.error("[Moodle Fetch Email] Missing student_number");
      return NextResponse.json(
        { error: "student_number is required" },
        { status: 400 }
      );
    }

    if (!courseid || !enrolid) {
      console.error("[Moodle Fetch Email] Missing courseid or enrolid");
      return NextResponse.json(
        { error: "courseid and enrolid are required" },
        { status: 400 }
      );
    }

    // First, check cache
    console.log(`[Moodle Fetch Email] Checking cache for student_number: ${student_number}`);
    const supabase = createServerSupabaseClient();
    const { data: cached, error: cacheError } = await supabase
      .from("student_email_cache")
      .select("*")
      .eq("student_number", student_number)
      .single();

    if (cacheError && cacheError.code !== "PGRST116") {
      console.error("[Moodle Fetch Email] Cache lookup error:", cacheError);
    }

    // If found in cache and synced recently (within 24 hours), return it
    if (cached && cached.last_synced_at) {
      const lastSynced = new Date(cached.last_synced_at);
      const hoursSinceSync = (Date.now() - lastSynced.getTime()) / (1000 * 60 * 60);
      console.log(`[Moodle Fetch Email] Found in cache. Hours since sync: ${hoursSinceSync.toFixed(2)}`);
      
      if (hoursSinceSync < 24) {
        console.log("[Moodle Fetch Email] Returning cached email (fresh)");
        return NextResponse.json({
          success: true,
          data: {
            email: cached.email,
            fullname: cached.fullname,
            from_cache: true,
          },
        });
      } else {
        console.log("[Moodle Fetch Email] Cache entry is stale (>24 hours), fetching from Moodle");
      }
    } else {
      console.log("[Moodle Fetch Email] Not found in cache, fetching from Moodle");
    }

    // Fetch from Moodle
    console.log("[Moodle Fetch Email] Initializing Moodle client...");
    const client = MoodleClient.fromEnv();

    if (process.env.MOODLE_LOGIN_USERNAME && process.env.MOODLE_LOGIN_PASSWORD) {
      console.log("[Moodle Fetch Email] Logging in to Moodle...");
      await client.login();
      console.log("[Moodle Fetch Email] Login successful");
    }

    console.log("[Moodle Fetch Email] Fetching sesskey...");
    const sesskey = await client.fetchSesskey();
    console.log("[Moodle Fetch Email] Sesskey retrieved");

    console.log("[Moodle Fetch Email] Calling Moodle API...");
    const payload = await client.callService<PotentialUsersResponse>(
      "core_enrol_get_potential_users",
      {
        courseid: String(courseid),
        enrolid: String(enrolid),
        search: student_number,
        searchanywhere: true,
        page: 0,
        perpage: 10,
      },
      { sesskey }
    );

    console.log(`[Moodle Fetch Email] Received ${payload.length} results from Moodle`);

    // Find matching student by student number
    const student = payload.find((user) => user.idnumber === student_number);

    if (!student || !student.email) {
      console.error("[Moodle Fetch Email] Student not found or missing email:", {
        found: !!student,
        hasEmail: student?.email ? true : false,
        studentNumber: student_number,
        resultsCount: payload.length,
      });
      return NextResponse.json(
        { error: "Student not found in Moodle or email not available" },
        { status: 404 }
      );
    }

    console.log("[Moodle Fetch Email] Found student:", {
      id: student.id,
      fullname: student.fullname,
      email: student.email,
      idnumber: student.idnumber,
    });

    // Update or create cache entry
    const cacheEntry = {
      student_number: student.idnumber!,
      email: student.email,
      fullname: student.fullname,
      moodle_user_id: student.id,
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (cached) {
      console.log("[Moodle Fetch Email] Updating existing cache entry");
      const { error: updateError } = await supabase
        .from("student_email_cache")
        .update(cacheEntry)
        .eq("id", cached.id);
      
      if (updateError) {
        console.error("[Moodle Fetch Email] Cache update error:", updateError);
      } else {
        console.log("[Moodle Fetch Email] Cache entry updated successfully");
      }
    } else {
      console.log("[Moodle Fetch Email] Creating new cache entry");
      const { error: insertError } = await supabase
        .from("student_email_cache")
        .insert(cacheEntry);
      
      if (insertError) {
        console.error("[Moodle Fetch Email] Cache insert error:", insertError);
      } else {
        console.log("[Moodle Fetch Email] Cache entry created successfully");
      }
    }

    // Update grade records with the new email if they exist
    console.log(`[Moodle Fetch Email] Checking for records to update for student_number: ${student.idnumber}`);
    try {
      const { data: recordsToUpdate, error: recordsError } = await supabase
        .from("records")
        .select("id, email, student_name")
        .eq("student_number", student.idnumber);

      if (recordsError) {
        console.error("[Moodle Fetch Email] Error fetching records:", recordsError);
      } else if (recordsToUpdate && recordsToUpdate.length > 0) {
        // Update records where email or name differs
        const recordsNeedingUpdate = recordsToUpdate.filter(
          (record) => record.email !== student.email || record.student_name !== student.fullname
        );

        if (recordsNeedingUpdate.length > 0) {
          console.log(`[Moodle Fetch Email] Updating ${recordsNeedingUpdate.length} record(s) with new email/name`);
          
          const { error: updateRecordsError } = await supabase
            .from("records")
            .update({
              email: student.email,
              student_name: student.fullname,
            })
            .eq("student_number", student.idnumber);

          if (updateRecordsError) {
            console.error("[Moodle Fetch Email] Error updating records:", updateRecordsError);
          } else {
            console.log(`[Moodle Fetch Email] Successfully updated ${recordsNeedingUpdate.length} record(s)`);
          }
        } else {
          console.log("[Moodle Fetch Email] Records already up-to-date");
        }
      } else {
        console.log("[Moodle Fetch Email] No existing records found to update");
      }
    } catch (recordErr) {
      // Don't fail the whole fetch if record update fails
      console.error("[Moodle Fetch Email] Exception updating records:", recordErr);
    }

    console.log("[Moodle Fetch Email] Returning email from Moodle");
    return NextResponse.json({
      success: true,
      data: {
        email: student.email,
        fullname: student.fullname,
        from_cache: false,
      },
    });
  } catch (error) {
    console.error("[Moodle Fetch Email] Error:", error);
    
    if (error instanceof Error) {
      console.error("[Moodle Fetch Email] Error stack:", error.stack);
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to fetch email from Moodle",
      },
      { status: 500 }
    );
  }
}

