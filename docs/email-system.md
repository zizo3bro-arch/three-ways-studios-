# Email notification system — production hardening

This document describes the Resend email notification system for Three Ways
Studios: its architecture, claim and idempotency guarantees, rate limiting,
rate-limit cleanup, and the residual risks that remain unverifiable from here.

The system sends two notification types, both on the Vercel runtime next to the
storefront:

| Notification | Key (`notifications.type/<order_id>`) | Recipient |
| --- | --- | --- |
| Order confirmation (customer) | `order-confirmation/<order_id>` | Server-side order row (`customer_email`) |
| New order (studio admin) | `admin-new-order/<order_id>` | Server-configured `ADMIN_NOTIFICATION_EMAIL` |

Both keys are deterministic — stable across retries, re-claims and GitHub
deploys — and stored verbatim in the database row for audit.

## Where things live

```
api/
  order-confirmation.ts     POST endpoint: customer order confirmation
  admin-new-order.ts        POST endpoint: studio admin new-order notification
  _lib/handler.ts           shared request pipeline (all endpoints)
  _lib/env.ts               env validation (fail-closed)
  _lib/client-ip.ts         Vercel-trusted client IP resolution
  _lib/claims.ts            claim/outcome RPCs (Supabase service role)
  _lib/order.ts             server-side order + line-item load (no client input)
  _lib/emails.ts            email builders (escaped, idempotent content)
  _lib/resendSend.ts        Resend transport + error classification
  _lib/idempotency-keys.ts  key derivation/validation
  _lib/production.ts        production dependency wiring
supabase/migrations/014_email_notifications.sql
  email_notifications (claim ownership + conditional outcome recording)
  rate_limit_buckets (atomic per-key fixed-window limiter)
src/lib/emailNotifications.ts  fire-and-forget browser trigger
src/pages/CheckoutPage.tsx     places the order → triggers both emails
src/pages/OrderConfirmationPage.tsx  landing on the receipt re-attempts the customer email (never the admin one)
```

Nothing here runs in the browser except the two fire-and-forget triggers in
`src/lib/emailNotifications.ts`. The Resend API key and the Supabase service
role key live only in Vercel's environment — no `VITE_` variable carries a
secret.

## 1. Duplicate-email prevention

### 1.1 Resend Idempotency Keys

Installed SDK: `resend@6.39.0`. Verified in `node_modules/resend/dist/index.mjs`
(l. 1823): `if (options.idempotencyKey) headers.set("Idempotency-Key", options.idempotencyKey)`.
The SDK's `CreateEmailRequestOptions` extends `IdempotentRequest`
(`idempotencyKey?: string`), and `resend.emails.send(payload, { idempotencyKey })`
sends that header. The unit test `tests/email-notifications-unit.test.mjs`
captures the real wire call (mocked network) and asserts the header value.

- Customer key: `order-confirmation/<order_id>`
- Admin key: `admin-new-order/<order_id>`

