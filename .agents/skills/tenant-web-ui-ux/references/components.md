# 组件使用规范

## PageHeader

所有页面必须使用 `PageHeader` 组件。

```tsx
import PageHeader from '@/components/ui/PageHeader';

// 列表页
<PageHeader
  breadcrumb={[{ label: '公寓管理' }]}
  actions={
    <Button type="primary" icon={<PlusOutlined />}>
      新增公寓
    </Button>
  }
/>

// 详情页
<PageHeader
  back="/apartments"
  breadcrumb={[
    { label: '公寓管理', path: '/apartments' },
    { label: apartment.name },
  ]}
/>

// 表单页
<PageHeader
  back="/apartments"
  breadcrumb={[
    { label: '公寓管理', path: '/apartments' },
    { label: '新增公寓' },
  ]}
/>
```

**规则：**

- 列表页：只有 `breadcrumb` + `actions`
- 详情/表单页：必须有 `back` + `breadcrumb`
- `actions` 内用 `<Space>` 包裹多个按钮
- 面包屑最后一项无 `path`，表示当前页面

---

## DetailSection + DetailItem

详情页字段分组的标准组件。

```tsx
import DetailSection from '@/components/ui/DetailSection';
import DetailItem from '@/components/ui/DetailItem';

<DetailSection
  title={
    <>
      <HomeOutlined className="text-primary" /> 基本信息
    </>
  }
  actions={<Button icon={<EditOutlined />}>编辑</Button>}
>
  <Row gutter={[24, 0]}>
    <Col span={8}>
      <DetailItem label="地址">{apartment.location || '未填写'}</DetailItem>
    </Col>
    <Col span={8}>
      <DetailItem label="状态">
        <Tag color="success">运营中</Tag>
      </DetailItem>
    </Col>
    <Col span={8}>
      <DetailItem label="楼层数">{apartment.floors} 层</DetailItem>
    </Col>
  </Row>
</DetailSection>;
```

**规则：**

- 标题格式：`<Icon className="text-primary" /> 区块名称`
- 字段布局：`Row gutter={[24, 0]}` + `Col span={8}`（三列）或 `span={12}`（两列）
- 空值 fallback：`'-'`、`'未填写'`、`'未维护'`，**不要**留空白
- `actions` 放编辑/删除等区块级操作

---

## EmptyState

```tsx
import EmptyState from '@/components/ui/EmptyState';

// 列表空状态（必须包在 Card 中）
<Card>
  <EmptyState
    title="暂无公寓数据"
    description="当前组织下还没有创建任何公寓"
    action={
      canManage
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

- 替换列表内容时，EmptyState 必须包在 `<Card>` 内以保持边框一致性
- `action` 仅在用户有权限时提供
- Section 级别空状态使用 `size="small"`

---

## StatCard

```tsx
import StatCard from '@/components/ui/StatCard';

<Row gutter={16}>
  <Col xs={12} sm={6}>
    <StatCard
      title="在押总额"
      value={money(summary.heldAmount)}
      prefix="¥"
      color="primary"
    />
  </Col>
</Row>;
```

**可用颜色：**`primary` | `success` | `warning` | `danger` | `accent`

**规则：**

- 多个 StatCard 用 `Row gutter={16}` 包裹
- 在较小屏幕上用 `xs={12}` 两列，桌面端 `sm={6}` 四列

---

## Card

### 统计卡片（small）

```tsx
<Card size="small">
  <Statistic
    title="待支付"
    value={stats.unpaidCount}
    suffix={`笔 · ¥${money(stats.unpaidAmount)}`}
    valueStyle={{ fontWeight: 700, fontSize: 22, color: '#fa8c16' }}
    prefix={<ClockCircleOutlined />}
  />
</Card>
```

### 图表容器

```tsx
<Card size="small" title="入住率趋势" className="mb-16">
  <div style={{ height: 280 }}>
    <ResponsiveContainer width="100%" height="100%">
      {/* chart */}
    </ResponsiveContainer>
  </div>
