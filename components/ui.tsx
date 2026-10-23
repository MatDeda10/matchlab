import type { ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CircleHelp,
  Info,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { DISCLAIMER } from "@/lib/config/constants";
import { formatPercent } from "@/lib/format";

export function Card({
  children,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article" | "li";
}) {
  return <Tag className={`card ${className}`}>{children}</Tag>;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow mb-2">{eyebrow}</p> : null}
        <h1 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function SectionHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {description ? <p className="mt-0.5 text-xs text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

const badgeTones = {
  neutral: "border-line bg-surface2 text-muted",
  accent: "border-accent/30 bg-accent/12 text-accent-text",
  warn: "border-warn/30 bg-warn/10 text-warn",
  danger: "border-danger/30 bg-danger/10 text-danger",
  ok: "border-ok/30 bg-ok/10 text-ok",
  info: "border-info/30 bg-info/10 text-info",
} as const;

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: keyof typeof badgeTones;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-tight ${badgeTones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

const STATUS_STYLES: Record<string, { label: string; tone: keyof typeof badgeTones }> = {
  SCHEDULED: { label: "Programmata", tone: "neutral" },
  IN_PLAY: { label: "In corso", tone: "accent" },
  FINISHED: { label: "Conclusa", tone: "info" },
  POSTPONED: { label: "Rinviata", tone: "warn" },
  CANCELLED: { label: "Annullata", tone: "danger" },
};

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? { label: status, tone: "neutral" as const };
  return <Badge tone={style.tone}>{style.label}</Badge>;
}

export function QualityBadge({ score }: { score: number }) {
  const tone = score >= 70 ? "ok" : score >= 45 ? "warn" : "danger";
  const label = score >= 70 ? "Alta" : score >= 45 ? "Media" : "Bassa";
  return (
    <Badge tone={tone}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      Qualità {label} · {score}/100
    </Badge>
  );
}

export function DemoBadge() {
  return <Badge tone="warn">DEMO · dati sintetici</Badge>;
}

export function Alert({
  tone = "info",
  title,
  children,
  icon,
}: {
  tone?: "info" | "warn" | "danger" | "ok";
  title: string;
  children?: ReactNode;
  icon?: LucideIcon;
}) {
  const config = {
    info: { icon: Info, className: "border-info/25 bg-info/5", color: "text-info" },
    warn: { icon: AlertTriangle, className: "border-warn/30 bg-warn/5", color: "text-warn" },
    danger: { icon: AlertTriangle, className: "border-danger/30 bg-danger/5", color: "text-danger" },
    ok: { icon: ShieldCheck, className: "border-ok/30 bg-ok/5", color: "text-ok" },
  }[tone];
  const Icon = icon ?? config.icon;
  return (
    <div className={`rounded-2xl border p-4 ${config.className}`} role="note">
      <p className={`flex items-center gap-2 text-sm font-semibold ${config.color}`}>
        <Icon className="size-4 shrink-0" aria-hidden />
        {title}
      </p>
      {children ? <div className="mt-1.5 text-xs leading-relaxed text-muted">{children}</div> : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon: Icon = CircleHelp,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong bg-surface/40 px-6 py-10 text-center">
      <span className="mb-3 flex size-10 items-center justify-center rounded-full bg-surface2 text-muted">
        <Icon className="size-5" aria-hidden />
      </span>
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Disclaimer({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`rounded-2xl border border-line bg-surface/50 text-muted ${compact ? "px-3 py-2" : "p-4"}`}
      role="note"
    >
      <p className={`${compact ? "text-[11px]" : "text-xs"} leading-relaxed`}>
        <strong className="font-semibold text-fg">Avviso.</strong> {DISCLAIMER}
      </p>
      {!compact ? (
        <p className="mt-2 text-[11px] leading-relaxed">
          MatchLab non è un bookmaker: non accetta depositi, non piazza scommesse e non promette
          guadagni.{" "}
          <Link href="/methodology" className="underline decoration-line-strong underline-offset-2 hover:text-fg">
            Metodologia e limiti
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}

export function ProbabilityBar({
  value,
  label,
  ariaLabel,
  tone = "accent",
  showValue = true,
}: {
  value: number;
  label?: string;
  ariaLabel?: string;
  tone?: "accent" | "info" | "warn";
  showValue?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, value * 100));
  const bg = tone === "accent" ? "bg-accent" : tone === "info" ? "bg-info" : "bg-warn";
  return (
    <div>
      {label || showValue ? (
        <div className="mb-1 flex items-center justify-between gap-2 text-xs">
          <span className="truncate text-muted">{label}</span>
          {showValue ? <span className="tnum font-semibold">{formatPercent(value)}</span> : null}
        </div>
      ) : null}
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-surface3"
        role="img"
        aria-label={`${ariaLabel ?? label ?? "Probabilità"}: ${formatPercent(value)}`}
      >
        <div className={`h-full rounded-full ${bg}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-wider text-faint">{label}</p>
      <p className="tnum mt-1 truncate text-lg font-semibold tracking-tight">{value}</p>
      {hint ? <p className="mt-0.5 truncate text-[11px] text-muted">{hint}</p> : null}
    </div>
  );
}

export function TeamDot({
  name,
  color,
  size = "md",
}: {
  name: string;
  color?: string | null;
  size?: "sm" | "md";
}) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full border border-line font-semibold ${
        size === "sm" ? "size-7 text-[10px]" : "size-9 text-xs"
      }`}
      style={{ backgroundColor: color ? `${color}22` : "var(--surface-2)", color: color ?? "var(--fg)" }}
      aria-hidden
    >
      {initials}
    </span>
  );
}

export function MeterRow({
  label,
  value,
  max = 100,
  tone = "accent",
}: {
  label: string;
  value: number;
  max?: number;
  tone?: "accent" | "warn" | "danger";
}) {
  const width = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="w-28 shrink-0 truncate text-muted">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface3">
        <div
          className={`h-full rounded-full ${tone === "accent" ? "bg-accent" : tone === "warn" ? "bg-warn" : "bg-danger"}`}
          style={{ width: `${width}%` }}
        />
      </div>
      <span className="tnum w-10 text-right font-medium">{Math.round(value)}</span>
    </div>
  );
}

export function AiBadge() {
  return (
    <Badge tone="info">
      <Sparkles className="size-3" aria-hidden />
      Spiegazione template
    </Badge>
  );
}
