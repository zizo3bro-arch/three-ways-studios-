# Loyalty rewards v2 — implementation and verification record

Migration: `supabase/migrations/011_loyalty_rewards_v2.sql`
Rollback: `supabase/migrations/011_loyalty_rewards_v2.down.sql`
Tests: `tests/loyalty-rewards.test.mjs` (plus the updated `tests/commerce.test.mjs`)

**Status: implemented and verified locally; NOT applied to production, not committed, not deployed.**

## Reward rules as enforced (same-order model)

The milestone order itself receives the reward. Nothing is carried to a later
order except the free pair of pants when the 5th bag contains no pants.

| Order in cycle | Reward on **that same order** | Value |
| --- | --- | --- |
| 1 | none — regular card stamp | — |
| 2 | none — regular card stamp | — |
| 3 | `percent_10` — 10% off order 3 | 10% of discountable subtotal |
| 4 | `percent_20` — 20% off order 4 | 20% of discountable subtotal |
| 5 | `free_pants` — exactly one pair of pants free on order 5 | price of one unit of one pants SKU |

The ladder repeats every five eligible orders (8 → 10%, 9 → 20%, 10 → free
pants). The upcoming sequence number is computed **before** the checkout quote
is generated:

```
loyalty_seq = delivered_eligible_orders + in_flight_eligible_orders + 1
```

In-flight statuses (`pending`, `confirmed`, `processing`, `ready`, `shipped`)
hold the slot so two concurrent checkouts can never both claim milestone 3.
Only `delivered` orders count permanently.

**The 5th-order pair never expires.** Reaching milestone 5 unlocks one free pair
of pants and keeps the customer at milestone 5 until it is actually redeemed.

- No time-based expiry exists anywhere: there is no expiry column, no scheduled
  job, and no inactivity reset. A customer returning after years still sees the
  reward unlocked (covered by a test that ages every row by 3 years).
- A bag with no eligible pants at milestone 5 is an ordinary order at full price.
  It is flagged `orders.loyalty_skipped = TRUE`, gets no `loyalty_seq`, and does
  **not** consume the milestone — the reward stays unlocked for a future order.
- Exactly one pants unit is discounted; every other line and quantity is charged
  normally, and the reward is stored once at order level.
- Delivering a qualifying 5th order redeems the pair and resets the card to
  order 1 of a new cycle.

**Same-order rule.** A reward is only ever applied to the order that reaches its
milestone. Cancelling an order releases its reward; the slot can only be won
again by completing another qualifying order, never by re-using the reward on a
different order.

Every order the ladder issued a sequence to advances it — including a 5th order
whose whole subtotal the free pair pays. That order consumes milestone 5, so the
next checkout is sequence 6 and starts a fresh cycle instead of colliding with
the already-redeemed milestone. Pre-011 orders have no `loyalty_seq` and keep
the historic rule (a fully discounted historic order does not inflate progress),
so upgrading an existing customer never rewrites their ladder.

## Ownership and security

- Every loyalty read and write is keyed by `auth.uid()`. No loyalty path falls
  back to a contact email; the `010` email fallback is gone.
- `public.loyalty_rewards` is keyed by `auth_user_id UUID NOT NULL REFERENCES
  auth.users(id)` with partial unique indexes:
  `(auth_user_id, milestone_seq) WHERE status <> 'released'` and
  `(order_id) WHERE order_id IS NOT NULL AND status <> 'released'`.
  Those two indexes are what make duplicate reservations, duplicate discounts
  and reward reuse impossible at the storage layer.
- RLS: customers `SELECT` only their own rows and hold no
  `INSERT`/`UPDATE`/`DELETE` grant. Admin policies are unchanged. `orders`,
  `order_items` and `loyalty_rewards` have additive customer-read policies;
  `customers` stays admin-only and is reached through the `auth.uid()`-keyed
  overview RPC.
- All mutations happen inside `SECURITY DEFINER` RPCs with an explicit
  `search_path`.
- `quote_cod_order` and `create_cod_order_core` each recompute the ladder
  independently; neither trusts the other's output and neither trusts client
  discount values. `p_redeem_free_reward` remains in the signatures for wire
  compatibility but no longer influences anything: the reward is always applied
  to the milestone order.

## Reservation lifecycle

