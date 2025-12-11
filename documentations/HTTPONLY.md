## HttpOnly

### What is HttpOnly
HttpOnly cookies prevent client-side JavaScript from reading them, which reduces the risk of session theft via cross-site scripting (XSS). When a cookie is marked HttpOnly, browsers still send it with every request to the issuing domain, but `document.cookie` and other front-end APIs cannot access it.

### Why it matters
Many attacks try to steal session cookies with injected scripts. HttpOnly blocks that easy path. It does not stop other risks (e.g., no TLS or a compromised server), but it removes a simple way to grab cookies.

### How to use HttpOnly
Set the `HttpOnly` flag when issuing cookies, typically alongside `Secure` and `SameSite`:

```
Set-Cookie: sessionid=<value>; Path=/; HttpOnly; Secure; SameSite=Lax
```

### Best practices
- Always use HttpOnly for authentication/session cookies.
- Pair with `Secure` (HTTPS only) and an appropriate `SameSite` value.
- Avoid putting secrets in cookies that genuinely must be read by JavaScript. Keep such data minimal and non-sensitive.
