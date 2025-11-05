"""
Error codes for accounts app validation errors.

These codes are returned to the frontend for i18n translation.
Each code maps to a specific i18n key in the frontend locales.
"""

# Nickname validation errors
NICKNAME_REQUIRED = "validation.nickname.required"
NICKNAME_TOO_LONG = "validation.nickname.tooLong"
NICKNAME_ALREADY_TAKEN = "validation.nickname.alreadyTaken"
NICKNAME_INVALID = "validation.nickname.invalid"

# Email validation errors
EMAIL_REQUIRED = "validation.email.required"
EMAIL_INVALID = "validation.email.invalid"
EMAIL_POLYU_ONLY = "validation.email.polyuOnly"
EMAIL_ALREADY_REGISTERED = "validation.email.alreadyRegistered"

# Password validation errors
PASSWORD_REQUIRED = "validation.password.required"
PASSWORD_TOO_SHORT = "validation.password.tooShort"
PASSWORD_TOO_COMMON = "validation.password.tooCommon"
PASSWORD_ENTIRELY_NUMERIC = "validation.password.entirelyNumeric"
PASSWORD_TOO_SIMILAR = "validation.password.tooSimilar"
PASSWORD_MISMATCH = "validation.password.mismatch"

# Verification code errors
VERIFICATION_CODE_REQUIRED = "validation.verificationCode.required"
VERIFICATION_CODE_INVALID = "validation.verificationCode.invalid"
VERIFICATION_CODE_INVALID_OR_EXPIRED = "validation.verificationCode.invalidOrExpired"
VERIFICATION_CODE_TOO_MANY_ATTEMPTS = "validation.verificationCode.tooManyAttempts"

# Generic field errors
FIELD_REQUIRED = "validation.field.required"

# Authentication errors  
AUTHENTICATION_REQUIRED = "auth.errorAuthRequired"
AUTH_TOO_MANY_ATTEMPTS = "auth.errorTooManyAttempts"

# Password reset errors
PASSWORD_RESET_EMAIL_SENT = "auth.passwordReset.emailSent"
PASSWORD_RESET_INVALID_OR_EXPIRED = "auth.passwordReset.invalidOrExpired"
PASSWORD_RESET_LINK_EXPIRED = "auth.passwordReset.linkExpired"
PASSWORD_RESET_SUCCESS = "auth.passwordReset.success"


def map_django_password_error(error_message: str) -> str:
    """
    Map Django password validation error messages to i18n error codes.
    
    Args:
        error_message: Error message from Django password validators
        
    Returns:
        Error code string for frontend i18n
    """
    error_lower = error_message.lower()
    
    if "too short" in error_lower or "at least" in error_lower:
        return PASSWORD_TOO_SHORT
    elif "too common" in error_lower or "commonly used" in error_lower:
        return PASSWORD_TOO_COMMON
    elif "entirely numeric" in error_lower or "only numeric" in error_lower:
        return PASSWORD_ENTIRELY_NUMERIC
    elif "too similar" in error_lower or "similarity" in error_lower:
        return PASSWORD_TOO_SIMILAR
    else:
        # Return original message if no mapping found
        return error_message
