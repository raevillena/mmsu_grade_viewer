import { CookieJar } from "tough-cookie";
import got, { Got } from "got";

type MoodleCookies = Record<string, string>;

interface MoodleClientOptions {
  baseUrl: string;
  loginPath?: string;
  dashboardPath?: string;
  ajaxServicePath?: string;
  username?: string;
  password?: string;
  initialCookies?: MoodleCookies;
  userAgent?: string;
}

interface MoodleServiceCallOptions {
  sesskey?: string;
  infoOverride?: string;
}

interface MoodleAjaxResponse<T = unknown> {
  index: number;
  data?: T;
  error?: {
    errorcode?: string;
    message?: string;
    stacktrace?: string;
  };
}

export class MoodleClient {
  private readonly options: Required<Omit<MoodleClientOptions, "username" | "password" | "initialCookies" | "userAgent">> & {
    username?: string;
    password?: string;
    initialCookies: MoodleCookies;
    userAgent: string;
  };

  private readonly cookieJar: CookieJar;
  private readonly http: Got;

  constructor(options: MoodleClientOptions) {
    if (!options.baseUrl) {
      throw new Error("MoodleClient requires a baseUrl");
    }

    // Remove leading slashes from paths since got's prefixUrl handles the base URL
    const normalizePath = (path: string | undefined, defaultPath: string): string => {
      const pathToUse = path ?? defaultPath;
      return pathToUse.startsWith("/") ? pathToUse.slice(1) : pathToUse;
    };

    this.options = {
      baseUrl: options.baseUrl.replace(/\/$/, ""),
      loginPath: normalizePath(options.loginPath, "/login/index.php"),
      dashboardPath: normalizePath(options.dashboardPath, "/my/index.php"),
      ajaxServicePath: normalizePath(options.ajaxServicePath, "/lib/ajax/service.php"),
      username: options.username,
      password: options.password,
      initialCookies: options.initialCookies ?? {},
      userAgent: options.userAgent ?? "MMSU-Grade-Viewer Moodle Client/1.0",
    };

    this.cookieJar = new CookieJar();

    for (const [name, value] of Object.entries(this.options.initialCookies)) {
      if (!value) continue;
      this.cookieJar.setCookieSync(`${name}=${value}`, this.options.baseUrl);
    }

    this.http = got.extend({
      prefixUrl: this.options.baseUrl,
      cookieJar: this.cookieJar,
      headers: {
        "User-Agent": this.options.userAgent,
      },
      followRedirect: true,
    });
  }

  /**
   * Performs a full Moodle login flow using username/password credentials.
   * Captures the MoodleSession cookie for subsequent authenticated requests.
   */
  async login(): Promise<void> {
    if (!this.options.username || !this.options.password) {
      throw new Error("MoodleClient.login requires username and password");
    }

    const loginPage = await this.http.get(this.options.loginPath, { responseType: "text" });
    const loginToken = extractHiddenInput(loginPage.body, "logintoken");

    const form = {
      username: this.options.username,
      password: this.options.password,
      ...(loginToken ? { logintoken: loginToken } : {}),
    } as Record<string, string>;

    const response = await this.http.post(this.options.loginPath, {
      form,
      throwHttpErrors: false,
    });

    if (response.statusCode >= 400) {
      throw new Error(`Moodle login failed with status ${response.statusCode}`);
    }

    // Sanity check: fetch dashboard to ensure we are authenticated.
    const dashboard = await this.http.get(this.options.dashboardPath, {
      responseType: "text",
      throwHttpErrors: false,
    });

    if (dashboard.statusCode === 303 || dashboard.statusCode === 302) {
      throw new Error("Moodle login appears to have redirected away from dashboard; check credentials.");
    }

    if (dashboard.statusCode >= 400) {
      throw new Error(`Failed to access Moodle dashboard after login (status ${dashboard.statusCode})`);
    }
  }

  /**
   * Fetches a fresh sesskey from the dashboard.
   */
  async fetchSesskey(): Promise<string> {
    const response = await this.http.get(this.options.dashboardPath, { responseType: "text" });
    const sesskey = extractHiddenInput(response.body, "sesskey");

    if (!sesskey) {
      throw new Error("Unable to locate sesskey on Moodle dashboard page");
    }

    return sesskey;
  }

