# Wiki Application

## 概述 / Overview

Wiki 应用提供了一个基于 Markdown 的知识库/文档系统，支持分类管理和全文搜索。

The Wiki application provides a Markdown-based knowledge base/documentation system with category management and full-text search.

## 功能特性 / Features

- ✅ **Markdown 编辑**：支持 GitHub Flavored Markdown
- ✅ **分类管理**：通过分类组织 Wiki 页面
- ✅ **权限控制**：管理员可编辑，所有用户可查看
- ✅ **草稿系统**：支持草稿和已发布状态
- ✅ **标签系统**：通过标签组织内容
- ✅ **搜索功能**：全文搜索标题和内容
- ✅ **浏览统计**：记录页面浏览次数

## 数据模型 / Data Models

### WikiCategory

- 分类名称、slug、描述
- 显示顺序

### WikiPage

- 标题、slug、Markdown 内容
- 分类、标签、状态（草稿/已发布）
- 作者、创建/更新时间
- 浏览次数

## API 端点 / API Endpoints

### 公开端点（所有用户）

- `GET /api/wiki/pages/` - 获取已发布的 Wiki 页面列表
- `GET /api/wiki/pages/:slug/` - 获取单个 Wiki 页面详情
- `GET /api/wiki/categories/` - 获取分类列表

### 管理端点（仅管理员）

- `POST /api/wiki/pages/` - 创建新 Wiki 页面
- `PUT /api/wiki/pages/:slug/` - 更新 Wiki 页面
- `DELETE /api/wiki/pages/:slug/` - 删除 Wiki 页面
- `POST /api/wiki/categories/` - 创建分类
- `PUT /api/wiki/categories/:slug/` - 更新分类
- `DELETE /api/wiki/categories/:slug/` - 删除分类

## 权限控制 / Permissions

使用自定义权限类 `IsAdminOrReadOnly`：

- 读操作（GET, HEAD, OPTIONS）：所有用户
- 写操作（POST, PUT, DELETE）：仅管理员（is_staff=True）

## 使用说明 / Usage

### 创建 Wiki 页面

管理员可以通过以下方式创建 Wiki 页面：

1. **Django Admin**: `/admin/wiki/wikipage/add/`
2. **REST API**: `POST /api/wiki/pages/`
3. **前端管理界面**: `/wiki/admin/new`

### Markdown 格式

Wiki 内容使用 Markdown 格式编写，支持：

- 标题、段落、列表
- 代码块、引用
- 表格、链接、图片
- GitHub Flavored Markdown 扩展

## 安装和配置 / Installation

已在 `config/settings.py` 的 `INSTALLED_APPS` 中配置。

运行迁移以创建数据库表：

```bash
python manage.py makemigrations wiki
python manage.py migrate wiki
```
