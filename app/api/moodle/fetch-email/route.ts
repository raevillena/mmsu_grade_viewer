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

    // Only teachers and admins can fetch emails
    if (validation.user.role !== "teacher" && validation.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { student_number, student_name, courseid, enrolid } = body;

    if (!student_number && !student_name) {
      return NextResponse.json(
        { error: "student_number or student_name is required" },
        { status: 400 }
      );
    }

    if (!courseid || !enrolid) {
      return NextResponse.json(
        { error: "courseid and enrolid are required" },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseClient();
    let cached: any = null;

    // First, try to find by student_number if provided
    if (student_number) {
      const { data, error } = await supabase
        .from("student_email_cache")
        .select("*")
        .eq("student_number", student_number)
        .single();

      cached = data;
      if (error && error.code !== "PGRST116") {
        console.error("[Moodle Fetch Email] Cache lookup error:", error);
      }
    }

    // If not found by student_number, try searching by name using LIKE
    if (!cached && student_name) {
      const { data: nameMatches, error: nameError } = await supabase
        .from("student_email_cache")
        .select("*")
        .ilike("fullname", `%${student_name}%`);

      if (nameError) {
        console.error("[Moodle Fetch Email] Cache lookup error by name:", nameError);
      } else if (nameMatches && nameMatches.length > 0) {
        if (nameMatches.length === 1) {
          cached = nameMatches[0];
          // If we have student_number but it doesn't match, use Moodle to get exact match
          if (student_number && cached.student_number !== student_number) {
            cached = null; // Force Moodle lookup
          }
        } else {
          cached = null; // Force Moodle lookup to get exact match
        }
      }
    }

    // If found in cache and synced recently (within 24 hours), return it
    if (cached && cached.last_synced_at) {
      const lastSynced = new Date(cached.last_synced_at);
      const hoursSinceSync = (Date.now() - lastSynced.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceSync < 24) {
        return NextResponse.json({
          success: true,
          data: {
            email: cached.email,
            fullname: cached.fullname,
            from_cache: true,
          },
        });
      }
    }

    // Fetch from Moodle
    const client = MoodleClient.fromEnv();

    if (process.env.MOODLE_LOGIN_USERNAME && process.env.MOODLE_LOGIN_PASSWORD) {
      await client.login();
    }

    const sesskey = await client.fetchSesskey();
    // Use student_number for search if available, otherwise use student_name
    const searchTerm = student_number || student_name || "";
    const payload = await client.callService<PotentialUsersResponse>(
      "core_enrol_get_potential_users",
      {
        courseid: String(courseid),
        enrolid: String(enrolid),
        search: searchTerm,
        searchanywhere: true,
        page: 0,
        perpage: 10,
      },
      { sesskey }
    );


    // Find matching student - prefer student_number match, then name match
    let student = null;
    if (student_number) {
      // First try to match by student number (most accurate)
      student = payload.find((user) => user.idnumber === student_number);
    }
    
    // If not found by student_number, try to match by name
    if (!student && student_name) {
      // Try exact name match first
      student = payload.find((user) => 
        user.fullname?.toLowerCase().trim() === student_name.toLowerCase().trim()
      );
      
      // If still not found, try partial match
      if (!student) {
        student = payload.find((user) => 
          user.fullname?.toLowerCase().includes(student_name.toLowerCase().trim())
        );
      }
    }

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

