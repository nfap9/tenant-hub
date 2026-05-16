export const money = (value?: string | number) => Number(value ?? 0).toFixed(2);
export const compactMoney = (value: number) => {
  if (value >= 10000) return `${(value / 10000).toFixed(value >= 100000 ? 0 : 1)}万`;
  return money(value);
};
export const day = (value?: string) => value?.slice(0, 10) ?? "";
export const today = () => new Date().toISOString().slice(0, 10);
export const nextYear = () => {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  return date.toISOString().slice(0, 10);
};
export const isThisMonth = (value?: string) => {
  if (!value) return false;
  const date = new Date(value);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
};
export const daysUntil = (value: string) => {
  const target = new Date(value.slice(0, 10));
  const todayDate = new Date(new Date().toISOString().slice(0, 10));
  return Math.ceil((target.getTime() - todayDate.getTime()) / 86400000);
};
export const monthlyAmount = (value: string | number, cycle?: string) => {
  const amount = Number(value ?? 0);
  if (cycle === "QUARTERLY") return amount / 3;
  if (cycle === "YEARLY") return amount / 12;
  return amount;
};
export const numberValue = (value: string) => Number(value || 0);
export const optionalNumber = (value: string) => (value.trim() ? Number(value) : undefined);
export const optionalText = (value: string) => (value.trim() ? value.trim() : undefined);
export const toFacilityArray = (value: string) => value.split(/[,，]/).map((item) => item.trim()).filter(Boolean);
export const facilitiesText = (facilities?: string[]) => (facilities?.length ? facilities.join("、") : "未维护设施");
