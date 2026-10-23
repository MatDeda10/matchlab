# MatchLab

**Football intelligence, senza scorciatoie.**

MatchLab è un'applicazione web di analisi calcistica quantitativa: calendario, risultati, statistiche disponibili, un motore probabilistico deterministico e trasparente, un generatore di scenari con vincoli espliciti e un tracker di calibrazione.

Non è un sito di scommesse. Non gestisce denaro, non offre funzioni per piazzare puntate e non promette risultati. Le quote eventualmente mostrate sono **dati di mercato osservati dalla fonte pubblica**, riportati come contesto informativo: non sono live, non sono un consiglio e non vengono usate dal modello per calcolare le probabilità.

> **Modalità predefinita: DEMO.** Il database viene popolato con competizioni, squadre, partite e giocatori **sintetici**. Nulla di ciò che vedi in modalità DEMO rappresenta eventi reali. La UI lo segnala in ogni pagina.

---

## Cosa c'è dentro

| Area | Stato | Note |
| --- | --- | --- |
| Dashboard | ✅ | Partite del giorno, qualità dati, scenari e tracker |
| Calendario e filtri | ✅ | Data, competizione, squadra, stato, ricerca |
| Dettaglio partita | ✅ | 7 tab: panoramica, statistiche, formazioni, indisponibili, mercato, analisi, storico |
| Motore probabilistico | ✅ | Poisson bivariato + Dixon-Coles, time decay, shrinkage, matrice punteggi |
| Mercati del modello | ✅ | 1X2, doppia chance, O/U 1.5 e 2.5, Gol/No Gol, risultati esatti |
| Incertezza | ✅ | Monte Carlo deterministico, intervalli p10–p90 |
| Generatore | ✅ | Profili, soglie, una leg per partita, beam search, motivi di esclusione |
| Confronto scenari | ✅ | Fino a 4 scenari salvati, metriche affiancate |
| Tracker | ✅ | Brier, log loss, calibrazione, benchmark DEMO, risoluzione e annullamento |
| Preferenze | ✅ | Tema, fuso orario, competizioni preferite, profilo predefinito |
| Provider reale | ✅ | `football-data-uk`: CSV pubblici di football-data.co.uk + calendario OpenFootball, senza chiave API |
| Quote | ✅ | 1X2 e Over/Under 2.5 pre-partita o di chiusura, quando presenti nella fonte |
| Quote live | ❌ per scelta | Nessuna quota live, nessun mercato in-play, nessun calcolo di ROI |
| AI esplicativa | ❌ | Le spiegazioni sono deterministiche e derivate dai numeri. Nessun LLM calcola probabilità. |
| Auth / account | ❌ per scelta | Sessione anonima firmata; nessun dato personale |
| Pagamenti | ❌ per scelta | Fuori scope e contro i principi del progetto |

---

## Requisiti

- **Node.js >= 24** (usa `node:sqlite` nativo, senza flag; testato con Node 24 e 26)
- npm
- (Opzionale) Docker per il deploy

## Avvio rapido

### Dati reali gratuiti (consigliato)

Lo snapshot reale è incluso nel repository in forma compressa e base64. Non serve alcuna chiave API.

```bash
npm install
npm run db:seed:real     # importa lo snapshot incluso nel DB locale
# imposta DATA_PROVIDER=football-data-uk in .env.local
npm run dev
```

Apri <http://localhost:3000>.

Se il database è vuoto e `DATA_PROVIDER=football-data-uk`, lo snapshot viene importato automaticamente al primo accesso. `AUTO_SEED_REAL=0` disattiva il bootstrap.

Per scaricare dati aggiornati dalla fonte:

```bash
npm run sync                              # aggiorna il DB
npm run data:snapshot                     # rigenera lo snapshot base64
npm run data:snapshot -- --force          # ignora la cache HTTP
```

### Modalità DEMO

```bash
npm install
npm run setup      # migrazioni + dataset DEMO sintetico (date relative a oggi)
npm run dev
```

> Il dataset DEMO è relativo al giorno del seed. Se torni dopo qualche giorno e il calendario è vuoto, esegui `npm run db:seed`.

### Variabili d'ambiente

Copia `.env.example` in `.env.local`. In sviluppo funziona tutto senza variabili; in produzione `SESSION_SECRET` è **obbligatorio**.

