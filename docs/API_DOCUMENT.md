# Tenant Hub API 文档

> 本文档汇总系统所有需要实现的 API 接口。
> 所有 API 路径前缀为 `/api`，按功能模块组织。

---

## 一、认证与授权

| 方法 | 路径                        | 描述               |
| ---- | --------------------------- | ------------------ |
| POST | `/api/auth/register`        | 用户注册           |
| POST | `/api/auth/login`           | 账号密码登录       |
| POST | `/api/auth/login-sms`       | 短信验证码登录     |
| POST | `/api/auth/send-sms`        | 发送短信验证码     |
| POST | `/api/auth/refresh`         | 刷新访问令牌       |
| POST | `/api/auth/logout`          | 退出登录           |
| POST | `/api/auth/change-password` | 修改登录密码       |
| POST | `/api/auth/reset-password`  | 通过验证码重置密码 |

---

## 二、用户管理

| 方法   | 路径                                | 描述                 |
| ------ | ----------------------------------- | -------------------- |
| GET    | `/api/users/me`                     | 获取当前登录用户信息 |
| PUT    | `/api/users/me`                     | 更新当前用户信息     |
| GET    | `/api/users/me/sessions`            | 获取当前活跃会话列表 |
| DELETE | `/api/users/me/sessions/:sessionId` | 强制下线指定会话     |

---

## 三、组织管理

| 方法   | 路径                                          | 描述                 |
| ------ | --------------------------------------------- | -------------------- |
| GET    | `/api/organizations`                          | 查询用户所属组织列表 |
| POST   | `/api/organizations`                          | 创建新组织           |
| GET    | `/api/organizations/:id`                      | 查询组织详情         |
| PUT    | `/api/organizations/:id`                      | 更新组织信息         |
| DELETE | `/api/organizations/:id`                      | 删除组织             |
| POST   | `/api/organizations/:id/switch`               | 切换当前工作组织     |
| GET    | `/api/organizations/:id/settings`             | 获取组织配置         |
| PUT    | `/api/organizations/:id/settings`             | 更新组织配置         |
| GET    | `/api/organizations/:id/members`              | 获取组织成员列表     |
| POST   | `/api/organizations/:id/invite`               | 邀请用户加入组织     |
| DELETE | `/api/organizations/:id/members/:userId`      | 移除组织成员         |
| PUT    | `/api/organizations/:id/members/:userId/role` | 为成员分配角色       |

---

## 四、通知中心

| 方法   | 路径                              | 描述                               |
| ------ | --------------------------------- | ---------------------------------- |
| GET    | `/api/notifications`              | 获取通知列表（支持分页、已读筛选） |
| PUT    | `/api/notifications/:id/read`     | 标记单条通知已读                   |
| PUT    | `/api/notifications/read-all`     | 批量标记所有通知已读               |
| DELETE | `/api/notifications/:id`          | 删除通知                           |
| GET    | `/api/notifications/unread-count` | 获取未读通知数量                   |

---

## 五、公寓管理

| 方法   | 路径                                      | 描述                                     |
| ------ | ----------------------------------------- | ---------------------------------------- |
| GET    | `/api/apartments`                         | 查询公寓列表（支持分页、搜索、状态筛选） |
| POST   | `/api/apartments`                         | 创建公寓                                 |
| GET    | `/api/apartments/:id`                     | 查询公寓详情                             |
| PUT    | `/api/apartments/:id`                     | 更新公寓信息                             |
| DELETE | `/api/apartments/:id`                     | 软删除公寓（校验无关联房间）             |
| POST   | `/api/apartments/:id/status`              | 变更公寓状态                             |
| GET    | `/api/apartments/:id/status-history`      | 查询公寓状态变更历史                     |
| GET    | `/api/apartments/:id/dashboard`           | 获取公寓可视化看板数据                   |
| GET    | `/api/apartments/:id/expenses`            | 查询公寓运营支出列表                     |
| POST   | `/api/apartments/:id/expenses`            | 创建运营支出                             |
| DELETE | `/api/apartments/:id/expenses/:expenseId` | 删除运营支出                             |
| GET    | `/api/apartments/:id/expenses/summary`    | 运营支出汇总统计（按分类/年月聚合）      |

---

## 六、房间管理

