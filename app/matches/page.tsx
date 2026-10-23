import Link from "next/link";
import { CalendarDays, Filter, Search } from "lucide-react";
import { addDaysIso, dayLabel, formatDate, todayIso } from "@/lib/dates";
import { APP } from "@/lib/config/constants";
import {
  getPreferences,
  listCompetitions,
  listFixtures,
  listTeams,
} from "@/lib/db/repositories";
import { readSessionId } from "@/lib/security/session";
import type { FixtureStatus } from "@/lib/db/types";
import { predictScheduledFixture } from "@/lib/services/model";
import { FixtureCard } from "@/components/fixture-card";
import { Badge, EmptyState, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

const STATUS_OPTIONS: Array<{ value: FixtureStatus; label: string }> = [
  { value: "SCHEDULED", label: "Programmate" },
  { value: "IN_PLAY", label: "In corso" },
  { value: "FINISHED", label: "Concluse" },
  { value: "POSTPONED", label: "Rinviate" },
  { value: "CANCELLED", label: "Annullate" },
];

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function MatchesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const sessionId = await readSessionId();
  const timezone = sessionId ? getPreferences(sessionId).timezone : APP.defaultTimezone;

  const date = first(params.date);
  const competitionId = first(params.competition);
  const teamId = first(params.team);
  const query = first(params.q);
  const status = first(params.status);

  const today = todayIso(timezone);
  const from = date || today;
  const to = date || addDaysIso(today, 7);

  const competitions = listCompetitions();
  const teams = listTeams(competitionId || undefined);
  const validStatuses = STATUS_OPTIONS.map((option) => option.value);
  const fixtures = listFixtures({
    from: `${from}T00:00:00.000Z`,
    to: `${to}T23:59:59.999Z`,
    competitionIds: competitionId ? [competitionId] : undefined,
    teamId: teamId || undefined,
    statuses: validStatuses.includes(status as FixtureStatus)
      ? [status as FixtureStatus]
      : undefined,
    search: query || undefined,
    limit: 300,
    order: "asc",
  });

  const probabilities = new Map<string, { home: number; draw: number; away: number }>();
  for (const fixture of fixtures.filter((item) => item.status === "SCHEDULED").slice(0, 40)) {
    const prediction = predictScheduledFixture(fixture, { withUncertainty: false });
    if (prediction.status === "OK") {
      probabilities.set(fixture.id, {
        home: prediction.prediction.result.home,
        draw: prediction.prediction.result.draw,
        away: prediction.prediction.result.away,
      });
    }
  }

  const groups = new Map<string, typeof fixtures>();
  for (const fixture of fixtures) {
    const key = fixture.kickoffUtc.slice(0, 10);
    const list = groups.get(key) ?? [];
    list.push(fixture);
    groups.set(key, list);
  }

  return (
    <div className="reveal">
      <PageHeader
        eyebrow="Calendario"
        title="Partite"
        description="Filtra per data, competizione, squadra e stato. Le stime sono mostrate solo per le partite programmate."
        actions={<Badge tone="neutral">{fixtures.length} risultati</Badge>}
      />

      <form
        method="get"
        action="/matches"
        className="card mb-6 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-12"
        aria-label="Filtri partite"
      >
        <div className="lg:col-span-2">
          <label htmlFor="date" className="mb-1 block text-[11px] font-medium text-muted">Data</label>
          <input id="date" name="date" type="date" defaultValue={date} className="input" />
        </div>
        <div className="lg:col-span-3">
          <label htmlFor="competition" className="mb-1 block text-[11px] font-medium text-muted">Competizione</label>
          <select id="competition" name="competition" defaultValue={competitionId} className="select">
            <option value="">Tutte</option>
            {competitions.map((competition) => (
              <option key={competition.id} value={competition.id}>{competition.name}</option>
            ))}
          </select>
        </div>
        <div className="lg:col-span-3">
          <label htmlFor="team" className="mb-1 block text-[11px] font-medium text-muted">Squadra</label>
          <select id="team" name="team" defaultValue={teamId} className="select">
            <option value="">Tutte</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>{team.name}</option>
            ))}
          </select>
        </div>
        <div className="lg:col-span-2">
          <label htmlFor="status" className="mb-1 block text-[11px] font-medium text-muted">Stato</label>
          <select id="status" name="status" defaultValue={status} className="select">
            <option value="">Tutti</option>
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        <div className="lg:col-span-2">
          <label htmlFor="q" className="mb-1 block text-[11px] font-medium text-muted">Ricerca</label>
          <input id="q" name="q" type="search" defaultValue={query} placeholder="Squadra…" className="input" />
        </div>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-12">
          <button type="submit" className="btn btn-primary btn-sm">
            <Filter className="size-3.5" aria-hidden /> Applica filtri
          </button>
          <Link href="/matches" className="btn btn-ghost btn-sm">Azzera</Link>
          <div className="ml-auto hidden flex-wrap gap-1.5 sm:flex">
            <Link href={`/matches?date=${today}`} className="chip hover:text-fg">Oggi</Link>
            <Link href="/matches" className="chip hover:text-fg">Prossimi 7 giorni</Link>
            <Link href={`/matches?status=FINISHED`} className="chip hover:text-fg">
              <Search className="size-3" aria-hidden /> Concluse
            </Link>
          </div>
        </div>
      </form>

      <p className="mb-4 flex items-center gap-2 text-[11px] text-muted">
        <CalendarDays className="size-3.5" aria-hidden />
        {date
          ? `Partite del ${formatDate(date, { weekday: "long", day: "2-digit", month: "long" }, timezone)}`
          : `Dal ${formatDate(from, { day: "2-digit", month: "short" }, timezone)} al ${formatDate(to, { day: "2-digit", month: "short" }, timezone)}`}
        <span className="text-faint">· orari in {timezone}</span>
      </p>

      {fixtures.length === 0 ? (
        <EmptyState
          title="Nessuna partita con questi filtri"
          description="Prova ad ampliare l'intervallo di date, rimuovere la squadra o cambiare competizione. In modalità DEMO il calendario è relativo alla data del seed."
          icon={CalendarDays}
          action={<Link href="/matches" className="btn btn-secondary btn-sm">Rimuovi filtri</Link>}
        />
      ) : (
        <div className="space-y-8">
          {[...groups.entries()].map(([isoDate, dayFixtures]) => (
            <section key={isoDate} aria-labelledby={`day-${isoDate}`}>
              <div className="mb-3 flex items-baseline gap-2">
                <h2 id={`day-${isoDate}`} className="text-sm font-semibold capitalize">
                  {dayLabel(isoDate, timezone)}
                </h2>
                <span className="text-[11px] text-faint">
                  {formatDate(isoDate, { day: "2-digit", month: "long" }, timezone)} · {dayFixtures.length} partite
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {dayFixtures.map((fixture) => (
                  <FixtureCard
                    key={fixture.id}
                    fixture={fixture}
                    timeZone={timezone}
                    probabilities={probabilities.get(fixture.id)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <p className="mt-6 text-[11px] leading-relaxed text-faint">
        Le partite in corso o concluse mostrano il risultato disponibile, non una previsione
        aggiornata. Le probabilità pre-partita non vengono ricalcolate dopo il calcio d&apos;inizio.
      </p>
    </div>
  );
}
