# Wxapp Form Labels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add persistent visible labels to mini-program business form inputs.

**Architecture:** Reuse the existing shared `Input` component and its `label` prop. Convert pages that still use native Taro `Input` for business forms to the shared component, preserving current state updates and submit behavior.

**Tech Stack:** Taro 4, React 18, TypeScript, Sass, pnpm.

---

## File Structure

- Modify `apps/miniprogram/src/pages/apartments/index.tsx`: Replace native form inputs in apartment, expense, room, and batch-room panels with shared labeled inputs.
- Modify `apps/miniprogram/src/pages/rooms/index.tsx`: Replace native form inputs in room edit, lease create/edit, fee, and termination panels with shared labeled inputs.
- Modify `apps/miniprogram/src/pages/bills/index.tsx`: Replace native form inputs in payment, reading, utility, import, and bill-item edit panels with shared labeled inputs.
- Modify `apps/miniprogram/src/pages/settings/account.tsx`: Use shared labeled password inputs.
- Modify `apps/miniprogram/src/pages/settings/organization.tsx`: Use shared labeled organization-name input.
- No new component is required because `apps/miniprogram/src/components/ui/Input.tsx` already supports labels.

### Task 1: Apartments Form Labels

**Files:**
- Modify: `apps/miniprogram/src/pages/apartments/index.tsx`

- [ ] **Step 1: Update imports**

Replace the Taro native input import and add shared `Input`:

```tsx
import { View, Text } from '@tarojs/components';
import { Button, Card, EmptyState, Badge, Input } from '../../components/ui';
```

- [ ] **Step 2: Convert expense inputs**

Use `label` and `onChange` in both expense panels:

```tsx
<Input label="花费名称" placeholder="例如 维修材料" value={expense.name} onChange={(value) => setExpense((old) => ({ ...old, name: value }))} />
<Input label="金额" placeholder="请输入金额" type="number" value={expense.amount} onChange={(value) => setExpense((old) => ({ ...old, amount: value }))} />
<Input label="日期" placeholder="YYYY-MM-DD" value={expense.spentAt} onChange={(value) => setExpense((old) => ({ ...old, spentAt: value }))} />
<Input label="备注" placeholder="可选" value={expense.note} onChange={(value) => setExpense((old) => ({ ...old, note: value }))} />
```

- [ ] **Step 3: Convert apartment create/edit inputs**

Give each apartment field a visible label:

```tsx
<Input label="公寓名称" placeholder="例如 阳光公寓" value={form.name} onChange={(value) => updateForm("name", value)} />
<Input label="位置" placeholder="请输入地址或片区" value={form.location} onChange={(value) => updateForm("location", value)} />
<Input label="楼层数" placeholder="例如 6" type="number" value={form.floors} onChange={(value) => updateForm("floors", value)} />
<Input label="占地面积" placeholder="平方米" type="number" value={form.landArea} onChange={(value) => updateForm("landArea", value)} />
<Input label="总面积" placeholder="平方米" type="number" value={form.totalArea} onChange={(value) => updateForm("totalArea", value)} />
<Input label="房东姓名" placeholder="请输入房东姓名" value={form.landlordName} onChange={(value) => updateForm("landlordName", value)} />
<Input label="联系方式" placeholder="请输入手机号" value={form.landlordPhone} onChange={(value) => updateForm("landlordPhone", value)} />
<Input label="合同开始日期" placeholder="YYYY-MM-DD" value={form.contractStart} onChange={(value) => updateForm("contractStart", value)} />
<Input label="合同结束日期" placeholder="YYYY-MM-DD" value={form.contractEnd} onChange={(value) => updateForm("contractEnd", value)} />
<Input label="上游租金" placeholder="每期金额" type="number" value={form.rentAmount} onChange={(value) => updateForm("rentAmount", value)} />
<Input label="水费单价" placeholder="元/吨" type="number" value={form.waterUnitPrice} onChange={(value) => updateForm("waterUnitPrice", value)} />
<Input label="电费单价" placeholder="元/度" type="number" value={form.powerUnitPrice} onChange={(value) => updateForm("powerUnitPrice", value)} />
```

