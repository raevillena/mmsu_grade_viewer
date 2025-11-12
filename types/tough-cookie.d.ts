declare module "tough-cookie" {
  export class CookieJar {
    constructor(store?: any, options?: any);
    setCookieSync(cookieOrString: string, url: string, options?: any): void;
    getCookieStringSync(url: string, options?: any): string;
  }
  
  // Alias for compatibility with got library
  export class ToughCookieJar extends CookieJar {}
}

