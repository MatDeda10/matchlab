# Modello probabilistico

Versione: **`poisson-dc-1.0.0`**
Codice: `engine/ratings.ts`, `engine/poisson.ts`, `engine/markets.ts`, `engine/uncertainty.ts`, `engine/quality.ts`, `engine/model.ts`.

Tutti i parametri sono in `lib/config/constants.ts` (`MODEL`). Ogni cambiamento sostanziale deve incrementare la versione e aggiungere un record in `model_versions`.

---

## 1. Dati di input

Per ogni competizione vengono usate le partite `FINISHED` con gol validi, fino alla data di riferimento della partita da stimare (`kickoffUtc`). Questo evita **data leakage**: una partita non usa risultati futuri.

Non vengono inventati 0-0 per partite senza risultato.

## 2. Pesi temporali

Per una partita giocata `d` giorni prima della data di riferimento:

```text
w = exp(-ln(2) * d / halfLife)        halfLife = 180 giorni
```

Una partita di 180 giorni fa pesa 0,5; una di 360 giorni fa 0,25.

## 3. Forze delle squadre

Per la squadra `i` nella competizione `c`:

- `attack_i`: forza offensiva relativa (1 = media)
- `defence_i`: debolezza difensiva relativa (1 = media; >1 concede più della media)

I gol attesi:

```text
λ_home = leagueHomeGoals * attack_home * defence_away
λ_away = leagueAwayGoals * attack_away * defence_home
```

`leagueHomeGoals` e `leagueAwayGoals` sono le medie pesate della competizione: il vantaggio casa è quindi **osservato**, non un coefficiente arbitrario.

### Stima

Le forze sono stimate massimizzando la log-verosimiglianza Poisson pesata:

```text
LL = Σ w_k [ g_k log λ_k − λ_k ]
```

La stima usa aggiornamenti moltiplicativi iterativi (IPF): a ogni iterazione `attack_i` e `defence_i` vengono moltiplicati per il rapporto tra gol osservati e gol attesi. Dopo ogni iterazione la media geometrica di `attack` viene normalizzata a 1 e `defence` viene compensata con la stessa costante, così i λ restano invariati e il modello resta identificabile.

Alla fine viene applicato uno shrinkage verso 1:

```text
pseudo-partite = 6
attack_final  = 1 + (n / (n + 6)) * (attack_raw  − 1)
defence_final = 1 + (n / (n + 6)) * (defence_raw − 1)
```

dove `n` è il numero di partite equivalenti (pesate nel tempo). Lo shrinkage riduce l'instabilità per campioni piccoli. I valori sono limitati nell'intervallo `[0.35, 2.8]`; numero di iterazioni e clamp sono nel codice (`engine/ratings.ts`).

## 4. Matrice dei punteggi

Per `h, a ∈ [0, 10]`:

```text
P(h, a) = Poisson(h; λ_home) * Poisson(a; λ_away) * τ(h, a)
```

Correzione Dixon-Coles sui punteggi bassi con `ρ = −0.06`:

| (h, a) | τ |
| --- | --- |
| 0,0 | 1 − λ_home λ_away ρ |
| 0,1 | 1 + λ_home ρ |
| 1,0 | 1 + λ_away ρ |
| 1,1 | 1 − ρ |
| altro | 1 |

La matrice viene normalizzata perché la somma sia 1 (troncamento a 10 gol inclusa).

## 5. Mercati

Dalla matrice normalizzata:

- **1X2**: somma su `h>a`, `h=a`, `h<a`.
- **Doppia chance**: somme degli esiti.
- **Over 1.5 / 2.5**: `P(h+a > linea)`.
- **Under**: complemento.
- **Gol/No Gol**: `P(h≥1 ∧ a≥1)`.
- **Risultati esatti**: celle della matrice.

Le probabilità di mercati diversi sulla stessa partita sono **correlate**. Per questo:

- il generatore consente una sola leg per partita;
- il tracker valuta le leg come binarie, non assume indipendenza tra mercati della stessa partita;
- la probabilità congiunta di uno scenario moltiplica leg di **partite diverse**, assumendo indipendenza condizionata (assunzione dichiarata).

## 6. Incertezza

