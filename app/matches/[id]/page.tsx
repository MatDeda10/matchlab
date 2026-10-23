import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  CircleAlert,
  History,
  MapPin,
  ShieldQuestion,
  Users,
} from "lucide-react";
import { getDataSource } from "@/lib/api";
import { APP, MARKETS, MODEL, type MarketId } from "@/lib/config/constants";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatPercent, formatProbabilityRange, formatScore } from "@/lib/format";
import {
  getAvailability,
  getCompetition,
  getFixture,
  getFixtureStatistics,
  getLineups,
  getPreferences,
  getStandings,
  listFixtures,
} from "@/lib/db/repositories";
import { readSessionId } from "@/lib/security/session";
import type { AvailabilityDto, LineupDto } from "@/lib/db/types";
import { predictScheduledFixture } from "@/lib/services/model";
import { selectionLabel } from "@/engine/markets";
import { topCorrectScores } from "@/engine/markets";
import { totalGoalsDistribution } from "@/engine/markets";
import { headToHead, teamSummary, type FormEntry } from "@/features/teams/summary";
import { PredictionForm, type PredictionOption } from "@/components/prediction-form";
import { Pitch } from "@/components/pitch";
import { CalibrationChart, GoalsDistribution, ScoreHeatmap } from "@/components/charts";
import {
  Alert,
  Badge,
  Card,
  DemoBadge,
  Disclaimer,
  EmptyState,
  ProbabilityBar,
  QualityBadge,
  SectionHeading,
  Stat,
  StatusBadge,
  TeamDot,
} from "@/components/ui";

export const dynamic = "force-dynamic";

const TABS = [
  { id: "overview", label: "Panoramica", icon: Activity },
  { id: "stats", label: "Statistiche", icon: BarChart3 },
  { id: "lineups", label: "Formazioni", icon: Users },
  { id: "availability", label: "Indisponibili", icon: ShieldQuestion },
  { id: "analysis", label: "Analisi", icon: BarChart3 },
  { id: "history", label: "Storico", icon: History },
] as const;

type TabId = (typeof TABS)[number]["id"];

const MARKET_GROUPS: Array<{ label: string; marketId: MarketId; selections: string[] }> = [
  { label: "Esito finale (1X2)", marketId: "1X2", selections: ["HOME", "DRAW", "AWAY"] },
  { label: "Doppia chance", marketId: "DC", selections: ["HOME_DRAW", "HOME_AWAY", "DRAW_AWAY"] },
  { label: "Over/Under 1.5", marketId: "OU15", selections: ["OVER", "UNDER"] },
  { label: "Over/Under 2.5", marketId: "OU25", selections: ["OVER", "UNDER"] },
  { label: "Gol / No Gol", marketId: "BTTS", selections: ["YES", "NO"] },
];

function FormPills({ entries }: { entries: FormEntry[] }) {
  if (entries.length === 0) return <span className="text-[11px] text-faint">Nessun dato</span>;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {entries.map((entry) => (
        <span
          key={entry.fixtureId}
          className={`flex size-6 items-center justify-center rounded-full text-[10px] font-bold ${
            entry.result === "W"
              ? "bg-ok/15 text-ok"
              : entry.result === "D"
                ? "bg-warn/15 text-warn"
                : "bg-danger/15 text-danger"
          }`}
          title={`${entry.isHome ? "Casa" : "Trasferta"} vs ${entry.opponent}: ${entry.goalsFor}-${entry.goalsAgainst}`}
        >
          {entry.result}
        </span>
      ))}
    </div>
  );
}

function SummaryRow({ label, home, away }: { label: string; home: string; away: string }) {
  return (
    <tr>
      <td className="text-muted">{label}</td>
      <td className="tnum text-center font-medium">{home}</td>
      <td className="tnum text-center font-medium">{away}</td>
    </tr>
  );
}

