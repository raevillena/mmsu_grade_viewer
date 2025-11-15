import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseClient";
import { validateToken } from "@/lib/auth";
import { type GradingSystem, type GradeRecord } from "@/lib/types";

/**
 * POST /api/subjects/[id]/compute-grades
 * Compute final grades for all students in a subject based on the grading system
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: subjectId } = await params;
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

    // Get subject with grading system
    const { data: subject, error: subjectError } = await supabase
      .from("subjects")
      .select("*")
      .eq("id", subjectId)
      .single();

    if (subjectError || !subject) {
      return NextResponse.json({ error: "Subject not found" }, { status: 404 });
    }

    // Teachers can only compute grades for their own subjects
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

    // Check if grading system is configured
    const gradingSystem = subject.grading_system as GradingSystem | null;
    if (!gradingSystem || !gradingSystem.categories || gradingSystem.categories.length === 0) {
      return NextResponse.json(
        { error: "Grading system not configured for this subject" },
        { status: 400 }
      );
    }

    // Get all records for this subject
    const { data: records, error: recordsError } = await supabase
      .from("records")
      .select("*")
      .eq("subject_id", subjectId);

    if (recordsError) {
      return NextResponse.json({ error: recordsError.message }, { status: 500 });
    }

    if (!records || records.length === 0) {
      return NextResponse.json({ error: "No records found for this subject" }, { status: 404 });
    }

    // Compute grades for each record
    const computedGrades = records.map((record: GradeRecord) => {
      const grades = record.grades || {};
      const maxScores = record.max_scores || {};
      
      // Calculate score for each category
      const categoryScores: Record<string, { score: number; maxScore: number; weight: number }> = {};
      
      gradingSystem.categories.forEach((category) => {
        // Calculate each component's percentage score (out of 100%)
        const componentPercentages: number[] = [];
        const componentWeights: number[] = [];
        
        category.components.forEach((component) => {
          // Calculate this component's total score and max score
          let componentTotalScore = 0;
          let componentTotalMaxScore = 0;
          
          component.gradeKeys.forEach((gradeKey) => {
            const score = grades[gradeKey] ?? 0;
            const maxScore = maxScores[gradeKey] ?? 0;
            
            componentTotalScore += score;
            componentTotalMaxScore += maxScore;
          });
          
          // Calculate component percentage (out of 100%)
          const componentPercentage = componentTotalMaxScore > 0
            ? (componentTotalScore / componentTotalMaxScore) * 100
            : 0;
          
          componentPercentages.push(componentPercentage);
          componentWeights.push(component.weight);
        });
        
        // Calculate weighted average of component percentages within the category
        // This gives us the category percentage (out of 100%)
        let weightedSum = 0;
        let totalWeight = 0;
        
        componentPercentages.forEach((percentage, index) => {
          const componentWeight = componentWeights[index];
          weightedSum += percentage * componentWeight;
          totalWeight += componentWeight;
        });
        
        // Category percentage (out of 100%)
        const categoryPercentage = totalWeight > 0 ? weightedSum / totalWeight : 0;
        
        // Scale to category weight: if category is 30%, perfect score (100%) = 30 points
        // Category score = (categoryPercentage / 100) * categoryWeight
        const categoryScore = (categoryPercentage / 100) * category.weight;
        
        categoryScores[category.id] = {
          score: categoryScore,
          maxScore: category.weight, // Category max score equals its weight
          weight: category.weight,
        };
      });
      
      // Calculate final grade: sum of all category scores
      // Each category score is already scaled to its weight (e.g., 30% category = max 30 points)
      // So final grade = sum of category scores (out of 100%)
      let finalGrade = 0;
      
      Object.values(categoryScores).forEach((categoryData) => {
        finalGrade += categoryData.score;
      });
      
      // Round to 2 decimal places
      finalGrade = Math.round(finalGrade * 100) / 100;
      
      const breakdown = gradingSystem.categories.map((category) => ({
        categoryId: category.id,
        categoryName: category.name,
        categoryWeight: category.weight,
        categoryScore: categoryScores[category.id]?.score ?? 0,
        components: category.components.map((component) => {
          const componentScores = component.gradeKeys.map((key) => ({
            gradeKey: key,
            score: grades[key] ?? 0,
            maxScore: maxScores[key] ?? 0,
          }));
          const componentTotal = componentScores.reduce((sum, item) => sum + item.score, 0);
          const componentMax = componentScores.reduce((sum, item) => sum + item.maxScore, 0);
          const componentPercentage = componentMax > 0 ? (componentTotal / componentMax) * 100 : 0;
          
          return {
            componentId: component.id,
            componentName: component.name,
            componentWeight: component.weight,
            componentScore: Math.round(componentPercentage * 100) / 100,
            gradeKeys: componentScores,
          };
        }),
      }));

      const computedGradeData = {
        finalGrade,
        categoryScores,
        breakdown,
        computedAt: new Date().toISOString(),
      };

      // Save computed grade to the record
      await supabase
        .from("records")
        .update({ computed_grade: computedGradeData })
        .eq("id", record.id);

      return {
        recordId: record.id,
        studentName: record.student_name,
        studentNumber: record.student_number,
        finalGrade,
        categoryScores,
        breakdown,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        subjectId,
        subjectName: subject.name,
        computedGrades,
        gradingSystem,
      },
    });
  } catch (error) {
    console.error("Compute grades error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