Le forze `attack`/`defence` vengono perturbate in scala logaritmica:

```text
attack' = attack * exp(σ * z)        z ~ N(0,1)
```

con

```text
σ = clamp(0.22 / sqrt(max(effectiveSample,1)/10), 0.05, 0.26)
```

Per ogni partita vengono generate 400 repliche con PRNG deterministico (seed = hash del fixture id). Vengono riportati p10, p50, p90 e lo spread `p90 − p10`.

**Non è un intervallo di confidenza frequentista.** È una misura di sensibilità del modello ai suoi input. Le repliche non includono incertezza strutturale (scelta del modello, dati mancanti, eventi imprevedibili).

## 7. Qualità del dato

| Componente | Punti |
| --- | --- |
| Campione minimo tra le due squadre | 0–45 |
| Freschezza ultima partita | 0–15 |
| xG disponibile | 0–15 |
| Formazioni disponibili | 0–15 |
| Indisponibili disponibili | 0–10 |

Il punteggio (0–100) è mostrato con le ragioni e i dati mancanti. **Non è una probabilità di vincita** e non modifica λ in questa versione.

## 8. Generatore di scenari

Dato l'insieme dei candidati:

1. filtro per probabilità minima del profilo;
2. filtro per qualità minima;
3. filtro temporale (`kickoff > now`);
4. massimo 4 candidati per partita, una leg per partita;
5. beam search (larghezza 350) con punteggio:

```text
score = log P(congiunta) − penalità_incertezza * spread_medio
        + 0.25 * ((qualità_media − 50) / 50)
```

6. limite di leg per competizione;
7. se non ci sono abbastanza gruppi, stato `INSUFFICIENT` con motivi.

Il punteggio di ranking **non è un rendimento atteso**. Senza quote non esiste un valore atteso calcolabile.

## 9. Valutazione

Per ogni leg risolta con probabilità `p` ed esito `y ∈ {0,1}`:

```text
Brier = (p − y)²
LogLoss = −[y log p + (1−y) log(1−p)]
```

Per l'1X2 (una previsione per partita):

```text
Brier_multiclass = Σ (p_i − y_i)²
LogLoss_multiclass = −log p_esito
```

Calibrazione: 10 bin di probabilità, confronto tra media prevista e frequenza osservata; errore = media della distanza assoluta pesata per il numero di osservazioni.

Le previsioni `OPEN` e `VOID` sono escluse e conteggiate a parte. Con meno di 30 osservazioni viene mostrato un avviso di campione insufficiente.

**Benchmark DEMO**: circa 30–40 previsioni sintetiche su partite DEMO concluse, create al seed (il numero dipende dalla data di esecuzione). Serve a verificare il funzionamento delle metriche, non a dimostrare capacità predittiva.

## 10. Determinismo e riproducibilità

- Nessun `Math.random()` nel calcolo delle probabilità.
- L'incertezza usa un PRNG con seed derivato dal fixture id.
- L'ordine dei dati è stabilizzato dalle query (`ORDER BY`).
- La versione del modello è salvata in ogni previsione e scenario.

## 11. Limiti noti

- Solo gol: xG, formazioni e indisponibili non modificano λ (solo la qualità).
- Nessuna correlazione tra partite della stessa giornata.
- Nessun effetto di meteo, arbitri, motivazioni, infortuni dell'ultimo minuto, mercato.
- Pochi dati → stime instabili; lo shrinkage riduce ma non elimina il problema.
- Il calcio è un processo a bassa frequenza di eventi: piccoli campioni producono molta varianza.
- Il modello non è stato validato su dati reali in CI.

## 12. Come modificare il modello

1. Cambia i parametri in `lib/config/constants.ts` e/o il codice in `engine/`.
2. Incrementa `MODEL.version` (semver).
3. Aggiungi test che coprano la modifica (proprietà, non solo snapshot).
4. Rigenera le previsioni DEMO con `npm run db:seed`.
5. Registra la configurazione in `model_versions` (il seed lo fa per la versione corrente).
6. Aggiorna questo documento e `/methodology`.

Non introdurre mai una modifica che renda le probabilità dipendenti da un LLM o da dati non tracciati.
