# Tenant Hub 前端页面文档

> 本文档汇总系统所有前端页面，标注每个页面实现的功能及调用的 API。
> 页面组织按功能模块划分。

---

## 零、系统基础功能页面

### 登录页面 `(PAGE-001)`

**功能描述：**

- 用户手机号+密码登录
- 用户手机号+短信验证码登录
- 忘记密码入口
- 注册账号入口

**使用 API：**

- `POST /api/auth/login` — 账号密码登录
- `POST /api/auth/login-sms` — 短信验证码登录
- `POST /api/auth/send-sms` — 发送登录验证码

---

### 注册页面 `(PAGE-002)`

**功能描述：**

- 手机号注册，短信验证码校验
- 设置登录密码
- 注册成功后自动登录

**使用 API：**

- `POST /api/auth/send-sms` — 发送注册验证码
- `POST /api/auth/register` — 用户注册

---

### 忘记密码页面 `(PAGE-003)`

**功能描述：**

- 通过手机号+短信验证码重置密码
- 设置新密码

**使用 API：**

- `POST /api/auth/send-sms` — 发送重置验证码
- `POST /api/auth/reset-password` — 重置密码

---

### 个人中心页面 `(PAGE-004)`

**功能描述：**

- 展示和修改个人基本信息（昵称、头像、联系方式）
- 修改登录密码
- 展示所属组织列表
- 退出登录

**使用 API：**

- `GET /api/users/me` — 获取当前用户信息
- `PUT /api/users/me` — 更新用户信息
- `POST /api/auth/change-password` — 修改密码
- `GET /api/organizations` — 获取组织列表
- `POST /api/auth/logout` — 退出登录

---

### 组织管理页面 `(PAGE-005)`

**功能描述：**

- 创建新组织
- 查看已加入的组织列表
- 切换当前工作组织
- 维护组织基本信息和 Logo
- 组织级参数配置

**使用 API：**

- `POST /api/organizations` — 创建组织
- `GET /api/organizations` — 查询组织列表
- `PUT /api/organizations/:id` — 更新组织信息
- `POST /api/organizations/:id/switch` — 切换当前组织
- `GET /api/organizations/:id/settings` — 获取组织配置
- `PUT /api/organizations/:id/settings` — 更新组织配置

---

### 组织成员管理页面 `(PAGE-006)`

**功能描述：**

- 查看组织成员列表及角色
- 邀请用户加入组织（通过手机号）
- 移除组织成员
- 为成员分配/修改角色

**使用 API：**

- `GET /api/organizations/:id/members` — 获取成员列表
- `POST /api/organizations/:id/invite` — 邀请成员
- `DELETE /api/organizations/:id/members/:userId` — 移除成员
- `PUT /api/organizations/:id/members/:userId/role` — 分配角色

---

### 通知中心页面 `(PAGE-007)`

**功能描述：**

- 系统消息列表展示
- 消息已读/未读标记
- 批量标记已读
- 消息筛选（全部/未读）

**使用 API：**

- `GET /api/notifications` — 获取通知列表
- `PUT /api/notifications/:id/read` — 标记单条已读
- `PUT /api/notifications/read-all` — 批量标记已读
- `DELETE /api/notifications/:id` — 删除通知

---

## 一、物业管理模块页面

### 公寓列表页面 `(PAGE-101)`

**功能描述：**

- 按组织展示所有公寓卡片/表格
- 支持按名称搜索
- 支持按状态筛选
- 快捷进入公寓详情、编辑、删除

**使用 API：**

- `GET /api/apartments` — 查询公寓列表（支持分页、搜索、筛选）
- `DELETE /api/apartments/:id` — 删除公寓

---

### 公寓新增/编辑页面 `(PAGE-102)`

**功能描述：**

- 录入/修改公寓基础信息：名称、地址、物业类型、建筑年代、总层数、电梯数量
- 录入/修改产权信息：产权性质、产权面积、公摊比例
- 录入/修改房东合同信息：房东姓名、联系方式、合同起止日期、月租金、付款方式、递增规则
- 录入/修改运营配置：水电成本单价、公摊比例、提醒日设置
- 录入/修改消防与安全信息：消防等级、灭火器数量、逃生通道数量

