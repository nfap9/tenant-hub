import { prisma } from '../config/prisma.js';

export const getOrCreateAccount = async (tenantId: string) => {
  const existing = await prisma.tenantAccount.findUnique({
    where: { tenantId },
  });
  if (existing) return existing;

  return prisma.tenantAccount.create({
    data: { tenantId },
  });
};

export const chargeAccount = async (
  tenantId: string,
  amount: number | string,
  referenceType: 'BILL' | 'DEPOSIT' | 'SETTLEMENT' | null,
  referenceId: string | null,
  note: string | null,
  createdById?: string
) => {
  const account = await getOrCreateAccount(tenantId);
  const amount_ = typeof amount === 'string' ? parseFloat(amount) : amount;
  const newBalance = account.netBalance.toNumber() + amount_;

  const [tx] = await prisma.$transaction([
    prisma.accountTransaction.create({
      data: {
        tenantAccountId: account.id,
        type: 'CHARGE',
        amount: amount_,
        balanceAfter: newBalance,
        referenceType,
        referenceId,
        note,
        createdById,
      },
    }),
    prisma.tenantAccount.update({
      where: { id: account.id },
      data: {
        netBalance: newBalance,
        totalUnpaid: { increment: amount_ },
        updatedAt: new Date(),
      },
    }),
  ]);
  return tx;
};

export const creditAccount = async (
  tenantId: string,
  amount: number | string,
  referenceType: 'BILL' | 'DEPOSIT' | 'SETTLEMENT' | null,
  referenceId: string | null,
  note: string | null,
  createdById?: string
) => {
  const account = await getOrCreateAccount(tenantId);
  const amount_ = typeof amount === 'string' ? parseFloat(amount) : amount;
  const newBalance = account.netBalance.toNumber() - amount_;

  const [tx] = await prisma.$transaction([
    prisma.accountTransaction.create({
      data: {
        tenantAccountId: account.id,
        type: 'PAYMENT',
        amount: amount_,
        balanceAfter: newBalance,
        referenceType,
        referenceId,
        note,
        createdById,
      },
    }),
    prisma.tenantAccount.update({
      where: { id: account.id },
      data: {
        netBalance: newBalance,
        totalUnpaid: {
          decrement: Math.min(amount_, account.totalUnpaid.toNumber()),
        },
        prepaidBalance: {
          increment: Math.max(0, amount_ - account.totalUnpaid.toNumber()),
        },
        updatedAt: new Date(),
      },
    }),
  ]);
  return tx;
};

export const refundAccount = async (
  tenantId: string,
  amount: number | string,
  referenceType: 'BILL' | 'DEPOSIT' | 'SETTLEMENT' | null,
  referenceId: string | null,
  note: string | null,
  createdById?: string
) => {
  const account = await getOrCreateAccount(tenantId);
  const amount_ = typeof amount === 'string' ? parseFloat(amount) : amount;
  const newBalance = account.netBalance.toNumber() - amount_;

  const [tx] = await prisma.$transaction([
    prisma.accountTransaction.create({
      data: {
        tenantAccountId: account.id,
        type: 'REFUND',
        amount: amount_,
        balanceAfter: newBalance,
        referenceType,
        referenceId,
        note,
        createdById,
      },
    }),
    prisma.tenantAccount.update({
      where: { id: account.id },
      data: {
        netBalance: newBalance,
        depositBalance: {
          decrement: Math.min(amount_, account.depositBalance.toNumber()),
        },
        updatedAt: new Date(),
      },
    }),
  ]);
  return tx;
};

export const adjustAccount = async (
  tenantId: string,
  amount: number | string,
  note: string | null,
  createdById?: string
) => {
  const account = await getOrCreateAccount(tenantId);
  const amount_ = typeof amount === 'string' ? parseFloat(amount) : amount;
  const newBalance = account.netBalance.toNumber() + amount_;

  const [tx] = await prisma.$transaction([
    prisma.accountTransaction.create({
      data: {
        tenantAccountId: account.id,
        type: 'ADJUSTMENT',
        amount: amount_,
        balanceAfter: newBalance,
        note,
        createdById,
      },
    }),
    prisma.tenantAccount.update({
      where: { id: account.id },
      data: {
        netBalance: newBalance,
        updatedAt: new Date(),
      },
    }),
  ]);
  return tx;
};

export const getAccountBalance = async (tenantId: string) => {
  const account = await getOrCreateAccount(tenantId);
  return {
    prepaidBalance: account.prepaidBalance,
    depositBalance: account.depositBalance,
    totalUnpaid: account.totalUnpaid,
    netBalance: account.netBalance,
    lastCalculatedAt: account.updatedAt,
  };
};
