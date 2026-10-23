import {
  clamp,
  gaussian,
  mulberry32,
  samplePoisson,
  seedFrom,
  slugify,
} from "./random";

export interface DemoCompetitionInput {
  id: string;
  name: string;
  country: string;
  code: string;
  teams: Array<{ name: string; short: string; color: string }>;
}

const COMPETITIONS: DemoCompetitionInput[] = [
  {
    id: "demo-aurora",
    name: "Lega Aurora",
    country: "Italia",
    code: "AUR",
    teams: [
      { name: "Aurora Milano", short: "Milano", color: "#7aa7ff" },
      { name: "Torino Reale", short: "Torino", color: "#b7f36b" },
      { name: "Roma Eterna", short: "Roma", color: "#ffb26b" },
      { name: "Napoli Vesuvio", short: "Napoli", color: "#6bd5ff" },
      { name: "Bergamo Alpi", short: "Bergamo", color: "#8f9bb3" },
      { name: "Firenze Giglio", short: "Firenze", color: "#c7a2ff" },
      { name: "Bologna Torre", short: "Bologna", color: "#ff8f8f" },
      { name: "Genova Porto", short: "Genova", color: "#7fd1b9" },
      { name: "Verona Arena", short: "Verona", color: "#ffd166" },
      { name: "Udine Friuli", short: "Udine", color: "#9ad0ff" },
      { name: "Cagliari Sardegna", short: "Cagliari", color: "#ff9ecb" },
      { name: "Lecce Salento", short: "Lecce", color: "#f5e26b" },
    ],
  },
  {
    id: "demo-albion",
    name: "Premier Albion",
    country: "Inghilterra",
    code: "ALB",
    teams: [
      { name: "London Blue", short: "London B.", color: "#6f9bff" },
      { name: "Manchester Forge", short: "Manchester", color: "#ff7b7b" },
      { name: "Liverpool Tide", short: "Liverpool", color: "#ff6b6b" },
      { name: "North London Reds", short: "N. London", color: "#ff9a8b" },
      { name: "Newcastle Magpie", short: "Newcastle", color: "#d9e2f2" },
      { name: "Birmingham Villa", short: "Birmingham", color: "#b18cff" },
      { name: "Brighton Seagulls", short: "Brighton", color: "#7fe3ff" },
      { name: "Leeds White", short: "Leeds", color: "#e8eef9" },
      { name: "Bristol Harbour", short: "Bristol", color: "#ff8a5c" },
      { name: "Sheffield Steel", short: "Sheffield", color: "#a8b6cc" },
      { name: "Nottingham Oaks", short: "Nottingham", color: "#8bd17c" },
      { name: "Southampton Coast", short: "Southampton", color: "#ffb3c7" },
    ],
  },
  {
    id: "demo-solar",
    name: "Liga Solar",
    country: "Spagna",
    code: "SOL",
    teams: [
      { name: "Madrid Blanco", short: "Madrid", color: "#f2f4f8" },
      { name: "Barcelona Blau", short: "Barcelona", color: "#8b7bff" },
      { name: "Sevilla Naranja", short: "Sevilla", color: "#ff9f6b" },
      { name: "Valencia Turia", short: "Valencia", color: "#ffd36b" },
      { name: "Bilbao Roble", short: "Bilbao", color: "#ff7f7f" },
      { name: "Vigo Atlantico", short: "Vigo", color: "#6bc9ff" },
      { name: "San Sebastian Real", short: "S. Sebastian", color: "#7bd1ff" },
      { name: "Zaragoza Aragon", short: "Zaragoza", color: "#f5e06b" },
      { name: "Malaga Costa", short: "Malaga", color: "#9ad6a1" },
      { name: "Granada Alhambra", short: "Granada", color: "#ff9ab5" },
      { name: "Villarreal Amarillo", short: "Villarreal", color: "#ffe36b" },
      { name: "Palma Mediterraneo", short: "Palma", color: "#7fe0cf" },
    ],
  },
  {
    id: "demo-nord",
    name: "Bundes Nord",
    country: "Germania",
    code: "NOR",
    teams: [
      { name: "Munchen Rot", short: "Munchen", color: "#ff6b6b" },
      { name: "Dortmund Gelb", short: "Dortmund", color: "#ffe34d" },
      { name: "Berlin Union", short: "Berlin", color: "#ff8f6b" },
      { name: "Leipzig Bull", short: "Leipzig", color: "#f2f4f8" },
      { name: "Leverkusen Werk", short: "Leverkusen", color: "#ff5c5c" },
      { name: "Frankfurt Adler", short: "Frankfurt", color: "#9aa9c2" },
      { name: "Stuttgart Motor", short: "Stuttgart", color: "#ffd166" },
      { name: "Bremen Werder", short: "Bremen", color: "#7fd1a8" },
      { name: "Koln Dom", short: "Koln", color: "#ff9ab5" },
      { name: "Hamburg Hafen", short: "Hamburg", color: "#7fa7ff" },
      { name: "Freiburg Breisgau", short: "Freiburg", color: "#ff7f7f" },
      { name: "Mainz Gutenberg", short: "Mainz", color: "#c78bff" },
    ],
  },
];

