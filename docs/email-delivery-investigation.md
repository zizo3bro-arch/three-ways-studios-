# Why no email was sent — checkout → order → notification investigation

Date: 2026-11-22 · Base: `a73e02b` (production deployment of the ESM fix) · Branch: `arena/013da26d-three-ways-studios`

**Status: not verified in production.** This sandbox has no network route to
`*.vercel.app` or to the Supabase project, so the deployed storefront, the
deployed function logs and the Resend log could not be read from here. Everything
below is either proven from the repository and the local build, or explicitly
marked as a hypothesis with the check that decides it. The fix removes both
candidate causes and adds the diagnostics that make the next real order
conclusive. Do not treat this as "the emails now work" until §7 passes.

---

## 1. The complete production flow (before this change)

```
Browser                                    Supabase / Vercel
──────────────────────────────────────────────────────────────────────────────
/checkout
  CheckoutPage.submit()            src/pages/CheckoutPage.tsx:149
    guard: writing / allowed / form validity        (:150)
    payment_method must be COD                      (:152)
    build the idempotency key (bag + customer)      (:157-186)
    createCodOrder({...})                           (:165)
      ──────────────────────────────────────────────────────────────────────
      src/lib/api.ts:138 createCodOrder
        checkoutClient()          → authenticated customer client, else anon
        client.rpc('create_cod_order', payload).retry(false)   (:172 before)
        ───────────────────────────► public.create_cod_order(...)
                                     (migrations 010/011 → 009 signature)
                                     inserts the order + items, decrements stock,
                                     records discounts, honours
                                     p_checkout_request_id (idempotent),
                                     returns a jsonb receipt including
                                     order_id, order_reference
        receipt(data) guard        → order_id UUID, reference, COD,
                                     finite total, non-empty items
      ──────────────────────────────────────────────────────────────────────
    if (!order || error) { show notice; return }     ← receipt problems stop here
    void announceOrderEmails(order.order_id)         (:193 before)
      src/lib/emailNotifications.ts:39
        POST /api/order-confirmation   ┐ fire-and-forget
        POST /api/admin-new-order      ┘ both same-origin
            ──────────────────────────────────────────────────────────────────
            api/order-confirmation.ts → api/_lib/handler.ts
            api/admin-new-order.ts    → api/_lib/handler.ts
              method/JSON → env (fail-closed) → client IP → rate limit
              → load order (404 if missing) → claim (lease token)
              → build email from the order row → Resend
                (Idempotency-Key order-confirmation/<id> | admin-new-order/<id>)
              → conditional outcome record
    clearCart(); navigate('/order-confirmation/<reference>', {state:{email}})
      OrderConfirmationPage
        fetchOrderConfirmation(reference, email)     (RPC get_order_confirmation)
        if (order?.order_id) → announceOrderConfirmationEmail(order_id)
          src/pages/OrderConfirmationPage.tsx:51   ← customer email only, safety net
```

The order path never touches the email path: the order is created by a direct
PostgreSQL RPC from the browser, and the emails are a *separate* HTTP call. That
separation is why "the order is in the admin panel" says nothing about whether
either route ran.

## 2. Where the two routes are invoked

| Route | Called from | Trigger condition (before) |
| --- | --- | --- |
| `POST /api/order-confirmation` | `src/lib/emailNotifications.ts:35` (via `announceOrderEmails` at checkout and `announceOrderConfirmationEmail` on the receipt page) | checkout: only after `receipt()` accepted the RPC result; receipt page: only after a successful `get_order_confirmation` lookup |
| `POST /api/admin-new-order` | `src/lib/emailNotifications.ts:43` (checkout only — deliberate: the studio inbox is never mailed on page views) | same receipt-gated checkout branch |

Both are "fire-and-forget" (`void announce…`), and until this change both were
wrapped in a bare `try { … } catch { return }` with **no logging at all**.

## 3. What was checked, and what it proves

