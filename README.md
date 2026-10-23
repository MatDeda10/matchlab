# MatchLab

**Football intelligence, senza scorciatoie.**

MatchLab è un'applicazione web di analisi calcistica quantitativa: calendario, statistiche, formazioni (quando disponibili), un motore probabilistico deterministico e trasparente, un generatore di scenari con vincoli espliciti e un tracker di calibrazione.

Non è un sito di scommesse. Non mostra quote, non gestisce denaro e non promette risultati. Le probabilità sono stime statistiche, non garanzie.

> **Modalità predefinita: DEMO.** Il database viene popolato con competizioni, squadre, partite e giocatori **sintetici**. Nulla di ciò che vedi in modalità DEMO rappresenta eventi reali. La UI lo segnala in ogni pagina.

---

## Cosa c'è dentro

| Area | Stato | Note |
| --- | --- | --- |
| Dashboard | ✅ | Partite del giorno, qualità dati, scenari e tracker |
| Calendario e filtri | ✅ | Data, competizione, squadra, stato, ricerca |
| Dettaglio partita | ✅ | 6 tab: panoramica, statistiche, formazioni, indisponibili, analisi, storico |
| Motore probabilistico | ✅ | Poisson bivariato + Dixon-Coles, time decay, shrinkage, matrice punteggi |
| Mercati | ✅ | 1X2, doppia chance, O/U 1.5 e 2.5, Gol/No Gol, risultati esatti |
| Incertezza | ✅ | Monte Carlo deterministico, intervalli p10–p90 |
| Generatore | ✅ | Profili, soglie, una leg per partita, beam search, motivi di esclusione |
| Confronto scenari | ✅ | Fino a 4 scenari salvati, metriche affiancate |
| Tracker | ✅ | Brier, log loss, calibrazione, benchmark DEMO, risoluzione e annullamento |
| Preferenze | ✅ | Tema, fuso orario, competizioni preferite, profilo predefinito |
| AI esplicativa | ❌ | Non implementata. Le spiegazioni sono deterministiche e derivate dai numeri. Nessun LLM calcola probabilità. |
| Provider reale | ⚠️ | Adapter football-data.org v4 pronto, non testato in CI senza chiave API |
| Auth / account | ❌ per scelta | Sessione anonima firmata; nessun dato personale |
| Pagamenti / quote | ❌ per scelta | Fuori scope e contro i principi del progetto |

---

## Requisiti

- **Node.js >= 24** (usa `node:sqlite` nativo, senza flag; testato con Node 24 e 26)
- npm
- (Opzionale) Docker per il deploy

## Avvio rapido

```bash
npm install
npm run setup      # migrazioni + dataset DEMO sintetico (date relative a oggi)
npm run dev
```

Apri <http://localhost:3000>.

> Il dataset DEMO è relativo al giorno del seed. Se torni dopo qualche giorno e il calendario è vuoto, esegui `npm run db:seed`.

### Variabili d'ambiente

Copia `.env.example` in `.env.local`. In sviluppo funziona tutto senza variabili; in produzione `SESSION_SECRET` è **obbligatorio**.

