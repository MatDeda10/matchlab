import { Scale, ShieldAlert } from "lucide-react";
import type { MarketSummaryDto } from "@/lib/db/types";
import { formatDateTime } from "@/lib/dates";
import { formatPercent, formatScore } from "@/lib/format";
import { Badge, Card, EmptyState, SectionHeading } from "./ui";

export function MarketPanel({
  fixtureId,
  homeTeamName,
  awayTeamName,
  summaries,
  oddsEnabled,
  finished,
  timezone,
}: {
  fixtureId: string;
  homeTeamName: string;
  awayTeamName: string;
  summaries: MarketSummaryDto[];
  oddsEnabled: boolean;
  finished: boolean;
  timezone: string;
}) {
  if (summaries.length === 0) {
    return (
      <Card className="p-4">
        <SectionHeading
          title="Mercato"
          description="Quote osservate dalla fonte pubblica, senza stime o interpolazioni."
        />
        <EmptyState
          icon={Scale}
          title="Quote non disponibili"
          description={
            oddsEnabled
              ? `La fonte non ha quote per ${homeTeamName} – ${awayTeamName}. La partita resta analizzabile, ma non mostriamo una quota inventata.`
              : "Il provider attivo non espone quote. MatchLab non simula quote e non calcola valore atteso o ROI."
          }
        />
      </Card>
    );
  }

  const showModel = summaries.some((market) =>
    market.selections.some((selection) => selection.modelProbability !== null),
  );

  return (
    <div className="space-y-4" data-fixture-id={fixtureId}>
      <Card className="p-4">
        <SectionHeading
          title="Mercato"
          description="Quote reali della fonte, pre-partita o di chiusura. La quota migliore è quella più alta tra i bookmaker tracciati; non è un consiglio di gioco."
        />
        <div className="rounded-xl border border-warn/20 bg-warn/5 p-3 text-[10px] leading-relaxed text-warn">
          <p className="flex items-start gap-2">
            <ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>
              I nomi dei bookmaker sono mostrati solo per attribuire la quota alla fonte. Non ci sono
              link, loghi, bonus o inviti al gioco. Le quote possono cambiare e non sono live. MatchLab
              non gestisce denaro e non calcola ROI, rendimento atteso o convenienza.
            </span>
          </p>
        </div>
      </Card>

      {summaries.map((market) => {
        const hasModel = market.selections.some(
          (selection) => selection.modelProbability !== null,
        );
        return (
          <Card key={market.marketId} className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold">{market.label}</p>
                <Badge tone={market.closing ? "ok" : "neutral"}>
                  {market.closing ? "Quote di chiusura" : "Quote pre-partita"}
                </Badge>
                <Badge tone="neutral">Migliore + media</Badge>
                {market.consensusOverround !== null ? (
                  <Badge tone={market.consensusOverround > 0.12 ? "warn" : "neutral"}>
                    overround medio {formatPercent(market.consensusOverround)}
                  </Badge>
                ) : null}
              </div>
              <p className="text-[10px] text-faint">
                {market.updatedAt
                  ? `Raccolte ${formatDateTime(market.updatedAt, timezone)}`
                  : "Data di raccolta non disponibile"}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-left text-[11px]">
                <thead className="bg-surface2/40 text-[10px] uppercase tracking-wider text-faint">
                  <tr>
                    <th className="px-3 py-2 font-medium">Selezione</th>
                    {showModel ? <th className="px-3 py-2 text-right font-medium">Modello</th> : null}
                    <th className="px-3 py-2 text-right font-medium">Quota migliore</th>
                    <th className="px-3 py-2 text-right font-medium">Prob. implicita</th>
                    <th className="px-3 py-2 text-right font-medium">Consenso</th>
                    {hasModel ? <th className="px-3 py-2 text-right font-medium">Δ modello-consenso</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {market.selections.map((selection) => (
                    <tr key={selection.selectionId} className="border-t border-line/70">
                      <td className="px-3 py-2.5 font-medium">{selection.label}</td>
                      {showModel ? (
                        <td className="tnum px-3 py-2.5 text-right">
                          {selection.modelProbability === null
                            ? "—"
                            : formatPercent(selection.modelProbability)}
                        </td>
                      ) : null}
                      <td className="px-3 py-2.5 text-right">
                        {selection.best ? (
                          <>
                            <span className="tnum font-semibold text-ok">
                              {selection.best.odds.toFixed(2)}
                            </span>
                            <span className="ml-1 text-[10px] text-muted">
                              {selection.best.bookmakerLabel}
                            </span>
                          </>
                        ) : (
                          <span className="text-faint">n/d</span>
                        )}
                      </td>
                      <td className="tnum px-3 py-2.5 text-right">
                        {selection.impliedProbability === null
                          ? "—"
                          : formatPercent(selection.impliedProbability)}
                      </td>
                      <td className="tnum px-3 py-2.5 text-right">
                        {selection.consensusProbability === null
                          ? "—"
                          : formatPercent(selection.consensusProbability)}
                      </td>
                      {hasModel ? (
                        <td
                          className={`tnum px-3 py-2.5 text-right ${
                            selection.delta === null
                              ? "text-faint"
                              : selection.delta > 0.02
                                ? "text-ok"
                                : selection.delta < -0.02
                                  ? "text-danger"
                                  : "text-muted"
                          }`}
                        >
                          {selection.delta === null
                            ? "—"
                            : `${selection.delta >= 0 ? "+" : ""}${formatScore(
                                selection.delta * 100,
                                1,
                              )} pp`}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-t border-line bg-surface2/20 px-4 py-2.5 text-[10px] leading-relaxed text-faint">
              <p>
                Overround (somma delle probabilità implicite meno 1): migliore{" "}
                {market.bestOverround === null ? "n/d" : formatPercent(market.bestOverround)} · medio{" "}
                {market.consensusOverround === null
                  ? "n/d"
                  : formatPercent(market.consensusOverround)}.
              </p>
              <p className="mt-1">
                Fonte: {market.sources.join(", ") || "fonte non indicata"}.{" "}
                {finished
                  ? "Partita conclusa: le quote sono storiche e non più giocabili."
                  : "Quote raccolte prima della partita; possono cambiare fino al calcio d'inizio."}
              </p>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