| Check | Result |
| --- | --- |
| Is the trigger present in the source? | Yes — `CheckoutPage.tsx:193` (commit `5758bf1`, included in production `a73e02b`). |
| Is it present in the **built** bundle? | Yes. `npm run build` → the built chunk contains `POST /api/order-confirmation` **and** `POST /api/admin-new-order` and the call site `Se(N.order_id)` immediately after the successful RPC. So a deployment of `a73e02b` really does call both endpoints. |
| Is the call reachable on the success path? | Only if `receipt()` accepts the RPC payload. If it does not, the function returns early: order created in PostgreSQL, no trigger, no navigation, no error anywhere else. |
| Can a failure be seen anywhere? | No. No `console` output, no response status check, no server-side trace on the client side. `postEmailSafely` discarded the `Response` object entirely. |
| Are the API paths correct? | Yes: `api/order-confirmation.ts` → `/api/order-confirmation`, `api/admin-new-order.ts` → `/api/admin-new-order`; `npm run verify:api` loads both in plain Node ESM (the Vercel runtime layout). |
| Is `vercel.json` able to answer `/api/*` itself? | **It could.** The SPA fallback was `{"source": "/(.*)", "destination": "/index.html"}` — a catch-all with no `/api` exclusion. Vercel's KB is explicit: *"If the SPA also serves API routes, exclude them from the fallback with a negative lookahead, or every API call gets rewritten to `index.html` too."* A request answered that way returns HTML with a 200, **no function invocation is logged, and no email is possible** — exactly the reported signature. |
| Does the CSP block the call? | No. `connect-src 'self'` covers a same-origin POST to `/api/*`. |

## 4. Root cause

Two independent defects, and they fail in the same silent way. Both are fixed.

**4.1 The trigger was conditional on UI-level receipt validation (code defect, proven).**

```ts
if (!order || error) { …; return; }        // receipt guard
void announceOrderEmails(order.order_id);  // only reached when the guard passes
```

The moment PostgreSQL commits, the order exists and both notifications are due —
but the notification call sat *behind* a validation step that exists for a
different purpose (deciding whether the receipt UI can render). Any receipt
problem, any future edit to that component, and any stale bundle silently
deleted the email. Nothing recorded that the trigger had been skipped, so "no
invocation" and "no email" were indistinguishable.

**4.2 The SPA fallback could answer `/api/*` (config defect, environment-dependent).**

`vercel.json` routed `/(.*)` to `/index.html`. Whether this actually bites the
two literal function paths depends on the deployment's generated route table,
which cannot be inspected from this sandbox. If it does bite, the browser gets
`index.html` with a 200, the function never runs (nothing in the Vercel function
logs), the fire-and-forget call swallows the response, and no email is sent —
independent of Resend, the API key, the admin address or migration 014.

**What is explicitly *not* the root cause** (and was not changed): Resend, the
API key, the sender identity, `ADMIN_NOTIFICATION_EMAIL`, migration 014, the
claim/lease logic, the rate limiter, the idempotency keys, the email builders,
the order RPC, loyalty rules or the admin console.

## 5. The fix

1. **The trigger moved to the commit path.** New `src/lib/codCommit.ts` owns the
   write, the receipt guard *and* the announcement. The announcement fires as
   soon as the RPC answers without an error, from the raw payload, **before and
   independently of** `isOrderReceipt`:
   - `src/lib/api.ts:173` — `createCodOrder` delegates to `commitCodOrder(payload, { rpc, announce: announceOrderEmails })`;
   - `src/pages/CheckoutPage.tsx` no longer owns the trigger (it only logs a
     `[tws:checkout] order-confirmed` diagnostic), so no UI change can skip it again;
   - announcements are fire-and-forget with `try/catch` **and** `.catch()`:
     an email failure can never reject, never block and never invalidate a
     committed order.
   - `createCodOrder` now also returns `orderId`, set whenever PostgreSQL
     committed an order (even if the receipt itself was unusable).