**使用 API：**

- `POST /api/apartments` — 创建公寓
- `GET /api/apartments/:id` — 查询公寓详情
- `PUT /api/apartments/:id` — 更新公寓

---

### 公寓详情页面 `(PAGE-103)`

**功能描述：**

- 展示公寓完整档案信息（只读视图）
- 展示公寓当前状态
- 展示状态变更历史记录
- 快捷入口：查看房间列表、运营支出、看板数据

**使用 API：**

- `GET /api/apartments/:id` — 查询公寓详情
- `GET /api/apartments/:id/status-history` — 查询状态变更历史

---

### 公寓状态变更页面/弹窗 `(PAGE-104)`

**功能描述：**

- 选择目标状态（筹建中→装修中→待开业→运营中→停业整改→退租关闭）
- 填写状态变更原因
- 系统校验约束（如只有运营中允许签约）

**使用 API：**

- `POST /api/apartments/:id/status` — 变更公寓状态

---

### 公寓运营支出页面 `(PAGE-105)`

**功能描述：**

- 展示该公寓的所有支出记录列表
- 录入新的运营支出（名称、分类、金额、日期、备注）
- 按分类汇总支出金额
- 支持月度/年度汇总视图
- 与房东付款计划关联一键转支出

**使用 API：**

- `GET /api/apartments/:id/expenses` — 查询运营支出列表
- `POST /api/apartments/:id/expenses` — 创建运营支出
- `DELETE /api/apartments/:id/expenses/:expenseId` — 删除运营支出
- `GET /api/apartments/:id/expenses/summary` — 支出汇总统计

---

### 公寓可视化看板页面 `(PAGE-106)`

**功能描述：**

- 总房间数、已租数、空置数、维修中数量统计卡片
- 本月应收、已收、欠收金额统计卡片
- 入住率趋势图（最近12个月折线图）
- 租金单价分布图（柱状图/饼图）

**使用 API：**

- `GET /api/apartments/:id/dashboard` — 获取公寓仪表盘数据

---

### 房间列表页面 `(PAGE-107)`

**功能描述：**

- 按公寓展示房间卡片/表格
- 支持按状态（全部/空置/已租/维修中等）筛选
- 支持按楼层、户型筛选
- 快捷查看房间详情、编辑、删除
- 批量操作入口（批量设置设施、批量调整租金）

**使用 API：**

- `GET /api/rooms` — 查询房间列表（支持按公寓、状态、楼层筛选）
- `DELETE /api/rooms/:id` — 删除房间
- `PUT /api/rooms/batch/facilities` — 批量设置设施
- `PUT /api/rooms/batch/rent` — 批量调整租金

---

### 房间新增/编辑页面 `(PAGE-108)`

**功能描述：**

- 录入/修改房间号、楼层、户型、朝向、面积
- 设置装修标准和装修日期
- 编辑设施清单（支持自定义设施项）
- 管理房间状态

**使用 API：**

- `POST /api/rooms` — 创建房间
- `GET /api/rooms/:id` — 查询房间详情
- `PUT /api/rooms/:id` — 更新房间

---

### 房间批量创建页面 `(PAGE-109)`

**功能描述：**

- 选择公寓，指定起始楼层、结束楼层、每层房间数
- 自动生成房间号规则配置
- 预览将要生成的房间列表，支持勾选/取消个别房间
- 批量提交创建

**使用 API：**

- `POST /api/rooms/batch` — 批量创建房间

---

### 房间详情页面 `(PAGE-110)`

**功能描述：**

- 展示房间完整档案信息
- 展示当前租约信息
- 展示历史租约列表
- 展示维修工单列表
- 展示入住/退租检查记录
- 快捷操作：状态变更、创建工单、创建检查清单

**使用 API：**

- `GET /api/rooms/:id` — 查询房间详情
- `GET /api/rooms/:id/leases` — 查询房间历史租约
- `GET /api/rooms/:id/maintenance-orders` — 查询房间维修工单
- `GET /api/rooms/:id/checklists` — 查询房间检查清单

---

### 房间状态变更页面/弹窗 `(PAGE-111)`

**功能描述：**

