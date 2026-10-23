-- MatchLab — schema iniziale (SQLite)
-- Le migrazioni sono applicate in ordine da lib/db/index.ts e scripts/db.ts.

CREATE TABLE IF NOT EXISTS _migrations (
  id TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS competitions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  country TEXT NOT NULL,
  code TEXT NOT NULL,
  tier INTEGER NOT NULL DEFAULT 1,
  provider TEXT NOT NULL,
  provider_ref TEXT,
  logo_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  competition_id TEXT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  country TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_ref TEXT,
  color TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_teams_competition ON teams(competition_id);

CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('GK', 'DEF', 'MID', 'FWD')),
  shirt_number INTEGER,
  provider TEXT NOT NULL,
  provider_ref TEXT,
  minutes INTEGER NOT NULL DEFAULT 0,
  appearances INTEGER NOT NULL DEFAULT 0,
  starts INTEGER NOT NULL DEFAULT 0,
  goals INTEGER NOT NULL DEFAULT 0,
  assists INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_players_team ON players(team_id);

CREATE TABLE IF NOT EXISTS fixtures (
  id TEXT PRIMARY KEY,
  competition_id TEXT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  season TEXT NOT NULL,
  round TEXT,
  home_team_id TEXT NOT NULL REFERENCES teams(id),
  away_team_id TEXT NOT NULL REFERENCES teams(id),
  kickoff_utc TEXT NOT NULL,
  status TEXT NOT NULL CHECK (
    status IN ('SCHEDULED', 'IN_PLAY', 'FINISHED', 'POSTPONED', 'CANCELLED')
  ),
  home_goals INTEGER,
  away_goals INTEGER,
  venue TEXT,
  provider TEXT NOT NULL,
  provider_ref TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  UNIQUE (provider, provider_ref)
);
CREATE INDEX IF NOT EXISTS idx_fixtures_kickoff ON fixtures(kickoff_utc);
CREATE INDEX IF NOT EXISTS idx_fixtures_competition ON fixtures(competition_id, kickoff_utc);
CREATE INDEX IF NOT EXISTS idx_fixtures_home ON fixtures(home_team_id);
CREATE INDEX IF NOT EXISTS idx_fixtures_away ON fixtures(away_team_id);

CREATE TABLE IF NOT EXISTS fixture_statistics (
  fixture_id TEXT PRIMARY KEY REFERENCES fixtures(id) ON DELETE CASCADE,
  home_xg REAL,
  away_xg REAL,
  home_shots INTEGER,
  away_shots INTEGER,
  home_shots_on_target INTEGER,
  away_shots_on_target INTEGER,
  home_possession REAL,
  away_possession REAL,
  source TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS lineups (
  fixture_id TEXT NOT NULL REFERENCES fixtures(id) ON DELETE CASCADE,
  team_id TEXT NOT NULL REFERENCES teams(id),
  kind TEXT NOT NULL CHECK (kind IN ('OFFICIAL', 'PROBABLE', 'MODEL', 'UNAVAILABLE')),
  formation TEXT,
  source TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (fixture_id, team_id)
);

CREATE TABLE IF NOT EXISTS lineup_players (
  id TEXT PRIMARY KEY,
  fixture_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  player_id TEXT REFERENCES players(id),
  player_name TEXT NOT NULL,
  role TEXT NOT NULL,
  slot INTEGER NOT NULL,
  is_starter INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'AVAILABLE',
  shirt_number INTEGER,
  FOREIGN KEY (fixture_id, team_id) REFERENCES lineups(fixture_id, team_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_lineup_players_fixture ON lineup_players(fixture_id, team_id);

CREATE TABLE IF NOT EXISTS player_availability (
  id TEXT PRIMARY KEY,
  fixture_id TEXT NOT NULL REFERENCES fixtures(id) ON DELETE CASCADE,
  team_id TEXT NOT NULL REFERENCES teams(id),
  player_id TEXT REFERENCES players(id),
  player_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (
    status IN ('AVAILABLE', 'INJURED', 'SUSPENDED', 'DOUBTFUL', 'RETURNING', 'UNKNOWN')
  ),
  reason TEXT,
  source TEXT NOT NULL,
  confidence REAL,
  updated_at TEXT NOT NULL,
  UNIQUE (fixture_id, team_id, player_id, source)
);
CREATE INDEX IF NOT EXISTS idx_availability_fixture ON player_availability(fixture_id);

CREATE TABLE IF NOT EXISTS model_versions (
  version TEXT PRIMARY KEY,
  config_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS predictions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  kickoff_min TEXT,
  status TEXT NOT NULL CHECK (status IN ('OPEN', 'SETTLED', 'VOID')),
  outcome TEXT CHECK (outcome IN ('WON', 'LOST', 'VOID')),
  model_version TEXT NOT NULL,
  data_quality INTEGER NOT NULL,
  is_demo INTEGER NOT NULL DEFAULT 0,
  snapshot_json TEXT NOT NULL,
  settled_at TEXT,
  exclusion_reason TEXT
);
CREATE INDEX IF NOT EXISTS idx_predictions_session ON predictions(session_id, created_at);

CREATE TABLE IF NOT EXISTS prediction_legs (
  id TEXT PRIMARY KEY,
  prediction_id TEXT NOT NULL REFERENCES predictions(id) ON DELETE CASCADE,
  fixture_id TEXT NOT NULL,
  competition_id TEXT NOT NULL,
  market_id TEXT NOT NULL,
  selection_id TEXT NOT NULL,
  probability REAL NOT NULL,
  quality INTEGER NOT NULL,
  actual_won INTEGER,
  UNIQUE (prediction_id, fixture_id)
);
CREATE INDEX IF NOT EXISTS idx_prediction_legs_prediction ON prediction_legs(prediction_id);

CREATE TABLE IF NOT EXISTS scenarios (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  model_version TEXT NOT NULL,
  config_json TEXT NOT NULL,
  result_json TEXT NOT NULL,
  is_demo INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_scenarios_session ON scenarios(session_id, created_at);

CREATE TABLE IF NOT EXISTS preferences (
  session_id TEXT PRIMARY KEY,
  theme TEXT NOT NULL DEFAULT 'dark',
  timezone TEXT NOT NULL DEFAULT 'Europe/Rome',
  locale TEXT NOT NULL DEFAULT 'it',
  favorite_competitions TEXT NOT NULL DEFAULT '[]',
  default_profile TEXT NOT NULL DEFAULT 'balanced',
  interface_prefs TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS source_metadata (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  status TEXT NOT NULL,
  note TEXT
);
CREATE INDEX IF NOT EXISTS idx_source_entity ON source_metadata(entity_type, entity_id);

CREATE TABLE IF NOT EXISTS api_cache (
  key TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  ttl_seconds INTEGER NOT NULL,
  source TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rate_limits (
  bucket TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL,
  limit_value INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_runs (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL,
  detail_json TEXT
);
