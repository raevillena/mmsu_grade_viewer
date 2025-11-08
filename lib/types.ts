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
 * Subject model matching the Supabase schema
 */
export interface Subject {
  id: string;
  name: string;
  teacher_id: string;
  created_at: string;
}

/**
 * Grade record model matching the Supabase schema
 */
export interface GradeRecord {
  id: string;
  subject_id: string;
  student_name: string;
  student_number: string;
  email: string;
  code: string;
  grades: globalThis.Record<string, number>; // JSONB in database, typed as Record<string, number>
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

