# WeChat Mini Program Replacement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the React Native mobile app (`apps/mobile`) with a WeChat Mini Program (`apps/wxapp`) built on Taro 4 + React 18, maximizing code reuse from the existing RN business logic while rewriting UI components for the mini-program runtime.

**Architecture:**
- **Framework:** Taro 4.0 + React 18 + TypeScript
- **Styling:** SCSS + CSS Variables mapped from existing `theme/tokens.ts`
- **State:** Pure React Hooks (no Redux/Zustand), same pattern as RN app
- **Network:** Reuse existing `mobileApi` logic, swap `fetch` for `Taro.request`
- **Storage:** Replace `localStorage` with `Taro.getStorageSync` / `wx.getStorageSync`
- **UI:** Self-built atomic components matching existing RN design system (Button, Card, Input, Badge, Icon, EmptyState, Pressable)

**Backend Impact:** Zero changes required. The new mini-program consumes the same RESTful API (`/api/*`).

---

## Files

- **Create:** `apps/wxapp/` entire project scaffold (Taro init + config + source files)
- **Create:** `apps/wxapp/src/api/client.ts` — HTTP client wrapping `Taro.request`
- **Create:** `apps/wxapp/src/utils/storage.ts` — `localStorage` replacement
- **Create:** `apps/wxapp/src/theme/tokens.scss` — CSS Variables from existing `theme/tokens.ts`
- **Create:** `apps/wxapp/src/components/ui/` — 6 atomic UI components
- **Create:** `apps/wxapp/src/components/TaskSheet.tsx` — bottom sheet / dialog layer
- **Create:** `apps/wxapp/src/components/Toast.tsx` — global toast notification
- **Create:** `apps/wxapp/src/hooks/useAppSession.ts` — session/org/member state management
- **Create:** `apps/wxapp/src/pages/*` — all business pages
- **Modify:** `pnpm-workspace.yaml` — add `apps/wxapp` to workspaces
- **Modify:** Root `package.json` — add `dev:wxapp` and `build:wxapp` scripts

---

## Phase 1: Infrastructure Scaffold (Days 1–3)

### Task 1: Initialize Taro Project

- [ ] **Step 1: Create Taro project via CLI**

Run in repo root:

```bash
cd apps
npx @tarojs/cli@4 init wxapp
```

When prompted:
- Project name: `wxapp`
- Framework: **React**
- TypeScript: **Yes**
- CSS pre-processor: **Sass**
- Template source: **Gitee** (or **Github**)
- Template: **default**

- [ ] **Step 2: Verify project boots**

```bash
cd wxapp
pnpm install
pnpm dev:weapp
```

Open WeChat DevTools, import `apps/wxapp/dist/`. Expected: default Taro welcome page renders.

- [ ] **Step 3: Add to monorepo workspace**

In root `pnpm-workspace.yaml`, append:

```yaml
packages:
  - "apps/*"
```

If already present (it is), verify `apps/wxapp` is covered.

In root `package.json`, add scripts:

```json
{
  "scripts": {
    "dev:wxapp": "pnpm --filter @tenant-hub/wxapp dev:weapp",
    "build:wxapp": "pnpm --filter @tenant-hub/wxapp build:weapp"
  }
}
```

Update `apps/wxapp/package.json` name to `@tenant-hub/wxapp`.

- [ ] **Step 4: Configure Taro for monorepo**

In `apps/wxapp/config/index.js`, ensure `alias` resolves `@/` to `src/`:

```js
const config = {
  projectName: 'wxapp',
  date: '2026-5-12',
  designWidth: 750,
  deviceRatio: {
    640: 2.34 / 2,
    750: 1,
    828: 1.81 / 2
  },
  sourceRoot: 'src',
  outputRoot: 'dist',
  plugins: [],
  defineConstants: {},
  alias: {
    '@': path.resolve(__dirname, '..', 'src')
  },
  copy: {
    patterns: [],
    options: {}
  },
  framework: 'react',
  compiler: 'webpack5',
  mini: {
    postcss: {
      pxtransform: {
        enable: true,
        config: {}
      }
    }
  }
};
```

- [ ] **Step 5: Add TypeScript strict config**

Ensure `apps/wxapp/tsconfig.json` extends root base:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["ES2017", "DOM"],
    "jsx": "react-jsx",
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["./src", "./types"]
}
```

---

### Task 2: Theme System (CSS Variables from Tokens)

- [ ] **Step 1: Map existing tokens to CSS Variables**

Create `apps/wxapp/src/theme/tokens.scss`:

```scss
// Brand
--color-primary: #0d9488;
--color-primary-dark: #115e59;
--color-primary-light: #ccfbf1;
--color-primary-lighter: #e6fffa;
--color-primary-lightest: #f0fdfa;

