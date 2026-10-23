import Link from "next/link";
import { Cookie, Lock, Trash2 } from "lucide-react";
import { APP } from "@/lib/config/constants";
import { Card, Disclaimer, PageHeader, SectionHeading } from "@/components/ui";

export const metadata = { title: "Privacy e cookie" };

export default function PrivacyPage() {
  return (
    <div className="reveal">
      <PageHeader
        eyebrow="Privacy"
        title="Nessun account, nessun dato personale"
        description="MatchLab funziona con una sessione anonima firmata. Non chiede email, nome, telefono o credenziali."
      />

      <div className="space-y-4">
        <Card className="p-5">
          <SectionHeading title="Cosa viene salvato" />
          <ul className="list-disc space-y-2 pl-5 text-xs leading-relaxed text-muted">
            <li>
              Un identificativo casuale di sessione (UUID) in un cookie <code>ml_session</code>, firmato
              HMAC-SHA256 e <strong>HttpOnly</strong>. Non contiene dati personali.
            </li>
            <li>Preferenze: tema, fuso orario, competizioni preferite, profilo predefinito.</li>
            <li>Previsioni registrate volontariamente, con probabilità e snapshot al momento del salvataggio.</li>
            <li>Scenari salvati e relativi risultati calcolati.</li>
            <li>
              Contatori tecnici di rate limit (bucket = identificativo di sessione, finestra temporale,
              numero di richieste). Non viene salvato l&apos;indirizzo IP.
            </li>
          </ul>
        </Card>

        <Card className="p-5">
          <SectionHeading title="Cosa non viene raccolto" />
          <ul className="list-disc space-y-1.5 pl-5 text-xs leading-relaxed text-muted">
            <li>Nessun nome, email, numero di telefono o account.</li>
            <li>Nessun tracker pubblicitario, pixel di terze parti o profilazione.</li>
            <li>Nessun dato di pagamento: l&apos;app non gestisce denaro.</li>
            <li>Nessuna geolocalizzazione.</li>
            <li>
              Il server di hosting può registrare log tecnici (IP, timestamp, user agent) secondo la
              policy del provider. MatchLab non li usa per profilazione.
            </li>
          </ul>
        </Card>

        <Card className="p-5">
          <SectionHeading title="Cookie" />
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Scopo</th>
                  <th>Durata</th>
                  <th>Tipo</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>ml_session</code></td>
                  <td>Associare i tuoi dati anonimi alla tua sessione</td>
                  <td>180 giorni</td>
                  <td>Tecnico, HttpOnly, SameSite=Lax</td>
                </tr>
                <tr>
                  <td><code>ml-theme</code> (localStorage)</td>
                  <td>Ricordare il tema scelto</td>
                  <td>Fino a cancellazione</td>
                  <td>Preferenza locale, non inviata al server</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-faint">
            Non vengono usati cookie di marketing o di analisi di terze parti.
          </p>
        </Card>

        <Card className="p-5">
          <SectionHeading title="I tuoi controlli" />
          <p className="flex items-start gap-2 text-xs leading-relaxed text-muted">
            <Trash2 className="mt-0.5 size-3.5 shrink-0 text-danger" aria-hidden />
            <span>
              Dalla pagina{" "}
              <Link href="/settings" className="text-accent-text hover:underline">
                Impostazioni
              </Link>{" "}
              puoi eliminare tutte le previsioni, gli scenari e le preferenze associate alla sessione. Il
              cookie viene invalidato e i dati rimossi dal database. L&apos;operazione è immediata e non
              reversibile.
            </span>
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            Puoi anche cancellare i cookie dal browser: perderai l&apos;accesso ai dati associati alla
            vecchia sessione, che resteranno nel database finché non vengono eliminati esplicitamente.
            Non esiste un sistema di recupero perché non esiste un account.
          </p>
        </Card>

        <Card className="p-5">
          <SectionHeading title="Base giuridica e diritti" />
          <p className="text-xs leading-relaxed text-muted">
            I dati tecnici sono trattati per fornire il servizio richiesto (esecuzione del servizio) e
            per la sicurezza (interesse legittimo: prevenire abusi). Non essendoci dati personali
            associati, non è possibile identificarti; puoi comunque eliminare tutto dalla pagina
            Impostazioni. Per richieste relative al progetto: apri una issue sul repository GitHub.
          </p>
        </Card>

        <Card className="p-5">
          <SectionHeading title="Sicurezza" />
          <ul className="list-disc space-y-1.5 pl-5 text-xs leading-relaxed text-muted">
            <li>Cookie firmato con segreto lato server (`SESSION_SECRET` obbligatorio in produzione).</li>
            <li>Controllo same-origin su tutte le mutazioni (difesa CSRF).</li>
            <li>Limite della dimensione del body e rate limit persistito su SQLite.</li>
            <li>Query parametrizzate; nessuna interpolazione di input utente nelle query.</li>
            <li>Header di sicurezza e CSP configurati in `next.config.ts`.</li>
            <li>Nessuna chiave API esposta al client.</li>
          </ul>
          <p className="mt-2 text-[11px] leading-relaxed text-faint">
            Nessun sistema è sicuro al 100%. Non inserire dati sensibili: l&apos;app non li richiede e non
            li supporta.
          </p>
        </Card>

        <div className="flex items-start gap-2 rounded-xl border border-line bg-surface2/20 p-3 text-[10px] leading-relaxed text-muted">
          <Cookie className="mt-0.5 size-3.5 shrink-0 text-warn" aria-hidden />
          <p>
            Versione {APP.version}. Questa pagina descrive il comportamento del software open source; il
            deployment concreto può aggiungere log o servizi esterni. In quel caso il gestore del
            deployment deve aggiornare l&apos;informativa.
          </p>
        </div>

        <div className="flex items-start gap-2 rounded-xl border border-line bg-surface2/20 p-3 text-[10px] leading-relaxed text-muted">
          <Lock className="mt-0.5 size-3.5 shrink-0 text-ok" aria-hidden />
          <p>
            Nessuna vendita di dati, nessun trasferimento a terzi per marketing. Le fonti dati
            (football-data.co.uk, OpenFootball o football-data.org se configurato) ricevono solo le
            richieste del server, non i dati degli utenti.
          </p>
        </div>
      </div>

      <div className="mt-6">
        <Disclaimer compact />
      </div>
    </div>
  );
}
