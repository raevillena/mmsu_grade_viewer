import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/moodle/sync-emails
 * Bulk sync student emails from Moodle for a specific course
 * 
 * NOTE: This endpoint is disabled because Moodle API doesn't return 'idnumber' 
 * field when fetching all users (bulk fetch). The only reliable identifier is 
 * student number (idnumber), which is only returned when searching by student number.
 * 
 * Use subject-specific sync (/api/moodle/sync-subject-emails) instead, which 
 * searches Moodle individually for each student number in the subject's records.
 */
export async function POST(request: NextRequest) {
  console.log("[Moodle Sync] Bulk email sync endpoint called");
  console.log("[Moodle Sync] WARNING: Bulk sync is not supported because Moodle API doesn't return 'idnumber' field when fetching all users");
  console.log("[Moodle Sync] Use subject-specific sync (/api/moodle/sync-subject-emails) instead, which searches Moodle individually for each student number");
  
  return NextResponse.json(
    {
      success: false,
      error: "Bulk sync is not supported. Moodle API does not return 'idnumber' field when fetching all users (bulk fetch). The only reliable identifier is student number (idnumber), which is only returned when searching by student number. Please use subject-specific sync (/api/moodle/sync-subject-emails) instead, which searches Moodle individually for each student number in the subject's records.",
    },
    { status: 400 }
  );
}
