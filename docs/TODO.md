# Tenant Hub 未完成功能清单与实施计划

> 本文档汇总系统当前所有未完成、缺失或损坏的功能，按优先级和模块分类，制定逐步实施计划。
> 最后更新：2026-05-30

---

## 一、基础功能模块（已完成 ✅）

| 功能                    | 状态 | 备注                             |
| ----------------------- | ---- | -------------------------------- |
| 用户注册                | ✅   | 含 OTP 验证                      |
| 用户登录（密码/验证码） | ✅   |                                  |
| 忘记密码                | ✅   | 刚修复，新增 reset-password 端点 |
| 修改密码                | ✅   |                                  |
| 密码强度校验            | ✅   | 刚增强，要求字母+数字            |
| 组织创建/切换           | ✅   |                                  |
| JWT 认证与 RBAC         | ✅   |                                  |
| Token 失效机制          | ✅   | 密码修改后自动失效               |

---

## 二、缺失的后端独立路由模块（高优先级）

### 2.1 退款管理 (`refunds.ts`) 🔴

**现状**：前端页面已存在 (`RefundsPage`, `RefundApprovalPage`)，但为**演示实现**，仅显示模拟数据

**缺失端点**：

- `GET /api/refunds` — 查询退款列表
- `POST /api/refunds` — 提交退款申请
- `GET /api/refunds/:id` — 查询退款详情
- `PUT /api/refunds/:id` — 更新退款申请
- `PUT /api/refunds/:id/approve` — 审批通过
- `PUT /api/refunds/:id/reject` — 拒绝退款
- `POST /api/refunds/:id/execute` — 执行退款

**涉及文件**：

- `apps/api/src/routes/` — 需新建 `refunds.ts`
- `apps/tenant-web/src/api/` — 需补充真实 API 调用
- `apps/tenant-web/src/pages/refunds/` — 需替换模拟数据为真实 API

---

### 2.2 资金账户管理 (`accounts.ts`) 🔴

**现状**：前端页面已存在 (`AccountsPage`)，但为**演示实现**

**缺失端点**：

- `GET /api/accounts` — 查询账户列表
- `POST /api/accounts` — 创建账户
- `GET /api/accounts/:id` — 查询账户详情
- `PUT /api/accounts/:id` — 更新账户
- `DELETE /api/accounts/:id` — 删除账户
- `POST /api/accounts/transfer` — 账户间转账
- `GET /api/accounts/:id/transfers` — 查询转账记录
- `GET /api/accounts/:id/daily-report` — 资金日报

**涉及文件**：

- `apps/api/src/routes/` — 需新建 `accounts.ts`
- `apps/tenant-web/src/api/` — 需补充真实 API 调用
- `apps/tenant-web/src/pages/accounts/` — 需替换模拟数据

---

### 2.3 收款管理独立路由 (`payments.ts`) 🟡

**现状**：收款功能耦合在 `bills.ts` 中 (`POST /bills/:id/payments`)，缺少独立管理端点

**缺失端点**：

- `GET /api/payments` — 查询收款记录列表
- `POST /api/payments` — 创建收款（支持多账单核销）
- `POST /api/payments/preview` — 收款分配预览
- `GET /api/payments/:id` — 查询收款详情
- `PUT /api/payments/:id` — 更新收款记录
- `DELETE /api/payments/:id` — 删除收款记录
- `GET /api/payments/:id/allocations` — 查询分配明细

**涉及文件**：

- `apps/api/src/routes/` — 需新建 `payments.ts`
- `apps/tenant-web/src/api/` — 需补充 API 模块

---

### 2.4 房间管理独立路由 (`rooms.ts`) 🟡

**现状**：房间路由耦合在 `apartments.ts` 中 (`GET /apartments/rooms` 等)

**缺失端点**：

- `GET /api/rooms` — 查询房间列表（独立端点）
- `POST /api/rooms` — 创建房间（独立端点）
- 其他房间相关端点已存在但分散在 apartments.ts

**涉及文件**：

- `apps/api/src/routes/` — 需从 apartments.ts 解耦

---

## 三、功能不完整或演示实现（中优先级）

### 3.1 组织成员管理 🟡

**现状**：`MembersPage` 已存在，但角色变更和移除成员为**演示实现**

**缺失功能**：

- 真实的角色变更 API 调用 (`PUT /organizations/:id/members/:userId/role`)
- 真实的移除成员 API 调用 (`DELETE /organizations/:id/members/:userId`)
- 邀请用户加入组织（通过手机号）

