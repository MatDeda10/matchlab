import type { CalibrationBin } from "@/engine/evaluation";
import { formatPercent } from "@/lib/format";

export function ScoreHeatmap({
  probabilities,
  maxGoals = 5,
}: {
  probabilities: number[][];
  maxGoals?: number;
}) {
  const max = Math.max(
    ...probabilities.slice(0, maxGoals + 1).flatMap((row) => row.slice(0, maxGoals + 1)),
    0.0001,
  );
  return (
    <figure>
      <figcaption className="mb-2 text-[11px] text-muted">
        Griglia dei risultati esatti (riga = casa, colonna = ospite). Intensità proporzionale alla probabilità.
      </figcaption>
      <div className="overflow-x-auto">
        <div
          className="grid min-w-[320px] gap-1"
          style={{ gridTemplateColumns: `2rem repeat(${maxGoals + 1}, minmax(0, 1fr))` }}
          role="img"
          aria-label="Matrice delle probabilità dei risultati esatti"
        >
          <span />
          {Array.from({ length: maxGoals + 1 }, (_, away) => (
            <span key={`h-${away}`} className="text-center text-[10px] text-faint">{away}</span>
          ))}
          {Array.from({ length: maxGoals + 1 }, (_, home) => (
            <div key={`row-${home}`} className="contents">
              <span className="flex items-center justify-center text-[10px] text-faint">{home}</span>
              {Array.from({ length: maxGoals + 1 }, (_, away) => {
                const value = probabilities[home]?.[away] ?? 0;
                const intensity = Math.max(0, Math.min(1, value / max));
                return (
                  <span
                    key={`${home}-${away}`}
                    className="tnum flex aspect-square items-center justify-center rounded-md border border-line text-[10px] font-medium"
                    style={{
                      backgroundColor: `color-mix(in srgb, var(--accent) ${Math.round(intensity * 55)}%, var(--surface-2))`,
                      color: intensity > 0.55 ? "var(--accent-ink)" : "var(--fg)",
                    }}
                    title={`${home}–${away}: ${formatPercent(value, 2)}`}
                  >
                    {value >= 0.001 ? `${(value * 100).toFixed(1)}` : "·"}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <details className="mt-2">
        <summary className="cursor-pointer text-[11px] text-muted">Tabella accessibile</summary>
        <table className="data-table mt-2">
          <caption className="sr-only">Probabilità dei risultati esatti</caption>
          <thead>
            <tr><th>Risultato</th><th>Probabilità</th></tr>
          </thead>
          <tbody>
            {probabilities.slice(0, maxGoals + 1).flatMap((row, home) =>
              row.slice(0, maxGoals + 1).map((value, away) => (
                <tr key={`${home}-${away}`}>
                  <td className="tnum">{home}–{away}</td>
                  <td className="tnum">{formatPercent(value, 2)}</td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

export function GoalsDistribution({
  distribution,
}: {
  distribution: Array<{ goals: number; probability: number }>;
}) {
  const visible = distribution.slice(0, 8);
  const max = Math.max(...visible.map((item) => item.probability), 0.01);
  return (
    <figure>
      <figcaption className="mb-3 text-[11px] text-muted">
        Distribuzione del numero totale di gol. Il modello tronca a 10 gol per squadra.
      </figcaption>
      <div className="flex h-28 items-end gap-1.5" role="img" aria-label="Distribuzione del numero totale di gol">
        {visible.map((item) => (
          <div key={item.goals} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
            <span className="tnum text-[10px] text-muted">{formatPercent(item.probability, 0)}</span>
            <div
              className="w-full rounded-t-md bg-accent/70"
              style={{ height: `${Math.max(3, (item.probability / max) * 80)}px` }}
            />
            <span className="tnum text-[10px] text-faint">{item.goals}{item.goals === 7 ? "+" : ""}</span>
          </div>
        ))}
      </div>
    </figure>
  );
}

export function CalibrationChart({ bins }: { bins: CalibrationBin[] }) {
  const width = 320;
  const height = 240;
  const padding = 34;
  const plot = width - padding * 2;
  const total = bins.reduce((sum, bin) => sum + bin.count, 0);
  const points = bins
    .filter((bin) => bin.count > 0)
    .map((bin) => ({
      x: padding + bin.meanPredicted * plot,
      y: height - padding - bin.observedRate * plot,
      bin,
    }));

  return (
    <figure>
      <figcaption className="mb-2 flex items-center justify-between gap-2 text-[11px] text-muted">
        <span>Calibrazione: probabilità stimata vs frequenza osservata.</span>
        <span className="text-faint">{total} leg</span>
      </figcaption>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-auto w-full min-w-[280px]"
          role="img"
          aria-label="Grafico di calibrazione delle previsioni"
        >
          <rect x={padding} y={padding} width={plot} height={plot} fill="none" stroke="var(--line-strong)" rx="6" />
          {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
            <g key={tick}>
              <line
                x1={padding + tick * plot}
                y1={padding}
                x2={padding + tick * plot}
                y2={height - padding}
                stroke="var(--line)"
                strokeDasharray="2 4"
              />
              <line
                x1={padding}
                y1={height - padding - tick * plot}
                x2={width - padding}
                y2={height - padding - tick * plot}
                stroke="var(--line)"
                strokeDasharray="2 4"
              />
              <text x={padding + tick * plot} y={height - padding + 14} textAnchor="middle" fontSize="8" fill="var(--faint)">
                {Math.round(tick * 100)}%
              </text>
              <text x={padding - 8} y={height - padding - tick * plot + 3} textAnchor="end" fontSize="8" fill="var(--faint)">
                {Math.round(tick * 100)}
              </text>
            </g>
          ))}
          <line
            x1={padding}
            y1={height - padding}
            x2={width - padding}
            y2={padding}
            stroke="var(--accent)"
            strokeOpacity="0.45"
            strokeDasharray="4 4"
          />
          {points.map((point) => (
            <circle
              key={point.bin.label}
              cx={point.x}
              cy={point.y}
              r={Math.max(3, Math.min(8, 2 + point.bin.count / Math.max(1, total) * 12))}
              fill="var(--accent)"
              fillOpacity="0.75"
              stroke="var(--bg)"
              strokeWidth="1"
            >
              <title>{`${point.bin.label}: previsto ${formatPercent(point.bin.meanPredicted)}, osservato ${formatPercent(point.bin.observedRate)} (${point.bin.count})`}</title>
            </circle>
          ))}
        </svg>
      </div>
      <div className="mt-2 grid grid-cols-5 gap-1 text-center text-[9px] text-faint sm:grid-cols-10">
        {bins.map((bin) => (
          <span key={bin.label} className="tnum" title={`${bin.label}: ${bin.count} leg`}>
            {bin.count > 0 ? `${bin.count}` : "·"}
          </span>
        ))}
      </div>
      <p className="mt-1 text-center text-[9px] text-faint">conteggio leg per fascia 0–100%</p>
    </figure>
  );
}

export function MiniBar({ label, value, max, tone = "accent" }: { label: string; value: number; max: number; tone?: "accent" | "info" }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="text-muted">{label}</span>
        <span className="tnum font-medium">{value.toFixed(2)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface3">
        <div
          className={`h-full rounded-full ${tone === "accent" ? "bg-accent" : "bg-info"}`}
          style={{ width: `${Math.min(100, (value / Math.max(max, 0.01)) * 100)}%` }}
        />
      </div>
    </div>
  );
}
