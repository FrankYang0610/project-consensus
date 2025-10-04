# Preprod Environment Configuration: CORS, CSRF, and Cookies

This document describes the environment configuration required to run the pre-production stack with Cloudflare Tunnel/Zero Trust while using session-based authentication between the Next.js frontend and the Django backend across subdomains. It explains how to configure CORS and CSRF, how cookies work across subdomains, and when to use SameSite=Lax vs SameSite=None.

- Frontend: `preprod-app.polyu.life` → Next.js (127.0.0.1:3000)
- Backend: `preprod-api.polyu.life` → Django (127.0.0.1:8000)

The backend is configured to set session and CSRF cookies that are shared across subdomains by using `Domain=.polyu.life`

---

## 1) Code assumptions and important settings

- Django settings file: `project-consensus-backend/config/settings.py`
  - Reads cookie domains from environment:
    - `CSRF_COOKIE_DOMAIN = env("CSRF_COOKIE_DOMAIN", default=None)`
    - `SESSION_COOKIE_DOMAIN = env("SESSION_COOKIE_DOMAIN", default=None)`
  - CSRF cookie is readable by JS so the frontend can send `X-CSRFToken`:
    - `CSRF_COOKIE_HTTPONLY = False`
  - Other relevant defaults:
    - `CORS_ALLOW_CREDENTIALS = True`
    - `SESSION_COOKIE_SECURE = not DEBUG`
    - `CSRF_COOKIE_SECURE = not DEBUG`
    - `SESSION_COOKIE_SAMESITE = 'Lax'` (hardcoded)
    - `CSRF_COOKIE_SAMESITE = 'Lax'` (hardcoded)
    - `SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')`
    - `USE_X_FORWARDED_HOST = True`

> Note about SameSite: The current code hardcodes `'Lax'` and does not read SameSite from `.env`. If you want to switch to `'None'` via `.env`, see section 6.5.

---

## 1.1) Architecture Overview

The following diagram illustrates the complete preprod deployment topology:

```
┌─────────────────────────────────────────────────────────────────┐
│                        Internet / Users                          │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ HTTPS (TLS termination)
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              Cloudflare Zero Trust + Tunnel                      │
│  ┌──────────────────────┐      ┌──────────────────────┐        │
│  │ preprod-app.polyu.life│      │preprod-api.polyu.life│        │
│  │   (Access Control)    │      │   (Access Control)   │        │
│  └──────────┬────────────┘      └──────────┬───────────┘        │
└─────────────┼──────────────────────────────┼────────────────────┘
              │                              │
              │ HTTP                         │ HTTP
              │ (tunnel)                     │ (tunnel)
              ▼                              ▼
┌─────────────────────────┐    ┌──────────────────────────────────┐
│   Next.js Frontend      │    │   Django Backend (Gunicorn)      │
│   127.0.0.1:3000        │◄───┤   127.0.0.1:8000                 │
│                         │ API│                                  │
│ - Reads CSRF from cookie│calls  - Issues csrftoken cookie       │
│ - Sends X-CSRFToken     │    │   (Domain=.polyu.life)           │
│ - credentials: include  │    │ - Validates CSRF token           │
│                         │    │ - Sets session cookie            │
│                         │    │   (Domain=.polyu.life)           │
└─────────────────────────┘    │ - CORS_ALLOWED_ORIGINS check     │
                                │ - CSRF_TRUSTED_ORIGINS check     │
                                └──────────┬───────────────────────┘
                                           │
                                           │ SQL
                                           ▼
                                ┌────────────────────┐
                                │  PostgreSQL 17     │
                                │  (Docker)          │
                                │  127.0.0.1:5432    │
                                └────────────────────┘
```

**Key points:**

- Cloudflare Tunnel terminates TLS and forwards HTTP to localhost services.
- Both frontend and backend are behind Zero Trust Access policies.
- Cookies set by the backend with `Domain=.polyu.life` are visible to both subdomains.
- The frontend includes cookies automatically (`credentials: 'include'`) and manually adds `X-CSRFToken` from the cookie.

