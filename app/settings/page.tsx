import Link from "next/link";
import { BookOpen, ExternalLink, ShieldCheck } from "lucide-react";
import { getDataSource } from "@/lib/api";
import { APP, MODEL, RISK_PROFILES, type RiskProfileId } from "@/lib/config/constants";
import { getModelVersions, getPreferences, listCompetitions } from "@/lib/db/repositories";
import { readSessionId } from "@/lib/security/session";
import { DataSourceCard } from "@/components/data-source-card";
import { DeleteDataCard, SettingsForm } from "@/components/settings-form";
import { ThemeToggle } from "@/components/theme";
import { Alert, Card, Disclaimer, PageHeader, SectionHeading } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const sessionId = await readSessionId();
  const preferences = sessionId ? getPreferences(sessionId) : null;
  const dataSource = getDataSource();
  const competitions = listCompetitions().map((competition) => ({
    id: competition.id,
    name: competition.name,
    country: competition.country,
  }));
  const versions = getModelVersions();
  const profile: RiskProfileId =
    preferences && preferences.defaultProfile in RISK_PROFILES
      ? (preferences.defaultProfile as RiskProfileId)
      : "balanced";

  return (
    <div className="reveal">
      <PageHeader
        eyebrow="Impostazioni"
        title="Controllo e trasparenza"
        description="Preferenze, fonte dati e cancellazione. MatchLab non richiede account e non raccoglie dati personali."
      />

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-4">
          <SettingsForm
            competitions={competitions}
            initial={{
              timezone: preferences?.timezone ?? "Europe/Rome",
              defaultProfile: profile,
              favoriteCompetitions: preferences?.favoriteCompetitions ?? [],
            }}
          />

          <DeleteDataCard />
        </div>

        <div className="space-y-4">
          <Card className="p-4">
            <SectionHeading title="Aspetto" description="Il tema si applica subito e non richiede rete." />
            <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface2/30 p-3">
              <div>
                <p className="text-xs font-medium">Tema dell&apos;interfaccia</p>
                <p className="mt-0.5 text-[10px] text-faint">Scuro → chiaro → sistema</p>
              </div>
              <ThemeToggle />
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-faint">
              La preferenza è salvata in localStorage e, quando disponibile, anche nel database. La
              lingua dell&apos;interfaccia è italiano; i testi sono centralizzati per una futura
              traduzione.
            </p>
          </Card>

          <DataSourceCard dataSource={dataSource} />

          <Card className="p-4">
            <SectionHeading title="Informazioni" />
            <dl className="space-y-2 text-xs">
              <Row label="Applicazione" value={`${APP.name} v${APP.version}`} />
              <Row label="Motore" value={`${MODEL.version}`} />
              <Row label="Modello" value={MODEL.label} />
              <Row label="Provider richiesto" value={dataSource.requestedProvider} />
              <Row label="Modalità attiva" value={dataSource.isDemo ? "DEMO (dati sintetici)" : "Dati reali"} />
              <Row label="Versione client" value={<code className="text-[10px]">{process.env.NEXT_PUBLIC_APP_VERSION ?? APP.version}</code>} />
            </dl>
            {versions[0] ? (
              <p className="mt-2 text-[10px] text-faint">
                Ultima versione registrata nel database: {versions[0].version} ·{" "}
                {new Date(versions[0].createdAt).toLocaleDateString("it-IT")}
              </p>
            ) : null}
          </Card>

          <Card className="p-4">
            <SectionHeading title="Documentazione" />
            <ul className="space-y-1.5 text-xs">
              <DocLink href="/methodology" label="Metodologia e limiti" />
              <DocLink href="/sources" label="Fonti e copertura dei dati" />
              <DocLink href="/privacy" label="Privacy e cookie" />
              <DocLink href="/terms" label="Termini d'uso" />
              <DocLink href="/api/health" label="Stato tecnico (JSON)" external />
            </ul>
          </Card>
        </div>
      </div>

      {dataSource.isDemo ? (
        <div className="mt-5">
          <Alert tone="warn" title="Modalità DEMO attiva">
            Tutte le competizioni, squadre, partite, giocatori e formazioni sono generati
            sinteticamente. Non rappresentano dati reali. Per usare dati reali imposta{" "}
            <code className="text-[11px]">DATA_PROVIDER=football-data</code> e una chiave API valida.
          </Alert>
        </div>
      ) : null}

      <div className="mt-5 flex items-start gap-2 rounded-xl border border-line bg-surface2/20 p-3 text-[10px] leading-relaxed text-muted">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-ok" aria-hidden />
        <p>
          Sicurezza: cookie di sessione HttpOnly firmato, controllo same-origin sulle mutazioni, limite
          della dimensione del body e rate limit persistito. Nessun dato personale, nessun tracker di
          terze parti. Vedi la pagina Privacy per i dettagli.
        </p>
      </div>

      <div className="mt-3 flex items-start gap-2 rounded-xl border border-line bg-surface2/20 p-3 text-[10px] leading-relaxed text-muted">
        <BookOpen className="mt-0.5 size-3.5 shrink-0 text-accent" aria-hidden />
        <p>
          MatchLab è un progetto dimostrativo open source. Non è un servizio di scommesse, non accetta
          denaro e non fornisce consigli finanziari.
        </p>
      </div>

      <div className="mt-6">
        <Disclaimer compact />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line/60 pb-1.5 last:border-0">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

function DocLink({
  href,
  label,
  external = false,
}: {
  href: string;
  label: string;
  external?: boolean;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center justify-between gap-2 rounded-lg px-1.5 py-1 text-muted hover:bg-surface2 hover:text-fg"
        {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      >
        <span>{label}</span>
        <ExternalLink className="size-3" aria-hidden />
      </Link>
    </li>
  );
}
