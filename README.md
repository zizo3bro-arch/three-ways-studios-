# THREE WAYS STUDIOS

The storefront for **THREE WAYS STUDIOS** — an independent Cairo fashion house built around architectural wide-flare denim. The site is one cinematic sequence on warm ivory paper: the campaign frame, a smouldering brand chapter, the collection, then the pieces. Not a Shopify template.

- Canvas: warm ivory `#F4F1E9` · plates: white `#FFFFFF` · ink `#16130F` · crimson `#BE1119`
- Type: **Anton** (titan display) · **Alex Brush / Hurricane** (handwritten lockup) · **Newsreader** italic (editorial) · **Plus Jakarta Sans** (UI)
- Motion: line-mask headline reveals, clip-path uncovers, slow parallax, two static blur passes for the spray paint — opacity + transform only, `prefers-reduced-motion` respected throughout

---

## 1. The experience

| Section | What it does |
| --- | --- |
| **Hero — campaign frame** | Ivory paper, giant crimson **spray-painted `THREE WAYS`** (three stacked blur layers + overspray speckle, `mix-blend-mode: multiply` so the paint sits *in* the paper), the white handwritten `Three Ways Studios®™` signature with its flourish, minimal nav, `FASHION / BEYOND / LIMITS.` + scroll cue bottom-left, `NEW / COLLECTION / / 2026` + `SHOP NOW` pill bottom-right. Type is 19vw and bleeds to the edges on every breakpoint. |
| **Chapter 01 — brand** | Full-screen cinematic statement (`WE CUT / THE LEG / LONG, WIDE / AND LOUD.`) over slow-moving red smoke. Line-by-line mask reveal, restrained drift, nothing else. |
| **Chapter 02 — the collection** | The campaign plate uncovers with a clip-path wipe while the image breathes on scroll; title, short description, spec sheet, **DISCOVER THE COLLECTION** → `/collections`. |
| **Chapter 03 — the pieces** | Only now the product: two monumental plates of the real studio photography, `S–XL` selection with live stock, quick add, save, and quick view. |
| **Chapter 04 — the journal** | House writing, masthead layout, links to real entry pages. |
| **Studio list** | Newsletter with validation + the `WELCOME10` code, wired to the real subscription path. |

Interior pages: `/shop` (filter + sort), `/collections` and `/collections/:slug` (built from `products.collection_name`), `/product/:slug`, `/about` (manifesto, size table, service), `/journal`, `/journal/:slug`, `/checkout`, `/order-confirmation/:ref`, plus a designed 404.

### Red smoke

`SmokeField` composites the real smoke plate (`/media/red-smoke.jpg`) twice, multiply-blended and blurred, plus two crimson hazes. It is **section-scoped** (brand chapter at full strength, soft/low behind the collection and the studio list) — never a global tint. Animation is `transform` only; the blur is baked into the layer, so it costs nothing per frame, and the soft variant renders a single layer on mobile.

### Fixed visual identity

The palette is defined once in `@theme` and **no product data feeds it**:

- `ColourChip` (`src/components/ui/ColourChip.tsx`) is the colour display element: a **permanently white** square with a hairline border, used identically on the plate, quick view, PDP, bag, checkout and receipt. The garment colour is communicated as **words** (`Midnight Navy`, `Onyx Black`), never as paint.
- Selecting a piece or a size changes images and copy only — backgrounds, section colours and the swatch never change.
- `color_hex` survives only as order/customer data (what the courier ticket needs); it is not read by any storefront component.

---

## 2. What this rebuild fixed

The previous implementation had structural and functional problems; each is resolved rather than restyled:

