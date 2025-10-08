"""
Seed wiki data migration.

Creates sample wiki categories and pages for demonstration purposes.
"""

from django.db import migrations
from django.conf import settings


def create_sample_wiki_data(apps, schema_editor):
    """
    创建示例 Wiki 数据 / Create sample wiki data
    
    Creates:
    - 3 wiki categories
    - 5 wiki pages with content
    """
    WikiCategory = apps.get_model('wiki', 'WikiCategory')
    WikiPage = apps.get_model('wiki', 'WikiPage')
    app_label, model_name = settings.AUTH_USER_MODEL.split(".")
    User = apps.get_model(app_label, model_name)
    
    # 获取第一个管理员用户 / Get the first admin user; fallback to any existing user
    admin_user = User.objects.filter(is_staff=True).first()
    if not admin_user:
        admin_user = User.objects.first()
    if not admin_user:
        print("No user found. Skipping wiki data seed.")
        return
    
    # 创建分类 / Create categories
    getting_started = WikiCategory.objects.create(
        name='Getting Started',
        slug='getting-started',
        description='新手入门指南和基础教程',
        order=1
    )
    
    features = WikiCategory.objects.create(
        name='Features',
        slug='features',
        description='平台功能介绍和使用说明',
        order=2
    )
    
    faq = WikiCategory.objects.create(
        name='FAQ',
        slug='faq',
        description='常见问题解答',
        order=3
    )
    
    # 创建示例页面 / Create sample pages
    
    # Page 1: Welcome
    WikiPage.objects.create(
        title='欢迎来到 Project Consensus Wiki',
        slug='welcome',
        content='''# 欢迎来到 Project Consensus Wiki 👋

欢迎使用 Project Consensus 的官方 Wiki 知识库！

## 什么是 Project Consensus？

Project Consensus 是一个综合性的课程评价和学术交流平台，旨在帮助学生：

- 📚 **浏览课程信息**：查看详细的课程介绍、教学大纲和学习要求
- ⭐ **阅读课程评价**：了解其他学生对课程的真实评价和建议
- 💬 **参与讨论**：在论坛中与同学交流学习心得和问题
- 👨‍🏫 **了解教师**：查看教师信息和教学风格

## 快速开始

如果您是新用户，建议按照以下步骤开始：

1. **注册账号**：点击右上角注册按钮创建您的账号
2. **浏览课程**：访问课程页面，搜索您感兴趣的课程
3. **阅读评价**：查看其他学生分享的课程评价
4. **发表观点**：分享您自己的学习体验和建议

## 主要功能

### 课程浏览
浏览和搜索所有课程信息，包括课程名称、学分、教师、课程描述等。

### 课程评价
阅读和发表课程评价，帮助其他学生做出更好的选课决策。

### 论坛讨论
在论坛中发帖、评论，与其他学生交流学习经验。

### 教师信息
查看教师的基本信息、授课课程和学生评价。

## 需要帮助？

如果您在使用过程中遇到任何问题，可以：

- 📖 查看我们的[常见问题解答](/wiki/faq)
- 💡 阅读[功能介绍](/wiki/features)文档
- 📧 联系我们的支持团队

祝您使用愉快！🎉
''',
        summary='欢迎页面，介绍 Project Consensus 平台的主要功能和快速开始指南。',
        category=getting_started,
        tags='欢迎, 入门, 介绍',
        status='published',
        author=admin_user,
        order=1
    )
    
    # Page 2: How to Register
    WikiPage.objects.create(
        title='如何注册账号',
        slug='how-to-register',
        content='''# 如何注册账号

本文将指导您完成 Project Consensus 的账号注册流程。

## 注册步骤

### 1. 访问注册页面

点击网站右上角的"注册"按钮，或直接访问 `/register` 页面。

### 2. 填写注册信息

在注册表单中填写以下信息：

- **电子邮箱**：请使用有效的邮箱地址，用于接收验证邮件
- **用户名**：您在平台上显示的名称
- **密码**：设置一个强密码（至少8位，包含字母和数字）
- **确认密码**：再次输入密码以确认

### 3. 完成注册

点击"注册"按钮提交表单。系统会自动为您创建账号。

## 常见问题

### 为什么需要邮箱验证？

邮箱验证可以：
- 确保账号安全
- 方便找回密码
- 接收重要通知

### 忘记密码怎么办？

在登录页面点击"忘记密码"链接，按照提示通过邮箱重置密码。

### 可以修改用户名吗？

注册后可以在个人设置页面修改用户名和其他个人信息。

## 下一步

注册成功后，您可以：

1. 完善个人资料
2. 浏览课程信息
3. 参与论坛讨论
4. 发表课程评价

祝您使用愉快！
''',
        summary='详细的账号注册步骤说明，包括注册流程和常见问题解答。',
        category=getting_started,
        tags='注册, 账号, 入门',
        status='published',
        author=admin_user,
        order=2
    )
    
    # Page 3: Course Review Guide
    WikiPage.objects.create(
        title='如何发表课程评价',
        slug='how-to-review-courses',
        content='''# 如何发表课程评价

课程评价是 Project Consensus 的核心功能之一。本文将指导您如何撰写有价值的课程评价。

## 评价前的准备

在发表评价之前，请确保：

- ✅ 您已经完成或正在学习该课程
- ✅ 您有足够的信息来评价课程质量
- ✅ 您的评价基于真实的学习体验

## 评价内容建议

一份有价值的课程评价通常包含以下内容：

### 1. 课程难度
描述课程的难度水平，对新手是否友好。

### 2. 教学质量
评价教师的教学方式、授课水平和互动情况。

### 3. 课程内容
介绍课程涵盖的主要内容和知识点。

### 4. 作业和考试
说明作业量、考试形式和评分标准。

### 5. 学习收获
分享您通过这门课程获得的知识和技能。

### 6. 建议和提示
给未来选课学生的建议，如预备知识、学习方法等。

## 评价规范

为了维护良好的社区环境，请遵守以下规范：

- 📝 **客观真实**：基于事实发表评价，避免情绪化表达
- 🤝 **尊重他人**：不发表人身攻击或侮辱性言论
- 📊 **具体详细**：提供具体的例子和细节，而非笼统的评价
- 🔒 **保护隐私**：不泄露他人或自己的敏感信息

## 评价示例

**标题**: 非常实用的Python入门课

**内容**:
这门课是我学习编程的第一门课，整体体验很好。

**优点**:
- 教师讲解清晰，善于用实际例子说明概念
- 作业设计合理，循序渐进
- 课程资源丰富，包含视频和代码示例

**需要改进的地方**:
- 课程进度稍快，新手可能需要课后多花时间消化
- 期末项目难度较大，建议提前开始准备

**建议**:
如果您没有编程基础，建议提前预习一些基础知识。课后多练习，不懂就问。

**评分**: 4.5/5

## 修改评价

发表评价后，您仍然可以在个人中心修改或删除自己的评价。

## 需要帮助？

如果您对评价功能有任何疑问，欢迎联系我们！
''',
        summary='如何撰写有价值的课程评价，包括评价内容建议、规范和示例。',
        category=features,
        tags='评价, 课程, 指南',
        status='published',
        author=admin_user,
        order=1
    )
    
    # Page 4: Forum Usage
    WikiPage.objects.create(
        title='论坛使用指南',
        slug='forum-guide',
        content='''# 论坛使用指南

Project Consensus 论坛是一个学术交流和讨论的平台。

## 如何发帖

### 1. 选择合适的分类
根据您的话题选择合适的分类，如：
- 课程讨论
- 学习资源
- 技术问题
- 经验分享
### 2. 撰写帖子标题
- 简洁明了，准确概括内容
- 避免使用无意义的标题如"求助"、"有问题"

    ### 3. 编写帖子内容
    - 清晰描述您的问题或想法
    - 使用 Markdown 格式化内容
    - 适当添加代码块、图片等

    ## Markdown 基础

    论坛支持 Markdown 格式，常用语法：

```markdown
    # 一级标题
    ## 二级标题

    **粗体** *斜体*

    - 列表项 1
    - 列表项 2

    [链接文字](https://example.com)
```

```python
    # 代码块
    print("Hello, World!")
```

    ## 评论和互动

- 💬 回复他人的帖子时保持友善和建设性
- 👍 点赞有价值的内容

## 论坛规则:

1. **尊重他人**：不发表攻击性或侮辱性言论
2. **主题相关**：发帖内容应与学术交流相关
3. **禁止广告**：不发布商业广告或垃圾信息
4. **保护隐私**：不泄露个人或他人的敏感信息
5. **原创诚信**：引用他人内容时注明出处

## 获得帮助

如果您的帖子被删除或账号被限制，可以联系管理员了解原因。

祝您在论坛中获得有价值的交流体验！
''',
        summary='论坛使用指南，包括发帖方法、Markdown 语法和论坛规则。',
        category=features,
        tags='论坛, 讨论, Markdown',
        status='published',
        author=admin_user,
        order=2
    )
    
    # Page 5: FAQ
    WikiPage.objects.create(
        title='常见问题解答',
        slug='frequently-asked-questions',
        content='''# 常见问题解答 (FAQ)

以下是用户常见问题的解答。

## 账号相关

### 如何注册账号？
请访问注册页面，填写邮箱、用户名和密码即可注册。详见[如何注册账号](/wiki/how-to-register)。

### 忘记密码怎么办？
点击登录页面的"忘记密码"链接，输入注册邮箱，系统会发送重置密码的链接到您的邮箱。

### 可以修改用户名吗？
可以。登录后访问"个人设置"页面，即可修改用户名、头像等信息。

### 如何注销账号？
目前暂不支持自助注销，如需注销账号请联系客服。

## 课程相关

### 如何搜索课程？
在课程页面使用搜索框，输入课程名称、教师名称或关键词即可搜索。

### 课程信息多久更新一次？
课程信息每学期更新一次，通常在选课前完成更新。

### 如何收藏课程？
浏览课程详情页时，点击"收藏"按钮即可将课程添加到您的收藏夹。

## 评价相关

### 谁可以发表评价？
所有注册用户都可以发表评价。我们鼓励真实、客观、有建设性的评价。

### 评价可以修改或删除吗？
可以。在个人中心找到您发表的评价，点击"编辑"或"删除"按钮。

### 如何举报不当评价？
如发现违规评价，请点击评价下方的"举报"按钮，选择举报理由并提交。

## 论坛相关

### 如何发帖？
登录后访问论坛页面，点击"发新帖"按钮，填写标题和内容后发布。

### 帖子被删除了？
如果您的帖子违反了社区规则，可能会被管理员删除。常见违规包括：广告、人身攻击、垃圾信息等。

### 如何插入图片？
在编辑器中使用 Markdown 语法：`![图片描述](图片URL)`，或使用编辑器的图片上传功能。

## 技术问题

### 网站加载很慢？
请检查您的网络连接。如果问题持续存在，请清除浏览器缓存或尝试使用其他浏览器。

### 发现了 Bug？
请通过论坛或邮件向我们报告 Bug，我们会尽快修复。

### 支持哪些浏览器？
我们支持 Chrome、Firefox、Safari、Edge 等主流浏览器的最新版本。

## 隐私和安全

### 我的个人信息安全吗？
我们采用行业标准的安全措施保护您的数据。详见我们的隐私政策。

### 如何防止账号被盗？
- 使用强密码
- 不与他人分享密码
- 定期修改密码
- 不在公共设备上保持登录状态

## 其他问题

### 如何联系客服？
您可以通过以下方式联系我们：
- 📧 发送邮件至 support@projectconsensus.com
- 💬 在论坛发帖
- 📱 关注我们的社交媒体

### 平台是免费的吗？
是的，Project Consensus 对所有用户完全免费。

---

如果您的问题没有在此列出，欢迎通过论坛或邮件联系我们！
''',
        summary='常见问题解答，涵盖账号、课程、评价、论坛、技术和安全等方面的问题。',
        category=faq,
        tags='FAQ, 帮助, 问题',
        status='published',
        author=admin_user,
        order=1
    )
    
    print("Successfully created sample wiki data:")
    print(f"  - {WikiCategory.objects.count()} categories")
    print(f"  - {WikiPage.objects.count()} pages")


def delete_sample_wiki_data(apps, schema_editor):
    """
    删除示例数据 / Delete sample data
    
    Removes all wiki pages and categories created by this migration.
    """
    WikiPage = apps.get_model('wiki', 'WikiPage')
    WikiCategory = apps.get_model('wiki', 'WikiCategory')
    
    WikiPage.objects.all().delete()
    WikiCategory.objects.all().delete()
    
    print("Deleted all wiki sample data")


class Migration(migrations.Migration):
    """
    Wiki 示例数据迁移 / Wiki sample data migration
    
    Creates sample wiki categories and pages for demonstration.
    Can be reversed to clean up the sample data.
    """
    
    dependencies = [
        ('wiki', '0001_initial'),
        ('accounts', '0002_create_demo_user'),  # Ensure demo user exists before seeding
    ]
    
    operations = [
        migrations.RunPython(
            create_sample_wiki_data,
            delete_sample_wiki_data
        ),
    ]

