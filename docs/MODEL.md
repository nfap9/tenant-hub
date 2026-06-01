## 数据库与 ORM

### Prisma

- **Schema**：`apps/api/prisma/schema.prisma`（单文件，~1440 行）
- **迁移**：`apps/api/prisma/migrations/`（已有迁移覆盖 OTP、平台角色、账单月结、组织邀请、退租结算、软删除、账户与退款等）
- **主键策略**：全部使用 `cuid()`
- **金额字段**：统一使用 `Decimal` 类型
  - 常规金额：`db.Decimal(12, 2)`（最大 999,999,999,999.99）
  - 费率/比例：`db.Decimal(10, 4)` 或 `db.Decimal(10, 6)`（如滞纳金日利率 `0.0005`）
  - 公摊比例：`db.Decimal(5, 4)`
- **时区**：PostgreSQL `timestamp` 存储 UTC，`DateTime` 字段由应用层处理时区转换

---

### 核心模型总览

| 模型                                        | 用途                           | 软删除  |
| ------------------------------------------- | ------------------------------ | ------- |
| `User`                                      | 平台用户（手机号认证）         | ❌      |
| `OtpCode`                                   | 短信 OTP（存储哈希后的验证码） | ❌      |
| `Organization`                              | 租户组织（多租户核心）         | ❌      |
| `Role` / `OrgMember`                        | 组织内 RBAC                    | ❌      |
| `OrgInvite`                                 | 邀请码加入组织                 | ❌      |
| `Apartment`                                 | 房源/物业                      | ✅      |
| `Room`                                      | 房间                           | ✅      |
| `Tenant`                                    | 租客档案                       | ✅      |
| `CoResident`                                | 同住人                         | ❌      |
| `Lease` / `LeaseFee`                        | 租约与附加费用                 | ✅      |
| `LeaseChangeLog`                            | 租约字段变更历史               | ❌      |
| `LeaseSettlement`                           | 退租结算单                     | ✅      |
| `SettlementItem` / `SettlementPayment`      | 结算明细与收支                 | ✅      |
| `Deposit` / `DepositLedger`                 | 押金与押金流水                 | ✅      |
| `Bill` / `BillItem` / `BillItemReading`     | 账单与明细                     | ✅      |
| `Payment` / `PaymentAllocation`             | 收款与多账单分配               | ✅      |
| `OverduePenalty`                            | 滞纳金                         | ❌      |
| `Invoice`                                   | 发票                           | ❌      |
| `Refund`                                    | 退款申请                       | ❌      |
| `Meter` / `MeterReading`                    | 表具与抄表                     | ✅      |
| `MaintenanceOrder` / `MaintenanceOrderItem` | 维修工单                       | ✅      |
| `RoomChecklist` / `RoomChecklistItem`       | 入住/退房检查清单              | ❌      |
| `LandlordContract` / `LandlordPayment`      | 房东合同与付款                 | ✅ / ❌ |
| `ApartmentExpense`                          | 物业支出                       | ✅      |
| `IncomeExpenseCategory`                     | 收支分类                       | ❌      |
| `CashierJournal`                            | 出纳日记账                     | ❌      |
| `TenantAccount` / `AccountTransaction`      | 租客账户余额与流水             | ❌      |
| `Account` / `AccountTransfer`               | 组织资金账户与转账             | ❌      |
| `BillQueue`                                 | 账单生成队列                   | ❌      |
| `Plan` / `Subscription` / `OrgQuotaPackage` | SaaS 订阅与配额                | ❌      |
| `AuditLog`                                  | 操作审计日志                   | ❌      |
| `SystemSetting`                             | 平台键值配置                   | ❌      |
| `Notification`                              | 站内通知                       | ❌      |

---

### 枚举定义速查

