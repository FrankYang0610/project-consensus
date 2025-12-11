## CSRF in this project

### What is CSRF
**Cross-Site Request Forgery (CSRF)** lets a malicious site make your browser send state-changing requests to a site where you are logged in. Because browsers auto-attach cookies, a forged POST can run with your session, unless extra checks block it.

**Real-world example:** You stay logged in to your bank, then open a shady blog. The blog quietly loads a hidden transfer form to your bank (amount and payee fixed) and auto-submits it. Your browser includes the bank `sessionid` cookie, so the bank thinks you sent the request. If the bank does not also require a correct CSRF token, the forged transfer goes through.

### How to prevent? Use CSRF tokens
**CSRF tokens** are per-session or per-request secrets that the backend issues to the browser. The frontend must echo the token in a header or form field when making unsafe requests. The server rejects requests without a valid token, breaking the attack.

### Use CSRF tokens in Django
Django ships with a CSRF middleware that sets a `csrftoken` cookie (not [HttpOnly](./HTTPONLY.md)) and verifies that unsafe methods (POST, PATCH, DELETE, etc.) include a matching token via `X-CSRFToken` or form fields. The middleware also enforces cookie attributes like SameSite to reduce cross-site abuse.

### project-consensus implementation
project-consensus relies on Django's middleware plus explicit frontend handling. 
- The backend exposes `/api/accounts/csrf/` decorated with `@ensure_csrf_cookie`; calling it issues `Set-Cookie: csrftoken=...`. 
- The frontend (`ensureCSRFCookie`, `LoginModal`, and API helpers) fetches this endpoint with `credentials: 'include'`, reads `csrftoken` from cookies, and sends it back as `X-CSRFToken` on write operations. 
- Session authentication uses an HttpOnly `sessionid` cookie; pairing it with a separate CSRF token prevents cross-site form and AJAX forgery. 