- [ ] **Step 4: Convert room and batch-room inputs**

Use labels for room fields:

```tsx
<Input label="房间号" placeholder="例如 301" value={roomForm.roomNo} onChange={(value) => updateRoomForm("roomNo", value)} />
<Input label="面积" placeholder="平方米" type="number" value={roomForm.area} onChange={(value) => updateRoomForm("area", value)} />
<Input label="设施" placeholder="用逗号分隔" value={roomForm.facilities} onChange={(value) => updateRoomForm("facilities", value)} />
<Input label="开始楼层" placeholder="例如 2" type="number" value={batchStartFloor} onChange={setBatchStartFloor} />
<Input label="结束楼层" placeholder="例如 4" type="number" value={batchEndFloor} onChange={setBatchEndFloor} />
<Input label="每层房间数" placeholder="例如 4" type="number" value={batchRoomCount} onChange={setBatchRoomCount} />
<Input label="面积" placeholder="平方米" type="number" value={batchArea} onChange={setBatchArea} />
<Input label="设施" placeholder="用逗号分隔" value={batchFacilities} onChange={setBatchFacilities} />
```

### Task 2: Rooms Form Labels

**Files:**
- Modify: `apps/miniprogram/src/pages/rooms/index.tsx`

- [ ] **Step 1: Update imports**

```tsx
import { View, Text } from '@tarojs/components';
import { Button, Card, EmptyState, Badge, Input } from '../../components/ui';
```

- [ ] **Step 2: Convert room edit inputs**

```tsx
<Input label="房间号" placeholder="例如 301" value={roomForm.roomNo} onChange={(value) => setRoomForm((old) => ({ ...old, roomNo: value }))} />
<Input label="户型" placeholder="例如 单间" value={roomForm.layout} onChange={(value) => setRoomForm((old) => ({ ...old, layout: value }))} />
<Input label="面积" placeholder="平方米" type="number" value={roomForm.area} onChange={(value) => setRoomForm((old) => ({ ...old, area: value }))} />
<Input label="设施" placeholder="用逗号分隔" value={roomForm.facilities} onChange={(value) => setRoomForm((old) => ({ ...old, facilities: value }))} />
```

- [ ] **Step 3: Convert lease create inputs**

```tsx
<Input label="租客姓名" placeholder="请输入姓名" value={leaseForm.tenantName} onChange={(value) => setLeaseForm((old) => ({ ...old, tenantName: value }))} />
<Input label="租客电话" placeholder="请输入手机号" value={leaseForm.tenantPhone} onChange={(value) => setLeaseForm((old) => ({ ...old, tenantPhone: value }))} />
<Input label="开始日期" placeholder="YYYY-MM-DD" value={leaseForm.startDate} onChange={(value) => setLeaseForm((old) => ({ ...old, startDate: value }))} />
<Input label="结束日期" placeholder="YYYY-MM-DD" value={leaseForm.endDate} onChange={(value) => setLeaseForm((old) => ({ ...old, endDate: value }))} />
<Input label="租金" placeholder="每期金额" type="number" value={leaseForm.rentAmount} onChange={(value) => setLeaseForm((old) => ({ ...old, rentAmount: value }))} />
<Input label="押金" placeholder="请输入押金" type="number" value={leaseForm.depositAmount} onChange={(value) => setLeaseForm((old) => ({ ...old, depositAmount: value }))} />
<Input label="宽限天数" placeholder="交租日后几日内" type="number" value={leaseForm.graceDays} onChange={(value) => setLeaseForm((old) => ({ ...old, graceDays: value }))} />
<Input label="水费单价" placeholder="元/吨" type="number" value={leaseForm.waterUnitPrice} onChange={(value) => setLeaseForm((old) => ({ ...old, waterUnitPrice: value }))} />
<Input label="电费单价" placeholder="元/度" type="number" value={leaseForm.powerUnitPrice} onChange={(value) => setLeaseForm((old) => ({ ...old, powerUnitPrice: value }))} />
```

- [ ] **Step 4: Convert fee and lease edit inputs**

