/**
 * 历史数据迁移脚本
 * 将现有的 Payment、SettlementPayment、ApartmentExpense、Reservation 数据
 * 迁移为 Transaction 记录
 *
 * 使用方法：
 * npx tsx scripts/migrateTransactions.ts
 */

import { PrismaClient } from '@prisma/client';
import {
  getCategoryFromBillItemType,
  TRANSACTION_CATEGORIES,
} from '../src/services/transaction';

const prisma = new PrismaClient();

async function migrateBillPayments() {
  console.log('开始迁移账单支付记录...');

  const payments = await prisma.payment.findMany({
    where: { deletedAt: null },
    include: {
      bill: {
        include: {
          items: true,
          lease: { include: { room: { include: { apartment: true } } } },
        },
      },
    },
  });

  let count = 0;
  for (const payment of payments) {
    if (!payment.bill || !payment.bill.lease) continue;

    const bill = payment.bill;
    const lease = bill.lease;

    // 检查是否已迁移
    const existing = await prisma.transaction.findFirst({
      where: {
        sourceType: 'BILL_PAYMENT',
        sourceId: payment.id,
      },
    });
    if (existing) continue;

    if (payment.type === 'RECEIVE') {
      // 按账单明细项拆分
      if (bill.items.length > 0 && bill.totalAmount > 0) {
        const totalAmount = bill.totalAmount;
        for (const item of bill.items) {
          if (item.amount.lessThanOrEqualTo(0)) continue;

          const splitAmount = item.amount
            .div(totalAmount)
            .mul(payment.amount)
            .toDecimalPlaces(2);

          if (splitAmount.lessThanOrEqualTo(0)) continue;

          const category = getCategoryFromBillItemType(item.type);
          await prisma.transaction.create({
            data: {
              organizationId: bill.organizationId,
              type: 'INCOME',
              category,
              amount: splitAmount,
              method: payment.method,
              description: `${lease.room.apartment.name} - ${lease.room.roomNo} ${item.name}`,
              note: payment.note,
              operatorId: payment.userId,
              occurredAt: payment.paidAt,
              sourceType: 'BILL_PAYMENT',
              sourceId: payment.id,
              billId: bill.id,
              leaseId: bill.leaseId,
              apartmentId: lease.room.apartmentId,
            },
          });
        }
      }
    } else if (payment.type === 'REFUND') {
      // 退款创建支出记录
      await prisma.transaction.create({
        data: {
          organizationId: bill.organizationId,
          type: 'EXPENSE',
          category: 'BILL_REFUND',
          amount: payment.amount,
          method: payment.method,
          description: `${lease.room.apartment.name} - ${lease.room.roomNo} 账单退款`,
          note: payment.note,
          operatorId: payment.userId,
          occurredAt: payment.paidAt,
          sourceType: 'BILL_PAYMENT',
          sourceId: payment.id,
          billId: bill.id,
          leaseId: bill.leaseId,
          apartmentId: lease.room.apartmentId,
        },
      });
    }

    count++;
    if (count % 100 === 0) {
      console.log(`  已处理 ${count} 条...`);
    }
  }

  console.log(`账单支付记录迁移完成：${count} 笔`);
}

