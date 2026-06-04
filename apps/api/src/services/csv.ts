const needsEscaping = /[",\r\n]/;

/**
 * 对单个 CSV 单元格值进行转义处理
 * 如果值包含逗号、双引号或换行符，则用双引号包裹并将内部双引号替换为两个双引号
 * @param value - 单元格原始值
 * @returns 转义后的 CSV 单元格字符串
 */
export const escapeCsvCell = (value: unknown) => {
  const text = value == null ? '' : String(value);
  if (!needsEscaping.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
};

/**
 * 将二维数组转换为 CSV 字符串
 * @param rows - 二维数组，每个内部数组表示一行数据
 * @returns CSV 格式的字符串
 */
export const toCsv = (rows: unknown[][]) =>
  rows.map((row) => row.map(escapeCsvCell).join(',')).join('\n');
