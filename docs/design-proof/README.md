# Reference comparison and verification · 18 November 2026

The three supplied 852 × 1846 images specify the homepage, cart and signature tee page. Browser and phone furniture (time, signal, battery, home bar) are not webpage content. These renders are actual Chromium screenshots of the application, not layout illustrations. The product records in these screenshots belong to the **isolated test database** and use photography isolated from the supplied references; they are not evidence of the production assortment.

| Reference | Differences found in the previous implementation | Implemented / compared |
| --- | --- | --- |
| Home | Two-line hard-edged mobile headline, font imitation of the signature, dark buttons, two boxed plates, brand/campaign/journal chapters, newsletter name and invented reward, oversized footer | Single-line live paint at every width, traced white signature, supplied emblem, crimson pill and corner labels. Four aligned, unframed photos and centered captions; email only and compact social/legal row. |
| Product | Single replaced image with arrow clicks, lookbook shot added to unrelated one-image products, fixed swatches, square size controls, no fetched measurements | Paper gallery with native swiping and independently operable thumbnails/arrows; exact image ordering and chart rows from the database. Split desktop and stacked mobile, selected crimson sizes, quantity capsule, full-width CTA and three ruled disclosures. |
| Cart | Boxed images, progress meter and promotional copy; only a drawer | Shared full-page cart and drawer; aligned thumbnails, variant details, quantity/remove, totals, filled checkout and outlined continue. |

[Mobile home](home-mobile.webp) · [Desktop home](home-desktop.webp) · [Mobile product](product-mobile.webp) · [Mobile cart](cart-mobile.webp) · [Desktop product](product-desktop.webp) · [Mobile checkout](checkout-mobile.webp)

## Functional verification

- `npm run typecheck`, `npm run build`, `npm test`, `npm run test:e2e`. The old SSR marker script did not fail its exit code and did not exercise gestures or persistence. The replacement tests do.
- Chromium, 320, 360, 375, 390, 430, 724, 768, 1024, 1440 and 1920 CSS pixels. Public routing, valid and missing dynamic slugs, shop search, quick view, account, legal routes, receipt lookup and staff gate. Additional checks of populated carts, drawer widths and checkout controls at nine widths. Reviewed screenshot composition after adjusting spray density, image baseline, header and footer spacing.
- Actual Chromium touch input: swipe forward, swipe back, vertical scroll stays vertical, and tapping the image does not advance it. Desktop next/thumbnail navigation. No synthetic scroll-position changes in the gesture test.
- Browser → Supabase JS → **test HTTP adapter** → actual PostgreSQL policies/functions (PGlite). Verified database rows for orders and subscribers; default and clicked COD radio, submitted method, discounts, shipping, stock decrement, cancellation restore, invalid quantities, duplicate subscription and failed writes. A failed quote prevents submission and a failed create leaves the bag intact.
- Admin gate and tab rendering with isolated staff/non-staff identities. Verified a staff inventory edit in the database, refusal to overwrite a concurrent stock change, non-staff write restrictions, and the mobile dashboard at 360 px. Tested anonymous storefront reads even in a browser with a staff session. The identity-provider response is a fixture; the membership check and row-level policies are real SQL. A production staff password was neither requested nor tested.

## Remaining differences / limits

The live catalog determines which products, photos, sizes, colors, prices and discounts appear. No inventory was overwritten to match a screenshot. Paper and paint use a repeating grain and a live filter, so the individual fibers and aerosol marks are not pixel-identical. Mobile touch targets, the required color/size guide, newsletter heading, contact information and saved-piece control take a little more room than the reference. On small screens the primary links move into the menu; below 390 px the home rail becomes two columns. These are intentional to avoid illegible text and clipped controls.

No physical iOS Safari or Android device was available. Local tests do **not** establish that the existing hosted Supabase schema, staff credentials, mail delivery or Vercel production environment are configured. Verify the production catalog, a sanctioned newsletter address and an authorized test order against the hosted database after rollout. Apply migrations only in the authorized project, never from the browser.
