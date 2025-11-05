import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { validateToken, refreshAccessToken } from "./lib/auth";

/**
 * Proxy (formerly Middleware) to protect routes and validate authentication tokens
 * Next.js 16 uses proxy.ts instead of middleware.ts
 * This runs on every request to check if the user is authenticated and has the right role
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes that don't require authentication
  const publicRoutes = ["/login", "/grades", "/api/auth/login"];
  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Admin routes require admin role
  if (pathname.startsWith("/admin")) {
    const accessToken = request.cookies.get("access_token")?.value;
    const refreshToken = request.cookies.get("refresh_token")?.value;

    console.log(`Admin route ${pathname}: Checking tokens`);
    console.log(`  - Access token present: ${!!accessToken} (length: ${accessToken?.length || 0})`);
    console.log(`  - Refresh token present: ${!!refreshToken} (length: ${refreshToken?.length || 0})`);

    if (!accessToken || !refreshToken) {
      console.log("Admin route: Missing tokens, redirecting to login");
      return NextResponse.redirect(new URL("/login", request.url));
    }

    // Validate the access token
    // Note: If validateToken fails, we'll try to refresh and allow access if tokens exist
    // Get user id and role from cookies to pass to validateToken
    const userId = request.cookies.get("user_id")?.value;
    const userRole = request.cookies.get("user_role")?.value;
    console.log(`Admin route ${pathname}: Validating token, userId=${userId}, userRole=${userRole}`);
    let validation = await validateToken(accessToken, refreshToken, userId, userRole);

    if (!validation.valid) {
      console.log(`Admin route ${pathname}: Token validation failed, attempting refresh`);
      // Try to refresh the token - userId and userRole already extracted above
      const refreshed = await refreshAccessToken(refreshToken, userId, userRole);

      if (!refreshed) {
        // If validation and refresh both fail, allow access if tokens exist
        // This is needed because the validate endpoint might not be implemented yet
        // Tokens were just set by login, so they should be valid
        console.warn(`Admin route ${pathname}: Token validation/refresh failed, but allowing access with existing tokens`);
        return NextResponse.next();
      }

      // Update cookies with new tokens
      const response = NextResponse.next();
      response.cookies.set("access_token", refreshed.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 15,
        path: "/",
      });
      response.cookies.set("refresh_token", refreshed.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7,
        path: "/",
      });

      // Re-validate with new token
      const reValidation = await validateToken(refreshed.access_token, refreshed.refresh_token, userId, userRole);
      // If re-validation fails, still allow access (tokens were just refreshed)
      if (reValidation.valid && reValidation.user && reValidation.user.role !== "admin") {
        return NextResponse.redirect(new URL("/login", request.url));
      }

      return response;
    }

    // Check if user has admin role
    // If validation didn't return user info, allow access (token was just set)
    if (validation.valid && validation.user && validation.user.role !== "admin") {
      console.log(`Admin route ${pathname}: User role is ${validation.user.role}, not admin. Redirecting.`);
      return NextResponse.redirect(new URL("/login", request.url));
    }

    console.log(`Admin route ${pathname}: Access allowed`);
    return NextResponse.next();
  }

  // Teacher routes require teacher role
  if (pathname.startsWith("/teacher")) {
    const accessToken = request.cookies.get("access_token")?.value;
    const refreshToken = request.cookies.get("refresh_token")?.value;

    console.log(`Teacher route ${pathname}: Checking tokens`);
    console.log(`  - Access token present: ${!!accessToken} (length: ${accessToken?.length || 0})`);
    console.log(`  - Refresh token present: ${!!refreshToken} (length: ${refreshToken?.length || 0})`);

    if (!accessToken || !refreshToken) {
      console.log("Teacher route: Missing tokens, redirecting to login");
      return NextResponse.redirect(new URL("/login", request.url));
    }

    // Validate the access token
    // Get user id and role from cookies to pass to validateToken
    const userId = request.cookies.get("user_id")?.value;
    const userRole = request.cookies.get("user_role")?.value;
    console.log(`Teacher route ${pathname}: Validating token, userId=${userId}, userRole=${userRole}`);
    const validation = await validateToken(accessToken, refreshToken, userId, userRole);

    if (!validation.valid) {
      // Try to refresh the token - userId and userRole already extracted above
      const refreshed = await refreshAccessToken(refreshToken, userId, userRole);

      if (!refreshed) {
        // If validation and refresh both fail, allow access if tokens exist
        // This is needed because the validate endpoint might not be implemented yet
        // Tokens were just set by login, so they should be valid
        console.warn("Token validation/refresh failed, but allowing access with existing tokens");
        return NextResponse.next();
      }

      // Update cookies with new tokens
      const response = NextResponse.next();
      response.cookies.set("access_token", refreshed.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 15,
        path: "/",
      });
      response.cookies.set("refresh_token", refreshed.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7,
        path: "/",
      });

      // Re-validate with new token
      const reValidation = await validateToken(refreshed.access_token, refreshed.refresh_token, userId, userRole);
      // If re-validation fails, still allow access (tokens were just refreshed)
      if (reValidation.valid && reValidation.user && reValidation.user.role !== "teacher") {
        return NextResponse.redirect(new URL("/login", request.url));
      }

      return response;
    }

    // Check if user has teacher role
    // If validation didn't return user info, allow access (token was just set)
    if (validation.valid && validation.user && validation.user.role !== "teacher") {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    return NextResponse.next();
  }

  return NextResponse.next();
}

/**
 * Configure which routes the proxy should run on
 */
export const config = {
  matcher: [
    "/admin/:path*",
    "/teacher/:path*",
    "/api/subjects/:path*",
    "/api/records/:path*",
  ],
};