// Accent
--color-accent: #f59e0b;

// Backgrounds
--color-background: #f8fafc;
--color-surface: #ffffff;
--color-surface-warm: #fafaf9;

// Text
--color-text: #0f172a;
--color-text-secondary: #334155;
--color-text-muted: #64748b;
--color-text-placeholder: #94a3b8;

// Status
--color-success: #10b981;
--color-success-light: #d1fae5;
--color-warning: #f59e0b;
--color-warning-light: #fef3c7;
--color-danger: #ef4444;
--color-danger-light: #fee2e2;
--color-neutral: #64748b;
--color-neutral-light: #f1f5f9;

// Borders
--color-border: #e2e8f0;
--color-border-light: #f1f5f9;
--color-border-lighter: #f8fafc;

// Spacing (4px base grid)
--spacing-0: 0;
--spacing-0-5: 2rpx;
--spacing-1: 4rpx;
--spacing-1-5: 6rpx;
--spacing-2: 8rpx;
--spacing-2-5: 10rpx;
--spacing-3: 12rpx;
--spacing-3-5: 14rpx;
--spacing-4: 16rpx;
--spacing-4-5: 18rpx;
--spacing-5: 20rpx;
--spacing-6: 24rpx;
--spacing-7: 28rpx;
--spacing-8: 32rpx;
--spacing-10: 40rpx;
--spacing-12: 48rpx;
--spacing-16: 64rpx;
--spacing-20: 80rpx;
--spacing-24: 96rpx;

// Typography
--font-size-hero: 34rpx;
--font-size-h1: 30rpx;
--font-size-h2: 24rpx;
--font-size-h3: 21rpx;
--font-size-h4: 18rpx;
--font-size-h5: 17rpx;
--font-size-h6: 16rpx;
--font-size-body-large: 15rpx;
--font-size-body: 14rpx;
--font-size-body-small: 13rpx;
--font-size-label: 13rpx;
--font-size-label-small: 12rpx;
--font-size-caption: 11rpx;
--font-size-stat: 20rpx;
--font-size-metric: 24rpx;

// Line heights
--line-height-hero: 40rpx;
--line-height-h1: 36rpx;
--line-height-h2: 30rpx;
--line-height-h3: 26rpx;
--line-height-h4: 24rpx;
--line-height-h5: 22rpx;
--line-height-h6: 22rpx;
--line-height-body-large: 21rpx;
--line-height-body: 19rpx;
--line-height-body-small: 18rpx;
--line-height-label: 18rpx;
--line-height-label-small: 16rpx;
--line-height-caption: 15rpx;
--line-height-stat: 26rpx;
--line-height-metric: 30rpx;

// Font weights
--font-weight-normal: 400;
--font-weight-bold: 700;

// Radii
--radius-none: 0;
--radius-sm: 4rpx;
--radius-md: 8rpx;
--radius-lg: 12rpx;
--radius-xl: 16rpx;
--radius-2xl: 20rpx;
--radius-full: 999rpx;

// Shadows (CSS box-shadow)
--shadow-subtle: 0 2rpx 8rpx rgba(16, 37, 34, 0.04);
--shadow-card: 0 4rpx 12rpx rgba(16, 37, 34, 0.06);
--shadow-elevated: 0 8rpx 16rpx rgba(16, 37, 34, 0.10);
--shadow-float: 0 12rpx 20rpx rgba(16, 37, 34, 0.14);

// Layout
--layout-tab-bar-height: 64rpx;
--layout-header-height: 56rpx;
--layout-content-bottom-padding: 92rpx;
--layout-max-modal-width: 320rpx;
```

- [ ] **Step 2: Import tokens globally**

In `apps/wxapp/src/app.scss`:

```scss
page {
  /* Inject all CSS variables */
  @import "./theme/tokens.scss";
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  background-color: var(--color-background);
  color: var(--color-text);
  font-size: var(--font-size-body);
  line-height: var(--line-height-body);
}
```

- [ ] **Step 3: Verify tokens render**

Create a temporary test page `apps/wxapp/src/pages/test/index.tsx`:

```tsx
import { View, Text } from '@tarojs/components';

