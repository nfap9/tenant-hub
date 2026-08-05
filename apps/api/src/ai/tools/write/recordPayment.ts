import { z } from 'zod';
import { PERMISSIONS } from '../../../services/roles.js';
import { recordBillPayment } from '../../../services/billing.js';
import { getBillById } from '../../../services/bill.js';
import type { ToolMeta } from '../types.js';

const input = z.object({
  billId: z.string().describe('账单ID'),
  amount: z.coerce.number().positive().describe('收款金额'),
  method: z
    .enum(['现金', '微信', '支付宝', '银行转账', '其他'])
    .describe('收款方式'),
  waiverAmount: z.coerce
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe('抹零金额（0~1 元），不传或不需要时为 0'),
  note: z.string().optional().describe('备注'),
  paidAt: z.coerce.date().optional().describe('收款时间，默认当前时间'),
});

type Input = z.infer<typeof input>;

export const recordPaymentTool: ToolMeta<Input, unknown> = {
  name: 'record_payment',
  description:
    '为指定账单记录一笔收款，系统会更新账单已收金额和状态（已结清则置为 PAID）。高风险写操作，需用户确认。',
  inputSchema: input,
  permission: PERMISSIONS.BILL_MANAGE,
  isWrite: true,

  async preview(inp, ctx) {
    const bill = await getBillById(inp.billId, ctx.organizationId);
    if (!bill) throw new Error('账单不存在');
    const unpaid = Number(bill.totalAmount) - Number(bill.paidAmount);
    const waiver = inp.waiverAmount ?? 0;
    return {
      title: `账单收款 · ¥${inp.amount.toFixed(2)}`,
      riskLevel: 'high',
      diff: [
        { field: '账单ID', newValue: inp.billId },
        { field: '应收金额', oldValue: Number(bill.totalAmount) },
        { field: '已收金额', oldValue: Number(bill.paidAmount) },
        { field: '本次收款', newValue: inp.amount },
        { field: '抹零金额', newValue: waiver },
        { field: '收款方式', newValue: inp.method },
        { field: '剩余应收', oldValue: unpaid },
      ],
      description:
        '将创建一笔付款记录并更新账单已收金额；若结清，账单状态置为 PAID。',
    };
  },

  async execute(inp, ctx) {
    const payment = await recordBillPayment({
      billId: inp.billId,
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      amount: inp.amount,
      waiverAmount: inp.waiverAmount ?? 0,
      method: inp.method,
      note: inp.note,
      paidAt: inp.paidAt,
    });
    return {
      ok: true,
      data: { paymentId: payment.id, amount: Number(payment.amount) },
      summary: `已为账单 ${inp.billId} 记录收款 ¥${Number(payment.amount).toFixed(2)}（${inp.method}）。`,
    };
  },
};
