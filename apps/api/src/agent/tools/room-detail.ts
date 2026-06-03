import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { startOfLeaseDay } from '../../services/leaseLifecycle.js';
import type { AgentContext } from '../types.js';

export const queryRoomDetailTool = (ctx: AgentContext) =>
  tool(
    async ({ roomId }) => {
      const room = await prisma.room.findFirst({
        where: {
          id: roomId,
          apartment: { organizationId: ctx.organizationId },
          deletedAt: null,
        },
        include: {
          apartment: { select: { id: true, name: true, location: true } },
          reservation: true,
          leases: {
            where: { status: 'ACTIVE', deletedAt: null },
            include: { fees: true, deposit: true },
          },
          meterReadings: {
            orderBy: { readingDate: 'desc' },
            take: 2,
            select: {
              meterType: true,
              readingDate: true,
              value: true,
            },
          },
        },
      });

      if (!room) {
        return JSON.stringify({ error: '房间不存在' });
      }

      const today = new Date();
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const bills = await prisma.bill.findMany({
        where: {
          lease: { roomId, organizationId: ctx.organizationId },
          deletedAt: null,
          billingDate: {
            gte: startOfLeaseDay(monthStart).toDate(),
            lt: new Date(today.getFullYear(), today.getMonth() + 1, 1),
          },
        },
        select: { id: true, status: true, totalAmount: true, mode: true },
      });

      const activeLease = room.leases[0];
      const leaseInfo = activeLease
        ? {
            leaseId: activeLease.id,
            tenantName: activeLease.tenantName,
            tenantPhone: activeLease.tenantPhone,
            startDate: activeLease.startDate.toISOString().split('T')[0],
            endDate: activeLease.endDate.toISOString().split('T')[0],
            rentAmount: Number(activeLease.rentAmount),
            cycle: activeLease.cycle,
            fees: activeLease.fees.map((f) => ({
              type: f.type,
              name: f.name,
              amount: Number(f.amount),
            })),
            deposit: activeLease.deposit
              ? {
                  amount: Number(activeLease.deposit.amount),
                  paidAmount: Number(activeLease.deposit.paidAmount),
                  status: activeLease.deposit.status,
                }
              : null,
          }
        : null;

      return JSON.stringify({
        id: room.id,
        roomNo: room.roomNo,
        apartmentName: room.apartment.name,
        apartmentLocation: room.apartment.location,
        layout: room.layout,
        status: room.status,
        area: room.area ? Number(room.area) : null,
        facilities: room.facilities,
        reservation: room.reservation
          ? {
              name: room.reservation.name,
              phone: room.reservation.phone,
              deposit: Number(room.reservation.deposit),
              expectedMoveInDate: room.reservation.expectedMoveInDate
                .toISOString()
                .split('T')[0],
            }
          : null,
        activeLease: leaseInfo,
        currentMonthBills: bills.map((b) => ({
          id: b.id,
          status: b.status,
          totalAmount: Number(b.totalAmount),
          mode: b.mode,
        })),
        recentReadings: room.meterReadings.map((r) => ({
          meterType: r.meterType,
          readingDate: r.readingDate.toISOString().split('T')[0],
          value: Number(r.value),
        })),
      });
    },
    {
      name: 'query_room_detail',
      description:
        '查询单个房间的详细信息，包括公寓信息、预留记录、活跃租约（费用、押金）、当月账单、最近抄表读数。',
      schema: z.object({
        roomId: z.string().describe('房间ID'),
      }),
    }
  );
