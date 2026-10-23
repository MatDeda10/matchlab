# Fonti dati

## Principi

1. Un dato mancante resta mancante: si mostra `UNAVAILABLE`, non si inventa.
2. Ogni record ha una fonte e un timestamp (`source_metadata` per le sincronizzazioni).
3. Le stime del modello sono etichettate come stime, mai come osservazioni.
4. Nessuna quota viene mostrata o simulata.
5. La modalità DEMO è sempre dichiarata nella UI.

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

**Limitazione:** il dataset DEMO non ha valore informativo sul calcio reale. Le metriche del tracker su dati DEMO misurano il funzionamento del metodo, non la qualità predittiva.

---

## football-data.org v4 (opzionale)

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
5. Aggiungere il mapping in `lib/services/sync.ts` se il provider è persistibile.
6. Documentare quota, condizioni e limiti in questo file e nella pagina `/sources`.
7. Aggiungere test per gli schemi e per i casi `UNAVAILABLE`.

---

## Cosa non è una fonte

- Quote e odds: nessuna, nemmeno “simulate”.
- Social media, notizie non verificate, voci di mercato.
- Dati personali degli utenti.
- Stime presentate come misurazioni.
