from django.urls import path
from . import views


urlpatterns = [
    # Send register email verification code (POST: { email })
    path("send_verification_code/", views.send_verification_code, name="send_verification_code"),
    # Register with a verification code (POST: { nickname, email, verification_code, password })
    path("register/", views.register, name="register"),
    # Login with email/password (POST: { email, password })
    path("login/", views.login_view, name="login"),
]
