import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import type { AgentContext } from '../types.js';

export const queryLeasesTool = (ctx: AgentContext) =>
  tool(
    async ({ tenantName, roomId, status, limit = 30 }) => {
      const leases = await prisma.lease.findMany({
        where: {
          organizationId: ctx.organizationId,
          deletedAt: null,
          ...(tenantName
            ? {
                tenantName: { contains: tenantName, mode: 'insensitive' },
              }
            : {}),
          ...(roomId ? { roomId } : {}),
          ...(status ? { status } : {}),
        },
        include: {
          room: { include: { apartment: { select: { name: true } } } },
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
      });

      return JSON.stringify(
        leases.map((lease) => ({
          id: lease.id,
          tenantName: lease.tenantName,
          tenantPhone: lease.tenantPhone,
          roomNo: lease.room.roomNo,
          apartmentName: lease.room.apartment.name,
          startDate: lease.startDate.toISOString().split('T')[0],
          endDate: lease.endDate.toISOString().split('T')[0],
          rentAmount: Number(lease.rentAmount),
          depositAmount: Number(lease.depositAmount),
          status: lease.status,
          cycle: lease.cycle,
          autoRenew: lease.autoRenew,
        }))
      );
    },
    {
      name: 'query_leases',
      description:
        '查询租约列表。返回租约ID、租户姓名、手机号、房间号、公寓名、起止日期、月租金、押金、状态、周期。',
      schema: z.object({
        tenantName: z
          .string()
          .optional()
          .describe('按租户姓名关键词筛选（可选）'),
        roomId: z.string().optional().describe('按房间ID筛选（可选）'),
        status: z
          .enum(['ACTIVE', 'TERMINATED', 'EXPIRED', 'DRAFT'])
          .optional()
          .describe('按状态筛选'),
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
