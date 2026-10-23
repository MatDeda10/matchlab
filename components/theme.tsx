"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

type Theme = "dark" | "light" | "system";

const STORAGE_KEY = "ml-theme";

function applyTheme(theme: Theme) {
  const resolved =
    theme === "system"
      ? window.matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark"
      : theme;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as Theme | null;
    const initial = stored ?? "dark";
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronizzazione post-hydration con localStorage
    setTheme(initial);
    applyTheme(initial);
  }, []);

  function cycle() {
    const next: Theme = theme === "dark" ? "light" : theme === "light" ? "system" : "dark";
    setTheme(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
    // Persistenza server-side facoltativa, senza bloccare l'interfaccia.
    void fetch("/api/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: next }),
    }).catch(() => undefined);
  }

  const Icon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;
  const label = theme === "dark" ? "Tema scuro" : theme === "light" ? "Tema chiaro" : "Tema di sistema";

  return (
    <button
      type="button"
      onClick={cycle}
      className="btn btn-ghost size-9 min-h-9 rounded-full p-0"
      aria-label={`${label}. Cambia tema`}
      title={`${label} — clic per cambiare`}
    >
      <Icon className="size-4" aria-hidden />
      {!compact ? <span className="sr-only">{label}</span> : null}
    </button>
  );
}

export function ThemeScript() {
  const script = `(function(){try{var t=localStorage.getItem('ml-theme')||'dark';var r=t==='system'?(window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'):t;document.documentElement.dataset.theme=r;document.documentElement.style.colorScheme=r;}catch(e){document.documentElement.dataset.theme='dark';}})();`;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
