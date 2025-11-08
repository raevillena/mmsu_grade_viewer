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
 * POST /api/moodle/sync-subject-emails
 * Sync emails for students in a specific subject's grade records
 * Only updates existing records, does not update the global email cache
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  console.log("[Moodle Sync Subject] Starting subject email sync...");

  try {
    const accessToken = request.cookies.get("access_token")?.value;

    if (!accessToken) {
      console.error("[Moodle Sync Subject] No access token found");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const refreshToken = request.cookies.get("refresh_token")?.value;
    const userId = request.cookies.get("user_id")?.value;
    const userRole = request.cookies.get("user_role")?.value;
    console.log("[Moodle Sync Subject] Validating token for user:", { userId, userRole });

    const validation = await validateToken(accessToken, refreshToken, userId, userRole);

    if (!validation.valid || !validation.user) {
      console.error("[Moodle Sync Subject] Token validation failed");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[Moodle Sync Subject] Token validated for user:", validation.user.email, "role:", validation.user.role);

    // Only teachers and admins can sync subject emails
    if (validation.user.role !== "teacher" && validation.user.role !== "admin") {
      console.error("[Moodle Sync Subject] Forbidden: User role is", validation.user.role);
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { subject_id, courseid, enrolid } = body;

    console.log("[Moodle Sync Subject] Request parameters:", {
      subject_id,
      courseid,
      enrolid,
    });

    if (!subject_id) {
      console.error("[Moodle Sync Subject] Missing subject_id");
      return NextResponse.json(
        { error: "subject_id is required" },
        { status: 400 }
      );
    }

    if (!courseid || !enrolid) {
      console.error("[Moodle Sync Subject] Missing courseid or enrolid");
      return NextResponse.json(
        { error: "courseid and enrolid are required" },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseClient();

    // Verify subject exists and user has permission
    const { data: subject, error: subjectError } = await supabase
      .from("subjects")
      .select("id, name, teacher_id")
      .eq("id", subject_id)
      .single();

    if (subjectError || !subject) {
      console.error("[Moodle Sync Subject] Subject not found:", subjectError);
      return NextResponse.json({ error: "Subject not found" }, { status: 404 });
    }

    // Teachers can only sync emails for their own subjects
    if (validation.user.role === "teacher") {
      const { data: teacherUser } = await supabase
        .from("users")
        .select("id")
        .eq("email", validation.user.email)
        .single();

      if (!teacherUser || subject.teacher_id !== teacherUser.id) {
        console.error("[Moodle Sync Subject] Forbidden: Teacher does not own this subject");
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    console.log("[Moodle Sync Subject] Subject verified:", subject.name);

    // Get all records for this subject
    console.log("[Moodle Sync Subject] Fetching records for subject...");
    const { data: records, error: recordsError } = await supabase
      .from("records")
      .select("id, student_number, email, student_name")
      .eq("subject_id", subject_id);

    if (recordsError) {
      console.error("[Moodle Sync Subject] Error fetching records:", recordsError);
      return NextResponse.json(
        { error: "Failed to fetch records" },
        { status: 500 }
      );
    }

    if (!records || records.length === 0) {
      console.log("[Moodle Sync Subject] No records found for this subject");
      return NextResponse.json({
        success: true,
        data: {
          total: 0,
          updated: 0,
          notFound: 0,
          errors: 0,
        },
      });
    }

    console.log(`[Moodle Sync Subject] Found ${records.length} records to sync`);

    // Initialize Moodle client
    console.log("[Moodle Sync Subject] Initializing Moodle client...");
    const client = MoodleClient.fromEnv();

    if (process.env.MOODLE_LOGIN_USERNAME && process.env.MOODLE_LOGIN_PASSWORD) {
      console.log("[Moodle Sync Subject] Logging in to Moodle...");
      await client.login();
      console.log("[Moodle Sync Subject] Login successful");
    }

    const sesskey = await client.fetchSesskey();
    console.log("[Moodle Sync Subject] Sesskey retrieved");

    // Sync emails for each record by searching Moodle individually
    // This approach is necessary because bulk fetch doesn't return idnumber,
    // but individual searches by student number do return idnumber
    let updatedCount = 0;
    let notFoundCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    console.log(`[Moodle Sync Subject] Starting to sync ${records.length} records...`);
    console.log(`[Moodle Sync Subject] Will search Moodle individually for each student number`);

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      
      if (!record.student_number) {
        console.log(`[Moodle Sync Subject] Skipping record ${i + 1} (no student_number)`);
        continue;
      }

      try {
        console.log(`[Moodle Sync Subject] Searching Moodle for student ${record.student_number} (${i + 1}/${records.length})...`);

        // Search Moodle individually for this student number
        // This will return idnumber field (unlike bulk fetch)
        const payload = await client.callService<PotentialUsersResponse>(
          "core_enrol_get_potential_users",
          {
            courseid: String(courseid),
            enrolid: String(enrolid),
            search: record.student_number,
            searchanywhere: true,
            page: 0,
            perpage: 10,
          },
          { sesskey }
        );

        console.log(`[Moodle Sync Subject] Received ${payload.length} results from Moodle for "${record.student_number}"`);
        
        if (payload.length === 0) {
          console.log(`[Moodle Sync Subject] No results found for ${record.student_number}`);
          notFoundCount++;
          continue;
        }

        // Log sample results for first few records
        if (i < 3) {
          console.log(`[Moodle Sync Subject] Sample results:`, payload.slice(0, 3).map(u => ({
            idnumber: u.idnumber,
            fullname: u.fullname,
            email: u.email,
          })));
        }

        let student: PotentialUser | undefined;

        // Strategy 1: If exactly 1 result, use it (most reliable)
        if (payload.length === 1) {
          student = payload[0];
          console.log(`[Moodle Sync Subject] Single result found, using it: ${student.fullname}`);
        } else {
          // Strategy 2: Multiple results - find best match by name similarity
          console.log(`[Moodle Sync Subject] Multiple results (${payload.length}), finding best name match...`);
          
          // Helper function to calculate name similarity (simple Levenshtein-like approach)
          const calculateNameSimilarity = (name1: string, name2: string): number => {
            const normalize = (str: string) => str.toLowerCase().trim().replace(/\s+/g, ' ');
            const n1 = normalize(name1);
            const n2 = normalize(name2);
            
            // Exact match
            if (n1 === n2) return 1.0;
            
            // Check if one contains the other
            if (n1.includes(n2) || n2.includes(n1)) return 0.8;
            
            // Calculate common words
            const words1 = new Set(n1.split(/\s+/));
            const words2 = new Set(n2.split(/\s+/));
            const commonWords = [...words1].filter(w => words2.has(w));
            const totalWords = Math.max(words1.size, words2.size);
            
            if (totalWords === 0) return 0;
            
            // Calculate similarity based on common words
            const wordSimilarity = commonWords.length / totalWords;
            
            // Also check character-level similarity for partial matches
            let charMatches = 0;
            const minLen = Math.min(n1.length, n2.length);
            for (let i = 0; i < minLen; i++) {
              if (n1[i] === n2[i]) charMatches++;
            }
            const charSimilarity = minLen > 0 ? charMatches / minLen : 0;
            
            // Combine word and character similarity
            return (wordSimilarity * 0.7) + (charSimilarity * 0.3);
          };

          // Find the best matching student by name
          const recordName = record.student_name || '';
          let bestMatch: { student: PotentialUser; similarity: number } | null = null;

          for (const user of payload) {
            if (!user.email || !user.fullname) continue;
            
            const similarity = calculateNameSimilarity(recordName, user.fullname);
            
            if (i < 3) {
              console.log(`[Moodle Sync Subject] Comparing "${recordName}" with "${user.fullname}": similarity = ${(similarity * 100).toFixed(1)}%`);
            }
            
            if (!bestMatch || similarity > bestMatch.similarity) {
              bestMatch = { student: user, similarity };
            }
          }

          if (bestMatch && bestMatch.similarity >= 0.3) {
            // Use match if similarity is at least 30%
            student = bestMatch.student;
            console.log(`[Moodle Sync Subject] Best match found: "${bestMatch.student.fullname}" (similarity: ${(bestMatch.similarity * 100).toFixed(1)}%)`);
          } else {
            console.log(`[Moodle Sync Subject] No good name match found (best similarity: ${bestMatch ? (bestMatch.similarity * 100).toFixed(1) : 0}%)`);
          }
        }

        if (!student || !student.email) {
          console.log(`[Moodle Sync Subject] Student ${record.student_number} could not be matched in Moodle results`);
          if (i < 3) {
            console.log(`[Moodle Sync Subject] Available names in results:`, payload.map(u => u.fullname).filter(Boolean));
          }
          notFoundCount++;
          continue;
        }

        if (i < 3) {
          console.log(`[Moodle Sync Subject] Found student in Moodle:`, {
            idnumber: student.idnumber,
            fullname: student.fullname,
            email: student.email,
          });
        }

        // Always update if email or name is different (even if slightly different format)
        const emailDiffers = record.email?.toLowerCase().trim() !== student.email?.toLowerCase().trim();
        const nameDiffers = record.student_name?.trim() !== student.fullname?.trim();

        if (emailDiffers || nameDiffers) {
          if (i < 3) {
            console.log(`[Moodle Sync Subject] Update needed:`, {
              emailDiffers,
              nameDiffers,
              currentEmail: record.email,
              newEmail: student.email,
              currentName: record.student_name,
              newName: student.fullname,
            });
          }
          
          const { error: updateError, data: updateData } = await supabase
            .from("records")
            .update({
              email: student.email,
              student_name: student.fullname,
            })
            .eq("id", record.id)
            .select();

          if (updateError) {
            console.error(`[Moodle Sync Subject] Error updating record ${record.id}:`, updateError);
            errorCount++;
            errors.push(`${record.student_number}: ${updateError.message}`);
          } else {
            updatedCount++;
            if (i < 3) {
              console.log(`[Moodle Sync Subject] Successfully updated record ${record.id}:`, updateData);
            }
          }
        } else {
          if (i < 3) {
            console.log(`[Moodle Sync Subject] Record for ${record.student_number} already up-to-date`);
          }
        }

        // Log progress every 20 records
        if ((i + 1) % 20 === 0) {
          console.log(`[Moodle Sync Subject] Progress: ${i + 1}/${records.length} processed (${updatedCount} updated, ${notFoundCount} not found, ${errorCount} errors)`);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        console.error(`[Moodle Sync Subject] Exception processing record ${record.student_number}:`, err);
        errorCount++;
        errors.push(`${record.student_number}: ${errorMessage}`);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[Moodle Sync Subject] Sync completed in ${duration}ms. Summary:`, {
      total: records.length,
      updated: updatedCount,
      notFound: notFoundCount,
      errors: errorCount,
    });

    return NextResponse.json({
      success: true,
      data: {
        total: records.length,
        updated: updatedCount,
        notFound: notFoundCount,
        errors: errorCount,
        errorDetails: errors.slice(0, 10),
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Moodle Sync Subject] Error after ${duration}ms:`, error);
    
    if (error instanceof Error) {
      console.error("[Moodle Sync Subject] Error stack:", error.stack);
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to sync subject emails",
      },
      { status: 500 }
    );
  }
}