const FIRST_NAMES = [
  "Luca", "Marco", "Andrea", "Matteo", "Alessio", "Davide", "Simone", "Federico",
  "Lorenzo", "Gabriele", "Riccardo", "Tommaso", "Nicolò", "Pietro", "Edoardo",
  "Samuele", "Michele", "Antonio", "Francesco", "Giulio", "Diego", "Emanuele",
  "Kai", "Noah", "Liam", "Ethan", "Owen", "Mason", "Hugo", "Leo", "Theo", "Mateo",
  "Pablo", "Sergio", "Alvaro", "Iker", "Nico", "Julian", "Felix", "Jonas", "Lukas",
  "Maximilian", "Timo", "Finn", "Elias", "Oskar", "Emil", "Viktor",
];

const LAST_NAMES = [
  "Rossi", "Bianchi", "Conti", "Marino", "Greco", "Lombardi", "Moretti", "Romano",
  "Ferrari", "Rinaldi", "Galli", "Costa", "Serra", "Villa", "Fabbri", "Riva",
  "Smith", "Walker", "Hughes", "Bennett", "Clarke", "Foster", "Turner", "Wright",
  "Garcia", "Lopez", "Martinez", "Sanchez", "Torres", "Ramos", "Navarro", "Ortega",
  "Muller", "Schmidt", "Weber", "Wagner", "Becker", "Hoffmann", "Koch", "Richter",
  "Neumann", "Schwarz", "Zimmermann", "Braun", "Kruger", "Hartmann", "Lange", "Wolf",
];

export interface DemoTeamRow {
  id: string;
  competitionId: string;
  name: string;
  shortName: string;
  country: string;
  color: string;
  providerRef: string;
  hiddenAttack: number;
  hiddenDefence: number;
}

export interface DemoPlayerRow {
  id: string;
  teamId: string;
  name: string;
  role: "GK" | "DEF" | "MID" | "FWD";
  shirtNumber: number;
  minutes: number;
  appearances: number;
  starts: number;
  goals: number;
  assists: number;
}

export interface DemoFixtureRow {
  id: string;
  competitionId: string;
  season: string;
  round: string;
  homeTeamId: string;
  awayTeamId: string;
  kickoffUtc: string;
  status: "SCHEDULED" | "IN_PLAY" | "FINISHED" | "POSTPONED" | "CANCELLED";
  homeGoals: number | null;
  awayGoals: number | null;
  venue: string;
  stats: {
    homeXg: number;
    awayXg: number;
    homeShots: number;
    awayShots: number;
    homeShotsOnTarget: number;
    awayShotsOnTarget: number;
    homePossession: number;
    awayPossession: number;
  } | null;
}

export interface DemoLineupPlayerRow {
  id: string;
  fixtureId: string;
  teamId: string;
  playerId: string;
  playerName: string;
  role: string;
  slot: number;
  isStarter: boolean;
  status: string;
  shirtNumber: number | null;
}

