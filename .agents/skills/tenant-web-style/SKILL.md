---
name: tenant-web-style
description: 约束 Tenant Hub Web 管理后台（apps/tenant-web）的视觉样式与组件使用规范。在修改或新建 tenant-web 的页面、组件、全局样式、Ant Design 主题配置时使用。涵盖颜色令牌、布局、卡片阴影、按钮/输入框/表格/弹窗/表单用法、页面结构、标签页、加载空态、消息反馈、内容去重等规范。
---

# Tenant Web 前端样式规范

## 颜色令牌

| 用途     | 色值      | 说明                   |
| -------- | --------- | ---------------------- |
| 主色     | `#2563EB` | 按钮、链接、选中态     |
| 主色浅   | `#3B82F6` | Hover 状态             |
| 主色深   | `#1D4ED8` | Active / 按下状态      |
| 成功色   | `#22C55E` | 成功、已启用           |
| 警告色   | `#EA580C` | 警告、待处理           |
| 错误色   | `#DC2626` | 错误、删除、禁用       |
| 布局背景 | `#F3F4F6` | 侧边栏、内容区外围背景 |
| 内容背景 | `#FFFFFF` | 主内容区、卡片背景     |
| 主文字   | `#1F2937` | 标题、正文             |
| 次要文字 | `#6B7280` | 描述、辅助信息         |
| 边框     | `#E5E7EB` | 分割线、表单边框       |
| 边框浅   | `#F3F4F6` | 卡片边框               |

**禁止**：任何位置不得使用渐变色（logo、头像、概览卡片等）。

所有颜色通过 CSS 自定义属性管理（`src/styles/global.scss`），Ant Design `ConfigProvider` 的 `theme.token` 与之同步。

## 布局

| 元素        | 样式                                                          |
| ----------- | ------------------------------------------------------------- |
| 侧边栏      | 固定 240px，白色背景，右侧阴影 `1px 0 4px rgb(0 0 0 / 0.06)`  |
| 顶部 Header | Sticky 定位，白色背景，底部阴影 `0 1px 4px rgb(0 0 0 / 0.06)` |
| 主内容区    | 纯白背景 `#FFFFFF`，padding `28px 32px`                       |

## 卡片与阴影

全局 `.ant-card` 统一应用阴影：

```css
box-shadow:
  0 2px 8px 0 rgb(0 0 0 / 0.12),
  0 1px 3px -1px rgb(0 0 0 / 0.1);
border: 1px solid var(--th-border-light);
```

**减少卡片堆砌**：

- **列表页**：Table 直接展示，**不要**外加 `<Card>` 包裹
- **设置/配置页**：同类信息合并到一个 Card 内，用分割线分隔
- **运营后台列表页**：组织列表、租户列表等直接展示 Table，去掉外层 Card

## 圆角与阴影层级

| 级别 | 圆角值 | 阴影值                                                               |
| ---- | ------ | -------------------------------------------------------------------- |
| sm   | `6px`  | `0 1px 2px rgb(0 0 0 / 0.06)`                                        |
| 默认 | `8px`  | `0 1px 3px rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)`        |
| md   | `8px`  | `0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)`   |
| lg   | `12px` | `0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)` |

Card 圆角 `12px`，按钮圆角 `8px`，输入框圆角 `8px`。

## 按钮规则

### 主按钮规则

每组按钮有且仅有一个主色按钮（`type="primary"`）。删除/危险操作使用 `type="primary" danger`。

### 默认样式

- 默认大小：不设置 `size`（使用 Ant Design 默认 `middle`）
- 默认类型：`type="default"`（带边框的普通按钮）

### 不同场景的按钮规格

| 场景               | 大小    | 类型           | 说明                         |
| ------------------ | ------- | -------------- | ---------------------------- |
| PageHeader 操作区  | 默认    | default        | 普通带边框按钮               |
| 表格单元格内嵌操作 | `small` | `link`         | 文字按钮（无边框/无背景）    |
| 卡片内部操作       | 默认    | icon           | 图标按钮，hover 显示操作名称 |
| 表单提交           | 默认    | primary        | 表单内唯一主色按钮           |
| 删除 / 危险操作    | 默认    | primary danger | `danger` 属性加在主色按钮上  |

**卡片图标按钮模式**：使用 `<Button type="text" icon={<Icon />} />` 配合 `<Tooltip title="操作名称">`。操作名称仅通过 tooltip 在 hover 时显示，不作为可见文本。

## 输入框与数据录入规则

### 默认大小

所有输入组件不设置 `size`，使用 Ant Design 默认大小（`middle`）。

