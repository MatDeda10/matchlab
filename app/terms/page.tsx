import Link from "next/link";
import { Scale, ShieldAlert } from "lucide-react";
import { APP, DISCLAIMER } from "@/lib/config/constants";
import { Card, Disclaimer, PageHeader, SectionHeading } from "@/components/ui";

export const metadata = { title: "Termini d'uso" };

export default function TermsPage() {
  return (
    <div className="reveal">
      <PageHeader
        eyebrow="Termini"
        title="Condizioni d'uso"
        description="MatchLab è uno strumento di analisi statistica e un progetto dimostrativo. Non è un servizio di scommesse."
      />

      <div className="space-y-4">
        <Card className="p-5">
          <SectionHeading title="1. Natura del servizio" />
          <p className="text-xs leading-relaxed text-muted">
            MatchLab fornisce stime probabilistiche, scenari combinati e strumenti di valutazione della
            calibrazione. Non accetta depositi, non gestisce denaro e non consente di piazzare scommesse.
            Le quote eventualmente mostrate sono dati di mercato provenienti dalla fonte pubblica
            indicata, riportati solo come contesto informativo: non sono offerte, non sono live e non
            costituiscono promozione di bookmaker o invito al gioco. Nessuna funzione dell&apos;app
            costituisce un consiglio di scommessa, finanziario o di investimento.
          </p>
        </Card>

        <Card className="p-5">
          <SectionHeading title="2. Nessuna garanzia di risultato" />
          <p className="text-xs leading-relaxed text-muted">
            Le probabilità sono stime basate su modelli statistici e dati che possono essere incompleti,
            errati o obsoleti. Non garantiscono il verificarsi di alcun evento. I risultati passati non
            predicono quelli futuri. L&apos;uso delle informazioni è a tuo rischio.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            In particolare: non esiste alcuna “vincita garantita”, alcuna strategia infallibile e alcun
            metodo per eliminare l&apos;incertezza. Diffida di chi afferma il contrario.
          </p>
        </Card>

        <Card className="p-5">
          <SectionHeading title="3. Uso consentito" />
          <ul className="list-disc space-y-1.5 pl-5 text-xs leading-relaxed text-muted">
            <li>Uso personale, studio e sperimentazione.</li>
            <li>Nessun uso per attività illegali o per violare termini di terze parti.</li>
            <li>Nessun tentativo di aggirare rate limit, autenticazione o misure di sicurezza.</li>
            <li>Nessun uso automatizzato massivo che possa danneggiare il servizio o il provider dati.</li>
            <li>Nessuna rivendita dei dati del provider in violazione dei suoi termini.</li>
          </ul>
        </Card>

        <Card className="p-5">
          <SectionHeading title="4. Dati e disponibilità" />
          <p className="text-xs leading-relaxed text-muted">
            Il servizio può essere modificato, sospeso o interrotto senza preavviso, soprattutto nelle
            deployment gratuite. I dati possono essere azzerati. Non c&apos;è alcun SLA. Le fonti esterne
            possono cambiare limiti, condizioni o disponibilità.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            In modalità DEMO tutti i dati sono sintetici e non rappresentano eventi reali. Non usare il
            dataset DEMO per decisioni su partite reali.
          </p>
        </Card>

        <Card className="p-5">
          <SectionHeading title="5. Limitazione di responsabilità" />
          <p className="text-xs leading-relaxed text-muted">
            Nella misura massima consentita dalla legge, gli autori non sono responsabili per perdite,
            danni o conseguenze derivanti dall&apos;uso o dall&apos;impossibilità di usare l&apos;app,
            incluse perdite economiche legate a decisioni prese sulla base delle stime. Il software è
            fornito “così com&apos;è”, senza garanzie di alcun tipo.
          </p>
        </Card>

        <Card className="p-5">
          <SectionHeading title="6. Proprietà intellettuale" />
          <p className="text-xs leading-relaxed text-muted">
            Il codice di MatchLab è distribuito con licenza MIT (vedi repository). I dati appartengono ai
            rispettivi fornitori e sono soggetti ai loro termini. Il nome e il logo non implicano
            affiliazione con competizioni, club o provider.
          </p>
        </Card>

        <Card className="p-5">
          <SectionHeading title="7. Modifiche" />
          <p className="text-xs leading-relaxed text-muted">
            Questi termini possono essere aggiornati insieme al software. La versione applicabile è quella
            pubblicata in questa pagina. Versione app: {APP.version}. Repository:{" "}
            <Link href={APP.repoUrl} className="text-accent-text hover:underline" target="_blank" rel="noreferrer">
              {APP.repoUrl}
            </Link>
            .
          </p>
        </Card>

        <div className="flex items-start gap-2 rounded-xl border border-warn/20 bg-warn/5 p-3 text-[11px] leading-relaxed text-warn">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>{DISCLAIMER}</p>
        </div>

        <div className="flex items-start gap-2 rounded-xl border border-line bg-surface2/20 p-3 text-[10px] leading-relaxed text-muted">
          <Scale className="mt-0.5 size-3.5 shrink-0 text-info" aria-hidden />
          <p>
            Se il gioco d&apos;azzardo è un problema per te o per qualcuno che conosci, cerca supporto
            presso i servizi sanitari del tuo paese. MatchLab non promuove né facilita il gioco
            d&apos;azzardo.
          </p>
        </div>
      </div>

      <div className="mt-6">
        <Disclaimer compact />
      </div>
    </div>
  );
}