</Card>
```

### 列表项卡片

```tsx
<Card
  size="small"
  hoverable
  className={styles.billCard}
  bodyStyle={{ padding: 'var(--th-space-5)' }}
>
  {/* content */}
</Card>
```

**规则：**

- 图表容器固定内部 `div` 高度（260–300px）
- 列表项卡片使用 `size="small"` + 自定义 `bodyStyle`
- 需要点击跳转的卡片加 `hoverable`

---

## Table

```tsx
<Table
  rowKey="id"
  dataSource={data}
  pagination={{ pageSize: 10 }}
  scroll={{ x: 'max-content' }}
  columns={[
    {
      title: '租客',
      render: (_, row) => (
        <div>
          <div>{row.tenantName}</div>
          <div className="text-muted">{row.tenantPhone}</div>
        </div>
      ),
    },
    {
      title: '租金',
      render: (_, row) => <span>¥{money(row.rentAmount)}</span>,
    },
    {
      title: '状态',
      render: (_, row) => (
        <Tag color={statusColors[row.status]}>{statusLabels[row.status]}</Tag>
      ),
    },
    {
      title: '操作',
      fixed: 'right',
      render: (_, row) => (
        <Button type="link" size="small" icon={<EyeOutlined />}>
          查看
        </Button>
      ),
    },
  ]}
/>
```

**规则：**

- 始终设置 `rowKey="id"`
- 复合信息列：主文字 + `.text-muted` 副文字
- 金额列：`¥${money(value)}`
- 状态列：`<Tag color={...}>`，颜色映射统一放在常量文件中
- 操作列：`fixed: 'right'`，使用 `type="link" size="small"` 按钮

---

## Chart（Recharts）

### 标准容器

```tsx
<div style={{ height: 280 }}>
  <ResponsiveContainer width="100%" height="100%">
    {/* Chart */}
  </ResponsiveContainer>
</div>
```

### LineChart（趋势图）

```tsx
<LineChart data={trendData}>
  <CartesianGrid strokeDasharray="3 3" />
  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
  <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 12 }} />
  <Tooltip formatter={(value) => [`${value}%`, '入住率']} />
  <Line
    type="monotone"
    dataKey="occupancyRate"
    stroke="#1890ff"
    strokeWidth={2}
    dot={{ r: 3 }}
  />
</LineChart>
```

### BarChart（柱状图）

```tsx
<BarChart data={barData}>
  <CartesianGrid strokeDasharray="3 3" />
  <XAxis dataKey="range" tick={{ fontSize: 11 }} />
  <YAxis tick={{ fontSize: 12 }} />
  <Tooltip formatter={(value) => [`${value} 间`, '房间数']} />
  <Bar dataKey="count" fill="#52c41a" radius={[4, 4, 0, 0]} />
</BarChart>
```

### PieChart（环形图）

```tsx
const COLORS = ['#3B82F6', '#60A5FA', '#93C5FD', '#BFDBFE', '#DBEAFE'];

<PieChart>
  <Pie
    data={pieData}
    dataKey="count"
    nameKey="range"
    innerRadius={60}
    outerRadius={90}
    paddingAngle={3}
  >
    {pieData.map((_, index) => (
      <Cell key={index} fill={COLORS[index % COLORS.length]} />
    ))}
  </Pie>
  <Tooltip />
  <Legend />
</PieChart>;
```

**规则：**

- **始终**使用 `ResponsiveContainer` 包裹图表
- 外层 `div` 必须设置固定高度
- Tooltip `formatter` 不加显式类型注解（recharts v3 类型较严格）
- 柱状图圆角：`radius={[4, 4, 0, 0]}`
- 空数据时显示占位文案：`<div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF' }}>暂无数据</div>`

**图表配色：**

- 主数据：`#3B82F6`（蓝）
- 正向/收入：`#22C55E`（绿）
- 负向/支出：`#DC2626`（红）
- 辅助：`#60A5FA`、`#93C5FD`、`#EA580C`