```tsx
<Input label={`${label}金额`} placeholder="请输入金额" type="number" value={selected.amount} onChange={(value) => updatePresetFeeAmount(type, value)} />
<Input label="费用名称" placeholder="例如 网费" value={item.name} onChange={(value) => setCustomFees((old) => old.map((f, i) => (i === index ? { ...f, name: value } : f)))} />
<Input label="费用金额" placeholder="请输入金额" type="number" value={item.amount} onChange={(value) => setCustomFees((old) => old.map((f, i) => (i === index ? { ...f, amount: value } : f)))} />
<Input label="租金" placeholder="每期金额" type="number" value={editLeaseForm.rentAmount} onChange={(value) => setEditLeaseForm((old) => ({ ...old, rentAmount: value }))} />
<Input label="押金" placeholder="请输入押金" type="number" value={editLeaseForm.depositAmount} onChange={(value) => setEditLeaseForm((old) => ({ ...old, depositAmount: value }))} />
<Input label="水费单价" placeholder="元/吨" type="number" value={editLeaseForm.waterUnitPrice} onChange={(value) => setEditLeaseForm((old) => ({ ...old, waterUnitPrice: value }))} />
<Input label="电费单价" placeholder="元/度" type="number" value={editLeaseForm.powerUnitPrice} onChange={(value) => setEditLeaseForm((old) => ({ ...old, powerUnitPrice: value }))} />
```

- [ ] **Step 5: Convert termination inputs**

```tsx
<Input label="退租日期" placeholder="YYYY-MM-DD" value={terminationForm.terminatedAt} onChange={(value) => setTerminationForm((old) => ({ ...old, terminatedAt: value }))} />
<Input label="押金扣款" placeholder="请输入金额" type="number" value={terminationForm.depositDeductionAmount} onChange={(value) => setTerminationForm((old) => ({ ...old, depositDeductionAmount: value }))} />
<Input label="房租退补" placeholder="正数补收，负数退款" type="number" value={terminationForm.rentAdjustmentAmount} onChange={(value) => setTerminationForm((old) => ({ ...old, rentAdjustmentAmount: value }))} />
<Input label="押金扣款原因" placeholder="可选" value={terminationForm.depositDeductionReason} onChange={(value) => setTerminationForm((old) => ({ ...old, depositDeductionReason: value }))} />
<Input label="退租水表读数" placeholder="当前读数" type="number" value={terminationForm.currentWater} onChange={(value) => setTerminationForm((old) => ({ ...old, currentWater: value }))} />
<Input label="退租电表读数" placeholder="当前读数" type="number" value={terminationForm.currentPower} onChange={(value) => setTerminationForm((old) => ({ ...old, currentPower: value }))} />
<Input label="其他费用" placeholder="请输入金额" type="number" value={terminationForm.otherFeeAmount} onChange={(value) => setTerminationForm((old) => ({ ...old, otherFeeAmount: value }))} />
<Input label="其他费用说明" placeholder="可选" value={terminationForm.otherFeeReason} onChange={(value) => setTerminationForm((old) => ({ ...old, otherFeeReason: value }))} />
<Input label="退租原因" placeholder="可选" value={terminationForm.reason} onChange={(value) => setTerminationForm((old) => ({ ...old, reason: value }))} />
```

### Task 3: Bills and Settings Form Labels

**Files:**
- Modify: `apps/miniprogram/src/pages/bills/index.tsx`
- Modify: `apps/miniprogram/src/pages/settings/account.tsx`
- Modify: `apps/miniprogram/src/pages/settings/organization.tsx`

- [ ] **Step 1: Convert bills imports**

```tsx
import { View, Text } from '@tarojs/components';
import { Button, Card, EmptyState, Badge, Input } from '../../components/ui';
```

- [ ] **Step 2: Convert bill form inputs**

