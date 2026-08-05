import { z } from 'zod';
import { PERMISSIONS } from '../../../services/roles.js';
import { voidBill } from '../../../services/billing.js';
import { getBillById } from '../../../services/bill.js';
import type { ToolMeta } from '../types.js';

const input = z.object({
  billId: z.string().describe('账单ID'),
  reason: z.string().optional().describe('作废原因（备注）'),
});

type Input = z.infer<typeof input>;

export const voidBillTool: ToolMeta<Input, unknown> = {
  name: 'void_bill',
  description:
    '作废指定账单，将其金额清零、状态置为 VOID。仅未支付/待出账状态的账单可作废。高风险写操作，需用户确认。',
  inputSchema: input,
  permission: PERMISSIONS.BILL_MANAGE,
  isWrite: true,

  async preview(inp, ctx) {
    const bill = await getBillById(inp.billId, ctx.organizationId);
    if (!bill) throw new Error('账单不存在');
    return {
      title: `作废账单 · ${bill.billingDate.toISOString().slice(0, 10)}`,
      riskLevel: 'high',
      diff: [
        { field: '账单ID', newValue: inp.billId },
        { field: '当前状态', oldValue: bill.status },
        { field: '账单总金额', oldValue: Number(bill.totalAmount) },
        { field: '操作后状态', newValue: 'VOID' },
        { field: '操作后金额', newValue: 0 },
      ],
      description:
        '作废后账单金额清零、状态置为 VOID，关联的未支付押金记录会一并删除；已收款账单不可作废。',
    };
  },

  async execute(inp, ctx) {
    const bill = await voidBill(inp.billId, ctx.organizationId);
    return {
      ok: true,
      data: { billId: inp.billId, status: bill?.status },
      summary: `已作废账单 ${inp.billId}${inp.reason ? `（原因：${inp.reason}）` : ''}。`,
    };
  },
};
