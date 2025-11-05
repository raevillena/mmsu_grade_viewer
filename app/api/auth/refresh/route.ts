import { NextRequest, NextResponse } from "next/server";
import { refreshAccessToken } from "@/lib/auth";

/**
 * POST /api/auth/refresh
 * Refreshes the access token using the refresh token
 */
export async function POST(request: NextRequest) {
  try {
    const refreshToken = request.cookies.get("refresh_token")?.value;
    const userId = request.cookies.get("user_id")?.value;
    const userRole = request.cookies.get("user_role")?.value;

    if (!refreshToken) {
      return NextResponse.json(
        { error: "Refresh token not found" },
        { status: 401 }
      );
    }

    if (!userId || !userRole) {
      return NextResponse.json(
        { error: "User information not found" },
        { status: 401 }
      );
    }

    const refreshed = await refreshAccessToken(refreshToken, userId, userRole);

    if (!refreshed) {
      return NextResponse.json(
        { error: "Failed to refresh token" },
        { status: 401 }
      );
    }

    const response = NextResponse.json({ success: true });

    // Update cookies with new tokens
    response.cookies.set("access_token", refreshed.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 15, // 15 minutes
      path: "/",
    });

    response.cookies.set("refresh_token", refreshed.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Refresh error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

