import Link from "next/link";
import { ArrowRight, Clock, MapPin } from "lucide-react";
import type { FixtureDto } from "@/lib/db/types";
import { formatDate, formatTime } from "@/lib/dates";
import { formatPercent } from "@/lib/format";
import { Badge, StatusBadge, TeamDot } from "./ui";

export interface QuickProbabilities {
  home: number;
  draw: number;
  away: number;
}

export function FixtureCard({
  fixture,
  timeZone,
  probabilities,
  showCompetition = true,
  compact = false,
}: {
  fixture: FixtureDto;
  timeZone: string;
  probabilities?: QuickProbabilities | null;
  showCompetition?: boolean;
  compact?: boolean;
}) {
  const finished =
    fixture.status === "FINISHED" &&
    fixture.homeGoals !== null &&
    fixture.awayGoals !== null;
  const live = fixture.status === "IN_PLAY";

  return (
    <Link
      href={`/matches/${fixture.id}`}
      className="card group block p-4 transition-colors hover:border-line-strong focus-visible:border-accent"
      aria-label={`${fixture.homeTeamName} contro ${fixture.awayTeamName}, ${formatTime(fixture.kickoffUtc, timeZone)}`}
    >
      <div className="flex items-center justify-between gap-2 text-[11px] text-muted">
        <div className="flex min-w-0 items-center gap-2">
          {showCompetition ? (
            <span className="truncate font-medium">{fixture.competitionName}</span>
          ) : null}
          <span className="shrink-0 text-faint">·</span>
          <span className="flex shrink-0 items-center gap-1">
            <Clock className="size-3" aria-hidden />
            {formatTime(fixture.kickoffUtc, timeZone)}
          </span>
        </div>
        <StatusBadge status={fixture.status} />
      </div>

      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <TeamDot name={fixture.homeTeamName} color={fixture.homeColor} size="sm" />
            <span className={`truncate font-medium ${compact ? "text-sm" : "text-[15px]"}`}>
              {fixture.homeTeamName}
            </span>
          </div>
          <span className="tnum shrink-0 text-base font-semibold">
            {finished || live ? fixture.homeGoals ?? 0 : "—"}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <TeamDot name={fixture.awayTeamName} color={fixture.awayColor} size="sm" />
            <span className={`truncate font-medium ${compact ? "text-sm" : "text-[15px]"}`}>
              {fixture.awayTeamName}
            </span>
          </div>
          <span className="tnum shrink-0 text-base font-semibold">
            {finished || live ? fixture.awayGoals ?? 0 : "—"}
          </span>
        </div>
      </div>

      {probabilities ? (
        <div className="mt-3 grid grid-cols-3 gap-1.5 border-t border-line pt-2.5 text-center">
          {[
            ["1", probabilities.home],
            ["X", probabilities.draw],
            ["2", probabilities.away],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-lg bg-surface2/60 px-1 py-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-faint">{label}</p>
              <p className="tnum text-xs font-semibold">{formatPercent(Number(value), 0)}</p>
            </div>
          ))}
          <p className="col-span-3 mt-1 text-left text-[10px] text-faint">
            Stima pre-partita · non è una certezza
          </p>
        </div>
      ) : null}

      {!compact ? (
        <div className="mt-3 flex items-center justify-between text-[11px] text-muted">
          <span className="flex min-w-0 items-center gap-1">
            <MapPin className="size-3 shrink-0" aria-hidden />
            <span className="truncate">{fixture.venue ?? fixture.competitionName}</span>
            <span className="text-faint">·</span>
            <span className="shrink-0">{formatDate(fixture.kickoffUtc, { day: "2-digit", month: "short" }, timeZone)}</span>
          </span>
          <span className="flex shrink-0 items-center gap-1 font-medium text-accent-text opacity-0 transition-opacity group-hover:opacity-100">
            Analizza <ArrowRight className="size-3" aria-hidden />
          </span>
        </div>
      ) : null}
    </Link>
  );
}

export function CompetitionChip({ fixture }: { fixture: FixtureDto }) {
  return <Badge tone="neutral">{fixture.competitionCode}</Badge>;
}