1. **Fake navigation** — `PRODUCTS · COLLECTIONS · ABOUT · CHECKOUT` were anchor-scroll buttons (Collections scrolled to a one-line strip, About scrolled to the newsletter form, Checkout did not belong in the nav). Now: four links to four real routes, plus a working `SHOP` menu.
2. **Decorative icons** — Search and Account did `scrollIntoView`. Search now opens a real indexed overlay (pieces + journal + pages, arrow keys, Enter, no-results state, recent searches); Account opens saved pieces, the bag summary and an order lookup that calls the actual confirmation query.
3. **Admin content was dead weight** — `site_settings.nav_links` was never read. Nav/footer links, hero copy, the collection label, newsletter text, tagline, copyright and socials are now consumed through `buildNavLinks` / `resolveNavPath`, which drops any path that does not resolve, so a bad setting cannot produce a dead link.
4. **No product pages** — `fetchProductBySlug()` existed with related-product logic but no route used it. `/product/:slug` now uses the API layer, and quick view is URL-driven (`?piece=slug`) so it survives refresh and the Back button.
5. **Product colour leaking into the interface** — swatches were `backgroundColor: colorway.hex` / `item.color_hex`. Replaced by the fixed white `ColourChip`.
6. **Cart bug** — `addItem` set the `exceeded` flag *inside* the state updater and read it immediately after, so the "max stock added" message was unreliable. Stock and clamping are now computed synchronously from a ref mirror of the bag.
7. **Global smoke + three different off-whites** — smoke painted every page (including checkout) and the canvas disagreed between `#e6e3dc`, `#e8e5df` and `#F5F2EB`. One ivory token now drives `html`, `body`, the layout and `theme-color`.
8. **Dead code** — `AmbientSmoke`, `heroGate` (`HERO_UNLOCK_EVENT` unlock flow that unlocked nothing), `sizeFinder` (a second, unused size engine competing with `fitCalculator`), the unused `WishlistProvider`, and the `ProductDetailsView`/`ProductsSection` pair were removed; the wishlist provider is now actually consumed.
9. **Wasted preloads** — `index.html` preloaded both 670 KB product PNGs at `fetchpriority=high` for a hero that no longer shows products. Removed; the hero paints with type + CSS only.
10. **No mobile navigation** — the nav simply overflowed under 640 px. There is now a menu sheet with the same destinations, the bag count, search and account.
11. **Broken links** — `/#products` targets (old InformationSection CTA, confirmation page CTA, empty-bag CTA) and settings defaults pointing at non-existent `/contact` are gone.
12. **Checkout correctness** — added real field validation (Egyptian mobile pattern), per-field errors, and the delivery/shipping line is shown in the bag as well as at checkout, so `EGP 75 / free over 3,500` is never a surprise.
13. **Accessibility** — skip link, one `<main>` per page, focus trap + focus restore + `Escape` in the shared `Overlay` (bag, search, account, menu, quick view), `aria-pressed`/`role="radio"` on size and save controls, `aria-live` add-to-bag toast, no interactive elements nested inside anchors.
14. **Performance** — no animated filters, no per-frame `blur()`, no scroll listeners doing layout (parallax runs on a spring-mapped `useScroll`), lazy route chunks, `aspect-ratio` locked media boxes so nothing shifts, and `will-change` only where a transform is actually animated.

---

## 3. Architecture

```
src/
  App.tsx                     providers, routes, titles, scroll + skip link, shell overlays
  components/
    home/                     HeroSection · BrandChapter · FeaturedCollection · PiecesSection · JournalTeaser · StudioListSection
    layout/                   Navbar · MobileMenu · SiteFooter · CartDrawer · SocialLinks · PageIntro
    overlays/                 SearchOverlay · AccountPanel
    shop/                     ProductPlate · QuickView · SizeRow (+ FindSizeModal)
    ui/                       Overlay · Reveal · Parallax · SmokeField · SprayType · Emblem · ColourChip · ScrollProgress
  context/                    Cart · Wishlist · Auth · SiteSettings · UI (overlay + quick view state)
  data/                       demoProducts (real records) · catalog (editorial framing, sizes, images) · journal · navigation
  hooks/                      useCatalog · useAddToBag
  lib/                        api (quote/create/confirm) · format · fitCalculator · scrollLock · supabase · motion
```

Order flow is unchanged in substance: `quote_cod_order` → `create_cod_order` → `get_order_confirmation` PostgreSQL RPCs (pricing, 10% email privilege, promo validation, atomic stock locking) with a local-order fallback when Supabase is not configured, so the demo is fully clickable.

Optional local check: `npx vite build -c vite.smoke.config.ts && node .smoke/smoke.mjs` renders every route through `react-dom/server` and asserts the expected markers (output is git-ignored).

---

## 4. Supabase backend setup

1. Create a project at [supabase.com](https://supabase.com).
2. In the **SQL Editor**, run `supabase/full_setup.sql` (or `001_schema.sql` → `004_initial_config.sql` in order). This creates the tables (`products`, `product_images`, `product_variants`, `product_size_charts`, `customers`, `orders`, `order_items`, `discount_rules`, `discount_usage`, `newsletter_subscribers`, `site_settings`, `admin_users`), strict RLS via `public.is_admin()`, the COD RPCs, the public `product-images` bucket, and the default `EMAIL10` rule + `site_settings`.
3. **Admin user** — Authentication → Users → *Add user*, copy the UUID, then:
   ```sql
   INSERT INTO public.admin_users (id, email, full_name, role)
   VALUES ('YOUR-AUTH-USER-UUID', 'your-admin-email@example.com', 'Studio Admin', 'super_admin');
   ```
4. **Storage** — confirm the `product-images` bucket is **Public**.

## 5. Local development

```bash
npm install
cp .env.example .env        # never commit .env
# VITE_SUPABASE_URL=…  VITE_SUPABASE_ANON_KEY=…
npm run dev                 # storefront / · shop · collections · product · about · journal, dashboard at /admin
npm run typecheck && npm run build
```

## 6. Deploying to Vercel

1. Push the repository (keep `.env` untracked).
2. Vercel → **Add New Project** → import `zizo3bro-arch/three-ways-studios-`; `vercel.json` handles SPA rewrites and security headers.
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. In Supabase → Authentication → URL Configuration, add the production URL to **Site URL** and **Redirect URLs**.

## 7. Security notes

- Never place `SUPABASE_SERVICE_ROLE_KEY` in frontend code or `VITE_*` variables.
- Price maths, stock checks, discount validation and stock decrements run inside `SECURITY DEFINER` Postgres transactions.
- Public visitors read only published products and `site_settings`; orders, customers and discount rules are RLS-protected.
