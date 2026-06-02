# Tenant Hub API 文档

> 本文档反映 `apps/api` 中实际注册的所有 API 接口。
> 所有 API 路径前缀为 `/api`，按功能模块组织。

---

## 一、认证与授权

| 方法   | 路径                        | 描述               |
| ------ | --------------------------- | ------------------ |
| POST   | `/api/auth/register`        | 用户注册           |
| POST   | `/api/auth/login/password`  | 账号密码登录       |
| POST   | `/api/auth/login/otp`       | 短信验证码登录     |
| POST   | `/api/auth/send-sms`        | 发送短信验证码     |
| POST   | `/api/auth/refresh`         | 刷新访问令牌       |
| POST   | `/api/auth/logout`          | 退出登录           |
| POST   | `/api/auth/change-password` | 修改登录密码       |
| POST   | `/api/auth/reset-password`  | 通过验证码重置密码 |
| GET    | `/api/auth/me`              | 获取当前用户信息   |
| PUT    | `/api/auth/me`              | 更新当前用户信息   |

---

## 二、组织管理

| 方法   | 路径                                             | 描述                 |
| ------ | ------------------------------------------------ | -------------------- |
| GET    | `/api/organizations`                             | 查询用户所属组织列表 |
| POST   | `/api/organizations`                             | 创建新组织           |
| POST   | `/api/organizations/join`                        | 使用邀请码加入组织   |
| GET    | `/api/organizations/plans`                       | 查询套餐列表         |
| GET    | `/api/organizations/:organizationId`             | 查询组织详情         |
| PUT    | `/api/organizations/:organizationId`             | 更新组织信息         |
| DELETE | `/api/organizations/:organizationId`             | 删除组织             |
| POST   | `/api/organizations/:organizationId/switch`      | 切换当前工作组织     |
| GET    | `/api/organizations/:organizationId/invites`     | 获取邀请码列表       |
| POST   | `/api/organizations/:organizationId/invites`     | 生成邀请码           |
| GET    | `/api/organizations/:organizationId/subscription`| 查询组织订阅与配额   |
| POST   | `/api/organizations/:organizationId/subscriptions`| 订阅/更换套餐        |
| POST   | `/api/organizations/:organizationId/members`     | 添加成员             |
| GET    | `/api/organizations/:organizationId/members`     | 获取组织成员列表     |
| DELETE | `/api/organizations/:organizationId/members/:memberId` | 移除组织成员   |
| PUT    | `/api/organizations/:organizationId/members/:memberId/role` | 为成员分配角色 |
| POST   | `/api/organizations/:organizationId/transfer-owner` | 转移所有者身份      |

---

## 三、通知中心

| 方法   | 路径                              | 描述                               |
| ------ | --------------------------------- | ---------------------------------- |
| GET    | `/api/notifications`              | 获取通知列表（支持分页、已读筛选） |
| PUT    | `/api/notifications/read-all`     | 批量标记所有通知已读               |
| PATCH  | `/api/notifications/:id/read`     | 标记单条通知已读                   |
| DELETE | `/api/notifications/:id`          | 删除通知                           |
| GET    | `/api/notifications/unread-count` | 获取未读通知数量                   |

---

## 四、公寓管理

