const needsEscaping = /[",\r\n]/;

export const escapeCsvCell = (value: unknown) => {
  const text = value == null ? '' : String(value);
  if (!needsEscaping.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
};

export const toCsv = (rows: unknown[][]) =>
  rows.map((row) => row.map(escapeCsvCell).join(',')).join('\n');