- 选择目标状态，系统展示允许的状态流转选项
- 状态变更约束校验提示
- 填写变更原因（部分流转需要）

**使用 API：**

- `POST /api/rooms/:id/status` — 变更房间状态

---

### 维修工单列表页面 `(PAGE-112)`

**功能描述：**

- 表格展示所有维修工单
- 支持按状态/类型/优先级/公寓/房间筛选
- 快捷创建、编辑、查看详情
- 工单统计概览

**使用 API：**

- `GET /api/maintenance-orders` — 查询维修工单列表
- `DELETE /api/maintenance-orders/:id` — 删除工单

---

### 维修工单新增/编辑页面 `(PAGE-113)`

**功能描述：**

- 录入工单基本信息：标题、类型、优先级、问题描述
- 关联房间和报修人信息
- 设置预约上门时间
- 指派维修人员
- 记录维修费用（材料费、人工费）
- 上传完成照片
- 填写验收备注
- 状态流转操作

**使用 API：**

- `POST /api/maintenance-orders` — 创建维修工单
- `GET /api/maintenance-orders/:id` — 查询工单详情
- `PUT /api/maintenance-orders/:id` — 更新工单
- `POST /api/maintenance-orders/:id/status` — 变更工单状态

---

### 检查清单页面 `(PAGE-114)`

**功能描述：**

- 按租约/房间展示入住/退租检查记录列表
- 创建入住检查：录入水电表底数、设施完好情况、钥匙数量、卫生状况
- 创建退租检查：录入设施损坏情况、卫生状况、需扣款项目
- 检查项明细录入（按类别逐项检查）
- 拍照上传留存
- 入住退租状态对比，高亮差异项，展示扣款建议
- 录入扣款金额

**使用 API：**

- `GET /api/checklists` — 查询检查清单列表
- `POST /api/checklists` — 创建检查清单
- `GET /api/checklists/:id` — 查询检查清单详情
- `PUT /api/checklists/:id` — 更新检查清单
- `DELETE /api/checklists/:id` — 删除检查清单
- `GET /api/checklists/:id/comparison` — 入住退租对比

---

### 房东合同列表页面 `(PAGE-115)`

**功能描述：**

- 按公寓展示房东合同列表
- 展示合同起止日期、状态、到期提醒
- 支持搜索和筛选
- 快捷查看详情、编辑、删除

**使用 API：**

- `GET /api/landlord-contracts` — 查询房东合同列表
- `DELETE /api/landlord-contracts/:id` — 删除合同

---

### 房东合同新增/编辑页面 `(PAGE-116)`

**功能描述：**

- 录入/修改合同编号、签约日期、起止日期
- 设置付款方式、租金金额、押金金额
- 设置租金递增规则（固定金额/百分比、递增周期）
- 设置免租期
- 上传合同附件（PDF）

**使用 API：**

- `POST /api/landlord-contracts` — 创建房东合同
- `GET /api/landlord-contracts/:id` — 查询合同详情
- `PUT /api/landlord-contracts/:id` — 更新合同

---

### 房东合同详情页面 `(PAGE-117)`

**功能描述：**

- 展示完整合同信息
- 附件预览/下载
- 合同到期提醒状态
- 关联付款计划入口

**使用 API：**

- `GET /api/landlord-contracts/:id` — 查询合同详情

---

### 房东付款计划页面 `(PAGE-118)`

**功能描述：**

- 展示根据合同自动生成的付款计划表
- 展示应付日期、应付金额、实付日期、实付金额、状态
- 录入实际付款记录（日期、金额、凭证号）
- 逾期付款预警标记
- 一键将付款记录转为公寓运营支出

**使用 API：**

- `GET /api/landlord-contracts/:id/payment-plan` — 查询付款计划
- `POST /api/landlord-contracts/:id/payment-plan/generate` — 生成付款计划
- `POST /api/landlord-contracts/:id/payments` — 记录实际付款
- `POST /api/landlord-contracts/:id/payments/:paymentId/convert-expense` — 付款转运营支出

---

## 二、运营模块页面

### 租客列表页面 `(PAGE-201)`

**功能描述：**

