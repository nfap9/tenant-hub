# 交互规范

## 加载

### 页面级加载

用 `<Spin spinning={loading}>` 包裹整个页面内容区：

```tsx
<Spin spinning={loading}>{/* 页面内容 */}</Spin>
```

使用默认大小（**不要**设 `size="large"`）。
大 Spin 会占据太多视觉焦点，让用户感到焦虑。
默认大小刚好表示"稍等"而不喧宾夺主。

### 表格加载

用 Table 的 `loading` prop，不用 Spin 包裹：

```tsx
<Table loading={loading} ... />
```

这样表头始终可见，减少页面跳动。

### 表单提交加载

提交按钮使用**独立的状态**控制 `loading`，不要复用数据加载状态：

```tsx
const [submitting, setSubmitting] = useState(false);
<Button type="primary" htmlType="submit" loading={submitting}>
  保存
</Button>;
```

**为什么**：如果复用 `loading`，用户在提交时看到整个表单区域变灰（Spin），
会感到不可控。只让按钮 loading 表示"正在处理，但你可以看到刚才填了什么"。

### 骨架屏

**全站禁止使用 `<Skeleton>`**。

Skeleton 在数据加载时展示假内容，会让用户误以为页面已加载完成，
从而产生"怎么点不了"的困惑。Spin 明确表示"还在加载"，更符合心智模型。

## 空态

始终使用 `<EmptyState>` 组件（`components/ui/EmptyState.tsx`），
**禁止使用** antd `<Empty>`。

`<EmptyState>` 默认标题为 `"暂无数据"`，支持描述文字和操作按钮：

```tsx
<EmptyState
  title="暂无房间"
  description="可以新增单个房间或批量添加"
  action={{ label: '新增房间', onClick: () => navigate(...) }}
/>
```

**为什么**：统一的空态组件保证了全站空页面的视觉一致性，
并且操作按钮让用户在无数据时也知道下一步该做什么，减少迷失感。

## 消息与反馈

使用 `message` 的三种方法：

- `message.success('操作成功')`
- `message.error(e instanceof Error ? e.message : '操作失败')`
- `message.warning('提示信息')`

**禁止**使用 `message.info`、`message.loading` 和 `notification`。

**为什么**：

- `info` 和 `success` 容易混淆，success 有明确的正面反馈语义
- `loading` 会挡住用户操作，Spin 才是正确的加载指示器
- `notification` 会弹窗打扰，B 端用户更适应不打扰的 toast 式消息

## 删除与二次确认

### 内联删除

表格行、卡片底部等位置的删除操作使用 `<Popconfirm>`：

```tsx
<Popconfirm
  title="删除房间"
  description="删除后不可恢复，请确认。"
  onConfirm={handleDelete}
  okText="确认删除"
  okButtonProps={{ danger: true }}
>
  <Button danger>删除</Button>
</Popconfirm>
```

**必须**设置 `okButtonProps={{ danger: true }}`。
有条件禁用时，`disabled` 要同时设在 `Popconfirm` 和触发 Button 上。

### 非删除类二次确认

对于非删除但需要用户明确确认后果的操作（如手动生成账单、批量结算等），
使用 `Modal.confirm`：

```tsx
Modal.confirm({
  title: '生成账单',
  content: '将为 3 个房间生成本月账单，确认继续？',
  onOk: async () => { ... },
});
```

**为什么做此区分**：删除是高频轻操作，Popconfirm 足够；
非删除的二次确认往往涉及业务逻辑判断，需要更多上下文信息，Modal 能容纳更大的内容区域。

## Tooltip

Tooltip **主要用于**纯图标按钮提供可访问标签：

```tsx
<Tooltip title="编辑">
  <Button type="text" icon={<EditOutlined />} />
</Tooltip>
```

不要使用 Drawer 或 Popover 做简单提示。Tooltip 是最轻量的辅助信息层，
Drawer 和 Popover 太重，会打断用户当前任务流。

在复杂场景下（需要展示更多信息或操作），可以使用 Popover，但应保持克制。
