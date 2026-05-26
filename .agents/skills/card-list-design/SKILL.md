---
name: card-list-design
description: 约束 Tenant Hub Web 管理后台中卡片式列表的设计与交互规范。在新建或修改卡片列表页面、卡片组件、详情页操作区时使用。涵盖卡片信息层级、交互行为、布局、操作收敛原则等。
---

# 卡片列表设计规范

## 核心原则

卡片式列表的核心理念是：**卡片即入口，高频操作就近，不常用操作收敛到详情**。

- 卡片本身是可点击的导航入口，点击进入对应详情页
- 卡片上**禁止**放置"查看"按钮（点击卡片本身即进入详情）
- 卡片上**禁止**放置"编辑"、"删除"等管理类按钮（不常用，收敛到详情页）
- 根据业务场景的常用程度，卡片上**可放置高频业务按钮**（如签约、收款等）
- 卡片上的按钮数量**不超过 3 个**

## 信息层级

卡片内部的信息按以下顺序从上到下排列：

| 层级 | 内容              | 样式                   | 说明                               |
| ---- | ----------------- | ---------------------- | ---------------------------------- |
| 1    | 主标识 + 状态标签 | 标题区（Card `title`） | 如房间号、公寓名称，右侧放状态 Tag |
| 2    | 副标题            | 13px， muted 色        | 如所属公寓、分类等                 |
| 3    | 核心元信息        | 12px，subtle 色        | 如户型·面积、数量·在租等关键数据   |
| 4    | 补充信息          | 12px，subtle 色        | 如设施列表、合同期、备注等         |

## 交互行为

### 点击进入详情

- 卡片必须设置 `hoverable`，提供悬停视觉反馈
- 卡片整体可点击，点击后跳转到详情路由（如 `/rooms/:id`、`/apartments/:id`）
- **禁止**在卡片上放置"查看"按钮

### 操作按钮安排

#### 禁止放在卡片上的按钮

- **查看 / 详情**：点击卡片本身即进入详情，无需重复按钮
- **编辑**：修改频率低，放到详情页 `PageHeader`
- **删除**：风险操作且频率低，放到详情页 `PageHeader`

#### 可放在卡片上的按钮

根据业务场景的高频程度判断，例如：

- 空闲房间的"签约"按钮
- 待支付账单的"收款"按钮
- 待处理任务的"办理"按钮

**限制**：同一时刻卡片上**同时显示的按钮数量不超过 3 个**。按钮可根据状态条件控制显示/隐藏，但在任何状态下同时可见的按钮都不能超过 3 个，优先保留最常用的一到两个。

#### 详情页操作区

编辑、删除等不常用操作统一放在详情页 `PageHeader actions` 中：

```tsx
<PageHeader
  back="/rooms"
  breadcrumb={[...]}
  actions={
    <>
      <Button icon={<EditOutlined />}>编辑</Button>
      <Popconfirm ...>
        <Button danger icon={<DeleteOutlined />}>删除</Button>
      </Popconfirm>
    </>
  }
/>
```

## 组件复用

同类卡片必须抽取为独立可复用组件，确保多处列表外观一致。

### 组件位置

业务卡片组件放在 `src/components/<业务域>/` 下，如：

```
src/components/rooms/RoomCard.tsx
src/components/rooms/RoomCard.module.scss
```

### Props 设计

```tsx
interface RoomCardProps {
  room: Room;
  apartmentName?: string; // 可选覆盖副标题
}
```

组件内部应自行处理：

- 状态标签的颜色映射
- 点击跳转
- 缺省值展示（如"无设施"）

## 布局规范

### 网格布局

卡片列表统一使用 CSS Grid：

```scss
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}
```

- 最小宽度根据卡片内容调整（房间卡片 `260px`，公寓卡片 `340px`）
- 间距统一 `16px` 或 `24px`

### 页面结构

```
PageHeader（面包屑 + 标题 + 右上角"新增"按钮）
  → Tabs（筛选，如有）
    → 卡片网格（直接展示，不加外层 Card 包裹）
```

## 样式规范

### 卡片

- 使用 Ant Design `Card` 组件
- 统一默认大小（不设置 `size="small"`，确保各处一致）
- 阴影、圆角遵循全局 Ant Design 主题

### 标题

```scss
font-family: var(--th-font-heading);
font-weight: 600;
font-size: 16px;
```

### 副标题与元信息

```scss
// 副标题
font-size: 13px;
color: var(--th-foreground-muted);

// 元信息
font-size: 12px;
color: var(--th-foreground-subtle);
```

## 空态处理

列表为空时，使用 `<EmptyState>` 组件，并提供"新增"操作入口（如有权限）。

## 检查清单

新建或修改卡片列表时，对照以下清单检查：

- [ ] 卡片是否 `hoverable` 且点击可进入详情
- [ ] 卡片上是否没有"查看""编辑""删除"按钮
- [ ] 编辑/删除等不常用操作是否已放到详情页 `PageHeader`
- [ ] 卡片上的业务按钮是否不超过 3 个
- [ ] 同类卡片是否复用统一组件
- [ ] 各处卡片尺寸是否一致
- [ ] 卡片网格是否使用 CSS Grid（`repeat(auto-fill, ...)`）
- [ ] 空态是否使用 `<EmptyState>` 组件
- [ ] 信息层级是否清晰（主标识 → 副标题 → 元信息 → 补充信息）
