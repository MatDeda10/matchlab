# Sicurezza e privacy

## Modello di minaccia (sintetico)

L'app non ha account né dati personali. Le minacce rilevanti sono:

1. accesso ai dati di un'altra sessione;
2. mutazioni cross-site (CSRF);
3. abuso delle API (costo/DoS);
4. injection SQL;
5. esposizione di segreti;
6. XSS tramite contenuti di terze parti;
7. perdita di integrità dei dati salvati.

## Controlli implementati

### Sessione anonima

- Cookie `ml_session` = `uuid.firma`.
- Firma HMAC-SHA256 con `SESSION_SECRET` (o segreto locale in sviluppo).
- Confronto timing-safe.
- `HttpOnly`, `SameSite=Lax`, `Secure` in produzione, `Path=/`, 180 giorni.
- Nessun dato personale nel cookie.
- `ensureSessionId()` è usabile solo in route handler/server action; le pagine usano `readSessionId()`.

**Accesso ai dati**: ogni query filtra per `session_id` preso dal cookie firmato. Il client non può specificare una sessione.

### CSRF

- Tutte le mutazioni JSON passano da `guardMutation`, che verifica `Origin` (o `Referer` in fallback) contro l'URL della richiesta.
- Le DELETE con body vuoto usano lo stesso controllo (`isSameOrigin`).
- `SameSite=Lax` aggiunge una difesa ulteriore.

### Rate limit e body

- Finestre persistite in SQLite (`rate_limits`), bucket = `api:{sessionId}`.
- Limiti: generate 12/min, predictions 30/min, preferences 40/min, scenarios 20/min, settle 10/min, sync 3/5min.
- Body massimo 32 KB (`readJsonBody`), con controllo su `Content-Length` e lunghezza effettiva.
- Risposta 429 con `Retry-After`.

Limite noto: il rate limit è per sessione, non per IP. Un attaccante può creare nuove sessioni. Per una demo a basso traffico è accettabile; in produzione si aggiunge un limite per IP al reverse proxy.

### Validazione

- Schemi Zod per generate, scenari, previsioni, preferenze, sync.
- Le probabilità **non** vengono mai accettate dal client: vengono ricalcolate server-side da fixture + mercato + selezione.
- ID e stringhe hanno lunghezza massima.
- Campi sconosciuti scartati dagli schemi.

### SQL injection

- Query parametrizzate in tutti i repository.
- Nessuna interpolazione di input utente.
- Tabelle dinamiche limitate da allowlist (`countRows`).

### XSS e contenuti

- React esegue escaping di default.
- Nessun `dangerouslySetInnerHTML`.
- I dati del provider sono trattati come testo, mai come HTML.
- CSP: `default-src 'self'`, `script-src 'self' 'unsafe-inline'` (necessario per il bootstrap inline di Next), `frame-ancestors 'none'`, `form-action 'self'`.
- `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`.

Nota: `'unsafe-inline'` per gli script riduce la protezione CSP. È un compromesso per il bootstrap inline di Next; una nonce-based CSP è nella roadmap.

### Segreti

- `FOOTBALL_DATA_API_KEY` e `SESSION_SECRET` sono solo server-side.
- Nessuna variabile sensibile con prefisso `NEXT_PUBLIC_`.
- `.env*` e `data/` esclusi da git.
- In produzione `SESSION_SECRET` mancante causa un errore esplicito all'avvio della sessione, invece di un fallback silenzioso.

### Integrità

- Transazioni per previsioni e cancellazioni.
- Previsioni annullabili solo se `OPEN` e prima del kickoff.
- Le probabilità salvate non vengono riscritte.
- La risoluzione richiede che tutte le partite siano concluse.
- Le leg non risolte restano `NULL` ed escluse dalle metriche.

## Privacy

### Dati salvati

- UUID di sessione, preferenze, previsioni, scenari.
- Contatori di rate limit (bucket di sessione, finestra, conteggio).
- Nessun IP, user agent, email, nome o telefono nel database.

### Dati non raccolti

- Nessun tracker di terze parti, pixel, analytics, pubblicità.
- Nessun dato di pagamento.
- Nessuna geolocalizzazione.

### Cancellazione

`DELETE /api/account` rimuove previsioni, leg, scenari e preferenze della sessione e invalida il cookie. La cancellazione è immediata e non reversibile.

### Log

Il deployment può produrre log tecnici (errori, richieste) secondo il provider. MatchLab non li usa per profilazione. Gli errori applicativi non includono segreti o body delle richieste.

### Cookie e localStorage

| Nome | Tipo | Scopo | Durata |
| --- | --- | --- | --- |
| `ml_session` | Cookie HttpOnly | Sessione anonima | 180 giorni |
| `ml-theme` | localStorage | Tema | Fino a cancellazione |

Nessun cookie di marketing o analytics.

## Limitazioni dichiarate

- Nessuna autenticazione: chi possiede il cookie può accedere ai dati di quella sessione. Non inserire dati sensibili.
- Rate limit per sessione, non per IP.
- CSP con `unsafe-inline` per gli script.
- SQLite non crittografato a riposo: chi ha accesso al filesystem ha accesso ai dati. Usa cifratura del volume se necessario.
- Nessun audit log delle azioni.
- Nessun pentest formale.

## Segnalazioni

Per vulnerabilità, apri una issue privata o contatta il maintainer del repository. Non pubblicare exploit con dati reali.
