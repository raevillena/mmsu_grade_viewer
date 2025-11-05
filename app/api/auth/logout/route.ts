import { NextResponse } from "next/server";

/**
 * POST /api/auth/logout
 * Clears authentication cookies
 */
export async function POST() {
  const response = NextResponse.json({ success: true });

  // Clear authentication cookies
  response.cookies.delete("access_token");
  response.cookies.delete("refresh_token");
  response.cookies.delete("user_id");
  response.cookies.delete("user_role");

  return response;
}

