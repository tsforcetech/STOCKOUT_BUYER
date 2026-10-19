/**
 * Small RFC 4180 CSV reader/writer for the bulk listing upload (no dependency).
 *
 * Reader handles: UTF-8 BOM, CRLF / LF / lone CR line endings, quoted fields with embedded commas,
 * newlines and doubled quotes (""), and a trailing newline. A stray quote inside an unquoted field is
 * kept as a literal character (what Excel does). An unterminated quoted field is reported as an error.
 */

export interface CsvParseResult {
  rows: string[][];
  /** Physical (1-based) line number where each row starts — used to point users at the right spreadsheet row. */
  lines: number[];
  error: string | null;
}

export function parseCsv(input: string, delimiter = ","): CsvParseResult {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const rows: string[][] = [];
  const lines: number[] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let fieldStarted = false; // distinguishes `` (no row) from `""` (one empty field)
  let line = 1;
  let rowLine = 1;
  let quoteLine = 1;

  const endField = () => {
    row.push(field);
    field = "";
    fieldStarted = false;
  };
  const endRow = () => {
    endField();
    rows.push(row);
    lines.push(rowLine);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        if (ch === "\n" || (ch === "\r" && text[i + 1] !== "\n")) line++;
        field += ch;
      }
      continue;
    }
    if (ch === '"' && field === "" && !fieldStarted) {
      inQuotes = true;
      fieldStarted = true;
      quoteLine = line;
    } else if (ch === delimiter) {
      endField();
    } else if (ch === "\r" || ch === "\n") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      endRow();
      line++;
      rowLine = line;
    } else {
      field += ch;
      fieldStarted = true;
    }
  }
  if (inQuotes) return { rows, lines, error: `A quoted value starting on line ${quoteLine} is never closed (missing ").` };
  // Flush the last row unless the file ended with a newline.
  if (fieldStarted || field !== "" || row.length > 0) endRow();
  return { rows, lines, error: null };
}

/** One CSV line; quotes values that need it. */
export function csvLine(values: readonly string[]): string {
  return values.map((v) => (/[",\r\n]/.test(v) || /^\s|\s$/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(",");
}

export function toCsvText(rows: readonly (readonly string[])[]): string {
  return rows.map(csvLine).join("\r\n") + "\r\n";
}