---

## 2) Environment variables

### 2.1 Frontend: `project-consensus-frontend/.env.production`

```
NEXT_PUBLIC_API_BASE_URL=https://preprod-api.polyu.life
# NEXT_PUBLIC_CKEDITOR_LICENSE_KEY=GPL     # optional
```

- `NEXT_PUBLIC_API_BASE_URL` must be HTTPS and point to the API domain. Next.js reads `NEXT_PUBLIC_*` variables at build and runtime.

### 2.2 Backend: `project-consensus-backend/.env`

```
# Django
DEBUG=False
SECRET_KEY='django-insecure-ti9d)w#keby0qjg6buhb3xpjbtop0a+wqq@83m(=2fga(*9_yz'
ALLOWED_HOSTS=preprod-api.polyu.life,127.0.0.1,localhost
LANGUAGE_CODE=zh-hans
TIME_ZONE=Asia/Shanghai

# CORS / CSRF
CORS_ALLOWED_ORIGINS=https://preprod-app.polyu.life
CSRF_TRUSTED_ORIGINS=https://preprod-app.polyu.life,https://preprod-api.polyu.life

# Database
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/appdb

# Cookie domains
CSRF_COOKIE_DOMAIN=.polyu.life
SESSION_COOKIE_DOMAIN=.polyu.life

# Optional: You can keep these for later if you decide to make SameSite env-driven
# (currently ignored by the code unless section 6.5 is applied)
SESSION_COOKIE_SAMESITE=None
CSRF_COOKIE_SAMESITE=None
```

#### 2.3 Field-by-field notes

- **`DEBUG=False`**
  - Enables `Secure` cookies and production security checks.
- **`SECRET_KEY`**
  - Keep this random and secret. Rotating it invalidates all sessions.
- **`ALLOWED_HOSTS`**
  - Must include `preprod-api.polyu.life` so Django accepts requests.
- **`CORS_ALLOWED_ORIGINS`**
  - Must include the exact frontend origin with scheme: `https://preprod-app.polyu.life`.
- **`CSRF_TRUSTED_ORIGINS`**
  - Include both the app and api origins with schemes for CSRF checks in HTTPS.
- **`DATABASE_URL`**
  - Standard `django-environ` DSN.
- **`CSRF_COOKIE_DOMAIN` and `SESSION_COOKIE_DOMAIN`**
  - Set to `.polyu.life` so cookies are shared across subdomains.
- **`SESSION_COOKIE_SAMESITE` and `CSRF_COOKIE_SAMESITE`**
  - Present in your `.env` but ignored by current code unless you enable env-driven SameSite in section 6.5.

---

## 3) CORS fundamentals for this setup

### 3.1 What is CORS and why it exists

**Same-Origin Policy (SOP)** is the browser's core security boundary. It prevents JavaScript on `https://preprod-app.polyu.life` from reading responses from `https://preprod-api.polyu.life` by default, because they are different origins.

**Origin = Scheme + Host + Port**

- `https://preprod-app.polyu.life:443` (frontend origin)
- `https://preprod-api.polyu.life:443` (backend origin)

These are **different origins**, so SOP blocks cross-origin reads unless the backend explicitly opts in via **CORS (Cross-Origin Resource Sharing)**.

### 3.2 Simple requests vs Preflight requests

**Simple requests** can be sent directly if they meet all criteria:

- Method: `GET`, `HEAD`, or `POST`
- Content-Type: `text/plain`, `multipart/form-data`, or `application/x-www-form-urlencoded`
- No custom headers

**Preflight requests** are required when:

- Method is `PUT`, `DELETE`, `PATCH`, or any non-simple method
- Content-Type is `application/json`
- Custom headers like `X-CSRFToken` are present
- Credentials are included

The browser automatically sends an `OPTIONS` request first to ask permission.

### 3.3 CORS preflight flow diagram

