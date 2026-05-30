# 页面布局模式

## 1. 列表 / 网格页

**典型页面：** 公寓列表、租客列表、账单列表

```tsx
<div className="page-content">
  <PageHeader
    breadcrumb={[{ label: '公寓管理' }]}
    actions={
      <Button type="primary" icon={<PlusOutlined />}>
        新增公寓
      </Button>
    }
  />

  {/* 筛选栏 */}
  <div className={styles.filterBar}>
    <Input
      prefix={<SearchOutlined />}
      placeholder="搜索公寓名称或地址"
      allowClear
      style={{ width: 260 }}
    />
    <Select placeholder="状态筛选" allowClear style={{ width: 140 }} ... />
    <Select placeholder="物业类型" allowClear style={{ width: 140 }} ... />
  </div>

  <Spin spinning={loading}>
    {items.length === 0 ? (
      <Card>
        <EmptyState
          title="暂无公寓数据"
          description="当前组织下还没有创建任何公寓"
          action={{ label: '新增公寓', onClick: () => navigate('/apartments/new') }}
        />
      </Card>
    ) : (
      <>
        <div className={styles.grid}>
          {items.map((item) => (
            <Card key={item.id} hoverable onClick={...}>
              {/* card content */}
            </Card>
          ))}
        </div>
        <div className={styles.pagination}>
          <Pagination
            current={page}
            pageSize={pageSize}
            total={total}
            onChange={setPage}
          />
        </div>
      </>
    )}
  </Spin>
</div>
```

**SCSS：**

```scss
.filterBar {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 24px;
}

.pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 24px;
}
```

**规则：**

- 筛选栏用 flex row + `gap: 12px`
- 空状态包在 `<Card>` 内
- 网格布局用 CSS Grid，`minmax(340px, 1fr)`
- 整页内容包在 `<Spin spinning={loading}>` 中

---

## 2. 详情页（含 Tabs）

**典型页面：** 公寓详情、房间详情、租客详情

```tsx
<div className="page-content">
  <PageHeader
    back="/apartments"
    breadcrumb={[
      { label: '公寓管理', path: '/apartments' },
      { label: apartment.name },
    ]}
  />

  {loading && (
    <div style={{ padding: '120px 0', textAlign: 'center' }}>
      <Spin size="large" />
    </div>
  )}

  {!loading && !apartment && (
    <EmptyState
      title="公寓不存在或已删除"
      description="该公寓可能已被删除或您没有访问权限"
    />
  )}

  {!loading && apartment && (
    <Tabs
      items={[
        {
          key: 'detail',
          label: '公寓详情',
          children: (
            <>
              <DetailSection title={<> <HomeOutlined className="text-primary" /> 基本信息 </>} actions={...}>
                <Row gutter={[24, 0]}>
                  <Col span={8}><DetailItem label="...">...</DetailItem></Col>
                  ...
                </Row>
              </DetailSection>
              <DetailSection title={...}>...</DetailSection>
            </>
          ),
        },
        {
          key: 'dashboard',
          label: <span><BarChartOutlined /> 经营看板</span>,
          children: (...),
        },
        {
          key: 'rooms',
          label: `房间列表 (${count})`,
          children: (...),
        },
      ]}
    />
  )}
</div>
```

**规则：**

- 初始加载用全页 `<Spin size="large" />`（Pattern A）
- 数据不存在时返回 `<EmptyState>`
- 字段用 `DetailSection` 分组，每组内 `Row gutter={[24, 0]}` + `Col span={8}`
- Tab 标签可带图标和动态计数
- 切换 Tab 时重置搜索/筛选状态

---

## 3. 表单页

**典型页面：** 新增公寓、编辑公寓、新增租客