### 搜索输入框

必须使用 Ant Design `Search` 组件（`<Input.Search />`）。Search 组件末尾自带搜索图标，**禁止**在输入框内再嵌入搜索图标。

### 数字输入框

使用 `InputNumber`，开启拨轮（上下箭头）。按需设置 `min` 和 `step`。

### 选择框 / 日期选择 / 时间选择

均使用默认大小。任何地方禁止使用 `size="large"`。

## 表格规则

### 高度与滚动

表格高度必须和页面高度自适应。不允许因表格过高导致页面整体滚动。应限制表格容器高度，仅让**表格内容区滚动**，表头保持固定。

使用 `scroll={{ y: <计算高度> }}` 根据视口可用高度设置。

### 操作列

操作列固定在最右侧：`fixed: 'right'`。

### 顶部操作按钮

表格顶部操作按钮靠右对齐。

### 分页

仅使用 Table 内置的 `pagination` prop，不使用独立的 `<Pagination>` 组件。
默认：`pagination={{ pageSize: 10 }}`。不添加 `showSizeChanger` 和 `showTotal`。

### 通用

- 列表页 Table 直接展示，不加外层 `<Card>` 包裹
- 表格单元格内操作按钮用 `small` + `type="link"`（文字按钮）
- 表格单元格内 Select 用 `size="small"`
- 数据加载使用 `loading={loading}` prop，不用 `<Spin>` 包裹 Table

## 弹窗与对话框规则

### 表单弹窗模式

- 始终设置 `footer={null}` — 提交按钮放在 Form 内部
- `onCancel` 中调用 `form.resetFields()`
- 同一弹窗切换新增/编辑时，在 `<Form>` 上加 `key={editingItem?.id ?? 'new'}` 强制重新挂载

### 删除确认

- 内联删除操作（表格行、卡片底部）：使用 `<Popconfirm>`
- `Popconfirm` 必须设置 `okButtonProps={{ danger: true }}`
- 有条件禁用时，`disabled` 需同时设置在 `Popconfirm` 和触发 Button 上
- 禁止用 `Modal.confirm` 做内联删除

### 文字提示

Tooltip **仅**用于纯图标按钮提供可访问标签。不使用 Drawer 或 Popover。

## 表单规则

### 布局

- 统一使用 `layout="vertical"`
- 不使用 `labelCol` / `wrapperCol`
- 表单容器限制最大宽度：复杂表单 `max-width: 720px`，简单表单 `max-width: 600px`

### 多列并排

表单内并排字段使用 CSS Grid：

```scss
.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr; // 或 1fr 1fr 1fr
  gap: 16px;
}
```

### 校验

- 在每个 `Form.Item` 上通过 `rules` prop 内联定义
- 使用 `{ required: true, message: '请输入/选择xxx' }` 模式
- 不使用外部校验库（Zod、Yup 等）

### Switch

Form 内的 Switch 必须设置 `valuePropName="checked"`。

### 动态字段

动态键值对或可重复字段使用 `Form.List`。

### 编辑回填数据

使用 `useEffect` + `form.setFieldsValue()` 模式：

```tsx
useEffect(() => {
  if (isEdit && data && !initializedRef.current) {
    form.setFieldsValue({ ... });
    initializedRef.current = true;
  }
}, [isEdit, data, form]);
```

### 表单操作按钮

提交/取消按钮组：提交按钮 `margin-top: 24px`，取消按钮 `margin-left: 12px`。

## 加载与空态

### 空态

始终使用自定义 `<EmptyState>` 组件（`components/ui/EmptyState.tsx`），不使用 Ant Design `<Empty>`。默认标题为 `"暂无数据"`。

### 页面加载

用 `<Spin spinning={loading}>...</Spin>` 包裹页面内容，使用默认大小。

### 表单提交加载

提交按钮使用独立的 `saving` / `submitting` 状态控制 `loading` prop，不要复用数据加载状态。

### 骨架屏

任何地方禁止使用 `<Skeleton>`。

### 路由加载

所有页面使用 `lazy()` 懒加载，Suspense fallback 使用 `<PageLoading />`（内部渲染 `<Spin size="large" />`）。

## 消息与反馈

- 使用 `message.success('操作成功')`、`message.error(e.message \|\| '操作失败')`、`message.warning('提示信息')`
- 禁止使用 `message.info`、`message.loading` 和 `notification`
- 从 `antd` 解构导入：`import { message } from 'antd'`

## 标签与状态展示

