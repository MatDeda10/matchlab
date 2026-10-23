import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Clock3,
  Database,
  Layers,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { getDataSource } from "@/lib/api";
import { APP, MODEL } from "@/lib/config/constants";
import { addDaysIso, dayLabel, formatDate, todayIso } from "@/lib/dates";
import { listCompetitions, listFixtures, listPredictions, listScenarios, getSourceMetadata } from "@/lib/db/repositories";
import { readSessionId } from "@/lib/security/session";
import { getPreferences } from "@/lib/db/repositories";
import { predictScheduledFixture } from "@/lib/services/model";
import { FixtureCard } from "@/components/fixture-card";
import { DataSourceCard } from "@/components/data-source-card";
import {
  Alert,
  Badge,
  Card,
  Disclaimer,
  EmptyState,
  PageHeader,
  SectionHeading,
  Stat,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const dataSource = getDataSource();
  const sessionId = await readSessionId();
  const preferences = sessionId
    ? getPreferences(sessionId)
    : { timezone: APP.defaultTimezone };
  const timeZone = preferences.timezone;

  const today = todayIso(timeZone);
  const competitions = listCompetitions();
  const todayFixtures = listFixtures({
    from: `${today}T00:00:00.000Z`,
    to: `${today}T23:59:59.999Z`,
    limit: 24,
  });
  const upcoming = listFixtures({
    from: new Date().toISOString(),
    to: `${addDaysIso(today, 9)}T23:59:59.999Z`,
    statuses: ["SCHEDULED"],
    limit: 12,
    order: "asc",
  });
  const scheduledToday = todayFixtures.filter((fixture) => fixture.status === "SCHEDULED");

  const probabilities = new Map<string, { home: number; draw: number; away: number }>();
  for (const fixture of [...scheduledToday.slice(0, 4), ...upcoming.slice(0, 6)]) {
    if (probabilities.has(fixture.id)) continue;
    const prediction = predictScheduledFixture(fixture, { withUncertainty: false });
    if (prediction.status === "OK") {
      probabilities.set(fixture.id, {
        home: prediction.prediction.result.home,
        draw: prediction.prediction.result.draw,
        away: prediction.prediction.result.away,
      });
    }
  }

  const predictions = sessionId ? listPredictions(sessionId) : [];
  const scenarios = sessionId ? listScenarios(sessionId) : [];
  const sourceUpdates = getSourceMetadata(4);
  const openPredictions = predictions.filter((prediction) => prediction.status === "OPEN").length;
  const todayLabel = dayLabel(today, timeZone);

  return (
    <div className="reveal">
      <PageHeader
        eyebrow={formatDate(today, { weekday: "long", day: "numeric", month: "long", year: "numeric" }, timeZone)}
        title="Il calcio, letto con i numeri."
        description="Probabilità stimate, scenari spiegati e calibrazione monitorata. Nessuna promessa: solo ciò che il modello può e non può dire."
        actions={
          <>
            <Link href="/generator" className="btn btn-primary">
              <Sparkles className="size-4" aria-hidden />
              Genera uno scenario
            </Link>
            <Link href="/matches" className="btn btn-secondary">
              <CalendarDays className="size-4" aria-hidden />
              Partite
            </Link>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.45fr_1fr]">
        <Card className="overflow-hidden">
          <div className="relative p-5 sm:p-6">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-accent/10 blur-3xl"
            />
            <div className="relative">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="accent">{todayLabel}</Badge>
                <Badge tone="neutral">{competitions.length} competizioni</Badge>
                {dataSource.isDemo ? <Badge tone="warn">DEMO</Badge> : null}
              </div>
              <h2 className="mt-4 max-w-xl text-balance text-xl font-semibold leading-tight tracking-tight sm:text-2xl">
                {todayFixtures.length > 0
                  ? `${todayFixtures.length} partite in calendario oggi`
                  : "Nessuna partita oggi: ecco le prossime"}
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
                Apri una partita per vedere forma, formazioni disponibili, probabilità 1X2,
                Over/Under e Gol/No Gol con intervallo di sensibilità e qualità del dato.
              </p>
              <div className="mt-5 grid grid-cols-3 gap-3 border-t border-line pt-4">
                <Stat label="In programma" value={upcoming.length} hint="prossimi 9 giorni" />
                <Stat label="Tue previsioni" value={predictions.length} hint={`${openPredictions} aperte`} />
                <Stat label="Scenari salvati" value={scenarios.length} hint="solo questo dispositivo" />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-line bg-surface2/30 px-5 py-3 text-[11px] text-muted">
            <span className="flex items-center gap-1.5">
              <Clock3 className="size-3" aria-hidden />
              Modello {MODEL.version}
            </span>
            <span className="text-faint">·</span>
            <span>Nessun dato aggiornato dopo il calcio d'inizio</span>
            <Link href="/tracker" className="ml-auto flex items-center gap-1 font-medium text-accent-text hover:underline">
              Calibrazione <ArrowRight className="size-3" aria-hidden />
            </Link>
          </div>
        </Card>

        <DataSourceCard dataSource={dataSource} />
      </div>

      <section className="mt-8">
        <SectionHeading
          title="Partite di oggi"
          description="Stati distinti: programmata, in corso, conclusa, rinviata, annullata."
          action={
            <Link href="/matches" className="text-xs font-medium text-accent-text hover:underline">
              Tutte le partite →
            </Link>
          }
        />
        {todayFixtures.length === 0 ? (
          <EmptyState
            title="Nessuna partita oggi"
            description="Il calendario demo copre un intervallo relativo alla data di seed. Le prossime partite sono elencate qui sotto."
            icon={CalendarDays}
            action={
              <Link href="/matches" className="btn btn-secondary btn-sm">
                Apri il calendario
              </Link>
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {todayFixtures.slice(0, 6).map((fixture) => (
              <FixtureCard
                key={fixture.id}
                fixture={fixture}
                timeZone={timeZone}
                probabilities={probabilities.get(fixture.id)}
              />
            ))}
          </div>
        )}
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <section>
          <SectionHeading
            title="In arrivo"
            description="Solo partite programmate: nessuna stima viene mostrata come aggiornata a partita iniziata."
          />
          {upcoming.length === 0 ? (
            <EmptyState
              title="Calendario esaurito"
              description="Rigenera il dataset demo con `npm run db:seed` oppure configura un provider reale."
              icon={CalendarDays}
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {upcoming.slice(0, 6).map((fixture) => (
                <FixtureCard
                  key={fixture.id}
                  fixture={fixture}
                  timeZone={timeZone}
                  probabilities={probabilities.get(fixture.id)}
                  compact
                />
              ))}
            </div>
          )}
        </section>

        <div className="space-y-4">
          <Card className="p-4">
            <SectionHeading title="Aggiornamenti e fonti" description="Timestamp e stato dichiarati." />
            {sourceUpdates.length === 0 ? (
              <p className="text-xs leading-relaxed text-muted">
                Nessun aggiornamento registrato. In modalità demo il dataset viene creato dal seed.
              </p>
            ) : (
              <ul className="space-y-2">
                {sourceUpdates.map((source) => (
                  <li key={source.id} className="rounded-xl border border-line bg-surface2/40 p-2.5">
                    <p className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="flex items-center gap-1.5 font-medium">
                        <Database className="size-3" aria-hidden />
                        {source.provider}
                      </span>
                      <span className="text-faint">{formatDate(source.fetchedAt, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }, timeZone)}</span>
                    </p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted">{source.note ?? source.entityType}</p>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/methodology#fonti" className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-accent-text hover:underline">
              Stato completo delle fonti <ArrowRight className="size-3" aria-hidden />
            </Link>
          </Card>

          <Card className="p-4">
            <SectionHeading title="Come funziona" description="Tre passaggi, nessuna scorciatoia." />
            <ol className="space-y-3">
              {[
                { icon: CalendarDays, title: "Scegli gli eventi", text: "Filtra per data, competizione e mercati realmente calcolabili." },
                { icon: TrendingUp, title: "Leggi le stime", text: "Poisson/Dixon-Coles con qualità del dato e incertezza dichiarata." },
                { icon: Target, title: "Verifica nel tempo", text: "Brier score, log loss e calibrazione: anche quando sbaglia." },
              ].map((step, index) => (
                <li key={step.title} className="flex gap-3">
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-surface2 text-[11px] font-semibold text-accent-text">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-xs font-semibold">{step.title}</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted">{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-4 flex gap-2">
              <Link href="/scenarios" className="btn btn-secondary btn-sm flex-1">
                <Layers className="size-3.5" aria-hidden /> Scenari
              </Link>
              <Link href="/tracker" className="btn btn-secondary btn-sm flex-1">
                <Target className="size-3.5" aria-hidden /> Tracker
              </Link>
            </div>
          </Card>
        </div>
      </div>

      <div className="mt-8">
        <Alert title="Trasparenza sui dati" tone={dataSource.isDemo ? "warn" : "info"}>
          {dataSource.isDemo
            ? "Tutto ciò che vedi in questa istanza è generato sinteticamente. Non usarlo per decisioni reali. La modalità reale richiede una chiave football-data.org e il comando npm run sync."
            : "I dati provengono dal piano gratuito di football-data.org e possono essere ritardati. Formazioni e indisponibili non sono inclusi e la UI lo segnala."}
        </Alert>
      </div>

      <div className="mt-6">
        <Disclaimer />
      </div>
    </div>
  );
}
