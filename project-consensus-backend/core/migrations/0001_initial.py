from django.contrib.postgres.operations import TrigramExtension
from django.db import migrations


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        # Enable pg_trgm extension for trigram similarity search
        TrigramExtension(),
    ]