```bash
DATA_PROVIDER=demo
FOOTBALL_DATA_API_KEY=
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
| `npm test` | Test del motore (Vitest) |
| `npm run verify` | typecheck + lint + test + build |
| `npm run db:migrate` | Applica le migrazioni |
| `npm run db:seed` | Rigenera il dataset DEMO |
| `npm run db:reset` | Azzera e rigenera il dataset DEMO |
| `npm run db:status` | Conteggio righe per tabella |
| `npm run sync` | Sincronizza dal provider reale (richiede chiave) |
| `npm run backtest` | Metriche sul benchmark DEMO |

## Architettura in breve

```text
app/            pagine (Server Components) + API route handler
components/     UI accessibile, grafici SVG, pitch, form client
engine/         motore puro e testabile (nessuna dipendenza da DB o rete)
lib/api/        provider astratti: demo + football-data.org
lib/db/         SQLite nativo, migrazioni, repository tipizzati
lib/services/   orchestrazione: modello, generatore, previsioni, scenari, sync
lib/security/   sessione firmata, rate limit, CSRF
lib/demo/       dataset e seed sintetici
db/migrations/  schema SQL versionato
docs/           documentazione tecnica
scripts/        CLI per database, sync, backtest
```

Stack: **Next.js 16** (App Router), **React 19**, **TypeScript strict**, **Tailwind CSS 4**, **Lucide**, **Zod**, **SQLite** via `node:sqlite`, **Vitest**. Nessuna dipendenza da un LLM o da un servizio a pagamento.

### Deviazioni dichiarate dallo stack richiesto

- **SQLite con `node:sqlite` invece di Prisma/Drizzle.** Prisma 8 RC si è dimostrato instabile nell'ambiente; il driver nativo elimina dipendenze native e funziona su Node 22.5+. L'accesso dati è isolato in `lib/db/repositories.ts`, quindi un adapter Postgres è sostituibile senza toccare il motore. Trade-off: niente ORM, SQL esplicito.
- **Grafici SVG/CSS invece di una libreria di charting.** Meno dipendenze e pieno controllo su accessibilità e tema.
- **Nessun login.** Una sessione anonima HttpOnly firmata è sufficiente per salvare preferenze, previsioni e scenari. Nessun dato personale raccolto.

## Modello

Versione **`poisson-dc-1.0.0`**:

- forze offensive/difensive con peso esponenziale (half-life 180 giorni);
- shrinkage verso la media della competizione (6 partite equivalenti);
- stima iterativa di massima verosimiglianza Poisson;
- matrice dei punteggi con correzione Dixon-Coles (ρ = −0,06);
- probabilità derivate dalla matrice, non da euristiche;
- intervalli di sensibilità p10–p90 su 400 simulazioni deterministiche;
- punteggio di qualità del dato trasparente (campione, freschezza, xG, formazioni, indisponibili).

Dettagli matematici: [`docs/MODEL.md`](docs/MODEL.md). Metodologia nella UI: `/methodology`.

## Dati

- **Demo (default):** 4 competizioni inventate, 48 squadre, 864 giocatori, 2.640 partite, 176 formazioni, circa 30–40 previsioni di benchmark (dipende dalla data del seed). Tutto sintetico e dichiarato.
- **Reale (opzionale):** football-data.org v4, piano gratuito (12 competizioni, 10 richieste/minuto dichiarate, risultati con ritardo). L'adapter usa cache 6h, rate limit 8/min, retry e timeout. Formazioni, infortuni e xG non sono inclusi nel piano gratuito e vengono mostrati come **non disponibili**, mai inventati.

Vedi [`docs/DATA_SOURCES.md`](docs/DATA_SOURCES.md) e la pagina `/sources`.

## Privacy e sicurezza

- Cookie `ml_session` HttpOnly, SameSite=Lax, firmato HMAC-SHA256, 180 giorni.
- Nessuna email, nessun account, nessun tracker di terze parti, nessun IP salvato per il rate limit.
- Mutazioni protette da controllo same-origin (CSRF), body limit, rate limit persistito.
- Cancellazione completa dei dati dalla pagina Impostazioni.
- Header di sicurezza e CSP in `next.config.ts`.

Dettagli: [`docs/SECURITY.md`](docs/SECURITY.md) e `/privacy`.

## Deploy

L'app richiede un runtime Node e un filesystem scrivibile per SQLite. **GitHub Pages non può eseguire Next.js** e non è una opzione valida. Anche le piattaforme serverless con filesystem effimero non sono adatte a SQLite persistente senza un database esterno.

Opzioni documentate:

```bash
# Docker (consigliato per una demo persistente)
docker compose up --build
```

Imposta `SESSION_SECRET` in `.env`. Il database vive nel volume `matchlab-data`; al primo avvio viene creato e popolato in modalità DEMO.

Vedi [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) per Docker, reverse proxy, backup, cron di sync e limiti delle varie piattaforme.

## Test

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

I test coprono proprietà del motore (matrice normalizzata, coerenza mercati, determinismo, dati mancanti, valutazione, combinazioni). Non esiste ancora una suite Playwright: è nella roadmap.

## Limiti

- Il motore usa solo i gol: xG, formazioni e indisponibili incidono sul punteggio di qualità, non ancora su λ.
- Le partite sono trattate come condizionatamente indipendenti; la correlazione tra eventi della stessa giornata non è modellata.
- Il modello non conosce meteo, arbitri, motivazioni, mercato o notizie.
- Le stime su campioni piccoli sono instabili; l'intervallo p10–p90 è una misura di sensibilità, non un intervallo di confidenza.
- Il provider reale non è stato validato con una chiave API in CI.
- Senza quote non è possibile calcolare valore atteso o ROI. MatchLab non li inventa.

## Licenza

MIT. I dati appartengono ai rispettivi fornitori e sono soggetti ai loro termini.

## Avvertenza

Le probabilità sono stime statistiche, non garanzie. Gli scenari possono comportare perdite. L'analisi non costituisce una raccomandazione finanziaria né garantisce risultati. Se il gioco d'azzardo è un problema, cerca supporto presso i servizi sanitari del tuo paese.
