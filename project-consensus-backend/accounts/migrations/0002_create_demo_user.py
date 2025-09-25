"""
目的（中文）：
  本迁移在数据库中创建一个用于演示/本地开发的示例账号（email/password），
  便于直接登录联调。回滚此迁移时删除该示例账号。

Purpose (English):
  This migration creates a demo user for local development/testing so you can
  log in immediately. Rolling back this migration will delete the demo user.

Account:
  Email: demo@connect.polyu.hk
  Password: Demo1234!
"""

from django.conf import settings
from django.db import migrations


DEMO_EMAIL = "demo@connect.polyu.hk"
DEMO_PASSWORD = "Demo1234!"
DEMO_NAME = "Demo User"


def create_demo_user(apps, schema_editor):
    # Use swappable AUTH_USER_MODEL via apps registry
    app_label, model_name = settings.AUTH_USER_MODEL.split(".")
    User = apps.get_model(app_label, model_name)
    Profile = apps.get_model("accounts", "Profile")

    # Idempotent: create only if not exists
    user = User.objects.filter(email=DEMO_EMAIL).first()
    if user is None:
        user = User.objects.create_user(username=DEMO_EMAIL, email=DEMO_EMAIL, password=DEMO_PASSWORD)
        # Create a simple profile
        Profile.objects.create(user=user, display_name=DEMO_NAME)

# For Database Rollback
def delete_demo_user(apps, schema_editor):
    app_label, model_name = settings.AUTH_USER_MODEL.split(".")
    User = apps.get_model(app_label, model_name)

    user = User.objects.filter(email=DEMO_EMAIL).first()
    if user is not None:
        user.delete()


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(create_demo_user, delete_demo_user),
    ]
