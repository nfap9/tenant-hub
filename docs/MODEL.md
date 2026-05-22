## 数据库与 ORM

### Prisma

- **Schema**：`apps/api/prisma/schema.prisma`（单文件）
- **迁移**：`apps/api/prisma/migrations/`（已有 10+ 个迁移，包括 init、platform roles、billing monthly metering、org invites、lease settlements、soft delete 等）
- **主键策略**：`cuid()`
- **金额字段**：`Decimal` 类型（`db.Decimal(12, 2)` / `db.Decimal(10, 2)`）

### 核心模型

| 模型                                            | 用途                                                       |
| ----------------------------------------------- | ---------------------------------------------------------- |
| `User`                                          | 平台用户（手机号认证，`platformRole`: USER / SUPER_ADMIN） |
| `OtpCode`                                       | 短信 OTP 存储（哈希后的验证码）                            |
| `Organization`                                  | 租户组织（多租户核心）                                     |
| `Role` / `OrgMember`                            | 组织内 RBAC                                                |
| `OrgInvite`                                     | 邀请码加入组织                                             |
| `Apartment` / `Room`                            | 房源与房间管理                                             |
| `Lease` / `LeaseFee`                            | 租约与费用配置                                             |
| `LeaseSettlement`                               | 租约退租结算                                               |
| `Bill` / `BillItem` / `MonthlyBill` / `Payment` | 账单与收款（预付/后付）                                    |
| `MeterReading`                                  | 水电抄表                                                   |
| `Plan` / `Subscription` / `OrgQuotaPackage`     | SaaS 订阅与配额                                            |
| `AuditLog`                                      | 操作审计日志                                               |
| `SystemSetting`                                 | 平台键值配置                                               |

### 软删除中间件

`src/config/prisma.ts` 中实现了 Prisma 中间件：

- 将 `delete` / `deleteMany` 自动转为 `update` / `updateMany` 并设置 `deletedAt: new Date()`
- 对 `findMany`、`findFirst`、`findFirstOrThrow`、`count` 自动过滤 `deletedAt: null`
