# Fonti dati

## Principi

1. Un dato mancante resta mancante: si mostra `UNAVAILABLE`, non si inventa.
2. Ogni record ha una fonte e un timestamp (`source_metadata` per le sincronizzazioni).
3. Le stime del modello sono etichettate come stime, mai come osservazioni.
4. Le quote sono solo quelle osservate nella fonte pubblica. Non vengono simulate, interpolate o presentate come live.
5. La modalità DEMO è sempre dichiarata nella UI.
6. I nomi dei bookmaker sono attribuzione della fonte: nessun logo, link, bonus o affiliazione.

---

## Provider reale gratuito: football-data.co.uk + OpenFootball

`DATA_PROVIDER=football-data-uk` (alias: `open-data`).

Adapter: `lib/api/football-data-uk/`.

### Competizioni

| Codice | Competizione | Fuso orario |
| --- | --- | --- |
| `I1` | Serie A | `Europe/Rome` |
| `E0` | Premier League | `Europe/London` |
| `E1` | Championship | `Europe/London` |
| `SP1` | LaLiga | `Europe/Madrid` |
| `D1` | Bundesliga | `Europe/Berlin` |
| `F1` | Ligue 1 | `Europe/Paris` |

### Fonti e endpoint

| Fonte | Dato | URL / formato |
| --- | --- | --- |
| football-data.co.uk | Risultati, statistiche, quote | `https://www.football-data.co.uk/mmz4281/{stagione}/{codice}.csv` |
| football-data.co.uk | Partite future con quote | `https://www.football-data.co.uk/fixtures.csv` |
| OpenFootball (CC0) | Calendario stagione corrente | `https://raw.githubusercontent.com/openfootball/football.json/master/{stagione}/{competizione}.json` |

- La stagione è indicata con quattro cifre, ad esempio `2627` per 2026/27.
- Lo storico predefinito è di **3 stagioni**, configurabile con `FOOTBALL_DATA_UK_HISTORY_SEASONS=1..5`.
- `fixtures.csv` è complementare e copre solo un sottoinsieme di competizioni: non è garantito che contenga Serie A o tutte le partite future.
- OpenFootball viene usato per completare il calendario, non per sovrascrivere risultati già presenti.

### Dati importati

| Entità | Campi |
| --- | --- |
| Competizioni | nome, paese, codice, tier |
| Squadre | nome canonico, nome breve, colore quando disponibile |
| Partite | data/ora UTC, stagione, giornata, stato, gol, stadio |
| Statistiche | tiri, tiri in porta, possesso, xG se presente nel CSV |
| Quote | 1X2 e Over/Under 2.5, pre-partita o di chiusura |

Le date locali vengono convertite in UTC con il fuso della competizione. I nomi squadra sono normalizzati con alias espliciti e fuzzy matching prudente (`lib/api/football-data-uk/teams.ts`): in caso di dubbio prevale un nome in più, non un accostamento sbagliato.

### Quote: cosa viene salvato

Per contenere dimensione e rumore, per ogni selezione vengono salvate **due sintesi**, non tutte le colonne bookmaker:

| Bookmaker logico | Significato |
| --- | --- |
| `BEST` | Quota più alta tra i bookmaker tracciati; `bookmaker_label` contiene il nome reale del bookmaker |
| `AVG` | Media di mercato: colonna `Avg` della fonte oppure media dei bookmaker disponibili |

- Mercati: `1X2` (HOME/DRAW/AWAY) e `OU25` (OVER/UNDER).
- Le quote di chiusura sono preferite a quelle pre-partita quando presenti.
- Le quote vengono importate **solo per la stagione corrente**. Risultati e statistiche restano su 3 stagioni per alimentare il modello.
- Non sono disponibili quote live, in-play, handicap, risultato esatto o altri mercati.
- Se la fonte non contiene una quota, la UI mostra “non disponibile”. Non viene inventata.
- La copertura varia per partita e competizione; `fixtures.csv` può non includere una competizione.

I nomi dei bookmaker sono mostrati solo per attribuire la quota. Non ci sono link, loghi, bonus, codici affiliati o inviti al gioco. MatchLab non calcola ROI, valore atteso o convenienza.

### Snapshot incluso

Il repository contiene `data/real/snapshot.json.gz.b64`: JSON compresso con gzip e codificato in base64. Contiene:

| Entità | Quantità indicativa |
| --- | --- |
| Competizioni | 6 |
| Squadre | 145 |
| Partite | 6.912 |
| Statistiche | 5.085 |
| Sintesi quote | 4.780 |

- `npm run db:seed:real` importa lo snapshot nel DB (azzera prima, salvo `--no-reset`).
- Con `DATA_PROVIDER=football-data-uk` e DB vuoto, lo snapshot viene importato automaticamente.
- `npm run data:snapshot` riscarica i dati e riscrive lo snapshot.
- `REAL_SNAPSHOT_PATH` permette di usare un file `.json`, `.json.gz` o `.json.gz.b64` alternativo.
- Lo snapshot non è una garanzia di aggiornamento: per dati freschi usare `npm run sync`.

### Protezioni nell'adapter

| Protezione | Valore |
| --- | --- |
| Cache SQLite | 6 ore per risposta |
| Rate limit locale | richieste sequenziali con margine conservativo |
| Timeout | 25 secondi per richiesta |
| Retry | 2 tentativi con backoff su errori transitori |
| Parser CSV | tollerante a BOM, CRLF, campi quotati e colonne opzionali |
| Errori | messaggio esplicito, nessun dato parziale spacciato per completo |

