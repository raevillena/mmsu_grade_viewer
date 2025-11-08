import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseClient";
import { validateToken } from "@/lib/auth";

/**
 * GET /api/students
 * Get students from the email cache with optional search
 * Admin only
 */
export async function GET(request: NextRequest) {
  try {
    const accessToken = request.cookies.get("access_token")?.value;

    if (!accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get refresh token and user info from cookies (required by validateToken)
    const refreshToken = request.cookies.get("refresh_token")?.value;
    const userId = request.cookies.get("user_id")?.value;
    const userRole = request.cookies.get("user_role")?.value;
    const validation = await validateToken(accessToken, refreshToken, userId, userRole);

    if (!validation.valid || !validation.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins can view students list
    if (validation.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const supabase = createServerSupabaseClient();
    let query = supabase
      .from("student_email_cache")
      .select("*", { count: "exact" })
      .order("fullname", { ascending: true, nullsLast: true });

    // Apply search filter if provided
    if (search.trim()) {
      // Search in fullname, email, or student_number
      query = query.or(
        `fullname.ilike.%${search}%,email.ilike.%${search}%,student_number.ilike.%${search}%`
      );
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error("Get students error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      data: data || [],
      count: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Get students error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

