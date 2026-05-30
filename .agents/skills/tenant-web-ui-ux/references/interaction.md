# 交互规范

## 加载状态

### 模式 A：整页加载（详情页/表单页）

```tsx
if (loading) {
  return (
    <div className="page-content">
      <PageHeader ... />
      <div style={{ padding: '120px 0', textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    </div>
  );
}
```

**适用场景：** 详情页、表单页（初始加载时整个页面内容依赖单个接口）

### 模式 B：内容区加载（列表页）

```tsx
<Spin spinning={loading}>
  {data.length === 0 ? (
    <EmptyState ... />
  ) : (
    <Table ... />
  )}
</Spin>
```

**适用场景：** 列表页、Tab 内容区（刷新数据时保留页面结构）

**规则：**

- 详情/表单页用模式 A
- 列表页用模式 B
- 按钮内加载用 `loading` prop，不用全局 Spin

---

## 空状态

```tsx
// 列表空状态
<Card>
  <EmptyState
    title="暂无公寓数据"
    description="当前组织下还没有创建任何公寓，点击右上角按钮创建第一个公寓"
    action={
      canManageApartment
        ? { label: '新增公寓', onClick: () => navigate('/apartments/new') }
        : undefined
    }
  />
</Card>

// Section 内空状态
<EmptyState
  title="暂无经营花费记录"
  description="点击右上角按钮记录第一笔经营花费"
  size="small"
/>
```

**规则：**

- 替换列表内容时必须包在 `<Card>` 内
- `action` 只在用户有权限时提供
- 标题简明，描述补充上下文
- Section 级别空状态用 `size="small"`

---

## 按钮层级

| 层级     | 样式                                           | 使用场景               |
| -------- | ---------------------------------------------- | ---------------------- |
| 主要操作 | `type="primary"` + icon                        | 保存、提交、创建、查询 |
| 次要操作 | 默认 `Button` + icon                           | 编辑、刷新、导出、导入 |
| 危险操作 | `danger` prop                                  | 删除、作废、终止       |
| 文字操作 | `type="text"` / `type="link"` + `size="small"` | 表格行内操作、查看详情 |

**规则：**

- 一个页面/区块内**只有一个**主要操作按钮
- 危险操作必须包裹在 `Popconfirm` 或 `Modal.confirm` 中
- 表格行内操作统一用 `type="link" size="small"`
- 按钮文字用动词：`保存`、`查询`、`导出`、`作废`，不用名词

---

## 权限控制

使用 `useHasPermission` 控制操作按钮的显示：

```tsx
const canManageApartment = useHasPermission('apartment:manage');

// 在 actions 中
actions={
  canManageApartment && (
    <Button type="primary" icon={<PlusOutlined />}>
      新增公寓
    </Button>
  )
}

// 在表格行内
render: (_, row) => (
  <div className={styles.actions}>
    <Button type="link" size="small" icon={<EyeOutlined />}>
      查看
    </Button>
    {canManageApartment && (
      <Button type="link" size="small" icon={<EditOutlined />}>
        编辑
      </Button>
    )}
  </div>
)
```

**规则：**

- 只隐藏操作按钮，不隐藏查看类按钮
- 权限字符串格式：`resource:action`（如 `apartment:manage`、`bill:view`）

---

## Toast / Message

```tsx
import { message } from 'antd';

// 成功
message.success('公寓已保存');

// 错误（带后端消息）
message.error(e instanceof Error ? e.message : '保存失败');

// 警告
message.warning('请填写必填项');
```

**规则：**

- 成功消息简洁，不含冗余信息
- 错误消息优先显示后端返回的具体错误
- 避免连续触发多个 message（如循环内）

---

## Modal / Confirm

### 确认对话框

```tsx
Modal.confirm({
  title: '作废账单',
  content: '作废后不可恢复，是否确认？',
  okText: '确认作废',
  okButtonProps: { danger: true },
  onOk: async () => {
    await voidBill(currentOrgId, bill.id, reason);
    message.success('账单已作废');
    await loadData();
  },
});
```

### 带输入的确认

```tsx
Modal.confirm({
  title: '作废账单组',
  content: (
    <div>
      <p>将作废该组 {group.bills.length} 笔账单</p>
      <Input.TextArea id="void-reason" placeholder="请输入作废原因" rows={3} />
    </div>
  ),
  okText: '确认作废',
  okButtonProps: { danger: true },
  onOk: async () => {
    const reason = (
      document.getElementById('void-reason') as HTMLTextAreaElement
    )?.value;
    if (!reason) {
      message.error('请输入作废原因');
      throw new Error('原因不能为空');
    }
    // ...
  },
});
```

**规则：**

- 危险操作：`okButtonProps: { danger: true }`
- 确认按钮文字明确动作：`确认删除`、`确认作废`
- 如果需要表单验证，在 `onOk` 中 `throw new Error()` 阻止关闭

---

## Tag 使用

```tsx
// 状态标签
<Tag color={statusColors[status]}>{statusLabels[status]}</Tag>

// 类型标签
<Tag color="blue">月度账单</Tag>
<Tag color="orange">退租账单</Tag>

// 数值标签
<Tag color="warning">剩 15 天</Tag>
<Tag color="error">已超期 5 天</Tag>
```

**状态色映射：**
| 状态 | 颜色 |
|------|------|
| 成功/已支付/生效中 | `success` |
| 警告/待处理/部分支付 | `warning` |
| 错误/失败/逾期/作废 | `error` |
| 默认/草稿/其他 | `default` |
| 处理中 | `processing` |

---

## 金额格式化

```tsx
import { money } from '@/utils/format';

// 显示金额
<span>¥{money(value)}</span>

// Statistic
<Statistic title="本月应收" value={money(receivable)} prefix="¥" />
```

**规则：**

- 所有金额显示必须经 `money()` 格式化
- 前缀统一用 `¥`，不用 "RMB" 或 "元"
- `money()` 保留两位小数，自动千分位
