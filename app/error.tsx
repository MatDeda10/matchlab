"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[MatchLab] errore applicativo", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-danger/10 text-danger">
        <TriangleAlert className="size-6" aria-hidden />
      </span>
      <h1 className="text-xl font-semibold">Qualcosa non ha funzionato</h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
        La pagina non è stata caricata. I dati salvati non sono stati modificati.
        {error.digest ? <span className="mt-1 block text-xs text-faint">Codice: {error.digest}</span> : null}
      </p>
      <button type="button" onClick={reset} className="btn btn-primary btn-sm mt-5">
        Riprova
      </button>
    </div>
  );
}
