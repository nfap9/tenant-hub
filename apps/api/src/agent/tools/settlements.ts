import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import type { AgentContext } from '../types.js';

export const querySettlementsTool = (ctx: AgentContext) =>
  tool(
    async ({ leaseId, limit = 30 }) => {
      const settlements = await prisma.leaseSettlement.findMany({
        where: {
          organizationId: ctx.organizationId,
          ...(leaseId ? { leaseId } : {}),
        },
        include: {
          lease: {
            select: {
              tenantName: true,
              tenantPhone: true,
              room: {
                select: {
                  roomNo: true,
                  apartment: { select: { name: true } },
                },
              },
            },
          },
          room: { select: { roomNo: true } },
          payments: {
            include: {
              user: { select: { username: true } },
            },
          },
          bill: {
            select: {
              totalAmount: true,
              paidAmount: true,
              status: true,
            },
          },
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
      });

      return JSON.stringify(
        settlements.map((s) => ({
          id: s.id,
          tenantName: s.lease.tenantName,
          roomNo: s.lease.room.roomNo,
          apartmentName: s.lease.room.apartment.name,
          type: s.type,
          reason: s.reason,
          terminatedAt: s.terminatedAt.toISOString().split('T')[0],
          rentAdjustmentAmount: Number(s.rentAdjustmentAmount),
          otherFeeAmount: Number(s.otherFeeAmount),
          penaltyAmount: Number(s.penaltyAmount),
          compensationAmount: Number(s.compensationAmount),
          depositRefundAmount: Number(s.depositRefundAmount ?? 0),
          netAmount: Number(s.netAmount ?? 0),
          status: s.status,
          billAmount: s.bill ? Number(s.bill.totalAmount) : null,
          billPaidAmount: s.bill ? Number(s.bill.paidAmount) : null,
          paymentCount: s.payments.length,
          totalPaid: s.payments.reduce((sum, p) => sum + Number(p.amount), 0),
          createdAt: s.createdAt.toISOString().split('T')[0],
        }))
      );
    },
    {
      name: 'query_settlements',
      description:
        '查询退租结算记录，包括结算类型、各项费用（租金调整、其他费用、违约金、赔偿金）、押金退还和实收金额。',
      schema: z.object({
        leaseId: z.string().optional().describe('按租约ID筛选（可选）'),
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
