# 国际化 (i18n) 使用指南

## 概述

本项目使用 `i18next` 和 `react-i18next` 实现国际化功能，支持三种语言：

- 简体中文 (`zh-cn`)
- 繁体中文 (`zh-hk`)
- 英文 (`en-us`)

## 文件结构

```
src/
├── locales/           # 翻译文件目录
│   ├── zh-cn.json    # 简体中文翻译
│   ├── zh-hk.json    # 繁体中文翻译
│   └── en-us.json    # 英文翻译
├── lib/
│   └── i18n.ts       # i18next 配置
├── hooks/
│   └── useI18n.ts    # 自定义国际化 hook
└── contexts/
    └── AppContext.tsx # 应用全局状态（包含语言管理）
```

## 使用方法

### 1. 基本用法 - useTranslation

```tsx
import { useTranslation } from "react-i18next";

function MyComponent() {
  const { t } = useTranslation();

  return (
    <div>
      <h1>{t("navigation.forum")}</h1>
      <p>{t("menu.techSupportDesc")}</p>
    </div>
  );
}
```

### 2. 推荐用法 - useI18n (自定义 hook)

```tsx
import { useI18n } from "@/hooks/useI18n";

function MyComponent() {
  const { t, language, changeLanguage, isLanguage } = useI18n();

  return (
    <div>
      <h1>{t("navigation.forum")}</h1>
      <p>当前语言: {language}</p>

      {/* 语言切换按钮 */}
      <button onClick={() => changeLanguage("zh-cn")}>
        简体中文 {isLanguage("zh-cn") && "✓"}
      </button>
      <button onClick={() => changeLanguage("zh-hk")}>
        繁體中文 {isLanguage("zh-hk") && "✓"}
      </button>
      <button onClick={() => changeLanguage("en-us")}>
        English {isLanguage("en-us") && "✓"}
      </button>
    </div>
  );
}
```

### 3. 在 AppContext 中管理语言

```tsx
import { useApp } from "@/contexts/AppContext";

function LanguageSettings() {
  const { language, setLanguage } = useApp();

  const handleLanguageChange = (newLang) => {
    setLanguage(newLang); // 自动同步到 i18next
  };

  return (
    <select
      value={language}
      onChange={(e) => handleLanguageChange(e.target.value)}
    >
      <option value="zh-cn">简体中文</option>
      <option value="zh-hk">繁體中文</option>
      <option value="en-us">English</option>
    </select>
  );
}
```

## 翻译文件结构

每个语言文件都采用相同的嵌套结构：

```json
{
  "navigation": {
    "forum": "论坛",
    "courseReview": "课程评价",
    "more": "更多",
    "about": "关于",
    "language": "语言"
  },
  "menu": {
    "techSupport": "技术支持",
    "techSupportDesc": "获取技术问题帮助",
    "featureRequests": "功能建议",
    "featureRequestsDesc": "建议新功能和改进"
  },
  "search": {
    "placeholder": "输入搜索..."
  },
  "auth": {
    "login": "登录",
    "logout": "登出",
    "profile": "个人资料",
    "settings": "设置"
  }
}
```

## 添加新翻译

1. **添加翻译 key**: 在所有语言文件中添加相同的 key
2. **使用翻译**: 在组件中使用 `t('namespace.key')` 调用
3. **测试**: 切换语言确保翻译正确显示

### 示例：添加新的错误消息

1. 在 `zh-cn.json` 中添加：

```json
{
  "errors": {
    "networkError": "网络连接失败，请重试"
  }
}
```

2. 在 `zh-hk.json` 中添加：

```json
{
  "errors": {
    "networkError": "網絡連接失敗，請重試"
  }
}
```

3. 在 `en-us.json` 中添加：

```json
{
  "errors": {
    "networkError": "Network connection failed, please try again"
  }
}
```

4. 在组件中使用：

```tsx
const { t } = useTranslation();
return <div className="error">{t("errors.networkError")}</div>;
```

## 配置说明

### i18n 配置 (`src/lib/i18n.ts`)

- **fallbackLng**: 默认语言 (`zh-cn`)
- **detection**: 语言检测配置，从 localStorage → navigator → HTML tag 顺序检测
- **debug**: 开发模式下启用调试
- **interpolation**: React 特定配置，关闭转义（React 自动处理）

### AppContext 集成

语言切换时自动：

1. 更新 AppContext 状态
2. 同步到 i18next
3. 保存到 localStorage
4. 触发组件重新渲染

## 最佳实践

1. **命名约定**: 使用 `namespace.key` 格式，如 `navigation.forum`
2. **分组管理**: 相关翻译放在同一命名空间下
3. **保持同步**: 确保所有语言文件包含相同的 key
4. **避免硬编码**: 所有用户可见文本都应使用翻译
5. **测试覆盖**: 为每种语言测试关键功能
6. **性能优化**: i18next 支持懒加载，大型应用可按需加载翻译文件

## 故障排除

### 常见问题

1. **翻译不显示**: 检查 key 是否在所有语言文件中存在
2. **语言不切换**: 确认 AppContext 和 i18next 是否正确同步
3. **初始语言错误**: 检查 localStorage 中的 `language` 值
4. **性能问题**: 考虑拆分大型翻译文件或启用懒加载

### 调试技巧

1. 开启 i18next debug 模式：

```typescript
// src/lib/i18n.ts
debug: true // 在开发模式下看到详细日志
```

2. 检查当前语言：

```tsx
import { useI18n } from "@/hooks/useI18n";
console.log("Current language:", useI18n().language);
```

3. 验证翻译加载：

```tsx
import { useTranslation } from "react-i18next";
const { t, ready } = useTranslation();
console.log("i18n ready:", ready);
```
