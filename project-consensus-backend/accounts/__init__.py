"""
Accounts app.

Provides models and endpoints related to user accounts, including the
user Profile and a demo email verification record used by the register flow.

Note: This demo stores verification codes in DB and does not send real emails.
For production use, integrate a real email provider and add rate limiting
and abuse prevention (per-IP limits, captchas, etc.).
"""