```
Browser (preprod-app)              API Server (preprod-api)
        │                                    │
        │  OPTIONS /api/accounts/login/      │
        │  Origin: https://preprod-app...    │
        │  AC-Request-Method: POST           │
        │  AC-Request-Headers: content-type, │
        │                      x-csrftoken   │
        ├───────────────────────────────────►│
        │                                    │
        │                                    │ Django receives OPTIONS
        │                                    │ CorsMiddleware checks:
        │                                    │ - Is Origin in CORS_ALLOWED_ORIGINS?
        │                                    │ - Is method allowed?
        │                                    │ - Are headers allowed?
        │                                    │
        │  204 No Content                    │
        │  AC-Allow-Origin: https://preprod-app...│
        │  AC-Allow-Methods: POST, OPTIONS   │
        │  AC-Allow-Headers: content-type,   │
        │                    x-csrftoken     │
        │  AC-Allow-Credentials: true        │
        │◄───────────────────────────────────┤
        │                                    │
   Preflight OK!                             │
   Browser proceeds                          │
   with actual request                       │
        │                                    │
        │  POST /api/accounts/login/         │
        │  Origin: https://preprod-app...    │
        │  Content-Type: application/json    │
        │  X-CSRFToken: abc123...            │
        │  Cookie: csrftoken=abc123;         │
        │          sessionid=xyz789          │
        ├───────────────────────────────────►│
        │                                    │
        │                                    │ Django processes request
        │                                    │ - CSRF middleware validates
        │                                    │ - Authenticates user
        │                                    │
        │  200 OK                            │
        │  AC-Allow-Origin: https://preprod-app...│
        │  AC-Allow-Credentials: true        │
        │  Set-Cookie: sessionid=...;        │
        │              Domain=.polyu.life    │
        │◄───────────────────────────────────┤
        │                                    │
   Browser stores                            │
   session cookie                            │
```

### 3.4 Critical CORS rules for credentialed requests

When using `credentials: 'include'` in fetch:

1. **Backend MUST return the exact origin**, not `*`:

   ```
   Access-Control-Allow-Origin: https://preprod-app.polyu.life
   ```

2. **Backend MUST explicitly allow credentials**:

   ```
   Access-Control-Allow-Credentials: true
   ```

3. **Backend MUST list custom headers in preflight response**:

   ```
   Access-Control-Allow-Headers: content-type, x-csrftoken
   ```

4. **Origin must be in the allow list**:
   - Django setting: `CORS_ALLOWED_ORIGINS = ['https://preprod-app.polyu.life']`
   - `django-cors-headers` middleware checks this list and emits proper headers

### 3.5 What happens if CORS fails

- **Preflight fails (OPTIONS returns 403/404/no headers)**: Browser blocks the actual request with "Failed to fetch" or CORS error.
- **Origin not allowed**: Browser blocks response, JS cannot read it.
- **Credentials mismatch**: If frontend uses `credentials: 'include'` but backend doesn't return `AC-Allow-Credentials: true`, browser blocks cookies.

---

## 4) CSRF fundamentals for this setup

### 4.1 What is CSRF (Cross-Site Request Forgery)

CSRF is an attack where a malicious site tricks a user's browser into making an unwanted request to your API using the user's existing authentication cookies.

**Attack scenario without CSRF protection:**

```
1. User logs into preprod-app.polyu.life
   → Browser stores sessionid cookie for .polyu.life

2. User visits evil.com (attacker site)

3. evil.com contains:
   <form action="https://preprod-api.polyu.life/api/accounts/profile/" method="POST">
     <input name="email" value="attacker@evil.com">
   </form>
   <script>document.forms[0].submit()</script>

4. Browser automatically includes sessionid cookie with the POST
   → API thinks it's a legitimate request from the logged-in user
   → User's email gets changed without their knowledge!
```

**Why cookies alone are insufficient:**

- Cookies are automatically attached by the browser to **any** request to the matching domain
- The attacker doesn't need to know the cookie value
- The API cannot distinguish between a legitimate request and a forged one based on cookies alone

