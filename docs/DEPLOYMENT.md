# Deployment

## Requisiti

- Runtime **Node.js >= 24** (usa `node:sqlite` nativo; testato con Node 24 e 26).
- Filesystem **persistente e scrivibile** per `data/matchlab.db`.
- `SESSION_SECRET` (>= 32 caratteri) in produzione.

Non è un'app statica: richiede un processo Node. **GitHub Pages non è compatibile** (non esegue Next.js né SQLite).

---

## Locale (sviluppo)

```bash
npm install
npm run setup
npm run dev
```

## Locale (produzione)

```bash
npm ci
npm run build
SESSION_SECRET="$(node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))")" \
  npm start
```

Il database deve essere popolato con `npm run setup` (DEMO), `npm run db:seed:real` (snapshot reale incluso) oppure verrà creato vuoto con le sole migrazioni. Con `DATA_PROVIDER=football-data-uk` e DB vuoto, lo snapshot viene importato automaticamente.

> Il progetto usa `output: "standalone"`; `npm start` funziona ma Next.js segnala che in produzione è preferibile avviare il server standalone. In Docker viene usato `next start` per mantenere disponibili migrazioni e script nella stessa directory.

---

## Docker (consigliato)

```bash
cp .env.example .env
# Imposta SESSION_SECRET nel file .env
docker compose up --build
```

- Il database vive nel volume `matchlab-data` montato su `/app/data`.
- Al primo avvio l'entrypoint applica le migrazioni. Se il DB non esiste, crea il dataset DEMO oppure importa lo snapshot reale quando `DATA_PROVIDER=football-data-uk` (o `open-data` / `AUTO_SEED_REAL=1`).
- Lo snapshot `data/real/snapshot.json.gz.b64` è incluso nell'immagine: il primo avvio in modalità reale non richiede rete.
- Il container gira come utente non-root.
- `DATA_PROVIDER=demo` per default. Per dati reali gratuiti imposta `DATA_PROVIDER=football-data-uk`; non serve alcuna chiave API.
- Se il volume contiene già un DB DEMO e vuoi passare ai dati reali, esegui una volta `docker compose run --rm --entrypoint "./node_modules/.bin/tsx scripts/db.ts seed-real" matchlab` (azzera il DB) oppure rimuovi il volume.

### Immagine manuale

```bash
docker build -t matchlab .
docker run -d --name matchlab \
  -p 3000:3000 \
  -e SESSION_SECRET="una-stringa-casuale-di-almeno-32-caratteri" \
  -v matchlab-data:/app/data \
  matchlab
```

### Aggiornamento

```bash
docker compose build --pull
docker compose up -d
```

Le migrazioni vengono applicate all'avvio. **Fai un backup del volume prima di aggiornare** se hai dati che ti interessano.

### Backup

```bash
docker run --rm -v matchlab-data:/data -v "$PWD":/backup alpine \
  tar czf /backup/matchlab-backup.tar.gz -C /data .
```

Il backup a caldo di SQLite in modalità WAL può essere incoerente: preferisci fermare il container o usare `sqlite3 .backup` se disponibile.

---

## Reverse proxy (esempio Caddy)

```caddyfile
matchlab.example.com {
    reverse_proxy 127.0.0.1:3000
    encode gzip
}
```

Note:

- Abilita HTTPS: il cookie è `Secure` in produzione e senza HTTPS non verrebbe inviato.
- Non rimuovere gli header di sicurezza impostati da Next.
- Imposta un limite di body a monte coerente (32 KB per le API).

## Nginx (estratto)