| 方法   | 路径                                | 描述                                       |
| ------ | ----------------------------------- | ------------------------------------------ |
| GET    | `/api/rooms`                        | 查询房间列表（支持按公寓、状态、楼层筛选） |
| POST   | `/api/rooms`                        | 创建房间                                   |
| GET    | `/api/rooms/:id`                    | 查询房间详情（含当前租约、历史租约）       |
| PUT    | `/api/rooms/:id`                    | 更新房间信息                               |
| DELETE | `/api/rooms/:id`                    | 软删除房间（校验无活跃租约）               |
| POST   | `/api/rooms/:id/status`             | 变更房间状态（校验流转规则）               |
| POST   | `/api/rooms/batch`                  | 批量创建房间                               |
| PUT    | `/api/rooms/batch/facilities`       | 批量设置房间设施                           |
| PUT    | `/api/rooms/batch/rent`             | 批量调整房间租金                           |
| GET    | `/api/rooms/:id/leases`             | 查询房间历史租约                           |
| GET    | `/api/rooms/:id/maintenance-orders` | 查询房间维修工单                           |
| GET    | `/api/rooms/:id/checklists`         | 查询房间检查清单                           |

---

## 七、维修工单

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

## 八、检查清单

| 方法   | 路径                             | 描述                                         |
| ------ | -------------------------------- | -------------------------------------------- |
| GET    | `/api/checklists`                | 查询检查清单列表（支持按租约/房间/类型筛选） |
| POST   | `/api/checklists`                | 创建检查清单（入住/退租）                    |
| GET    | `/api/checklists/:id`            | 查询检查清单详情                             |
| PUT    | `/api/checklists/:id`            | 更新检查清单                                 |
| DELETE | `/api/checklists/:id`            | 删除检查清单                                 |
| GET    | `/api/checklists/:id/comparison` | 入住退租对比（生成扣款建议）                 |

---

## 九、房东合同

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

## 十、租客管理

| 方法   | 路径                            | 描述                                   |
| ------ | ------------------------------- | -------------------------------------- |
| GET    | `/api/tenants`                  | 查询租客列表（支持搜索、来源渠道筛选） |
| POST   | `/api/tenants`                  | 创建租客档案                           |
| GET    | `/api/tenants/:id`              | 查询租客详情（含信用评分）             |
| PUT    | `/api/tenants/:id`              | 更新租客信息                           |
| DELETE | `/api/tenants/:id`              | 软删除租客（校验无活跃租约）           |
| GET    | `/api/tenants/:id/leases`       | 查询租客历史租约                       |
| GET    | `/api/tenants/:id/account`      | 查询租客账户余额                       |
| GET    | `/api/tenants/:id/transactions` | 查询租客交易流水（支持分页、类型筛选） |
| POST   | `/api/tenants/:id/adjustments`  | 账户调账（正负调账，需原因）           |
| GET    | `/api/tenants/:id/credit`       | 查询租客信用评分详情                   |

---

## 十一、租约管理

| 方法   | 路径                                  | 描述                                               |
| ------ | ------------------------------------- | -------------------------------------------------- |
| GET    | `/api/leases`                         | 查询租约列表（支持按状态/公寓/房间/租客筛选）      |
| POST   | `/api/leases`                         | 创建租约（含校验、自动生成账单）                   |
| GET    | `/api/leases/:id`                     | 查询租约详情                                       |
| PUT    | `/api/leases/:id`                     | 更新租约基础信息                                   |
| DELETE | `/api/leases/:id`                     | 删除租约（仅限草稿状态）                           |
| POST   | `/api/leases/:id/changes`             | 提交租约变更（租金/押金/水电单价/附加费用/账单日） |
| GET    | `/api/leases/:id/changes`             | 查询租约变更记录                                   |
| POST   | `/api/leases/:id/renew`               | 续租（创建新租约，更新原租约状态）                 |
| POST   | `/api/leases/:id/transfer`            | 换房（原子性执行退租+新签+押金转结）               |
| POST   | `/api/leases/:id/terminate`           | 发起退租申请                                       |
| GET    | `/api/leases/:id/termination-preview` | 退租结算预览（计算各项费用）                       |
| POST   | `/api/leases/:id/termination-submit`  | 提交退租结算（执行完整流程）                       |
| POST   | `/api/leases/:id/termination-payment` | 退租结算资金收付                                   |
| GET    | `/api/leases/:id/bills`               | 查询租约关联账单                                   |
| GET    | `/api/leases/:id/cohabitants`         | 查询租约同住人                                     |

