import { APP } from "@/lib/config/constants";

const nf = new Intl.NumberFormat(APP.locale);

export function formatNumber(value: number, digits = 0): string {
  return new Intl.NumberFormat(APP.locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatPercent(probability: number, digits = 1): string {
  if (!Number.isFinite(probability)) return "—";
  return `${(probability * 100).toFixed(digits)}%`;
}

export function formatSigned(value: number, digits = 2): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}`;
}

export function formatScore(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return "—";
  return value.toFixed(digits);
}

export function formatProbabilityRange(
  interval: { p10: number; p90: number } | null | undefined,
): string {
  if (!interval) return "—";
  return `${formatPercent(interval.p10, 0)}–${formatPercent(interval.p90, 0)}`;
}

export function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

export function formatCount(value: number): string {
  return nf.format(value);
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}