function StatCompare({
  label,
  home,
  away,
  invalid = false,
}: {
  label: string;
  home: number | null;
  away: number | null;
  invalid?: boolean;
}) {
  const homeValue = home ?? 0;
  const awayValue = away ?? 0;
  const max = Math.max(homeValue, awayValue, 0.01);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="tnum w-10 font-semibold">{home === null ? "—" : homeValue.toFixed(2)}</span>
        <span className="text-muted">{label}</span>
        <span className="tnum w-10 text-right font-semibold">{away === null ? "—" : awayValue.toFixed(2)}</span>
      </div>
      <div className="flex h-1.5 gap-1">
        <div className="flex flex-1 justify-end overflow-hidden rounded-full bg-surface3">
          <div
            className="h-full rounded-full bg-accent"
            style={{ width: invalid ? "0%" : `${(homeValue / max) * 100}%` }}
          />
        </div>
        <div className="flex flex-1 overflow-hidden rounded-full bg-surface3">
          <div
            className="h-full rounded-full bg-info"
            style={{ width: invalid ? "0%" : `${(awayValue / max) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function AvailabilityColumn({
  teamName,
  rows,
  lineup,
}: {
  teamName: string;
  rows: AvailabilityDto[];
  lineup: LineupDto | undefined;
}) {
  const starters = new Set(
    lineup?.players.filter((player) => player.isStarter).map((player) => player.playerId) ?? [],
  );
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line-strong p-4">
        <p className="text-sm font-semibold">{teamName}</p>
        <p className="mt-1 text-[11px] leading-relaxed text-muted">
          Nessun indisponibile registrato dalla fonte. Assenza di segnalazione non equivale a
          disponibilità certa: la copertura può essere incompleta.
        </p>
      </div>
    );
  }
  return (
    <div>
      <p className="mb-2 text-sm font-semibold">{teamName}</p>
      <ul className="space-y-1.5">
        {rows.map((row) => (
          <li key={row.id} className="rounded-xl border border-line bg-surface2/40 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="min-w-0 truncate text-xs font-medium">{row.playerName}</p>
              <Badge
                tone={
                  row.status === "INJURED" || row.status === "SUSPENDED"
                    ? "danger"
                    : row.status === "DOUBTFUL"
                      ? "warn"
                      : "neutral"
                }
              >
                {row.status === "INJURED"
                  ? "Infortunato"
                  : row.status === "SUSPENDED"
                    ? "Squalificato"
                    : row.status === "DOUBTFUL"
                      ? "In dubbio"
                      : row.status === "RETURNING"
                        ? "In rientro"
                        : "Non noto"}
              </Badge>
            </div>
            <p className="mt-1 text-[10px] leading-relaxed text-muted">
              {row.reason ?? "Motivo non comunicato"} · fonte {row.source}
              {starters.has(row.playerId) ? " · titolare atteso" : ""}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function MatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const rawTab = Array.isArray(query.tab) ? query.tab[0] : query.tab;
  const tab: TabId = TABS.some((item) => item.id === rawTab) ? (rawTab as TabId) : "overview";

  const fixture = getFixture(id);
  if (!fixture) notFound();

  const sessionId = await readSessionId();
  const timezone = sessionId ? getPreferences(sessionId).timezone : APP.defaultTimezone;
  const competition = getCompetition(fixture.competitionId);
  const dataSource = getDataSource();

  const predictionResult =
    fixture.status === "SCHEDULED"
      ? predictScheduledFixture(fixture, { withUncertainty: true })
      : null;
  const model = predictionResult?.status === "OK" ? predictionResult.prediction : null;

  const statistics = getFixtureStatistics(fixture.id);
  const lineups = getLineups(fixture.id);
  const availability = getAvailability(fixture.id);
  const homeLineup = lineups.find((lineup) => lineup.teamId === fixture.homeTeamId);
  const awayLineup = lineups.find((lineup) => lineup.teamId === fixture.awayTeamId);

  const homeSummary = teamSummary(fixture.homeTeamId, fixture.competitionId, fixture.kickoffUtc);
  const awaySummary = teamSummary(fixture.awayTeamId, fixture.competitionId, fixture.kickoffUtc);
  const standings = getStandings(fixture.competitionId);
  const previousMeetings = headToHead(
    fixture.homeTeamId,
    fixture.awayTeamId,
    fixture.competitionId,
    fixture.kickoffUtc,
  );
  const homeRecent = listFixtures({
    teamId: fixture.homeTeamId,
    competitionIds: [fixture.competitionId],
    statuses: ["FINISHED"],
    to: fixture.kickoffUtc,
    limit: 5,
    order: "desc",
  });
  const awayRecent = listFixtures({
    teamId: fixture.awayTeamId,
    competitionIds: [fixture.competitionId],
    statuses: ["FINISHED"],
    to: fixture.kickoffUtc,
    limit: 5,
    order: "desc",
  });

  const live = fixture.status === "IN_PLAY";
  const finished = fixture.status === "FINISHED";
  const hasScore = (finished || live) && fixture.homeGoals !== null && fixture.awayGoals !== null;

  const predictionOptions: PredictionOption[] = model
    ? [
        {
          marketId: "1X2",
          marketLabel: "Esito finale",
          selections: ["HOME", "DRAW", "AWAY"].map((selection) => ({
            id: selection,
            label: selectionLabel("1X2", selection),
            probability: model.marketMap[`1X2:${selection}`] ?? 0,
          })),
        },
        {
          marketId: "OU25",
          marketLabel: "Over/Under 2.5",
          selections: ["OVER", "UNDER"].map((selection) => ({
            id: selection,
            label: selectionLabel("OU25", selection),
            probability: model.marketMap[`OU25:${selection}`] ?? 0,
          })),
        },
        {
          marketId: "BTTS",
          marketLabel: "Gol / No Gol",
          selections: ["YES", "NO"].map((selection) => ({
            id: selection,
            label: selectionLabel("BTTS", selection),
            probability: model.marketMap[`BTTS:${selection}`] ?? 0,
          })),
        },
      ]
    : [];

  const availabilityConflicts = [...availability.reduce((map, row) => {
    const key = row.playerId ?? row.playerName;
    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
    return map;
  }, new Map<string, AvailabilityDto[]>()).entries()].filter(([, rows]) => {
    const statuses = new Set(rows.map((row) => row.status));
    return statuses.size > 1;
  });

  return (
    <div className="reveal">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href="/matches" className="btn btn-ghost btn-sm -ml-2">
          <ArrowLeft className="size-3.5" aria-hidden /> Partite
        </Link>
        <Badge tone="neutral">{fixture.competitionName}</Badge>
        {fixture.round ? <Badge tone="neutral">{fixture.round}</Badge> : null}
        {fixture.isDemo ? <DemoBadge /> : null}
        <StatusBadge status={fixture.status} />
      </div>

      <Card className="overflow-hidden">
        <div className="grid gap-4 p-5 sm:p-6 md:grid-cols-[1fr_auto_1fr] md:items-center">
          <div className="flex items-center gap-3 md:flex-col md:items-start md:gap-2">
            <TeamDot name={fixture.homeTeamName} color={fixture.homeColor} />
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-faint">Casa</p>
              <p className="truncate text-lg font-semibold leading-tight">{fixture.homeTeamName}</p>
              <p className="mt-0.5 text-[11px] text-muted">
                {homeSummary.overall.played > 0
                  ? `${homeSummary.overall.won}V ${homeSummary.overall.drawn}N ${homeSummary.overall.lost}P · ${homeSummary.overall.goalsFor}:${homeSummary.overall.goalsAgainst}`
                  : "Nessun dato recente"}
              </p>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center gap-1 rounded-2xl bg-surface2/50 px-6 py-3 text-center">
            {hasScore ? (
              <p className="tnum text-3xl font-semibold tracking-tight">
                {fixture.homeGoals} <span className="text-faint">–</span> {fixture.awayGoals}
              </p>
            ) : (
              <p className="text-lg font-semibold text-muted">vs</p>
            )}
            <p className="text-[11px] text-muted">
              {formatDateTime(fixture.kickoffUtc, timezone)}
            </p>
            <p className="flex items-center gap-1 text-[10px] text-faint">
              <MapPin className="size-3" aria-hidden /> {fixture.venue ?? "Sede non disponibile"}
            </p>
          </div>

          <div className="flex items-center gap-3 md:flex-col md:items-end md:gap-2 md:text-right">
            <TeamDot name={fixture.awayTeamName} color={fixture.awayColor} />
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-faint">Ospite</p>
              <p className="truncate text-lg font-semibold leading-tight">{fixture.awayTeamName}</p>
              <p className="mt-0.5 text-[11px] text-muted">
                {awaySummary.overall.played > 0
                  ? `${awaySummary.overall.won}V ${awaySummary.overall.drawn}N ${awaySummary.overall.lost}P · ${awaySummary.overall.goalsFor}:${awaySummary.overall.goalsAgainst}`
                  : "Nessun dato recente"}
              </p>
            </div>
          </div>
        </div>

        {model ? (
          <div className="grid grid-cols-3 gap-2 border-t border-line p-4">
            {[
              { label: "1 · Casa", value: model.result.home },
              { label: "X · Pareggio", value: model.result.draw },
              { label: "2 · Ospite", value: model.result.away },
            ].map((item) => (
              <div key={item.label} className="rounded-xl bg-surface2/50 p-2.5 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-faint">{item.label}</p>
                <p className="tnum mt-0.5 text-xl font-semibold">{formatPercent(item.value)}</p>
                <p className="tnum text-[10px] text-muted">
                  {formatProbabilityRange(model.uncertainty[`1X2:${item.label.startsWith("1") ? "HOME" : item.label.startsWith("X") ? "DRAW" : "AWAY"}`])}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        {finished || live ? (
          <div className="border-t border-line bg-surface2/30 px-4 py-3 text-[11px] text-muted">
            {live
              ? "Partita in corso: le probabilità pre-partita non vengono ricalcolate né mostrate come live."
              : "Partita conclusa: viene mostrato il risultato disponibile, non una previsione aggiornata."}
          </div>
        ) : null}
      </Card>

      <nav
        className="mt-5 flex gap-1 overflow-x-auto border-b border-line pb-px"
        aria-label="Sezioni della partita"
      >
        {TABS.map((item) => {
          const active = tab === item.id;
          const Icon = item.icon;
          return (
            <Link
              key={item.id}
              href={`/matches/${fixture.id}?tab=${item.id}`}
              aria-current={active ? "page" : undefined}
              className={`flex shrink-0 items-center gap-1.5 rounded-t-lg border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
                active
                  ? "border-accent text-fg"
                  : "border-transparent text-muted hover:text-fg"
              }`}
            >
              <Icon className="size-3.5" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-5">
        {tab === "overview" ? (
          <div className="space-y-5">
            <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
              <Card className="p-4">
                <SectionHeading
                  title="Forma recente"
                  description="Ultime 5 partite concluse, dalla più recente. Casa/trasferta separate nel dettaglio."
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  {[
                    { name: fixture.homeTeamName, summary: homeSummary },
                    { name: fixture.awayTeamName, summary: awaySummary },
                  ].map((team) => (
                    <div key={team.name} className="rounded-xl border border-line bg-surface2/30 p-3">
                      <p className="truncate text-xs font-semibold">{team.name}</p>
                      <div className="mt-2">
                        <FormPills entries={team.summary.overall.form} />
                      </div>
                      <p className="mt-2 text-[10px] text-muted">
                        Casa: {team.summary.home.won}V {team.summary.home.drawn}N {team.summary.home.lost}P ·{" "}
                        {team.summary.home.goalsFor}:{team.summary.home.goalsAgainst}
                      </p>
                      <p className="text-[10px] text-muted">
                        Trasferta: {team.summary.away.won}V {team.summary.away.drawn}N {team.summary.away.lost}P ·{" "}
                        {team.summary.away.goalsFor}:{team.summary.away.goalsAgainst}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-3">
                  <Link href={`/matches/${fixture.id}?tab=history`} className="text-[11px] font-medium text-accent-text hover:underline">
                    Storico completo e testa a testa →
                  </Link>
                </div>
              </Card>

              <Card className="p-4">
                <SectionHeading title="Qualità del dato" description="Punteggio trasparente, non probabilità di vincita." />
                {model ? (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <QualityBadge score={model.quality.score} />
                      <span className="text-[10px] text-faint">
                        {model.coverage.sampleMatches} partite nella competizione
                      </span>
                    </div>
                    <div className="mt-3 space-y-2">
                      {model.quality.reasons.slice(0, 4).map((reason) => (
                        <p key={reason} className="text-[11px] leading-relaxed text-muted">· {reason}</p>
                      ))}
                    </div>
                    {model.quality.missing.length > 0 ? (
                      <p className="mt-2 rounded-lg bg-warn/5 p-2 text-[10px] leading-relaxed text-warn">
                        Mancano: {model.quality.missing.slice(0, 3).join("; ")}.
                      </p>
                    ) : null}
                  </>
                ) : (
                  <p className="text-xs leading-relaxed text-muted">
                    La qualità del dato è valutata solo per le stime pre-partita. Per questa partita
                    non viene generata una previsione.
                  </p>
                )}
              </Card>
            </div>

            {model ? (
              <Card className="p-4">
                <SectionHeading
                  title="Mercati più probabili"
                  description="Probabilità più alte ≠ valore o convenienza. Nessuna quota è stata usata."
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  {[...model.markets]
                    .filter((market) => market.probability > 0 && market.probability < 1)
                    .sort((a, b) => b.probability - a.probability)
                    .slice(0, 4)
                    .map((market) => (
                      <div key={market.key}>
                        <p className="mb-1 flex items-center justify-between gap-2 text-xs">
                          <span className="truncate text-muted">
                            {MARKETS[market.marketId].short} · {market.label}
                          </span>
                          <span className="tnum font-semibold">{formatPercent(market.probability)}</span>
                        </p>
                        <ProbabilityBar
                          value={market.probability}
                          showValue={false}
                          ariaLabel={`${MARKETS[market.marketId].short} ${market.label}`}
                        />
                      </div>
                    ))}
                </div>
              </Card>
            ) : null}

            {model ? (
              <Card className="p-4">
                <PredictionForm
                  fixtureId={fixture.id}
                  fixtureLabel={`${fixture.homeTeamName} – ${fixture.awayTeamName}`}
                  options={predictionOptions}
                />
              </Card>
            ) : null}

            <Alert tone="info" title="Cosa non dice questa pagina">
              Le probabilità non incorporano notizie dell&apos;ultima ora, meteo, arbitri o motivazioni.
              Non sono quotazioni e non garantiscono il risultato. Le formazioni “probabili” non sono
              ufficiali; quelle “ricostruite dal modello” sono una stima algoritmica e vanno lette come tale.
            </Alert>
          </div>
        ) : null}

        {tab === "stats" ? (
          <div className="space-y-5">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="p-4">
                <SectionHeading title="Statistiche della partita" description="Solo se disponibili dalla fonte." />
                {statistics ? (
                  <div className="space-y-4">
                    <StatCompare label="xG" home={statistics.homeXg} away={statistics.awayXg} />
                    <StatCompare label="Tiri" home={statistics.homeShots} away={statistics.awayShots} />
                    <StatCompare
                      label="Tiri in porta"
                      home={statistics.homeShotsOnTarget}
                      away={statistics.awayShotsOnTarget}
                    />
                    <StatCompare
                      label="Possesso %"
                      home={statistics.homePossession}
                      away={statistics.awayPossession}
                    />
                    <p className="text-[10px] text-faint">
                      Fonte: {statistics.source}. xG non è usato dal modello v{MODEL.version.split("-").pop()}:
                      le stime si basano sui gol.
                    </p>
                  </div>
                ) : (
                  <EmptyState
                    title="Statistiche non disponibili"
                    description={
                      dataSource.capabilities.matchStatistics
                        ? "La fonte non ha statistiche per questa partita."
                        : "Il provider configurato non include statistiche di partita. Nessun valore viene inventato."
                    }
                    icon={BarChart3}
                  />
                )}
              </Card>

              <Card className="p-4">
                <SectionHeading title="Confronto recente" description="Ultime 30 partite concluse nella competizione." />
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Voce</th>
                        <th className="text-center">{fixture.homeTeamShort}</th>
                        <th className="text-center">{fixture.awayTeamShort}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <SummaryRow label="Partite" home={String(homeSummary.overall.played)} away={String(awaySummary.overall.played)} />
                      <SummaryRow label="Punti/partita" home={formatScore(homeSummary.overall.pointsPerGame)} away={formatScore(awaySummary.overall.pointsPerGame)} />
                      <SummaryRow label="Gol fatti" home={String(homeSummary.overall.goalsFor)} away={String(awaySummary.overall.goalsFor)} />
                      <SummaryRow label="Gol subiti" home={String(homeSummary.overall.goalsAgainst)} away={String(awaySummary.overall.goalsAgainst)} />
                      <SummaryRow label="Vittorie" home={String(homeSummary.overall.won)} away={String(awaySummary.overall.won)} />
                      <SummaryRow label="Pareggi" home={String(homeSummary.overall.drawn)} away={String(awaySummary.overall.drawn)} />
                      <SummaryRow label="Sconfitte" home={String(homeSummary.overall.lost)} away={String(awaySummary.overall.lost)} />
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>

            <Card className="p-4">
              <SectionHeading
                title={`Classifica · ${competition?.name ?? fixture.competitionName}`}
                description="Calcolata solo dalle partite concluse della stagione più recente presente nel database."
              />
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Squadra</th>
                      <th className="text-center">PG</th>
                      <th className="text-center">V</th>
                      <th className="text-center">N</th>
                      <th className="text-center">P</th>
                      <th className="text-center">GF</th>
                      <th className="text-center">GS</th>
                      <th className="text-center">DR</th>
                      <th className="text-center">Pti</th>
                      <th>Forma</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((row) => {
                      const highlight =
                        row.teamId === fixture.homeTeamId || row.teamId === fixture.awayTeamId;
                      return (
                        <tr key={row.teamId} className={highlight ? "bg-accent/5" : undefined}>
                          <td className="tnum text-muted">{row.position}</td>
                          <td className={highlight ? "font-semibold" : undefined}>{row.teamName}</td>
                          <td className="tnum text-center">{row.played}</td>
                          <td className="tnum text-center">{row.won}</td>
                          <td className="tnum text-center">{row.drawn}</td>
                          <td className="tnum text-center">{row.lost}</td>
                          <td className="tnum text-center">{row.goalsFor}</td>
                          <td className="tnum text-center">{row.goalsAgainst}</td>
                          <td className="tnum text-center">{row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</td>
                          <td className="tnum text-center font-semibold">{row.points}</td>
                          <td>
                            <FormPills entries={row.form.map((result, index) => ({
                              fixtureId: `${row.teamId}-${index}`,
                              kickoff: "",
                              opponent: "",
                              isHome: true,
                              goalsFor: 0,
                              goalsAgainst: 0,
                              result,
                            }))} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        ) : null}

        {tab === "lineups" ? (
          <div className="space-y-4">
            <Alert tone="warn" title="Distingui sempre il tipo di formazione">
              <ul className="list-disc space-y-1 pl-4">
                <li><strong>Ufficiale</strong>: comunicata come tale dalla fonte.</li>
                <li><strong>Probabile</strong>: indicata come probabile dalla fonte, non confermata.</li>
                <li><strong>Ricostruita dal modello</strong>: stima algoritmica, non una fonte.</li>
              </ul>
              {dataSource.isDemo ? <p className="mt-2">In modalità DEMO tutte le formazioni sono sintetiche.</p> : null}
            </Alert>
            {lineups.length === 0 ? (
              <EmptyState
                title="Formazioni non disponibili"
                description={
                  dataSource.capabilities.lineups
                    ? "La fonte non ha ancora pubblicato formazioni per questa partita."
                    : "Il provider gratuito non include formazioni. MatchLab non le inventa."
                }
                icon={Users}
              />
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="p-4">
                  {homeLineup ? (
                    <Pitch lineup={homeLineup} teamName={fixture.homeTeamName} teamColor={fixture.homeColor} />
                  ) : (
                    <EmptyState title="Nessuna formazione" description="La fonte non ha fornito la formazione della squadra di casa." icon={Users} />
                  )}
                </Card>
                <Card className="p-4">
                  {awayLineup ? (
                    <Pitch lineup={awayLineup} teamName={fixture.awayTeamName} teamColor={fixture.awayColor} />
                  ) : (
                    <EmptyState title="Nessuna formazione" description="La fonte non ha fornito la formazione ospite." icon={Users} />
                  )}
                </Card>
              </div>
            )}
          </div>
        ) : null}

        {tab === "availability" ? (
          <div className="space-y-4">
            <Card className="p-4">
              <SectionHeading
                title="Indisponibili e dubbi"
                description="Stato per giocatore, fonte e motivo dichiarato. UNKNOWN resta UNKNOWN."
              />
              {availability.length === 0 ? (
                <EmptyState
                  title="Nessuna segnalazione disponibile"
                  description={
                    dataSource.capabilities.playerAvailability
                      ? "La fonte non ha segnalato indisponibili per questa partita. L'assenza di segnalazioni non è una garanzia."
                      : "Il provider gratuito non include infortuni e squalifiche. MatchLab non li inventa."
                  }
                  icon={ShieldQuestion}
                />
              ) : (
                <div className="grid gap-5 sm:grid-cols-2">
                  <AvailabilityColumn
                    teamName={fixture.homeTeamName}
                    rows={availability.filter((row) => row.teamId === fixture.homeTeamId)}
                    lineup={homeLineup}
                  />
                  <AvailabilityColumn
                    teamName={fixture.awayTeamName}
                    rows={availability.filter((row) => row.teamId === fixture.awayTeamId)}
                    lineup={awayLineup}
                  />
                </div>
              )}
            </Card>

            {availabilityConflicts.length > 0 ? (
              <Alert tone="warn" title={`Fonti in conflitto (${availabilityConflicts.length})`}>
                <ul className="space-y-2">
                  {availabilityConflicts.map(([key, rows]) => (
                    <li key={key} className="rounded-lg border border-warn/20 bg-warn/5 p-2">
                      <p className="text-xs font-semibold">{rows[0]?.playerName}</p>
                      <p className="mt-0.5 text-[11px]">
                        {rows.map((row) => `${row.source}: ${row.status}`).join(" · ")}
                      </p>
                      <p className="mt-0.5 text-[10px] text-muted">
                        Le fonti non concordano: la UI mostra entrambe invece di sceglierne una in silenzio.
                      </p>
                    </li>
                  ))}
                </ul>
              </Alert>
            ) : null}

            <p className="text-[11px] leading-relaxed text-faint">
              La disponibilità non viene usata per modificare le probabilità in questa versione: il
              motore v{MODEL.version} usa solo i risultati storici. È un limite dichiarato, non un
              dato nascosto.
            </p>
          </div>
        ) : null}

        {tab === "analysis" ? (
          <div className="space-y-5">
            {!model ? (
              <EmptyState
                title="Nessuna stima pre-partita"
                description={
                  fixture.status === "SCHEDULED"
                    ? predictionResult?.status === "UNAVAILABLE"
                      ? predictionResult.reason
                      : "Storico insufficiente per generare una stima."
                    : "La partita non è programmata: MatchLab non mostra previsioni come se fossero live."
                }
                icon={CircleAlert}
              />
            ) : (
              <>
                <div className="grid gap-4 lg:grid-cols-3">
                  <Card className="p-4">
                    <p className="text-[11px] uppercase tracking-wider text-faint">Gol attesi (λ)</p>
                    <div className="mt-2 grid grid-cols-2 gap-3">
                      <Stat label="Casa" value={formatScore(model.lambdaHome)} hint="gol attesi" />
                      <Stat label="Ospite" value={formatScore(model.lambdaAway)} hint="gol attesi" />
                    </div>
                    <p className="mt-3 text-[10px] leading-relaxed text-muted">
                      λ non è un punteggio previsto: è la media della distribuzione Poisson usata per
                      calcolare tutte le probabilità.
                    </p>
                  </Card>
                  <Card className="p-4">
                    <p className="text-[11px] uppercase tracking-wider text-faint">Modello</p>
                    <p className="mt-2 text-sm font-semibold">{MODEL.label}</p>
                    <p className="mt-1 text-[11px] text-muted">Versione {model.modelVersion}</p>
                    <p className="mt-1 text-[10px] text-faint">
                      Generata: {formatDateTime(model.generatedAt, timezone)}
                    </p>
                    <p className="mt-2 text-[10px] leading-relaxed text-muted">
                      Half-life {MODEL.halfLifeDays} giorni · shrinkage {MODEL.shrinkageMatches} partite ·
                      ρ {MODEL.rho} · {MODEL.uncertaintyIterations} simulazioni di sensibilità.
                    </p>
                  </Card>
                  <Card className="p-4">
                    <p className="text-[11px] uppercase tracking-wider text-faint">Copertura</p>
                    <div className="mt-2 space-y-2">
                      <QualityBadge score={model.quality.score} />
                      <p className="text-[11px] text-muted">
                        Partite squadra casa: {model.coverage.homeMatches} · ospite: {model.coverage.awayMatches}
                      </p>
                      <p className="text-[10px] text-faint">
                        Formazioni usate: {model.coverage.hasLineups ? "sì" : "no"} · indisponibili:{" "}
                        {model.coverage.hasAvailability ? "sì" : "no"} · xG: {model.coverage.hasXg ? "sì" : "no"}
                      </p>
                    </div>
                  </Card>
                </div>

                <Card className="p-4">
                  <SectionHeading
                    title="Tutti i mercati calcolati"
                    description="Probabilità e intervallo di sensibilità p10–p90 (Monte Carlo deterministico)."
                  />
                  <div className="grid gap-5 sm:grid-cols-2">
                    {MARKET_GROUPS.map((group) => (
                      <div key={group.marketId}>
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-faint">
                          {group.label}
                        </p>
                        <div className="space-y-1.5">
                          {group.selections.map((selection) => {
                            const key = `${group.marketId}:${selection}`;
                            const probability = model.marketMap[key] ?? 0;
                            const interval = model.uncertainty[key];
                            return (
                              <div key={key} className="flex items-center gap-2 rounded-lg bg-surface2/30 px-2 py-1.5">
                                <span className="min-w-0 flex-1 truncate text-xs text-muted">
                                  {selectionLabel(group.marketId, selection)}
                                </span>
                                <span className="tnum text-xs font-semibold">{formatPercent(probability)}</span>
                                <span className="tnum w-16 text-right text-[10px] text-faint">
                                  {formatProbabilityRange(interval)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                <div className="grid gap-4 lg:grid-cols-2">
                  <Card className="p-4">
                    <SectionHeading title="Risultati esatti più probabili" />
                    <ScoreHeatmap probabilities={model.matrix.probabilities} maxGoals={5} />
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {topCorrectScores(model.matrix, 5).map((score) => (
                        <span key={`${score.home}-${score.away}`} className="chip">
                          <span className="tnum font-semibold">{score.home}–{score.away}</span>
                          <span className="tnum text-faint">{formatPercent(score.probability)}</span>
                        </span>
                      ))}
                    </div>
                  </Card>
                  <Card className="p-4">
                    <SectionHeading title="Gol totali" />
                    <GoalsDistribution distribution={totalGoalsDistribution(model.matrix)} />
                  </Card>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <Card className="p-4">
                    <SectionHeading title="Perché la stima è questa" description="Spiegazione deterministica, generata dai numeri." />
                    <ul className="space-y-2 text-[11px] leading-relaxed text-muted">
                      <li>
                        · La squadra di casa ha una forza offensiva stimata e gioca con il vantaggio
                        casa incorporato nelle medie della competizione.
                      </li>
                      <li>
                        · Il punteggio atteso è {formatScore(model.lambdaHome)}–{formatScore(model.lambdaAway)}:
                        la probabilità 1X2 deriva dall&apos;intera matrice dei punteggi, non da una singola
                        previsione.
                      </li>
                      <li>
                        · La correzione Dixon-Coles modifica i punteggi bassi (0-0, 1-1) con ρ = {MODEL.rho}.
                      </li>
                      <li>
                        · L&apos;intervallo p10–p90 riflette la sensibilità ai dati storici, non un
                        intervallo di confidenza ufficiale.
                      </li>
                    </ul>
                  </Card>
                  <Card className="p-4">
                    <SectionHeading title="Limiti di questa stima" />
                    <ul className="space-y-2 text-[11px] leading-relaxed text-muted">
                      {model.limitations.map((limitation) => (
                        <li key={limitation}>· {limitation}</li>
                      ))}
                      {model.quality.missing.map((missing) => (
                        <li key={missing} className="text-warn">· Dato mancante: {missing}</li>
                      ))}
                    </ul>
                  </Card>
                </div>

                <Card className="p-4">
                  <SectionHeading title="Calibrazione del modello su dati demo" description="Esempio di come verrà misurata la calibrazione: non è una promessa di rendimento." />
                  <CalibrationChart bins={[]} />
                  <p className="mt-2 text-[10px] leading-relaxed text-faint">
                    Le metriche reali sono nel tracker, calcolate solo su previsioni risolte. Un grafico
                    vuoto è più onesto di un grafico inventato.
                  </p>
                </Card>
              </>
            )}
          </div>
        ) : null}

        {tab === "history" ? (
          <div className="space-y-5">
            <Card className="p-4">
              <SectionHeading title="Testa a testa" description="Ultimi incontri tra le due squadre, esclusa questa partita." />
              {previousMeetings.length === 0 ? (
                <EmptyState title="Nessun precedente" description="Il database non contiene incontri precedenti tra queste squadre." icon={History} />
              ) : (
                <ul className="divide-y divide-line">
                  {previousMeetings.map((meeting) => (
                    <li key={meeting.id} className="flex items-center justify-between gap-3 py-2 text-xs">
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {meeting.homeTeamName} – {meeting.awayTeamName}
                        </p>
                        <p className="text-[10px] text-faint">
                          {formatDate(meeting.kickoffUtc, { day: "2-digit", month: "short", year: "numeric" }, timezone)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="tnum rounded-lg bg-surface2 px-2 py-1 font-semibold">
                          {meeting.homeGoals}–{meeting.awayGoals}
                        </span>
                        <Link href={`/matches/${meeting.id}`} className="text-[10px] text-accent-text hover:underline">
                          Apri
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              {[
                { name: fixture.homeTeamName, rows: homeRecent },
                { name: fixture.awayTeamName, rows: awayRecent },
              ].map((team) => (
                <Card key={team.name} className="p-4">
                  <SectionHeading title={`Ultime partite · ${team.name}`} />
                  <ul className="divide-y divide-line">
                    {team.rows.map((match) => {
                      const isHome = match.homeTeamId === fixture.homeTeamId
                        ? team.name === fixture.homeTeamName
                        : team.name !== fixture.homeTeamName;
                      const goalsFor = isHome ? match.homeGoals : match.awayGoals;
                      const goalsAgainst = isHome ? match.awayGoals : match.homeGoals;
                      const result = goalsFor === null || goalsAgainst === null
                        ? "—"
                        : goalsFor > goalsAgainst ? "V" : goalsFor < goalsAgainst ? "P" : "N";
                      return (
                        <li key={match.id} className="flex items-center justify-between gap-2 py-2 text-xs">
                          <div className="min-w-0">
                            <p className="truncate">{match.homeTeamShort} – {match.awayTeamShort}</p>
                            <p className="text-[10px] text-faint">
                              {formatDate(match.kickoffUtc, { day: "2-digit", month: "short" }, timezone)} · {isHome ? "casa" : "trasferta"}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="tnum rounded bg-surface2 px-1.5 py-0.5">{match.homeGoals}–{match.awayGoals}</span>
                            <span className={`flex size-5 items-center justify-center rounded-full text-[9px] font-bold ${
                              result === "V" ? "bg-ok/15 text-ok" : result === "N" ? "bg-warn/15 text-warn" : "bg-danger/15 text-danger"
                            }`}>
                              {result}
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-6">
        <Disclaimer compact />
      </div>
    </div>
  );
}
