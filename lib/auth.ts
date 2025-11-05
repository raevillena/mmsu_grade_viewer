import { cookies } from "next/headers";
import { type ExternalAuthResponse, type TokenValidationResponse } from "./types";

/**
 * Cookie names for storing authentication tokens
 * Note: Backend expects "refreshToken" but we'll use our own names for consistency
 * and map them when calling the backend API
 */
export const COOKIE_NAMES = {
  ACCESS_TOKEN: "access_token",
  REFRESH_TOKEN: "refresh_token",
  USER_ID: "user_id",
  USER_ROLE: "user_role",
} as const;

/**
 * External API base URL - should be set in environment variables
 * If not set, defaults to the production API URL: https://umans-api.nbericmmsu.com
 */
const EXTERNAL_API_URL = process.env.EXTERNAL_AUTH_API_URL || "https://umans-api.nbericmmsu.com";

/**
 * App ID for external authentication API
 * Defaults to "3" if not set in environment variables
 */
const EXTERNAL_AUTH_APP_ID = process.env.EXTERNAL_AUTH_APP_ID || "3";

if (!process.env.EXTERNAL_AUTH_API_URL) {
  console.warn(
    "EXTERNAL_AUTH_API_URL is not set. Using default: https://umans-api.nbericmmsu.com"
  );
}

/**
 * Get access token from cookies
 */
export async function getAccessToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAMES.ACCESS_TOKEN)?.value || null;
}

/**
 * Get refresh token from cookies
 */
export async function getRefreshToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAMES.REFRESH_TOKEN)?.value || null;
}

/**
 * Set authentication tokens in HTTP-only cookies
 */
export async function setAuthTokens(
  accessToken: string,
  refreshToken: string
): Promise<void> {
  const cookieStore = await cookies();
  
  // Set access token (short-lived, typically 15 minutes)
  cookieStore.set(COOKIE_NAMES.ACCESS_TOKEN, accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 15, // 15 minutes
    path: "/",
  });

  // Set refresh token (long-lived, typically 7 days)
  cookieStore.set(COOKIE_NAMES.REFRESH_TOKEN, refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  });
}

/**
 * Clear authentication tokens from cookies
 */
export async function clearAuthTokens(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAMES.ACCESS_TOKEN);
  cookieStore.delete(COOKIE_NAMES.REFRESH_TOKEN);
}

/**
 * Validate access token using external API's isAuthenticated endpoint
 * Backend endpoint: POST /api/auth/isAuthenticated
 * Expects: Authorization header with Bearer token, refreshToken cookie
 * Returns: { msg: "Session Valid." } on success
 * 
 * @param accessToken - The access token to validate
 * @param refreshToken - Refresh token to send as cookie (required by backend)
 * @param userId - Optional user ID from cookies (for getting user info after validation)
 * @param userRole - Optional user role from cookies (for getting user info after validation)
 */
export async function validateToken(
  accessToken: string,
  refreshToken?: string,
  userId?: string,
  userRole?: string
): Promise<TokenValidationResponse> {
  try {
    // If no access token, invalid
    if (!accessToken) {
      console.error("validateToken: No access token provided");
      return { valid: false };
    }

    // Backend requires both accessToken and refreshToken
    if (!refreshToken) {
      console.error("validateToken: No refresh token provided - backend requires both tokens");
      return { valid: false };
    }

    const validateUrl = EXTERNAL_API_URL 
      ? `${EXTERNAL_API_URL}/api/auth/isAuthenticated`
      : "https://umans-api.nbericmmsu.com/api/auth/isAuthenticated";
    
    // Build headers with Authorization
    // Backend expects refreshToken in cookies as "refreshToken" (not "refresh_token")
    // Backend uses GET method, not POST
    // When making server-side fetch, we need to manually set Cookie header
    // cookie-parser automatically decodes URL-encoded values, so we can send raw or encoded
    // Let's try without encoding first (as browsers send cookies)
    const headers: HeadersInit = {
      Authorization: `Bearer ${accessToken}`,
      Cookie: `refreshToken=${refreshToken}`, // Backend expects cookie name "refreshToken"
    };

    console.log("validateToken: Sending request to:", validateUrl);
    console.log("validateToken: Method: GET");
    console.log("validateToken: Authorization header:", headers.Authorization ? `${headers.Authorization.substring(0, 20)}...` : "MISSING");
    console.log("validateToken: Cookie header present:", !!headers.Cookie);
    if (headers.Cookie) {
      console.log("validateToken: Cookie header value:", headers.Cookie.substring(0, 80) + (headers.Cookie.length > 80 ? "..." : ""));
    }
    console.log("validateToken: Access token length:", accessToken?.length || 0);
    console.log("validateToken: Refresh token length:", refreshToken?.length || 0);
    console.log("validateToken: All headers:", Object.keys(headers).join(", "));

    // Make the request - use credentials: 'include' to ensure cookies are sent
    // But since we're manually setting Cookie header, credentials should work
    const response = await fetch(validateUrl, {
      method: "GET", // Backend uses GET, not POST
      headers,
      // Note: credentials: 'include' is for browser requests, but we're on server
      // We're manually setting the Cookie header, so this shouldn't matter
      credentials: "omit", // Server-side fetch doesn't use browser credentials
    });

    if (!response.ok) {
      console.error("Token validation failed:", response.status, response.statusText);
      const errorText = await response.text().catch(() => "");
      console.error("Validation error details:", errorText);
      console.error("Full response headers:", Object.fromEntries(response.headers.entries()));
      return { valid: false };
    }

    const data = await response.json();
    
    // Backend returns { msg: "Session Valid." } on success
    // But we don't get user info from this endpoint, so we'll get it from cookies/Supabase
    if (data.msg && data.msg.includes("Session Valid")) {
      // Try to get user info from cookies if not provided
      let finalUserId = userId;
      let finalUserRole = userRole;
      
      // Only try to use cookies() if we're in a Server Component/Route Handler context
      // (not in Edge Runtime like proxy.ts)
      if (!finalUserId || !finalUserRole) {
        try {
          const cookieStore = await cookies();
          finalUserId = finalUserId || cookieStore.get(COOKIE_NAMES.USER_ID)?.value;
          finalUserRole = finalUserRole || cookieStore.get(COOKIE_NAMES.USER_ROLE)?.value;
        } catch (cookieError) {
          // If cookies() fails (e.g., in Edge Runtime), use provided values
          // This is expected in proxy.ts context
        }
      }

      // If we have user info from cookies, get full details from Supabase
      if (finalUserId && finalUserRole) {
        try {
          const { createServerSupabaseClient } = await import("./supabaseClient");
          const supabase = createServerSupabaseClient();
          const { data: user } = await supabase
            .from("users")
            .select("id, name, email, role")
            .eq("external_id", finalUserId)
            .single();
          
          if (user) {
            return {
              valid: true,
              user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role as "admin" | "teacher",
              },
            };
          }
        } catch (supabaseError) {
          // If Supabase lookup fails, continue with cookie data
          console.warn("Could not fetch user from Supabase:", supabaseError);
        }
      }

      // If we have role from cookies but no Supabase user, return basic validation
      if (finalUserRole) {
        return {
          valid: true,
          user: {
            id: finalUserId || "",
            name: "",
            email: "",
            role: finalUserRole as "admin" | "teacher",
          },
        };
      }

      // Token is valid but no user info available
      return { valid: true };
    }
    
    return { valid: false };
  } catch (error) {
    console.error("Token validation error:", error);
    return { valid: false };
  }
}

