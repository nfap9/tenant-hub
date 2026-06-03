import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import type { AgentContext } from '../types.js';

export const queryBillsTool = (ctx: AgentContext) =>
  tool(
    async ({ status, tenantName, mode, limit = 30 }) => {
      const bills = await prisma.bill.findMany({
        where: {
          organizationId: ctx.organizationId,
          deletedAt: null,
          ...(status ? { status } : {}),
          ...(mode ? { mode } : {}),
          ...(tenantName
            ? {
                lease: {
                  tenantName: { contains: tenantName, mode: 'insensitive' },
                },
              }
            : {}),
        },
        include: {
          lease: {
            select: {
              tenantName: true,
              room: { select: { roomNo: true } },
            },
          },
        },
        take: limit,
        orderBy: { billingDate: 'desc' },
      });

      return JSON.stringify(
        bills.map((bill) => ({
          id: bill.id,
          tenantName: bill.lease.tenantName,
          roomNo: bill.lease.room.roomNo,
          billingDate: bill.billingDate.toISOString().split('T')[0],
          periodStart: bill.periodStart.toISOString().split('T')[0],
          periodEnd: bill.periodEnd.toISOString().split('T')[0],
          dueDate: bill.dueDate.toISOString().split('T')[0],
          totalAmount: Number(bill.totalAmount),
          paidAmount: Number(bill.paidAmount),
          status: bill.status,
          mode: bill.mode,
          note: bill.note,
        }))
      );
    },
    {
      name: 'query_bills',
      description:
        '查询账单列表。返回账单ID、租户姓名、房间号、账单日期、账期、总金额、已付金额、状态、类型。',
      schema: z.object({
        status: z
          .enum([
            'DRAFT',
            'BILLING',
            'UNPAID',
            'PARTIAL_PAID',
            'PAID',
            'REFUNDED',
            'FAILED',
            'VOID',
          ])
          .optional()
          .describe('按账单状态筛选'),
        tenantName: z
          .string()
          .optional()
          .describe('按租户姓名关键词筛选（可选）'),
        mode: z
          .enum(['PREPAID', 'POSTPAID', 'DEPOSIT'])
          .optional()
          .describe('按账单类型筛选：PREPAID预付/POSTPAID后付/DEPOSIT押金'),
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
