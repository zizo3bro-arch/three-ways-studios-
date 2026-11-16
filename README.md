# THREE WAYS STUDIOS

A production-ready storefront for **THREE WAYS STUDIOS** — a luxury editorial streetwear house engineered around architectural wide-flare pants. Modern-vintage luxury on a warm off-white (`#F5F2EB`) canvas, built to be short, sleek, and completely lag-free.

## Key Features

- **Archival-Paper Hero**
  - Warm off-white (`#F5F2EB`) canvas with a static, lightweight SVG-grain paper feel.
  - Giant deep-crimson ultra-condensed "THREE WAYS" titan type, layered with a sweeping charcoal Alex Brush calligraphic flourish and a sharp ultra-condensed charcoal center lockup.
  - Minimalist editorial corner micro-labels, a `SHOP NOW` pill, and a scroll cue. Hero is capped at ~80vh so the interactive collection is immediately in reach.
- **Frosted-Glass Pill Navigation**
  - Centered frosted pill: Products · Information · Checkout, with a charcoal bag button and live item count.
- **Interactive "Drop 01" Products Showcase (horizontal switcher)**
  - One rounded full-width container with GPU-accelerated crossfades between two ambient radial backdrops:
    - **The Midnight Wide-Flare** (navy) — `#0A1628` → `#152C4E` with a soft cool spotlight.
    - **The Onyx Super-Flare** (black) — `#09090B` → `#18181B` with a silver/charcoal radial spotlight pool keeping the black fabric sharp.
  - 3-column editorial layout: headline + 3-line blurb + `Get the look` pill CTA + socials · floating transparent garment with drop shadow and crossfade/slide switching · dynamic price, circular next-item arrow, `S / M / L / XL` size selector with active ring, and a tap-to-switch thumbnail of the other piece.
  - Both garment images are preloaded in `index.html` and mounted once, so switching is instantaneous. Transitions use `transform`/`opacity` only — no real-time `filter: blur()` loops, no scroll listeners, fixed `aspect-ratio` stage (zero layout shift, 60fps).
- **Focused Bottom — Information + Studio List**
  - Hairline-divided off-white split section: refined studio `Information` on the left, `Name` + `Email` form with charcoal pill submit on the right (wired to the newsletter backend + `WELCOME10` welcome code).
- **Cash on Delivery (COD) across Egypt**
  - Backend-validated pricing, 10% email discount, atomic stock locking and decrement (PostgreSQL `SECURITY DEFINER` RPCs), followed by an order confirmation page.
- **Private Admin Dashboard (`/admin`)**
  - Products, inventory, orders, customers, discounts and site content — protected by Supabase Auth + `public.admin_users` RLS. Unchanged by the redesign.
- **Performance-First Delivery**
  - Code-splitting (admin, checkout, confirmation lazy-loaded), preloaded hero imagery, fixed aspect ratios, `React.memo`-free lightweight tree, and zero layout-shift switching — smooth 60fps scrolling on mobile and desktop.

---

## 1. Supabase Backend Setup

1. Create a new project at [supabase.com](https://supabase.com).
2. Open the **SQL Editor** in your Supabase Dashboard and execute the full setup script:
   - Copy and run `supabase/full_setup.sql` (or run `supabase/migrations/001_schema.sql` through `004_initial_config.sql` in order).
   - This creates:
     - Relational tables (`admin_users`, `products`, `product_images`, `product_variants`, `size_charts`, `customers`, `orders`, `order_items`, `discount_rules`, `discount_usage`, `newsletter_subscribers`, `site_settings`)
     - Strict RLS policies (`public.is_admin()`)
     - Backend RPCs (`quote_cod_order`, `create_cod_order`, `get_order_confirmation`, `admin_update_order_status`)
     - Public `product-images` Storage bucket + admin-only upload/delete policies
     - Default `EMAIL10` (10% email checkout discount rule) and `site_settings`
3. **Create your Admin User**:
   - In Supabase Dashboard → **Authentication → Users**, click **Add user** (email + strong password) and copy the generated User UUID.
   - Run this SQL in the Supabase SQL Editor (replacing with your actual UUID and email):
     ```sql
     INSERT INTO public.admin_users (id, email, full_name, role)
     VALUES ('YOUR-AUTH-USER-UUID', 'your-admin-email@example.com', 'Studio Admin', 'super_admin');
     ```
4. **Verify Storage**:
   - In Supabase Dashboard → **Storage**, confirm the `product-images` bucket exists and is set to **Public**.

---

## 2. Local Development

1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```
2. Create a `.env` file from `.env.example` (never commit `.env` to GitHub):
   ```bash
   cp .env.example .env
   ```
   Fill in your Supabase project credentials:
   ```env
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Visit `http://localhost:5173` for the storefront and `http://localhost:5173/admin` to sign in and publish your women's pants collection.

---

## 3. Deploying to Vercel

1. Push this repository to GitHub (keep `.env` untracked).
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import `zizo3bro-arch/three-ways-studios-`.
3. Vercel automatically detects **Vite** and uses `vercel.json` for SPA client-side routing.
4. Under **Environment Variables**, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Click **Deploy**.
6. In Supabase Dashboard → **Authentication → URL Configuration**, add your production Vercel URL to **Site URL** and **Redirect URLs**.

---

## Security Notes

- Never place the `SUPABASE_SERVICE_ROLE_KEY` in frontend code or `VITE_*` variables.
- All price calculations, inventory checks, 10% email discount validation, and stock decrements execute inside PostgreSQL `SECURITY DEFINER` transactions.
- Public visitors can only read published products and `site_settings`; private orders, customers, and discount rules are protected by strict RLS policies.
