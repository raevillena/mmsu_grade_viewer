# Postman Testing Guide for Authentication

This guide explains how to test the authentication endpoints using Postman.

## Base URL
```
http://localhost:3000
```

## Important Notes
- All endpoints use **HTTP-only cookies** for token storage
- Postman will automatically manage cookies if cookie handling is enabled
- Make sure to enable cookie management in Postman settings

---

## 1. Login Endpoint

**Endpoint:** `POST /api/auth/login`

**Headers:**
```
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "email": "your-email@example.com",
  "password": "your-password"
}
```

**Expected Response (200 OK):**
```json
{
  "success": true,
  "user": {
    "name": "John Doe",
    "email": "your-email@example.com",
    "role": "admin"
  }
}
```

**Cookies Set:**
- `access_token` - HTTP-only, expires in 15 minutes
- `refresh_token` - HTTP-only, expires in 7 days
- `user_id` - HTTP-only, expires in 7 days
- `user_role` - HTTP-only, expires in 7 days

**Postman Setup:**
1. Create a new POST request
2. URL: `http://localhost:3000/api/auth/login`
3. Headers tab: Add `Content-Type: application/json`
4. Body tab: Select "raw" and "JSON", paste the JSON body
5. Send the request
6. Check the "Cookies" tab to see the cookies that were set

---

## 2. Validate Token Endpoint

**Endpoint:** `POST /api/auth/validate`

**Note:** This is our Next.js endpoint that calls the external API's `GET /api/auth/isAuthenticated` endpoint.

**Headers:**
```
Cookie: access_token=YOUR_ACCESS_TOKEN; refresh_token=YOUR_REFRESH_TOKEN; user_id=YOUR_USER_ID; user_role=YOUR_ROLE
```

**Note:** If you're using Postman's cookie manager, cookies will be sent automatically after login.

**Body:** None required (uses cookies)

**How it works:**
- Reads tokens from cookies
- Calls external API: `GET /api/auth/isAuthenticated` with:
  - `Authorization: Bearer {accessToken}` header
  - `refreshToken` cookie
- Returns validation result + user info from Supabase

**Expected Response (200 OK):**
```json
{
  "valid": true,
  "user": {
    "id": "uuid-from-supabase",
    "name": "John Doe",
    "email": "your-email@example.com",
    "role": "admin"
  }
}
```

**Expected Response (401 Unauthorized):**
```json
{
  "valid": false
}
```

**Postman Setup:**
1. Create a new POST request
2. URL: `http://localhost:3000/api/auth/validate`
3. If cookies are enabled in Postman, they will be sent automatically
4. If not, manually add cookies in the "Cookies" tab or use the Cookie header

---

## 3. Refresh Token Endpoint

**Endpoint:** `POST /api/auth/refresh`

**Headers:**
```
Cookie: refresh_token=YOUR_REFRESH_TOKEN; user_id=YOUR_USER_ID; user_role=YOUR_ROLE
```

**Note:** Requires `refresh_token`, `user_id`, and `user_role` cookies

**Body:** None required (uses cookies)

**Expected Response (200 OK):**
```json
{
  "success": true
}
```

**Expected Response (401 Unauthorized):**
```json
{
  "error": "Refresh token not found"
}
```

**Cookies Updated:**
- `access_token` - New token set, expires in 15 minutes
- `refresh_token` - Same token kept, expires in 7 days

**Postman Setup:**
1. Create a new POST request
2. URL: `http://localhost:3000/api/auth/refresh`
3. Cookies should be automatically sent if enabled in Postman

---

## 4. Logout Endpoint

**Endpoint:** `POST /api/auth/logout`

**Headers:** None required

**Body:** None required

**Expected Response (200 OK):**
```json
{
  "success": true
}
```

**Cookies Deleted:**
- `access_token`
- `refresh_token`
- `user_id`
- `user_role`

**Postman Setup:**
1. Create a new POST request
2. URL: `http://localhost:3000/api/auth/logout`
3. Send the request
4. Verify cookies are cleared in the "Cookies" tab

---

## Testing Flow

### Complete Authentication Flow:

1. **Login**
   - Send POST to `/api/auth/login`
   - Verify response contains user info
   - Check cookies are set

2. **Validate Token**
   - Send POST to `/api/auth/validate`
   - Verify response shows `valid: true` and user info
   - This uses stateless validation (checks cookies and Supabase)

3. **Refresh Token** (optional, when access token expires)
   - Send POST to `/api/auth/refresh`
   - Verify response is successful
   - Check that new `access_token` cookie is set

4. **Logout**
   - Send POST to `/api/auth/logout`
   - Verify response is successful
   - Check that all cookies are cleared

---

## Postman Cookie Settings

To enable automatic cookie handling in Postman:

1. Go to **Settings** (gear icon)
2. Enable **"Automatically follow redirects"** (optional)
3. Enable **"Send cookies"**
4. Cookies will be automatically managed across requests

Alternatively, you can manually manage cookies:
1. Click on the **"Cookies"** link below the URL bar
2. Manage cookies for `localhost:3000`
3. Add/remove cookies as needed

---

## Troubleshooting

### Cookies not being sent?
- Make sure cookie handling is enabled in Postman settings
- Check that you're using the same domain (`localhost:3000`)
- Verify cookies exist in the "Cookies" tab

### 401 Unauthorized?
- Make sure you've logged in first and cookies are set
- Check that cookies haven't expired
- Verify `user_id` and `user_role` cookies are present

### Validation returns `valid: false`?
- Check that `access_token` cookie exists
- Verify `user_id` and `user_role` cookies are set
- Check Supabase connection (user might not exist in database)

---

## Example Postman Collection

You can create a Postman collection with these requests:

1. **Login** - POST `/api/auth/login`
2. **Validate** - POST `/api/auth/validate`
3. **Refresh** - POST `/api/auth/refresh`
4. **Logout** - POST `/api/auth/logout`

Make sure to run them in order (login first) so cookies are properly set.

