from rest_framework.throttling import UserRateThrottle


class TranslationUserThrottle(UserRateThrottle):
    scope = "translation"
    rate = "500/min"
