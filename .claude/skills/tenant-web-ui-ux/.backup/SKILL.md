---
name: tenant-web-ui-ux
description: >
  Tenant Hub Web 管理后台的 UI/UX 设计规范。在涉及 tenant-web（apps/tenant-web）的
  任何页面新建、布局修改、样式调整、组件使用、交互设计、视觉统一时必须使用。
  触发场景包括但不限于：用户说"新建页面""修改样式""调整布局""统一风格"
  "重构详情页""设计卡片列表""优化表单""改颜色""加按钮"等任何 UI 相关请求，
  即使用户没有明确提到 UI/UX 规范，只要涉及 tenant-web 的前端代码变更，
  就应该先查阅本 skill 确保输出符合全站统一风格。
---

# Tenant Web UI/UX 设计规范

## 为什么需要这套规范

Tenant Hub 是一个 B 端管理后台，用户（公寓运营方）每天长时间使用。
不一致的 UI 会增加认知负担，降低操作效率。
这套规范的目标是**让任何页面的修改都不需要重新做设计决策**——
看到类似场景，直接复用已有模式。

## 通用原则

### 1. 一致性优先于个性化

同类元素在全站必须一致。不要为单个页面"优化"而破坏全局统一。

- 同类页面用相同结构（列表页、详情页、表单页）
- 同类组件用相同尺寸、颜色、间距
- 同类交互用相同反馈方式

### 2. 减少视觉噪音

B 端用户关注效率，不是审美体验。不必要的装饰会分散注意力。

- **不要堆砌卡片**：列表、表格、详情视图直接展示，不用 Card 包裹
- **不要重复信息**：Tab 已显示数量时，顶部不要放统计卡片
- **不要渐变**：全站禁止渐变色

### 3. 操作就近原则

用户在哪里看到信息，就应该在哪里找到相关操作。

- 与区块强相关的操作按钮，放在该区块标题右侧（`DetailSection` 的 `actions`）
- 不再把所有操作都堆在 `PageHeader`
- 每个区块的操作不超过 3 个

### 4. 信息层级自上而下

页面信息按重要性自然排列，用户扫一眼就能抓住重点：

1. 面包屑 + 标题（我在哪）
2. 筛选/切换（我能看什么）
3. 主要内容（关键信息）
4. 空态/加载（无数据时的引导）

## Reference 导航

本 skill 采用分层披露。主文件只保留通用原则和导航，
具体领域规范在 `references/` 下。根据你当前处理的任务，阅读对应文件：

| 如果你在做...                                       | 阅读                                                         |
| --------------------------------------------------- | ------------------------------------------------------------ |
| 调整颜色、间距、圆角、阴影、字体                    | [`references/visual-style.md`](references/visual-style.md)   |
| 使用按钮、输入框、表格、标签、分割线                | [`references/components.md`](references/components.md)       |
| 处理加载、空态、成功/错误提示                       | [`references/interaction.md`](references/interaction.md)     |
| 新建/修改列表页、详情页、设置页、卡片列表、详情视图 | [`references/page-patterns.md`](references/page-patterns.md) |

**规则**：如果任务涉及多个领域，先读完所有相关 references 再动手写代码。
不要边写边查——这会遗漏跨领域的一致性约束。

## 快速决策表

遇到以下场景时，不需要翻 reference，直接按表执行：

| 场景                           | 决策                                                                |
| ------------------------------ | ------------------------------------------------------------------- |
| 列表页 Table 要不要包 Card？   | **不要**，Table 直接展示                                            |
| 详情视图要不要包 Card？        | **不要**，用 `DetailSection`                                        |
| 表单录入/编辑页要不要包 Card？ | **要**，Card 提供编辑边界                                           |
| 状态用什么组件展示？           | **`<Tag>`**，禁止自定义 StatusTag                                   |
| 删除确认用什么？               | **`<Popconfirm>`**，不用 `Modal.confirm`                            |
| 表单弹窗 footer 怎么放？       | **`footer={null}`**，提交按钮放 Form 内                             |
| 空态用什么？                   | **`<EmptyState>`**，不用 antd `<Empty>`                             |
| 页面加载用什么？               | **`<Spin spinning={loading}>`**                                     |
| 表格加载用什么？               | **Table `loading` prop**，不用 Spin 包 Table                        |
| 消息反馈用什么？               | **`message.success/error/warning`**，不用 info/loading/notification |
| 筛选切换用什么？               | **`Tabs`**，不用 Radio.Group                                        |
| 状态颜色怎么选？               | success=绿 warning=橙 error=红 default=灰                           |
| 一组按钮几个 primary？         | **只能有 1 个**                                                     |

## 已有组件

以下组件已实现，直接复用，不要重新实现：

- `PageHeader`（`components/ui/PageHeader.tsx`）— 面包屑 + 标题 + 操作按钮
- `EmptyState`（`components/ui/EmptyState.tsx`）— 空态（含图标 + 标题 + 描述 + 可选操作按钮）
- `DetailSection`（`components/ui/DetailSection.tsx`）— 详情区块容器（标题 + actions）
- `DetailItem`（`components/ui/DetailItem.tsx`）— 单个信息项（label + value）

## 完整检查清单

开发或修改 UI 相关代码后，对照以下清单检查：

- [ ] 配色是否遵循主色调，无渐变
- [ ] 每组按钮是否仅有一个主色按钮；删除是否使用 `danger`
- [ ] 默认按钮是否使用 `type="default"` 带边框样式
- [ ] 卡片操作按钮是否使用图标按钮 + Tooltip
- [ ] 输入框是否默认大小；Search 是否用 `<Input.Search />`
- [ ] 数字输入框是否使用 `InputNumber` 带拨轮
- [ ] 表格高度是否自适应视口，仅表体滚动
- [ ] 表格操作列是否 `fixed: 'right'`
- [ ] 表格顶部操作按钮是否靠右
- [ ] 表格分页是否使用 `pageSize: 10`
- [ ] 表格单元格内 Select 是否用 `size="small"`
- [ ] 表单弹窗是否 `footer={null}`
- [ ] 表单是否使用 `layout="vertical"`，容器宽度 600-720px
- [ ] Form 内的 Switch 是否设置 `valuePropName="checked"`
- [ ] 动态字段是否使用 `Form.List`
- [ ] 空态是否使用 `<EmptyState>` 组件
- [ ] 页面加载是否用 `<Spin>`，表格加载用 `loading` prop
- [ ] 表单提交是否使用独立的 saving 状态控制按钮 loading
- [ ] 路由加载是否使用 `lazy()`
- [ ] message 是否仅用 `.success`/`.error`/`.warning`
- [ ] 状态展示是否使用 `<Tag>` 且颜色映射正确
- [ ] 列表页 Table 是否直接展示（无外层 Card）
- [ ] 详情视图是否未使用 Card，是否使用 `DetailSection + DetailItem`
- [ ] 筛选是否使用 Tabs（不用 Radio.Group）
- [ ] 是否存在与首页或其他页面重复的统计信息