export default function TestPage() {
  return (
    <View style={{ padding: 'var(--spacing-6)' }}>
      <Text style={{ color: 'var(--color-primary)', fontSize: 'var(--font-size-h2)' }}>
        Primary Color Test
      </Text>
    </View>
  );
}
```

Add to `app.config.ts` pages array, run `pnpm dev:wxapp`, verify color renders as teal (#0d9488).

---

### Task 3: Storage Layer (localStorage Replacement)

- [ ] **Step 1: Create storage utility**

Create `apps/wxapp/src/utils/storage.ts`:

```typescript
const SESSION_KEY = "tenantHubSession";

export const storage = {
  getItem<T>(key: string): T | undefined {
    try {
      const raw = wx.getStorageSync(key);
      return raw ? (JSON.parse(raw) as T) : undefined;
    } catch {
      return undefined;
    }
  },

  setItem<T>(key: string, value: T): void {
    try {
      wx.setStorageSync(key, JSON.stringify(value));
    } catch {
      // Silent fail
    }
  },

  removeItem(key: string): void {
    try {
      wx.removeStorageSync(key);
    } catch {
      // Silent fail
    }
  },

  // Convenience aliases for session
  getSession<T>(): T | undefined {
    return this.getItem<T>(SESSION_KEY);
  },

  setSession<T>(value: T): void {
    this.setItem(SESSION_KEY, value);
  },

  clearSession(): void {
    this.removeItem(SESSION_KEY);
  }
};
```

- [ ] **Step 2: Verify storage works in WeChat DevTools**

In `app.tsx` `componentDidShow` (or `useEffect`):

```tsx
import { storage } from './utils/storage';

// Test round-trip
storage.setItem('test', { foo: 'bar' });
const result = storage.getItem<{ foo: string }>('test');
console.log('Storage test:', result);
```

Open DevTools Console, expected: `Storage test: {foo: "bar"}`.

---

### Task 4: HTTP Client (Taro.request Wrapper)

- [ ] **Step 1: Reuse existing mobileApi logic**

Create `apps/wxapp/src/api/client.ts`:

```typescript
import Taro from '@tarojs/taro';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000/api';

export type ApiOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
};

export async function apiClient<T>(
  path: string,
  token?: string,
  options: ApiOptions = {}
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;

  const res = await Taro.request({
    url,
    method: options.method || 'GET',
    data: options.body,
    header: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });

  const data = res.data as { data?: T; error?: string };

  if (res.statusCode >= 400 || data.error) {
    throw new Error(data.error || `HTTP ${res.statusCode}`);
  }

  return data.data as T;
}
```

- [ ] **Step 2: Add environment config**

Create `apps/wxapp/src/constants/config.ts`:

```typescript
export const API_BASE_URL = 'http://localhost:4000/api';
// Production: replace with actual domain
```

Note: WeChat Mini Program requires HTTPS in production and must add the API domain to `request合法域名` in WeChat MP Admin.

---

### Task 5: Atomic UI Components

Create `apps/wxapp/src/components/ui/` with these 6 components, matching existing RN component APIs:

- [ ] **Step 1: Button**

Create `apps/wxapp/src/components/ui/Button.tsx`:

```tsx
import { View, Text } from '@tarojs/components';
import './Button.scss';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'default' | 'small';

export type ButtonProps = {
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  className?: string;
};

export function Button({
  children,
  variant = 'primary',
  size = 'default',
  disabled,
  loading,
  onClick,
  className = ''
}: ButtonProps) {
  const baseClass = `btn btn--${variant} btn--${size}`;
  const stateClass = `${disabled ? ' btn--disabled' : ''}${loading ? ' btn--loading' : ''}`;

  return (
    <View
      className={`${baseClass}${stateClass} ${className}`}
      onClick={!disabled && !loading ? onClick : undefined}
    >
      <Text className="btn__text">{loading ? '加载中...' : children}</Text>
    </View>
  );
}
```

Create `apps/wxapp/src/components/ui/Button.scss`:

```scss
.btn {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  padding: var(--spacing-3) var(--spacing-5);
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-bold);
  transition: opacity 0.15s;

  &--primary {
    background-color: var(--color-primary);
    color: #fff;
  }
  &--secondary {
    background-color: var(--color-surface);
    color: var(--color-text);
    border: 1rpx solid var(--color-border);
  }
  &--ghost {
    background-color: transparent;
    color: var(--color-primary);
  }
  &--danger {
    background-color: var(--color-danger);
    color: #fff;
  }
  &--small {
    padding: var(--spacing-2) var(--spacing-4);
    font-size: var(--font-size-body-small);
  }
  &--disabled {
    opacity: 0.5;
  }
  &:active:not(&--disabled) {
    opacity: 0.85;
  }
}
.btn__text {
  color: inherit;
}
```

- [ ] **Step 2: Card**

Create `apps/wxapp/src/components/ui/Card.tsx`:

```tsx
import { View, Text } from '@tarojs/components';
import './Card.scss';

