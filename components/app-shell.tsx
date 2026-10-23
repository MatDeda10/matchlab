"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  Database,
  Layers,
  LayoutDashboard,
  Menu,
  Settings,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/matches", label: "Partite", icon: CalendarDays },
  { href: "/generator", label: "Generatore", icon: Sparkles },
  { href: "/scenarios", label: "Scenari", icon: Layers },
  { href: "/tracker", label: "Tracker", icon: Target },
  { href: "/settings", label: "Impostazioni", icon: Settings },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({
  children,
  isDemo,
  providerLabel,
  warnings,
}: {
  children: ReactNode;
  isDemo: boolean;
  providerLabel: string;
  warnings: string[];
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only z-[100] rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-ink focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Vai al contenuto
      </a>

      {/* Sidebar desktop */}
      <aside className="glass fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r border-line px-4 py-5 lg:flex">
        <Link href="/" className="px-2" aria-label="MatchLab — Dashboard">
          <Logo />
        </Link>

        <nav className="mt-7 flex flex-col gap-1" aria-label="Navigazione principale">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-surface2 text-fg shadow-[inset_0_0_0_1px_var(--line)]"
                    : "text-muted hover:bg-surface2/60 hover:text-fg"
                }`}
              >
                <Icon
                  className={`size-4 ${active ? "text-accent-text" : "text-faint group-hover:text-muted"}`}
                  aria-hidden
                />
                {item.label}
                {active ? <span className="ml-auto size-1.5 rounded-full bg-accent" aria-hidden /> : null}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-3 pt-6">
          <div className="rounded-2xl border border-line bg-surface/60 p-3">
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-faint">
              <Database className="size-3.5" aria-hidden />
              Fonte dati
            </p>
            <p className="mt-1.5 text-xs font-medium">{providerLabel}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">
              {isDemo
                ? "Dati sintetici dichiarati. Nessuna partita reale."
                : "Piano gratuito: limiti e ritardi documentati."}
            </p>
            <Link
              href="/methodology#fonti"
              className="mt-2 inline-block text-[11px] font-semibold text-accent-text hover:underline"
            >
              Stato e limiti →
            </Link>
          </div>
          {warnings.length > 0 ? (
            <p className="rounded-xl border border-warn/25 bg-warn/5 p-2.5 text-[11px] leading-relaxed text-warn">
              {warnings[0]}
            </p>
          ) : null}
          <div className="flex items-center justify-between px-1">
            <p className="text-[10px] leading-relaxed text-faint">v0.1.0 · open source</p>
            <ThemeToggle compact />
          </div>
        </div>
      </aside>

      {/* Topbar mobile */}
      <header className="glass sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line px-4 lg:hidden">
        <Link href="/" aria-label="MatchLab — Dashboard">
          <Logo />
        </Link>
        <div className="flex items-center gap-1">
          {isDemo ? (
            <span className="chip border-warn/30 text-warn" aria-label="Modalità demo">
              DEMO
            </span>
          ) : null}
          <ThemeToggle compact />
        </div>
      </header>

      <div className="lg:pl-[248px]">
        <main id="main" className="mx-auto w-full max-w-[1180px] px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-16 lg:pt-8">
          {isDemo ? (
            <div className="mb-5 flex flex-wrap items-center gap-2 rounded-2xl border border-warn/25 bg-warn/5 px-3 py-2 text-[11px] leading-relaxed text-warn">
              <span className="chip border-warn/30 bg-warn/10 text-warn">DEMO</span>
              <span>
                Dataset sintetico: squadre, partite, formazioni e indisponibili non sono reali.
              </span>
            </div>
          ) : null}
          {children}
          <footer className="mt-10 border-t border-line pt-5 text-[11px] leading-relaxed text-faint">
            <p>
              MatchLab è uno strumento di analisi statistica. Non è un bookmaker, non accetta
              scommesse e non promette risultati. Le probabilità sono stime, non garanzie.
            </p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              <Link href="/methodology" className="hover:text-fg">Metodologia e limiti</Link>
              <Link href="/privacy" className="hover:text-fg">Privacy e termini</Link>
              <Link href="/methodology#fonti" className="hover:text-fg">Fonti dati</Link>
              <a
                href="https://github.com/MatDeda10/matchlab"
                className="hover:text-fg"
                target="_blank"
                rel="noreferrer noopener"
              >
                GitHub
              </a>
            </div>
          </footer>
        </main>
      </div>

      {/* Bottom nav mobile */}
      <nav
        className="glass fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-line px-1 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1.5 lg:hidden"
        aria-label="Navigazione mobile"
      >
        {NAV.filter((item) => item.href !== "/scenarios" && item.href !== "/settings").map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          if (item.href === "/generator") {
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className="flex min-w-16 flex-col items-center gap-1 px-2 pt-1 text-[10px] font-semibold text-fg"
              >
                <span
                  className={`flex size-10 -mt-4 items-center justify-center rounded-full border-4 border-bg ${
                    active ? "bg-accent text-accent-ink" : "bg-surface3 text-accent-text"
                  }`}
                >
                  <Icon className="size-5" aria-hidden />
                </span>
                Genera
              </Link>
            );
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-w-16 flex-col items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-medium ${
                active ? "text-fg" : "text-muted"
              }`}
            >
              <Icon className={`size-5 ${active ? "text-accent-text" : ""}`} aria-hidden />
              {item.href === "/" ? "Home" : item.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="flex min-w-16 flex-col items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-medium text-muted"
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
        >
          <Menu className="size-5" aria-hidden />
          Altro
        </button>
      </nav>

      {/* Menu mobile */}
      {menuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button
            type="button"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            aria-label="Chiudi menu"
            onClick={() => setMenuOpen(false)}
          />
          <div
            id="mobile-menu"
            className="glass absolute inset-x-3 bottom-3 rounded-3xl border border-line-strong p-4 shadow-[var(--shadow-pop)]"
          >
            <div className="mb-3 flex items-center justify-between">
              <Logo />
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="btn btn-ghost size-9 min-h-9 rounded-full p-0"
                aria-label="Chiudi menu"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Link href="/scenarios" className="btn btn-secondary justify-start" onClick={() => setMenuOpen(false)}>
                <Layers className="size-4" aria-hidden /> Scenari
              </Link>
              <Link href="/settings" className="btn btn-secondary justify-start" onClick={() => setMenuOpen(false)}>
                <Settings className="size-4" aria-hidden /> Impostazioni
              </Link>
              <Link href="/methodology" className="btn btn-secondary justify-start" onClick={() => setMenuOpen(false)}>
                Metodologia
              </Link>
              <Link href="/privacy" className="btn btn-secondary justify-start" onClick={() => setMenuOpen(false)}>
                Privacy
              </Link>
            </div>
            <div className="mt-3 flex items-center justify-between rounded-2xl border border-line bg-surface/60 px-3 py-2">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-faint">Fonte dati</p>
                <p className="truncate text-xs">{providerLabel}</p>
              </div>
              <ThemeToggle compact />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
