-- MatchLab — snapshot delle quote di mercato.
-- Le quote sono dati osservati dalla fonte, non stime del modello.
-- Non vengono mai generate o interpolate: se mancano, la UI mostra "non disponibile".

CREATE TABLE IF NOT EXISTS odds_snapshots (
  id TEXT PRIMARY KEY,
  fixture_id TEXT NOT NULL REFERENCES fixtures(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  source TEXT NOT NULL,
  market_id TEXT NOT NULL,
  selection_id TEXT NOT NULL,
  bookmaker TEXT NOT NULL,
  bookmaker_label TEXT NOT NULL,
  odds_decimal REAL NOT NULL CHECK (odds_decimal > 1),
  is_closing INTEGER NOT NULL DEFAULT 0 CHECK (is_closing IN (0, 1)),
  fetched_at TEXT NOT NULL,
  UNIQUE (fixture_id, market_id, selection_id, bookmaker, is_closing, source)
);

CREATE INDEX IF NOT EXISTS idx_odds_fixture ON odds_snapshots(fixture_id, market_id, selection_id);
CREATE INDEX IF NOT EXISTS idx_odds_market ON odds_snapshots(market_id, selection_id, is_closing);
CREATE INDEX IF NOT EXISTS idx_odds_fetched ON odds_snapshots(fetched_at);
