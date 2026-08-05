-- 将总金额为 0 的待支付账单修正为已结清
UPDATE "Bill"
SET status = 'PAID',
    "paidAmount" = 0
WHERE status = 'UNPAID'
  AND "totalAmount" = 0;