---

## 十二、同住人管理

| 方法   | 路径                                        | 描述                       |
| ------ | ------------------------------------------- | -------------------------- |
| GET    | `/api/leases/:id/cohabitants`               | 查询同住人列表             |
| POST   | `/api/leases/:id/cohabitants`               | 添加同住人（校验数量限制） |
| PUT    | `/api/leases/:id/cohabitants/:cohabitantId` | 更新同住人信息             |
| DELETE | `/api/leases/:id/cohabitants/:cohabitantId` | 移除同住人                 |

---

## 十三、水电表具

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

## 十四、抄表管理

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

## 十五、账单管理

| 方法   | 路径                             | 描述                                          |
| ------ | -------------------------------- | --------------------------------------------- |
| GET    | `/api/bills`                     | 查询账单列表（支持按状态/租客/公寓/日期筛选） |
| POST   | `/api/bills`                     | 手动创建账单                                  |
| POST   | `/api/bills/generate`            | 手动触发生成账单                              |
| POST   | `/api/bills/batch-generate`      | 批量生成账单                                  |
| GET    | `/api/bills/:id`                 | 查询账单详情                                  |
| PUT    | `/api/bills/:id`                 | 更新账单                                      |
| DELETE | `/api/bills/:id`                 | 删除账单（仅限未收款）                        |
| POST   | `/api/bills/:id/void`            | 作废账单（需原因）                            |
| POST   | `/api/bills/:id/write-off`       | 核销账单（坏账审批）                          |
| POST   | `/api/bills/:id/split`           | 拆分账单                                      |
| POST   | `/api/bills/merge`               | 合并多笔账单                                  |
| GET    | `/api/bills/:id/items`           | 查询账单子项                                  |
| PUT    | `/api/bills/:id/items/:itemId`   | 更新账单子项                                  |
| GET    | `/api/bills/:id/late-fees`       | 查询账单滞纳金                                |
| POST   | `/api/bills/:id/late-fees/waive` | 滞纳金减免申请（需审批）                      |
| POST   | `/api/bills/:id/notify`          | 手动发送账单通知                              |

---

## 十六、收款管理

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

## 十七、退款管理

| 方法 | 路径                       | 描述                           |
| ---- | -------------------------- | ------------------------------ |
| GET  | `/api/refunds`             | 查询退款列表（支持按状态筛选） |
| POST | `/api/refunds`             | 提交退款申请                   |
| GET  | `/api/refunds/:id`         | 查询退款详情                   |
| PUT  | `/api/refunds/:id`         | 更新退款申请                   |
| PUT  | `/api/refunds/:id/approve` | 审批通过退款                   |
| PUT  | `/api/refunds/:id/reject`  | 拒绝退款                       |
| POST | `/api/refunds/:id/execute` | 执行退款（更新账户余额）       |

---

## 十八、发票管理

| 方法   | 路径                       | 描述                                    |
| ------ | -------------------------- | --------------------------------------- |
| GET    | `/api/invoices`            | 查询发票列表（支持按状态筛选）          |
| POST   | `/api/invoices`            | 申请发票                                |
| GET    | `/api/invoices/:id`        | 查询发票详情                            |
| PUT    | `/api/invoices/:id`        | 更新发票信息                            |
| PUT    | `/api/invoices/:id/status` | 更新发票状态（待开/已开/已寄出/已签收） |
| DELETE | `/api/invoices/:id`        | 删除发票申请                            |

---

## 十九、押金管理

| 方法 | 路径                        | 描述                                       |
| ---- | --------------------------- | ------------------------------------------ |
| GET  | `/api/deposits`             | 查询押金列表（支持按状态筛选）             |
| GET  | `/api/deposits/:id`         | 查询押金详情                               |
| POST | `/api/deposits/:id/collect` | 押金收款登记                               |
| POST | `/api/deposits/:id/refund`  | 押金退款登记                               |
| POST | `/api/deposits/:id/deduct`  | 押金抵扣登记（欠费/损坏赔偿）              |
| GET  | `/api/deposits/:id/ledger`  | 查询押金台账（时间线）                     |
| GET  | `/api/deposits/summary`     | 押金汇总统计（在押总额/待退总额/状态分布） |