- 表格展示所有租客
- 支持按姓名/手机号搜索
- 支持按来源渠道筛选
- 快捷查看详情、编辑、删除
- 展示信用评分

**使用 API：**

- `GET /api/tenants` — 查询租客列表
- `DELETE /api/tenants/:id` — 删除租客

---

### 租客新增/编辑页面 `(PAGE-202)`

**功能描述：**

- 录入/修改租客基础信息：姓名、手机号、身份证号
- 上传身份证照片（正反面）
- 录入紧急联系人信息
- 录入工作信息（选填）
- 选择来源渠道

**使用 API：**

- `POST /api/tenants` — 创建租客
- `GET /api/tenants/:id` — 查询租客详情
- `PUT /api/tenants/:id` — 更新租客

---

### 租客详情页面 `(PAGE-203)`

**功能描述：**

- 展示租客完整档案
- 展示所有历史租约列表
- 展示信用评分及评分依据
- 展示账户余额（预付余额、押金余额、待付总额、净余额）
- 交易流水入口
- 同住人管理入口

**使用 API：**

- `GET /api/tenants/:id` — 查询租客详情
- `GET /api/tenants/:id/leases` — 查询租客历史租约
- `GET /api/tenants/:id/account` — 查询租客账户余额

---

### 同住人管理页面 `(PAGE-204)`

**功能描述：**

- 按租约展示同住人列表
- 新增同住人：姓名、身份证号、手机号、与主租客关系
- 编辑同住人信息
- 删除同住人
- 同住人数量限制提示（按户型）

**使用 API：**

- `GET /api/leases/:id/cohabitants` — 查询同住人列表
- `POST /api/leases/:id/cohabitants` — 创建同住人
- `PUT /api/leases/:id/cohabitants/:cohabitantId` — 更新同住人
- `DELETE /api/leases/:id/cohabitants/:cohabitantId` — 删除同住人

---

### 租客交易流水页面 `(PAGE-205)`

**功能描述：**

- 分页展示租客每一笔资金变动记录
- 展示时间、类型、金额、关联单据、操作人
- 支持按类型筛选

**使用 API：**

- `GET /api/tenants/:id/transactions` — 查询交易流水

---

### 账户调账页面/弹窗 `(PAGE-206)`

**功能描述：**

- 对租客账户进行正负调账
- 必须填写调账原因
- 调账记录生成审计记录

**使用 API：**

- `POST /api/tenants/:id/adjustments` — 账户调账

---

### 租约列表页面 `(PAGE-207)`

**功能描述：**

- 表格展示所有租约
- 支持按状态筛选（草稿/待生效/生效中/即将到期/退租结算中/已退租/到期关闭）
- 支持按公寓/房间/租客筛选
- 快捷查看详情、编辑、退租结算

**使用 API：**

- `GET /api/leases` — 查询租约列表
- `DELETE /api/leases/:id` — 删除租约

---

### 租约签订向导页面 `(PAGE-208)`

**功能描述：**

- 步骤式界面：选择房间 → 选择/录入租客 → 填写条款 → 确认
- 房间选择：只能从状态为空置的房间中选择
- 租客选择/录入：可选择已有租客或录入新租客
- 租期设置：起止日期、租金周期（月/季/年）
- 租金金额设置
- 账单日设置（默认1号）
- 水电单价设置（可覆盖公寓默认值）
- 押金规则设置（押N付M）
- 附加费用设置（支持添加/删除自定义费用）
- 免租期设置
- 自动续约开关
- 滞纳金规则设置
- 系统校验提示：房间是否空闲、租客是否有未结清欠款

**使用 API：**

- `GET /api/rooms` — 查询可选房间列表（筛选空置）
- `GET /api/tenants` — 查询租客列表
- `POST /api/tenants` — 创建新租客（如选择新租客）
- `POST /api/leases` — 创建租约

---

### 租约详情页面 `(PAGE-209)`

**功能描述：**

- 展示租约完整条款信息
- 展示租约当前状态
- 展示账单列表
- 展示变更记录历史
- 快捷操作：变更条款、续租、换房、退租结算
- 同住人管理

**使用 API：**