**涉及文件**：

- `apps/tenant-web/src/pages/settings/MembersPage.tsx`
- `apps/api/src/routes/organizations.ts` — 需确认端点是否已实现

---

### 3.2 发票管理 🟡

**现状**：`InvoicesPage` 已存在，使用真实 API，但后端功能可能不完整

**需要验证**：

- 后端 `invoices.ts` 路由是否完整
- 发票状态流转是否完善

---

### 3.3 阶梯单价 & 总分表公摊 🔵

**现状**：`FEATURE_REQUIREMENTS.md` 标注为**预留功能**

**缺失**：

- 后端阶梯计费逻辑
- 总分表公摊计算

**涉及文件**：

- `apps/api/src/services/billing.ts`

---

### 3.4 设施模板批量编辑 🔵

**现状**：`FEATURE_REQUIREMENTS.md` 标注仅支持创建时设置

**缺失**：

- 批量编辑房间设施模板
- 批量调整租金（现有 `rooms/batch` 仅支持创建）

---

## 四、缺失的页面（中低优先级）

### 4.1 组织内角色权限管理页面 🔵

**现状**：仅有平台运营后台版本 (`/ops/roles`)，缺少组织内的角色管理页面

**需求**：

- 在 `/settings/roles` 路径下创建组织内角色管理页面
- 支持自定义角色和权限分配

---

### 4.2 个人中心完整功能 🔵

**现状**：`AccountPage` 仅支持查看信息和修改密码

**缺失**：

- 修改用户名/昵称（后端 API 缺失 `PUT /auth/me`）
- 头像上传
- 活跃会话管理（查看/强制下线）

---

## 五、测试修复（高优先级）

### 5.1 当前测试失败统计（20 个失败）

#### A. 数据库连接问题（3 个失败）🔴

- `platform.test.ts` x3 — 需要 PostgreSQL 数据库连接
- **解决**：配置测试环境或使用内存数据库

#### B. 缺失 Prisma Mock（6 个失败）🔴

- `bills.test.ts` — `prisma.meterReading.findFirst is not a function`
- `leases.test.ts` — `Cannot read properties of undefined (reading 'findUnique')`
- `apartments.test.ts` — `Cannot read properties of undefined (reading 'length')`
- **解决**：补充测试中的 Prisma mock 数据

#### C. 业务逻辑变更（6 个失败）🟡

- `billingPayments.test.ts` x2 — `assertMonthlyBillPaymentAllowed` 函数导出变更
- `billingSettlement.test.ts` x3 — 结算账单状态管理逻辑变更
- `roles.test.ts` x2 — 角色权限列表新增 `tenant:view`, `meter:view`, `account:view`
- **解决**：同步更新测试预期值

#### D. 模块导入问题（5 个失败）🟡

- `bills.test.ts` — `detectAbnormalUsage` mock 导出缺失
- `leases.test.ts` — Prisma transaction mock 不完整
- **解决**：修复 vitest mock 配置

---

## 六、实施计划（建议顺序）

### 第一阶段：修复基础问题（本周）

1. ✅ **修复忘记密码**（已完成）
2. ✅ **增强密码强度**（已完成）
3. **修复测试** — 解决 20 个测试失败（按 A→D→B→C 顺序）
4. **补齐后端独立路由** — `refunds.ts`, `accounts.ts`

### 第二阶段：核心功能补齐（下周）

5. **退款管理** — 后端路由 + 前端 API 替换
6. **资金账户** — 后端路由 + 前端 API 替换
7. **组织成员管理** — 补齐真实 API 调用

### 第三阶段：功能完善（第三周）

8. **收款管理独立路由** — `payments.ts`
9. **房间路由解耦** — `rooms.ts`
10. **个人中心** — 补齐 `PUT /auth/me` 和头像上传

### 第四阶段：扩展功能（第四周）

11. **阶梯单价 & 公摊**
12. **组织内角色管理页面**
13. **设施模板批量编辑**
14. **小程序端补齐** — 忘记密码、维修管理等

---

## 八、快速检查清单

每次开发前请确认：

- [ ] 对应的 API 文档是否已更新
- [ ] 前端 PAGE 编码是否已分配
- [ ] 测试是否覆盖新增功能
- [ ] `pnpm format` 已执行
- [ ] `pnpm typecheck` 通过
- [ ] `pnpm lint` 通过

---

_本文档应随开发进度持续更新。_
