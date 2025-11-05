import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseClient";
import { validateToken } from "@/lib/auth";
import { z } from "zod";

/**
 * Record creation schema
 */
const createRecordSchema = z.object({
  subject_id: z.string().uuid("Invalid subject ID"),
  student_name: z.string().min(1, "Student name is required"),
  student_number: z.string().min(1, "Student number is required"),
  email: z.string().email("Invalid email address"),
  code: z.string().min(1, "Security code is required"),
  grades: z.record(z.number(), z.number()),
});

/**
 * GET /api/records
 * Get records - filtered by subject_id, teacher, or public lookup
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { searchParams } = new URL(request.url);
    const subjectId = searchParams.get("subject_id");
    const email = searchParams.get("email");
    const studentNumber = searchParams.get("student_number");
    const code = searchParams.get("code");

    // Public lookup (no auth required)
    if (email && studentNumber && code) {
      const { data, error } = await supabase
        .from("records")
        .select("*, subjects(name)")
        .eq("email", email)
        .eq("student_number", studentNumber)
        .eq("code", code);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Format the data to include subject name as a flat property
      const formattedData = (data || []).map((record: any) => ({
        ...record,
        subject_name: record.subjects?.name || null,
      }));

      return NextResponse.json({ data: formattedData });
    }

    // Authenticated access
    const accessToken = request.cookies.get("access_token")?.value;

    if (!accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const validation = await validateToken(accessToken);

    if (!validation.valid || !validation.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let query = supabase.from("records").select("*");

    // Filter by subject_id if provided
    if (subjectId) {
      query = query.eq("subject_id", subjectId);

      // Teachers can only see records for their own subjects
      if (validation.user.role === "teacher") {
        const { data: teacherUser } = await supabase
          .from("users")
          .select("id")
          .eq("email", validation.user.email)
          .single();

        if (teacherUser) {
          const { data: subject } = await supabase
            .from("subjects")
            .select("teacher_id")
            .eq("id", subjectId)
            .single();

          if (!subject || subject.teacher_id !== teacherUser.id) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
          }
        }
      }
    } else if (validation.user.role === "teacher") {
      // Teachers see all records from their subjects
      const { data: teacherUser } = await supabase
        .from("users")
        .select("id")
        .eq("email", validation.user.email)
        .single();

      if (teacherUser) {
        const { data: subjects } = await supabase
          .from("subjects")
          .select("id")
          .eq("teacher_id", teacherUser.id);

        if (subjects && subjects.length > 0) {
          const subjectIds = subjects.map((s) => s.id);
          query = query.in("subject_id", subjectIds);
        } else {
          return NextResponse.json({ data: [] });
        }
      }
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Get records error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/records
 * Create a new grade record
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

    // Only teachers can create records (or admin)
    if (validation.user.role !== "teacher" && validation.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = createRecordSchema.parse(body);

    const supabase = createServerSupabaseClient();

    // Verify subject exists and teacher has permission
    const { data: subject, error: subjectError } = await supabase
      .from("subjects")
      .select("teacher_id")
      .eq("id", validatedData.subject_id)
      .single();

    if (subjectError || !subject) {
      return NextResponse.json({ error: "Subject not found" }, { status: 404 });
    }

    // Teachers can only create records for their own subjects
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

    const { data, error } = await supabase
      .from("records")
      .insert(validatedData)
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

    console.error("Create record error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