| 方法   | 路径                                        | 描述                                     |
| ------ | ------------------------------------------- | ---------------------------------------- |
| GET    | `/api/apartments`                           | 查询公寓列表（支持分页、搜索、状态筛选） |
| GET    | `/api/apartments/all`                       | 查询全量公寓列表                         |
| GET    | `/api/apartments/rooms`                     | 查询全量房间列表（跨公寓）               |
| POST   | `/api/apartments`                           | 创建公寓（可选附带房东合同）             |
| GET    | `/api/apartments/:id`                       | 查询公寓详情                             |
| PUT    | `/api/apartments/:id`                       | 更新公寓信息（可选更新房东合同）         |
| DELETE | `/api/apartments/:id`                       | 软删除公寓（校验无活跃租约）             |
| PATCH  | `/api/apartments/:id/status`                | 变更公寓状态                             |
| GET    | `/api/apartments/:id/status-history`        | 查询公寓状态变更历史                     |
| GET    | `/api/apartments/:id/dashboard`             | 获取公寓可视化看板数据                   |
| POST   | `/api/apartments/:id/expenses`              | 创建运营支出                             |
| GET    | `/api/apartments/:id/expense-summary`       | 运营支出汇总统计（按分类/年月聚合）      |
| POST   | `/api/apartments/:id/rooms/batch`           | 批量创建房间                             |
| PUT    | `/api/apartments/rooms/batch/facilities`    | 批量设置房间设施                         |
| PUT    | `/api/apartments/rooms/batch/rent`          | 批量调整房间租金                         |
| GET    | `/api/apartments/rooms/:roomId`             | 查询房间详情                             |
| PUT    | `/api/apartments/rooms/:roomId`             | 更新房间信息                             |
| DELETE | `/api/apartments/rooms/:roomId`             | 软删除房间                               |
| GET    | `/api/apartments/:id/occupancy-trend`       | 公寓入住率趋势（最近12个月）             |
| GET    | `/api/apartments/:id/rent-distribution`     | 公寓租金单价分布                         |

---

## 五、房间管理

| 方法 | 路径          | 描述               |
| ---- | ------------- | ------------------ |
| POST | `/api/rooms`  | 创建房间（指定公寓） |

> 房间的查询/更新/删除/批量操作均在 `/api/apartments` 下提供。

---

## 六、维修工单

| 方法   | 路径                                   | 描述                               |
| ------ | -------------------------------------- | ---------------------------------- |
| GET    | `/api/maintenance-orders`              | 查询维修工单列表（支持多维度筛选） |
| POST   | `/api/maintenance-orders`              | 创建维修工单                       |
| GET    | `/api/maintenance-orders/:id`          | 查询维修工单详情                   |
| PUT    | `/api/maintenance-orders/:id`          | 更新维修工单                       |
| DELETE | `/api/maintenance-orders/:id`          | 软删除维修工单                     |
| POST   | `/api/maintenance-orders/:id/status`   | 变更工单状态                       |
| POST   | `/api/maintenance-orders/:id/assign`   | 指派维修人员                       |
| POST   | `/api/maintenance-orders/:id/complete` | 完成工单（含照片、费用）           |
| POST   | `/api/maintenance-orders/:id/accept`   | 验收工单                           |

---

## 七、检查清单

| 方法   | 路径                             | 描述                                         |
| ------ | -------------------------------- | -------------------------------------------- |
| GET    | `/api/checklists`                | 查询检查清单列表（支持按租约/房间/类型筛选） |
| POST   | `/api/checklists`                | 创建检查清单（入住/退租）                    |
| GET    | `/api/checklists/:id`            | 查询检查清单详情                             |
| PUT    | `/api/checklists/:id`            | 更新检查清单                                 |
| DELETE | `/api/checklists/:id`            | 删除检查清单                                 |
| GET    | `/api/checklists/:id/comparison` | 入住退租对比（生成扣款建议）                 |

---

## 八、房东合同

| 方法   | 路径                                                              | 描述                               |
| ------ | ----------------------------------------------------------------- | ---------------------------------- |
| GET    | `/api/landlord-contracts`                                         | 查询房东合同列表（支持按公寓筛选） |
| POST   | `/api/landlord-contracts`                                         | 创建房东合同                       |
| GET    | `/api/landlord-contracts/:id`                                     | 查询房东合同详情                   |
| PUT    | `/api/landlord-contracts/:id`                                     | 更新房东合同                       |
| DELETE | `/api/landlord-contracts/:id`                                     | 软删除房东合同                     |
| GET    | `/api/landlord-contracts/:id/payment-plan`                        | 查询付款计划                       |
| POST   | `/api/landlord-contracts/:id/payment-plan/generate`               | 根据合同生成付款计划               |
| POST   | `/api/landlord-contracts/:id/payments`                            | 记录实际付款                       |
| POST   | `/api/landlord-contracts/:id/payments/:paymentId/convert-expense` | 付款记录转为运营支出               |

---

## 九、租客管理