- `GET /api/leases/:id` — 查询租约详情
- `GET /api/leases/:id/bills` — 查询租约账单
- `GET /api/leases/:id/changes` — 查询变更记录
- `GET /api/leases/:id/cohabitants` — 查询同住人

---

### 租约变更页面/弹窗 `(PAGE-210)`

**功能描述：**

- 修改租金金额、押金金额、水电单价、附加费用、账单日
- 填写变更原因
- 展示变更前后对比
- 已终止租约禁止变更提示

**使用 API：**

- `POST /api/leases/:id/changes` — 提交租约变更

---

### 续租页面/弹窗 `(PAGE-211)`

**功能描述：**

- 选择原租约，展示原租约信息
- 填写新租期、新租金（可修改）
- 选择是否涨价续租
- 展示续租预览
- 确认后生成新租约

**使用 API：**

- `POST /api/leases/:id/renew` — 续租操作

---

### 换房页面/弹窗 `(PAGE-212)`

**功能描述：**

- 选择租客当前租约
- 选择目标新房间（空置房间）
- 展示换房预览：原房间退租结算、新房间签约、押金转结
- 租金按实际入住天数计算差额
- 确认后原子性执行换房流程

**使用 API：**

- `POST /api/leases/:id/transfer` — 换房操作

---

### 退租结算页面 `(PAGE-213)`

**功能描述：**

- 选择退租类型（到期退租/协商退租/违约退租/强制清退）
- 填写退租日期和原因
- 系统锁定租约（状态变为退租结算中）
- 执行退租检查清单（拍照、设施清点）
- 录入退租当日水电读数
- 系统计算结算金额预览：租金多退少补、水电费、押金退还/抵扣、违约金、赔偿金
- 展示应收/应退/净额明细
- 资金收付处理（收款或退款登记）
- 确认完成后更新租约和房间状态

**使用 API：**

- `POST /api/leases/:id/terminate` — 发起退租
- `GET /api/leases/:id/termination-preview` — 退租结算预览
- `POST /api/leases/:id/termination-submit` — 提交退租结算
- `POST /api/leases/:id/termination-payment` — 结算收款/退款

---

### 表具列表页面 `(PAGE-214)`

**功能描述：**

- 按公寓/房间/类型（水/电/气）/状态筛选展示表具
- 快捷新增、编辑、查看详情、更换表具

**使用 API：**

- `GET /api/meters` — 查询表具列表
- `DELETE /api/meters/:id` — 删除表具

---

### 表具新增/编辑页面 `(PAGE-215)`

**功能描述：**

- 录入/修改表具编号、类型、安装位置
- 设置初始读数、安装日期
- 管理表具状态（在用/已拆除/已更换）
- 设置父子表关系（指定父表）

**使用 API：**

- `POST /api/meters` — 创建表具
- `GET /api/meters/:id` — 查询表具详情
- `PUT /api/meters/:id` — 更新表具

---

### 表具详情页面 `(PAGE-216)`

**功能描述：**

- 展示表具完整档案
- 展示历史抄表记录列表
- 表具更换记录
- 快捷抄表入口

**使用 API：**

- `GET /api/meters/:id` — 查询表具详情
- `GET /api/meters/:id/readings` — 查询历史读数

---

### 表具更换页面/弹窗 `(PAGE-217)`

**功能描述：**

- 旧表标记为已拆除
- 录入新表信息（编号、初始读数等）
- 自动继承父子表关系

**使用 API：**

- `POST /api/meters/:id/replace` — 更换表具

---

### 抄表录入页面 `(PAGE-218)`

**功能描述：**

- 选择房间、选择表具类型
- 录入读数、日期、备注
- 选择抄表类型（月度例行/入住抄表/退租抄表/临期抄表）
- 读数校验提示（本期小于上期时告警）
- 用量异常检测提示（超过历史均值200%）

**使用 API：**

- `POST /api/meter-readings` — 创建抄表记录
- `GET /api/meters/:id/last-reading` — 获取上次读数

---

### 抄表批量导入页面 `(PAGE-219)`

**功能描述：**

- 上传 CSV 文件
- 预览解析结果，展示错误行
- 确认后批量导入

**使用 API：**

- `POST /api/meter-readings/batch-import` — 批量导入抄表

---

