import { PrismaClient } from "@prisma/client";
import { env } from "./env.js";

export const prisma = new PrismaClient({
  log: env.NODE_ENV === "production" ? ["error"] : ["warn", "error"]
});

const SOFT_DELETE_MODELS = [
  "Apartment",
  "Room",
  "Lease",
  "Bill",
  "BillItem",
  "MonthlyBill",
  "Payment",
  "MeterReading",
  "ApartmentExpense",
  "LeaseFee",
  "LeaseSettlement",
  "SettlementPayment"
];

prisma.$use(async (params, next) => {
  if (!params.model || !SOFT_DELETE_MODELS.includes(params.model)) {
    return next(params);
  }

  // Delete operations → soft delete by setting deletedAt
  if (params.action === "delete") {
    params.action = "update";
    params.args.data = { ...params.args.data, deletedAt: new Date() };
  }
  if (params.action === "deleteMany") {
    params.action = "updateMany";
    params.args.data = { ...params.args.data, deletedAt: new Date() };
  }

  // Query operations → auto-filter out soft-deleted records
  // unless the caller explicitly specifies a deletedAt condition
  if (["findMany", "findFirst", "findFirstOrThrow", "count"].includes(params.action)) {
    if (params.args?.where?.deletedAt === undefined) {
      params.args = {
        ...params.args,
        where: { ...params.args?.where, deletedAt: null }
      };
    }
  }

  return next(params);
});