| 方法   | 路径                              | 描述                                   |
| ------ | --------------------------------- | -------------------------------------- |
| GET    | `/api/tenants`                    | 查询租客列表                           |
| GET    | `/api/tenants/search`             | 搜索租客                               |
| POST   | `/api/tenants`                    | 创建租客档案                           |
| GET    | `/api/tenants/:id`                | 查询租客详情                           |
| PUT    | `/api/tenants/:id`                | 更新租客信息                           |
| DELETE | `/api/tenants/:id`                | 软删除租客（校验无活跃租约）           |
| GET    | `/api/tenants/:id/account`        | 查询租客账户余额                       |
| GET    | `/api/tenants/:id/account/transactions` | 查询租客交易流水                  |
| POST   | `/api/tenants/:id/account/adjust` | 账户调账（正负调账，需原因）           |
| GET    | `/api/tenants/:id/credit`         | 查询租客信用评分详情                   |

---

## 十、租约管理

| 方法   | 路径                                  | 描述                                               |
| ------ | ------------------------------------- | -------------------------------------------------- |
| GET    | `/api/leases`                         | 查询租约列表（支持多维度筛选）                      |
| POST   | `/api/leases`                         | 创建租约（含校验、自动生成账单）                   |
| GET    | `/api/leases/:id`                     | 查询租约详情                                       |
| PUT    | `/api/leases/:id`                     | 更新租约基础信息                                   |
| DELETE | `/api/leases/:id`                     | 删除租约（仅限草稿状态）                           |
| POST   | `/api/leases/:id/changes`             | 提交租约变更（租金/押金/水电单价/附加费用/账单日） |
| GET    | `/api/leases/:id/changes`             | 查询租约变更记录                                   |
| POST   | `/api/leases/:id/renew`               | 续租（创建新租约，更新原租约状态）                 |
| POST   | `/api/leases/:id/room-change`         | 换房（原子性执行退租+新签+押金转结）               |
| POST   | `/api/leases/:id/terminate`           | 发起退租申请                                       |
| GET    | `/api/leases/:id/settlement-preview`  | 退租结算预览（计算各项费用）                       |
| GET    | `/api/leases/settlements`             | 查询退租结算列表                                   |
| POST   | `/api/leases/settlements/:id/payments`| 退租结算资金收付                                   |
| GET    | `/api/leases/:id/bills`               | 查询租约关联账单                                   |
| GET    | `/api/leases/:id/cohabitants`         | 查询租约同住人                                     |

---

## 十一、同住人管理

| 方法   | 路径                                        | 描述                       |
| ------ | ------------------------------------------- | -------------------------- |
| GET    | `/api/leases/:id/cohabitants`               | 查询同住人列表             |
| POST   | `/api/leases/:id/cohabitants`               | 添加同住人（校验数量限制） |
| PUT    | `/api/leases/:id/cohabitants/:cid`          | 更新同住人信息             |
| DELETE | `/api/leases/:id/cohabitants/:cid`          | 移除同住人                 |

---

## 十二、水电表具

| 方法   | 路径                           | 描述                                          |
| ------ | ------------------------------ | --------------------------------------------- |
| GET    | `/api/meters`                  | 查询表具列表（支持按公寓/房间/类型/状态筛选） |
| POST   | `/api/meters`                  | 创建表具                                      |
| GET    | `/api/meters/:id`              | 查询表具详情                                  |
| PUT    | `/api/meters/:id`              | 更新表具信息                                  |
| DELETE | `/api/meters/:id`              | 软删除表具                                    |
| POST   | `/api/meters/:id/replace`      | 更换表具（原子性替换，继承关系）              |
| GET    | `/api/meters/:id/readings`     | 查询表具历史读数                              |
| GET    | `/api/meters/:id/last-reading` | 获取表具上次读数                              |

---

## 十三、抄表管理

