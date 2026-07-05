import { z } from 'zod';
import { PERMISSIONS } from '../../services/roles.js';
import {
  generateCurrentLeaseBills,
  generateLeaseBills,
} from '../../services/billing.js';
import { findLeaseById } from '../../services/bill.js';
import type { ToolMeta } from './types.js';

const input = z.object({
  leaseId: z
    .string()
    .optional()
    .describe('租约ID；不填则为当前组织所有活跃租约生成账单'),
  today: z.coerce.date().optional().describe('账单生成基准日期，默认今天'),
});

type Input = z.infer<typeof input>;

export const generateBillsTool: ToolMeta<Input, unknown> = {
  name: 'generate_bills',
  description:
    '为指定租约或当前组织所有活跃租约按计费周期生成账单（含房租、杂费、水电后付项）。写操作，会生成待确认动作。',
  inputSchema: input,
  permission: PERMISSIONS.BILL_MANAGE,
  isWrite: true,

  async preview(inp, ctx) {
    if (inp.leaseId) {
      const lease = await findLeaseById(inp.leaseId, ctx.organizationId);
      if (!lease) throw new Error('租约不存在');
      return {
        title: `为租约生成账单 · ${inp.leaseId}`,
        riskLevel: 'medium',
        diff: [
          { field: '租约ID', newValue: inp.leaseId },
          { field: '基准日期', newValue: inp.today ?? new Date() },
        ],
        description:
          '按租约计费周期生成房租与杂费账单；若水电读数齐全，水电后付项会自动出账。',
      };
    }
    return {
      title: '为当前组织所有活跃租约生成账单',
      riskLevel: 'medium',
      diff: [
        { field: '范围', newValue: '当前组织全部活跃租约' },
        { field: '基准日期', newValue: inp.today ?? new Date() },
      ],
      description:
        '遍历组织下所有活跃租约，为到期未生成的计费周期补齐账单；可能批量产生账单。',
    };
  },

  async execute(inp, ctx) {
    const today = inp.today ?? new Date();
    if (inp.leaseId) {
      const billIds = await generateLeaseBills(inp.leaseId, today);
      return {
        ok: true,
        data: { leaseCount: 1, billIds: billIds ?? [] },
        summary: `已为租约 ${inp.leaseId} 生成 ${billIds?.length ?? 0} 笔账单。`,
      };
    }
    const result = await generateCurrentLeaseBills(ctx.organizationId, today);
    return {
      ok: true,
      data: result,
      summary: `已为 ${result.leaseCount} 个活跃租约生成 ${result.billIds.length} 笔账单。`,
    };
  },
};
