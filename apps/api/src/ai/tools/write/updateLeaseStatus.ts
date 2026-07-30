import { z } from 'zod';
import { PERMISSIONS } from '../../../services/roles.js';
import {
  activateLease,
  findRoomById,
  getLeaseWithFees,
  updateRoomStatus,
} from '../../../services/lease.js';
import { generateLeaseBills } from '../../../services/billing.js';
import {
  hasExpired,
  startOfLeaseDay,
} from '../../../services/leaseLifecycle.js';
import { prisma } from '../../../config/prisma.js';
import type { ToolMeta } from '../types.js';

const input = z.object({
  leaseId: z.string().describe('租约ID'),
  action: z
    .enum(['ACTIVATE', 'EXPIRE'])
    .describe(
      '状态操作：ACTIVATE 激活草稿租约（生成押金与首期账单、房间置为已租）；EXPIRE 将已过结束日期的活跃租约标记为到期'
    ),
});

type Input = z.infer<typeof input>;

const ACTION_LABEL: Record<Input['action'], string> = {
  ACTIVATE: '激活',
  EXPIRE: '标记到期',
};

const ACTION_TARGET_STATUS: Record<Input['action'], string> = {
  ACTIVATE: 'ACTIVE',
  EXPIRE: 'EXPIRED',
};

export const updateLeaseStatusTool: ToolMeta<Input, unknown> = {
  name: 'update_lease_status',
  description:
    '租约状态流转：激活草稿租约（ACTIVATE），或将已过结束日期的活跃租约标记为到期（EXPIRE）。高风险写操作，需用户确认。',
  inputSchema: input,
  permission: PERMISSIONS.LEASE_MANAGE,
  isWrite: true,

  async preview(inp, ctx) {
    const lease = await getLeaseWithFees(inp.leaseId, ctx.organizationId);
    if (!lease) throw new Error('租约不存在');
    if (inp.action === 'ACTIVATE' && lease.status !== 'DRAFT')
      throw new Error('仅草稿状态的租约可以激活');
    if (inp.action === 'EXPIRE') {
      if (lease.status !== 'ACTIVE')
        throw new Error('仅活跃状态的租约可以标记到期');
      if (!hasExpired(lease))
        throw new Error('租约尚未过结束日期，不能标记到期');
    }
    const roomLabel = `${lease.room.apartment.name} ${lease.room.roomNo}`;
    return {
      title: `${ACTION_LABEL[inp.action]}租约 · ${roomLabel} · ${lease.tenantName ?? '未填写租客'}`,
      riskLevel: 'high',
      diff: [
        { field: '租约', newValue: roomLabel },
        { field: '租客', newValue: lease.tenantName },
        {
          field: '租约状态',
          oldValue: lease.status,
          newValue: ACTION_TARGET_STATUS[inp.action],
        },
        ...(inp.action === 'ACTIVATE'
          ? [
              {
                field: '房间状态',
                oldValue: lease.room.status,
                newValue: 'OCCUPIED',
              },
            ]
          : []),
      ],
      description:
        inp.action === 'ACTIVATE'
          ? '激活后租约生效：生成押金账单与首期账单，房间状态置为已租（OCCUPIED）。'
          : '标记到期后租约状态置为 EXPIRED，不再生成新账单；未结清账单仍需另行处理。',
    };
  },

  async execute(inp, ctx) {
    const lease = await getLeaseWithFees(inp.leaseId, ctx.organizationId);
    if (!lease)
      return { ok: false, error: '租约不存在', summary: '租约不存在。' };
    const roomLabel = `${lease.room.apartment.name} ${lease.room.roomNo}`;

    if (inp.action === 'EXPIRE') {
      if (lease.status !== 'ACTIVE')
        return {
          ok: false,
          error: '仅活跃状态的租约可以标记到期',
          summary: '仅活跃状态的租约可以标记到期。',
        };
      if (!hasExpired(lease))
        return {
          ok: false,
          error: '租约尚未过结束日期，不能标记到期',
          summary: '租约尚未过结束日期，不能标记到期。',
        };
      await prisma.lease.update({
        where: { id: lease.id },
        data: { status: 'EXPIRED' },
      });
      return {
        ok: true,
        data: { leaseId: lease.id, status: 'EXPIRED' },
        summary: `已将 ${roomLabel} 的租约标记为到期（EXPIRED）。`,
      };
    }

    if (lease.status !== 'DRAFT')
      return {
        ok: false,
        error: '仅草稿状态的租约可以激活',
        summary: '仅草稿状态的租约可以激活。',
      };
    const room = await findRoomById(lease.roomId, ctx.organizationId);
    if (!room)
      return { ok: false, error: '房间不存在', summary: '房间不存在。' };
    if (room.status !== 'VACANT')
      return {
        ok: false,
        error: '房间已被占用，无法激活租约',
        summary: '房间已被占用，无法激活租约。',
      };

    await activateLease({
      leaseId: lease.id,
      organizationId: ctx.organizationId,
      userId: ctx.userId,
    });

    await updateRoomStatus(lease.roomId, 'OCCUPIED');

    const existingReadingCount = await prisma.meterReading.count({
      where: { leaseId: lease.id },
    });
    if (existingReadingCount === 0) {
      await prisma.meterReading.createMany({
        data: [
          {
            organizationId: ctx.organizationId,
            apartmentId: lease.room.apartmentId,
            roomId: lease.roomId,
            leaseId: lease.id,
            meterType: 'WATER',
            readingDate: startOfLeaseDay(lease.startDate).toDate(),
            value: 0,
          },
          {
            organizationId: ctx.organizationId,
            apartmentId: lease.room.apartmentId,
            roomId: lease.roomId,
            leaseId: lease.id,
            meterType: 'POWER',
            readingDate: startOfLeaseDay(lease.startDate).toDate(),
            value: 0,
          },
        ],
      });
    }

    const isHistorical = startOfLeaseDay(lease.startDate).isBefore(
      startOfLeaseDay(new Date()),
      'day'
    );
    await generateLeaseBills(lease.id, new Date(), {
      onlyCurrentPeriod: isHistorical,
    });

    return {
      ok: true,
      data: { leaseId: lease.id, status: 'ACTIVE' },
      summary: `已激活 ${roomLabel} 的租约（${lease.tenantName ?? '未填写租客'}），房间已置为已租并生成首期账单。`,
    };
  },
};