export type CardVariant = 'default' | 'warm' | 'outline';

export type CardProps = {
  children: React.ReactNode;
  variant?: CardVariant;
  padding?: 'sm' | 'md' | 'lg';
  title?: string;
  subtitle?: string;
  headerAction?: React.ReactNode;
  onClick?: () => void;
  className?: string;
};

export function Card({
  children,
  variant = 'default',
  padding = 'md',
  title,
  subtitle,
  headerAction,
  onClick,
  className = ''
}: CardProps) {
  const base = `card card--${variant} card--padding-${padding}`;
  return (
    <View className={`${base} ${className}`} onClick={onClick}>
      {(title || headerAction) && (
        <View className="card__header">
          <View className="card__title-block">
            {title && <Text className="card__title">{title}</Text>}
            {subtitle && <Text className="card__subtitle">{subtitle}</Text>}
          </View>
          {headerAction && <View>{headerAction}</View>}
        </View>
      )}
      <View className="card__body">{children}</View>
    </View>
  );
}
```

- [ ] **Step 3: Input**

Create `apps/wxapp/src/components/ui/Input.tsx`:

```tsx
import { View, Input as TaroInput, Text } from '@tarojs/components';
import './Input.scss';

export type InputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  type?: 'text' | 'number' | 'digit' | 'idcard';
  multiline?: boolean;
  error?: string;
};

export function Input({
  value,
  onChange,
  placeholder,
  label,
  type = 'text',
  multiline,
  error
}: InputProps) {
  return (
    <View className={`input-wrapper ${error ? 'input-wrapper--error' : ''}`}>
      {label && <Text className="input__label">{label}</Text>}
      {multiline ? (
        <TaroInput
          className="input input--multiline"
          value={value}
          placeholder={placeholder}
          type="text"
          onInput={(e) => onChange(e.detail.value)}
        />
      ) : (
        <TaroInput
          className="input"
          value={value}
          placeholder={placeholder}
          type={type}
          onInput={(e) => onChange(e.detail.value)}
        />
      )}
      {error && <Text className="input__error">{error}</Text>}
    </View>
  );
}
```

- [ ] **Step 4: Badge**

Create `apps/wxapp/src/components/ui/Badge.tsx`:

```tsx
import { View, Text } from '@tarojs/components';
import './Badge.scss';

export type Tone = 'success' | 'warning' | 'danger' | 'neutral' | 'primary';

export type BadgeProps = {
  children: React.ReactNode;
  tone?: Tone;
};

export function Badge({ children, tone = 'neutral' }: BadgeProps) {
  return (
    <View className={`badge badge--${tone}`}>
      <Text className="badge__text">{children}</Text>
    </View>
  );
}
```

- [ ] **Step 5: Icon (iconfont)**

Create `apps/wxapp/src/components/ui/Icon.tsx`:

```tsx
import { Text } from '@tarojs/components';

export type IconName =
  | 'home' | 'home-outline'
  | 'bed' | 'bed-outline'
  | 'wallet' | 'wallet-outline'
  | 'business' | 'business-outline'
  | 'grid' | 'grid-outline'
  | 'add' | 'close' | 'checkmark' | 'trash' | 'create' | 'cash'
  | 'speedometer' | 'arrow-back' | 'chevron-down' | 'person';

export type IconProps = {
  name: IconName;
  size?: number;
  color?: string;
};

// Map to unicode characters from iconfont
const ICON_MAP: Record<IconName, string> = {
  'home': '\ue600',
  'home-outline': '\ue601',
  'bed': '\ue602',
  'bed-outline': '\ue603',
  'wallet': '\ue604',
  'wallet-outline': '\ue605',
  'business': '\ue606',
  'business-outline': '\ue607',
  'grid': '\ue608',
  'grid-outline': '\ue609',
  'add': '\ue60a',
  'close': '\ue60b',
  'checkmark': '\ue60c',
  'trash': '\ue60d',
  'create': '\ue60e',
  'cash': '\ue60f',
  'speedometer': '\ue610',
  'arrow-back': '\ue611',
  'chevron-down': '\ue612',
  'person': '\ue613'
};

