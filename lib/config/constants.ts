/**
 * MatchLab — configurazione centrale.
 * Il nome del prodotto è modificabile da qui (branding) senza toccare la UI.
 */
export const APP = {
  name: "MatchLab",
  tagline: "Football intelligence, senza scorciatoie.",
  description:
    "Analisi calcistica quantitativa: probabilità stimate, scenari spiegati e monitoraggio della calibrazione. Nessuna scommessa, nessuna promessa.",
  locale: "it-IT",
  defaultTimezone: "Europe/Rome",
  version: "0.1.0",
  repoUrl: "https://github.com/MatDeda10/matchlab",
} as const;

export const DATA_SOURCE = {
  provider: process.env.DATA_PROVIDER === "football-data" ? "football-data" : "demo",
  demoNotice:
    "Stai usando il dataset DEMO: squadre, partite, giocatori e formazioni sono generati sinteticamente e NON rappresentano dati reali.",
  realNotice:
    "Dati reali da football-data.org (piano gratuito). Formazioni e indisponibili non sono inclusi nel piano gratuito.",
} as const;

export const MODEL = {
  version: "poisson-dc-1.0.0",
  label: "Poisson bivariato + correzione Dixon-Coles",
  halfLifeDays: 180,
  shrinkageMatches: 6,
  rho: -0.06,
  maxGoals: 10,
  uncertaintyIterations: 400,
  minMatchesForReliableRating: 10,
  minDataQuality: 45,
} as const;

export const RISK_PROFILES = {
  prudent: {
    id: "prudent",
    label: "Prudente",
    description:
      "Poche leg, soglia di probabilità alta, qualità dati richiesta elevata e penalizzazione forte dell'incertezza.",
    minLegProbability: 0.55,
    minDataQuality: 55,
    maxLegsPerCompetition: 2,
    uncertaintyPenalty: 1.4,
    descriptionNote:
      "Riduce la complessità ma non elimina il rischio: nessuno scenario è sicuro.",
  },
  balanced: {
    id: "balanced",
    label: "Bilanciato",
    description:
      "Compromesso configurabile tra probabilità, copertura dei dati e incertezza. Non implica maggiore redditività.",
    minLegProbability: 0.42,
    minDataQuality: 40,
    maxLegsPerCompetition: 3,
    uncertaintyPenalty: 0.8,
    descriptionNote:
      "Il profilo non modifica le probabilità: modifica soltanto i criteri di selezione.",
  },
  aggressive: {
    id: "aggressive",
    label: "Alto",
    description:
      "Accetta leg con probabilità più basse e maggiore incertezza dichiarata. Non è una raccomandazione e non aumenta il valore atteso.",
    minLegProbability: 0.28,
    minDataQuality: 25,
    maxLegsPerCompetition: 4,
    uncertaintyPenalty: 0.25,
    descriptionNote:
      "Più incertezza non significa più valore: senza quote non è possibile stimare il valore atteso.",
  },
} as const;

export type RiskProfileId = keyof typeof RISK_PROFILES;

export const MARKETS = {
  "1X2": {
    id: "1X2",
    label: "Esito finale (1X2)",
    short: "1X2",
    outcomes: {
      HOME: "1",
      DRAW: "X",
      AWAY: "2",
    },
    multiOutcome: true,
  },
  DC: {
    id: "DC",
    label: "Doppia chance",
    short: "Doppia chance",
    outcomes: {
      HOME_DRAW: "1X",
      HOME_AWAY: "12",
      DRAW_AWAY: "X2",
    },
    multiOutcome: true,
  },
  OU25: {
    id: "OU25",
    label: "Over/Under 2.5",
    short: "O/U 2.5",
    outcomes: { OVER: "Over 2.5", UNDER: "Under 2.5" },
    multiOutcome: false,
  },
  OU15: {
    id: "OU15",
    label: "Over/Under 1.5",
    short: "O/U 1.5",
    outcomes: { OVER: "Over 1.5", UNDER: "Under 1.5" },
    multiOutcome: false,
  },
  BTTS: {
    id: "BTTS",
    label: "Gol / No Gol",
    short: "Gol/No Gol",
    outcomes: { YES: "Gol", NO: "No Gol" },
    multiOutcome: false,
  },
} as const;

export type MarketId = keyof typeof MARKETS;

export const ALL_MARKET_IDS = Object.keys(MARKETS) as MarketId[];

export const DISCLAIMER =
  "Le probabilità sono stime statistiche, non garanzie. Gli scenari possono comportare perdite. L'analisi non costituisce una raccomandazione finanziaria né garantisce risultati.";

export const SAMPLE_WARNING_THRESHOLD = 30;
