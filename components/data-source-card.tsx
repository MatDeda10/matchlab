import Link from "next/link";
import { Check, Database, Minus, TriangleAlert } from "lucide-react";
import type { DataSourceInfo } from "@/lib/api";
import { Badge, Card } from "./ui";

const CAPABILITY_LABELS: Array<[keyof DataSourceInfo["capabilities"], string]> = [
  ["fixtures", "Calendario"],
  ["results", "Risultati"],
  ["standings", "Classifiche"],
  ["lineups", "Formazioni"],
  ["playerAvailability", "Indisponibili"],
  ["matchStatistics", "Statistiche"],
  ["xg", "xG"],
];

export function DataSourceCard({ dataSource }: { dataSource: DataSourceInfo }) {
  const available = CAPABILITY_LABELS.filter(([key]) => dataSource.capabilities[key]);
  const missing = CAPABILITY_LABELS.filter(([key]) => !dataSource.capabilities[key]);

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-xl bg-surface2 text-muted">
            <Database className="size-4" aria-hidden />
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-faint">Fonte dati</p>
            <p className="text-sm font-semibold">{dataSource.label}</p>
          </div>
        </div>
        <Badge tone={dataSource.isDemo ? "warn" : "info"}>
          {dataSource.isDemo ? "DEMO" : "Reale"}
        </Badge>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {available.map(([key, label]) => (
          <span key={key} className="chip border-ok/25 bg-ok/5 text-ok">
            <Check className="size-3" aria-hidden /> {label}
          </span>
        ))}
        {missing.map(([key, label]) => (
          <span key={key} className="chip border-line text-faint" title="Non disponibile con questa fonte">
            <Minus className="size-3" aria-hidden /> {label}
          </span>
        ))}
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-muted">{dataSource.quotaNote}</p>

      {dataSource.warnings.length > 0 ? (
        <div className="mt-2 rounded-xl border border-warn/25 bg-warn/5 p-2.5 text-[11px] leading-relaxed text-warn">
          <TriangleAlert className="mr-1 inline size-3" aria-hidden />
          {dataSource.warnings[0]}
        </div>
      ) : null}

      <p className="mt-2 text-[11px] leading-relaxed text-muted">
        Ogni stima mostra modello, ora di generazione, copertura e limiti.{" "}
        <Link href="/methodology#fonti" className="font-medium text-accent-text hover:underline">
          Dettagli sulle fonti →
        </Link>
      </p>
    </Card>
  );
}