`reserved` at order creation (plain insert guarded by the unique indexes) →
`redeemed` on delivery → `released` on cancellation. A cancelled order is
excluded from progress and its slot is genuinely re-opened: the next qualifying
checkout takes that same sequence number again and earns the reward legitimately,
because the cancelled order never delivered anything. The cancelled order's own
reward is never reused on a different order — it is `released` and only a fresh
qualifying order can win the slot. Reactivating a cancelled order
whose milestone slot has since been taken fails with *"already used
elsewhere"*. A failed checkout rolls the reservation back with the order
(`create_cod_order_core` runs in a single transaction; verified by
`tws_test_fail_reservation`).

There is no carried state. `available` exists only as the table default before a
row is attached to an order; no RPC ever creates one, and `available_free_pants`
is hard-coded to `0`. Cancelling an order moves every reward it holds to
`released`, so the same discount can never be reused on a different order.

## Free-pants restriction

`loyalty_is_pants()` matches the product category, slug or name (`pant`,
`trouser`, `denim`, `jeans`). The benefit helper selects **one** eligible pants
line from the submitted bag — highest price first — and discounts exactly one
unit of it. A tee-only bag reports `free_reward_available: false` and the order
grants the pair for later use instead. The order stores the discounted product,
variant and name for audit (`loyalty_free_reward_product_id`,
`_variant_id`, `_product_name`).

## Non-stacking

A loyalty reward and the one-time 10% email discount never combine. Email
eligibility is always computed (so the UI can say "both available, they do not
stack"), but the email discount is only *applied* when no loyalty percentage or
free-pants reward is on the order.

## API surface added by 011

- Orders: `loyalty_seq`, `loyalty_discount_percent`,
  `loyalty_free_reward_product_id`, `loyalty_free_reward_variant_id`,
  `loyalty_free_reward_product_name`.
- Helpers: `loyalty_reward_type_for_seq`, `loyalty_reward_label`,
  `loyalty_is_pants`, `loyalty_qualifying_count`, `loyalty_in_flight_count`,
  `loyalty_next_order_seq`, `loyalty_checkout_benefits`.
- RPCs rewritten: `quote_cod_order` (both arities), `create_cod_order_core`,
  `get_order_confirmation`, `get_customer_account_overview`,
  `admin_update_order_status`.

## Verification run locally

- `npm test` — 14 tests, 14 pass: `commerce.test.mjs` (3, including the
  existing checkout regressions and the same-order loyalty ladder),
  `loyalty-rewards.test.mjs` (10, including 3-year persistence and a full
  orders 6-10 cycle), `frontend.test.mjs` (1).
- `npm run typecheck` — clean.
- `npm run build` — `tsc -b` and the Vite production build pass.
- `011` re-applies twice on the same database and its down migration restores
  the `010` state.

Milestone results with the fixture catalog (tee 2450, pants 2650, hoodie 2650;
free shipping ≥ 3500, otherwise 75):

| Order | Milestone | Quote / order total |
| --- | --- | --- |
| 1 | regular | 2525 |
| 2 | regular | 2525 |
| 3 | 10% off (245) | 2280 |
| 4 | 20% off (490) | 2035 |
| 5 | one pair of pants free (2650) | 75 (pants-only bag) |
| 6 | regular — new cycle | 2525 |

Order 5 above is a pants-only bag, so its own reward covers the whole subtotal.
It still consumes milestone 5 and rolls the card into cycle 2; two orders later
(sequence 8) the new cycle's 10% arrives, verified by the cycle-rollover test.
Orders 6-10 repeating the full ladder are verified by the second test account.

## Not done / blockers before production

- Migration `011` has **not** been applied to the Supabase project; production
  still runs `010` semantics.
- Nothing has been committed, pushed or deployed; no Vercel status has been
  checked.
- Pants detection was audited against the **live** catalog (read-only): both
  published products (`denim` "Denim bootcut" / Women's Pants and
  `denim-row-black` "Denim row black" / Pants, 3 active variants each) are
  detected, and tee/hoodie/tote/skirt fixtures are correctly rejected. Any
  future pants product must also carry a pants keyword in its category, slug or
  name or it will not be reward-eligible.
- The `010` `loyalty_reward_redemptions` table is preserved but is no longer
  authoritative; historical free-product rows are converted into `redeemed`
  `free_pants` audit rows and no reward is reissued.
- Browser/device checks of the updated account and checkout copy have not been
  run.
