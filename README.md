# Three Ways Studios

The existing React 19 / Vite / TypeScript storefront and staff console for Three Ways Studios, Cairo. The 2026 campaign is laid out on one continuous ivory paper surface. The crimson lettering is live SVG type with an aerosol filter; the signature, grain and campaign plates were isolated from the approved artwork. The emblem is an optimized copy of the project's official transparent logo. The hero is not a banner or screenshot.

## Run and verify

```sh
npm ci
cp .env.example .env.local  # set the existing project's PUBLIC Supabase URL and anon key
npm run dev
npm run typecheck           # checks BOTH TypeScript project references
npm run build
npm test                    # actual PostgreSQL functions, transactions and RLS (PGlite)
npx playwright install chromium
npm run test:e2e             # production-mode test build, Chromium + local SQL fixture
```

`CHROMIUM_PATH` may point Playwright at an already-installed Chromium. The test build, screenshots and temporary outputs live under ignored `.verify/`. Nothing from the test transport or its inventory is included in the deployed app. Never put a service key or a staff password in `VITE_*` variables.

## Storefront

| Surface | Implementation |
| --- | --- |
| `/` | Campaign, four published products in catalog order, email-only studio list, colophon. Four across on desktop; two across on the narrowest phones. |
| `/shop`, `/collections`, `/collections/:slug` | Existing stock/new filters, price sort and collections derived from the published catalog. |
| `/product/:slug` | Fresh slug-specific read of `products`, `product_images`, active `product_variants` and **`size_charts`**. The native horizontal scroll-snap gallery preserves vertical scrolling and zoom. Arrow keys, arrows and thumbnail pagination work independently. One photo never gets an invented second view. |
| `?piece=slug` | Linkable quick view with the same purchase options as the full page. |
| Bag, `/cart`, `/checkout` | Existing `tws_cart_v2` bag with genuine variant IDs. Stock limits, exact size/color matching and current quotes. A full-row native COD radio is the only payment choice. |
| `/order-confirmation/:orderRef` | Re-reads a saved receipt with the order reference and checkout email. Never trusts legacy local/session-storage orders. |
| `/about`, `/journal`, `/journal/:slug`, `/terms`, `/privacy` | House and service information, existing studio writing and shop policies. |
| Customer account | Customer bag, locally saved pieces and reference + email order lookup. No staff links or staff sign-in. |
| `/admin`, `/admin/login` | Independent, lazy staff application. The existing password-based Supabase Auth session and `admin_users` membership gate all dashboard tabs. Public reads use a separate non-persistent anonymous client. RLS and checked RPCs, not navigation, enforce permissions. |

**Catalog integrity:** Configured builds never substitute campaign photos or demo IDs for a failed, empty or unpublished database result. Builds without a connection can show the *printed* campaign as a labeled, read-only lookbook. It contains no stock or purchasable variants. Missing connectivity cannot produce a receipt, an estimated “verified” quote or a successful subscription. No migration seeds merchandise.

**Newsletter:** A single normalized `INSERT` into `newsletter_subscribers` with no `SELECT`/`UPDATE` requirement. Unique-email conflict is reported as already subscribed; other errors are not successes.

## Database and rollout

- **Existing installation:** review and apply [`007_cod_checkout.sql`](supabase/migrations/007_cod_checkout.sql) to the existing Supabase project through its authorized migration workflow. Do not reinitialize a live database. If staff hardening has not yet been installed, use `006_admin_hardening_safe.sql`, **not** its superseded `005` predecessor.
- **New, empty installation only:** `supabase/full_setup.sql` includes the current storefront schema and COD functions. Apply the safe `006` staff hardening as documented in that file. Retain the existing staff registration process (Auth user UUID → `admin_users`), RLS, and public `product-images` bucket.
- The transaction in `007` retains the original RPC signatures, product IDs, stock and order history. It types the previously unassigned no-promo discount record, adds `orders.shipping_cost` (zero for historical rows), and calculates the existing EGP 75 / free-from-EGP 3,500 delivery rule on the **server** for new quotes and orders. Do not add shipping to a returned total in JavaScript. Quote, courier total, saved order and later lookup must agree.
- The new `create_cod_order` overload accepts `p_payment_method` and rejects anything except COD. The original 9-argument COD RPC remains available. Only a PostgREST **missing-signature** response permits the frontend to use the old signature; the selected method is also carried in its JSON line payload. A failed or ambiguous write is never automatically retried. Legacy installations without `007` keep their own server totals; unpatched historical RPCs can reject no-promo orders.
- Newsletter requires the existing public INSERT policy and grant, not broader read access. Do not relax policies in response to a failed request.

**Project URL:** use the project's API origin (`https://<project-ref>.supabase.co`), not the Supabase management dashboard. A copied Data API endpoint ending in `/rest/v1/` also works: the client removes the API suffix before the SDK constructs REST, Auth and Storage URLs. Double-appending the route returns “Invalid path specified in request URL” even if Vercel built successfully. Editing `VITE_*` variables requires rebuilding the deployment.

**Deployment:** use the linked GitHub → Vercel project and its existing `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`. `vercel.json` preserves SPA rewrites, the content security policy and private admin response headers. Merge by pull request; Vercel builds the production branch. A successful Vercel deployment is not proof that a database migration ran. After applying `007`, use a whitelisted test order/customer and an approved address to check the receipt total, stock decrement and newsletter row in the same Supabase project. Cancel the test order through the staff console to restore stock; do not place real test orders without coordinating with fulfillment.

See the [reference comparison and test scope](docs/design-proof/README.md). Browser tests run against a disposable database with the actual SQL. They do not sign in with real staff credentials, write customer orders or subscribe addresses in production.
