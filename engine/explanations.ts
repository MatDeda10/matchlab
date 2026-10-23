import { formatPercent } from "@/lib/format";
import type { ProposalLeg, ScenarioProposal } from "./types";

const SELECTION_PHRASES: Record<string, string> = {
  "1X2:HOME": "vittoria della squadra di casa",
  "1X2:DRAW": "pareggio",
  "1X2:AWAY": "vittoria della squadra ospite",
  "DC:HOME_DRAW": "casa o pareggio (1X)",
  "DC:HOME_AWAY": "casa o ospite (12)",
  "DC:DRAW_AWAY": "pareggio o ospite (X2)",
  "OU25:OVER": "almeno 3 gol (Over 2.5)",
  "OU25:UNDER": "al massimo 2 gol (Under 2.5)",
  "OU15:OVER": "almeno 2 gol (Over 1.5)",
  "OU15:UNDER": "al massimo 1 gol (Under 1.5)",
  "BTTS:YES": "gol di entrambe le squadre",
  "BTTS:NO": "almeno una squadra a secco",
};

export function selectionPhrase(marketId: string, selectionId: string): string {
  return SELECTION_PHRASES[`${marketId}:${selectionId}`] ?? `${marketId} ${selectionId}`;
}

export function explainLeg(leg: {
  fixtureLabel: string;
  marketId: string;
  selectionId: string;
  probability: number;
  qualityScore: number;
  uncertainty: { spread: number } | null;
}): string {
  const phrase = selectionPhrase(leg.marketId, leg.selectionId);
  const base = `Per ${leg.fixtureLabel} il modello stima ${formatPercent(leg.probability)} per ${phrase}`;
  const quality =
    leg.qualityScore >= 70
      ? "con copertura dati alta"
      : leg.qualityScore >= 45
        ? "con copertura dati media"
        : "con copertura dati bassa";
  const uncertainty = leg.uncertainty
    ? `; l'intervallo di sensibilità è ±${formatPercent(leg.uncertainty.spread / 2, 1)}`
    : "";
  return `${base}, ${quality}${uncertainty}.`;
}

export function explainScenario(
  legs: ProposalLeg[],
  jointProbability: number,
  weakestLegProbability: number,
): string {
  const fixtures = new Set(legs.map((leg) => leg.fixtureId)).size;
  return [
    `Lo scenario contiene ${legs.length} selezioni su ${fixtures} partite distinte.`,
    `La probabilità congiunta stimata è ${formatPercent(jointProbability)} assumendo indipendenza condizionata tra le partite.`,
    `La selezione più fragile ha probabilità ${formatPercent(weakestLegProbability)}: è il principale limite dello scenario.`,
    "La probabilità congiunta non è una previsione di vincita e non considera quote, margine del bookmaker o disponibilità di mercato.",
  ].join(" ");
}

export function scenarioRationale(proposal: ScenarioProposal): string {
  const weakest = [...proposal.legs].sort((a, b) => a.probability - b.probability)[0];
  const quality = proposal.averageQuality;
  return [
    `Combinazione selezionata massimizzando il punteggio dichiarato (probabilità congiunta, qualità del dato e sensibilità), non la sola probabilità.`,
    weakest ? `Leg più incerta: ${weakest.fixtureLabel} (${formatPercent(weakest.probability)}).` : "",
    `Qualità media ${Math.round(quality)}/100; copertura minima ${proposal.worstQuality}/100.`,
    "Nessuna quota è stata utilizzata: non è possibile stimare valore atteso o convenienza.",
  ]
    .filter(Boolean)
    .join(" ");
}

export function limitationForQuality(score: number): string | null {
  if (score >= 70) return null;
  if (score >= 45) return "Copertura dati media: la stima è più sensibile a variazioni di forma e rose.";
  return "Copertura dati bassa: trattare la stima come indicativa, non come base decisionale.";
}
