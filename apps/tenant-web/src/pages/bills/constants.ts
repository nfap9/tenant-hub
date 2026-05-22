import type { BillStatus } from "@/types/domain";

export const statusLabels: Record<BillStatus, string> = {
  DRAFT: "草稿",
  BILLING: "出账中",
  UNPAID: "待支付",
  PARTIAL_PAID: "部分支付",
  PAID: "已支付",
  FAILED: "出账失败",
  VOID: "已作废",
};

export const toneForBillStatus = (status: BillStatus): "success" | "warning" | "error" | "default" => {
  if (status === "PAID") return "success";
  if (status === "FAILED" || status === "VOID") return "error";
  if (status === "BILLING") return "default";
  return "warning";
};

export const billModeText = (mode: string) => (mode === "PREPAID" ? "预付" : "后付");