- 所有状态展示使用 `<Tag>`。禁止创建自定义 `<StatusTag>` 组件。
- 状态值不使用 `<Badge>`（通知红点除外）。
- 状态颜色映射：
  - `success`（绿）：正常、激活、已支付、空闲、已启用
  - `warning`（橙）：已租、待支付、部分支付、待处理、系统预设
  - `error`（红）：维修中、失败、作废、已删除
  - `default`（灰）：预留、出账中、草稿、普通用户角色、未激活

## 分割线

- 表单内区块标题：`<Divider orientation="left">区块标题</Divider>`
- 列表项分隔：纯 `<Divider />` 不带 orientation
- 禁止使用竖向分割线

## 页面结构规范

### 列表页

```
PageHeader（面包屑 + 标题 + 右侧操作按钮）
  → Tabs（筛选，标签显示数量，不用 Radio.Group）
    → Table / 卡片网格（直接展示，不加 Card 包裹）
```

- **不要放统计卡片**：Tab 标签已显示数量，避免信息重复
- 操作按钮统一放在 `PageHeader` 的 `actions` 中（页面右上角）
- 筛选使用 `Tabs` 组件，保持与账单页风格一致

### 详情页

```
PageHeader（面包屑 + 标题 + 右侧操作按钮）
  → Tabs（不同信息区块）
    → Card（基本信息）
    → Card（子列表/表格）
```

### 设置/配置页

- 同类信息合并到一个 Card，内部用分割线分隔区块
- 表单区块保持 Card 标题明确

### 运营后台列表页

- Table 直接展示，去掉外层 `<Card>` 包裹
- 操作按钮统一放在 `PageHeader` 的 `actions` 中

## Tab 组件规范

- 所有筛选切换统一使用 Ant Design `Tabs` 组件
- 不要用 `Radio.Group` + `Radio.Button` 做页面级筛选
- Tabs 导航增加底部边框区分内容区：

```css
.ant-tabs-nav {
  border-bottom: 1px solid var(--th-border);
  margin-bottom: 20px;
}
```

## 内容去重原则

- **首页 Dashboard** 已有经营概览和统计信息，其他列表页不要重复展示统计卡片
- **房间页**：Tab 已显示各状态数量，去掉顶部 StatCard
- **账单页**：Tab 已显示待支付/待处理/全部数量，去掉顶部统计卡片行

## 样式文件规范

- 组件级样式使用 `.module.scss`，通过 `@use '@/styles/variables' as *` 引用全局变量
- 非 Ant Design 元素的样式通过 CSS 变量（`var(--th-*)`）或 SCSS 变量（`$th-*`）管理
- 公共工具类写在 `global.scss` 中（如 `.flex-between`、`.text-muted`、`.mt-16`、`.mb-16`、`.w-full` 等）

## 新增/修改页面检查清单

开发或修改页面后，对照以下清单检查：

- [ ] 配色是否遵循白/灰/蓝主色调，无渐变
- [ ] 每组按钮是否仅有一个主色按钮；删除是否使用 danger
- [ ] 默认按钮是否使用 `type="default"` 带边框样式，不写 size
- [ ] 表格单元格按钮是否使用 `size="small" type="link"`
- [ ] 卡片操作按钮是否使用图标按钮 + Tooltip
- [ ] 输入框是否默认大小；Search 是否用 `<Input.Search />` 且无额外图标
- [ ] 数字输入框是否使用 `InputNumber` 带拨轮
- [ ] 表格高度是否自适应视口，仅表体滚动
- [ ] 表格操作列是否 `fixed: 'right'`
- [ ] 表格顶部操作按钮是否靠右
- [ ] 表格分页是否使用 `pageSize: 10`，无独立 Pagination
- [ ] 表单弹窗是否 `footer={null}`，提交按钮在 Form 内
- [ ] 表单是否使用 `layout="vertical"`，容器宽度 600-720px
- [ ] Form 内的 Switch 是否设置 `valuePropName="checked"`
- [ ] 空态是否使用 `<EmptyState>` 组件
- [ ] 页面加载是否用 `<Spin>`，表格加载用 `loading` prop
- [ ] 表单提交是否使用独立的 saving 状态控制按钮 loading
- [ ] message 是否仅用 `.success`/`.error`/`.warning`
- [ ] 状态展示是否使用 `<Tag>` 且颜色映射正确
- [ ] 列表页 Table 是否直接展示（无外层 Card）
- [ ] 操作按钮是否统一放在 PageHeader 右侧
- [ ] 筛选是否使用 Tabs（不用 Radio.Group）
- [ ] 是否存在与首页或其他页面重复的统计信息
- [ ] Card 阴影是否正常显示
