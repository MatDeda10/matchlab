# Architettura

## Obiettivi

1. **Determinismo**: le probabilità non dipendono da un LLM, da un servizio esterno o dall'ordine delle richieste.
2. **Trasparenza**: ogni stima porta con sé copertura, qualità del dato, versione del modello e limiti.
3. **Separazione**: il motore (`engine/`) non conosce database, HTTP o React. I servizi orchestrano; le pagine leggono.
4. **Costo zero**: nessun servizio a pagamento, nessuna chiave obbligatoria, SQLite locale.

## Struttura

```text
engine/                  motore puro
  ratings.ts             stima forze (time decay, shrinkage, MLE Poisson)
  poisson.ts             matrice punteggi + Dixon-Coles
  markets.ts             1X2, DC, O/U, BTTS, risultati esatti
  uncertainty.ts         Monte Carlo deterministico (p10/p50/p90)
  quality.ts             punteggio qualità del dato
  model.ts               orchestrazione pura della singola partita
  combination.ts         beam search di scenari con vincoli
  evaluation.ts          Brier, log loss, calibrazione
  explanations.ts        spiegazioni derivate dai numeri
  resolve.ts             risoluzione mercati dal risultato finale
  types.ts               tipi condivisi

lib/
  api/                   provider astratti + adapter + guardia route
  config/constants.ts    modello, mercati, profili, disclaimer
  db/                    SQLite nativo, migrazioni, repository
  demo/                  dataset e seed sintetici
  security/              sessione, rate limit, CSRF
  services/              model, generator, predictions, scenarios, sync
  dates.ts / format.ts   utilità di presentazione
  validation/schemas.ts  schemi Zod condivisi

app/
  page.tsx               dashboard
  matches/               elenco + dettaglio a 6 tab
  generator/             wizard client
  scenarios/             confronto scenari
  tracker/               metriche e previsioni
  settings/              preferenze e cancellazione dati
  methodology|sources|privacy|terms/
  api/                   route handler Node.js

components/              shell, UI, grafici SVG, pitch, form client
db/migrations/           schema SQL versionato
scripts/                 CLI (db, sync, backtest)
features/teams/          helper forma/H2H per la pagina partita
```

## Flusso di una stima

```text
fixture (DB)
  → predictScheduledFixture()            lib/services/model.ts
    → ratingsForCompetition()            engine/ratings.ts (cache in memoria)
      → listFinishedMatches()            lib/db/repositories.ts
    → predictFixture()                   engine/model.ts
      → buildScoreMatrix()               engine/poisson.ts
      → buildMarketProbabilities()       engine/markets.ts
      → scoreDataQuality()               engine/quality.ts
      → estimateUncertainty()            engine/uncertainty.ts (solo se richiesto)
  → FixturePrediction
```

- `ratingsForCompetition` mantiene una cache in memoria per competizione e data di riferimento.
- La pagina dettaglio calcola l'incertezza; l'elenco partite no (per costo).
- Le previsioni **non** vengono salvate automaticamente: solo quando l'utente registra una previsione viene creato uno snapshot.

## Flusso di una previsione

```text
POST /api/predictions
  → guardMutation (same-origin, body ≤ 32KB, sessione, rate limit 30/min)
  → createPredictionFromSelections(sessionId, selections)
      → per ogni selezione: getFixture + predictScheduledFixture
      → probabilità ricalcolata server-side (mai fidarsi del client)
      → createPrediction() + prediction_legs in transazione
  → { id, snapshot }
```

Lo snapshot contiene probabilità, etichette, kickoff, qualità e limiti **al momento della registrazione**. Non viene riscritto.

La risoluzione (`POST /api/predictions/settle`) verifica che tutte le partite siano `FINISHED`, risolve ogni mercato con `engine/resolve.ts` e imposta l'esito. Le leg non risolte restano `NULL` ed escluse dalle metriche.

## Generatore

```text
POST /api/generate
  → runGeneration(config)
      → listFixtures(finestra, competizioni, SCHEDULED)
      → per ogni fixture: predictScheduledFixture (con incertezza)
      → candidati (fixture × mercato × selezione)
      → generateProposals(candidati, profilo, vincoli)
          → filtro soglie, una leg per partita, max per competizione
          → beam search limitata
      → { result, context }
```

