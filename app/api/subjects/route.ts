import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseClient";
import { validateToken } from "@/lib/auth";
import { z } from "zod";

/**
 * Subject creation schema
 */
const createSubjectSchema = z.object({
  name: z.string().min(1, "Subject name is required"),
  teacher_id: z.string().uuid("Invalid teacher ID"),
});

/**
 * GET /api/subjects
 * Get all subjects for the authenticated teacher or all subjects for admin
 */
export async function GET(request: NextRequest) {
  try {
    const accessToken = request.cookies.get("access_token")?.value;

    if (!accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const validation = await validateToken(accessToken);

    if (!validation.valid || !validation.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServerSupabaseClient();
    const { searchParams } = new URL(request.url);
    const teacherId = searchParams.get("teacher_id");

    let query = supabase.from("subjects").select("*");

    // Teachers can only see their own subjects
    if (validation.user.role === "teacher") {
      // Get teacher's user ID from Supabase
      const { data: teacherUser } = await supabase
        .from("users")
        .select("id")
        .eq("email", validation.user.email)
        .single();

      if (teacherUser) {
        query = query.eq("teacher_id", teacherUser.id);
      } else {
        return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
      }
    } else if (teacherId && validation.user.role === "admin") {
      // Admin can filter by teacher_id
      query = query.eq("teacher_id", teacherId);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Get subjects error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/subjects
 * Create a new subject
 */
export async function POST(request: NextRequest) {
  try {
    const accessToken = request.cookies.get("access_token")?.value;

    if (!accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const validation = await validateToken(accessToken);

    if (!validation.valid || !validation.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only teachers can create subjects (or admin on behalf of teachers)
    if (validation.user.role !== "teacher" && validation.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = createSubjectSchema.parse(body);

    const supabase = createServerSupabaseClient();

    // If teacher, ensure they're creating for themselves
    if (validation.user.role === "teacher") {
      const { data: teacherUser } = await supabase
        .from("users")
        .select("id")
        .eq("email", validation.user.email)
        .single();

      if (!teacherUser || teacherUser.id !== validatedData.teacher_id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const { data, error } = await supabase
      .from("subjects")
      .insert({
        name: validatedData.name,
        teacher_id: validatedData.teacher_id,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Create subject error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