`FOOTBALL_DATA_UK_FORCE=1` ignora la cache HTTP.

### Flusso di sincronizzazione

```text
getSyncBundle()
  → download CSV stagionali + fixtures.csv + calendario OpenFootball
  → parsing e normalizzazione nomi/date
  → upsert competitions, teams, fixtures, fixture_statistics
  → replaceOddsForProvider (BEST + AVG)
  → source_metadata con esito e timestamp
```

`npm run sync` usa lo stesso bundle. Se il download fallisce, l'app continua a mostrare ciò che è già nel database; non viene eseguita una cancellazione distruttiva.

---

## DEMO (default)

`DATA_PROVIDER=demo` (o assente).

| Entità | Quantità | Natura |
| --- | --- | --- |
| Competizioni | 4 | Inventate: Lega Aurora, Premier Albion, Liga Solar, Bundes Nord |
| Squadre | 48 | Inventate |
| Giocatori | 864 | Inventati |
| Partite | 2.640 | Sintetiche, relative al giorno del seed |
| Formazioni | 176 | Sintetiche |
| Previsioni benchmark | ~30–40 | Sintetiche, risolte; il numero dipende dalla data del seed |

Caratteristiche:

- Date relative a `new Date()` al momento del seed: se il tempo passa, rigenerare con `npm run db:seed`.
- Formazioni: `OFFICIAL` per partite concluse/in corso, `PROBABLE` entro 1,5 giorni, `MODEL` altrimenti. La distinzione è mantenuta in UI.
- Alcune partite hanno indisponibili e statistiche sintetiche per esercitare la UI.
- Il generatore di dataset è in `lib/demo/dataset.ts`; il seed in `lib/demo/seed.ts`.
- La capability `odds` è dichiarata, ma il dataset DEMO non contiene quote: la UI mostra “non disponibile”.

**Limitazione:** il dataset DEMO non ha valore informativo sul calcio reale. Le metriche del tracker su dati DEMO misurano il funzionamento del metodo, non la qualità predittiva.

---

## football-data.org v4 (opzionale, con chiave)

`DATA_PROVIDER=football-data` + `FOOTBALL_DATA_API_KEY`.

Adapter: `lib/api/football-data.ts`.

### Endpoint usati

| Metodo | Scopo |
| --- | --- |
| `GET /v4/competitions` | Competizioni disponibili per la chiave |
| `GET /v4/competitions/{code}/matches?dateFrom=&dateTo=` | Calendario e risultati |
| `GET /v4/matches/{id}` | Dettaglio partita |

Non vengono chiamati endpoint inesistenti o non documentati. Se un dato non è esposto dal piano gratuito, l'adapter restituisce `UNAVAILABLE` con motivazione.

### Quota e condizioni (piano gratuito)

- Costo: 0 €.
- Limite dichiarato: **10 richieste/minuto**.
- Competizioni incluse: 12 (il set esatto dipende dal piano; l'app usa `FOOTBALL_DATA_COMPETITIONS`).
- Risultati con ritardo (non live in tempo reale).
- Formazioni, infortuni/squalifiche, statistiche avanzate e xG **non inclusi**.
- Quote **non incluse**.

Le condizioni possono cambiare: verificare sempre il sito ufficiale del provider. MatchLab non garantisce gratuità perpetua né disponibilità.

### Protezioni nell'adapter

| Protezione | Valore |
| --- | --- |
| Cache SQLite | 6 ore per risposta |
| Rate limit locale | 8 richieste/minuto (margine sotto 10) |
| Timeout | 10 secondi per richiesta |
| Retry | backoff su errori transitori |
| Body | validato con Zod |
| Errori | messaggio esplicito, nessun dato parziale spacciato per completo |

### Mapping

| Provider | MatchLab |
| --- | --- |
| `competition.code` | `fd-{code}` |
| `match.id` | `fd-{id}` |
| `team.id` | `fd-team-{id}` |
| `status` | `SCHEDULED`, `IN_PLAY`, `FINISHED`, `POSTPONED`, `CANCELLED` |
| `score.fullTime` | gol casa/ospite |

Le squadre vengono derivate dai fixture (il piano gratuito non espone un endpoint squadre affidabile). La sincronizzazione è in `lib/services/sync.ts` / `npm run sync`.

### Flusso di sincronizzazione

```text
getCompetitions() → upsert competitions
getFixtures(from, to) → upsert teams + fixtures
source_metadata ← esito e timestamp
```

Se il calendario non è disponibile, viene registrato `UNAVAILABLE` e l'app continua a mostrare ciò che è già nel database. Non viene eseguita alcuna cancellazione distruttiva.

---

## Aggiungere un provider

1. Implementare `FootballDataProvider` in `lib/api/`.
2. Dichiarare `capabilities` con onestà (true solo se il dato è realmente disponibile).
3. Usare `ok()` / `unavailable()` per i risultati.
4. Aggiungere il factory in `lib/api/index.ts`.
5. Implementare `getSyncBundle()` se il provider può fornire più entità in un colpo.
6. Aggiungere il mapping in `lib/services/sync.ts` se il provider è persistibile.
7. Documentare quota, condizioni e limiti in questo file e nella pagina `/sources`.
8. Aggiungere test per parser, alias, quote e casi `UNAVAILABLE`.

---

## Cosa non è una fonte

- Quote simulate, stimate o “a scopo illustrativo”.
- Quote live o in-play.
- Social media, notizie non verificate, voci di mercato.
- Dati personali degli utenti.
- Stime presentate come misurazioni.
