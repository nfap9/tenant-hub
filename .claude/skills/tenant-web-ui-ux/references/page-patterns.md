# 页面模式规范

## 列表页

```
PageHeader（面包屑 + 标题 + 页面级操作按钮如"新增"）
  → Tabs（筛选，标签显示数量）
    → Table / 卡片网格（直接展示，不加 Card 包裹）
```

### 规则

- **不要放统计卡片**：Tab 标签已显示数量，避免信息重复
- 操作按钮统一放在 `PageHeader` 的 `actions` 中
- Table 直接展示，不加 `<Card>` 包裹

**为什么**：列表页的核心任务是让用户快速浏览和定位数据。
额外的统计卡片会挤占内容区空间，降低信息密度。

## 详情页

详情页分为两种模式：

### 模式 A：详情视图（key:value 信息展示）

适用于房间详情、押金详情、账号设置等以**只读信息展示**为主的页面。

```
PageHeader（面包屑 + 标题，**不要**在这里放操作按钮）
  → DetailSection（标题 + actions）
    → Row/Col + DetailItem
  → Divider
  → DetailSection（标题 + actions）
    → Row/Col + DetailItem
```

**核心规则：**

1. **不使用 Card** 包裹详情信息。详情视图是信息展示，Card 会增加不必要的视觉层级
2. 使用 `DetailSection` + `DetailItem` 展示信息
3. 操作按钮下放到对应区块的 `actions` 中，不再堆在 `PageHeader`
4. 每行 2~3 个信息项，用 `Row gutter={[24, 0]}` + `Col span={12}` 或 `span={8}` 排列
5. 多个区块用 `<Divider />` 分隔
6. `DetailSection` 的 `title` 可以加入图标增强信息识别（如 `<><HomeOutlined /> 房间信息</>`）

**注意**：这是**只读信息展示**，不是表单录入页。表单录入/编辑页面见下文"表单页"模式。

**为什么把操作按钮从 PageHeader 下放**：
用户在查看"租约信息"时，"签约""退租"按钮就在信息旁边，
不需要视线从内容区跳到页面顶部再回来。这符合费茨定律——
目标越大、距离越短，操作越快。

**示例：**

```tsx
<DetailSection
  title={<><HomeOutlined /> 房间信息</>}
  actions={
    <>
      <Button icon={<EditOutlined />} onClick={...}>编辑</Button>
      <Popconfirm ...>
        <Button danger icon={<DeleteOutlined />}>删除</Button>
      </Popconfirm>
    </>
  }
>
  <Row gutter={[24, 0]}>
    <Col span={8}><DetailItem label="房间号">101</DetailItem></Col>
    <Col span={8}><DetailItem label="状态"><Tag color="success">空闲</Tag></DetailItem></Col>
    <Col span={8}><DetailItem label="所属公寓">阳光公寓</DetailItem></Col>
  </Row>
</DetailSection>
```

### 模式 B：Tab 切换的多视图页

适用于公寓详情页等有多个独立视图的场景。

```
PageHeader（面包屑 + 标题）
  → Tabs
    → Tab A：详情视图（DetailSection + DetailItem）
    → Tab B：子列表/其他视图（非详情模式）
```

**规则：**

- 只有多组 key:value 形式的 Tab 使用 DetailSection
- 其他 Tab（如房间列表）不用 DetailSection，保持其原有布局
- 每个 Tab 内独立处理操作按钮位置

## 卡片列表

卡片式列表的核心理念是：**卡片即入口，高频操作就近，不常用操作收敛到详情**。

### 信息层级

卡片内部从上到下：

| 层级 | 内容              | 样式                            |
| ---- | ----------------- | ------------------------------- |
| 1    | 主标识 + 状态标签 | Card `title`，font-heading，600 |
| 2    | 副标题            | 13px，muted 色                  |
| 3    | 核心元信息        | 12px，subtle 色                 |
| 4    | 补充信息          | 12px，subtle 色                 |

### 交互规则

- 卡片必须设置 `hoverable`，整体可点击进入详情
- **禁止**在卡片上放"查看""编辑""删除"按钮
- 高频操作（如签约、收款）可放在卡片上，但**不超过 3 个**
- 编辑/删除收敛到详情页 `PageHeader actions`

### 布局

使用 CSS Grid：

```scss
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}
```

## 表单页

适用于新增/编辑数据的录入页面（如新增房间、编辑租约）。

### 页面结构

```
PageHeader（面包屑 + 标题）
  → Card（包裹表单，提供明确的编辑边界）
    → Form（layout="vertical"）
      → 表单字段
      → 提交/取消按钮
```

**核心规则：**

1. **使用 Card 包裹表单**。表单是数据录入区域，Card 提供明确的视觉边界，让用户知道"这里是可以编辑的内容"
2. 表单容器限制最大宽度：复杂表单 `720px`，简单表单 `600px`
3. 通过 `margin: 0 auto` 或父容器 flex 居中

### 弹窗表单

- 始终设置 `footer={null}`，提交按钮放 Form 内部
- `onCancel` 中调用 `form.resetFields()`
- 同一弹窗切换新增/编辑时，在 `<Form>` 上加 `key` 强制重新挂载

### 表单布局

- 统一 `layout="vertical"`
- 不使用 `labelCol` / `wrapperCol`
- 并排字段用 CSS Grid：

```scss
.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
```

### 表单内行删除

表单内的动态字段列表（如租约的附加费用）中，行删除按钮使用 `type="link" danger`：

```tsx
<Button type="link" danger icon={<DeleteOutlined />} onClick={...}>
  删除
</Button>
```

**为什么用 link 而不是 primary danger**：表单内行删除是局部小操作，
不需要高对比度的主色按钮来吸引注意力，link 样式足够表达"可删除"的语义。

### 编辑回填

```tsx
useEffect(() => {
  if (isEdit && data && !initializedRef.current) {
    form.setFieldsValue({ ... });
    initializedRef.current = true;
  }
}, [isEdit, data, form]);
```

## 内容去重

- **首页 Dashboard** 已有经营概览，其他列表页不要重复统计卡片
- **房间页**：Tab 已显示数量，去掉顶部 StatCard
- **账单页**：Tab 已显示数量，去掉顶部统计卡片行

**为什么**：信息重复不会让用户更清楚，反而会增加扫读负担。
Tab 标签的计数是最精简的信息表达，不需要再用其他形式重复。

## Card 的合理使用

虽然规范强调"不要堆砌卡片"，但以下场景**允许**使用 Card：

| 场景               | 是否使用 Card | 原因                       |
| ------------------ | ------------- | -------------------------- |
| 表单页             | ✅            | 提供编辑边界               |
| 设置页导航区块     | ✅            | 低频页面，区块分组需要边界 |
| 卡片列表的单个卡片 | ✅            | 卡片列表本身就是 Card      |
| Dashboard 统计卡片 | ✅            | 概览需要视觉分组           |
| 列表页 Table       | ❌            | 增加不必要的边框           |
| 详情页信息展示     | ❌            | DetailSection 已足够       |
| 空态页面           | ❌            | EmptyState 直接展示        |
