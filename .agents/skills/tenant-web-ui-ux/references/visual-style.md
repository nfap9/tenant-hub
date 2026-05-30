# 视觉风格规范

## 设计令牌（Design Tokens）

所有视觉值必须通过设计令牌引用，**禁止硬编码颜色或间距**。

### CSS 自定义属性（`:root`）

在全局样式或工具类中使用：

```css
:root {
  /* 主色 */
  --th-primary: #2563eb;
  --th-primary-light: #3b82f6;
  --th-primary-dark: #1d4ed8;
  --th-accent: #2563eb;
  --th-accent-light: #60a5fa;

  /* 背景 */
  --th-bg: #f3f4f6;
  --th-bg-elevated: #ffffff;
  --th-surface: #ffffff;
  --th-surface-hover: #f3f4f6;

  /* 文字 */
  --th-foreground: #1f2937;
  --th-foreground-muted: #6b7280;
  --th-foreground-subtle: #9ca3af;

  /* 边框 */
  --th-border: #e5e7eb;
  --th-border-light: #f3f4f6;

  /* 状态色 */
  --th-danger: #dc2626;
  --th-danger-bg: #fef2f2;
  --th-success: #22c55e;
  --th-success-bg: #f0fdf4;
  --th-warning: #ea580c;
  --th-warning-bg: #fff7ed;

  /* 阴影 */
  --th-shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.06);
  --th-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
  --th-shadow-md:
    0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
  --th-shadow-lg:
    0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);

  /* 圆角 */
  --th-radius-sm: 6px;
  --th-radius: 8px;
  --th-radius-lg: 12px;
  --th-radius-xl: 16px;

  /* 字体 */
  --th-font-heading: 'Poppins', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  --th-font-body: 'Open Sans', 'PingFang SC', 'Microsoft YaHei', sans-serif;

  /* 间距 */
  --th-space-4: 4px;
  --th-space-5: 8px;
  --th-space-6: 12px;
  --th-space-7: 16px;
  --th-space-8: 20px;
  --th-space-9: 24px;
  --th-space-10: 32px;
}
```

### SCSS 变量

在模块样式文件中使用：

```scss
@use '@/styles/variables' as *;
@use '@/styles/mixins' as *;

.my-component {
  color: $th-primary;
  background: $th-surface;
}
```

## Ant Design 全局覆盖

项目的 Ant Design 风格通过 `global.scss` 统一覆盖，**不要**在单个组件中覆盖 Ant Design 的默认样式。

关键覆盖项：

- `ant-card`：统一阴影和边框
- `ant-tabs-nav`：底部边框分隔
- `ant-btn-primary`：品牌主色
- `ant-tag`：圆角调整

## 颜色使用规范

| 场景              | 颜色值    | 使用方式                        |
| ----------------- | --------- | ------------------------------- |
| 主操作按钮        | `#2563eb` | `type="primary"`                |
| 成功状态/正向数据 | `#22c55e` | `color="success"` / Tag         |
| 警告状态          | `#ea580c` | `color="warning"` / Tag         |
| 危险/删除操作     | `#dc2626` | `danger` prop / `color="error"` |
| 页面背景          | `#f3f4f6` | 由 `global.scss` 自动设置       |
| 卡片背景          | `#ffffff` | Ant Card 默认                   |
| 主文字            | `#1f2937` | 默认                            |
| 次要文字          | `#6b7280` | `.text-muted`                   |
| 占位/提示文字     | `#9ca3af` | `.text-subtle`                  |
| 边框              | `#e5e7eb` | `var(--th-border)`              |

## 间距规范

| Token           | 值   | 典型使用场景                 |
| --------------- | ---- | ---------------------------- |
| `--th-space-5`  | 8px  | 卡片内小间距、图标与文字间距 |
| `--th-space-6`  | 12px | 卡片内边距（small card）     |
| `--th-space-7`  | 16px | 常规内边距、栅格 gutter      |
| `--th-space-8`  | 20px | 区块间距                     |
| `--th-space-9`  | 24px | 卡片外间距、section 间距     |
| `--th-space-10` | 32px | 大模块间距                   |

**常用 utility class 间距：**

- `.mb-16` = `margin-bottom: 16px`
- `.mb-28` = `margin-bottom: 28px`
- `.mt-16` = `margin-top: 16px`
- `.mt-20` = `margin-top: 20px`
- `.p-64` = `padding: 64px`

## SCSS Module 规范

1. **文件名**：`PageName.module.scss`
2. **导入令牌**：
   ```scss
   @use '@/styles/variables' as *;
   @use '@/styles/mixins' as *;
   ```
3. **类名命名**：使用 camelCase 或 kebab-case，与组件内 `styles.xxx` 对应：
   ```scss
   .filter-bar { ... }
   .card-title { ... }
   .expense-amount { ... }
   ```
4. **禁止**：不要在模块中写死颜色值，始终使用 `$th-*` 变量或 `var(--th-*)`。