export interface DemoLineupRow {
  fixtureId: string;
  teamId: string;
  kind: "OFFICIAL" | "PROBABLE" | "MODEL";
  formation: string;
  source: string;
  updatedAt: string;
  players: DemoLineupPlayerRow[];
}

export interface DemoAvailabilityRow {
  id: string;
  fixtureId: string;
  teamId: string;
  playerId: string;
  playerName: string;
  status: "INJURED" | "SUSPENDED" | "DOUBTFUL" | "UNKNOWN" | "RETURNING";
  reason: string;
  source: string;
  confidence: number | null;
  updatedAt: string;
}

export interface DemoDataset {
  competitions: Array<{
    id: string;
    name: string;
    country: string;
    code: string;
    tier: number;
    providerRef: string;
  }>;
  teams: DemoTeamRow[];
  players: DemoPlayerRow[];
  fixtures: DemoFixtureRow[];
  lineups: DemoLineupRow[];
  availability: DemoAvailabilityRow[];
  generatedAt: string;
}

const FORMATIONS: Record<string, { DEF: number; MID: number; FWD: number }> = {
  "4-3-3": { DEF: 4, MID: 3, FWD: 3 },
  "4-2-3-1": { DEF: 4, MID: 5, FWD: 1 },
  "3-5-2": { DEF: 3, MID: 5, FWD: 2 },
  "4-4-2": { DEF: 4, MID: 4, FWD: 2 },
};
const FORMATION_NAMES = Object.keys(FORMATIONS);

const ROLES: DemoPlayerRow["role"][] = [
  "GK", "GK",
  "DEF", "DEF", "DEF", "DEF", "DEF",
  "MID", "MID", "MID", "MID", "MID",
  "FWD", "FWD", "FWD", "FWD", "FWD", "FWD",
];

function seasonLabel(date: Date): string {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const start = month >= 6 ? year : year - 1;
  return `${start}/${String((start + 1) % 100).padStart(2, "0")}`;
}

function nextSaturday(now: Date): Date {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 13, 0, 0));
  const day = date.getUTCDay();
  const delta = (6 - day + 7) % 7;
  date.setUTCDate(date.getUTCDate() + delta);
  return date;
}

/** Metodo del cerchio per un girone all'italiana; la seconda metà inverte i campi. */
function roundRobin(teamIds: string[]): Array<Array<[string, string]>> {
  const n = teamIds.length;
  let rotation = [...teamIds];
  const rounds: Array<Array<[string, string]>> = [];

  for (let round = 0; round < n - 1; round += 1) {
    const pairs: Array<[string, string]> = [];
    for (let i = 0; i < n / 2; i += 1) {
      const home = rotation[i]!;
      const away = rotation[n - 1 - i]!;
      pairs.push(round % 2 === 0 ? [home, away] : [away, home]);
    }
    rounds.push(pairs);
    const fixed = rotation[0]!;
    const rest = rotation.slice(1);
    rest.unshift(rest.pop()!);
    rotation = [fixed, ...rest];
  }

  const secondHalf = rounds.map((pairs) =>
    pairs.map(([home, away]) => [away, home] as [string, string]),
  );
  return [...rounds, ...secondHalf];
}

function simulateMatch(
  rng: () => number,
  home: DemoTeamRow,
  away: DemoTeamRow,
): { homeGoals: number; awayGoals: number; homeXg: number; awayXg: number } {
  const formHome = clamp(1 + gaussian(rng) * 0.1, 0.8, 1.2);
  const formAway = clamp(1 + gaussian(rng) * 0.1, 0.8, 1.2);
  const lambdaHome = clamp(1.45 * home.hiddenAttack * away.hiddenDefence * formHome, 0.25, 3.6);
  const lambdaAway = clamp(1.15 * away.hiddenAttack * home.hiddenDefence * formAway, 0.2, 3.4);
  const homeGoals = samplePoisson(rng, lambdaHome);
  const awayGoals = samplePoisson(rng, lambdaAway);
  return {
    homeGoals,
    awayGoals,
    homeXg: clamp(lambdaHome + gaussian(rng) * 0.28, 0.2, 4),
    awayXg: clamp(lambdaAway + gaussian(rng) * 0.28, 0.2, 4),
  };
}

