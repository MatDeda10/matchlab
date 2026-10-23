# Roadmap

La roadmap è ordinata per valore reale, non per numero di funzionalità. Ogni voce deve mantenere i principi: determinismo, trasparenza, nessuna scommessa.

## Fatto

- [x] Next.js 16 + React 19 + TypeScript strict + Tailwind 4
- [x] Tema scuro/chiaro con preferenza persistente
- [x] Design system accessibile e responsive
- [x] SQLite nativo con migrazioni versionate e repository tipizzati
- [x] Dataset DEMO sintetico completo (competizioni, squadre, giocatori, partite, formazioni, indisponibili)
- [x] Motore Poisson + Dixon-Coles con time decay e shrinkage
- [x] Mercati 1X2, doppia chance, O/U 1.5 e 2.5, BTTS, risultati esatti
- [x] Incertezza Monte Carlo deterministica
- [x] Punteggio di qualità del dato con motivazioni
- [x] Generatore con profili, soglie, beam search e motivi di esclusione
- [x] Confronto scenari (fino a 4)
- [x] Tracker con Brier, log loss, calibrazione, risoluzione e annullamento
- [x] Sessione anonima firmata, CSRF, body limit, rate limit
- [x] Provider astratto + adapter football-data.org con cache/retry/timeout
- [x] API route con validazione Zod
- [x] Pagine metodologia, fonti, privacy, termini
- [x] Test del motore con Vitest
- [x] Docker con volume persistente e seed al primo avvio
- [x] Documentazione tecnica

## Prossimo (priorità alta)

- [ ] **Test end-to-end Playwright** su flussi reali: filtro partite, registrazione previsione, generazione scenario, salvataggio, risoluzione, cancellazione dati.
- [ ] **Validazione del provider reale** con una chiave API: mappatura stati, fusi orari, partite rinviate, risultati mancanti.
- [ ] **Backtest onesto su dati reali**: split temporale, baseline (frequenze di competizione), metriche per mercato, intervalli bootstrap.
- [ ] **Aggiornamento automatico dello stato partite**: passaggio SCHEDULED → IN_PLAY → FINISHED senza intervento manuale, con timestamp della fonte.
- [ ] **Migrazione a Postgres opzionale**: adapter repository per deploy serverless, senza cambiare il motore.
- [ ] **CSP con nonce** al posto di `unsafe-inline`.

## Miglioramenti al modello

- [ ] Usare xG nel fitting quando disponibile, con peso dichiarato e fallback ai gol.
- [ ] Formazioni e indisponibili come feature (gerarchia bayesiana o aggiustamento esplicito di λ), con impatto misurato.
- [ ] Modellare la correlazione tra partite della stessa giornata (campionamento con fattore comune).
- [ ] Calibrazione out-of-sample (isotonic/Platt) con versionamento separato e trasparente.
- [ ] Gerarchia tra competizioni e promozioni/retrocessioni.
- [ ] Gestione delle partite con squadre nuove (prior informativo, non 1.0 arbitrario).
- [ ] Intervalli che includano incertezza strutturale, non solo parametrica.
- [ ] Test di proprietà più estesi (monotonicità, somme, edge case).

## Prodotto

- [ ] Confronto tra versioni del modello sullo stesso insieme di partite.
- [ ] Export CSV/JSON delle proprie previsioni e scenari.
- [ ] Filtri avanzati (qualità minima, solo competizioni preferite, intervallo di incertezza).
- [ ] Accessibilità: audit completo con screen reader e tastiera, test axe.
- [ ] Internazionalizzazione (IT/EN) con stringhe centralizzate.
- [ ] Notifiche locali opzionali per il kickoff (senza email).
- [ ] Modalità "solo dati reali" che nasconde il DEMO quando il provider è configurato.

## Esplicitamente fuori scope

- Quote, odds, scommesse, depositi, prelievi.
- Suggerimenti di puntata, stake, ROI, "value bet".
- Marketing che prometta vincite o urgenza.
- LLM che generi probabilità.
- Raccolta di dati personali non necessari.
- Qualsiasi funzione che faciliti l'inseguimento delle perdite.

## Come contribuire

1. Apri una issue descrivendo il problema e l'impatto sui principi.
2. Per modifiche al modello, includi test e una nota in `docs/MODEL.md`.
3. Per nuovi provider, documenta quota e limiti in `docs/DATA_SOURCES.md`.
4. Esegui `npm run verify` prima della pull request.