| 枚举                     | 关键值                                                                                                                                       |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `PlatformRole`           | `USER`, `SUPER_ADMIN`                                                                                                                        |
| `OrgStatus`              | `ACTIVE`, `SUSPENDED`, `DELETED`                                                                                                             |
| `ApartmentStatus`        | `PLANNING`, `RENOVATING`, `PREPARING`, `ACTIVE`, `SUSPENDED`, `CLOSED`                                                                       |
| `RoomStatus`             | `TO_RENOVATE`, `TO_CONFIGURE`, `VACANT`, `RESERVED`, `OCCUPIED`, `MAINTENANCE`, `CHECKOUT_CLEANING`                                          |
| `LeaseStatus`            | `DRAFT`, `PENDING`, `ACTIVE`, `EXPIRING_SOON`, `TERMINATING`, `TERMINATED`, `EXPIRED`, `RENEWED`                                             |
| `BillStatus`             | `DRAFT`, `BILLING`, `UNPAID`, `PARTIAL_PAID`, `PAID`, `OVERDUE`, `WRITTEN_OFF`, `REFUNDED`, `FAILED`, `VOID`                                 |
| `BillMode`               | `PREPAID`, `POSTPAID`, `DEPOSIT`                                                                                                             |
| `BillItemType`           | `RENT`, `SERVICE_FEE`, `UTILITY`, `ELECTRICITY`, `WATER`, `POWER`, `GAS`, `DEPOSIT`, `LATE_FEE`, `PENALTY`, `DISCOUNT`, `REFUND`, `OTHER` 等 |
| `DepositStatus`          | `UNPAID`, `PAID`, `PARTIAL_REFUNDED`, `FULLY_REFUNDED`, `DEDUCTED`                                                                           |
| `PaymentStatus`          | `PENDING`, `COMPLETED`, `FAILED`, `REFUNDED`, `CANCELLED`                                                                                    |
| `MeterType`              | `WATER`, `POWER`, `GAS`                                                                                                                      |
| `MeterReadingType`       | `MANUAL`, `SMART`, `CHECKIN`, `CHECKOUT`                                                                                                     |
| `MaintenanceOrderStatus` | `PENDING`, `DISPATCHED`, `IN_PROGRESS`, `AWAITING_ACCEPTANCE`, `COMPLETED`, `CANCELLED`                                                      |
| `CashierAccountType`     | `CASH`, `BANK`, `WECHAT`, `ALIPAY`, `POS`, `OTHER`                                                                                           |

---

### 关键业务约束

- **组织隔离**：几乎所有业务表都带 `organizationId` 外键，查询默认按组织过滤
- **房源-房间唯一**：`Room` 有 `@@unique([apartmentId, roomNo])`
- **租客手机唯一**：`Tenant` 有 `@@unique([organizationId, phone])`
- **账单唯一**：`Bill` 有 `@@unique([leaseId, billingDate, mode])`，防止重复出账
- **1:1 关系**：
  - `Lease` ↔ `Deposit`（一个租约一笔押金）
  - `Lease` ↔ `LeaseSettlement`（一个租约一次结算）
  - `Lease` ↔ `BillQueue`（一个租约一个出账队列）
  - `Tenant` ↔ `TenantAccount`（一个租客一个账户）

---

### 软删除中间件

`src/config/prisma.ts` 中实现了 Prisma 中间件：

- 将 `delete` / `deleteMany` 自动转为 `update` / `updateMany` 并设置 `deletedAt: new Date()`
- 对 `findMany`、`findFirst`、`findFirstOrThrow`、`count` 自动过滤 `deletedAt: null`
- **例外**：若查询条件中显式指定 `deletedAt`，则不过滤（可用于回收站功能）

> ⚠️ **已知问题**：中间件列表 `SOFT_DELETE_MODELS` 与实际 schema 存在不同步，详见下方「数据库设计检查」章节。

---

### 金额与财务精度

- 租金/押金/账单金额：`Decimal(12, 2)`
- 水电单价：`Decimal(10, 2)`
- 递增费率/成本单价：`Decimal(10, 4)`
- 滞纳金日利率：`Decimal(10, 6)`（默认 `0.0005`，即万五）
- 公摊比例：`Decimal(5, 4)`

所有金额计算在应用层使用 `decimal.js`（Prisma 内置）进行，避免浮点误差。

---

### 数据库设计检查

#### 1. 软删除中间件与 Schema 不同步 ⚠️

| 问题                          | 说明                                                                                                                                                                                   |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 列表含不存在模型              | `SOFT_DELETE_MODELS` 包含 `MonthlyBill`，但 schema 中无此模型                                                                                                                          |
| 有 `deletedAt` 但未纳入中间件 | `Tenant`、`Deposit`、`Meter`、`MaintenanceOrder`、`LandlordContract` 等模型包含 `deletedAt` 字段，但未加入 `SOFT_DELETE_MODELS`，导致 `prisma.xxx.delete()` 时**真正硬删除**而非软删除 |
| 无 `deletedAt` 但可能需软删除 | `Invoice`、`RoomChecklist`、`RoomChecklistItem`、`LandlordPayment`、`Refund`、`CashierJournal`、`AccountTransfer` 等没有 `deletedAt`，业务上删除即永久删除，需确认是否符合预期         |

**建议修复**：

1. 从 `SOFT_DELETE_MODELS` 移除 `MonthlyBill`
2. 将 `Tenant`、`Deposit`、`Meter`、`MaintenanceOrder`、`LandlordContract` 加入 `SOFT_DELETE_MODELS`
3. 或统一审计所有带 `deletedAt` 的模型，确保中间件列表与 schema 保持一致

#### 2. 软删除下 `onDelete: Cascade` 失效 ⚠️⚠️

Prisma 中间件将 `delete` 改写为 `update { deletedAt }`，**不会触发数据库级联删除**。这意味着：

