# THREE WAYS STUDIOS

A production-ready e-commerce web application for **THREE WAYS STUDIOS** — a luxury editorial streetwear house dedicated exclusively to women's pants.

## Key Features

- **Editorial Atmospheric Storefront**
  - Official **THREE WAYS STUDIOS** logo preserved in header and brand assets (`public/assets/`).
  - Continuous charcoal-black & crimson visual environment with **code-generated animated red smoke** (CSS keyframes + SVG `feTurbulence` / `feDisplacementMap`), film grain, and fine editorial scratches — zero static smoke images, GIFs, or videos.
  - Blur-to-focus hero display typography, clip-reveal handwritten script, scroll parallax, mouse-responsive ambient aura, and `prefers-reduced-motion` support.
- **Women's Pants Catalog & Quick Add**
  - Live Supabase product catalog with `All`, `New Arrivals`, `Best Sellers`, and `Trending` filters + price/date sorting.
  - Interactive color swatches, wishlist persistence, and inline **Quick Add** color/size selector directly on product cards.
  - Clean empty-state storefront when Supabase has no published products yet (no fake inventory).
- **Product Details & Smart Size Finder**
  - Multi-image gallery, fabric & material details, fit & cut notes, care instructions, live variant stock availability, and related pants.
  - **Smart Size Finder**: customer enters only **Weight (kg)** and **Height (cm)**; calculated directly from that specific garment's `size_charts` rows stored in Supabase, alongside an expandable manual size chart.
- **Persistent Bag & Cash on Delivery (COD) Checkout**
  - Persistent cart (`localStorage`) with live Supabase stock sync, quantity editing, and in-cart color/size switching.
  - **Cash on Delivery (COD) ONLY** across Egyptian governorates.
  - **Backend-Validated 10% Email Discount**: providing a valid email at checkout triggers the PostgreSQL `quote_cod_order` / `create_cod_order` RPC, calculating and applying the discount strictly on the backend (with atomic row-level stock locking `FOR UPDATE` and inventory decrement).
- **Private Admin Dashboard (`/admin`)**
  - Protected by Supabase Auth + `public.admin_users` RLS verification.
  - **Overview**: Revenue (EGP), order counts, pending/delivered metrics, low-stock alerts, recent activity.
  - **Products**: Full CRUD, Supabase Storage multi-image upload (`product-images`), variant matrix, and per-product Smart Size Finder chart editor.
  - **Inventory**: Live variant stock matrix with low-stock / out-of-stock filters.
  - **Orders**: Searchable order management with status updates (`pending`, `confirmed`, `processing`, `shipped`, `delivered`, `cancelled` with automatic stock restoration).
  - **Customers**: Customer directory and order history inspection.
  - **Discounts**: Configure the auto-email discount rule and create/toggle promo codes.
  - **Website Content**: Edit hero typography, collection labels, navigation, newsletter copy, and footer text stored in `site_settings`.

---

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite 6, Tailwind CSS v4, Framer Motion, Lucide Icons, React Router v7
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Row Level Security, `SECURITY DEFINER` RPCs)
- **Deployment**: GitHub + Vercel (`vercel.json`)

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