### 4.2 CSRF protection: Double Submit Cookie pattern

Django implements the **Double Submit Cookie** pattern:

```
┌─────────────────────────────────────────────────────────────┐
│ Step 1: Get CSRF Token                                      │
│                                                              │
│  Frontend                    Backend                         │
│     │                          │                             │
│     │ GET /api/accounts/csrf/  │                             │
│     ├─────────────────────────►│                             │
│     │                          │ @ensure_csrf_cookie         │
│     │                          │ generates token             │
│     │                          │                             │
│     │  200 OK                  │                             │
│     │  Set-Cookie: csrftoken=abc123;│                        │
│     │              Domain=.polyu.life;│                      │
│     │              HttpOnly=False     │                      │
│     │◄─────────────────────────┤                             │
│     │                          │                             │
│  document.cookie              │                             │
│  contains csrftoken           │                             │
│                                                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Step 2: Mutating Request (POST/PATCH/DELETE)                │
│                                                              │
│  Frontend JS                 Backend Middleware              │
│     │                          │                             │
│  1. Read csrftoken            │                             │
│     from document.cookie      │                             │
│                               │                             │
│  2. POST /api/accounts/login/ │                             │
│     Cookie: csrftoken=abc123  │                             │
│     X-CSRFToken: abc123       │ ◄─ Must match cookie        │
│     ├─────────────────────────►│                             │
│     │                         │                             │
│     │                         │ CsrfViewMiddleware:         │
│     │                         │ 1. Extract token from cookie│
│     │                         │ 2. Extract token from header│
│     │                         │ 3. Compare: match?          │
│     │                         │ 4. Validate origin/referer  │
│     │                         │    against CSRF_TRUSTED_    │
│     │                         │    ORIGINS                  │
│     │                         │                             │
│     │  200 OK (if valid)      │                             │
│     │◄─────────────────────────┤                             │
│     │  or                     │                             │
│     │  403 Forbidden          │                             │
│     │  (CSRF verification     │                             │
│     │   failed)               │                             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Why this defeats CSRF attacks:**

1. The attacker's site (evil.com) **cannot read** cookies from `.polyu.life` due to SOP
2. Even though the browser sends the `csrftoken` cookie automatically, the attacker cannot extract its value to put in the `X-CSRFToken` header
3. Without the matching header, Django rejects the request

### 4.3 Why Method A (cookie domain) is required

**Problem without `Domain=.polyu.life`:**

```
Cookie set by preprod-api.polyu.life (no Domain specified)
→ Cookie Domain defaults to preprod-api.polyu.life (host-only)

Browser cookie storage:
  preprod-api.polyu.life:
    - csrftoken=abc123
    - sessionid=xyz789

  preprod-app.polyu.life:
    - (no csrftoken visible here!)

Frontend JS at preprod-app.polyu.life:
  document.cookie  → ""  (cannot see csrftoken!)

Result: Frontend cannot read csrftoken to send in X-CSRFToken header
        → Login POST fails with 403 CSRF verification failed
```

**Solution with `Domain=.polyu.life`:**

```
Cookie set by preprod-api.polyu.life with Domain=.polyu.life

Browser cookie storage:
  .polyu.life:  ◄── Shared parent domain
    - csrftoken=abc123
    - sessionid=xyz789

Both subdomains can access these cookies:

  preprod-app.polyu.life:
    document.cookie → "csrftoken=abc123; sessionid=xyz789"
    ✓ Can read csrftoken!

  preprod-api.polyu.life:
    Request includes: Cookie: csrftoken=abc123; sessionid=xyz789
    ✓ Can validate both!

Result: Frontend reads csrftoken, includes it in X-CSRFToken header
        → Django validates successfully → Login succeeds!
