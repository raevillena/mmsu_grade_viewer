import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseClient";
import { validateToken } from "@/lib/auth";

/**
 * GET /api/moodle/lookup-email?student_number=xxx
 * Lookup student email from cache (fast, no Moodle API call)
 */
export async function GET(request: NextRequest) {
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

    // Only teachers and admins can lookup emails
    if (validation.user.role !== "teacher" && validation.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const studentNumber = searchParams.get("student_number");

    if (!studentNumber) {
      return NextResponse.json(
        { error: "student_number query parameter is required" },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from("student_email_cache")
      .select("email, fullname, last_synced_at")
      .eq("student_number", studentNumber)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Student email not found in cache" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        email: data.email,
        fullname: data.fullname,
        last_synced_at: data.last_synced_at,
      },
    });
  } catch (error) {
    console.error("Email lookup error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to lookup email",
      },
      { status: 500 }
    );
  }
}

