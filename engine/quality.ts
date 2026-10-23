import type { DataQuality, QualityBand } from "./types";

export interface QualityInput {
  homeMatches: number;
  awayMatches: number;
  daysSinceHomeMatch: number | null;
  daysSinceAwayMatch: number | null;
  hasXg: boolean;
  hasLineups: boolean;
  hasAvailability: boolean;
  hasMatchStats: boolean;
}

function bandFor(score: number): QualityBand {
  if (score >= 70) return "HIGH";
  if (score >= 45) return "MEDIUM";
  return "LOW";
}

/**
 * Qualità del dato: punteggio trasparente e ispezionabile, non un indicatore
 * di "probabilità di vincita". Ogni componente ha un peso dichiarato.
 *
 * - 45 pt campione minimo tra le due squadre (20+ partite = pieno)
 * - 15 pt freschezza dell'ultima partita osservata
 * - 15 pt disponibilità xG
 * - 15 pt formazioni
 * - 10 pt indisponibili/infortuni
 */
export function scoreDataQuality(input: QualityInput): DataQuality {
  const missing: string[] = [];
  const reasons: string[] = [];

  const minMatches = Math.max(0, Math.min(input.homeMatches, input.awayMatches));
  let sampleScore: number;
  if (minMatches >= 20) sampleScore = 45;
  else if (minMatches >= 10) sampleScore = 38;
  else if (minMatches >= 5) sampleScore = 24;
  else if (minMatches >= 3) sampleScore = 12;
  else sampleScore = 0;
  if (minMatches < 10) missing.push("Campione storico ridotto (<10 partite per una squadra)");
  reasons.push(`Campione minimo: ${minMatches} partite → ${sampleScore}/45 punti`);

  const ages = [input.daysSinceHomeMatch, input.daysSinceAwayMatch].filter(
    (v): v is number => v !== null && Number.isFinite(v),
  );
  const maxAge = ages.length > 0 ? Math.max(...ages) : null;
  let recencyScore = 0;
  if (maxAge === null) {
    missing.push("Data dell'ultima partita non disponibile");
  } else if (maxAge <= 14) recencyScore = 15;
  else if (maxAge <= 30) recencyScore = 10;
  else if (maxAge <= 60) recencyScore = 5;
  else missing.push("Ultima partita osservata oltre 60 giorni fa");
  reasons.push(
    maxAge === null
      ? "Freschezza: non valutabile"
      : `Ultima partita: ${Math.round(maxAge)} giorni fa → ${recencyScore}/15 punti`,
  );

  const xgScore = input.hasXg ? 15 : 0;
  if (!input.hasXg) missing.push("xG non disponibile per questa competizione");
  const lineupsScore = input.hasLineups ? 15 : 0;
  if (!input.hasLineups) missing.push("Formazioni non disponibili");
  const availabilityScore = input.hasAvailability ? 10 : 0;
  if (!input.hasAvailability) missing.push("Indisponibili/infortunati non disponibili");

  const score = Math.round(
    sampleScore + recencyScore + xgScore + lineupsScore + availabilityScore,
  );
  const band = bandFor(score);
  if (!input.hasMatchStats) {
    reasons.push("Statistiche di partita (tiri, possesso) non disponibili: modello basato sui gol");
  }

  return { score, band, missing, reasons };
}

export function qualityLabel(band: QualityBand): string {
  if (band === "HIGH") return "Alta";
  if (band === "MEDIUM") return "Media";
  return "Bassa";
}
