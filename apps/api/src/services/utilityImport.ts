import { calculateUtilityAmount } from './billing.js';

export type UtilityImportRow = {
  billId: string;
  previousWater: number;
  currentWater: number;
  previousPower: number;
  currentPower: number;
};

const normalizeHeader = (value: string) => value.trim();

const parseCsvLine = (line: string) => {
  const cells: string[] = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === ',' && !quoted) {
      cells.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells;
};

const numeric = (value: string, label: string) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label}必须是数字`);
  return parsed;
};

export const parseUtilityImportRows = (csv: string): UtilityImportRow[] => {
  const lines = csv.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length <= 1) return [];
  const headers = parseCsvLine(lines[0]).map(normalizeHeader);
  const indexOf = (name: string) => headers.indexOf(name);
  const billIdIndex = indexOf('billId');
  const previousWaterIndex = indexOf('上月水表');
  const currentWaterIndex = indexOf('本月水表');
  const previousPowerIndex = indexOf('上月电表');
  const currentPowerIndex = indexOf('本月电表');

  if (
    [
      billIdIndex,
      previousWaterIndex,
      currentWaterIndex,
      previousPowerIndex,
      currentPowerIndex,
    ].some((index) => index < 0)
  ) {
    throw new Error('导入内容缺少必要列');
  }

  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    const row = {
      billId: cells[billIdIndex]?.trim(),
      previousWater: numeric(cells[previousWaterIndex] ?? '', '上月水表'),
      currentWater: numeric(cells[currentWaterIndex] ?? '', '本月水表'),
      previousPower: numeric(cells[previousPowerIndex] ?? '', '上月电表'),
      currentPower: numeric(cells[currentPowerIndex] ?? '', '本月电表'),
    };
    calculateUtilityAmount({ ...row, waterUnitPrice: 0, powerUnitPrice: 0 });
    if (!row.billId) throw new Error('billId不能为空');
    return row;
  });
};