2. **`/api/*` can no longer be answered by the SPA fallback.**
   `vercel.json` now uses `"source": "/((?!api/).*)"` — the exact pattern from
   the Vercel KB. `tests/vercel-routing.test.mjs` compiles every rewrite source
   with `path-to-regexp@6.1.0` (the parser Vercel uses) and asserts that
   `/api/order-confirmation`, `/api/admin-new-order` and `/api/email-health` do
   **not** match the fallback while `/`, `/shop`, `/checkout`,
   `/order-confirmation/…` and `/admin` still do.
3. **The trigger is instrumented and cannot fail silently.** One compact console
   line per attempt (`[tws:email] …`) with the endpoint, an 8-character order
   tag, the HTTP status, the response content-type, the elapsed time and a
   reason code. `html-response` means the SPA fallback answered `/api/*`;
   `network`/`timeout` means the request never left the browser. Absolute
   same-origin URLs, `keepalive: true`, and exactly one retry on transport
   failure only (safe: server claim tokens + Resend idempotency keys).
4. **Both API entry points log their invocation.** `api/_lib/log.ts` (new) emits
   two single-line JSON events per request to stdout, which Vercel captures in
   the runtime log:

   ```json
   {"scope":"tws-email-api","event":"request-start","endpoint":"order-confirmation","method":"POST"}
   {"scope":"tws-email-api","event":"order-accepted","endpoint":"order-confirmation","orderTag":"9f8e7d6c"}
   {"scope":"tws-email-api","event":"request-complete","endpoint":"order-confirmation","status":200,"outcome":"ok","ms":412}
   ```
5. **`GET /api/email-health`** (new, `api/email-health.ts`) answers JSON with
   `routed_to_function`, the deployed commit, the Vercel environment and
   booleans for the server env — no secret, no address, no order. Opening it on
   the deployment is the fastest way to separate "routing" from "browser".

No customer data, no secrets and no order contents are logged anywhere: the
diagnostics carry an 8-character correlation tag, and the tests assert that
customer name, email, phone, address, order reference, full order id, the Resend
key and the service-role key never appear in a log line.

## 6. Behaviour that had to be preserved (and was)

| Concern | Status |
| --- | --- |
| COD order creation, `create_cod_order` payload/signature, `.retry(false)` | unchanged |
| `p_checkout_request_id` idempotency + the sessionStorage attempt key | unchanged |
| Receipt validation and every error message returned to the UI | unchanged (`isOrderReceipt` is the previous `receipt()` verbatim) |
| `refreshQuote` codes (`P0001`, `23514`, `23505`) and the `PGRST202` message | unchanged |
| Loyalty, discounts, free-pair rules, stock | untouched (no SQL changes at all) |
| Admin behaviour / admin console | untouched |
| Email claim leases, claim tokens, conditional outcome recording, rate limits, Resend idempotency keys | untouched |
| Receipt page re-triggers the customer email only | unchanged |
| Migration 014 | not touched, not re-applied |

## 7. Deployment and verification steps (do these in order)

1. Boot locally (no production writes):
   ```bash
   npm ci && npm run typecheck && npm test && npm run verify:api && npm run build
   ```
2. Open a preview deployment and check **one** thing, with no order placed:
   ```
   https://<preview>.vercel.app/api/email-health
   ```
   - **JSON** → `/api/*` reaches the functions; routing is correct.
   - **HTML** → the SPA fallback is answering `/api/*`: the rewrite fix in this
     branch is required, and no email could have been sent.
   - **404** → the functions are not deployed (project/root-directory settings).
   - `commit` must equal the deployed commit (it is `unknown` if Vercel did not
     provide `VERCEL_GIT_COMMIT_SHA`), and `env.configured` must be `true`.
