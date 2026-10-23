import { APP } from "@/lib/config/constants";

export const DEFAULT_TIMEZONE = APP.defaultTimezone;

/** Restituisce la data ISO (YYYY-MM-DD) nel fuso indicato. */
export function isoDate(date: Date, timeZone: string = DEFAULT_TIMEZONE): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function todayIso(timeZone: string = DEFAULT_TIMEZONE): string {
  return isoDate(new Date(), timeZone);
}

export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function parseIsoDate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

export function daysBetween(a: string, b: string): number {
  const ms = parseIsoDate(b).getTime() - parseIsoDate(a).getTime();
  return Math.round(ms / 86_400_000);
}

export function formatDate(
  iso: string,
  options: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short" },
  timeZone: string = DEFAULT_TIMEZONE,
): string {
  const date = iso.length === 10 ? new Date(`${iso}T12:00:00Z`) : new Date(iso);
  return new Intl.DateTimeFormat(APP.locale, { ...options, timeZone }).format(date);
}

export function formatDateTime(iso: string, timeZone: string = DEFAULT_TIMEZONE): string {
  return formatDate(
    iso,
    {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    },
    timeZone,
  );
}

export function formatTime(iso: string, timeZone: string = DEFAULT_TIMEZONE): string {
  return formatDate(iso, { hour: "2-digit", minute: "2-digit" }, timeZone);
}

export function relativeTime(iso: string, now = new Date()): string {
  const target = new Date(iso).getTime();
  const delta = target - now.getTime();
  const abs = Math.abs(delta);
  const minutes = Math.round(abs / 60_000);
  const hours = Math.round(abs / 3_600_000);
  const days = Math.round(abs / 86_400_000);
  let label: string;
  if (minutes < 1) label = "adesso";
  else if (minutes < 60) label = `${minutes} min`;
  else if (hours < 24) label = `${hours} h`;
  else if (days < 30) label = `${days} g`;
  else label = formatDate(iso, { day: "2-digit", month: "short" });
  if (minutes < 1) return label;
  return delta >= 0 ? `tra ${label}` : `${label} fa`;
}

export function dayLabel(iso: string, timeZone: string = DEFAULT_TIMEZONE): string {
  const today = todayIso(timeZone);
  if (iso === today) return "Oggi";
  if (iso === addDaysIso(today, 1)) return "Domani";
  if (iso === addDaysIso(today, -1)) return "Ieri";
  return formatDate(iso, { weekday: "long", day: "2-digit", month: "long" }, timeZone);
}
