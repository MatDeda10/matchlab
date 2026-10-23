import Link from "next/link";
import { Check, Minus, Database } from "lucide-react";
import { getDataSource } from "@/lib/api";
import { DataSourceCard } from "@/components/data-source-card";
import { Alert, Badge, Card, Disclaimer, PageHeader, SectionHeading } from "@/components/ui";

export const metadata = { title: "Fonti e copertura dei dati" };
export const dynamic = "force-dynamic";

const CAPABILITIES: Array<[keyof ReturnType<typeof getDataSource>["capabilities"], string]> = [
  ["fixtures", "Calendario partite"],
  ["results", "Risultati"],
  ["standings", "Classifiche (calcolate dai risultati)"],
  ["lineups", "Formazioni ufficiali"],
  ["probableLineups", "Formazioni probabili"],
  ["playerAvailability", "Infortuni e squalifiche"],
  ["matchStatistics", "Statistiche di partita"],
  ["xg", "Expected goals (xG)"],
  ["players", "Anagrafica giocatori"],
  ["historicalMatches", "Storico partite"],
];

export default function SourcesPage() {
  const dataSource = getDataSource();

  return (
    <div className="reveal">
      <PageHeader
        eyebrow="Fonti"
        title="Da dove arrivano i dati"
        description="Ogni dato ha una fonte, un timestamp e un livello di copertura. Ciò che la fonte non fornisce non viene inventato."
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-4">
          <DataSourceCard dataSource={dataSource} />
          <Card className="p-4">
            <SectionHeading title="Copertura attuale" />
            <ul className="space-y-1.5">
              {CAPABILITIES.map(([key, label]) => {
                const available = dataSource.capabilities[key];
                return (
                  <li key={key} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-muted">{label}</span>
                    {available ? (
                      <Badge tone="ok">
                        <Check className="size-3" aria-hidden /> Disponibile
                      </Badge>
                    ) : (
                      <Badge tone="neutral">
                        <Minus className="size-3" aria-hidden /> Non disponibile
                      </Badge>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <SectionHeading title="Modalità DEMO (predefinita)" />
            <p className="text-xs leading-relaxed text-muted">
              Il database viene popolato con un dataset sintetico: 4 competizioni inventate (Lega Aurora,
              Premier Albion, Liga Solar, Bundes Nord), 48 squadre, 864 giocatori e 2.640 partite relative
              alla data del seed. Le partite non sono reali e non devono essere usate per decisioni su
              eventi reali.
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Le formazioni possono essere <strong>ufficiali</strong> (per partite concluse/in corso),{" "}
              <strong>probabili</strong> (entro 1,5 giorni) o <strong>ricostruite dal modello</strong>. In
              ogni caso sono sintetiche: la UI mantiene la distinzione perché è un requisito di
              trasparenza.
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-faint">
              I dati DEMO sono relativi al giorno del seed. Se il tempo passa, rigenera con{" "}
              <code>npm run db:seed</code> per riallineare il calendario.
            </p>
          </Card>

          <Card className="p-5">
            <SectionHeading title="football-data.org v4 (opzionale)" />
            <p className="text-xs leading-relaxed text-muted">
              Provider reale gratuito per calendario e risultati delle principali competizioni europee.
              Richiede una chiave API personale. Il piano gratuito ha un limite dichiarato di 10 richieste
              al minuto ed espone i risultati con un ritardo; le competizioni disponibili dipendono dal
              piano e possono cambiare nel tempo.
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-muted">
              <li>Formazioni, indisponibili, xG e statistiche avanzate non sono inclusi nel piano gratuito.</li>
              <li>
                L&apos;adapter usa cache su SQLite (6 ore), rate limit locale prudente (8 richieste/minuto),
                timeout, retry con backoff e messaggi espliciti di indisponibilità.
              </li>
              <li>
                Se la chiave manca o la fonte fallisce, l&apos;app mostra l&apos;errore o ricade sul
                dataset DEMO in modo dichiarato: non simula dati reali.
              </li>
            </ul>
            <p className="mt-2 text-[11px] leading-relaxed text-faint">
              Configurazione: <code>DATA_PROVIDER=football-data</code>,{" "}
              <code>FOOTBALL_DATA_API_KEY=...</code>, <code>FOOTBALL_DATA_COMPETITIONS=SA,PL,PD,BL1,FL1</code>.
              Verifica sempre i termini e le quote correnti sul sito ufficiale del provider.
            </p>
          </Card>

          <Card className="p-5">
            <SectionHeading title="Cosa non è una fonte" />
            <ul className="list-disc space-y-1 pl-5 text-xs leading-relaxed text-muted">
              <li>Nessuna quota, nemmeno “a scopo illustrativo”.</li>
              <li>Nessun dato social o notizia non verificata.</li>
              <li>Nessuna stima presentata come osservazione.</li>
              <li>Nessun dato personale degli utenti.</li>
            </ul>
          </Card>
        </div>
      </div>

      {dataSource.warnings.length > 0 ? (
        <div className="mt-4">
          <Alert tone="warn" title="Avvisi di configurazione">
            {dataSource.warnings.join(" ")}
          </Alert>
        </div>
      ) : null}

      <div className="mt-4 flex items-start gap-2 rounded-xl border border-line bg-surface2/20 p-3 text-[10px] leading-relaxed text-muted">
        <Database className="mt-0.5 size-3.5 shrink-0 text-info" aria-hidden />
        <p>
          La quota del provider è documentata ma non garantita: le condizioni possono cambiare. MatchLab
          non promette gratuità perpetua né disponibilità continua. Vedi la{" "}
          <Link href="/methodology" className="text-accent-text hover:underline">
            metodologia
          </Link>{" "}
          per l&apos;uso dei dati nel motore.
        </p>
      </div>

      <div className="mt-6">
        <Disclaimer compact />
      </div>
    </div>
  );
}