```bash
DATA_PROVIDER=demo                         # demo | football-data-uk | football-data
FOOTBALL_DATA_UK_HISTORY_SEASONS=3         # 1–5, default 3
FOOTBALL_DATA_UK_FORCE=0                   # 1 = ignora cache HTTP
AUTO_SEED_REAL=                            # vuoto = auto con provider reale; 0 = disattiva
REAL_SNAPSHOT_PATH=                        # default: data/real/snapshot.json.gz.b64
FOOTBALL_DATA_API_KEY=                     # solo per football-data.org
FOOTBALL_DATA_COMPETITIONS=SA,PL,PD,BL1,FL1
SESSION_SECRET=
DATABASE_PATH=
```

## Script

| Comando | Cosa fa |
| --- | --- |
| `npm run dev` | Server di sviluppo |
| `npm run build` / `npm start` | Build e avvio produzione |
| `npm run typecheck` | TypeScript strict, `noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Suite Vitest (motore, CSV, squadre, quote, market summary) |
| `npm run verify` | typecheck + lint + test + build |
| `npm run db:migrate` | Applica le migrazioni |
| `npm run db:seed` | Rigenera il dataset DEMO |
| `npm run db:seed:real` | Importa lo snapshot reale (azzera il DB; `--no-reset` per non azzerare) |
| `npm run db:reset` | Azzera e rigenera il dataset DEMO |
| `npm run db:status` | Conteggio righe per tabella |
| `npm run data:snapshot` | Scarica i dati reali e scrive lo snapshot compresso |
| `npm run sync` | Sincronizza dal provider reale |
| `npm run backtest` | Metriche sul benchmark DEMO |

## Architettura in breve

```text
app/            pagine (Server Components) + API route handler
components/     UI accessibile, grafici SVG, pitch, form client
engine/         motore puro e testabile (nessuna dipendenza da DB o rete)
lib/api/        provider: demo, football-data-uk, football-data.org
lib/db/         SQLite nativo, migrazioni, repository tipizzati, snapshot
lib/services/   orchestrazione: modello, generatore, previsioni, scenari, sync
lib/security/   sessione firmata, rate limit, CSRF
lib/demo/       dataset e seed sintetici
db/migrations/  schema SQL versionato
docs/           documentazione tecnica
scripts/        CLI per database, snapshot, sync, backtest
```

Stack: **Next.js 16** (App Router), **React 19**, **TypeScript strict**, **Tailwind CSS 4**, **Lucide**, **Zod**, **SQLite** via `node:sqlite`, **Vitest**. Nessuna dipendenza da un LLM o da un servizio a pagamento.

### Deviazioni dichiarate dallo stack richiesto

- **SQLite con `node:sqlite` invece di Prisma/Drizzle.** Il driver nativo elimina dipendenze native e funziona su Node 22.5+. L'accesso dati è isolato in `lib/db/repositories.ts`, quindi un adapter Postgres è sostituibile senza toccare il motore. Trade-off: niente ORM, SQL esplicito.
- **Grafici SVG/CSS invece di una libreria di charting.** Meno dipendenze e pieno controllo su accessibilità e tema.
- **Nessun login.** Una sessione anonima HttpOnly firmata è sufficiente per salvare preferenze, previsioni e scenari. Nessun dato personale raccolto.
- **Snapshot compresso invece di Git LFS.** Il file `data/real/snapshot.json.gz.b64` contiene lo snapshot reale compresso con gzip e codificato in base64: resta leggibile dal runtime e sotto i limiti dell'API GitHub senza servizi esterni.

## Modello

Versione **`poisson-dc-1.0.0`**:

- forze offensive/difensive con peso esponenziale (half-life 180 giorni);
- shrinkage verso la media della competizione (6 partite equivalenti);
- stima iterativa di massima verosimiglianza Poisson;
- matrice dei punteggi con correzione Dixon-Coles (ρ = −0,06);
- probabilità derivate dalla matrice, non da euristiche;
- intervalli di sensibilità p10–p90 su 400 simulazioni deterministiche;
- punteggio di qualità del dato trasparente (campione, freschezza, xG, formazioni, indisponibili).

Le quote **non entrano nel modello**. Il tab Mercato confronta le probabilità stimate con la probabilità implicita della quota migliore e con il consenso di mercato, ma non calcola ROI, valore atteso o convenienza.

Dettagli matematici: [`docs/MODEL.md`](docs/MODEL.md). Metodologia nella UI: `/methodology`.

## Dati

- **Demo (default):** 4 competizioni inventate, 48 squadre, 864 giocatori, 2.640 partite, 176 formazioni, circa 30–40 previsioni di benchmark (dipende dalla data del seed). Tutto sintetico e dichiarato.
- **Reale gratuito:** 6 competizioni (Serie A, Premier League, Championship, LaLiga, Bundesliga, Ligue 1), 3 stagioni storiche configurabili, 145 squadre, 6.912 partite, 5.085 righe di statistiche e 4.780 sintesi di quote nello snapshot incluso.
- **Risultati e statistiche:** CSV pubblici di [football-data.co.uk](https://www.football-data.co.uk/), senza chiave API. Il provider importa gol, tiri, tiri in porta e xG quando presenti.
- **Calendario futuro:** [OpenFootball](https://github.com/openfootball/football.json) (CC0) per completare le partite della stagione corrente.
- **Quote:** solo 1X2 e Over/Under 2.5, pre-partita o di chiusura, quando presenti nei CSV. Per ogni selezione vengono salvate due sintesi: `BEST` (quota più alta tra i bookmaker tracciati, con il nome reale del bookmaker) e `AVG` (media di mercato). Non vengono salvate tutte le colonne bookmaker.
- **Copertura:** le quote sono limitate alla stagione corrente e la disponibilità varia per partita e competizione. Se una quota manca, la UI mostra “non disponibile”: non viene inventata o interpolata.
- **Bookmaker:** i nomi sono mostrati solo come attribuzione della fonte. Nessun logo, link, bonus, codice affiliato o invito al gioco.
- **Formazioni, indisponibili e rose:** non incluse dalle fonti gratuite; la UI le mostra come non disponibili.

Lo snapshot è composto da file JSON compressi con gzip. Il formato è documentato in [`docs/DATA_SOURCES.md`](docs/DATA_SOURCES.md); la pagina `/sources` mostra la copertura attiva.

## Privacy e sicurezza

- Cookie `ml_session` HttpOnly, SameSite=Lax, firmato HMAC-SHA256, 180 giorni.
- Nessuna email, nessun account, nessun tracker di terze parti, nessun IP salvato per il rate limit.
- Mutazioni protette da controllo same-origin (CSRF), body limit, rate limit persistito.
- Cancellazione completa dei dati dalla pagina Impostazioni.
- Header di sicurezza e CSP in `next.config.ts`.

Dettagli: [`docs/SECURITY.md`](docs/SECURITY.md) e `/privacy`.

## Deploy

L'app richiede un runtime Node e un filesystem scrivibile per SQLite. **GitHub Pages non può eseguire Next.js** e non è una opzione valida. Anche le piattaforme serverless con filesystem effimero non sono adatte a SQLite persistente senza un database esterno.

```bash
# Docker (consigliato per una demo persistente)
docker compose up --build
```

Imposta `SESSION_SECRET` in `.env`. Il database vive nel volume `matchlab-data`. Per partire con i dati reali, imposta `DATA_PROVIDER=football-data-uk`: al primo avvio con DB vuoto viene importato lo snapshot incluso.

Vedi [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) per Docker, reverse proxy, backup, cron di sync e limiti delle varie piattaforme.

## Test

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

La suite copre il motore (matrice normalizzata, coerenza mercati, determinismo, dati mancanti, valutazione, combinazioni) e la pipeline dati (parser CSV, fusi orari, alias squadre, parsing quote `BEST`/`AVG`, overround e market summary). Non esiste ancora una suite Playwright: è nella roadmap.

## Limiti

- Il motore usa solo i gol: xG, formazioni e indisponibili incidono sul punteggio di qualità, non ancora su λ.
- Le partite sono trattate come condizionatamente indipendenti; la correlazione tra eventi della stessa giornata non è modellata.
- Il modello non conosce meteo, arbitri, motivazioni, mercato o notizie.
- Le stime su campioni piccoli sono instabili; l'intervallo p10–p90 è una misura di sensibilità, non un intervallo di confidenza.
- Le quote non sono live e non coprono tutti i mercati o tutte le partite. Non sono garanzia di disponibilità futura.
- MatchLab non calcola ROI, valore atteso o convenienza e non gestisce denaro.

## Licenza

MIT. I dati appartengono ai rispettivi fornitori e sono soggetti ai loro termini. OpenFootball è distribuito con licenza CC0; football-data.co.uk mantiene i propri termini d'uso.

## Avvertenza

Le probabilità sono stime statistiche, non garanzie. Gli scenari possono comportare perdite. L'analisi non costituisce una raccomandazione finanziaria né garantisce risultati. Le quote mostrate non sono un invito al gioco. Se il gioco d'azzardo è un problema per te o per qualcuno che conosci, cerca supporto presso i servizi sanitari del tuo paese.