3. Promote to production, then open the same URL on the production domain.
4. Place **one** real COD order and watch, in the browser console:
   ```
   [tws:email] trigger            { reason: "order-committed", orderTag: "9f8e7d6c", … }
   [tws:email] request-accepted   { endpoint: "/api/order-confirmation", status: 200, … }
   [tws:email] request-accepted   { endpoint: "/api/admin-new-order",   status: 200, … }
   [tws:checkout] order-confirmed { orderTag: "9f8e7d6c" }
   ```
   and in Vercel → Logs, filter `tws-email-api`: two `request-start` and two
   `request-complete` events with the same `orderTag` must appear. Resend must
   show one send per key `order-confirmation/<order_id>` and
   `admin-new-order/<order_id>`.
5. Decide from the outcome, using this table:

   | Browser console | Vercel function log | Meaning |
   | --- | --- | --- |
   | no `[tws:email] trigger` | none | the browser never reached the new commit path (stale cached bundle, or the order was created outside the storefront). Check `/api/email-health` `commit` against the deployed SHA. |
   | `trigger` but no `request-*` for an endpoint | none | the request was blocked before leaving the browser (extension, offline, firewall challenge). |
   | `endpoint-not-reachable` (`html-response`) | none | the SPA fallback answered `/api/*` — routing, not Resend. |
   | `request-rejected` 403 | none | Vercel Firewall / Bot Protection challenged a `POST /api/*`. Allowlist the path. |
   | `request-rejected` 429/503 | `request-complete` | the function ran and refused honestly (rate limit, claim, Resend, config). The `outcome` field names the reason. |
   | `request-accepted` | `request-complete` 200 | the function ran and Resend accepted the send — then the mail is in Resend, not in the app. |

6. Only after step 4 shows two accepted sends and two Resend entries is the
   production flow verified.

## 8. Tests added

`tests/order-email-trigger.test.mjs` (8 tests)

* a committed order triggers **both** endpoints exactly once, with the minimal
  body and `keepalive`, *even when the receipt is unusable*;
* an email failure — rejecting promise, synchronous throw, or a real network
  error — never changes the returned order and produces no unhandled rejection;
* a rejected write, a missing RPC (`PGRST202`) and a thrown RPC announce
  nothing and keep the existing error/`refreshQuote` contract;
* a non-UUID order id is never sent;
* the browser diagnostics: `trigger`, `request-accepted`, `request-rejected`
  (not retried), `request-failed` (retried once) and `endpoint-not-reachable`
  for an HTML answer, with no full order id in the output;
* `api.ts` owns the commit-path wiring and `CheckoutPage` no longer does;
* the handler logs `request-start` / `order-accepted` / `request-complete` with
  the status and the outcome code, and the log lines contain no customer or
  secret values;
* `GET /api/email-health` returns JSON booleans, and `POST` returns 405.

`tests/vercel-routing.test.mjs` (5 tests)

* every `vercel.json` rewrite source compiles with `path-to-regexp@6.1.0`
  (an invalid pattern fails the whole deployment at build time);
* `/api/*` never matches the SPA fallback while the client routes still do;
* the fallback stays last; every email endpoint has a deployed function file;
* the CSP, `connect-src 'self'` and the admin `no-store` headers are intact.

## 9. Residual risks

1. **The browser is still the trigger.** If a customer's request is blocked
   after the order commits (offline, extension, killed tab), the admin email is
   not sent. The customer email has the receipt-page safety net; the admin one
   does not. A server-side sweep (a cron route that replays
   `claim_email_notification` for orders with no `sent` row) is the durable
   answer and needs its own secret — deliberately not added here, because it
   would require a new environment variable.
2. **`path-to-regexp@6.1.0` is now a devDependency** so the routing test parses
   with the same version Vercel uses. If Vercel changes parsers, revisit.
3. **`/api/email-health` is public.** It reveals only booleans and the deployed
   commit — the same information a reader of this repository has.
