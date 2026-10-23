/**
 * Risoluzione dei nomi squadra tra fonti diverse.
 *
 * football-data.co.uk usa nomi brevi (`Inter`, `Man City`, `M'gladbach`),
 * OpenFootball usa nomi estesi (`FC Internazionale Milano`, `Manchester City FC`).
 * Per non duplicare le squadre e non perdere lo storico del modello, entrambe
 * le fonti vengono ricondotte a un nome canonico stabile.
 */

const GENERIC_TOKENS = new Set([
  "fc",
  "afc",
  "cf",
  "cfc",
  "sc",
  "ssc",
  "ac",
  "as",
  "us",
  "ss",
  "sv",
  "vfb",
  "vfl",
  "tsg",
  "fsv",
  "bsc",
  "sd",
  "ud",
  "ca",
  "rc",
  "rcd",
  "ogc",
  "losc",
  "estac",
  "club",
  "calcio",
  "de",
  "del",
  "della",
  "di",
  "the",
  "and",
]);

function stripGenericTokens(value: string): string {
  return value
    .split(" ")
    .filter((token) => token && !GENERIC_TOKENS.has(token) && !/^\d{2,4}$/.test(token))
    .join(" ")
    .trim();
}

export function normalizeTeamKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function compact(value: string): string {
  return normalizeTeamKey(value).replace(/\s+/g, " ");
}

function signature(value: string): string {
  const normalized = stripGenericTokens(compact(value));
  return normalized || compact(value);
}

/**
 * Alias espliciti: nome della fonte esterna → nome canonico usato da
 * football-data.co.uk. Sono intenzionalmente espliciti: un errore di matching
 * sposterebbe lo storico sulla squadra sbagliata.
 */
