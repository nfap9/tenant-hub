import { prisma } from '../../config/prisma.js';

/**
 * 为智能助手查询账单列表
 * @param organizationId - 组织ID
 * @param status - 账单状态筛选（可选）
 * @param tenantName - 租客姓名筛选（可选）
 * @param mode - 账单模式筛选（可选）
 * @param limit - 返回数量限制，默认30
 * @returns 格式化后的账单列表，包含租约、房间、账单项目和付款信息
 */
export const queryBillsForAgent = async ({
  organizationId,
  status,
  tenantName,
  mode,
  limit = 30,
}: {
  organizationId: string;
  status?:
    | 'DRAFT'
    | 'BILLING'
    | 'UNPAID'
    | 'PARTIAL_PAID'
    | 'PAID'
    | 'REFUNDED'
    | 'FAILED'
    | 'VOID';
  tenantName?: string;
  mode?: 'PREPAID' | 'POSTPAID' | 'DEPOSIT';
  limit?: number;
}) => {
  const bills = await prisma.bill.findMany({
    where: {
      organizationId,
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
      items: true,
      payments: {
        include: { user: { select: { username: true } } },
        orderBy: { id: 'desc' },
      },
    },
    take: limit,
    orderBy: { billingDate: 'desc' },
  });

  return bills.map((bill) => ({
    id: bill.id,
    tenantName: bill.lease.tenantName,
    roomNo: bill.lease.room.roomNo,
    billingDate: bill.billingDate.toISOString().split('T')[0],
    periodStart: bill.periodStart.toISOString().split('T')[0],
    periodEnd: bill.periodEnd.toISOString().split('T')[0],
    dueDate: bill.dueDate.toISOString().split('T')[0],
    totalAmount: Number(bill.totalAmount),
    paidAmount: Number(bill.paidAmount),
    remainingAmount: Number(
      (Number(bill.totalAmount) - Number(bill.paidAmount)).toFixed(2)
    ),
    status: bill.status,
    mode: bill.mode,
    note: bill.note,
    failureReason: bill.failureReason,
    items: bill.items.map((item) => ({
      type: item.type,
      name: item.name,
      amount: Number(item.amount),
      status: item.status,
      previousWater: item.previousWater ? Number(item.previousWater) : null,
      currentWater: item.currentWater ? Number(item.currentWater) : null,
      previousPower: item.previousPower ? Number(item.previousPower) : null,
      currentPower: item.currentPower ? Number(item.currentPower) : null,
    })),
    payments: bill.payments.map((p) => ({
      id: p.id,
      type: p.type,
      amount: Number(p.amount),
      method: p.method,
      status: p.status,
      note: p.note,
      recordedBy: p.user.username,
      paidAt: p.paidAt.toISOString().split('T')[0],
    })),
  }));
};

/**
 * 为智能助手查询抄表记录列表
 * @param organizationId - 组织ID
 * @param roomId - 房间ID（可选）
 * @param meterType - 表类型筛选，水表或电表（可选）
 * @param limit - 返回数量限制，默认30
 * @returns 格式化后的抄表记录列表，包含房间、公寓和创建者信息
 */
export const queryMeterReadingsForAgent = async ({
  organizationId,
  roomId,
  meterType,
  limit = 30,
}: {
  organizationId: string;
  roomId?: string;
  meterType?: 'WATER' | 'POWER';
  limit?: number;
}) => {
  const readings = await prisma.meterReading.findMany({
    where: {
      organizationId,
      ...(roomId ? { roomId } : {}),
      ...(meterType ? { meterType } : {}),
    },
    include: {
      room: {
        select: {
          roomNo: true,
          apartment: { select: { name: true } },
        },
      },
      createdBy: { select: { username: true } },
    },
    take: limit,
    orderBy: { readingDate: 'desc' },
  });

  return readings.map((r) => ({
    id: r.id,
    roomNo: r.room.roomNo,
    apartmentName: r.room.apartment.name,
    meterType: r.meterType,
    readingDate: r.readingDate.toISOString().split('T')[0],
    value: Number(r.value),
    source: r.source,
    status: r.status,
    note: r.note,
    createdBy: r.createdBy?.username ?? null,
  }));
};