- 软删除 `Apartment` 时，`Room`、`MeterReading`、`MaintenanceOrder`、`LandlordContract` 等子记录**不会被自动软删除**
- 软删除 `Lease` 时，`Bill`、`LeaseFee`、`DepositLedger` 等子记录**不会被自动软删除**
- 子记录仍可通过正常查询被检索到，造成数据不一致

**建议修复方向**：

- **方案 A**：在应用层封装级联软删除逻辑（如 `apartmentService.softDelete()` 中手动递归软删除子记录）
- **方案 B**：对强依赖子表移除 `deletedAt`，改为真正的硬删除（由 `onDelete: Cascade` 处理）
- **方案 C**：为软删除父记录添加数据库触发器（`TRIGGER`），在 `deletedAt` 更新时同步更新子表

#### 3. 缺失的外键关系 ⚠️

| 字段                     | 问题                                                                           |
| ------------------------ | ------------------------------------------------------------------------------ |
| `Organization.ownerId`   | 仅存储字符串，未定义 `@relation` 到 `User`，无法通过 Prisma 关系查询组织创建者 |
| `Payment.tenantId`       | 有索引但无 `@relation` 到 `Tenant`，无法直接 `payment.tenant` 反向查询         |
| `OverduePenalty.leaseId` | 有索引但无 `@relation` 到 `Lease`                                              |

#### 4. 冗余/无效索引 ⚠️

| 索引                                  | 问题                                                                     |
| ------------------------------------- | ------------------------------------------------------------------------ |
| `Payment @@index([tenantId, paidAt])` | `tenantId` 非外键，该索引实际服务于应用层按租客查收款，但需注意无法 join |
| `OverduePenalty @@index([leaseId])`   | `leaseId` 非外键，同理为应用层查询服务                                   |

#### 5. 数据一致性隐患

- **`Tenant` ↔ `TenantAccount` 生命周期不一致**：`Tenant` 支持软删除，但 `TenantAccount` 无 `deletedAt` 且为一对一强关联。软删除租客后账户记录仍残留
- **`CoResident` 无软删除**：与 `Tenant` 为 `onDelete: Cascade` 硬删除，若 `Tenant` 改为软删除，`CoResident` 不会同步处理
- **`BillItemReading` 无软删除**：`BillItem` 软删除后，其关联的 `BillItemReading` 不会自动隐藏（因为不是级联软删除）
- **`Refund` 无关联 Payment/Deposit**：退款申请仅关联 `Tenant`，未关联到具体押金或收款记录，追踪退款来源较困难

#### 6. 状态字段语义重叠

- `Organization.status` 包含 `DELETED`，但组织本身无 `deletedAt` 字段，组织删除是硬删除还是状态变更需明确
- `Apartment.status` 包含 `CLOSED`，同时又有 `deletedAt`——关闭与软删除的业务语义需文档化区分

#### 7. 建议补充的索引

| 表         | 建议索引                            | 理由                                     |
| ---------- | ----------------------------------- | ---------------------------------------- |
| `Bill`     | `[organizationId, status, dueDate]` | 按组织查询待缴账单并按到期日排序         |
| `Lease`    | `[organizationId, status, endDate]` | 查询即将到期租约                         |
| `Tenant`   | `[organizationId, phone]`           | 已有唯一约束，但显式索引可优化 like 查询 |
| `AuditLog` | `[organizationId, createdAt]`       | 审计日志按时间分页                       |

---

### 模型关系简图

```
Organization
├── Apartment ── Room ── Lease
│   ├── Meter
│   ├── MeterReading
│   ├── MaintenanceOrder
│   ├── LandlordContract
│   └── ApartmentExpense
├── Tenant ── TenantAccount ── AccountTransaction
├── Lease
│   ├── Bill ── BillItem ── BillItemReading
│   ├── Payment ── PaymentAllocation
│   ├── Deposit ── DepositLedger
│   ├── LeaseSettlement ── SettlementItem / SettlementPayment
│   └── LeaseChangeLog
├── IncomeExpenseCategory
├── CashierJournal
├── Account ── AccountTransfer
├── Refund
├── Invoice
├── BillQueue
├── Subscription ── Plan
├── OrgQuotaPackage
├── OrgMember ── Role
├── OrgInvite
├── AuditLog
└── Notification
```

---

### 开发注意事项

1. **查询时默认过滤软删除**：由于中间件自动注入 `deletedAt: null`，如果需要查询已删除记录，必须显式写 `where: { deletedAt: { not: null } }`
2. **原生 SQL 绕过中间件**：使用 `$queryRaw` / `$executeRaw` 时软删除逻辑不生效，需手动处理
3. **金额运算**：始终使用 Prisma `Decimal` 或 `decimal.js`，禁止直接对金额进行 JavaScript 原生 `+ - * /`
4. **JSON 字段**：`Lease.waterPricingTiers`、`Lease.powerPricingTiers` 存储阶梯计价配置，结构需在应用层校验
