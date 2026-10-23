import { Badge } from "./ui";
import type { LineupDto, LineupPlayerDto } from "@/lib/db/types";

const KIND_META: Record<
  LineupDto["kind"],
  { label: string; tone: "ok" | "accent" | "warn" | "neutral"; note: string }
> = {
  OFFICIAL: {
    label: "Ufficiale",
    tone: "ok",
    note: "Comunicata dalla fonte come formazione ufficiale.",
  },
  PROBABLE: {
    label: "Probabile",
    tone: "accent",
    note: "Indicata dalla fonte come probabile. Non è una conferma.",
  },
  MODEL: {
    label: "Ricostruita dal modello",
    tone: "warn",
    note: "Non proviene da una fonte: è una ricostruzione algoritmica e non va letta come probabile formazione ufficiale.",
  },
  UNAVAILABLE: {
    label: "Non disponibile",
    tone: "neutral",
    note: "La fonte non fornisce formazioni per questa partita.",
  },
};

const ROLE_LABELS: Record<string, string> = {
  GK: "Portiere",
  DEF: "Difensore",
  MID: "Centrocampista",
  FWD: "Attaccante",
};

function PlayerMarker({
  player,
  color,
  x,
  y,
}: {
  player: LineupPlayerDto;
  color: string;
  x: number;
  y: number;
}) {
  const status = player.status === "DOUBTFUL" ? "In dubbio" : player.status === "SUSPENDED" ? "Squalificato" : null;
  return (
    <div
      className="absolute flex w-[72px] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 text-center"
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      <span
        className="tnum flex size-8 items-center justify-center rounded-full border text-[11px] font-bold shadow-sm"
        style={{
          borderColor: color,
          backgroundColor: "var(--surface)",
          color: "var(--fg)",
        }}
        aria-hidden
      >
        {player.shirtNumber ?? "–"}
      </span>
      <span className="max-w-[72px] truncate text-[9px] font-medium leading-tight text-fg/90">
        {player.playerName.split(" ").slice(-1)[0]}
      </span>
      {status ? (
        <span className="rounded-full bg-warn/15 px-1 text-[8px] font-semibold text-warn">{status}</span>
      ) : null}
    </div>
  );
}

function lineCoordinates(players: LineupPlayerDto[]): Array<LineupPlayerDto & { x: number; y: number }> {
  const groups: Array<[string, number]> = [
    ["GK", 90],
    ["DEF", 70],
    ["MID", 47],
    ["FWD", 22],
  ];
  return groups.flatMap(([role, y]) => {
    const line = players.filter((player) => player.role === role);
    return line.map((player, index) => ({
      ...player,
      x: line.length === 1 ? 50 : 12 + (index * 76) / (line.length - 1),
      y,
    }));
  });
}

export function Pitch({
  lineup,
  teamName,
  teamColor,
}: {
  lineup: LineupDto;
  teamName: string;
  teamColor: string | null;
}) {
  const meta = KIND_META[lineup.kind];
  const starters = lineup.players.filter((player) => player.isStarter).slice(0, 11);
  const bench = lineup.players.filter((player) => !player.isStarter);
  const coords = lineCoordinates(starters);
  const color = teamColor ?? "var(--accent)";

  return (
    <div className="min-w-0">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{teamName}</p>
          <p className="text-[11px] text-muted">
            {lineup.formation ?? "Modulo non disponibile"} · {starteresLabel(starters.length)}
          </p>
        </div>
        <Badge tone={meta.tone}>{meta.label}</Badge>
      </div>

      <div
        className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl border border-line"
        style={{
          background:
            "linear-gradient(180deg, color-mix(in srgb, var(--accent) 7%, var(--surface-2)), var(--surface))",
        }}
        role="img"
        aria-label={`Formazione ${teamName}: ${starters.map((player) => player.playerName).join(", ")}`}
      >
        <div aria-hidden className="absolute inset-3 rounded-lg border border-white/10" />
        <div aria-hidden className="absolute left-3 right-3 top-1/2 h-px bg-white/10" />
        <div aria-hidden className="absolute left-1/2 top-1/2 size-16 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10" />
        <div aria-hidden className="absolute bottom-3 left-1/2 h-12 w-32 -translate-x-1/2 border border-b-0 border-white/10" />
        <div aria-hidden className="absolute top-3 left-1/2 h-12 w-32 -translate-x-1/2 border border-t-0 border-white/10" />

        {coords.map((player) => (
          <PlayerMarker key={player.id} player={player} color={color} x={player.x} y={player.y} />
        ))}
      </div>

      <p className="mt-1.5 text-[10px] leading-relaxed text-muted">{meta.note}</p>
      <p className="mt-1 text-[10px] text-faint">
        Fonte: {lineup.source} · aggiornata {new Date(lineup.updatedAt).toLocaleString("it-IT")}
      </p>

      {bench.length > 0 ? (
        <div className="mt-3">
          <p className="mb-1.5 text-[11px] font-semibold text-muted">Panchina ({bench.length})</p>
          <ul className="flex flex-wrap gap-1.5">
            {bench.map((player) => (
              <li key={player.id} className="chip">
                <span className="tnum text-faint">{player.shirtNumber ?? "–"}</span>
                {player.playerName}
                {player.status === "DOUBTFUL" ? <span className="text-warn">· dubbio</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <ul className="sr-only">
        {starters.map((player) => (
          <li key={player.id}>
            {player.playerName}, {ROLE_LABELS[player.role] ?? player.role}, numero {player.shirtNumber ?? "non disponibile"}
          </li>
        ))}
      </ul>
    </div>
  );
}

function starteresLabel(count: number): string {
  return count === 11 ? "11 titolari" : `${count} titolari`;
}