---

## 二十、出纳日记账

| 方法   | 路径                        | 描述                                            |
| ------ | --------------------------- | ----------------------------------------------- |
| GET    | `/api/cash-journal`         | 查询出纳日记账（支持按科目/日期/公寓/租客筛选） |
| POST   | `/api/cash-journal`         | 手动录入资金流水                                |
| GET    | `/api/cash-journal/:id`     | 查询资金流水详情                                |
| PUT    | `/api/cash-journal/:id`     | 更新资金流水                                    |
| DELETE | `/api/cash-journal/:id`     | 删除资金流水                                    |
| GET    | `/api/cash-journal/summary` | 资金流水汇总统计                                |

---

## 二十一、资金账户

| 方法   | 路径                             | 描述                                |
| ------ | -------------------------------- | ----------------------------------- |
| GET    | `/api/accounts`                  | 查询资金账户列表                    |
| POST   | `/api/accounts`                  | 创建资金账户                        |
| GET    | `/api/accounts/:id`              | 查询账户详情及余额                  |
| PUT    | `/api/accounts/:id`              | 更新账户信息                        |
| DELETE | `/api/accounts/:id`              | 删除资金账户                        |
| POST   | `/api/accounts/transfer`         | 账户间转账                          |
| GET    | `/api/accounts/:id/transfers`    | 查询账户转账记录                    |
| GET    | `/api/accounts/:id/daily-report` | 获取资金日报（期初+收入-支出=期末） |

---

## 二十二、财务报表

| 方法 | 路径                                | 描述                       |
| ---- | ----------------------------------- | -------------------------- |
| GET  | `/api/reports/receivables-payables` | 应收应付报表               |
| GET  | `/api/reports/income-expense`       | 收支报表（按科目/月/公寓） |
| GET  | `/api/reports/collection-rate`      | 收缴率分析报表             |
| GET  | `/api/reports/occupancy`            | 入住率分析报表             |
| GET  | `/api/reports/apartment-profit`     | 公寓级盈亏分析             |
| GET  | `/api/reports/overdue-analysis`     | 逾期账款分析               |

---

## 二十三、角色权限

| 方法   | 路径                     | 描述                                   |
| ------ | ------------------------ | -------------------------------------- |
| GET    | `/api/roles`             | 查询角色列表（含系统角色和自定义角色） |
| POST   | `/api/roles`             | 创建自定义角色                         |
| GET    | `/api/roles/:id`         | 查询角色详情及权限                     |
| PUT    | `/api/roles/:id`         | 更新角色权限                           |
| DELETE | `/api/roles/:id`         | 删除自定义角色                         |
| GET    | `/api/permissions`       | 查询系统权限列表（按模块）             |
| GET    | `/api/roles/:id/members` | 查询角色下成员列表                     |

---

## 二十四、审计日志

| 方法 | 路径                  | 描述                                                |
| ---- | --------------------- | --------------------------------------------------- |
| GET  | `/api/audit-logs`     | 查询审计日志（支持按表名/操作类型/日期/操作人筛选） |
| GET  | `/api/audit-logs/:id` | 查询审计日志详情                                    |

---

## 二十五、Dashboard

| 方法 | 路径                               | 描述                                        |
| ---- | ---------------------------------- | ------------------------------------------- |
| GET  | `/api/dashboard/overview`          | 运营总览数据（核心指标卡片）                |
| GET  | `/api/dashboard/todos`             | 待办事项（到期租约/工单/逾期账单/合同到期） |
| GET  | `/api/dashboard/recent-activities` | 最近动态（签约/收款/工单）                  |

---

## 二十六、定时任务（内部 API）

| 方法 | 路径                             | 描述                     |
| ---- | -------------------------------- | ------------------------ |
| POST | `/api/jobs/bill-generation`      | 手动触发账单生成任务     |
| POST | `/api/jobs/late-fee-calculation` | 手动触发滞纳金计算任务   |
| POST | `/api/jobs/lease-expiry-check`   | 手动触发租约到期检查任务 |
| POST | `/api/jobs/contract-reminder`    | 手动触发合同到期提醒任务 |
| GET  | `/api/jobs/status`               | 查询定时任务执行状态     |

---

_文档结束 — 共 200+ 个 API 接口_