```

### 4.4 Django CSRF validation checklist

Django's `CsrfViewMiddleware` performs these checks on POST/PATCH/DELETE:

1. ✓ Token in cookie matches token in `X-CSRFToken` header
2. ✓ Token is valid and not expired
3. ✓ Request origin/referer is in `CSRF_TRUSTED_ORIGINS`
4. ✓ If HTTPS, enforce stricter origin checks

If any check fails → 403 Forbidden

## 5) Cookie attributes used in this setup

### 5.1 Cookie attribute reference

| Attribute    | Value                             | Purpose                            | Notes                                                   |
| ------------ | --------------------------------- | ---------------------------------- | ------------------------------------------------------- |
| **Domain**   | `.polyu.life`                     | Share cookie across all subdomains | Without leading dot: host-only (not shared)             |
| **Path**     | `/`                               | Cookie sent for all paths          | More restrictive paths possible but `/` is typical      |
| **Secure**   | `True` (when `DEBUG=False`)       | Cookie only sent over HTTPS        | Critical for production; prevents MITM                  |
| **HttpOnly** | `False` (CSRF) / `True` (session) | JS access control                  | CSRF: must be readable by JS; Session: protect from XSS |
| **SameSite** | `Lax` or `None`                   | Cross-site sending policy          | See section 6 for detailed comparison                   |
| **Max-Age**  | Session: 10 days                  | Cookie lifetime                    | `SESSION_COOKIE_AGE = 60*60*24*10`                      |

### 5.2 Cookie visibility diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ Host-Only Cookie (no Domain specified)                          │
│                                                                  │
│  Set-Cookie: csrftoken=abc; Path=/                              │
│  (issued by preprod-api.polyu.life)                             │
│                                                                  │
│  Browser storage:                                                │
│    preprod-api.polyu.life:                                      │
│      └─ csrftoken=abc  ✓                                        │
│                                                                  │
│    preprod-app.polyu.life:                                      │
│      └─ (no csrftoken)  ✗                                       │
│                                                                  │
│  Result: Frontend cannot read token → Login fails               │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Domain Cookie (Domain=.polyu.life) ← Method A                   │
│                                                                  │
│  Set-Cookie: csrftoken=abc; Domain=.polyu.life; Path=/          │
│  (issued by preprod-api.polyu.life)                             │
│                                                                  │
│  Browser storage:                                                │
│    .polyu.life (shared):                                        │
│      └─ csrftoken=abc                                           │
│                                                                  │
│  Visible to:                                                     │
│    preprod-api.polyu.life   ✓                                   │
│    preprod-app.polyu.life   ✓                                   │
│    admin.polyu.life         ✓                                   │
│    any-subdomain.polyu.life ✓                                   │
│                                                                  │
│  Result: Frontend reads token → Includes in X-CSRFToken → ✓    │
└─────────────────────────────────────────────────────────────────┘
```

### 5.3 Security considerations

**Why CSRF cookie has `HttpOnly=False`:**