| 方法   | 路径                               | 描述                                 |
| ------ | ---------------------------------- | ------------------------------------ |
| GET    | `/api/meter-readings`              | 查询抄表记录列表（支持多维筛选）     |
| POST   | `/api/meter-readings`              | 创建抄表记录（含读数校验、异常检测） |
| POST   | `/api/meter-readings/batch-import` | 批量导入抄表（解析 CSV）             |
| GET    | `/api/meter-readings/:id`          | 查询抄表记录详情                     |
| PUT    | `/api/meter-readings/:id`          | 更新抄表记录                         |
| DELETE | `/api/meter-readings/:id`          | 删除抄表记录                         |
| POST   | `/api/meter-readings/calculate`    | 输入读数计算费用                     |

---

## 十四、账单管理

| 方法   | 路径                             | 描述                                          |
| ------ | -------------------------------- | --------------------------------------------- |
| GET    | `/api/bills`                     | 查询账单列表（支持按状态/租客/公寓/日期筛选） |
| GET    | `/api/bills/utility`             | 查询水电账单列表                              |
| POST   | `/api/bills`                     | 手动创建账单                                  |
| POST   | `/api/bills/generate`            | 手动触发生成账单                              |
| GET    | `/api/bills/:id`                 | 查询账单详情                                  |
| PUT    | `/api/bills/:id`                 | 更新账单                                      |
| DELETE | `/api/bills/:id`                 | 删除账单（仅限未收款）                        |
| PATCH  | `/api/bills/:id/status`          | 变更账单状态                                  |
| PATCH  | `/api/bills/:id/write-off`       | 核销账单（坏账审批）                          |
| PATCH  | `/api/bills/:id/waive-late-fee`  | 减免滞纳金                                    |
| POST   | `/api/bills/:id/split`           | 拆分账单                                      |
| POST   | `/api/bills/merge`               | 合并多笔账单                                  |
| GET    | `/api/bills/:id/items`           | 查询账单子项                                  |
| PUT    | `/api/bills/:id/items/:itemId`   | 更新账单子项                                  |
| GET    | `/api/bills/:id/payments`        | 查询账单收款记录                              |
| GET    | `/api/bills/:id/late-fees`       | 查询账单滞纳金                                |
| POST   | `/api/bills/:id/late-fees/waive` | 滞纳金减免申请（需审批）                      |
| POST   | `/api/bills/:id/notify`          | 手动发送账单通知                              |

---

## 十五、收款管理

| 方法   | 路径                            | 描述                                      |
| ------ | ------------------------------- | ----------------------------------------- |
| GET    | `/api/payments`                 | 查询收款记录列表                          |
| POST   | `/api/payments`                 | 创建收款记录（支持多账单核销/预付款存入） |
| POST   | `/api/payments/preview`         | 收款分配预览（按账龄自动分配）            |
| GET    | `/api/payments/:id`             | 查询收款详情（含核销明细）                |
| PUT    | `/api/payments/:id`             | 更新收款记录                              |
| DELETE | `/api/payments/:id`             | 删除收款记录                              |
| GET    | `/api/payments/:id/allocations` | 查询收款分配明细                          |

---

## 十六、退款管理

| 方法   | 路径                       | 描述                           |
| ------ | -------------------------- | ------------------------------ |
| GET    | `/api/refunds`             | 查询退款列表（支持按状态筛选） |
| POST   | `/api/refunds`             | 提交退款申请                   |
| GET    | `/api/refunds/:id`         | 查询退款详情                   |
| PUT    | `/api/refunds/:id`         | 更新退款申请                   |
| PATCH  | `/api/refunds/:id/approve` | 审批通过退款                   |
| PATCH  | `/api/refunds/:id/reject`  | 拒绝退款                       |
| PATCH  | `/api/refunds/:id/execute` | 执行退款（更新账户余额）       |

---

## 十七、发票管理

| 方法   | 路径                       | 描述                                    |
| ------ | -------------------------- | --------------------------------------- |
| GET    | `/api/invoices`            | 查询发票列表（支持按状态筛选）          |
| POST   | `/api/invoices`            | 申请发票                                |
| GET    | `/api/invoices/:id`        | 查询发票详情                            |
| PATCH  | `/api/invoices/:id/status` | 更新发票状态（待开/已开/已寄出/已签收） |

---

## 十八、押金管理

