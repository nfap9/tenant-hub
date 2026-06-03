import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import type { AgentContext } from '../types.js';

export const queryDepositsTool = (ctx: AgentContext) =>
  tool(
    async ({ status, limit = 30 }) => {
      const deposits = await prisma.deposit.findMany({
        where: {
          organizationId: ctx.organizationId,
          ...(status ? { status } : {}),
        },
        include: {
          lease: {
            include: {
              room: { include: { apartment: { select: { name: true } } } },
            },
          },
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
      });

      return JSON.stringify(
        deposits.map((d) => ({
          id: d.id,
          tenantName: d.lease.tenantName,
          roomNo: d.lease.room.roomNo,
          apartmentName: d.lease.room.apartment.name,
          amount: Number(d.amount),
          paidAmount: Number(d.paidAmount),
          refundedAmount: Number(d.refundedAmount),
          deductedAmount: Number(d.deductedAmount),
          status: d.status,
          createdAt: d.createdAt.toISOString().split('T')[0],
        }))
      );
    },
    {
      name: 'query_deposits',
      description:
        '查询押金列表，返回押金ID、租户、房间、金额、已收/已退/已扣、状态。',
      schema: z.object({
        status: z
          .enum([
            'UNPAID',
            'PAID',
            'PARTIAL_REFUNDED',
            'FULLY_REFUNDED',
            'DEDUCTED',
          ])
          .optional()
          .describe('按押金状态筛选'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe('返回数量限制，默认30'),
      }),
    }
  );

export const queryDepositSummaryTool = (ctx: AgentContext) =>
  tool(
    async () => {
      const deposits = await prisma.deposit.findMany({
        where: { organizationId: ctx.organizationId },
      });

      const totalAmount = deposits.reduce(
        (sum, d) => sum + Number(d.amount),
        0
      );
      const paidAmount = deposits.reduce(
        (sum, d) => sum + Number(d.paidAmount),
        0
      );
      const refundedAmount = deposits.reduce(
        (sum, d) => sum + Number(d.refundedAmount),
        0
      );
      const deductedAmount = deposits.reduce(
        (sum, d) => sum + Number(d.deductedAmount),
        0
      );
      const heldAmount = paidAmount - refundedAmount - deductedAmount;

      const byStatus: Record<string, number> = {};
      for (const d of deposits) {
        byStatus[d.status] = (byStatus[d.status] || 0) + 1;
      }

      return JSON.stringify({
        totalAmount: Number(totalAmount.toFixed(2)),
        paidAmount: Number(paidAmount.toFixed(2)),
        refundedAmount: Number(refundedAmount.toFixed(2)),
        deductedAmount: Number(deductedAmount.toFixed(2)),
        heldAmount: Number(heldAmount.toFixed(2)),
        totalCount: deposits.length,
        byStatus,
      });
    },
    {
      name: 'query_deposit_summary',
      description:
        '获取押金汇总统计，包括总金额、已收、已退、已扣、持有金额，以及按状态分布的数量。不需要参数。',
      schema: z.object({}),
    }
  );
