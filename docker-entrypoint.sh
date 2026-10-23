#!/bin/sh
set -e

# Il database è su un volume: al primo avvio applichiamo le migrazioni.
# Se è vuoto, popoliamo il dataset DEMO (sintetico, dichiarato nella UI).
mkdir -p "$(dirname "$DATABASE_PATH")"

if [ ! -f "$DATABASE_PATH" ]; then
  echo "[matchlab] Database assente: applico migrazioni e dataset DEMO."
  ./node_modules/.bin/tsx scripts/db.ts migrate
  ./node_modules/.bin/tsx scripts/db.ts seed
else
  echo "[matchlab] Database esistente: applico eventuali nuove migrazioni."
  ./node_modules/.bin/tsx scripts/db.ts migrate
fi

exec ./node_modules/.bin/next start -H "$HOSTNAME" -p "$PORT"