| 方法 | 路径                        | 描述                                       |
| ---- | --------------------------- | ------------------------------------------ |
| GET  | `/api/deposits`             | 查询押金列表（支持按状态筛选）             |
| GET  | `/api/deposits/summary`     | 押金汇总统计（在押总额/待退总额/状态分布） |
| GET  | `/api/deposits/:id`         | 查询押金详情                               |
| POST | `/api/deposits/:id/collect` | 押金收款登记                               |
| POST | `/api/deposits/:id/refund`  | 押金退款登记                               |
| POST | `/api/deposits/:id/deduct`  | 押金抵扣登记（欠费/损坏赔偿）              |

> 押金台账（时间线）直接在详情中通过 `DepositLog` 关联返回。

---

## 十九、资金账户

| 方法   | 路径                             | 描述                                |
| ------ | -------------------------------- | ----------------------------------- |
| GET    | `/api/accounts`                  | 查询资金账户列表                    |
| POST   | `/api/accounts`                  | 创建资金账户                        |
| GET    | `/api/accounts/:id`              | 查询账户详情及余额                  |
| PUT    | `/api/accounts/:id`              | 更新账户信息                        |
| DELETE | `/api/accounts/:id`              | 删除资金账户                        |
| POST   | `/api/accounts/transfer`         | 账户间转账                          |
| GET    | `/api/accounts/transfers/all`    | 查询所有转账记录                    |
| GET    | `/api/accounts/:id/transfers`    | 查询指定账户转账记录                |
| GET    | `/api/accounts/:id/daily-report` | 获取资金日报（期初+收入-支出=期末） |

---

## 二十、财务报表

| 方法 | 路径                                  | 描述                       |
| ---- | ------------------------------------- | -------------------------- |
| GET  | `/api/reports/receivables`            | 应收应付报表               |
| GET  | `/api/reports/income-expense`         | 收支报表（按科目/月/公寓） |
| GET  | `/api/reports/income-expense-trend`   | 收支趋势报表               |
| GET  | `/api/reports/collection-rate`        | 收缴率分析报表             |
| GET  | `/api/reports/collection-rate-trend`  | 收缴率趋势报表             |
| GET  | `/api/reports/occupancy`              | 入住率分析报表             |
| GET  | `/api/reports/occupancy-trend`        | 入住率趋势报表             |
| GET  | `/api/reports/apartment-profit`       | 公寓级盈亏分析             |
| GET  | `/api/reports/overdue-analysis`       | 逾期账款分析               |

---

## 二十一、角色权限

| 方法   | 路径                     | 描述                                   |
| ------ | ------------------------ | -------------------------------------- |
| GET    | `/api/roles`             | 查询角色列表（含系统角色和自定义角色） |
| POST   | `/api/roles`             | 创建自定义角色                         |
| GET    | `/api/permissions`       | 查询系统权限列表（按模块）             |

---

## 二十二、审计日志

| 方法 | 路径              | 描述                                                |
| ---- | ----------------- | --------------------------------------------------- |
| GET  | `/api/audit-logs` | 查询审计日志（支持按表名/操作类型/日期/操作人筛选） |

---

## 二十三、Dashboard

| 方法 | 路径                               | 描述                                        |
| ---- | ---------------------------------- | ------------------------------------------- |
| GET  | `/api/dashboard/overview`          | 运营总览数据（核心指标卡片）                |
| GET  | `/api/dashboard/todos`             | 待办事项（到期租约/工单/逾期账单/合同到期） |
| GET  | `/api/dashboard/recent-activities` | 最近动态（签约/收款/工单）                  |

---

## 二十四、定时任务（内部 API）

| 方法 | 路径                             | 描述                     |
| ---- | -------------------------------- | ------------------------ |
| POST | `/api/jobs/bill-generation`      | 手动触发账单生成任务     |
| POST | `/api/jobs/late-fee-calculation` | 手动触发滞纳金计算任务   |
| POST | `/api/jobs/lease-expiry-check`   | 手动触发租约到期检查任务 |
| POST | `/api/jobs/contract-reminder`    | 手动触发合同到期提醒任务 |
| GET  | `/api/jobs/status`               | 查询定时任务执行状态     |

---

_文档结束 — 共约 180 个 API 接口_
