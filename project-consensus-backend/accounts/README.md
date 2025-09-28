# Accounts App

The Accounts app provides user-related models and endpoints, including a user Profile and a demo email verification flow used by registration.

## Models

- `Profile`
  - One-to-one with `AUTH_USER_MODEL`
  - Fields: `display_name`, `avatar_url`
  - Helper: `author_payload` returns `{ id, name, avatar }` used by the frontend "Author" type

Note: Email verification codes are not stored in the database. They are
cached with a TTL for the registration flow.

## Serializers

- `AuthorSerializer` — simple structure: `{ id, name, avatar }`
- `ProfileSerializer` — for returning/updating profile information
- `SendCodeSerializer` — input validation for sending a verification code
- `RegisterSerializer` — input validation for register endpoint

## Endpoints

Base path: `/api/auth/`

- `POST /api/auth/send_verification_code/`
  - Body: `{ "email": "user@connect.polyu.hk" }`
  - Behavior: Generates a numeric code and stores it in cache with TTL

- `POST /api/auth/register/`
  - Body: `{ "nickname": "Alice", "email": "user@connect.polyu.hk", "verification_code": "123456", "password": "secret" }`
  - Behavior: Validates the code within TTL, creates/updates a Django User and the associated Profile, and returns the profile payload

## Settings

- `AUTH_VERIFICATION_CODE_TTL_SECONDS`: integer TTL (seconds), default `900`.
- `AUTH_VERIFICATION_REQUEST_INTERVAL_SECONDS`: throttle per email, default `60` seconds.

## Notes

- This flow is for demo purposes only. In production, integrate a real email provider and add:
  - Rate limiting, per-IP limits, captchas
  - Delivery tracking and bounce handling
  - Stronger password policies and security checks

## Examples

Send code:

```bash
curl -X POST http://127.0.0.1:8000/api/auth/send_verification_code/ \
  -H 'Content-Type: application/json' \
  -d '{"email":"user@connect.polyu.hk"}'
```

Register:

```bash
curl -X POST http://127.0.0.1:8000/api/auth/register/ \
  -H 'Content-Type: application/json' \
  -d '{"nickname":"Alice","email":"user@connect.polyu.hk","verification_code":"123456","password":"secret"}'
```

