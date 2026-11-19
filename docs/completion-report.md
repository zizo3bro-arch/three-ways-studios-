# Completion report — store console, website CMS, delivery-based loyalty

Date: 2026-11-19 · Branch: `arena/9663b723-three-ways-studios` · Base: `16ba294`

---

## 1. Status in one paragraph

The storefront, the Studio Console and the loyalty rules are written, tested and merged to `main`;
Vercel built the production deployment successfully. **Two things are deliberately not done and must
not be reported as done:** (a) **the two new migrations are not applied to the live Supabase project**,
so production still runs the previous loyalty semantics — this is a direct consequence of the rule
that Arena must not write to Supabase outside the agreed pipeline; and (b) **no screenshots were
captured**, because no browser can be installed in this environment. Everything below says exactly
which parts are verified, how, and what remains for you to run.

---

## 2. Git and deployment

| Item | Value |
| --- | --- |
| Feature commit | `8a26d51` — *Store console: products, inventory, orders, CRM, loyalty programme and website CMS* |
| Follow-up commit | `fda2e2a` — *one-command visual verification script + browser limitation doc* |
| PR #19 | merged, merge commit `da3e5cbe7094c5d8e4d8c218fc75fb3b035edb96` |
| PR #20 | merged, merge commit `cd6455a5014a4dafd922869dfb33566832f65728` |
| Vercel production build (PR #19) | **success** — https://vercel.com/zizo3bro/three-ways-studios/BPKvbJaFGhPw8VdnWiteuYoQ28hX |
| Vercel production build (PR #20) | **success** — https://vercel.com/zizo3bro/three-ways-studios/4w1LkrRHavApenJfByYqw4cPrLqe |
| Production URL | https://three-ways-studios.vercel.app |

The sandbox has no network route to `vercel.app`, so the live page was **not** fetched from here.
Deployment success comes from the Vercel status check on the merge commit, not from loading the site.

---

## 3. Migrations (must be applied, in this order)

| File | SHA-256 | Purpose |
| --- | --- | --- |
| `supabase/migrations/012_loyalty_delivery_unlock.sql` | `b964edf73e69de8bddd018bc5b5da1727d89abc5a4168518edcb631c326718a2` | Delivered-only ladder, append-only programme versions, audit log |
| `supabase/migrations/013_console_operations.sql` | `e14288b87a3ff7f414272c1f9f960731da31298b1222b4fcd041eb47b31b5dc8` | Product status + tags, stock ledger, order history, notes, refunds, customer profile, CMS fields |
| `supabase/migrations/012_loyalty_delivery_unlock.down.sql` | — | Rollback; then re-apply `011_loyalty_rewards_v2.sql` |
| `supabase/migrations/013_console_operations.down.sql` | — | Rollback |

All three are **additive**: new columns with defaults, new tables, new functions. No `DROP TABLE`, no
`DELETE`, no `UPDATE` of existing customer, order, product, inventory or loyalty rows. Re-running them
is safe (`IF NOT EXISTS`, `CREATE OR REPLACE`).

Live project `nujowlxvfpklylhglzse` today: 4 orders, 2 products, 4 customers, 0 loyalty rewards,
`has_012 = false`, `has_013 = false` (checked read-only).

### Apply

```sql
-- in the Supabase SQL editor, project "Three ways Studios"
-- 1. paste 012_loyalty_delivery_unlock.sql   → Run
-- 2. paste 013_console_operations.sql        → Run
```

### Verify immediately after (paste as-is)

```sql
select
  (select count(*) from loyalty_program_versions)          as programme_versions,   -- expect 1
  (select count(*) from products)                          as products,             -- unchanged
  (select count(*) from orders)                            as orders,               -- unchanged
  (select count(*) from loyalty_rewards)                    as rewards,              -- unchanged
  (select count(*) from order_status_history)              as history_rows,         -- one per existing order
  (select product_status from products limit 1)            as sample_status;        -- 'active' or 'draft'
```

Expected: the counts of products/orders/customers/rewards are **identical to before**, and
`programme_versions` has exactly one baseline row (10% / 20% / one free pair).

### Until 012 and 013 are applied

* Checkout still uses the **old same-order ladder** (an order that is placed, not delivered, advances
  the card). This is the rule you asked to change, so **do not announce the loyalty change as live**
  before step 3 succeeds.
* The console's *Website content* tab and *Loyalty programme* panel will show a database error
  (missing column / missing function). The panels fail loudly, not silently; nothing is corrupted.
* The storefront is unaffected: missing settings fall back to the studio defaults.

---

## 4. What changed, part by part

### PART 2 — Products
* `products.product_status` (`draft` / `active` / `archived`) with a trigger that keeps
  `is_published` in lockstep, so the old storefront query and the new console can never disagree.
  Existing rows were derived, not guessed: `is_published = true` → `active`.
* `products.tags TEXT[]` (max 12 in the UI) for search/filters.
* Console: status select per row and in the editor, archive asks for confirmation first, tags field
  with helper text. Editing an archived piece does **not** republish it.
* Multi-image upload/replace/delete/reorder/primary and per-size stock already existed; untouched.

### PART 3 — Inventory
* New `stock_movements` ledger: quantity before/after, delta, source (`manual` / `order` /
  `cancellation` / `automatic`), reason, note, actor id + email, timestamp.
* `admin_adjust_stock(variant, delta, reason, note)` — admin only, rejects zero, rejects `|delta| > 10000`,
  requires a reason, refuses to go below zero. **No override exists**: negative stock is refused here
  *and* by the pre-existing `product_variants_stock_quantity_check`, so the ledger always explains the shelf.
* Console: cross-product view with search (product, colour, size, SKU), low/out filters, unit totals,
  ± quick buttons, "set to" correction, mandatory reason, optional note, per-row saved state, stock
  history with author and time, CSV export.

### PART 4 — Orders
* `order_status_history` with a trigger on every status change (who, from, to, when), backfilled with an
  opening row per existing order. A repeated change to the same status writes nothing.
* `order_admin_notes` (append-only, internal only, never exposed to customers).
* `order_refunds` (append-only): requires a cancelled order, a reason of 3–300 characters, and cannot
  exceed the order total in total. Written only through `admin_record_refund`.
* Console: search by reference/name/email/phone (as before), **new** date-range filter, CSV export,
  printable A4 order sheet, status timeline, notes, refund records, and the loyalty rule printed right
  next to the status selector: *counts once, only when set to Delivered*.
* **Rule unchanged and enforced server-side**: stamps come from `status = 'delivered'` only, exactly
  once per order; `pending` / `confirmed` / `processing` / `shipped` never count; `cancelled` never counts.

### PART 5 — CRM
* `admin_customer_profile(auth_user_id)` returns profile, metrics (orders, delivered, lifetime value,
  average order), the loyalty snapshot (qualifying purchases, progress in cycle, cycle number, next
  reward + availability, free-pants flag, reward history) and the order list — computed by the same
  server function the customer's own account page uses, so the two views cannot disagree.
* Console: card visual, 5 circles, metrics, reward history, and a "read only" statement.
* Corrections are **not** offered anywhere: there is no RPC, policy or grant that lets an admin edit
  progress. The audit table and programme versions are append-only, and `authenticated` has no
  INSERT/UPDATE on `loyalty_rewards`, `stock_movements`, `order_refunds` or `admin_audit_log`.
* Customer RLS is untouched; a customer sees only their own account, and cannot call any admin RPC.

### PART 6 — Discounts and loyalty settings
* Append-only `loyalty_program_versions` (`milestone_3_percent`, `milestone_4_percent`,
  `milestone_5_reward_type` **CHECK = 'free_pants'**, `effective_from`, `reason`, `created_by`).
  Active programme = newest version with `effective_from <= now()`; a future date schedules a change
  without disturbing the current one (a pending change is shown, not applied).
* `admin_update_loyalty_program` requires admin, a reason (≤300 chars) and percentages in 1–90;
  past/immediate dates are pinned to server `now()` so "apply now" really is now.
* The fifth stamp **cannot** be turned into a percentage — the CHECK constraint refuses it.
* Console panel: the ladder, scheduled change warning, preview of the exact numbers, explicit
  confirmation step, history with author/reason/time.
* Nothing retroactive: no order is repriced, no card is recalculated; progress already earned stays.
* **Gap, stated plainly:** discount *codes* remain percentage-based with start/end, limits, minimum
  order, enable/disable and usage history (as the schema supports). **Fixed-amount codes and
  product/category-scoped codes are not implemented** — they require rewriting the server pricing
  functions, which was too risky to change inside this pass. This is the one product requirement not
  delivered.

### PART 7 — CMS
* `site_settings` gained: hero image URL, hero CTA destination, newsletter description + button label,
  contact email + phone, WhatsApp link, announcement text + switch, ordered `social_channels` JSONB
  (seeded from the existing flat map, six channels, per-channel `enabled`), `content_blocks`,
  `home_collection_mode` (`catalog` / `featured`), `home_collection_limit` (1–48, CHECK-constrained).
* Console: sectioned editor (Homepage hero / collection rail / newsletter / footer & contact /
  store messages / navigation / social & contact / storefront copy) with human labels, one-line
  explanations, per-field validation, unsaved-vs-published chips, Discard, live preview of the hero,
  nav and footer, and hero-image upload (own `site/` prefix in storage — product images untouched).
* Navigation and footer are edited as ordered rows (add / move / remove), **not** JSON, so no code or
  markup can be injected. Destinations are validated: a site path or an `https://` URL, nothing else.
* Social icons are individually switchable; a disabled icon disappears; an invalid URL falls back to
  the studio's configured profile rather than shipping a broken link.
* Storefront now reads all of it: hero CTA/label/image, newsletter copy, contact email/phone in the
  footer and on policy pages, per-channel social row, homepage rail source + limit, and five
  empty-state strings (bag, shop, account orders, rewards note, policy contact).

### PART 8 — Admin UX
Crimson/paper aesthetic throughout: hairline borders, uppercase tracking, Anton headings — no generic
SaaS chrome. Every destructive action confirms or states its consequence; every async area has a
loading state, an empty state and a retry; errors show the database's own message; unsaved changes are
explicit and discardable; forms are labelled and bounded.

### PART 1 — Mobile homepage
Hero on phones: `min-height: calc(100svh - header)` with the paint block at `clamp(300px, 88vw, 470px)`
and more breathing room above and below — texture, colours and type unchanged, desktop untouched.
Collection plates: at ≤639 px the two-column grid stays, plate aspect drops to `0.6` and the garment is
bottom-anchored so the piece, not the empty canvas, defines the card; names and prices unchanged.

### PART 2 (message 2) — Loyalty card
* Artwork is **exactly** the supplied two-face image (`loyalty-card-front.png`,
  `loyalty-card-back.png`), never recreated, never a CSS gradient, never stretched.
* Back face first → automatic single flip after 900 ms once visible → front stays; tap toggles;
  `prefers-reduced-motion` skips the animation and shows the front.
* Five circles are positioned from the artwork geometry and are driven by server progress; the card
  renders immediately and never waits on the loyalty request.
* Account page: greeting, card centrepiece with `x/5`, one sentence about the next reward, unlocked
  state, a quiet milestone ladder, clean order cards, tracking collapsed to a `<details>`.

---

## 5. Verification actually performed

```
npm test            → 30 / 30 passing, 0 failing
npm run typecheck   → clean
npm run build       → clean (index 310 kB, admin 135 kB; no new warnings)
```

Test inventory (all against real repository SQL in a disposable PostgreSQL, not mocks):

| Suite | Tests |
| --- | --- |
| `tests/commerce.test.mjs` | 3 — COD checkout, delivery, discounts, receipt privacy, staff policies |
| `tests/loyalty-rewards.test.mjs` | 12 — never-double-count, reservations, migration re-apply, cross-customer isolation |
| `tests/loyalty-unlock.test.mjs` | 11 — 1→4/5 ladder, free pair available **at 4/5**, multiple-pants order costs only one pair, no-pants order keeps the reward, cancelled never counts, repeated Delivered never double-counts, programme reconfiguration + audit |
| `tests/console.test.mjs` | 5 — status sync, stock ledger (manual/order/cancellation, reason required, negatives refused by RPC *and* constraint), order history/notes/refunds, customer profile parity + read-only, CMS defaults & social order |
| `tests/frontend.test.mjs` | 1 (large) — SSR of homepage, shop, about, account, card geometry, CSS contracts |

Not performed, and therefore not claimed:
* **No screenshots.** Chromium cannot be downloaded here (`ECONNRESET` from `cdn.playwright.dev`);
  no system Chrome, `headless_shell`, `wkhtmltoimage` or `weasyprint`. `tests/visual.spec.mjs` is
  committed and `npm run test:visual` produces every requested image on a machine with a browser —
  see `docs/visual-verification.md`.
* **No live admin workflow against production data.** Doing so would require applying the migrations
  first, and writing to the live project from here is exactly what the pipeline rule forbids.
* **No live page load.** `vercel.app` is not reachable from this sandbox.

---

## 6. Your next four steps

```bash
# 1. apply the two migrations (SQL editor, in order: 012 then 013)
# 2. run the verification query in section 3 and compare counts with the values logged above
# 3. check the console and the storefront in the browser
npm run test:visual        # 4. produces the screenshots incl. 2/5 → 3/5 → 4/5 and the card faces
```

Step 3 in detail: sign in to `/admin` → **Website content** (edit the tagline, publish, confirm the
storefront shows it) → **Products** (set a piece to Draft, confirm it leaves `/shop`, set it back) →
**Inventory** (adjust stock with a reason, open Stock history, find your email) → **Orders** (open one,
read the history, add a note) → **Discounts** (open the loyalty panel, preview a change, read the
history). Then place a real COD order, mark it Delivered, and reload `/account` — the card should
stamp once, and a second "Delivered" must not add a second stamp.
