# Fix — "Could not find the function public.loyalty_program_preview"

2026-11-19 · project `nujowlxvfpklylhglzse` · PR #22

## Symptom

Admin → Discounts → **Loyalty card programme** showed the raw PostgREST error

> Could not find the function public.loyalty_program_preview without parameters in the schema cache

with the chip stuck on **Reading…** and the third-stamp / fourth-stamp fields empty.

## Root cause

The function did not exist. Not a signature mismatch, not a stale schema cache, not a
wrong-parameter call.

| Check | Result at the time |
| --- | --- |
| `pg_proc` rows for `loyalty_program_preview`, `admin_update_loyalty_program`, `admin_loyalty_program_history`, `admin_adjust_stock`, `admin_customer_profile`, `admin_order_activity` | **0** |
| `loyalty_program_versions`, `admin_audit_log`, `stock_movements`, `order_status_history`, `order_admin_notes`, `order_refunds` | **absent** |
| New `site_settings` / `products` columns | **absent** |
| `supabase_migrations.schema_migrations` | stopped at `loyalty_rewards_v2` (011) |
| Frontend call | `rpc('loyalty_program_preview')` — no arguments |
| Committed signature | `public.loyalty_program_preview()` — zero parameters |

The console had been deployed to Vercel **while the database still sat at 011**. The previous
report said the migrations were pending; the app therefore called a function nobody had created.
PostgREST's wording is generic: it prints "without parameters in the schema cache" for *any*
missing function, which is why it reads like a parameter problem when it is not.

Why the build was green: every test builds its own disposable PostgreSQL and applies the
migration files. They prove the SQL is correct; they cannot prove the SQL was ever run against
the project the browser talks to.

## Fix

1. **Applied the two committed migrations, in order**, to the live project: `012_loyalty_delivery_unlock.sql`
   then `013_console_operations.sql`. No new migration was written and no function was duplicated.
2. **Fidelity check.** After applying, every function body was compared with the committed file
   using `md5(prosrc)`:

   | Function | Body md5 matches file |
   | --- | --- |
   | `audit_loyalty_version`, `loyalty_percent_for_seq`, `loyalty_slot_taken`, `loyalty_in_flight_count` | ✅ |
   | `loyalty_checkout_benefits`, `get_customer_account_overview`, `loyalty_program_preview`, `admin_update_loyalty_program`, `admin_loyalty_program_history` | ✅ |
   | `sync_product_status`, `record_order_status`, `admin_add_order_note`, `admin_order_activity`, `admin_record_refund`, `record_stock_movement`, `admin_adjust_stock`, `admin_list_stock_movements`, `admin_customer_profile` | ✅ |

   (Two bodies drifted by comment text / one predicate on the first pass; both were re-sent and now
   hash identically to the repository files.)
3. **Schema cache.** Both migrations finish with `NOTIFY pgrst, 'reload schema'`, inside the same
   transaction as the objects, so PostgREST reloads once they commit.
4. **Migration history.** Recorded as `20261119231400 loyalty_delivery_unlock` and
   `20261119231500 console_operations`, matching the project's existing convention (`011` is
   recorded as `20261119172358 loyalty_rewards_v2`).
5. **UI (PR #22).** The chip now says *Programme unavailable* instead of *Reading…* when the request
   fails; a missing function is explained in plain words ("the console is deployed but the database
   migration has not been applied; nothing was changed") with the verbatim database message
   underneath and a *Try again* button; the percentage, date and reason fields stay disabled until
   the real values load, so an empty field can never be saved over a configured programme.
6. **Regression test.** `every RPC the console and storefront call exists in the database` walks
   every `rpc('…')` in `src/`, asserts each function exists exactly once, asserts the argument names
   PostgREST matches on, and calls `loyalty_program_preview()` for the real ladder. Verified it fails
   against a database without 013 (`admin_adjust_stock`, `admin_customer_profile`,
   `admin_order_activity`, `admin_list_stock_movements` reported missing).

## Data safety

| | Before | After |
| --- | --- | --- |
| orders | 5 | 5 |
| products | 2 | 2 |
| customers | 6 | 6 |
| product_variants (units in stock) | 6 (60) | 6 (60) |
| loyalty_rewards | 0 | 0 |

No row was updated or deleted. The new tables started empty; `order_status_history` gained one
opening row per existing order (5). `products.product_status` was derived from `is_published`, so
both products stayed published.

## Live verification (against the project, as the browser would call it)

Run as role `authenticated` with `request.jwt.claim.sub` set to the admin account — the same
identity path PostgREST uses:

```
select public.loyalty_program_preview();
→ milestones: 1 Regular price · 2 Regular price · 3 "10% off" (10) · 4 "20% off" (20) · 5 "One free pair of pants"
→ milestone_3_percent 10, milestone_4_percent 20, milestone_5_reward_type "free_pants",
  effective_from 2026-11-19T23:03:14Z, pending_change null
```

Editing, with the current numbers (so no customer-facing value changed):

```
select public.admin_update_loyalty_program(10, 20, now(), 'Live check after the panel fix: …');
→ returns the same ladder, effective_from 2026-11-19T23:13:21Z
```

History then contains one row, attributed:

```
action loyalty_program.version_added · actor_email zizo3bro@gmail.com
detail { milestone_3_percent 10, milestone_4_percent 20, milestone_5_reward_type free_pants, reason "Live check …" }
```

Authorization still holds: calling `admin_adjust_stock` as `anon` is refused with
`Unauthorized: Admin access required.`

## What I could not do here

I could not sign in to the deployed console: this environment has no browser, and the admin area
needs your session. Everything above is the database and the deployment, not a rendered page.

Ten-second check on your side: reload **Admin → Discounts**. The heading should show
*In force from 19 Nov 2026*, the five-stamp ladder (Regular, Regular, 10%, 20%, One free pair with
"Unlocked after stamp 4"), the two percentages pre-filled with 10 and 20, and *Programme history*
showing the entry above. If it still shows *Programme unavailable*, send the message under the
banner — it is the database's own words and identifies the next missing object.

Note: the free-pair reward itself is not editable, by design — stamp 5 is CHECK-locked to
`free_pants` in `loyalty_program_versions`, because a customer already standing at 4/5 has been
promised a pair.