```tsx
<div className="page-content">
  <PageHeader back="/apartments" breadcrumb={[...]} />

  <Spin spinning={loading}>
    <Card className={styles.formCard}>
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <h3 className={styles.sectionTitle}>
          <HomeOutlined /> 基础信息
        </h3>
        <div className={styles.formRow}>
          <Form.Item label="名称" name="name" rules={[{ required: true }]}>
            <Input className="w-full" />
          </Form.Item>
          <Form.Item label="地址" name="location" rules={[{ required: true }]}>
            <Input className="w-full" />
          </Form.Item>
        </div>

        <Divider />

        <h3 className={styles.sectionTitle}>
          <DollarOutlined /> 运营配置
        </h3>
        <div className={styles.formRow}>
          <Form.Item label="电费成本单价" name="costElectricityPrice">
            <InputNumber min={0} step={0.01} className="w-full" />
          </Form.Item>
          <Form.Item label="水费成本单价" name="costWaterPrice">
            <InputNumber min={0} step={0.01} className="w-full" />
          </Form.Item>
        </div>

        <Divider />

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={saving}>
            保存
          </Button>
          <Button className={styles.cancelBtn} onClick={() => navigate(-1)}>
            取消
          </Button>
        </Form.Item>
      </Form>
    </Card>
  </Spin>
</div>
```

**SCSS：**

```scss
.formCard {
  max-width: 720px;
}

.sectionTitle {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.formRow {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.cancelBtn {
  margin-left: 12px;
}
```

**规则：**

- 表单卡片 `max-width: 720px`
- `layout="vertical"` 全局设置
- 两列布局用 `.form-row { grid-template-columns: 1fr 1fr; gap: 16px; }`
- 输入框全部加 `className="w-full"`
- 数字输入：`min={0}`，`step={0.01}`（金额）或 `step={1}`（整数）
- 分组标题：`<h3 className={styles.sectionTitle}><Icon /> 标题</h3>` + `<Divider />`
- 保存按钮在前，取消按钮在后，间距 `12px`

---

## 4. 报表 / 图表页

**典型页面：** 财务报表、经营看板

```tsx
<div className="page-content">
  <PageHeader breadcrumb={[{ label: '财务报表' }]} />

  <div style={{ marginBottom: 16, display: 'flex', gap: 12 }}>
    <DatePicker.MonthPicker />
    <Button type="primary" onClick={fetch} loading={loading}>
      查询
    </Button>
  </div>

  <Tabs activeKey={tab} onChange={setTab}>
    <Tabs.TabPane tab="应收应付" key="receivables">
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 48 }}>
          <div>
            <div className="text-muted">本月应收</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>
              ¥{money(summary.receivable)}
            </div>
          </div>
          ...
        </div>
      </Card>
      <Table ... />
    </Tabs.TabPane>
    <Tabs.TabPane tab="收支对比" key="comparison">
      <Card size="small" title="收支对比">
        <div style={{ height: 300 }}>
          <ResponsiveContainer>...</ResponsiveContainer>
        </div>
      </Card>
    </Tabs.TabPane>
  </Tabs>
</div>
```

**规则：**

- 筛选器放在 PageHeader 下方，flex row + `gap: 12px`
- 汇总数据用内联大数字（非 Statistic 组件）
- 图表包在 `Card size="small"` 中，内部 div 固定高度

---

## 5. Dashboard 首页

```tsx
<div className="page-content">
  <PageHeader breadcrumb={[{ label: '首页' }]} />

  {/* 统计卡片行 */}
  <Row gutter={16} className="mb-16">
    <Col xs={12} sm={6}>
      <StatCard title="总房间" value={totalRooms} ... />
    </Col>
    ...
  </Row>

  {/* 图表区 */}
  <Row gutter={16}>
    <Col xs={24} lg={12}>
      <Card size="small" title="入住率趋势">
        <div style={{ height: 260 }}>
          <ResponsiveContainer>...</ResponsiveContainer>
        </div>
      </Card>
    </Col>
    <Col xs={24} lg={12}>
      <Card size="small" title="租金分布">
        ...
      </Card>
    </Col>
  </Row>
</div>
```

**规则：**

- 顶部统计卡片一行 4 个（桌面端），移动端 2 个
- 图表并排两列，移动端堆叠（`xs={24} lg={12}`）
- 所有卡片 `size="small"`
