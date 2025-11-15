/**
 * User roles in the system
 */
export type UserRole = "admin" | "teacher" | "student";

/**
 * User model matching the Supabase schema
 */
export interface User {
  id: string;
  external_id: string | null;
  name: string;
  email: string;
  role: UserRole;
  created_at: string;
}

/**
 * Grading system component configuration
 * Maps grade keys (like "quiz1", "LE1") to grading components
 */
export interface GradingComponent {
  id: string; // Unique identifier for this component (e.g., "midterm", "final", "long_exam")
  name: string; // Display name (e.g., "Midterm Exam", "Long Exam")
  weight: number; // Weight percentage (e.g., 15 for 15%)
  gradeKeys: string[]; // Array of grade keys that belong to this component (e.g., ["quiz1", "quiz2"])
}

/**
 * Grading system category (e.g., "Major Exams", "Major Outputs")
 */
export interface GradingCategory {
  id: string; // Unique identifier (e.g., "major_exams", "major_outputs")
  name: string; // Display name (e.g., "Major Exams")
  weight: number; // Total weight for this category (e.g., 30 for 30%)
  components: GradingComponent[]; // Components within this category
}

/**
 * Complete grading system configuration
 */
export interface GradingSystem {
  categories: GradingCategory[]; // Array of categories
  version?: string; // Optional version identifier
  passing_grade?: number; // Minimum grade to pass (default: 50)
}

/**
 * Subject model matching the Supabase schema
 */
export interface Subject {
  id: string;
  name: string;
  teacher_id: string;
  grading_system?: GradingSystem; // Optional grading system configuration
  created_at: string;
}

/**
 * Grade record model matching the Supabase schema
 */
export interface ComputedGrade {
  finalGrade: number;
  categoryScores: globalThis.Record<string, { score: number; maxScore: number; weight: number }>;
  breakdown: any[];
  computedAt: string;
}

export interface GradeRecord {
  id: string;
  subject_id: string;
  student_name: string;
  student_number: string;
  email: string;
  code: string;
  grades: globalThis.Record<string, number>; // JSONB in database, typed as Record<string, number>
  max_scores?: globalThis.Record<string, number>; // JSONB in database, max score per grade key (from second row of sheets)
  computed_grade?: ComputedGrade; // JSONB in database, computed final grade and breakdown
  created_at: string;
  updated_at?: string;
}

// Keep Record as an alias for backward compatibility
export type Record = GradeRecord;

/**
 * External authentication response from 3rd-party API
 * Matches the actual API response structure from umans-api.nbericmmsu.com
 */
export interface ExternalAuthResponse {
  msg: string;
  user: {
    id: number;
    email: string;
    role: "admin" | "teacher";
    mobileNo?: string;
    firstName: string;
    lastName: string;
    avatar?: string;
    apps?: Array<{
      name: string;
      Roles: {
        userType: string;
      };
    }>;
  };
  token: {
    accessToken: string;
    refreshToken: string;
  };
}

/**
 * Token validation response from external API
 */
export interface TokenValidationResponse {
  valid: boolean;
  user?: {
    id: string;
    name: string;
    email: string;
    role: "admin" | "teacher";
  };
}