/**
 * Refresh access token using refresh token
 * This is the ONLY place where we call the external API for token operations
 * (along with loginWithExternalAPI). Token validation is done locally.
 * 
 * Backend endpoint: POST /api/auth/refresh
 * Expects: refreshToken cookie, { id, role } in body
 * Returns: { accessToken: string }
 */
export async function refreshAccessToken(
  refreshToken: string,
  userId?: string,
  userRole?: string
): Promise<{ access_token: string; refresh_token: string } | null> {
  try {
    // Get user id and role from cookies if not provided
    const cookieStore = await cookies();
    const id = userId || cookieStore.get(COOKIE_NAMES.USER_ID)?.value;
    const role = userRole || cookieStore.get(COOKIE_NAMES.USER_ROLE)?.value;
    
    if (!id || !role) {
      console.error("Missing user id or role for token refresh");
      return null;
    }

    const refreshUrl = EXTERNAL_API_URL 
      ? `${EXTERNAL_API_URL}/api/auth/refresh`
      : "https://umans-api.nbericmmsu.com/api/auth/refresh";
    
    // Backend expects refreshToken in cookies (as "refreshToken"), but we store it as "refresh_token"
    // We need to send it as a cookie header
    // For server-side fetch, we need to manually set the Cookie header
    // cookie-parser automatically decodes URL-encoded values, so we can send raw or encoded
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      Cookie: `refreshToken=${refreshToken}`, // Backend expects cookie name "refreshToken"
    };

    const response = await fetch(refreshUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ 
        id: parseInt(id, 10), // Backend expects number
        role: role, // Backend expects "admin" or "teacher"
      }),
    });

    if (!response.ok) {
      console.error("Token refresh failed:", response.status, response.statusText);
      const errorText = await response.text().catch(() => "");
      console.error("Refresh error details:", errorText);
      return null;
    }

    const data = await response.json();
    
    // Backend returns { accessToken: string } - no new refresh token
    if (data.accessToken) {
      return {
        access_token: data.accessToken,
        refresh_token: refreshToken, // Keep the same refresh token
      };
    }
    
    console.error("Unexpected refresh response format:", data);
    return null;
  } catch (error) {
    console.error("Token refresh error:", error);
    return null;
  }
}

/**
 * Login with external API
 * This is one of only TWO places where we call the external API for authentication.
 * The other is refreshAccessToken(). Token validation is done locally.
 * 
 * Uses the umans-api.nbericmmsu.com endpoint with appId 3
 */
export async function loginWithExternalAPI(
  email: string,
  password: string
): Promise<ExternalAuthResponse | null> {
  try {
    // Use the full endpoint URL or construct from base URL
    const loginUrl = EXTERNAL_API_URL 
      ? `${EXTERNAL_API_URL}/api/auth/login`
      : "https://umans-api.nbericmmsu.com/api/auth/login";

    console.log("Attempting login to:", loginUrl);
    console.log("Using appId:", EXTERNAL_AUTH_APP_ID);

    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      const response = await fetch(loginUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
          appId: EXTERNAL_AUTH_APP_ID, // App identifier for the grade viewer system
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      console.log("Login API response status:", response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Login API error:", errorData);
        console.error("Response status:", response.status, response.statusText);
        return null;
      }

      const data = await response.json();
      console.log("Login API response data:", { 
        msg: data.msg, 
        hasUser: !!data.user, 
        hasToken: !!data.token 
      });
      
      // Check if login was successful
      if (data.msg && data.msg.toLowerCase().includes("success")) {
        return data as ExternalAuthResponse;
      }

      console.error("Login response missing success message:", data);
      return null;
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === "AbortError") {
        console.error("Login API request timed out after 30 seconds");
        throw new Error("Request timed out. Please check your internet connection and try again.");
      }
      throw fetchError;
    }
  } catch (error) {
    console.error("Login error:", error);
    if (error instanceof Error) {
      throw error;
    }
    return null;
  }
}

