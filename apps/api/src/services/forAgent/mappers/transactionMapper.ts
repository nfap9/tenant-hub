import { getCategoryLabel } from '../../transactionCategories.js';
import type { Prisma } from '@prisma/client';

type TransactionWithRelations = Prisma.TransactionGetPayload<{
  include: {
    operator: { select: { username: true } };
    apartment: { select: { name: true } };
    lease: {
      select: {
        tenantName: true;
        room: {
          select: {
            roomNo: true;
            apartment: { select: { name: true } };
          };
        };
      };
    };
  };
}>;

export function toAgentTransactionSummary(
  transaction: TransactionWithRelations
) {
  return {
    id: transaction.id,
    type: transaction.type,
    category: transaction.category,
    categoryLabel: getCategoryLabel(transaction.category),
    amount: Number(transaction.amount),
    method: transaction.method,
    description: transaction.description,
    sourceType: transaction.sourceType,
    occurredAt: transaction.occurredAt.toISOString().split('T')[0],
    note: transaction.note,
    apartmentName: transaction.apartment?.name ?? null,
    tenantName: transaction.lease?.tenantName ?? null,
    roomNo: transaction.lease?.room?.roomNo ?? null,
    operatorName: transaction.operator?.username ?? null,
  };
}
