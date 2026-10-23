import Link from "next/link";
import { BookOpen, FlaskConical, TriangleAlert } from "lucide-react";
import { APP, DISCLAIMER, MODEL, RISK_PROFILES, SAMPLE_WARNING_THRESHOLD } from "@/lib/config/constants";
import { Alert, Card, Disclaimer, PageHeader, SectionHeading } from "@/components/ui";

export const metadata = { title: "Metodologia e limiti" };

export default function MethodologyPage() {
  return (
    <div className="reveal">
      <PageHeader
        eyebrow="Metodologia"
        title="Come funziona il motore (e cosa non può fare)"
        description="Ogni numero mostrato da MatchLab deriva da un calcolo deterministico e verificabile. Nessun modello linguistico produce probabilità."
      />

      <div className="space-y-4">
        <Card className="p-5">
          <SectionHeading title="In una frase" />
          <p className="text-sm leading-relaxed text-muted">
            MatchLab stima la forza offensiva e difensiva delle squadre dai risultati passati, costruisce
            una distribuzione di probabilità sui punteggi (Poisson bivariato con correzione Dixon-Coles)
            e deriva da quella distribuzione tutti i mercati mostrati. Le probabilità sono stime, non
            previsioni certe e non quotazioni.
          </p>
          <p className="mt-3 text-xs leading-relaxed text-muted">
            Versione del motore: <strong>{MODEL.version}</strong>. Configurazione: half-life{" "}
            {MODEL.halfLifeDays} giorni, shrinkage {MODEL.shrinkageMatches} partite, ρ = {MODEL.rho},
            massimo {MODEL.maxGoals} gol per squadra nella matrice, {MODEL.uncertaintyIterations}{" "}
            simulazioni di sensibilità.
          </p>
        </Card>

        <Card className="p-5">
          <SectionHeading title="1. Dati" description="Solo ciò che la fonte fornisce." />
          <ul className="list-disc space-y-2 pl-5 text-xs leading-relaxed text-muted">
            <li>Risultati delle partite concluse, con data e competizione.</li>
            <li>
              Le partite senza risultato valido vengono escluse: un 0-0 inventato sarebbe un errore
              grave.
            </li>
            <li>
              Formazioni, indisponibili, statistiche e xG sono usati <strong>solo</strong> per il
              punteggio di qualità del dato in questa versione; non modificano ancora λ. È un limite
              dichiarato.
            </li>
            <li>
              Le fonti sono tracciate con timestamp e stato. Quando un dato manca, viene mostrato come
              non disponibile, non riempito con una stima plausibile.
            </li>
          </ul>
        </Card>

        <Card className="p-5">
          <SectionHeading title="2. Stima delle forze" description="Time decay + shrinkage + massima verosimiglianza." />
          <ol className="list-decimal space-y-2 pl-5 text-xs leading-relaxed text-muted">
            <li>
              Ogni partita riceve un peso esponenziale: dopo {MODEL.halfLifeDays} giorni pesa la metà.
              Le partite recenti contano di più, senza azzerare la storia.
            </li>
            <li>
              Le forze partono da 1 (media della competizione) e vengono stimate iterativamente
              massimizzando la verosimiglianza Poisson dei gol osservati.
            </li>
            <li>
              Lo shrinkage verso la media ({MODEL.shrinkageMatches} partite equivalenti) evita che una
              squadra con 2 partite sembri imbattibile. Più dati, meno shrinkage effettivo.
            </li>
            <li>
              Il vantaggio casa è incorporato nelle medie di gol casa/trasferta della competizione, non
              in un coefficiente arbitrario scelto a mano.
            </li>
          </ol>
          <p className="mt-3 text-[11px] leading-relaxed text-faint">
            Il sample minimo consigliato è {MODEL.minMatchesForReliableRating} partite per squadra. Sotto
            questa soglia la stima è rumorosa e il punteggio di qualità lo segnala.
          </p>
        </Card>

        <Card className="p-5">
          <SectionHeading title="3. Matrice dei punteggi e mercati" />
          <p className="text-xs leading-relaxed text-muted">
            Dati λ<sub>casa</sub> e λ<sub>ospite</sub>, la probabilità di ogni punteggio è il prodotto
            di due Poisson, corretta sui risultati bassi (0-0, 1-0, 0-1, 1-1) da Dixon-Coles con ρ ={" "}
            {MODEL.rho}. La matrice viene normalizzata. Da qui derivano 1X2, doppia chance, Over/Under
            1.5 e 2.5, Gol/No Gol e i risultati esatti.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            Le probabilità di mercati diversi sono <strong>correlate</strong>: per questo il generatore
            consente una sola leg per partita. Moltiplicare mercati della stessa partita come se fossero
            indipendenti sarebbe un errore statistico.
          </p>
        </Card>

        <Card className="p-5">
          <SectionHeading title="4. Incertezza" description="Sensibilità parametrica, non intervallo di confidenza." />
          <p className="text-xs leading-relaxed text-muted">
            Le forze vengono perturbate in scala logaritmica con sigma dipendente dal campione effettivo.
            Per ogni partita vengono generati {MODEL.uncertaintyIterations} scenari deterministici
            (stesso seme → stessi intervalli) e vengono riportati i quantili p10 e p90. È una misura di
            <strong> sensibilità del modello ai suoi input</strong>, non un intervallo di confidenza
            frequentista e non una garanzia che il valore vero sia dentro l&apos;intervallo.
          </p>
        </Card>

        <Card className="p-5">
          <SectionHeading title="5. Qualità del dato" description="Punteggio trasparente, non probabilità di vincita." />
          <ul className="list-disc space-y-1.5 pl-5 text-xs leading-relaxed text-muted">
            <li>45 punti: campione minimo tra le due squadre (20+ partite = pieno).</li>
            <li>15 punti: freschezza dell&apos;ultima partita osservata.</li>
            <li>15 punti: disponibilità di xG.</li>
            <li>15 punti: formazioni disponibili.</li>
            <li>10 punti: indisponibili/infortunati disponibili.</li>
          </ul>
          <p className="mt-2 text-[11px] leading-relaxed text-faint">
            Il punteggio non dice se una selezione è “sicura”. Dice quanto sono completi e recenti i dati
            che hanno prodotto la stima.
          </p>
        </Card>

        <Card className="p-5">
          <SectionHeading title="6. Generatore e profili" />
          <p className="text-xs leading-relaxed text-muted">
            Il generatore filtra le selezioni per probabilità minima, qualità minima e presenza di
            intervallo, poi cerca combinazioni con una beam search limitata. Vincoli: una leg per
            partita, massimo leg per competizione, soglie esplicite. Se non esce nulla, restituisce
            “insufficiente” e mostra i motivi: non abbassa le soglie.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {Object.values(RISK_PROFILES).map((profile) => (
              <div key={profile.id} className="rounded-xl border border-line bg-surface2/30 p-3">
                <p className="text-xs font-semibold">{profile.label}</p>
                <p className="mt-1 text-[10px] leading-relaxed text-muted">{profile.description}</p>
                <p className="mt-1.5 text-[10px] text-faint">
                  Soglia {(profile.minLegProbability * 100).toFixed(0)}% · qualità ≥{" "}
                  {profile.minDataQuality}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-faint">
            Il punteggio di ranking combina probabilità, qualità e incertezza. Non è un rendimento atteso:
            senza quote non è possibile calcolare un valore atteso.
          </p>
        </Card>

        <Card className="p-5">
          <SectionHeading title="7. Valutazione" />
          <p className="text-xs leading-relaxed text-muted">
            Il tracker calcola Brier score e log loss sulle leg binarie risolte, più l&apos;errore di
            calibrazione su bin di probabilità. Le previsioni annullate o non risolte sono escluse e
            conteggiate separatamente. Con meno di {SAMPLE_WARNING_THRESHOLD} osservazioni viene mostrato
            un avviso: un campione piccolo non dimostra capacità predittiva.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            Il benchmark nella pagina tracker usa previsioni sintetiche generate al seed su partite DEMO
            concluse. Serve a verificare che il metodo di valutazione funzioni, non a stimare la qualità
            su dati reali.
          </p>
        </Card>

        <section id="fonti">
          <Card className="p-5">
            <SectionHeading title="8. Fonti e limiti" />
            <ul className="list-disc space-y-2 pl-5 text-xs leading-relaxed text-muted">
              <li>
                Modalità predefinita: dataset <strong>DEMO sintetico</strong> (competizioni e squadre
                inventate). Nessun dato reale.
              </li>
              <li>
                Provider reale opzionale: football-data.org v4, piano gratuito. Include calendario e
                risultati; <strong>non</strong> include formazioni, indisponibili o xG nel piano
                gratuito.
              </li>
              <li>Nessun dato di quote: MatchLab non mostra e non inventa quote.</li>
              <li>
                Il modello non conosce meteo, arbitri, motivazioni, mercato, notizie dell&apos;ultima ora
                o cambi di allenatore.
              </li>
              <li>
                Il modello assume che le partite siano condizionatamente indipendenti. Non modella la
                correlazione tra partite della stessa giornata.
              </li>
              <li>
                Le stime su campioni piccoli sono instabili. La direzione dell&apos;errore non è nota.
              </li>
            </ul>
            <p className="mt-3 text-xs text-muted">
              Dettaglio delle fonti:{" "}
              <Link href="/sources" className="text-accent-text hover:underline">
                pagina Fonti
              </Link>
              .
            </p>
          </Card>
        </section>

        <Alert tone="warn" title="Limite fondamentale">
          <p>
            Nessun modello statistico può prevedere con certezza il risultato di una partita di calcio.
            Le probabilità descrivono l&apos;incertezza, non la eliminano. Un evento con probabilità 70%
            accade comunque il 30% delle volte.
          </p>
        </Alert>

        <div className="flex items-start gap-2 rounded-xl border border-line bg-surface2/20 p-3 text-[10px] leading-relaxed text-muted">
          <FlaskConical className="mt-0.5 size-3.5 shrink-0 text-accent" aria-hidden />
          <p>
            Test automatici del motore: proprietà della matrice (somma 1), coerenza dei mercati,
            determinismo, gestione dei dati mancanti, metriche di valutazione e beam search. Esegui{" "}
            <code>npm test</code> per riprodurli.
          </p>
        </div>

        <div className="flex items-start gap-2 rounded-xl border border-line bg-surface2/20 p-3 text-[10px] leading-relaxed text-muted">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-warn" aria-hidden />
          <p>{DISCLAIMER}</p>
        </div>

        <div className="flex items-start gap-2 rounded-xl border border-line bg-surface2/20 p-3 text-[10px] leading-relaxed text-muted">
          <BookOpen className="mt-0.5 size-3.5 shrink-0 text-info" aria-hidden />
          <p>
            Documentazione tecnica completa nel repository: <code>docs/MODEL.md</code>,{" "}
            <code>docs/ARCHITECTURE.md</code>, <code>docs/DATA_SOURCES.md</code>. Versione app{" "}
            {APP.version}.
          </p>
        </div>
      </div>

      <div className="mt-6">
        <Disclaimer />
      </div>
    </div>
  );
}
