# AppContext - 应用全局状态管理

AppContext 是应用的全局状态管理器，替代了原有的 AuthContext，提供更全面的状态管理功能。

## 功能特性

### 🔐 用户认证状态

- 用户登录/登出
- 认证状态持久化（localStorage）
- 向后兼容的认证 API

### 🎨 主题管理

- 支持三种主题模式：`light`、`dark`、`system`
- 自动监听系统主题变化
- 主题设置持久化

### 🌐 国际化支持

- 语言切换：简体中文(`zh-cn`)、繁体中文(`zh-hk`)、英文(`en-us`)
- 语言设置持久化
- 导航栏集成语言切换器

### ⏳ 加载状态管理

- 认证加载状态（`isLoading`）
- 全局加载状态（`globalLoading`）

## 使用方法

### 基础用法

```tsx
import { useApp } from "@/contexts/AppContext";

function MyComponent() {
  const {
    user,
    isLoggedIn,
    theme,
    setTheme,
    language,
    setLanguage,
    globalLoading,
    setGlobalLoading,
  } = useApp();

  return (
    <div>
      {/* 用户状态 */}
      {isLoggedIn ? `欢迎，${user?.name}` : "请登录"}

      {/* 主题切换 */}
      <button onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
        切换主题
      </button>

      {/* 语言切换 */}
      <button onClick={() => setLanguage(language === "zh" ? "en" : "zh")}>
        切换语言
      </button>

      {/* 全局加载状态 */}
      {globalLoading && <div>加载中...</div>}
    </div>
  );
}
```

### 向后兼容的认证 Hook

对于现有的认证相关代码，可以继续使用 `useAuth()` hook：

```tsx
import { useAuth } from "@/contexts/AppContext";

function LoginButton() {
  const { user, isLoggedIn, login, logout } = useAuth();

  // 现有代码无需修改
  return (
    <div>
      {isLoggedIn ? (
        <button onClick={logout}>登出</button>
      ) : (
        <button onClick={() => login(userData, token)}>登录</button>
      )}
    </div>
  );
}
```

## 类型定义

### AppContextType

```typescript
export interface AppContextType {
  // 用户认证状态
  user: User | null;
  isLoggedIn: boolean;
  login: (userData: User, token: string) => void;
  logout: () => void;

  // 主题设置
  theme: ThemeMode; // 'light' | 'dark' | 'system'
  setTheme: (theme: ThemeMode) => void;

  // 语言设置
  language: Language; // 'zh-cn' | 'zh-hk' | 'en-us'
  setLanguage: (language: Language) => void;

  // 加载状态
  isLoading: boolean; // 认证加载状态
  globalLoading: boolean; // 全局加载状态
  setGlobalLoading: (loading: boolean) => void;
}
```

## 数据持久化

AppContext 会自动将以下数据保存到 localStorage：

- 用户信息和认证 token (`user`, `authToken`)
- 主题设置 (`theme`)
- 语言设置 (`language`)

在应用启动时会自动恢复这些设置。

## 主题系统集成

当设置主题为 `system` 时，AppContext 会：

1. 自动检测系统主题偏好
2. 监听系统主题变化
3. 自动应用相应的 CSS 类名到 `document.documentElement`

确保你的 CSS 配置了相应的深色模式样式：

```css
/* 浅色主题（默认） */
:root {
  --background: white;
  --foreground: black;
}

/* 深色主题 */
.dark {
  --background: black;
  --foreground: white;
}
```

## 迁移指南

从原有的 AuthContext 迁移到 AppContext：

### 1. 更新导入

```diff
- import { useAuth } from '@/contexts/AuthContext';
+ import { useAuth } from '@/contexts/AppContext';
```

### 2. 更新 Provider

```diff
- import { AuthProvider } from '@/contexts/AuthContext';
+ import { AppProvider } from '@/contexts/AppContext';

- <AuthProvider>
+ <AppProvider>
    {children}
- </AuthProvider>
+ </AppProvider>
```

### 3. 使用新功能

认证相关功能保持不变，新增的功能可以通过 `useApp()` hook 访问：

```tsx
import { useApp } from "@/contexts/AppContext";

function MyComponent() {
  // 获取新功能
  const { theme, setTheme, language, setLanguage } = useApp();

  // 认证功能保持不变
  const { user, isLoggedIn } = useApp(); // 或继续使用 useAuth()
}
```

## 最佳实践

1. **主题切换**：建议在设置页面提供主题选择器，包含系统跟随选项
2. **语言切换**：建议在导航栏或设置页面提供语言切换按钮
3. **全局加载**：用于 API 请求、页面跳转等需要显示加载状态的场景
4. **错误处理**：AppContext 会在初始化失败时自动清理损坏的数据
