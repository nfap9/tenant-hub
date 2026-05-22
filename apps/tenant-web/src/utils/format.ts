export function money(value: unknown): string {
  return Number(value || 0).toFixed(2);
}

export function compactMoney(value: unknown): string {
  const n = Number(value || 0);
  if (n >= 10000) {
    return `${(n / 10000).toFixed(1)}万`;
  }
  return money(n);
}

export function day(value: string | undefined): string {
  if (!value) return "";
  return value.slice(0, 10);
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function nextYear(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

export function isThisMonth(value: string | undefined): boolean {
  if (!value) return false;
  return value.slice(0, 7) === today().slice(0, 7);
}

export function daysUntil(value: string | undefined): number {
  if (!value) return 0;
  const diff = new Date(value).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function monthlyAmount(value: unknown, cycle: string): number {
  const n = Number(value || 0);
  switch (cycle) {
    case "QUARTERLY":
      return n / 3;
    case "YEARLY":
      return n / 12;
    default:
      return n;
  }
}

export function numberValue(value: unknown): number {
  if (value === "" || value === null || value === undefined) return 0;
  const n = Number(value);
  return Number.isNaN(n) ? 0 : n;
}

export function optionalNumber(value: unknown): number | undefined {
  if (value === "" || value === null || value === undefined) return undefined;
  const n = Number(value);
  return Number.isNaN(n) ? undefined : n;
}

export function optionalText(value: unknown): string | undefined {
  if (value === "" || value === null || value === undefined) return undefined;
  return String(value);
}

export function toFacilityArray(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
}

export function facilitiesText(facilities?: string[]): string {
  if (!facilities || facilities.length === 0) return "-";
  return facilities.join("、");
}
