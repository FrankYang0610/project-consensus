from django.db import migrations, models


def forwards_bcp47(apps, schema_editor):
    WikiCategory = apps.get_model('wiki', 'WikiCategory')
    WikiPage = apps.get_model('wiki', 'WikiPage')
    # Map zh-Hans -> zh-CN
    WikiCategory.objects.filter(language='zh-Hans').update(language='zh-CN')
    WikiPage.objects.filter(language='zh-Hans').update(language='zh-CN')


def backwards_bcp47(apps, schema_editor):
    WikiCategory = apps.get_model('wiki', 'WikiCategory')
    WikiPage = apps.get_model('wiki', 'WikiPage')
    # Map zh-CN -> zh-Hans; collapse zh-HK back to zh-Hans for reversibility
    WikiCategory.objects.filter(language__in=['zh-CN', 'zh-HK']).update(language='zh-Hans')
    WikiPage.objects.filter(language__in=['zh-CN', 'zh-HK']).update(language='zh-Hans')


class Migration(migrations.Migration):

    dependencies = [
        ('wiki', '0002_seed_wiki_data'),
    ]

    operations = []
