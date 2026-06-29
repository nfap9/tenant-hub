import type { Apartment } from '@/types/domain';

export const isThisMonth = (value?: string) => {
  if (!value) return false;
  const date = new Date(value);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth()
  );
};

export const monthlyAmount = (
  value: string | number | undefined,
  cycle?: string
) => {
  const amount = Number(value ?? 0);
  if (cycle === 'QUARTERLY') return amount / 3;
  if (cycle === 'YEARLY') return amount / 12;
  return amount;
};

export const apartmentMonthlyIncome = (apartment: Apartment) =>
  (apartment.rooms ?? []).reduce((sum, room) => {
    const activeLease = room.leases?.find((lease) => lease.status === 'ACTIVE');
    if (!activeLease) return sum;
    const leaseMonthlyRent = monthlyAmount(
      activeLease.rentAmount,
      activeLease.rentCycle
    );
    const leaseMonthlyFees = (activeLease.fees ?? []).reduce(
      (feeSum, fee) =>
        feeSum + monthlyAmount(fee.amount, activeLease.rentCycle),
      0
    );
    return sum + leaseMonthlyRent + leaseMonthlyFees;
  }, 0);
