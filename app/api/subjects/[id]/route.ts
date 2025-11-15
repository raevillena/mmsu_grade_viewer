import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseClient";
import { validateToken } from "@/lib/auth";
import { z } from "zod";

/**
 * Subject update schema
 */
const updateSubjectSchema = z.object({
  name: z.string().min(1, "Subject name is required").optional(),
  teacher_id: z.string().uuid("Invalid teacher ID").optional(),
  grading_system: z.any().optional(), // JSONB field - accept any valid JSON structure
});

/**
 * GET /api/subjects/[id]
 * Get a specific subject by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from("subjects")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Teachers can only see their own subjects
    if (validation.user.role === "teacher") {
      const { data: teacherUser } = await supabase
        .from("users")
        .select("id")
        .eq("email", validation.user.email)
        .single();

      if (!teacherUser || data.teacher_id !== teacherUser.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Get subject error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/subjects/[id]
 * Update a subject
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    const body = await request.json();
    const validatedData = updateSubjectSchema.parse(body);

    const supabase = createServerSupabaseClient();

    // First, check if subject exists and user has permission
    const { data: existingSubject, error: fetchError } = await supabase
      .from("subjects")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existingSubject) {
      return NextResponse.json({ error: "Subject not found" }, { status: 404 });
    }

    // Teachers can only update their own subjects
    if (validation.user.role === "teacher") {
      const { data: teacherUser } = await supabase
        .from("users")
        .select("id")
        .eq("email", validation.user.email)
        .single();

      if (!teacherUser || existingSubject.teacher_id !== teacherUser.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      // Teachers cannot change teacher_id
      if (validatedData.teacher_id) {
        delete validatedData.teacher_id;
      }
    }

    const { data, error } = await supabase
      .from("subjects")
      .update(validatedData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Update subject error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/subjects/[id]
 * Delete a subject
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    const supabase = createServerSupabaseClient();

    // First, check if subject exists and user has permission
    const { data: existingSubject, error: fetchError } = await supabase
      .from("subjects")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existingSubject) {
      return NextResponse.json({ error: "Subject not found" }, { status: 404 });
    }

    // Teachers can only delete their own subjects
    if (validation.user.role === "teacher") {
      const { data: teacherUser } = await supabase
        .from("users")
        .select("id")
        .eq("email", validation.user.email)
        .single();

      if (!teacherUser || existingSubject.teacher_id !== teacherUser.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const { error } = await supabase
      .from("subjects")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete subject error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