export function Icon({ name, size = 20, color = 'var(--color-text)' }: IconProps) {
  return (
    <Text
      className="iconfont"
      style={{ fontSize: `${size}rpx`, color, fontFamily: 'iconfont' }}
    >
      {ICON_MAP[name]}
    </Text>
  );
}
```

Note: Developer must upload iconfont files to `apps/wxapp/src/assets/iconfont/` and import in `app.scss`:

```scss
@import "./assets/iconfont/iconfont.scss";
```

- [ ] **Step 6: EmptyState**

Create `apps/wxapp/src/components/ui/EmptyState.tsx`:

```tsx
import { View, Text } from '@tarojs/components';
import './EmptyState.scss';

export type EmptyStateProps = {
  emoji?: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
};

export function EmptyState({ emoji = '📭', title, subtitle, action }: EmptyStateProps) {
  return (
    <View className="empty-state">
      <Text className="empty-state__emoji">{emoji}</Text>
      <Text className="empty-state__title">{title}</Text>
      {subtitle && <Text className="empty-state__subtitle">{subtitle}</Text>}
      {action && <View className="empty-state__action">{action}</View>}
    </View>
  );
}
```

- [ ] **Step 7: Index export**

Create `apps/wxapp/src/components/ui/index.ts`:

```typescript
export { Button } from './Button';
export { Card } from './Card';
export { Input } from './Input';
export { Badge } from './Badge';
export { Icon } from './Icon';
export { EmptyState } from './EmptyState';
```

- [ ] **Step 8: Visual verification**

Create a temporary showcase page `pages/showcase/index.tsx` rendering all 6 components with different variants. Run in WeChat DevTools and visually verify against the RN app.

---

### Task 6: Shared Components

- [ ] **Step 1: TaskSheet (bottom drawer / dialog)**

Create `apps/wxapp/src/components/TaskSheet.tsx`:

```tsx
import { View, Text } from '@tarojs/components';
import { useEffect, useState } from 'react';
import './TaskSheet.scss';

export type TaskSheetVariant = 'drawer' | 'dialog';

export type TaskSheetProps = {
  visible: boolean;
  variant?: TaskSheetVariant;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export function TaskSheet({
  visible,
  variant = 'drawer',
  title,
  subtitle,
  onClose,
  children,
  footer
}: TaskSheetProps) {
  const [show, setShow] = useState(false);
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    if (visible) {
      setShow(true);
      requestAnimationFrame(() => setAnimated(true));
    } else {
      setAnimated(false);
      const timer = setTimeout(() => setShow(false), 300);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  if (!show) return null;

  const isDialog = variant === 'dialog';

  return (
    <View className={`task-sheet ${animated ? 'task-sheet--active' : ''}`}>
      <View className="task-sheet__overlay" onClick={onClose} />
      <View className={`task-sheet__content task-sheet__content--${variant}`}>
        <View className="task-sheet__header">
          <View className="task-sheet__title-block">
            <Text className="task-sheet__title">{title}</Text>
            {subtitle && <Text className="task-sheet__subtitle">{subtitle}</Text>}
          </View>
          <View className="task-sheet__close" onClick={onClose}>
            <Text>关闭</Text>
          </View>
        </View>
        <View className="task-sheet__body">{children}</View>
        {footer && <View className="task-sheet__footer">{footer}</View>}
      </View>
    </View>
  );
}
```

Create `apps/wxapp/src/components/TaskSheet.scss`:

```scss
.task-sheet {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  pointer-events: none;

  &--active {
    pointer-events: auto;

    .task-sheet__overlay {
      opacity: 1;
    }
    .task-sheet__content--drawer {
      transform: translateY(0);
    }
    .task-sheet__content--dialog {
      opacity: 1;
      transform: scale(1);
    }
  }

  &__overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(16, 37, 34, 0.42);
    opacity: 0;
    transition: opacity 0.3s;
  }

  &__content {
    position: relative;
    background-color: var(--color-surface);
    display: flex;
    flex-direction: column;
    transition: transform 0.3s, opacity 0.3s;

    &--drawer {
      margin-top: auto;
      max-height: 90vh;
      min-height: 62vh;
      border-radius: var(--radius-lg) var(--radius-lg) 0 0;
      transform: translateY(100%);
    }

    &--dialog {
      margin: auto;
      max-height: 78vh;
      width: calc(100% - var(--spacing-10));
      max-width: var(--layout-max-modal-width);
      border-radius: var(--radius-md);
      opacity: 0;
      transform: scale(0.95);
    }
  }

  &__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: var(--spacing-4);
    border-bottom: 1rpx solid var(--color-border-light);
  }

  &__title-block {
    flex: 1;
  }

  &__title {
    font-size: var(--font-size-h4);
    font-weight: var(--font-weight-bold);
    color: var(--color-text);
  }

  &__subtitle {
    font-size: var(--font-size-body-small);
    color: var(--color-text-muted);
    margin-top: var(--spacing-1);
  }

  &__body {
    flex: 1;
    overflow-y: auto;
    padding: var(--spacing-4);
  }

  &__footer {
    padding: var(--spacing-4);
    border-top: 1rpx solid var(--color-border-light);
    display: flex;
    gap: var(--spacing-3);
  }
}
```

- [ ] **Step 2: Toast**

Create `apps/wxapp/src/components/Toast.tsx`:

```tsx
import Taro from '@tarojs/taro';