  /**
   * Invokes a Moodle AJAX service and returns the parsed payload.
   */
  async callService<T = unknown>(methodname: string, args: unknown, options: MoodleServiceCallOptions = {}): Promise<T> {
    const sesskey = options.sesskey ?? (await this.fetchSesskey());

    const requestPayload = [
      {
        index: 0,
        methodname,
        args,
      },
    ];

    console.log(`[MoodleClient] Calling service: ${methodname}`);
    console.log(`[MoodleClient] Request payload:`, JSON.stringify(requestPayload, null, 2));

    const response = await this.http.post(this.options.ajaxServicePath, {
      searchParams: {
        sesskey,
        info: options.infoOverride ?? methodname,
      },
      json: requestPayload,
      responseType: "json",
    });

    console.log(`[MoodleClient] Response status: ${response.statusCode}`);
    console.log(`[MoodleClient] Raw response body:`, JSON.stringify(response.body, null, 2));

    const body = response.body as MoodleAjaxResponse<T>[];

    if (!Array.isArray(body) || body.length === 0) {
      console.error(`[MoodleClient] Unexpected response format. Body type: ${typeof body}, isArray: ${Array.isArray(body)}, length: ${Array.isArray(body) ? body.length : 'N/A'}`);
      throw new Error("Unexpected Moodle AJAX response format");
    }

    const payload = body[0];

    console.log(`[MoodleClient] Response payload structure:`, {
      hasIndex: 'index' in payload,
      hasData: 'data' in payload,
      hasError: 'error' in payload,
      index: payload.index,
      dataType: typeof payload.data,
      dataIsArray: Array.isArray(payload.data),
      dataLength: Array.isArray(payload.data) ? payload.data.length : 'N/A',
    });

    if (payload.error) {
      console.error(`[MoodleClient] Moodle API error:`, payload.error);
      throw new Error(
        `Moodle AJAX error (${payload.error.errorcode ?? "unknown"}): ${payload.error.message ?? "No message"}`
      );
    }

    // Log actual data structure if it exists
    if (payload.data) {
      if (Array.isArray(payload.data) && payload.data.length > 0) {
        console.log(`[MoodleClient] Data is array with ${payload.data.length} items`);
        console.log(`[MoodleClient] First item in data:`, JSON.stringify(payload.data[0], null, 2));
      } else {
        console.log(`[MoodleClient] Data structure:`, JSON.stringify(payload.data, null, 2));
      }
    } else {
      console.warn(`[MoodleClient] No data field in response payload`);
    }

    return payload.data as T;
  }

  static fromEnv(): MoodleClient {
    const baseUrl = process.env.MOODLE_BASE_URL;
    if (!baseUrl) {
      throw new Error("MOODLE_BASE_URL env var is required");
    }

    const initialCookies = collectCookiesFromEnv();

    return new MoodleClient({
      baseUrl,
      loginPath: process.env.MOODLE_LOGIN_PATH,
      dashboardPath: process.env.MOODLE_DASHBOARD_PATH,
      ajaxServicePath: process.env.MOODLE_AJAX_SERVICE_PATH,
      username: process.env.MOODLE_LOGIN_USERNAME,
      password: process.env.MOODLE_LOGIN_PASSWORD,
      initialCookies,
    });
  }
}

function extractHiddenInput(html: string, name: string): string | null {
  const pattern = new RegExp(`<input[^>]*name=["']${name}["'][^>]*value=["']([^"']+)["']`, "i");
  const match = html.match(pattern);
  return match?.[1] ?? null;
}

function collectCookiesFromEnv(): MoodleCookies {
  const cookies: MoodleCookies = {};

  const inlineCookieString = process.env.MOODLE_INITIAL_COOKIES;
  if (inlineCookieString) {
    inlineCookieString
      .split(";")
      .map((segment) => segment.trim())
      .filter(Boolean)
      .forEach((segment) => {
        const [name, ...rest] = segment.split("=");
        if (!name || rest.length === 0) {
          console.warn(`[MoodleClient] Skipping malformed cookie segment: ${segment}`);
          return;
        }
        cookies[name.trim()] = rest.join("=").trim();
      });
  }

  for (const [key, value] of Object.entries(process.env)) {
    if (!key.startsWith("MOODLE_COOKIE_") || !value) continue;

    const trimmed = value.trim();

    if (trimmed.includes("=")) {
      const [cookieName, ...rest] = trimmed.split("=");
      if (!cookieName || rest.length === 0) {
        console.warn(`[MoodleClient] Skipping malformed cookie env ${key}`);
        continue;
      }
      cookies[cookieName.trim()] = rest.join("=").trim();
      continue;
    }

    const derivedName = deriveCookieNameFromEnvKey(key);
    if (!derivedName) {
      console.warn(
        `[MoodleClient] Unable to derive cookie name from env ${key}. Please set value as CookieName=value.`
      );
      continue;
    }

    cookies[derivedName] = trimmed;
  }

  return cookies;
}

function deriveCookieNameFromEnvKey(envKey: string): string | null {
  const raw = envKey.replace("MOODLE_COOKIE_", "");
  if (!raw) return null;

  if (raw.startsWith("GA")) {
    const suffix = raw.substring(2);
    if (!suffix) return "_ga";
    const normalizedSuffix = suffix.startsWith("_") ? suffix : `_${suffix}`;
    return `_ga${normalizedSuffix}`;
  }

  if (raw === "MOODLESESSION") return "MoodleSession";
  if (raw === "MOODLEID1") return "MOODLEID1_";

  return raw
    .toLowerCase()
    .split("_")
    .map((segment, index) => {
      if (index === 0) {
        return segment.charAt(0).toUpperCase() + segment.slice(1);
      }
      return segment;
    })
    .join("");
}