export const TEAM_ALIASES: Record<string, string> = {
  // Serie A
  "ac milan": "Milan",
  "ac monza": "Monza",
  "acf fiorentina": "Fiorentina",
  "as roma": "Roma",
  "atalanta bc": "Atalanta",
  "bologna fc 1909": "Bologna",
  "cagliari calcio": "Cagliari",
  "como 1907": "Como",
  "fc internazionale milano": "Inter",
  "frosinone calcio": "Frosinone",
  "genoa cfc": "Genoa",
  "juventus fc": "Juventus",
  "parma calcio 1913": "Parma",
  "ss lazio": "Lazio",
  "ssc napoli": "Napoli",
  "torino fc": "Torino",
  "us lecce": "Lecce",
  "us sassuolo calcio": "Sassuolo",
  "udinese calcio": "Udinese",
  "venezia fc": "Venezia",

  // Premier League
  "afc bournemouth": "Bournemouth",
  "arsenal fc": "Arsenal",
  "aston villa fc": "Aston Villa",
  "brentford fc": "Brentford",
  "brighton and hove albion fc": "Brighton",
  "chelsea fc": "Chelsea",
  "coventry city fc": "Coventry",
  "crystal palace fc": "Crystal Palace",
  "everton fc": "Everton",
  "fulham fc": "Fulham",
  "hull city afc": "Hull",
  "ipswich town fc": "Ipswich",
  "leeds united fc": "Leeds",
  "liverpool fc": "Liverpool",
  "manchester city fc": "Man City",
  "manchester united fc": "Man United",
  "newcastle united fc": "Newcastle",
  "nottingham forest fc": "Nott'm Forest",
  "sunderland afc": "Sunderland",
  "tottenham hotspur fc": "Tottenham",

  // Championship
  "birmingham city fc": "Birmingham",
  "blackburn rovers fc": "Blackburn",
  "bolton wanderers fc": "Bolton",
  "bristol city fc": "Bristol City",
  "burnley fc": "Burnley",
  "cardiff city fc": "Cardiff",
  "charlton athletic fc": "Charlton",
  "derby county fc": "Derby",
  "lincoln city fc": "Lincoln",
  "middlesbrough fc": "Middlesbrough",
  "millwall fc": "Millwall",
  "norwich city fc": "Norwich",
  "portsmouth fc": "Portsmouth",
  "preston north end fc": "Preston",
  "queens park rangers fc": "QPR",
  "sheffield united fc": "Sheffield United",
  "southampton fc": "Southampton",
  "stoke city fc": "Stoke",
  "swansea city afc": "Swansea",
  "watford fc": "Watford",
  "west bromwich albion fc": "West Brom",
  "west ham united fc": "West Ham",
  "wolverhampton wanderers fc": "Wolves",
  "wrexham afc": "Wrexham",

  // La Liga
  "athletic club": "Ath Bilbao",
  "ca osasuna": "Osasuna",
  "club atletico de madrid": "Ath Madrid",
  "deportivo alaves": "Alaves",
  "elche cf": "Elche",
  "fc barcelona": "Barcelona",
  "getafe cf": "Getafe",
  "levante ud": "Levante",
  "malaga cf": "Malaga",
  "rc celta de vigo": "Celta",
  "rc deportivo la coruna": "La Coruna",
  "rcd espanyol de barcelona": "Espanol",
  "rayo vallecano de madrid": "Vallecano",
  "real betis balompie": "Betis",
  "real madrid cf": "Real Madrid",
  "real racing club de santander": "Santander",
  "real sociedad de futbol": "Sociedad",
  "sevilla fc": "Sevilla",
  "valencia cf": "Valencia",
  "villarreal cf": "Villarreal",

  // Bundesliga
  "1 fc koln": "FC Koln",
  "1 fc union berlin": "Union Berlin",
  "1 fsv mainz 05": "Mainz",
  "bayer 04 leverkusen": "Leverkusen",
  "borussia dortmund": "Dortmund",
  "borussia monchengladbach": "M'gladbach",
  "eintracht frankfurt": "Ein Frankfurt",
  "fc augsburg": "Augsburg",
  "fc bayern munchen": "Bayern Munich",
  "fc schalke 04": "Schalke 04",
  "hamburger sv": "Hamburg",
  "rb leipzig": "RB Leipzig",
  "sc freiburg": "Freiburg",
  "sc paderborn 07": "Paderborn",
  "sv 07 elversberg": "Elversberg",
  "sv werder bremen": "Werder Bremen",
  "tsg 1899 hoffenheim": "Hoffenheim",
  "vfb stuttgart": "Stuttgart",

  // Ligue 1
  "aj auxerre": "Auxerre",
  "as monaco fc": "Monaco",
  "angers sco": "Angers",
  "es troyes ac": "Troyes",
  "fc lorient": "Lorient",
  "le havre ac": "Le Havre",
  "le mans fc": "Le Mans",
  "lille osc": "Lille",
  "ogc nice": "Nice",
  "olympique lyonnais": "Lyon",
  "olympique de marseille": "Marseille",
  "paris fc": "Paris FC",
  "paris saint germain fc": "Paris SG",
  "rc strasbourg alsace": "Strasbourg",
  "racing club de lens": "Lens",
  "stade brestois 29": "Brest",
  "stade rennais fc 1901": "Rennes",
  "toulouse fc": "Toulouse",

  // Varianti frequenti tra stagioni/file
  "inter milan": "Inter",
  "internazionale": "Inter",
  "manchester city": "Man City",
  "manchester united": "Man United",
  "newcastle utd": "Newcastle",
  "nottingham forest": "Nott'm Forest",
  "nottm forest": "Nott'm Forest",
  "tottenham hotspur": "Tottenham",
  "wolverhampton": "Wolves",
  "wolverhampton wanderers": "Wolves",
  "atletico madrid": "Ath Madrid",
  "athletic bilbao": "Ath Bilbao",
  "real betis": "Betis",
  "real sociedad": "Sociedad",
  "rayo vallecano": "Vallecano",
  "espanyol": "Espanol",
  "deportivo la coruna": "La Coruna",
  "sporting de gijon": "Sp Gijon",
  "bayern munich": "Bayern Munich",
  "bayern": "Bayern Munich",
  "monchengladbach": "M'gladbach",
  "borussia m gladbach": "M'gladbach",
  "frankfurt": "Ein Frankfurt",
  "eintracht": "Ein Frankfurt",
  "koln": "FC Koln",
  "cologne": "FC Koln",
  "union berlin": "Union Berlin",
  "werder": "Werder Bremen",
  "paris st germain": "Paris SG",
  "psg": "Paris SG",
  "marseille": "Marseille",
  "lyon": "Lyon",
  "lens": "Lens",
};

const ALIAS_BY_SIGNATURE = new Map<string, string>();
for (const [alias, canonical] of Object.entries(TEAM_ALIASES)) {
  ALIAS_BY_SIGNATURE.set(signature(alias), canonical);
}

function tokenScore(left: string, right: string): number {
  const leftTokens = new Set(signature(left).split(" ").filter(Boolean));
  const rightTokens = new Set(signature(right).split(" ").filter(Boolean));
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
  let intersection = 0;
  for (const token of leftTokens) if (rightTokens.has(token)) intersection += 1;
  return intersection / new Set([...leftTokens, ...rightTokens]).size;
}

/**
 * Restituisce il nome canonico per un nome proveniente da una fonte esterna.
 * Se non esiste un match ragionevole, restituisce il nome originale ripulito:
 * meglio una squadra in più che una squadra associata a quella sbagliata.
 */
export function resolveTeamName(name: string, canonicalNames: string[] = []): string {
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (!trimmed) return trimmed;

  const direct = ALIAS_BY_SIGNATURE.get(signature(trimmed));
  if (direct) return direct;

  const exact = canonicalNames.find(
    (candidate) => compact(candidate) === compact(trimmed),
  );
  if (exact) return exact;

  const canonicalSignature = canonicalNames.find(
    (candidate) => signature(candidate) === signature(trimmed),
  );
  if (canonicalSignature) return canonicalSignature;

  const best = canonicalNames
    .map((candidate) => ({ candidate, score: tokenScore(candidate, trimmed) }))
    .sort((left, right) => right.score - left.score)[0];
  if (best && best.score >= 0.6) return best.candidate;

  return trimmed;
}

export { signature as teamSignature };