export function showToast(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') {
  const iconMap = {
    success: 'success',
    error: 'error',
    warning: 'none',
    info: 'none'
  };

  Taro.showToast({
    title: message,
    icon: iconMap[type] as 'success' | 'error' | 'none',
    duration: 3000
  });
}
```

---

### Task 7: App Config & Entry

- [ ] **Step 1: Configure app.config.ts**

Create `apps/wxapp/src/app.config.ts`:

```typescript
export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/rooms/index',
    'pages/bills/index',
    'pages/apartments/index',
    'pages/settings/index',
    'pages/login/index',
    // Sub-pages
    'pages/settings/leases',
    'pages/settings/organization',
    'pages/settings/account',
    'pages/settings/plan'
  ],
  tabBar: {
    color: '#94a3b8',
    selectedColor: '#0d9488',
    backgroundColor: '#ffffff',
    borderStyle: 'white',
    list: [
      { pagePath: 'pages/index/index', text: '首页', iconPath: 'assets/icons/home.png', selectedIconPath: 'assets/icons/home-active.png' },
      { pagePath: 'pages/rooms/index', text: '房间', iconPath: 'assets/icons/bed.png', selectedIconPath: 'assets/icons/bed-active.png' },
      { pagePath: 'pages/bills/index', text: '账单', iconPath: 'assets/icons/wallet.png', selectedIconPath: 'assets/icons/wallet-active.png' },
      { pagePath: 'pages/apartments/index', text: '公寓', iconPath: 'assets/icons/business.png', selectedIconPath: 'assets/icons/business-active.png' },
      { pagePath: 'pages/settings/index', text: '更多', iconPath: 'assets/icons/grid.png', selectedIconPath: 'assets/icons/grid-active.png' }
    ]
  },
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#115e59',
    navigationBarTitleText: 'Tenant Hub',
    navigationBarTextStyle: 'white'
  }
});
```

Note: TabBar icons must be placed in `apps/wxapp/src/assets/icons/` and referenced with relative paths.

- [ ] **Step 2: Create app.tsx entry**

Create `apps/wxapp/src/app.tsx`:

```tsx
import { useLaunch, useShow } from '@tarojs/taro';
import { storage } from './utils/storage';
import './app.scss';

function App({ children }: { children: React.ReactNode }) {
  useLaunch(() => {
    console.log('App launched');
  });

  useShow(() => {
    // Verify session exists on app show
    const session = storage.getSession<{ token: string }>();
    if (!session) {
      // Will redirect to login in page guards
    }
  });

  return <>{children}</>;
}

export default App;
```

---

## Phase 2: Core Pages Development (Days 4–10)

Implement pages in this order (least complex → most complex):

### Task 8: Login Page

- [ ] **Step 1: Create login page**

`apps/wxapp/src/pages/login/index.tsx`:

Port existing `LoginScreen.tsx` logic to Taro:
- Phone + password / phone + OTP tabs
- Session storage via `storage.setSession()`
- On success, `Taro.switchTab({ url: '/pages/index/index' })`

- [ ] **Step 2: Add page guard logic**

In each tab page's `useEffect` / `useLoad`:

```tsx
import { useLoad, redirectTo } from '@tarojs/taro';
import { storage } from '../../utils/storage';

