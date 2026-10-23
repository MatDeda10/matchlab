#!/bin/sh
set -e

# Il database è su un volume: al primo avvio applichiamo le migrazioni.
# Se è vuoto, popoliamo il dataset DEMO (sintetico, dichiarato nella UI).
mkdir -p "$(dirname "$DATABASE_PATH")"

if [ ! -f "$DATABASE_PATH" ]; then
  ./node_modules/.bin/tsx scripts/db.ts migrate

  if [ "$DATA_PROVIDER" = "football-data-uk" ] || [ "$DATA_PROVIDER" = "open-data" ] || [ "$AUTO_SEED_REAL" = "1" ]; then
    echo "[matchlab] Database assente: importo lo snapshot reale incluso."
    ./node_modules/.bin/tsx scripts/db.ts seed-real
  else
    echo "[matchlab] Database assente: applico il dataset DEMO."
    ./node_modules/.bin/tsx scripts/db.ts seed
  fi
else
  echo "[matchlab] Database esistente: applico eventuali nuove migrazioni."
  ./node_modules/.bin/tsx scripts/db.ts migrate
fi

exec ./node_modules/.bin/next start -H "$HOSTNAME" -p "$PORT"
