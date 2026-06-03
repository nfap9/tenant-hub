import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import type { AgentContext } from '../types.js';

export const queryReservationTool = (ctx: AgentContext) =>
  tool(
    async ({ roomId }) => {
      const reservation = await prisma.reservation.findUnique({
        where: {
          roomId,
          room: {
            apartment: { organizationId: ctx.organizationId },
          },
        },
        include: {
          room: {
            select: {
              roomNo: true,
              status: true,
              apartment: { select: { name: true } },
            },
          },
        },
      });

      if (!reservation) {
        return JSON.stringify({ exists: false });
      }

      return JSON.stringify({
        exists: true,
        id: reservation.id,
        roomNo: reservation.room.roomNo,
        apartmentName: reservation.room.apartment.name,
        roomStatus: reservation.room.status,
        customerName: reservation.name,
        customerPhone: reservation.phone,
        deposit: Number(reservation.deposit),
        paymentMethod: reservation.paymentMethod,
        expectedMoveInDate: reservation.expectedMoveInDate
          .toISOString()
          .split('T')[0],
        createdAt: reservation.createdAt.toISOString().split('T')[0],
      });
    },
    {
      name: 'query_reservation',
      description: '查询房间的预留信息。返回预留客户、预期入住日期、定金等。',
      schema: z.object({
        roomId: z.string().describe('房间ID'),
      }),
    }
  );