Non esiste memoria condivisa tra richieste per i risultati: ogni generazione ricalcola. La cache delle forze rende l'operazione rapida.

## Database

SQLite, file `data/matchlab.db`, WAL, foreign key attive, busy timeout 5s.

Tabelle principali:

| Tabella | Scopo |
| --- | --- |
| `competitions`, `teams`, `players` | Anagrafica |
| `fixtures` | Partite, stato, risultato, provider |
| `fixture_statistics` | xG/tiri/possesso se disponibili |
| `lineups`, `lineup_players` | Formazioni con `kind` (OFFICIAL/PROBABLE/MODEL) |
| `availability` | Indisponibili con fonte e stato |
| `predictions`, `prediction_legs` | Previsioni utente + snapshot |
| `scenarios` | Configurazione e risultato del generatore |
| `preferences` | Preferenze per sessione |
| `api_cache` | Cache risposte provider |
| `rate_limits` | Finestre di rate limit |
| `source_metadata` | Ultima sincronizzazione/stato per entità |
| `model_versions` | Configurazione delle versioni del modello |

Le migrazioni sono file SQL applicati in ordine e registrati in `_migrations`. `createDatabase()` le applica automaticamente all'avvio (idempotente).

### Perché `node:sqlite`

Prisma 8 RC causava mismatch di client e installazioni instabili nell'ambiente di sviluppo. Il driver nativo:

- non richiede binari o postinstall;
- è disponibile su Node >= 22.5;
- elimina un layer di generazione.

Costo: SQL esplicito e nessun type-safety automatico dello schema. I repository mappano righe → DTO tipizzati e sono l'unico punto da modificare per passare a Postgres.

## Sessioni

Nessun login. `ensureSessionId()` (solo route handler) crea un UUID e lo firma con HMAC-SHA256; il cookie è HttpOnly, SameSite=Lax, Secure in produzione, durata 180 giorni. Le pagine usano `readSessionId()`, che non crea nulla.

I dati sono sempre filtrati per `session_id` lato server. Non esiste un endpoint che accetti un `sessionId` dal client.

## Rendering

- Le pagine dati sono Server Components con `dynamic = "force-dynamic"` (SQLite e cookie).
- I form e le interazioni sono Client Components isolati (`generator-wizard`, `scenario-board`, `tracker-board`, `settings-form`, `prediction-form`).
- I grafici sono SVG server-rendered, senza dipendenze runtime.
- Tema scuro/chiaro via `data-theme` su `<html>`, script inline anti-flash, preferenza in localStorage.

## API

| Metodo | Percorso | Note |
| --- | --- | --- |
| POST | `/api/generate` | 12/min, Zod, body ≤ 32KB |
| GET/POST | `/api/scenarios` | Elenco/salvataggio |
| DELETE | `/api/scenarios/:id` | Solo sessione proprietaria |
| GET/POST | `/api/predictions` | Elenco/creazione con ricalcolo |
| POST | `/api/predictions/settle` | Risolve le partite concluse |
| DELETE | `/api/predictions/:id` | Solo prima del kickoff |
| GET/PUT | `/api/preferences` | Preferenze |
| DELETE | `/api/account` | Cancella dati + cookie |
| GET | `/api/health` | Stato tecnico, nessun segreto |
| POST | `/api/sync` | 3/5min, provider reale |

Errori: JSON `{ error }` con status coerente (400/401/403/404/409/413/422/429/500/502). Nessuno stack trace al client.

## Scelte e compromessi

- **Nessuna libreria di stato globale**: le pagine sono server-first; lo stato mutabile è locale ai form.
- **Nessun ORM**: meno magia, più controllo su transazioni e indici.
- **Nessuna coda/worker**: la sincronizzazione è manuale o via cron esterno. Semplice e onesto per una demo.
- **Nessun LLM**: le spiegazioni sono template deterministici basati sui numeri. Un LLM non deve mai generare probabilità; se in futuro verrà aggiunto, sarà solo per riformulare testi già calcolati, con fallback.
- **Una leg per partita**: evita di moltiplicare probabilità correlate come se fossero indipendenti.
