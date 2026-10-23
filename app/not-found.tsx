import Link from "next/link";
import { SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-surface2 text-muted">
        <SearchX className="size-6" aria-hidden />
      </span>
      <h1 className="text-xl font-semibold">Pagina non trovata</h1>
      <p className="mt-2 max-w-sm text-sm text-muted">
        La risorsa richiesta non esiste o non è più disponibile. Nessun dato è stato modificato.
      </p>
      <div className="mt-5 flex gap-2">
        <Link href="/" className="btn btn-primary btn-sm">Dashboard</Link>
        <Link href="/matches" className="btn btn-secondary btn-sm">Partite</Link>
      </div>
    </div>
  );
}
