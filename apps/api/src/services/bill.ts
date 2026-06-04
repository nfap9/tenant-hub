import { prisma } from '../config/prisma.js';
import { HttpError } from '../utils/http.js';
import { calculateUtilityLineAmounts, refreshBillTotals } from './billing.js';

export const listBills = async (
  organizationId: string,
  status?:
    | 'DRAFT'
    | 'BILLING'
    | 'UNPAID'
    | 'PARTIAL_PAID'
    | 'PAID'
    | 'FAILED'
    | 'VOID'
) => {
  return prisma.bill.findMany({
    where: {
      organizationId,
      ...(status ? { status } : {}),
    },
    include: {
      lease: { include: { room: true } },
      items: true,
      payments: true,
    },
    orderBy: { dueDate: 'asc' },
  });
};

export const getBillById = async (billId: string, organizationId: string) => {
  return prisma.bill.findFirst({
    where: { id: billId, organizationId },
    include: { items: true, payments: true },
  });
};

export const findLeaseById = async (
  leaseId: string,
  organizationId: string
) => {
  return prisma.lease.findFirst({
    where: { id: leaseId, organizationId },
    select: { id: true },
  });
};

export const listMeterReadings = async (
  organizationId: string,
  roomId?: string
) => {
  return prisma.meterReading.findMany({
    where: {
      organizationId,
      ...(roomId ? { roomId } : {}),
    },
    include: {
      room: true,
      lease: true,
      createdBy: { select: { id: true, username: true, phone: true } },
    },
    orderBy: { readingDate: 'desc' },
  });
};

export const findRoomForMeterReading = async (
  roomId: string,
  organizationId: string
) => {
  return prisma.room.findFirst({
    where: {
      id: roomId,
      apartment: { organizationId },
    },
    include: { apartment: true },
  });
};

export const findLeaseForMeterReading = async (
  roomId: string,
  organizationId: string,
  readingDate: Date
) => {
  return prisma.lease.findFirst({
    where: {
      roomId,
      organizationId,
      startDate: { lte: readingDate },
      endDate: { gte: readingDate },
    },
    orderBy: { startDate: 'desc' },
  });
};

export const createMeterReading = async (data: {
  organizationId: string;
  apartmentId: string;
  roomId: string;
  leaseId?: string;
  meterType: 'WATER' | 'POWER';
  readingDate: Date;
  value: number;
  source: 'MANUAL' | 'IMPORT';
  status: 'NORMAL' | 'SUSPECTED' | 'CONFIRMED' | 'VOID';
  note?: string;
  createdById: string;
}) => {
  return prisma.meterReading.create({ data });
};

export const findPendingPostpaidBillsByRoom = async (roomId: string) => {
  return prisma.bill.findMany({
    where: {
      lease: { roomId },
      mode: 'POSTPAID',
      status: { in: ['BILLING', 'FAILED'] },
    },
    select: { id: true },
  });
};

export const getBillWithItemsAndLease = async (
  billId: string,
  organizationId: string
) => {
  return prisma.bill.findFirst({
    where: { id: billId, organizationId },
    include: { lease: { include: { room: true } }, items: true },
  });
};

export const applyUtilityReadingToBill = async ({
  billId,
  organizationId,
  userId,
  previousWater,
  currentWater,
  previousPower,
  currentPower,
}: {
  billId: string;
  organizationId: string;
  userId: string;
  previousWater: number;
  currentWater: number;
  previousPower: number;
  currentPower: number;
}) => {
  const bill = await getBillWithItemsAndLease(billId, organizationId);
  if (!bill) throw new HttpError(404, '账单不存在');
  if (bill.mode !== 'POSTPAID')
    throw new HttpError(400, '仅后付费水电账单可以录入读数');

  const waterItem = bill.items.find((item) => item.type === 'WATER');
  const powerItem = bill.items.find((item) => item.type === 'POWER');
  if (!waterItem || !powerItem) throw new HttpError(400, '账单缺少水电项目');
  if (currentWater < previousWater)
    throw new HttpError(400, '水表本期读数不能小于上期读数');
  if (currentPower < previousPower)
    throw new HttpError(400, '电表本期读数不能小于上期读数');

  const { waterAmount, powerAmount } = calculateUtilityLineAmounts({
    previousWater,
    currentWater,
    waterUnitPrice: waterItem.waterUnitPrice ?? 0,
    previousPower,
    currentPower,
    powerUnitPrice: powerItem.powerUnitPrice ?? 0,
  });

  await prisma.$transaction([
    prisma.billItem.update({
      where: { id: waterItem.id },
      data: {
        previousWater,
        currentWater,
        amount: waterAmount,
        status: 'UNPAID',
      },
    }),
    prisma.billItem.update({
      where: { id: powerItem.id },
      data: {
        previousPower,
        currentPower,
        amount: powerAmount,
        status: 'UNPAID',
      },
    }),
    prisma.bill.update({
      where: { id: bill.id },
      data: { status: 'UNPAID', failureReason: null },
    }),
    prisma.meterReading.createMany({
      data: [
        {
          organizationId: bill.organizationId,
          apartmentId: bill.lease.room.apartmentId,
          roomId: bill.lease.roomId,
          leaseId: bill.leaseId,
          meterType: 'WATER',
          readingDate: bill.periodStart,
          value: previousWater,
          source: 'MANUAL',
          status: 'NORMAL',
          createdById: userId,
        },
        {
          organizationId: bill.organizationId,
          apartmentId: bill.lease.room.apartmentId,
          roomId: bill.lease.roomId,
          leaseId: bill.leaseId,
          meterType: 'WATER',
          readingDate: bill.periodEnd,
          value: currentWater,
          source: 'MANUAL',
          status: 'NORMAL',
          createdById: userId,
        },
        {
          organizationId: bill.organizationId,
          apartmentId: bill.lease.room.apartmentId,
          roomId: bill.lease.roomId,
          leaseId: bill.leaseId,
          meterType: 'POWER',
          readingDate: bill.periodStart,
          value: previousPower,
          source: 'MANUAL',
          status: 'NORMAL',
          createdById: userId,
        },
        {
          organizationId: bill.organizationId,
          apartmentId: bill.lease.room.apartmentId,
          roomId: bill.lease.roomId,
          leaseId: bill.leaseId,
          meterType: 'POWER',
          readingDate: bill.periodEnd,
          value: currentPower,
          source: 'MANUAL',
          status: 'NORMAL',
          createdById: userId,
        },
      ],
    }),
  ]);

  await refreshBillTotals(bill.id);
  return prisma.bill.findUnique({
    where: { id: bill.id },
    include: { items: true },
  });
};

export const findPendingPostpaidBillsForExport = async (
  organizationId: string
) => {
  return prisma.bill.findMany({
    where: {
      mode: 'POSTPAID',
      status: { in: ['BILLING', 'FAILED'] },
      organizationId,
    },
    include: { lease: { include: { room: true } }, items: true },
    orderBy: { billingDate: 'asc' },
  });
};

export const getBillForRetry = async (
  billId: string,
  organizationId: string
) => {
  return prisma.bill.findFirst({
    where: { id: billId, organizationId },
  });
};

export const deleteBillWithPayments = async (billId: string) => {
  await prisma.$transaction([
    prisma.payment.deleteMany({ where: { billId } }),
    prisma.bill.delete({ where: { id: billId } }),
  ]);
};

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
