from django.db import migrations


def fix_forum_guide_content(apps, schema_editor):
    WikiPage = apps.get_model('wiki', 'WikiPage')
    try:
        page = WikiPage.objects.filter(slug='forum-guide').first()
        if not page:
            return
        # Replace problematic raw HTML/MDX placeholders with fenced code blocks and plain text
        content = page.content or ''
        # Replace any <pre><code ...> blocks with triple-backtick fenced code blocks
        content = content.replace('<pre><code>', '```\n').replace('</code></pre>', '\n```')
        content = content.replace('<pre><code class="language-python">', '```python\n')
        # Replace stray <code> tags with backticks
        content = content.replace('<code>', '`').replace('</code>', '`')
        # Remove or neutralize any {{ ... }} placeholders which break MDX
        content = content.replace('{{ ... }}', '{ ... }')
        # Normalize Markdown heading fence indentation
        lines = content.split('\n')
        normalized = []
        in_fence = False
        for ln in lines:
            if ln.strip().startswith('```'):
                in_fence = not in_fence
                normalized.append(ln.strip())
            else:
                normalized.append(ln)
        page.content = '\n'.join(normalized)
        page.save(update_fields=['content'])
    except Exception:
        # best-effort migration; avoid hard failure
        pass


def reverse_noop(apps, schema_editor):
    # no-op reverse
    pass


class Migration(migrations.Migration):
    dependencies = [
        ('wiki', '0003_bcp47_language_update'),
    ]

    operations = [
        migrations.RunPython(fix_forum_guide_content, reverse_noop),
    ]