### 抄表记录页面 `(PAGE-220)`

**功能描述：**

- 展示历史抄表记录列表
- 支持按公寓/房间/类型/日期筛选
- 展示用量计算结果

**使用 API：**

- `GET /api/meter-readings` — 查询抄表记录列表

---

## 三、财务模块页面

### 账单列表页面 `(PAGE-301)`

**功能描述：**

- 表格展示所有账单
- 支持按状态/租客/公寓/房间/日期筛选
- 展示账单状态（草稿/待确认/待收/部分收款/已结清/已逾期/已核销/已作废）
- 快捷查看详情、收款、作废、核销
- 支持多选批量收款
- 手动生成/补发账单入口

**使用 API：**

- `GET /api/bills` — 查询账单列表
- `POST /api/bills/generate` — 手动生成账单
- `POST /api/bills/:id/void` — 作废账单
- `POST /api/bills/:id/write-off` — 核销账单

---

### 账单详情页面 `(PAGE-302)`

**功能描述：**

- 展示账单完整信息
- 展示账单子项列表（房租、水费、电费、管理费等）
- 展示子项独立状态
- 展示收款记录
- 展示滞纳金子项
- 快捷收款、拆分、合并操作

**使用 API：**

- `GET /api/bills/:id` — 查询账单详情
- `GET /api/bills/:id/items` — 查询账单子项
- `GET /api/bills/:id/payments` — 查询账单收款记录

---

### 收款登记页面 `(PAGE-303)`

**功能描述：**

- 选择账单（支持多选）或输入预付款金额
- 输入收款金额、方式、时间
- 选择收款方式（现金/银行转账/微信/支付宝/POS机/抵扣余额/其他）
- 系统自动按账龄分配（或手动指定各账单分配金额）
- 超额收款自动存入预付余额
- 收款后打印收据

**使用 API：**

- `POST /api/payments` — 创建收款记录
- `POST /api/payments/preview` — 收款分配预览

---

### 退款申请页面 `(PAGE-304)`

**功能描述：**

- 选择退款类型（退押金/退预付款/退多收款）
- 输入退款金额、原因
- 提交后进入审批流程
- 大额退款需二次确认提示
- 审批通过后执行退款

**使用 API：**

- `POST /api/refunds` — 提交退款申请
- `PUT /api/refunds/:id/approve` — 审批退款
- `PUT /api/refunds/:id/reject` — 拒绝退款

---

### 退款审批页面 `(PAGE-305)`

**功能描述：**

- 展示待审批退款列表
- 查看退款申请详情
- 执行审批通过/拒绝操作
- 填写审批意见

**使用 API：**

- `GET /api/refunds` — 查询退款列表（支持按状态筛选）
- `PUT /api/refunds/:id/approve` — 审批通过
- `PUT /api/refunds/:id/reject` — 审批拒绝

---

### 发票管理页面 `(PAGE-306)`

**功能描述：**

- 发票申请：选择收款记录，填写发票信息（抬头、税号、金额、内容、邮寄地址）
- 发票列表：展示所有发票申请，按状态筛选（待开/已开/已寄出/已签收）
- 发票状态更新操作
- 电子发票支持（预留）

**使用 API：**

- `GET /api/invoices` — 查询发票列表
- `POST /api/invoices` — 申请发票
- `PUT /api/invoices/:id/status` — 更新发票状态

---

### 押金列表页面 `(PAGE-307)`

**功能描述：**

- 展示所有押金记录
- 支持按状态筛选（待收/已收/部分退还/全额退还/已抵扣）
- 快捷查看详情、收款、退款、抵扣操作

**使用 API：**

- `GET /api/deposits` — 查询押金列表

---

### 押金详情页面 `(PAGE-308)`

**功能描述：**

- 展示押金金额、已收、已退、已抵扣、当前状态
- 时间线形式展示押金台账（每一笔收取、退还、抵扣记录）
- 快捷操作：收款、退款、抵扣

**使用 API：**

- `GET /api/deposits/:id` — 查询押金详情
- `GET /api/deposits/:id/ledger` — 查询押金台账

---

### 出纳日记账页面 `(PAGE-309)`

**功能描述：**