Both are capped at 55/54 characters (well under Resend's 256-char limit),
stable for the whole lifecycle of the notification row, and stored in the row.

**Resend retains idempotency keys for 24 hours.** Any retry from the
order flow — including a re-claim after a crash — happens inside that
window, so Resend never sends a second email for the same key + payload.
If a request is simply delayed longer than 24 hours and then resent, Resend
treats it as a new send — that is the only window in which a duplicate is
possible, and it is also the only window in which the DB claim would be
stale in a way a human would notice (terminal-failure rows require manual
intervention, and the row's re-claim after 24h is left to the operational
decision in §9).

### 1.2 Claim ownership tokens and conditional outcome recording

Each send is claimed through `public.claim_email_notification(...)` which:

- Inserts a row (status `claimed`) with a fresh `gen_random_uuid()` claim
  token and a lease (default 120 s — well beyond any legitimate Vercel
  function lifetime). Returns `outcome='new'` to the caller.
- Never re-claims a live lease. If a row exists with status `claimed` and
  `claim_expires_at > now()`, returns `in_flight` — no send, no outcome,
  an honest HTTP 202 to the caller.
- Only re-claims a stale lease (`claim_expires_at <= now()`). The takeover
  is a single conditional `UPDATE ... WHERE status='claimed' AND claim_expires_at <= now()`,
  so two concurrent callers cannot both own the row. A re-claim rotates the
  token: `reclaimed` with a fresh `claim_token`.
- Terminal statuses are never re-claimed: `sent` → `already_sent` (no-op
  replay); `failed` → `failed` (never re-sent).

Outcome recording is `public.record_email_outcome(...)`, which updates the
row **only while the caller still owns the current claim token and the row
is still `claimed`**:

- `sent`: stores `resend_id`, status `sent`, `outcome_recorded_at = now()`.
- `failed`: stores `last_error`, status `failed`. Terminal.
- `claimed` (transient): stores `last_error`, keeps status `claimed` so a
  later retry after the lease expires can re-claim. Never a terminal outcome.

A stale request after re-claim — e.g. a crashed first attempt that wakes late
— records its outcome with the **old token**, which the conditional update
rejects (returns `false`). Stale writes never overwrite a newer request's
outcome.

### 1.3 Why re-claiming is safe

Even if a late request re-sends (because it never saw the terminal
outcome), Resend's idempotency key (`order-confirmation/<order_id>`) is
identical, so Resend returns the original response without sending a
second email. The deterministic key + database claim are defense in depth:
the DB reduces the number of duplicate HTTP attempts; Resend guarantees the
actual email is sent once.

### 1.4 Unavoidable uncertainty (documented)

If a request reaches Resend and times out before recording the outcome —
or is killed by the runtime between Resend's 200 and the record — the
database cannot know whether the email went out. There is no transactional
bridge across Resend's network boundary. The system handles it honestly:

- On the retry path, the claim either `is_in_flight` (the original is still
  alive) or is stale (lease expired → re-claim).
- Even a spurious re-send is suppressed by Resend's idempotency key.
- If the 24h idempotency window has expired by then, a duplicate is possible
  and is a documented risk, not something the system can prevent.

## 2. Atomic rate limiting

Migration 014 installs `public.rate_limit_check(p_key, p_limit, p_window_seconds)`:

- Fixed-window counter keyed by `(key, window_start)`; one INSERT + one
  `ON CONFLICT DO UPDATE SET count = count + 1` under a single row lock —
  no SELECT-then-INSERT race. Concurrent calls cannot exceed the limit.
- Returns `{ allowed, count, limit, window_start, retry_after_seconds }`.
- Two buckets are enforced per email:
  - `email:<type>:ip:<ip>` — per client IP (default 20 / 600 s).
  - `email:<type>:order:<order_id>` — per order (default 5 / 3600 s).
- Atomicity is verified in PGlite (see §5). The one caveat: PGlite runs a
  single engine, so it proves the SQL is structurally race-free under
  interleaved calls, not under multiple truly-concurrent connections.
  A live-PostgreSQL concurrency proof would need a separate multi-connection
  harness that does not exist in this sandbox.
- **Fail-closed**: if the limiter itself is unavailable (RPC error), the
  endpoint returns 503 `rate-limit-unavailable` and never contacts Resend.
  No silent fail-open path exists.

## 3. Client IP

Vercel documented (https://vercel.com/docs/headers/request-headers):

- `x-forwarded-for`: "The public IP address of the client that made the
  request. If you are trying to use Vercel behind a proxy, we currently
  overwrite the X-Forwarded-For header and do not forward external IPs."
- `x-vercel-forwarded-for`: identical to `x-forwarded-for`, "However,
  x-forwarded-for could be overwritten if you're using a proxy on top of Vercel."
- `x-real-ip`: identical to `x-forwarded-for`.

Implementation (`api/_lib/client-ip.ts`):

1. Only reads headers when the deployment is on Vercel (`VERCEL=1` — the only
   documented Vercel deployment marker, per https://vercel.com/docs/env-vars).
   Outside Vercel — including local dev, direct hosting and untrusted proxies —
   it returns the fixed `unknown` bucket, every request sharing it, which is
   stricter and cannot be dodged. Note that `VERCEL_SYSTEM_ENV` does not exist;
   it was removed from the implementation. Nothing but Vercel-set headers is
   trusted.
2. Prefers `x-vercel-forwarded-for` (Vercel-specific; designed for exactly
   the case of a proxy on top of Vercel), then `x-forwarded-for`, then
   `x-real-ip`.
3. Validates the value with `node:net.isIP` — anything else (including
   client-sent `cf-connecting-ip`) is rejected. Right-most hop parsing is
   deliberately unused: Vercel computes the header, and taking the first
   token is the conservative, documented-safe choice.

**Limitation**: if the application is ever reached through an untrusted
external proxy (an insecure-but-documented proxy on top of Vercel, a
misconfigured CDN, a site behind another load balancer), the Vercel-set
headers may be wrong or overwritten. Documented in §10 risk review. The
`unknown` bucket is the failure mode in that situation, and the anti-spoof
property only holds on direct Vercel traffic.

## 4. Rate-limit cleanup

Retention: 48 hours (`p_retention_seconds = 172800`, fixed in migration 014).
Nothing is ever deleted while its window is still within 48 hours — records
inside the retention window are never removed, and records inside a still-
active minute window are untouchable.

Strategy: bounded, opportunistic cleanup attached to the atomic limiter:

- On the first request of a fresh window (`count = 1`), the same
  `rate_limit_check` transaction issues a bounded `DELETE` of expired rows
  (`window_start < now() - retention`), limited to at most 200 rows per
  call. Nothing can run unbounded work on the hot path.
- The cleanup is best-effort inside the transaction (a failure raises a
  WARNING and does not fail the rate-limit decision — the atomic check,
  which is what protects the order, still fails closed).
- A standalone `public.cleanup_rate_limit_buckets(retention, max_rows)`
  RPC is also exposed for an external scheduled caller (e.g. a Vercel cron
  route hitting a dedicated endpoint, or an admin invoking it), bounded the
  same way (default 200–500 rows per call).

**Frequency**: cleanup runs automatically on the next fresh rate-limit window
created by any endpoint — in practice every 10 minutes (the IP window) or
only rarer windows. There is no sleep-based trigger; if you need an
independent schedule, wire `public.cleanup_rate_limit_buckets` into a
scheduled invocation.

**What is NOT done**: a Vercel cron entry. The task's "only if reliably
configurable" test is hard to pass from this sandbox without a real
deployment, and a silent or misconfigured cron would produce a misleading
"cleanup is enabled" signal. The bounded opportunistic cleanup plus the
documented standalone-cleanup RPC is the honest default.

## 5. RLS and grants

Both tables are RLS-enabled with **no policies** — anon/authenticated see
no rows and cannot insert. Table privileges for `anon`/`authenticated` are
revoked at migration time; functions (`rate_limit_check`, `claim_email_notification`,
`record_email_outcome`, `cleanup_rate_limit_buckets`) are SECURITY DEFINER,
pinned `search_path = public, pg_temp`, and EXECUTE is granted to `service_role`
only (revoked from PUBLIC and anon/authenticated). The Vercel functions use a
service-role key with `Authorization: Bearer` — that role bypasses RLS and is
the only application role that touches these tables, exactly as the
`001_schema`/`006_admin_hardening_safe` convention does for staff paths.

The frontend only ever calls the `/api/*` endpoints (same-origin); it never
hands Resend or Supabase a secret. The studio console never calls these
endpoints.

## 5b. Request ordering (validate-before-claim)

The pipeline validates the order **before** the claim:

1. method/content-type, capped body, strict `{order_id}` UUID
2. env validation (misconfiguration → 500)
3. client-IP resolution + atomic rate limiting (→ 429/503)
4. **server-side order load → 404 / 500** (order must exist)
5. claim ownership (→ 503 / 202 / 200 / 422 / new claim)
6. build email from the order row → send → conditional outcome record

An unknown order_id therefore returns a genuine `404 order-not-found` and
never a claim row. It also never exposes order data: the response contains no
customer/address/reference details — only `{error}`.

## 6. Resend 409 handling (idempotency conflicts)

The installed SDK (`resend@6.39.0`) exposes a typed error-code catalog in
`dist/index.d.mts`. From it, the idempotency-related names are:

| Error name | Meaning | Classification |
| --- | --- | --- |
| `concurrent_idempotent_requests` | Same key, same payload, in flight | **Transient** — the row stays claimable; a later retry re-claims after the lease expires. Bounded: the retry happens only on an explicit client re-trigger, and the shared stable key prevents a duplicate send. |
| `invalid_idempotent_request` | Same key, different payload | **Terminal** — payload content changed under the stable key; retrying cannot fix it. The row is recorded `failed` and the notification is locked. |
| other 4xx with a documented name (e.g. `validation_error`, `invalid_idempotency_key`) | Malformed key, validation, auth, quota, misconfiguration | **Terminal** — the payload/key did not change because of content drift; retrying the same key/payload cannot fix it. |
| unrecognized 409 (status 409, name absent or unknown) | Cannot prove payload identity | **Transient** — conservative choice: never permanently lock on uncertainty; a bounded retry on a later claim is safe. |
| 429 / 5xx / no status code / network failure | Retryable failure | **Transient** — row stays claimable (bounded by the lease); never a permanent lock. |

Non-negotiable: the stable idempotency key is **never regenerated**, never
replaced, and never bypassed — a fresh key would silently ship a different
payload under a reused key. The error classification uses the SDK's documented
error-code names; it does not attempt payload-content comparison (which it
cannot see). The SDK does **not** provide a payload-diff signal of its own —
this is the documented contract we rely on, and it is a best-effort mapping,
not a ground-truth proof of the payload relation.

## 7. Claim/Outcome contract summary

```
claim_email_notification(order_id, type, lease = 120s)
  → { outcome: new | reclaimed | in_flight | already_sent | failed | lost,
       claim_token, idempotency_key, status, claim_expires_at, last_error }

record_email_outcome(order_id, type, token, status='sent'|'failed'|'claimed', ...)
  → boolean (true only when the outcome actually applied)
```

Statuses: `claimed`, `sent`, `failed` (terminal). A transient error keeps
the row claimable (status stays `claimed`) with the error recorded.

## 8. Contract for the storefront

- `POST /api/order-confirmation` and `POST /api/admin-new-order` accept
  exactly one body field: `{ "order_id": "<uuid>" }`. Any extra field is a 400.
- Email content/recipient/sender are built server-side from the order row
  — the body cannot inject or alter any of it.
- Recipients: customer → order row; admin → `ADMIN_NOTIFICATION_EMAIL`.
- Responses: minimal (`sent: true|false`, `pending`, `already_sent`), no
  customer/admin emails, no Supabase URLs, no internal status codes beyond
  `delivery-failed` / `notification-failed` / `rate-limited` /
  `rate-limit-unavailable` / `claim-unavailable` / `order-not-found` /
  `not-configured`.
- `already_sent → 200`, `in_flight → 202`, `failed → 422`,
  `sent → 200`, `terminal → 422`, `transient → 503`, `rate-limited → 429`,
  `rate-limit-unavailable → 503`, misconfigured → 500, body/method errors → 400/405/413/415/422.
- The receipt page (`OrderConfirmationPage`) triggers the customer
  confirmation email on landing (best-effort) — the admin email is only
  fired at order placement, so the studio inbox is not spammed on every
  page view. This is the one deliberate asymmetry with the checkout path.
- Both triggers are fire-and-forget: receipts come from the database, not
  from any email.

## 9. Tests

| File | Kind | Covers |
| --- | --- | --- |
| `tests/email-notifications-db.test.mjs` | REAL PostgreSQL (PGlite) integration | rate-limit atomicity (25 parallel calls, exact split), bounded cleanup (200/call + retention preservation), claim ownership/stale-lease re-claim, conditional outcome recording (stale tokens rejected), RLS/grant sweep (anon vs service_role), claims on a real `create_cod_order` order |
| `tests/email-notifications-handler.test.mjs` | PGlite integration — real handler pipeline, real rpcs, real order load, real builders, stubbed network only | 404-before-claim, sent/409/4xx transitions, already_sent and failed replay, no duplicate sends while the lease is live |
| `tests/email-notifications-unit.test.mjs` | Mocked unit (no network, no DB, no Resend) | idempotent keys, env validation, Vercel-only client-IP resolution, request gates (method/content-type/body), rate-limit verdict handling (429/503), claim state machine (new/reclaimed/in_flight/already_sent/failed), order-not-found/lookup, conditional outcome recording, exact request shape (key/to/from), email builder escaping, Resend SDK header + error classification (mocked fetch with the real SDK), frontend trigger behavior |
| existing suites (`commerce`, `loyalty-*`, `console`, `frontend`) | unchanged | keep checkout, receipts, loyalty and UI behavior intact |

Integration tests are explicitly pinned to PGlite — they upgrade the full
migration chain (001 → 014) against a disposable embedded engine, never the
live project. The cleanup test tolerates PGlite's single-engine scheduling;
a multi-connection live-Postgres concurrency proof is outside this sandbox.

## 10. Remaining risks and known limitations

1. **PGlite limitation** (shown above): atomicity is verified structurally and
   under interleaved driver calls, not under simultaneous connections to a
   real PostgreSQL. A production load test with truly parallel connections
   is the follow-up verification step.
2. **Timeout-after-accept is unavoidable.** If a request times out between
   Resend's success response and the outcome record, the system cannot know
   the email went out. The idempotency key prevents the actual send from
   duplicating — but the DB row may show `claimed`, and a later re-claim may
   re-contact Resend (which dedups it). Documented as the only residual
   duplicate-prevention gap.
3. **24-hour key retention.** After 24 hours, a duplicate is physically
   possible (Resend treats the key as new and sends). Do not schedule
   re-sends far in the future; if an operator needs a forced re-send after
   24h, it must be an informed, manually-owned decision — never automatic.
4. **Untrusted proxy**: headers are only validated on direct Vercel traffic.
   Anything outside Vercel falls back to a shared `unknown` bucket — safe
   but not per-IP-correct. The Vercel route is the supported deployment.
5. **Serverless wall-clock**: the claim lease (default 120 s) must exceed
   any legitimate runtime. If you ever extend the function timeout past the
   lease, the lease will be reclaimed while a live request is still in
   flight — the conditional recording/UPDATE still prevents corrupted
   outcomes, but emails are only guaranteed once per key via Resend.
6. **Rate-limit cleanup is opportunistic**, not a cron job. It cannot
   accumulate more expired than the per-call bound per call, and cleanup
   runs automatically on the next fresh window; if you need an independent
   schedule, use the standalone RPC (documented above).
7. **Admin trigger is browser-placed, not server-triggered.** The admin
   notification is fired by the checkout flow (not by a DB trigger/Resend
   webhook). If a misbehaving client never completes the checkout flow, the
   admin may not be notified. The customer confirmation email has the same
   property in the checkout path but the receipt-page re-trigger is the
   safety net for the most-missed item.
8. **`SUPABASE_SERVICE_ROLE_KEY` has full privileges.** It must never ship
   to the browser or be logged; it is read only inside `api/` modules.
   The `.env.example` documents this. The service role also bypasses RLS —
   the endpoints never take secrets or recipients from the request body,
   and `email_notifications`/`rate_limit_buckets` remain unreachable to anon
   (RLS + revoked EXECUTE).
