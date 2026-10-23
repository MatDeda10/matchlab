# Accessibilità e QA manuale

Checklist da eseguire prima di una release. Non sostituisce i test automatici.

## Tastiera

- [ ] Skip link visibile al focus.
- [ ] Navigazione sidebar e bottom nav raggiungibile con Tab.
- [ ] Menu mobile: apertura, focus, chiusura con Esc.
- [ ] Form del generatore: tutti i controlli raggiungibili e con label.
- [ ] Tab della pagina partita raggiungibili e con `aria-current`.
- [ ] Nessun focus trap inatteso.

## Screen reader

- [ ] Ogni grafico ha una descrizione testuale o una tabella alternativa.
- [ ] I badge di stato non sono l'unico modo per comunicare il risultato.
- [ ] Messaggi toast annunciati (`role="status"`).
- [ ] Errori di form associati ai campi.

## Tema e contrasto

- [ ] Testo leggibile in dark e light.
- [ ] Focus visibile in entrambi i temi.
- [ ] Nessun contenuto che dipenda solo dal colore.

## Responsive

- [ ] 360 px: nessun overflow orizzontale.
- [ ] 768 px: griglie a 2 colonne leggibili.
- [ ] 1280 px: sidebar fissa e contenuti centrati.
- [ ] Tabelle con scroll orizzontale controllato.

## Dati e onestà

- [ ] DEMO etichettato ovunque.
- [ ] Formazioni: distinzione OFFICIAL / PROBABLE / MODEL.
- [ ] Dati mancanti mostrati come non disponibili.
- [ ] Quote mancanti mostrate come “non disponibile”, mai inventate o interpolate.
- [ ] Quote chiaramente indicate come pre-partita o di chiusura, non live.
- [ ] Bookmaker mostrati solo come attribuzione: nessun link, logo, bonus o codice affiliato.
- [ ] Nessun ROI, valore atteso, stake o promessa di rendimento.
- [ ] Previsioni concluse non mostrate come live.
- [ ] Disclaimer presente nelle pagine principali.

## Flussi

- [ ] Filtro partite per data, squadra, competizione, stato.
- [ ] Dettaglio partita: tab Mercato con quote, probabilità implicita, consenso e overround.
- [ ] Generatore: chip quota migliore con bookmaker; fallback “non disponibile”.
- [ ] Registrazione previsione → tracker → annullamento prima del kickoff.
- [ ] Generazione scenario → salvataggio → confronto → eliminazione.
- [ ] Modifica preferenze → ricarica → persistenza.
- [ ] Eliminazione dati → cookie invalidato → dati assenti.
- [ ] `npm run db:seed:real` su DB vuoto → dashboard e pagine popolate.
- [ ] Avvio con DB vuoto e `DATA_PROVIDER=football-data-uk` → snapshot importato senza rete.
