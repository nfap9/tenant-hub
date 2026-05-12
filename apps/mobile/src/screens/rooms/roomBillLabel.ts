const billMonthPattern = /^(\d{4})年(\d{1,2})月$/;

export const getRoomBillGeneratedLabel = (billMonthLabel?: string, currentDate = new Date()) => {
  if (!billMonthLabel) return '本月账单已出';

  const match = billMonthLabel.match(billMonthPattern);
  if (!match) return `${billMonthLabel}账单已出`;

  const [, year, month] = match;
  const currentYear = currentDate.getFullYear();
  const displayMonth = Number(month);

  return Number(year) === currentYear
    ? `${displayMonth}月账单已出`
    : `${year}年${displayMonth}月账单已出`;
};