- Frontend JS must read the token to send in `X-CSRFToken` header
- This is safe because:
  - The token is not sensitive credentials (it's just a nonce)
  - XSS attacks can steal it, but XSS already means full compromise
  - The double-submit pattern still prevents CSRF even if token is JS-readable

**Why session cookie has `HttpOnly=True`:**

- Session ID is highly sensitive (grants full authentication)
- No legitimate need for JS to access it
- Protecting it from XSS is critical

**Why both need `Secure=True` in production:**

- Prevents man-in-the-middle attacks on HTTP
- Django auto-enables when `DEBUG=False`
- Cloudflare Tunnel terminates TLS, so ensure `SECURE_PROXY_SSL_HEADER` is set

---

## 6) SameSite=Lax vs SameSite=None (and when to use which)

- SameSite determines in which cross-site contexts the browser sends a cookie.
- A “site” is based on the registrable domain (eTLD+1). Both `preprod-app.polyu.life` and `preprod-api.polyu.life` are the same site (`polyu.life`).

### 6.1 SameSite=Lax

- Cookies are sent on same-site requests and on top-level cross-site navigations (GET), but generally not on cross-site subresource requests.
- For subdomains under the same eTLD+1, requests between them are considered same-site. Therefore, Lax works well for frontend (`preprod-app.*`) calling backend (`preprod-api.*`) as long as both are under `polyu.life` and you’re using HTTPS.
- Security posture is stronger versus CSRF than `None`.

### 6.2 SameSite=None

- Cookies are sent in all cross-site contexts, but browsers require `Secure` to be set (HTTPS only). Modern browsers reject `SameSite=None` without `Secure`.
- Use `None` only when you truly need cross-site scenarios beyond the same eTLD+1. Examples: embedding your app on a different top-level site, or calling the API from a different parent domain.

### 6.3 SameSite decision tree

```
                   Are frontend and backend
                   on the same eTLD+1?
                   (e.g., both under .polyu.life)
                            │
                ┌───────────┴───────────┐
                │                       │
               YES                     NO
                │                       │
                │                       │
        Use SameSite=Lax        Use SameSite=None
        ✓ Same-site requests    (+ Secure required)
          will include cookies        │
        ✓ Stronger CSRF defense       │
        ✓ Works for subdomains  Cross-site embedding
                │               or different domains
                │                       │
                ▼                       ▼
          Current Setup         Future scenarios:
       preprod-app.polyu.life  - Frontend on different domain
            calls              - Third-party iframes
       preprod-api.polyu.life  - Mobile app webviews
                               from external sites
```

### 6.4 Practical guidance

- **Recommended for this preprod topology (same parent domain): Lax**
  - Both subdomains are same-site (`polyu.life`)
  - Lax allows cookies on same-site requests
  - Better CSRF protection than None
- **Switch to None only if:**
  - You move frontend or API to a different top-level domain
  - You embed your app in third-party sites via iframe
  - You have legitimate cross-site API calls
  - **Warning:** Must use HTTPS with `Secure` flag

### 6.5 Your current `.env`

- You have `SESSION_COOKIE_SAMESITE=None` and `CSRF_COOKIE_SAMESITE=None`. The current code hardcodes `'Lax'` and does not read these env values; they will be ignored until you enable env-driven SameSite (next subsection).

### 6.6 Optional: make SameSite env-driven

If you want `.env` to control SameSite values, update `project-consensus-backend/config/settings.py` like this:

```python
SESSION_COOKIE_SAMESITE = env("SESSION_COOKIE_SAMESITE", default="Lax")
CSRF_COOKIE_SAMESITE = env("CSRF_COOKIE_SAMESITE", default="Lax")
```

Then your `.env` entries will take effect. If you set either value to `None`, ensure you are on HTTPS so the corresponding cookie is also marked `Secure` (already true when `DEBUG=False`). Restart Gunicorn after the change.

---

## 7) Operational checklist

1. Ensure the backend `.env` contains at least:
   - `CORS_ALLOWED_ORIGINS=https://preprod-app.polyu.life`
   - `CSRF_TRUSTED_ORIGINS=https://preprod-app.polyu.life,https://preprod-api.polyu.life`
   - `CSRF_COOKIE_DOMAIN=.polyu.life`
   - `SESSION_COOKIE_DOMAIN=.polyu.life`
2. Restart backend:
   - `sudo systemctl restart project-consensus-backend`
3. Ensure the frontend `.env.production` exists before build:
   - `NEXT_PUBLIC_API_BASE_URL=https://preprod-api.polyu.life`
4. Rebuild and restart frontend if env changed:
   - `cd project-consensus-frontend && npm run build`
   - `sudo systemctl restart project-consensus-frontend`
5. Use a fresh incognito window or clear site data for both domains.

---

## 8) Validation

- In Chrome DevTools → Application → Cookies at `https://preprod-app.polyu.life`:
  - A `csrftoken` cookie exists with `Domain=.polyu.life`, `Secure`, and `SameSite` according to your choice (Lax recommended).
- In Network tab, when logging in:
  - The `POST https://preprod-api.polyu.life/api/accounts/login/` request has `X-CSRFToken` and `credentials: include`.
- Optional CLI checks:

```
curl -I https://preprod-api.polyu.life/api/health/
curl -I https://preprod-api.polyu.life/api/accounts/csrf/
```

---

## 9) Troubleshooting

- "Failed to fetch" on login:
  - Check OPTIONS preflight. Ensure your WAF/Access allows OPTIONS and POST to the API and that `django-cors-headers` is returning allow headers with credentials.
  - Ensure `NEXT_PUBLIC_API_BASE_URL` is HTTPS to avoid mixed content.
- 403 CSRF verification failed:
  - Verify `X-CSRFToken` is present and `CSRF_TRUSTED_ORIGINS` includes both app and api origins.
  - Ensure the `csrftoken` cookie is present on the app origin with `Domain=.polyu.life`.
- 400 Bad Request (host invalid):
  - Add the request host to `ALLOWED_HOSTS`.
- Cookies not sent:
  - For rare browser behaviors, consider `SameSite=None` (with Secure) if you truly need cross-site behavior. See section 6.5 to make SameSite env-driven.

---

## 10) Change log

- Enabled env-driven cookie domains in `settings.py` (`CSRF_COOKIE_DOMAIN`, `SESSION_COOKIE_DOMAIN`).
- Left SameSite hardcoded to `Lax` by default for stronger CSRF posture on the same-site (subdomain) architecture; provided an option to make SameSite env-driven if needed.

## 10.5) Complete login flow diagram

This comprehensive sequence diagram shows the entire login process from initial page load to successful authentication:

```
User Browser              Frontend (preprod-app)         Backend (preprod-api)           Database
     │                           │                               │                          │
     │  1. Visit app             │                               │                          │
     │──────────────────────────►│                               │                          │
     │                           │                               │                          │
     │                           │  2. GET /api/accounts/csrf/   │                          │
     │                           │──────────────────────────────►│                          │
     │                           │                               │                          │
     │                           │                               │ @ensure_csrf_cookie      │
     │                           │                               │ generates token          │
     │                           │                               │                          │
     │                           │  3. 200 OK                    │                          │
     │                           │  Set-Cookie: csrftoken=TOKEN; │                          │
     │                           │              Domain=.polyu.life;│                         │
     │                           │              Secure;HttpOnly=False│                      │
     │                           │◄──────────────────────────────│                          │
     │                           │                               │                          │
     │  4. Render page          │                               │                          │
     │◄──────────────────────────│                               │                          │
     │  (Cookie stored in browser)                              │                          │
     │                           │                               │                          │
     │  5. User opens login modal│                               │                          │
     │  and enters credentials   │                               │                          │
     │──────────────────────────►│                               │                          │
     │                           │                               │                          │
     │                           │ 6. Read csrftoken from        │                          │
     │                           │    document.cookie            │                          │
     │                           │    (Domain=.polyu.life makes  │                          │
     │                           │     it visible here)          │                          │
     │                           │                               │                          │
     │                           │ 7. OPTIONS /api/accounts/login/│                         │
     │                           │    (Preflight)                │                          │
     │                           │    Origin: https://preprod-app...│                       │
     │                           │    AC-Request-Method: POST    │                          │
     │                           │    AC-Request-Headers:        │                          │
     │                           │      content-type,x-csrftoken │                          │
     │                           │──────────────────────────────►│                          │
     │                           │                               │                          │
     │                           │                               │ CorsMiddleware checks:   │
     │                           │                               │ - Origin allowed?        │
     │                           │                               │ - Headers allowed?       │
     │                           │                               │                          │
     │                           │  8. 204 No Content            │                          │
     │                           │     AC-Allow-Origin:          │                          │
     │                           │       https://preprod-app...  │                          │
     │                           │     AC-Allow-Credentials: true│                          │
     │                           │     AC-Allow-Headers:         │                          │
     │                           │       content-type,x-csrftoken│                          │
     │                           │◄──────────────────────────────│                          │
     │                           │                               │                          │
     │                           │ 9. POST /api/accounts/login/  │                          │
     │                           │    Origin: https://preprod-app...│                       │
     │                           │    Content-Type: application/json│                       │
     │                           │    Cookie: csrftoken=TOKEN    │                          │
     │                           │    X-CSRFToken: TOKEN         │                          │
     │                           │    Body: {email, password}    │                          │
     │                           │──────────────────────────────►│                          │
     │                           │                               │                          │
     │                           │                               │ CsrfViewMiddleware:      │
     │                           │                               │ - Cookie token == header?│
     │                           │                               │ - Origin trusted?        │
     │                           │                               │                          │
     │                           │                               │ authenticate(email, pass)│
     │                           │                               │─────────────────────────►│
     │                           │                               │                          │
     │                           │                               │ Query user by email      │
     │                           │                               │ Check password hash      │
     │                           │                               │                          │
     │                           │                               │◄─────────────────────────│
     │                           │                               │ User object              │
     │                           │                               │                          │
     │                           │                               │ django_login(user)       │
     │                           │                               │ Create session           │
     │                           │                               │─────────────────────────►│
     │                           │                               │                          │
     │                           │                               │ Store session data       │
     │                           │                               │                          │
     │                           │                               │◄─────────────────────────│
     │                           │                               │ Session ID               │
     │                           │                               │                          │
     │                           │  10. 200 OK                   │                          │
     │                           │      AC-Allow-Origin:         │                          │
     │                           │        https://preprod-app... │                          │
     │                           │      AC-Allow-Credentials: true│                         │
     │                           │      Set-Cookie: sessionid=SID;│                         │
     │                           │        Domain=.polyu.life;    │                          │
     │                           │        Secure;HttpOnly;       │                          │
     │                           │        SameSite=Lax           │                          │
     │                           │      Body: {success:true,user}│                          │
     │                           │◄──────────────────────────────│                          │
     │                           │                               │                          │
     │                           │ 11. Update UI state           │                          │
     │                           │     Store user in context     │                          │
     │                           │                               │                          │
     │  12. Show logged-in UI    │                               │                          │
     │◄──────────────────────────│                               │                          │
     │  (sessionid cookie stored)                               │                          │
     │                           │                               │                          │
     │  ═══════════════════════════════════════════════════════════════════════════════════│
     │  Subsequent authenticated requests                       │                          │
     │  ═══════════════════════════════════════════════════════════════════════════════════│
     │                           │                               │                          │
     │  13. API request          │                               │                          │
     │──────────────────────────►│  GET /api/accounts/me/        │                          │
     │                           │  Cookie: sessionid=SID;       │                          │
     │                           │          csrftoken=TOKEN      │                          │
     │                           │──────────────────────────────►│                          │
     │                           │                               │                          │
     │                           │                               │ SessionMiddleware:       │
     │                           │                               │ Lookup session by SID    │
     │                           │                               │─────────────────────────►│
     │                           │                               │                          │
     │                           │                               │ Session data             │
     │                           │                               │◄─────────────────────────│
     │                           │                               │                          │
     │                           │                               │ Load user from session   │
     │                           │                               │ request.user = user obj  │
     │                           │                               │                          │
     │                           │  14. 200 OK                   │                          │
     │                           │      Body: {user data}        │                          │
     │                           │◄──────────────────────────────│                          │
     │                           │                               │                          │
     │  15. Display user data    │                               │                          │
     │◄──────────────────────────│                               │                          │
     │                           │                               │                          │
```

**Key observations:**

1. **CSRF cookie obtained first** (step 2-3) - must happen before any mutating request
2. **Preflight check** (step 7-8) - browser automatically sends OPTIONS before POST due to JSON + custom header
3. **Double verification** (step 9) - both Cookie and X-CSRFToken header must match
4. **Session cookie created** (step 10) - stored with Domain=.polyu.life for sharing
5. **Subsequent requests** (step 13-15) - session cookie automatically included, no CSRF needed for GET
