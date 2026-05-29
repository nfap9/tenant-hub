# 组件使用规范

## 按钮

### 基本规则

- 每组按钮中**只能有一个** `type="primary"`
- 删除/危险操作用 `type="primary" danger`，不要单独用 `danger` 不加 `primary`
- 默认按钮用 `type="default"`（带边框），不要用幽灵按钮
- 不设置 `size`，使用 Ant Design 默认 `middle`
- 圆角 `$th-radius`（8px）

### 不同场景的按钮规格

| 场景                                     | 类型                    | 说明                     |
| ---------------------------------------- | ----------------------- | ------------------------ |
| PageHeader 操作区                        | `default`               | 普通带边框按钮           |
| 区块 actions（DetailSection/Card extra） | `default` / `primary`   | 根据重要性选择           |
| 表格行内操作                             | `link` + `size="small"` | 文字按钮，无边框         |
| 表单提交                                 | `primary`               | 表单内唯一主色按钮       |
| 页面级删除                               | `primary` + `danger`    | 危险操作需要高对比度     |
| 表单内行删除                             | `link` + `danger`       | 轻量，不抢占表单视觉焦点 |

### 图标按钮

卡片内的操作按钮使用图标按钮 + Tooltip：

```tsx
<Tooltip title="编辑">
  <Button type="text" icon={<EditOutlined />} onClick={...} />
</Tooltip>
```

**为什么**：卡片空间紧凑，图标按钮节省横向空间，Tooltip 保证可访问性。

## 输入框

- 所有输入组件**不设置 `size`**，使用默认 `middle`
- 搜索必须用 `<Input.Search />`，禁止在普通 Input 里手动塞搜索图标
- 数字输入用 `InputNumber`，保留拨轮，按需设 `min`/`step`

## 表格

### 高度与滚动

表格高度必须自适应页面，**禁止因表格过高导致整页滚动**。
限制表格容器高度，仅让**表体滚动**，表头固定：

```tsx
<Table scroll={{ y: calcTableHeight() }} />
```

### 操作列

- 固定在最右侧：`fixed: 'right'`
- 行内操作用 `size="small"` + `type="link"`
- 表格单元格内的 Select 用 `size="small"`

### 分页

- 仅用 Table 内置 `pagination` prop，不用独立 `<Pagination>`
- 默认 `pagination={{ pageSize: 10 }}`
- 不加 `showSizeChanger` 和 `showTotal`

### 加载

- 用 `loading={loading}` prop，**不要用 `<Spin>` 包裹 Table**
- 这能让表头在加载时仍然可见，减少闪烁感

### 包裹

列表页 Table **直接展示**，不加外层 `<Card>` 包裹。
Card 会增加一层不必要的视觉边框，与简洁风格冲突。

## 标签（Tag）

- **所有状态展示使用 `<Tag>`**。禁止创建自定义 `<StatusTag>` 组件。
- 不使用 `<Badge>` 展示状态（通知红点除外）
- 颜色映射：

| 语义                         | 颜色值    | 典型场景   |
| ---------------------------- | --------- | ---------- |
| 正常/激活/已支付/空闲/已启用 | `success` | 成功状态   |
| 已租/待支付/待处理           | `warning` | 需要注意   |
| 维修中/失败/作废             | `error`   | 异常或终止 |
| 预留/草稿/未激活             | `default` | 中性状态   |

**为什么**：统一用 Tag 能保证状态展示的一致性。
自定义组件会导致不同页面的状态样式逐渐分化。

## 分割线

- 表单内区块标题：`<Divider orientation="left">标题</Divider>`
- 区块之间分隔：纯 `<Divider />` 不带 orientation
- **禁止**竖向分割线

**为什么**：orientation="left" 的分割线自带标题功能，
比额外写一个 div 做标题更简洁，且视觉层级更清晰。

## 弹窗（Modal）

### 二次确认

- **删除操作**用 `<Popconfirm>`（轻量，不阻断任务流）
- **非删除但需要明确确认的操作**用 `Modal.confirm`（如手动生成账单、批量操作等需要用户明确知晓后果的场景）
- **复杂确认**（需要用户输入或查看详细信息）用 `<Modal>` + 自定义内容

### 表单弹窗

- 始终设置 `footer={null}`，提交按钮放 Form 内部
- `onCancel` 中调用 `form.resetFields()`
- 同一弹窗切换新增/编辑时，在 `<Form>` 上加 `key` 强制重新挂载

## 时间线（Timeline）

用于展示时间轴信息（如操作日志、账单历史、审批流程）：

```tsx
<Timeline
  items={[
    { label: '2024-01-01', children: '创建账单' },
    { label: '2024-01-05', children: '用户支付' },
  ]}
/>
```

使用 antd `<Timeline>`，不自定义时间线组件。

## 统计数字（Statistic）

仅用于 **Dashboard 经营概览** 的统计卡片。
其他页面（列表页、详情页）**不要**使用 Statistic 展示数字，
避免与 Tab 标签数量重复，减少视觉噪音。

## 复选框（Checkbox）

用于多选场景（如账单批量选择支付、批量操作）。
批量操作栏在 Table 上方显示选中数量和操作按钮。

## 单选框（Radio.Group）

**区分两个场景**：

| 场景            | 使用                                        |
| --------------- | ------------------------------------------- |
| 页面级筛选/切换 | **Tabs**（不用 Radio.Group）                |
| 表单内单选      | **Radio.Group**（合适的，比 Select 更直观） |

## 选择器（Select）

### 表格行内编辑

表格操作列可直接放置 Select 用于状态切换或权限变更：

```tsx
<Select size="small" value={record.status} onChange={...}>
  <Select.Option value="active">正常</Select.Option>
  <Select.Option value="inactive">停用</Select.Option>
</Select>
```

使用 `size="small"`，保持与行内操作按钮的尺寸一致。

### 普通表单

使用默认大小，不设置 `size`。
