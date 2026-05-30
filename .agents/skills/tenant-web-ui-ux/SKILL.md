---
name: tenant-web-ui-ux
description: >
  Tenant Hub Web 管理后台的 UI/UX 设计规范与执行手册。
  在涉及 tenant-web（apps/tenant-web）的任何页面新建、布局修改、样式调整、
  组件使用、交互设计、视觉统一时，**必须先查阅本 skill**。
  触发场景包括但不限于：用户说"新建页面""修改样式""调整布局""统一风格"
  "重构详情页""设计卡片列表""优化表单""改颜色""加按钮""调整间距"等任何 UI 相关请求。
  即使用户没有明确提到 UI/UX 规范，只要涉及 tenant-web 的前端代码变更，
  就应该先查阅本 skill 确保输出符合全站统一风格。
---

# Tenant Hub Web UI/UX 规范

## 概述

Tenant Hub Web（`apps/tenant-web`）采用 **React 18 + Vite + Ant Design 5 + SCSS Modules** 技术栈。本规范从代码实践中提炼，确保所有页面在视觉、交互和代码结构上保持一致。

## 何时查阅本规范

| 场景                 | 查阅内容                                                  |
| -------------------- | --------------------------------------------------------- |
| 新建任何页面         | `references/page-patterns.md`                             |
| 修改/新增组件样式    | `references/visual-style.md` + `references/components.md` |
| 调整布局、间距、卡片 | `references/visual-style.md`                              |
| 添加表单             | `references/page-patterns.md` → 表单页模式                |
| 添加图表             | `references/components.md` → Chart 规范                   |
| 添加列表/表格        | `references/page-patterns.md` → 列表页模式                |
| 调整按钮、操作区     | `references/interaction.md`                               |
| 处理加载/空状态      | `references/interaction.md`                               |

## 核心原则

1. **一致性优先**：复用现有模式和组件，不发明新轮子。
2. **Ant Design 为基**：所有 UI 基于 Ant Design 5，通过 CSS 变量和全局覆盖统一风格。
3. **SCSS Modules 隔离**：页面级样式使用 `.module.scss`，共享样式使用 `@use '@/styles/variables'`。
4. **移动优先响应式**：使用 Ant Design 的 `xs/sm/md/lg` 断点（`Col xs={24} lg={12}`）。
5. **无魔术数字**：颜色、间距、字体全部来自设计令牌（CSS 变量 / SCSS 变量）。

## 设计令牌速查

```scss
// 颜色
--th-primary: #2563eb;
--th-danger: #dc2626;
--th-success: #22c55e;
--th-warning: #ea580c;
--th-foreground: #1f2937;
--th-foreground-muted: #6b7280;
--th-foreground-subtle: #9ca3af;
--th-bg: #f3f4f6;
--th-surface: #ffffff;
--th-border: #e5e7eb;

// 间距（常用）
--th-space-4: 4px;
--th-space-5: 8px;
--th-space-6: 12px;
--th-space-7: 16px;
--th-space-8: 20px;
--th-space-9: 24px;
--th-space-10: 32px;

// 圆角
--th-radius: 8px;
--th-radius-lg: 12px;

// 字体
--th-font-heading: 'Poppins', 'PingFang SC', 'Microsoft YaHei', sans-serif;
```

## 必用工具类

全局可用的 utility classes（定义在 `global.scss`）：

```
.flex-center / .flex-between / .flex-start / .flex-col-center
.text-center / .text-muted / .text-subtle / .text-primary / .text-success / .text-warning / .text-danger
.cursor-pointer / .w-full / .shrink-0
.mt-16 / .mb-16 / .mb-28 / .p-64
```

## 页面根结构

**所有页面必须以 `<div className="page-content">` 包裹**，以获得进入动画。

```tsx
export default function SomePage() {
  return (
    <div className="page-content">
      <PageHeader ... />
      {/* page body */}
    </div>
  );
}
```

## 文件引用

| 文件                          | 内容                                                                                     | 何时阅读         |
| ----------------------------- | ---------------------------------------------------------------------------------------- | ---------------- |
| `references/visual-style.md`  | 颜色、字体、间距、阴影、圆角、SCSS 使用规范                                              | 任何样式调整     |
| `references/components.md`    | PageHeader、DetailSection、DetailItem、EmptyState、StatCard、Card、Table、Chart 使用规范 | 使用或修改组件时 |
| `references/page-patterns.md` | 列表页、详情页、表单页、图表/报表页、Dashboard 页布局模式                                | 新建页面时       |
| `references/interaction.md`   | 加载状态、空状态、按钮层级、权限控制、Toast/Modal 规范                                   | 调整交互时       |
