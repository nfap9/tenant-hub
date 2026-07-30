import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { PERMISSIONS } from '../../services/roles.js';
import {
  calculateKeyDepositAmount,
  createLeaseWithDeposit,
  createLeaseWithoutDeposit,
  findRoomById,
  updateRoomStatus,
} from '../../services/lease.js';
import { getRoomByIdRaw } from '../../services/apartment.js';
import { generateLeaseBills } from '../../services/billing.js';
import { startOfLeaseDay } from '../../services/leaseLifecycle.js';
import { createLeaseInput } from '../../routes/leases.js';
import { prisma } from '../../config/prisma.js';
import type { ToolMeta } from './types.js';

// 与路由层创建租约入参同源，去掉 AI 场景不适用的历史账单补录字段
const input = createLeaseInput
  .innerType()
  .omit({
    historicalBills: true,
    historicalBaseWater: true,
    historicalBasePower: true,
    depositSettled: true,
  })
  .refine((data) => data.endDate >= data.startDate, {
    path: ['endDate'],
    message: '租约结束日期不能早于开始日期',
  });

type Input = z.infer<typeof input>;

export const createLeaseTool: ToolMeta<Input, unknown> = {
  name: 'create_lease',
  description:
    '为指定空闲房间创建新租约，支持草稿（DRAFT）或直接生效（ACTIVE）。生效时会生成押金账单与首期账单、录入初始水电读数并将房间置为已租。高风险写操作，需用户确认。',
  // 带默认值的字段导致 schema 输入类型比输出类型宽，这里断言为解析后的输出类型
  inputSchema: input as z.ZodType<Input>,
  permission: PERMISSIONS.LEASE_MANAGE,
  isWrite: true,

  async preview(inp, ctx) {
    const room = await getRoomByIdRaw(inp.roomId, ctx.organizationId);
    if (!room) throw new Error('房间不存在');
    const keyDeposit =
      inp.keyDepositAmount !== undefined
        ? inp.keyDepositAmount
        : Number(calculateKeyDepositAmount(inp.keyQuantity, inp.keyUnitPrice));
    return {
      title: `新建租约 · ${room.apartment.name} ${room.roomNo} · ${inp.tenantName ?? '未填写租客'}`,
      riskLevel: 'high',
      diff: [
        { field: '房间', newValue: `${room.apartment.name} ${room.roomNo}` },
        { field: '当前房间状态', oldValue: room.status },
        { field: '租客姓名', newValue: inp.tenantName },
        { field: '租客电话', newValue: inp.tenantPhone },
        {
          field: '租期',
          newValue: `${inp.startDate.toISOString().slice(0, 10)} ~ ${inp.endDate.toISOString().slice(0, 10)}`,
        },
        { field: '付款周期', newValue: inp.rentCycle },
        { field: '月租金', newValue: inp.rentAmount },
        { field: '房间押金', newValue: inp.roomDepositAmount },
        { field: '钥匙押金', newValue: keyDeposit },
        { field: '水费单价', newValue: inp.waterUnitPrice },
        { field: '电费单价', newValue: inp.powerUnitPrice },
        { field: '状态', newValue: inp.status },
      ],
      description:
        inp.status === 'ACTIVE'
          ? '将创建租约并立即生效：生成押金账单与首期账单、录入初始水电读数，房间状态置为已租（OCCUPIED）。'
          : '将创建草稿租约，不生成任何账单，房间状态不变；后续需激活才会生效。',
    };
  },

  async execute(inp, ctx) {
    const {
      fees,
      roomId,
      roomDepositAmount,
      keyDepositAmount,
      keyQuantity,
      keyUnitPrice,
      initialWaterReading,
      initialPowerReading,
      ...leaseData
    } = inp;

    const room = await findRoomById(roomId, ctx.organizationId);
    if (!room)
      return { ok: false, error: '房间不存在', summary: '房间不存在。' };

    const isDraft = leaseData.status === 'DRAFT';
    if (room.status === 'SELF_USE')
      return {
        ok: false,
        error: '自用房间不可签约',
        summary: '自用房间不可签约。',
      };
    if (room.status !== 'VACANT')
      return {
        ok: false,
        error: isDraft ? '仅空闲房间可以保存草稿' : '仅空闲房间可以签约',
        summary: isDraft ? '仅空闲房间可以保存草稿。' : '仅空闲房间可以签约。',
      };

    const roomDeposit = new Prisma.Decimal(roomDepositAmount);
    const keyDeposit =
      keyDepositAmount !== undefined
        ? new Prisma.Decimal(keyDepositAmount)
        : calculateKeyDepositAmount(keyQuantity, keyUnitPrice);
    const depositAmount = roomDeposit.plus(keyDeposit);

    const createFn = depositAmount.greaterThan(0)
      ? createLeaseWithDeposit
      : createLeaseWithoutDeposit;

    const lease = await createFn({
      leaseData: {
        ...leaseData,
        rentAmount: new Prisma.Decimal(leaseData.rentAmount),
        depositAmount,
        keyDepositAmount: keyDeposit,
        waterUnitPrice: new Prisma.Decimal(leaseData.waterUnitPrice),
        powerUnitPrice: new Prisma.Decimal(leaseData.powerUnitPrice),
      },
      roomId,
      organizationId: ctx.organizationId,
      fees: fees.map((fee) => ({
        ...fee,
        amount: new Prisma.Decimal(fee.amount),
      })),
    });

    await prisma.meterReading.createMany({
      data: [
        {
          organizationId: ctx.organizationId,
          apartmentId: lease.room.apartmentId,
          roomId: lease.roomId,
          leaseId: lease.id,
          meterType: 'WATER',
          readingDate: startOfLeaseDay(lease.startDate).toDate(),
          value: initialWaterReading,
        },
        {
          organizationId: ctx.organizationId,
          apartmentId: lease.room.apartmentId,
          roomId: lease.roomId,
          leaseId: lease.id,
          meterType: 'POWER',
          readingDate: startOfLeaseDay(lease.startDate).toDate(),
          value: initialPowerReading,
        },
      ],
    });

    if (!isDraft) {
      await updateRoomStatus(roomId, 'OCCUPIED');
      await generateLeaseBills(lease.id, new Date(), {
        onlyCurrentPeriod: true,
      });
    }

    const roomLabel = `${lease.room.apartment.name} ${lease.room.roomNo}`;
    return {
      ok: true,
      data: { leaseId: lease.id, status: lease.status, room: roomLabel },
      summary: isDraft
        ? `已为 ${roomLabel} 创建草稿租约（${lease.tenantName ?? '未填写租客'}），未生成账单。`
        : `已为 ${roomLabel} 创建并生效租约（${lease.tenantName ?? '未填写租客'}），月租金 ¥${Number(lease.rentAmount).toFixed(2)}，房间已置为已租并生成首期账单。`,
    };
  },
};
