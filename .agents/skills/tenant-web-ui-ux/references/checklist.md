# UI/UX 检查清单

开发或修改 UI 相关代码后，对照以下清单检查：

## 视觉与样式

- [ ] 配色是否遵循主色调，无渐变
- [ ] 样式文件中是否使用 SCSS/CSS 变量，无写死色值

## 按钮与操作

- [ ] 每组按钮是否仅有一个主色按钮
- [ ] 页面级删除是否使用 `type="primary" danger`
- [ ] 表单内行删除是否使用 `type="link" danger`
- [ ] 默认按钮是否使用 `type="default"` 带边框样式
- [ ] 卡片操作按钮是否使用图标按钮 + Tooltip

## 输入与表单

- [ ] 输入框是否默认大小；Search 是否用 `<Input.Search />`
- [ ] 数字输入框是否使用 `InputNumber` 带拨轮
- [ ] 表单弹窗是否 `footer={null}`
- [ ] 表单是否使用 `layout="vertical"`，容器宽度 600-720px
- [ ] Form 内的 Switch 是否设置 `valuePropName="checked"`
- [ ] 动态字段是否使用 `Form.List`
- [ ] 表单内单选是否使用 `Radio.Group`（而非页面级用 Tabs）

## 表格

- [ ] 表格高度是否自适应视口，仅表体滚动
- [ ] 表格操作列是否 `fixed: 'right'`
- [ ] 表格顶部操作按钮是否靠右
- [ ] 表格分页是否使用 `pageSize: 10`
- [ ] 表格单元格内 Select 是否用 `size="small"`
- [ ] 列表页 Table 是否直接展示（无外层 Card）

## 状态与反馈

- [ ] 状态展示是否使用 `<Tag>` 且颜色映射正确
- [ ] 空态是否使用 `<EmptyState>` 组件
- [ ] 页面加载是否用 `<Spin>`（默认大小），表格加载用 `loading` prop
- [ ] 表单提交是否使用独立的 saving 状态控制按钮 loading
- [ ] message 是否仅用 `.success`/`.error`/`.warning`
- [ ] 内联删除是否使用 `<Popconfirm>`，`okButtonProps` 是否设置 `danger`

## 页面结构

- [ ] 详情视图是否未使用 Card，是否使用 `DetailSection + DetailItem`
- [ ] 详情页操作按钮是否下放到对应区块，而非全堆在 PageHeader
- [ ] 筛选是否使用 Tabs（不用 Radio.Group 做页面级筛选）
- [ ] 列表页是否存在与首页或其他页面重复的统计信息
- [ ] 表单页是否使用 Card 包裹