```nginx
server {
    listen 443 ssl http2;
    server_name matchlab.example.com;

    client_max_body_size 1m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

---

## Piattaforme gestite: cosa è realistico

| Piattaforma | Fattibilità | Note |
| --- | --- | --- |
| **Docker su VPS** | ✅ consigliata | Volume persistente, costo variabile |
| **Fly.io / Render / Railway** | ⚠️ possibile | Serve un volume persistente; i piani gratuiti cambiano spesso e possono sospendere il servizio |
| **Vercel** | ❌ per SQLite in scrittura | Filesystem effimero: previsioni, scenari e preferenze non sopravvivono. Funzionerebbe solo come vetrina read-only con database esterno |
| **GitHub Pages** | ❌ | Non esegue Next.js né un backend |
| **Netlify/Cloudflare Pages** | ❌ | Static/edge, non adatti a SQLite persistente senza servizi esterni |

Non viene promesso un deploy gratuito perpetuo: le condizioni dei provider cambiano. La modalità DEMO può essere pubblicata come vetrina, ma senza garanzie di persistenza.

### Se vuoi Vercel

Serve sostituire SQLite con un database gestito (es. Postgres/Neon) e implementare un adapter nei repository. La sessione anonima e le API restano compatibili. Questo non è implementato.

---

## Sincronizzazione dati reali

Manuale:

```bash
DATA_PROVIDER=football-data-uk npm run sync
```

Oppure via API (protetta da same-origin, sessione e rate limit):

```bash
curl -X POST https://tuo-dominio/api/sync \
  -H "Content-Type: application/json" \
  -H "Origin: https://tuo-dominio" \
  -d '{"daysBack":30,"daysForward":14}'
```

Per un cron esterno, usa un client che invii `Origin` corretto e gestisci la sessione. In alternativa, esegui lo script sul server con accesso al volume.

Il provider reale gratuito usa un rate limiter locale prudente (45 richieste/minuto, richieste sequenziali) e una cache SQLite di 6 ore. Non schedulare sync troppo frequenti: i CSV pubblici non sono un'API con SLA. Per football-data.org la quota dichiarata è di 10 richieste/minuto.

---

## Variabili d'ambiente

| Variabile | Obbligatoria | Default | Descrizione |
| --- | --- | --- | --- |
| `SESSION_SECRET` | ✅ in produzione | file locale in sviluppo | Firma del cookie |
| `DATABASE_PATH` | no | `./data/matchlab.db` | Percorso SQLite |
| `DATA_PROVIDER` | no | `demo` | `demo`, `football-data-uk` (alias `open-data`) o `football-data` |
| `FOOTBALL_DATA_UK_HISTORY_SEASONS` | no | `3` | Stagioni storiche da football-data.co.uk (1–5) |
| `FOOTBALL_DATA_UK_FORCE` | no | `0` | `1` ignora la cache HTTP |
| `AUTO_SEED_REAL` | no | auto con provider reale | `0` disattiva il bootstrap dello snapshot; `1` lo forza |
| `REAL_SNAPSHOT_PATH` | no | `data/real/snapshot.json.gz.b64` | Snapshot alternativo (`.json`, `.json.gz`, `.json.gz.b64`) |
| `FOOTBALL_DATA_API_KEY` | solo `football-data` | — | Chiave personale football-data.org |
| `FOOTBALL_DATA_COMPETITIONS` | no | `SA,PL,PD,BL1,FL1` | Codici competizione football-data.org |
| `NEXT_PUBLIC_APP_VERSION` | no | `0.1.0` | Etichetta versione |

Non committare mai `.env.local` o chiavi API.

---

## Salute del servizio

`GET /api/health` restituisce stato, provider attivo, capacità, conteggi del database e ultima sincronizzazione. Non espone segreti.

Usalo per health check del container/proxy.

---

## Checklist di go-live

- [ ] `SESSION_SECRET` impostato e casuale (>= 32 caratteri)
- [ ] HTTPS attivo
- [ ] Volume persistente montato e con backup
- [ ] `npm run verify` verde
- [ ] Dataset DEMO rigenerato o snapshot/provider reale configurato
- [ ] Health check risponde 200 e mostra `odds` tra le capability del provider reale
- [ ] Limite di richieste del provider rispettato
- [ ] Snapshot reale presente nell'immagine Docker (`data/real/snapshot.json.gz.b64`)
- [ ] Disclaimer visibile
- [ ] Log senza dati personali
