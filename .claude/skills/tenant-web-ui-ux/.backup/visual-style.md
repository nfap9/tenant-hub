# 视觉样式规范

## 颜色令牌

全站颜色通过 SCSS 变量（`$th-*`）和 CSS 自定义属性（`--th-*`）管理，
定义在 `src/styles/variables` 和 `src/styles/global.scss` 中。
Ant Design `ConfigProvider` 的 `theme.token` 与之同步。

| 用途       | SCSS 变量              | CSS 变量                | 色值      |
| ---------- | ---------------------- | ----------------------- | --------- |
| 主色       | `$th-primary`          | `--th-primary`          | `#0d9488` |
| 主色浅     | `$th-primary-light`    | `--th-primary-light`    | `#14b8a6` |
| 主色深     | `$th-primary-dark`     | `--th-primary-dark`     | `#0f766e` |
| 成功色     | `$th-success`          | `--th-success`          | `#22c55e` |
| 警告色     | `$th-warning`          | `--th-warning`          | `#f59e0b` |
| 危险色     | `$th-danger`           | `--th-danger`           | `#ef4444` |
| 背景       | `$th-background`       | `--th-background`       | `#f8fafc` |
| 表面       | `$th-surface`          | `--th-surface`          | `#ffffff` |
| 前景色     | `$th-foreground`       | `--th-foreground`       | `#0f172a` |
| 前景色弱化 | `$th-foreground-muted` | `--th-foreground-muted` | `#64748b` |
| 边框       | `$th-border`           | `--th-border`           | `#e2e8f0` |
| 边框浅     | `$th-border-light`     | `--th-border-light`     | `#f1f5f9` |

**禁止**：任何位置不得使用渐变色（logo、头像、概览卡片等）。
B 端后台的严肃性要求纯色块，渐变会产生廉价感。

## 布局

| 元素         | 尺寸 / 样式                             |
| ------------ | --------------------------------------- |
| 侧边栏       | 固定 220px，白色背景                    |
| 顶部 Header  | Sticky 定位，白色背景，底部细边框       |
| 主内容区     | 背景色 `$th-background`，padding `24px` |
| 页面最大宽度 | 无限制，内容区自适应                    |

## 圆角与阴影

圆角统一使用 SCSS 变量：

- `$th-radius-sm`: `6px`
- `$th-radius`: `8px`
- `$th-radius-lg`: `12px`
- `$th-radius-xl`: `16px`

阴影使用 `card-elevated` mixin（定义在 `src/styles/mixins`）：

```scss
@include card-elevated;
// 等价于:
// box-shadow: 0 1px 3px rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
```

**为什么**：B 端界面阴影要克制。过强的阴影会让页面显得轻浮，
过弱的阴影又无法区分层级。`card-elevated` 是一个经过校准的中间值。

## 样式文件规范

- 组件级样式使用 `.module.scss`
- 通过 `@use '@/styles/variables' as *` 和 `@use '@/styles/mixins' as *` 引用全局定义
- 公共工具类写在 `global.scss` 中：`.flex-between`、`.text-muted`、`.text-subtle`、`.w-full`、`.mb-16` 等
- 不要在组件样式中写死颜色值，统一使用变量