async function migrateSettlementPayments() {
  console.log('开始迁移退租结算支付记录...');

  const payments = await prisma.settlementPayment.findMany({
    where: { deletedAt: null },
    include: {
      settlement: {
        include: {
          lease: { include: { room: { include: { apartment: true } } } },
          bill: { include: { items: true } },
        },
      },
    },
  });

  let count = 0;
  for (const payment of payments) {
    if (!payment.settlement || !payment.settlement.lease) continue;

    const settlement = payment.settlement;
    const lease = settlement.lease;

    // 检查是否已迁移
    const existing = await prisma.transaction.findFirst({
      where: {
        sourceType: 'SETTLEMENT_PAYMENT',
        sourceId: payment.id,
      },
    });
    if (existing) continue;

    if (settlement.bill && settlement.bill.items.length > 0) {
      // 按账单明细项拆分
      const billTotal = settlement.bill.totalAmount;
      for (const item of settlement.bill.items) {
        if (item.amount.lessThanOrEqualTo(0)) continue;

        const splitAmount = item.amount
          .div(billTotal)
          .mul(payment.amount)
          .toDecimalPlaces(2);

        if (splitAmount.lessThanOrEqualTo(0)) continue;

        let transType: 'INCOME' | 'EXPENSE';
        let category: string;

        if (item.name.includes('退款')) {
          transType = 'EXPENSE';
          if (item.type === 'DEPOSIT') {
            category = 'DEPOSIT_REFUND';
          } else if (item.type === 'RENT') {
            category = 'BILL_REFUND';
          } else {
            category = 'OTHER_EXPENSE';
          }
        } else {
          transType = 'INCOME';
          category = getCategoryFromBillItemType(item.type);
        }

        await prisma.transaction.create({
          data: {
            organizationId: settlement.organizationId,
            type: transType,
            category,
            amount: splitAmount,
            method: payment.method,
            description: `${lease.room.apartment.name} - ${lease.room.roomNo} ${item.name}`,
            note: payment.note,
            operatorId: payment.userId,
            occurredAt: payment.paidAt,
            sourceType: 'SETTLEMENT_PAYMENT',
            sourceId: payment.id,
            billId: settlement.billId || undefined,
            leaseId: settlement.leaseId,
            apartmentId: lease.room.apartmentId,
          },
        });
      }
    } else {
      // 没有明细项，创建一条总记录
      await prisma.transaction.create({
        data: {
          organizationId: settlement.organizationId,
          type: payment.direction === 'RECEIVE' ? 'INCOME' : 'EXPENSE',
          category:
            payment.direction === 'RECEIVE' ? 'OTHER_INCOME' : 'OTHER_EXPENSE',
          amount: payment.amount,
          method: payment.method,
          description: `${lease.room.apartment.name} - ${lease.room.roomNo} 退租结算${payment.direction === 'RECEIVE' ? '收款' : '退款'}`,
          note: payment.note,
          operatorId: payment.userId,
          occurredAt: payment.paidAt,
          sourceType: 'SETTLEMENT_PAYMENT',
          sourceId: payment.id,
          billId: settlement.billId || undefined,
          leaseId: settlement.leaseId,
          apartmentId: lease.room.apartmentId,
        },
      });
    }

    count++;
    if (count % 100 === 0) {
      console.log(`  已处理 ${count} 条...`);
    }
  }

  console.log(`退租结算支付记录迁移完成：${count} 笔`);
}

async function migrateApartmentExpenses() {
  console.log('开始迁移公寓支出记录...');

  const expenses = await prisma.apartmentExpense.findMany({
    where: { deletedAt: null },
    include: { apartment: true },
  });

  let count = 0;
  for (const expense of expenses) {
    // 检查是否已迁移
    const existing = await prisma.transaction.findFirst({
      where: {
        sourceType: 'APARTMENT_EXPENSE',
        sourceId: expense.id,
      },
    });
    if (existing) continue;

    await prisma.transaction.create({
      data: {
        organizationId: expense.apartment.organizationId,
        type: 'EXPENSE',
        category: 'OTHER_EXPENSE',
        amount: expense.amount,
        method: '现金',
        description: `${expense.apartment.name} - ${expense.name}`,
        note: expense.note,
        operatorId: expense.apartment.organizationId, // 使用组织ID作为操作人，因为没有记录操作人
        occurredAt: expense.spentAt,
        sourceType: 'APARTMENT_EXPENSE',
        sourceId: expense.id,
        apartmentId: expense.apartmentId,
      },
    });

    count++;
  }

  console.log(`公寓支出记录迁移完成：${count} 笔`);
}

async function migrateReservations() {
  console.log('开始迁移预订定金记录...');

  const reservations = await prisma.reservation.findMany({
    where: { deposit: { gt: 0 } },
    include: { room: { include: { apartment: true } } },
  });

  let count = 0;
  for (const reservation of reservations) {
    if (!reservation.room) continue;

    // 检查是否已迁移
    const existing = await prisma.transaction.findFirst({
      where: {
        sourceType: 'RESERVATION',
        sourceId: reservation.id,
      },
    });
    if (existing) continue;

    await prisma.transaction.create({
      data: {
        organizationId: reservation.room.apartment.organizationId,
        type: 'INCOME',
        category: 'RESERVATION_FEE',
        amount: reservation.deposit,
        method: reservation.paymentMethod || '现金',
        description: `${reservation.room.apartment.name} - ${reservation.room.roomNo} 预订定金`,
        operatorId: reservation.room.apartment.organizationId, // 使用组织ID作为操作人
        occurredAt: reservation.createdAt,
        sourceType: 'RESERVATION',
        sourceId: reservation.id,
        apartmentId: reservation.room.apartmentId,
      },
    });

    count++;
  }

  console.log(`预订定金记录迁移完成：${count} 笔`);
}

async function main() {
  console.log('开始历史数据迁移...\n');

  try {
    await migrateBillPayments();
    await migrateSettlementPayments();
    await migrateApartmentExpenses();
    await migrateReservations();

    console.log('\n✅ 所有历史数据迁移完成！');
  } catch (error) {
    console.error('\n❌ 迁移失败：', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
