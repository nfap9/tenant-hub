import type { Apartment } from "@/types/domain";

export const isThisMonth = (value?: string) => {
  if (!value) return false;
  const date = new Date(value);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
};

export const monthlyAmount = (value: string | number | undefined, cycle?: string) => {
  const amount = Number(value ?? 0);
  if (cycle === "QUARTERLY") return amount / 3;
  if (cycle === "YEARLY") return amount / 12;
  return amount;
};

export const apartmentMonthlyIncome = (apartment: Apartment) =>
  (apartment.rooms ?? []).reduce((sum, room) => {
    const activeLease = room.leases?.find((lease) => lease.status === "ACTIVE");
    if (!activeLease) return sum;
    const leaseMonthlyRent = monthlyAmount(activeLease.rentAmount, activeLease.cycle);
    const leaseMonthlyFees = (activeLease.fees ?? []).reduce((feeSum, fee) => feeSum + monthlyAmount(fee.amount, activeLease.cycle), 0);
    return sum + leaseMonthlyRent + leaseMonthlyFees;
  }, 0);

export const apartmentMonthlyExpense = (apartment: Apartment) =>
  (apartment.expenses ?? []).filter((expense) => isThisMonth(expense.spentAt)).reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0);

export const contractText = (apartment: Apartment) => {
  const start = apartment.contractStart ? apartment.contractStart.slice(0, 10) : "";
  const end = apartment.contractEnd ? apartment.contractEnd.slice(0, 10) : "";
  if (!start && !end) return "未维护";
  return `${start || "未填"} 至 ${end || "未填"}`;
};
