import Decimal from 'decimal.js';

/** 金额计算统一入口，内部使用 decimal.js 避免浮点误差 */

export type MoneyValue = number | string | Decimal;

export const D = (v: MoneyValue | null | undefined) => new Decimal(v ?? 0);

/** 四舍五入保留 2 位小数，返回 number（用于入库与展示） */
export const round2 = (v: MoneyValue): number =>
  D(v).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();

export const add = (a: MoneyValue, b: MoneyValue): number =>
  D(a).plus(b).toNumber();

export const sub = (a: MoneyValue, b: MoneyValue): number =>
  D(a).minus(b).toNumber();

export const mul = (a: MoneyValue, b: MoneyValue): number =>
  D(a).mul(b).toNumber();

/** 格式化展示：1,234.56 */
export const formatMoney = (v: MoneyValue): string => {
  const d = D(v).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const [int, dec] = d.toFixed(2).split('.');
  const sign = int.startsWith('-') ? '-' : '';
  const digits = sign ? int.slice(1) : int;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}${grouped}.${dec}`;
};