- 表格展示所有资金流水记录
- 支持按科目/日期/公寓/租客/收支类型筛选
- 手动录入一笔收支记录
- 展示字段：日期、收支类型、科目分类、金额、支付方式、对方、关联单据、摘要、操作人

**使用 API：**

- `GET /api/cash-journal` — 查询出纳日记账
- `POST /api/cash-journal` — 创建资金流水记录

---

### 资金账户页面 `(PAGE-310)`

**功能描述：**

- 展示所有资金账户列表（现金、银行账户、微信商户、支付宝商户）
- 展示各账户当前余额
- 账户间转账功能
- 展示转账记录历史
- 每日资金日报：期初余额 + 本日收入 - 本日支出 = 期末余额

**使用 API：**

- `GET /api/accounts` — 查询资金账户列表
- `POST /api/accounts/transfer` — 账户间转账
- `GET /api/accounts/:id/daily-report` — 获取资金日报

---

### 应收应付报表页面 `(PAGE-311)`

**功能描述：**

- 应收账款明细表：按租客/房间/公寓汇总，区分已到期/未到期
- 逾期账款分析：逾期天数分布图、逾期金额 TOP10 列表
- 应付账款展示：房东租金付款计划列表

**使用 API：**

- `GET /api/reports/receivables-payables` — 应收应付报表

---

### 收支报表页面 `(PAGE-312)`

**功能描述：**

- 收入统计表：按科目/按月/按公寓汇总
- 支出统计表：按科目/按月/按公寓汇总
- 收支对比：收入 - 支出 = 毛利
- 公寓级盈亏分析：各公寓的收入、成本、毛利对比表/图

**使用 API：**

- `GET /api/reports/income-expense` — 收支报表

---

### 收缴率分析页面 `(PAGE-313)`

**功能描述：**

- 月度收缴率计算展示
- 年度收缴率趋势图（折线图，12个月）
- 欠费租客名单及金额
- 收缴率排名（按公寓/管家）

**使用 API：**

- `GET /api/reports/collection-rate` — 收缴率分析报表

---

### 入住率分析页面 `(PAGE-314)`

**功能描述：**

- 当前入住率展示
- 历史入住率趋势图（12个月）
- 平均空置天数统计
- 续约率统计
- 退租率统计

**使用 API：**

- `GET /api/reports/occupancy` — 入住率分析报表

---

## 四、系统与权限模块页面

### 角色权限管理页面 `(PAGE-401)`

**功能描述：**

- 展示系统预置角色和自定义角色列表
- 创建自定义角色：输入名称，按功能模块勾选权限
- 编辑自定义角色权限
- 删除自定义角色（系统角色不可删除）
- 为组织成员分配角色
- 前端按钮/菜单根据权限显隐控制

**使用 API：**

- `GET /api/roles` — 查询角色列表
- `POST /api/roles` — 创建角色
- `PUT /api/roles/:id` — 更新角色
- `DELETE /api/roles/:id` — 删除角色
- `GET /api/permissions` — 查询权限列表

---

### 审计日志页面 `(PAGE-402)`

**功能描述：**

- 表格展示所有操作审计记录
- 支持按表名/操作类型/日期/操作人筛选
- 展示数据变更详情：操作人、时间、IP、操作类型、变更字段、旧值、新值
- 敏感操作（收款、退款、调账、退租结算、作废账单、删除记录）高亮标记
- 审计日志不可删除、不可修改（前端无删除按钮）

**使用 API：**

- `GET /api/audit-logs` — 查询审计日志列表

---

## 五、Dashboard 首页

### 运营总览 Dashboard `(PAGE-501)`

**功能描述：**

- 展示组织级核心指标：总公寓数、总房间数、入住率、本月应收、本月实收、欠费总额
- 待办事项：即将到期租约、待处理维修工单、逾期账单、合同到期提醒
- 快捷操作入口：新建租约、登记收款、录入抄表、创建工单
- 最近动态：最新签约、最新收款、最新工单

**使用 API：**

- `GET /api/dashboard/overview` — 运营总览数据
- `GET /api/dashboard/todos` — 待办事项
- `GET /api/dashboard/recent-activities` — 最近动态

---

_文档结束_
