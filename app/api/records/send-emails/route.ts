import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseClient";
import { validateToken } from "@/lib/auth";
import { sendAccessCodeEmail } from "@/lib/email";

/**
 * POST /api/records/send-emails
 * Send access code emails to students for a specific subject
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

    // Only teachers and admins can send emails
    if (validation.user.role !== "teacher" && validation.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { subject_id, record_ids } = body;

    if (!subject_id) {
      return NextResponse.json(
        { error: "subject_id is required" },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseClient();

    // Get subject details
    const { data: subject, error: subjectError } = await supabase
      .from("subjects")
      .select("id, name, teacher_id")
      .eq("id", subject_id)
      .single();

    if (subjectError || !subject) {
      return NextResponse.json({ error: "Subject not found" }, { status: 404 });
    }

    // Check if teacher owns this subject
    if (validation.user.role === "teacher") {
      const { data: teacherUser } = await supabase
        .from("users")
        .select("id")
        .eq("email", validation.user.email)
        .single();

      if (!teacherUser || subject.teacher_id !== teacherUser.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Get records for this subject
    let query = supabase
      .from("records")
      .select("id, student_name, student_number, email, code")
      .eq("subject_id", subject_id);

    // If specific record IDs provided, filter by them
    if (record_ids && Array.isArray(record_ids) && record_ids.length > 0) {
      query = query.in("id", record_ids);
    }

    const { data: records, error: recordsError } = await query;

    if (recordsError) {
      return NextResponse.json(
        { error: recordsError.message },
        { status: 500 }
      );
    }

    if (!records || records.length === 0) {
      return NextResponse.json(
        { error: "No records found for this subject" },
        { status: 404 }
      );
    }

    // Get base URL for grades page
    let baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
    
    // If not set, try to get from request headers (for production)
    if (!baseUrl) {
      const host = request.headers.get("host");
      const protocol = request.headers.get("x-forwarded-proto") || 
                      (request.headers.get("x-forwarded-ssl") === "on" ? "https" : "http");
      if (host) {
        baseUrl = `${protocol}://${host}`;
      }
    }
    
    // If still not set, try to construct from Vercel URL
    if (!baseUrl && process.env.VERCEL_URL) {
      baseUrl = `https://${process.env.VERCEL_URL}`;
    }
    
    // Fallback to localhost for development
    if (!baseUrl) {
      baseUrl = process.env.NODE_ENV === "production" 
        ? "https://yourdomain.com" // Replace with your actual domain
        : "http://localhost:3000";
    }
    
    // Remove trailing slash if present
    baseUrl = baseUrl.replace(/\/$/, "");
    
    const gradesUrl = `${baseUrl}/grades`;
    
    console.log("[Send Emails] Using base URL:", baseUrl);
    console.log("[Send Emails] Grades URL:", gradesUrl);

    // Send emails
    const results = {
      total: records.length,
      sent: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const record of records) {
      if (!record.email || !record.code) {
        results.failed++;
        results.errors.push(`${record.student_name || record.student_number}: Missing email or access code`);
        continue;
      }

      // Build grades URL with student number and code as params for easy access
      const gradesUrlWithParams = `${gradesUrl}?student_number=${encodeURIComponent(record.student_number)}&code=${encodeURIComponent(record.code)}`;
      
      const emailResult = await sendAccessCodeEmail({
        to: record.email,
        studentName: record.student_name,
        studentNumber: record.student_number,
        accessCode: record.code,
        subjectName: subject.name,
        gradesUrl: gradesUrlWithParams,
      });

      if (emailResult.success) {
        results.sent++;
      } else {
        results.failed++;
        results.errors.push(`${record.student_name || record.student_number}: ${emailResult.error || "Failed to send"}`);
      }
    }

    return NextResponse.json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error("Send emails error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

