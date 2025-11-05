import { NextRequest, NextResponse } from "next/server";
import { validateToken } from "@/lib/auth";

/**
 * POST /api/auth/validate
 * Validates the current access token
 */
export async function POST(request: NextRequest) {
  try {
    const accessToken = request.cookies.get("access_token")?.value;

    if (!accessToken) {
      return NextResponse.json({ valid: false }, { status: 401 });
    }

    const refreshToken = request.cookies.get("refresh_token")?.value;
    const userId = request.cookies.get("user_id")?.value;
    const userRole = request.cookies.get("user_role")?.value;
    const validation = await validateToken(accessToken, refreshToken, userId, userRole);

    if (!validation.valid) {
      return NextResponse.json({ valid: false }, { status: 401 });
    }

    return NextResponse.json({
      valid: true,
      user: validation.user,
    });
  } catch (error) {
    console.error("Validation error:", error);
    return NextResponse.json({ valid: false }, { status: 500 });
  }
}

