import { createClient } from "@supabase/supabase-js";

// Supabase configuration - these should be set in environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Supabase URL or Anon Key is missing. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your environment variables."
  );
}

/**
 * Supabase client for client-side operations
 * Use this for public queries that don't require authentication
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Supabase client for server-side operations
 * Use this in API routes and server components
 */
export function createServerSupabaseClient() {
  return createClient(supabaseUrl, supabaseAnonKey);
}

