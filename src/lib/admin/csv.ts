/*
 * CSV for admin downloads. Cells a spreadsheet would run as a formula
 * (starting =, +, -, @, tab or return) are neutralised with a leading quote,
 * so an exported product or customer note can't execute in Excel.
 */

export function csvCell(v: string | number | null | undefined): string {
  // Numbers are data, not formulas: -5 stays -5.
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  let s = v === null || v === undefined ? "" : v;
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: (string | number | null | undefined)[][]): string {
  return `${header.map(csvCell).join(",")}\n${rows.map((r) => r.map(csvCell).join(",")).join("\n")}\n`;
}