useLoad(() => {
  const session = storage.getSession<{ token: string }>();
  if (!session?.token) {
    redirectTo({ url: '/pages/login/index' });
  }
});
```

- [ ] **Step 3: End-to-end test login flow**

Run `pnpm dev:wxapp`, open WeChat DevTools, verify:
1. Unauthenticated user is redirected to login
2. Login with valid credentials stores session
3. Authenticated user lands on home tab

---

### Task 9: Settings Page + Sub-pages

- [ ] **Step 1: Port SettingsScreen menu shell**

`apps/wxapp/src/pages/settings/index.tsx`:

Reuse existing menu items layout. Each item uses `Taro.navigateTo` to sub-page.

- [ ] **Step 2: Port 4 sub-pages**

- `pages/settings/leases.tsx` — All leases list with search/filter
- `pages/settings/organization.tsx` — Org info, members, invites
- `pages/settings/account.tsx` — Change password
- `pages/settings/plan.tsx` — Plan purchase

Each sub-page reuses existing data fetching logic (`useEffect` + `apiClient`).

---

### Task 10: Apartments Page

- [ ] **Step 1: Port ApartmentsScreen with mode switching**

Since mini-program uses page navigation (not in-page mode state), convert:
- `mode = "list"` → main `pages/apartments/index`
- `mode = "detail"` → `pages/apartments/detail?id=xxx`
- `mode = "edit"` / `"create"` → `pages/apartments/form?id=xxx` (edit) or without id (create)

- [ ] **Step 2: Port room management within apartment detail**

- Single room add → `TaskSheet variant="dialog"`
- Batch room add → `TaskSheet variant="drawer"`
- Room edit → navigate to `pages/rooms/form?id=xxx`

---

### Task 11: Rooms Page

- [ ] **Step 1: Port RoomsScreen list + filter**

Reuse `visibleRooms = useMemo(() => ...)` filtering logic directly.

- [ ] **Step 2: Port lease creation form**

Lease creation form goes into `TaskSheet variant="drawer"` (complex form).

- [ ] **Step 3: Port lease edit**

Navigate to `pages/rooms/lease-edit?id=xxx` (standalone page, form is too complex for dialog).

- [ ] **Step 4: Port lease termination / settlement**

Settlement preview + form in `TaskSheet variant="drawer"`.

---

### Task 12: Bills Page

- [ ] **Step 1: Port BillsScreen 3-tab layout**

Since mini-program `swiper` + `scroll-view` can emulate tab switching, keep the 3-tab UI:
- Tab 1: Unpaid bills + payment recording
- Tab 2: Pending meter readings + CSV import/export
- Tab 3: All bills with search/filter

- [ ] **Step 2: Port payment recording**

Payment form in `TaskSheet variant="dialog"`.

- [ ] **Step 3: Port meter reading entry**

Meter reading form in `TaskSheet variant="dialog"`.

- [ ] **Step 4: Port CSV import/export**

Use `Taro.chooseMessageFile` for file picking, `Taro.openDocument` for export preview.

---

### Task 13: Home Page (Dashboard)

- [ ] **Step 1: Port HomeScreen dashboard**

Reuse all `useMemo` statistics calculations:
- Monthly estimated income / collected / pending
- Occupancy rate
- Top 3 apartments card
- Todo list (overdue bills, pending meter readings, expiring leases, vacant rooms)

- [ ] **Step 2: Port quick action navigation**

Quick actions use `Taro.switchTab` / `Taro.navigateTo` with query params:

```tsx
Taro.switchTab({ url: '/pages/bills/index?tab=unpaid' });
```

---

## Phase 3: Integration & Polish (Days 11–14)

### Task 14: End-to-End Testing

- [ ] **Step 1: Acceptance test checklist**

Run through `docs/acceptance-test-plan.md` items relevant to mobile:
- [ ] Login / logout / session persistence across app restart
- [ ] Organization creation / joining / switching
- [ ] Apartment CRUD
- [ ] Room batch creation
- [ ] Lease creation with bill auto-generation
- [ ] Meter reading entry with auto-billing
- [ ] Bill payment recording
- [ ] Lease termination and settlement
- [ ] Settings sub-pages (leases, org, account, plan)

- [ ] **Step 2: WeChat DevTools specific tests**

- [ ] Test on different device simulators (iPhone / Android various sizes)
- [ ] Test network throttling (slow 3G)
- [ ] Verify all API calls appear in Network panel
- [ ] Verify storage in Storage panel

---

### Task 15: Performance Optimization

- [ ] **Step 1: List virtualization**

For lists > 50 items (bills, leases, rooms), implement virtual scrolling or pagination:

```tsx
// Add pagination to API calls
const [page, setPage] = useState(1);
const [hasMore, setHasMore] = useState(true);

