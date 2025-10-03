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

    operations = [
        migrations.RunPython(forwards_bcp47, backwards_bcp47),
        migrations.AlterField(
            model_name='wikicategory',
            name='language',
            field=models.CharField(
                max_length=35,
                choices=[('zh-CN', '简体中文'), ('zh-HK', '繁體中文（香港）'), ('en', 'English')],
                default='zh-CN',
                help_text='Content language',
                verbose_name='语言',
            ),
        ),
        migrations.AlterField(
            model_name='wikipage',
            name='language',
            field=models.CharField(
                max_length=35,
                choices=[('zh-CN', '简体中文'), ('zh-HK', '繁體中文（香港）'), ('en', 'English')],
                default='zh-CN',
                help_text='Content language',
                verbose_name='语言',
            ),
        ),
        migrations.AddConstraint(
            model_name='wikicategory',
            constraint=models.UniqueConstraint(
                fields=['translation_group', 'language'], name='wiki_cat_trans_lang_unique'
            ),
        ),
        migrations.AddConstraint(
            model_name='wikipage',
            constraint=models.UniqueConstraint(
                fields=['translation_group', 'language'], name='wiki_page_trans_lang_unique'
            ),
        ),
    ]
