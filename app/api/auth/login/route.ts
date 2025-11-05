import { NextRequest, NextResponse } from "next/server";
import { loginWithExternalAPI, setAuthTokens } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabaseClient";
import { z } from "zod";

/**
 * Login request schema
 */
const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

/**
 * POST /api/auth/login
 * Authenticates user with external API and sets HTTP-only cookies
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = loginSchema.parse(body);

    console.log("Login attempt for email:", validatedData.email);

    // Authenticate with external API
    let authResponse;
    try {
      authResponse = await loginWithExternalAPI(
        validatedData.email,
        validatedData.password
      );
    } catch (apiError: any) {
      console.error("External API error:", apiError);
      return NextResponse.json(
        { error: apiError.message || "Failed to connect to authentication server" },
        { status: 503 }
      );
    }

    if (!authResponse) {
      console.error("Auth response is null - invalid credentials or API error");
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    console.log("Login successful for:", authResponse.user.email);

    // Extract data from the API response
    const userRole = authResponse.user.role as "admin" | "teacher";
    const userName = `${authResponse.user.firstName} ${authResponse.user.lastName}`.trim();
    const externalUserId = String(authResponse.user.id);
    const accessToken = authResponse.token.accessToken;
    const refreshToken = authResponse.token.refreshToken;

    // Sync user to Supabase if they don't exist
    const supabase = createServerSupabaseClient();
    const { data: existingUser } = await supabase
      .from("users")
      .select("*")
      .eq("email", authResponse.user.email)
      .single();

    if (!existingUser) {
      // Create user in Supabase
      await supabase.from("users").insert({
        external_id: externalUserId,
        name: userName,
        email: authResponse.user.email,
        role: userRole,
      });
    } else {
      // Update user if they exist but external_id is missing or name has changed
      const updates: any = {};
      if (!existingUser.external_id) {
        updates.external_id = externalUserId;
      }
      if (existingUser.name !== userName) {
        updates.name = userName;
      }
      if (Object.keys(updates).length > 0) {
        await supabase
          .from("users")
          .update(updates)
          .eq("id", existingUser.id);
      }
    }

    // Set tokens in HTTP-only cookies
    const response = NextResponse.json({
      success: true,
      user: {
        name: userName,
        email: authResponse.user.email,
        role: userRole,
      },
    });

    // Set cookies manually since we're in a route handler
    response.cookies.set("access_token", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 15, // 15 minutes
      path: "/",
    });

    response.cookies.set("refresh_token", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    // Store user id and role for token refresh
    response.cookies.set("user_id", externalUserId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days (same as refresh token)
      path: "/",
    });

    response.cookies.set("user_role", userRole, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days (same as refresh token)
      path: "/",
    });

    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

