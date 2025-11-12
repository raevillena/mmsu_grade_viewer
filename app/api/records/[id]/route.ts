import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseClient";
import { validateToken } from "@/lib/auth";
import { z } from "zod";

/**
 * Record update schema
 */
const updateRecordSchema = z.object({
  student_name: z.string().min(1, "Student name is required").optional(),
  student_number: z.string().min(1, "Student number is required").optional(),
  email: z.string().email("Invalid email address").optional(), // Allow valid email (empty strings will be filtered out)
  code: z.string().min(1, "Security code is required").optional(),
  grades: z.record(z.string(), z.number()).optional(),
  max_scores: z.record(z.string(), z.number()).optional(), // Max scores per grade key (from second row of sheets)
});

/**
 * GET /api/records/[id]
 * Get a specific record by ID
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
      .from("records")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Teachers can only see records for their own subjects
    if (validation.user.role === "teacher") {
      const { data: subject } = await supabase
        .from("subjects")
        .select("teacher_id")
        .eq("id", data.subject_id)
        .single();

      if (subject) {
        const { data: teacherUser } = await supabase
          .from("users")
          .select("id")
          .eq("email", validation.user.email)
          .single();

        if (!teacherUser || subject.teacher_id !== teacherUser.id) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      }
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Get record error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/records/[id]
 * Update a record
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
    const validatedData = updateRecordSchema.parse(body);

    const supabase = createServerSupabaseClient();

    // First, check if record exists and user has permission
    const { data: existingRecord, error: fetchError } = await supabase
      .from("records")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existingRecord) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    // Teachers can only update records for their own subjects
    if (validation.user.role === "teacher") {
      const { data: subject } = await supabase
        .from("subjects")
        .select("teacher_id")
        .eq("id", existingRecord.subject_id)
        .single();

      if (subject) {
        const { data: teacherUser } = await supabase
          .from("users")
          .select("id")
          .eq("email", validation.user.email)
          .single();

        if (!teacherUser || subject.teacher_id !== teacherUser.id) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      }
    }

    // Add updated_at timestamp when updating
    // Use the provided data directly (email should be fetched from Moodle in frontend if needed)
    // Filter out empty email strings (database requires NOT NULL)
    const updateData: any = {
      ...validatedData,
      updated_at: new Date().toISOString(),
    };
    
    // Remove email from update if it's an empty string (database requires NOT NULL)
    if (updateData.email === "") {
      delete updateData.email;
    }

    const { data, error } = await supabase
      .from("records")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error(`[Update Record] Database error:`, error);
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

    console.error("Update record error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/records/[id]/regenerate-code
 * Regenerate access code for a record
 */
export async function PATCH(
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

    // Only teachers and admins can regenerate codes
    if (validation.user.role !== "teacher" && validation.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = createServerSupabaseClient();

    // First, check if record exists and user has permission
    const { data: existingRecord, error: fetchError } = await supabase
      .from("records")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existingRecord) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    // Teachers can only regenerate codes for their own subjects
    if (validation.user.role === "teacher") {
      const { data: subject } = await supabase
        .from("subjects")
        .select("teacher_id")
        .eq("id", existingRecord.subject_id)
        .single();

      if (subject) {
        const { data: teacherUser } = await supabase
          .from("users")
          .select("id")
          .eq("email", validation.user.email)
          .single();

        if (!teacherUser || subject.teacher_id !== teacherUser.id) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      }
    }

    // Generate a new 6-digit access code
    // Generate a random 6-digit code for security (prevents predictability)
    const newCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Update the record with new code
    const { data, error } = await supabase
      .from("records")
      .update({
        code: newCode,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Regenerate code error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/records/[id]
 * Delete a record
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

    // First, check if record exists and user has permission
    const { data: existingRecord, error: fetchError } = await supabase
      .from("records")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existingRecord) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    // Teachers can only delete records for their own subjects
    if (validation.user.role === "teacher") {
      const { data: subject } = await supabase
        .from("subjects")
        .select("teacher_id")
        .eq("id", existingRecord.subject_id)
        .single();

      if (subject) {
        const { data: teacherUser } = await supabase
          .from("users")
          .select("id")
          .eq("email", validation.user.email)
          .single();

        if (!teacherUser || subject.teacher_id !== teacherUser.id) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      }
    }

    const { error } = await supabase
      .from("records")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete record error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