const loadMore = async () => {
  if (!hasMore) return;
  const data = await apiClient<Bill[]>(`/bills?page=${page}&limit=20`, token);
  setBills(prev => [...prev, ...data]);
  setHasMore(data.length === 20);
  setPage(p => p + 1);
};
```

- [ ] **Step 2: Image optimization**

If adding apartment/room photos later:
- Use `lazy-load` on `<Image>` components
- Compress images before upload
- Use CDN for static assets

- [ ] **Step 3: Sub-package splitting**

If total bundle > 1.5MB, split by business domain:

```ts
// app.config.ts
subPackages: [
  {
    root: 'pages/settings/',
    pages: ['leases', 'organization', 'account', 'plan']
  }
]
```

---

### Task 16: WeChat Mini Program Compliance

- [ ] **Step 1: Required configurations**

- [ ] Configure `request合法域名` in WeChat MP Admin (add API domain + HTTPS)
- [ ] Add `privacy.json` if collecting user data (phone number)
- [ ] Prepare privacy policy page
- [ ] Ensure no use of deprecated APIs

- [ ] **Step 2: Submit for review**

- [ ] Build production: `pnpm build:wxapp`
- [ ] Upload in WeChat DevTools
- [ ] Fill app info in MP Admin
- [ ] Submit for WeChat review (1–3 business days)

---

## Task 17: RN App Deprecation

- [ ] **Step 1: Archive mobile app**

- [ ] Update root `package.json` to remove `mobile:*` scripts or mark as deprecated
- [ ] Update CI/CD (`.github/workflows/mobile-ci.yml`) to only trigger on `apps/wxapp/**` changes
- [ ] Update `AGENTS.md` to reflect new architecture

- [ ] **Step 2: Update documentation**

- [ ] Add `apps/wxapp/README.md` with setup / dev / build instructions
- [ ] Update root `README.md` to mention mini-program instead of RN app

---

## Verification

- [ ] **Step 1: TypeScript check**

```bash
pnpm --filter @tenant-hub/wxapp typecheck
```

Expected: pass.

- [ ] **Step 2: Build check**

```bash
pnpm build:wxapp
```

Expected: completes without errors, `apps/wxapp/dist/` contains WeChat Mini Program bundle.

- [ ] **Step 3: Bundle size check**

```bash
ls -lah apps/wxapp/dist/
```

Expected: main package < 2MB, total < 10MB.

- [ ] **Step 4: Functional regression**

All acceptance test items from Task 14 pass in WeChat DevTools.

---

## Appendix A: Component API Specification

All UI components maintain the **same props API** as the existing RN components to minimize cognitive load during migration:

| Component | Prop | Type | Default | Notes |
|-----------|------|------|---------|-------|
| Button | variant | `'primary' \| 'secondary' \| 'ghost' \| 'danger'` | `'primary'` | Same as RN |
| Button | size | `'default' \| 'small'` | `'default'` | Same as RN |
| Button | onClick | `() => void` | — | Renamed from `onPress` |
| Card | variant | `'default' \| 'warm' \| 'outline'` | `'default'` | Same as RN |
| Card | padding | `'sm' \| 'md' \| 'lg'` | `'md'` | Same as RN |
| Card | onClick | `() => void` | — | Renamed from `onPress` |
| Input | onChange | `(value: string) => void` | — | Same callback signature |
| Badge | tone | `'success' \| 'warning' \| 'danger' \| 'neutral' \| 'primary'` | `'neutral'` | Same as RN |
| Icon | name | `IconName` | — | Ionicons names mapped to iconfont |
| EmptyState | emoji | `string` | `'📭'` | Same as RN |
| TaskSheet | variant | `'drawer' \| 'dialog'` | `'drawer'` | Same as RN |
| TaskSheet | onClose | `() => void` | — | Same as RN |

---

## Appendix B: State Management Convention

Continue the existing RN convention: **pure React Hooks, no external state library**.

Pattern for every page:

```tsx
export default function SomePage() {
  // 1. Session / token from storage
  const [token, setToken] = useState<string>();

  // 2. Data state
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);

  // 3. Filter / search state
  const [filter, setFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // 4. Form / modal state
  const [formVisible, setFormVisible] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  // 5. Derived state
  const visibleItems = useMemo(() => {
    let result = items;
    if (filter !== 'ALL') result = result.filter(i => i.status === filter);
    if (searchQuery) result = result.filter(i => i.name.includes(searchQuery));
    return result;
  }, [items, filter, searchQuery]);

  // 6. Effects
  useEffect(() => {
    loadData();
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient<Item[]>('/some-endpoint', token);
      setItems(data);
    } catch (e) {
      showToast(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [token]);

  // ... render
}
```

This pattern is copied verbatim from the existing RN screens and works identically in Taro.
