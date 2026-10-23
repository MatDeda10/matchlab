/**
 * Utility per i CSV pubblici di football-data.co.uk.
 *
 * I file usano virgole, CRLF, campi opzionali e date `dd/mm/yyyy`.
 * Il parser è volutamente piccolo e tollerante: non interpreta il significato
 * delle colonne, si limita a restituire righe e celle.
 */

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const input = text.replace(/^\uFEFF/, "");

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (quoted) {
      if (char === '"') {
        if (input[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  row.push(field.replace(/\r$/, ""));
  if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  return rows;
}

export function toObjects(rows: string[][]): Array<Record<string, string>> {
  const first = rows[0];
  if (!first) return [];
  const header = first.map((cell) => cell.trim());
  return rows.slice(1).map((cells) => {
    const item: Record<string, string> = {};
    for (let index = 0; index < header.length; index += 1) {
      const key = header[index];
      if (!key) continue;
      item[key] = (cells[index] ?? "").trim();
    }
    return item;
  });
}

export interface ParsedDate {
  year: number;
  month: number;
  day: number;
  /** Chiave locale `YYYY-MM-DD`, indipendente dal fuso orario. */
  dateKey: string;
}

export function parseDate(value: string): ParsedDate | null {
  const match = value.trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  let year = Number(match[3]);
  if (year < 100) year += year >= 70 ? 1900 : 2000;
  if (
    !Number.isInteger(day) ||
    !Number.isInteger(month) ||
    !Number.isInteger(year) ||
    day < 1 ||
    day > 31 ||
    month < 1 ||
    month > 12
  ) {
    return null;
  }
  return {
    year,
    month,
    day,
    dateKey: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  };
}

function timeZoneOffsetMinutes(date: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? "0");
  const asUtc = Date.UTC(
    value("year"),
    value("month") - 1,
    value("day"),
    value("hour") === 24 ? 0 : value("hour"),
    value("minute"),
    value("second"),
  );
  return (asUtc - date.getTime()) / 60000;
}

/** Converte una data/ora locale (fuso della competizione) in ISO UTC. */
export function localKickoffToUtc(
  date: ParsedDate,
  time: string | undefined,
  timeZone: string,
): string {
  const match = (time ?? "").trim().match(/^(\d{1,2}):(\d{2})$/);
  const hour = match ? Math.min(23, Math.max(0, Number(match[1]))) : 12;
  const minute = match ? Math.min(59, Math.max(0, Number(match[2]))) : 0;
  const naive = Date.UTC(date.year, date.month - 1, date.day, hour, minute);
  let offset = timeZoneOffsetMinutes(new Date(naive), timeZone);
  let result = naive - offset * 60000;
  // Secondo passaggio per i giorni di cambio ora legale.
  offset = timeZoneOffsetMinutes(new Date(result), timeZone);
  result = naive - offset * 60000;
  return new Date(result).toISOString();
}

export function startYearFor(date: ParsedDate): number {
  return date.month >= 7 ? date.year : date.year - 1;
}

export function seasonCode(startYear: number): string {
  return `${String(startYear).slice(-2)}${String(startYear + 1).slice(-2)}`;
}

export function seasonLabel(startYear: number): string {
  return `${startYear}/${String((startYear + 1) % 100).padStart(2, "0")}`;
}

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function numberOrNull(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function integerOrNull(value: string | undefined): number | null {
  const parsed = numberOrNull(value);
  return parsed === null ? null : Math.round(parsed);
}
