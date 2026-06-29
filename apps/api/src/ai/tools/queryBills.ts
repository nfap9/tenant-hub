import { z } from 'zod';
import { PERMISSIONS } from '../../services/roles.js';
import { listBillsRaw } from '../../services/bill.js';
import type { ToolMeta } from './types.js';

const input = z.object({
  status: z
    .enum(['UNPAID', 'PAID', 'VOID', 'PENDING'])
    .optional()
    .describe('账单状态'),
  tenantName: z.string().optional().describe('租客姓名模糊匹配'),
  leaseId: z.string().optional().describe('按租约筛选'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('返回条数上限，默认 50'),
});

export const queryBillsTool: ToolMeta<z.infer<typeof input>, unknown> = {
  name: 'query_bills',
  description:
    '查询当前组织下的账单列表，可按状态、租客姓名、租约筛选。返回账单金额、应收/已收、账单项目与付款记录。',
  inputSchema: input,
  permission: PERMISSIONS.BILL_VIEW,
  isWrite: false,

  async execute(inp, ctx) {
    const rows = await listBillsRaw(ctx.organizationId, {
      status: inp.status,
      tenantName: inp.tenantName,
      limit: inp.limit ?? 50,
    });
    const filtered = inp.leaseId
      ? rows.filter((b) => b.leaseId === inp.leaseId)
      : rows;
    const data = filtered.map((b) => ({
      id: b.id,
      leaseId: b.leaseId,
      tenantName: b.lease?.tenantName ?? null,
      roomNo: b.lease?.room?.roomNo ?? null,
      billingDate: b.billingDate,
      dueDate: b.dueDate,
      status: b.status,
      totalAmount: Number(b.totalAmount),
      paidAmount: Number(b.paidAmount),
      unpaidAmount: Number(b.totalAmount) - Number(b.paidAmount),
      items: b.items.map((i) => ({
        category: i.category,
        name: i.name,
        amount: Number(i.amount),
      })),
    }));
    const totalUnpaid = data.reduce(
      (s, b) => s + (b.status === 'UNPAID' ? b.unpaidAmount : 0),
      0
    );
    return {
      ok: true,
      data,
      summary: `共 ${data.length} 笔账单${
        inp.status ? `（状态 ${inp.status}）` : ''
      }，其中未支付合计 ¥${totalUnpaid.toFixed(2)}。`,
    };
  },
};