```tsx
<Input label="收款金额" placeholder="请输入金额" type="number" value={paymentForm.amount} onChange={(value) => setPaymentForm((old) => ({ ...old, amount: value }))} />
<Input label="收款方式" placeholder="例如 线下收款" value={paymentForm.method} onChange={(value) => setPaymentForm((old) => ({ ...old, method: value }))} />
<Input label="备注" placeholder="可选" value={paymentForm.note} onChange={(value) => setPaymentForm((old) => ({ ...old, note: value }))} />
<Input label="抄表日期" placeholder="YYYY-MM-DD" value={readingForm.readingDate} onChange={(value) => setReadingForm((old) => ({ ...old, readingDate: value }))} />
<Input label="读数" placeholder="请输入读数" type="number" value={readingForm.value} onChange={(value) => setReadingForm((old) => ({ ...old, value }))} />
<Input label="上期水表" placeholder="请输入读数" type="number" value={utilityForm.previousWater} onChange={(value) => setUtilityForm((old) => ({ ...old, previousWater: value }))} />
<Input label="本期水表" placeholder="请输入读数" type="number" value={utilityForm.currentWater} onChange={(value) => setUtilityForm((old) => ({ ...old, currentWater: value }))} />
<Input label="上期电表" placeholder="请输入读数" type="number" value={utilityForm.previousPower} onChange={(value) => setUtilityForm((old) => ({ ...old, previousPower: value }))} />
<Input label="本期电表" placeholder="请输入读数" type="number" value={utilityForm.currentPower} onChange={(value) => setUtilityForm((old) => ({ ...old, currentPower: value }))} />
<Input label="CSV 内容" placeholder="粘贴 CSV 内容" value={utilityCsv} onChange={setUtilityCsv} />
<Input label="金额" placeholder="输入金额" type="digit" value={editingBillItem.amount} onChange={(value) => setEditingBillItem((old) => old ? { ...old, amount: value } : undefined)} />
<Input label="备注" placeholder="备注（可选）" value={editingBillItem.note} onChange={(value) => setEditingBillItem((old) => old ? { ...old, note: value } : undefined)} />
```

- [ ] **Step 3: Convert settings inputs**

In account settings:

```tsx
import { View, Text } from '@tarojs/components';
import { Button, Card, Input } from '../../components/ui';

<Input label="当前密码" placeholder="请输入当前密码" password value={oldPassword} onChange={setOldPassword} />
<Input label="新密码" placeholder="请输入新密码" password value={newPassword} onChange={setNewPassword} />
<Input label="确认新密码" placeholder="再次输入新密码" password value={confirmPassword} onChange={setConfirmPassword} />
```

In organization settings:

```tsx
import { View, Text } from '@tarojs/components';
import { Button, Card, EmptyState, Badge, Input } from '../../components/ui';

<Input label="组织名称" placeholder="请输入组织名称" value={orgName} onChange={setOrgName} />
```

### Task 4: Verification

**Files:**
- Verify all changed files.

- [ ] **Step 1: Search for remaining placeholder-only native inputs in business pages**

Run:

```bash
rg "placeholder=.*onInput|<Input placeholder" apps/miniprogram/src/pages/apartments/index.tsx apps/miniprogram/src/pages/rooms/index.tsx apps/miniprogram/src/pages/bills/index.tsx apps/miniprogram/src/pages/settings/account.tsx apps/miniprogram/src/pages/settings/organization.tsx
```

Expected: No business form input remains without a `label` prop. Search fields may remain if intentionally left in list filters.

- [ ] **Step 2: Typecheck mini-program**

Run:

```bash
pnpm --filter @tenant-hub/miniprogram typecheck
```

Expected: Command exits with status 0.

- [ ] **Step 3: Build mini-program when feasible**

Run:

```bash
pnpm --filter @tenant-hub/miniprogram build:weapp
```

Expected: Command exits with status 0, unless local Taro/WeChat build dependencies are unavailable. If unavailable, record the exact failure.

## Self-Review

- Spec coverage: The plan covers all pages named in the design and does not redesign unrelated navigation or date-picking behavior.
- Placeholder scan: No plan placeholders remain; examples include concrete labels and update handlers.
- Type consistency: The shared `Input` component expects `value`, `onChange`, optional `label`, `placeholder`, `type`, and `password`; all snippets match that API.