/**
 * Costruisce un dataset sintetico coerente: 4 competizioni fittizie, 48 squadre,
 * ~2 anni di risultati, partite future, rose, formazioni e indisponibili.
 *
 * ATTENZIONE: nessun dato è reale. Le forze nascoste sono usate solo per
 * generare i risultati; il modello non vi accede.
 */
export function buildDemoDataset(now = new Date()): DemoDataset {
  const generatedAt = now.toISOString();
  const anchor = nextSaturday(now);
  const competitions: DemoDataset["competitions"] = [];
  const teams: DemoTeamRow[] = [];
  const players: DemoPlayerRow[] = [];
  const fixtures: DemoFixtureRow[] = [];
  const lineups: DemoLineupRow[] = [];
  const availability: DemoAvailabilityRow[] = [];

  for (const competition of COMPETITIONS) {
    competitions.push({
      id: competition.id,
      name: competition.name,
      country: competition.country,
      code: competition.code,
      tier: 1,
      providerRef: competition.id,
    });

    const compTeams: DemoTeamRow[] = competition.teams.map((team) => {
      const id = `demo-${competition.code.toLowerCase()}-${slugify(team.name)}`;
      const rng = mulberry32(seedFrom(`strength:${id}`));
      return {
        id,
        competitionId: competition.id,
        name: team.name,
        shortName: team.short,
        country: competition.country,
        color: team.color,
        providerRef: team.name,
        hiddenAttack: clamp(Math.exp(gaussian(rng) * 0.16), 0.68, 1.38),
        hiddenDefence: clamp(Math.exp(gaussian(rng) * 0.14), 0.72, 1.34),
      };
    });
    teams.push(...compTeams);

    for (const team of compTeams) {
      const rng = mulberry32(seedFrom(`squad:${team.id}`));
      const usedNames = new Set<string>();
      for (let i = 0; i < ROLES.length; i += 1) {
        let first = FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)]!;
        let last = LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)]!;
        let guard = 0;
        while (usedNames.has(`${first} ${last}`) && guard < 20) {
          first = FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)]!;
          last = LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)]!;
          guard += 1;
        }
        usedNames.add(`${first} ${last}`);
        const role = ROLES[i]!;
        const importance = Math.max(0.2, 1 - i / (ROLES.length + 4));
        const starts = Math.round(clamp(26 * importance + gaussian(rng) * 2.2, 1, 30));
        const minutes = Math.round(starts * clamp(78 + gaussian(rng) * 12, 45, 90) + rng() * 120);
        const goalRate = role === "FWD" ? 0.32 : role === "MID" ? 0.14 : role === "DEF" ? 0.05 : 0;
        players.push({
          id: `${team.id}-p${i + 1}`,
          teamId: team.id,
          name: `${first} ${last}`,
          role,
          shirtNumber: i + 1,
          minutes,
          appearances: Math.min(30, starts + Math.round(rng() * 4)),
          starts,
          goals: Math.round(starts * goalRate * (0.6 + rng() * 0.8)),
          assists: role === "GK" ? 0 : Math.round(starts * goalRate * 0.5 * rng()),
        });
      }
    }

    const rounds = roundRobin(compTeams.map((team) => team.id));
    const totalPastRounds = 104;
    const futureRounds = 4;
    const firstRoundOffset = -totalPastRounds - 1;

    for (let offset = firstRoundOffset; offset <= futureRounds; offset += 1) {
      const roundDate = new Date(anchor.getTime() + offset * 7 * 86_400_000);
      const season = seasonLabel(roundDate);
      const roundIndex = ((offset % rounds.length) + rounds.length) % rounds.length;
      const pairs = rounds[roundIndex] ?? [];
      const fixturesOfRound: DemoFixtureRow[] = [];

      pairs.forEach(([homeId, awayId], index) => {
        const home = compTeams.find((team) => team.id === homeId)!;
        const away = compTeams.find((team) => team.id === awayId)!;
        const kickoff = new Date(roundDate.getTime() + index * 1.5 * 3_600_000);
        const fixtureId = `demo-${competition.code.toLowerCase()}-${season.replace("/", "-")}-r${roundIndex}-${homeId.split("-").pop()}-${awayId.split("-").pop()}-${offset}`;
        const rng = mulberry32(seedFrom(`match:${fixtureId}`));
        const simulated = simulateMatch(rng, home, away);
        const isPast = offset < 0;

        fixturesOfRound.push({
          id: fixtureId,
          competitionId: competition.id,
          season,
          round: `Giornata ${roundIndex + 1}`,
          homeTeamId: home.id,
          awayTeamId: away.id,
          kickoffUtc: kickoff.toISOString(),
          status: isPast ? "FINISHED" : "SCHEDULED",
          homeGoals: isPast ? simulated.homeGoals : null,
          awayGoals: isPast ? simulated.awayGoals : null,
          venue: `${home.shortName} Arena`,
          stats: isPast
            ? {
                homeXg: simulated.homeXg,
                awayXg: simulated.awayXg,
                homeShots: Math.round(8 + simulated.homeXg * 4 + rng() * 3),
                awayShots: Math.round(6 + simulated.awayXg * 4 + rng() * 3),
                homeShotsOnTarget: Math.round(2 + simulated.homeXg * 1.6),
                awayShotsOnTarget: Math.round(1 + simulated.awayXg * 1.6),
                homePossession: 50,
                awayPossession: 50,
              }
            : null,
        });
      });

      // Stati speciali per esercitare la UI (sempre DEMO).
      if (offset === -1 && fixturesOfRound[0]) {
        fixturesOfRound[0].status = "IN_PLAY";
        fixturesOfRound[0].homeGoals = 1;
        fixturesOfRound[0].awayGoals = 0;
        fixturesOfRound[0].kickoffUtc = new Date(now.getTime() - 42 * 60_000).toISOString();
        fixturesOfRound[0].stats = {
          homeXg: 1.2, awayXg: 0.5, homeShots: 9, awayShots: 4,
          homeShotsOnTarget: 4, awayShotsOnTarget: 1, homePossession: 55, awayPossession: 45,
        };
      }
      if (offset === 0 && fixturesOfRound[1]) {
        fixturesOfRound[1].status = "POSTPONED";
      }
      if (offset === 0 && fixturesOfRound[2]) {
        fixturesOfRound[2].status = "CANCELLED";
      }

      fixtures.push(...fixturesOfRound);
    }
  }

  // Formazioni e indisponibili per le partite più vicine.
  const fixturesByTeam = new Map<string, DemoFixtureRow[]>();
  for (const fixture of fixtures) {
    for (const teamId of [fixture.homeTeamId, fixture.awayTeamId]) {
      const list = fixturesByTeam.get(teamId) ?? [];
      list.push(fixture);
      fixturesByTeam.set(teamId, list);
    }
  }

  const relevantFixtures = fixtures.filter((fixture) => {
    const delta = new Date(fixture.kickoffUtc).getTime() - now.getTime();
    return delta > -8 * 86_400_000 && delta < 18 * 86_400_000;
  });

  for (const fixture of relevantFixtures) {
    if (fixture.status === "CANCELLED" || fixture.status === "POSTPONED") continue;
    const daysToKickoff = (new Date(fixture.kickoffUtc).getTime() - now.getTime()) / 86_400_000;

    for (const teamId of [fixture.homeTeamId, fixture.awayTeamId]) {
      const squad = players.filter((player) => player.teamId === teamId);
      const teamAvailability: DemoAvailabilityRow[] = [];
      const unavailableIds = new Set<string>();
      const chosenIds = new Set<string>();
      const rng = mulberry32(seedFrom(`availability:${fixture.id}:${teamId}`));
      const count = 1 + Math.floor(rng() * 3);
      const sorted = [...squad].sort((a, b) => b.starts - a.starts);

      for (let i = 0; i < count; i += 1) {
        const player = sorted[Math.floor(rng() * Math.min(11, sorted.length))] ?? sorted[0];
        if (!player || chosenIds.has(player.id)) continue;
        chosenIds.add(player.id);
        const roll = rng();
        const status: DemoAvailabilityRow["status"] =
          roll < 0.55 ? "INJURED" : roll < 0.75 ? "SUSPENDED" : roll < 0.92 ? "DOUBTFUL" : "UNKNOWN";
        if (status === "INJURED" || status === "SUSPENDED") unavailableIds.add(player.id);
        teamAvailability.push({
          id: `av-${fixture.id}-${teamId}-${player.id}`,
          fixtureId: fixture.id,
          teamId,
          playerId: player.id,
          playerName: player.name,
          status,
          reason:
            status === "INJURED"
              ? "Indisponibile (dato demo sintetico)"
              : status === "SUSPENDED"
                ? "Squalifica (dato demo sintetico)"
                : status === "DOUBTFUL"
                  ? "In dubbio (dato demo sintetico)"
                  : "Stato non comunicato (demo)",
          source: "Demo Medical Feed",
          confidence: status === "DOUBTFUL" ? 0.5 : 0.9,
          updatedAt: new Date(now.getTime() - Math.round(rng() * 20) * 3_600_000).toISOString(),
        });
      }

      // Conflitto di fonti dimostrativo sulla prima partita in calendario.
      if (relevantFixtures[0]?.id === fixture.id && teamId === fixture.homeTeamId && teamAvailability[0]) {
        const subject = teamAvailability[0];
        teamAvailability.push({
          ...subject,
          id: `${subject.id}-conflict`,
          status: subject.status === "INJURED" ? "DOUBTFUL" : "INJURED",
          source: "Demo Coach Report",
          confidence: 0.4,
          reason: "Fonte in conflitto (demo): verificare la comunicazione ufficiale",
          updatedAt: new Date(now.getTime() - 2 * 3_600_000).toISOString(),
        });
      }
      availability.push(...teamAvailability);

      const formation = FORMATION_NAMES[seedFrom(teamId) % FORMATION_NAMES.length]!;
      const shape = FORMATIONS[formation]!;
      const available = squad.filter((player) => !unavailableIds.has(player.id));
      const byRole = (role: DemoPlayerRow["role"]) =>
        available.filter((player) => player.role === role).sort((a, b) => b.starts - a.starts);
      const goalkeeper = byRole("GK")[0] ?? squad.find((p) => p.role === "GK")!;
      const starters: DemoPlayerRow[] = [
        goalkeeper,
        ...byRole("DEF").slice(0, shape.DEF),
        ...byRole("MID").slice(0, shape.MID),
        ...byRole("FWD").slice(0, shape.FWD),
      ];
      const starterIds = new Set(starters.map((player) => player.id));
      const bench = available.filter((player) => !starterIds.has(player.id)).slice(0, 7);
      const kind: DemoLineupRow["kind"] =
        fixture.status === "FINISHED" || fixture.status === "IN_PLAY"
          ? "OFFICIAL"
          : daysToKickoff <= 1.5
            ? "PROBABLE"
            : "MODEL";
      const source =
        kind === "OFFICIAL"
          ? "Demo Official Sheet"
          : kind === "PROBABLE"
            ? "Demo Press Room (sintetico)"
            : "Demo Model Reconstruction";

      lineups.push({
        fixtureId: fixture.id,
        teamId,
        kind,
        formation,
        source,
        updatedAt: new Date(now.getTime() - 3 * 3_600_000).toISOString(),
        players: [...starters, ...bench].map((player, index) => ({
          id: `lp-${fixture.id}-${teamId}-${player.id}`,
          fixtureId: fixture.id,
          teamId,
          playerId: player.id,
          playerName: player.name,
          role: player.role,
          slot: index,
          isStarter: index < 11,
          status:
            teamAvailability.find((row) => row.playerId === player.id)?.status ?? "AVAILABLE",
          shirtNumber: player.shirtNumber,
        })),
      });
    }
  }

  return {
    competitions,
    teams,
    players,
    fixtures,
    lineups,
    availability,
    generatedAt,
  };
}

export const DEMO_COMPETITION_IDS = COMPETITIONS.map((competition) => competition.id);
