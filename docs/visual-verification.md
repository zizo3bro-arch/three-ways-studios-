# Visual evidence — how to produce the screenshots

The sandbox this work was built in **could not run a browser**: `npx playwright install chromium`
fails with `ECONNRESET` from `cdn.playwright.dev`, and no system Chrome/Chromium,
`headless_shell`, `wkhtmltoimage` or `weasyprint` exists. So **no screenshots were captured or
committed by the agent**, and none are claimed. Every other check below ran for real.

## One command, on any machine with a browser

```bash
npm ci
npx playwright install chromium     # first time only
npm run test:visual                 # runs tests/visual.spec.mjs
```

The spec starts the built site with `vite preview`, serves the real repository SQL migrations
(001 → 013) in a disposable PostgreSQL through PGlite, intercepts only the Supabase HTTP transport,
and drives the actual React app. It writes:

| File | Shows |
| --- | --- |
| `docs/screenshots-account/01-card-back-mobile.png` | the supplied card artwork, back face, at 2/5 |
| `docs/screenshots-account/02-card-front-desktop.png` | the same card after the automatic flip, desktop |
| `docs/screenshots-account/03-progress-2of5.png` | 2/5 with 10% unlocked for the next order |
| `docs/screenshots-account/04-progress-3of5.png` | 3/5 with 20% unlocked |
| `docs/screenshots-account/05-progress-4of5.png` | 4/5 with the free pair available **before** the fifth order |
| `docs/screenshots-account/06-account-desktop.png` | the account page, desktop |
| `.verify/*.png` | mobile homepage hero and plate measurements |

Assertions in the same run (not just images):

* the hero is at least 620 px tall on a 390 × 844 viewport,
* each collection plate is at least 240 px tall and the garment fills ≥ 95 % of the plate width,
* the card renders **back first**, then flips once, and the front stays,
* `prefers-reduced-motion: reduce` skips the flip and shows the front immediately,
* the five circles are driven by server progress, and moving 2 → 3 → 4 updates them without a reload.

## What was verified here instead

```bash
npm test          # 30/30 — commerce, both loyalty ladders, console operations, frontend SSR
npm run typecheck # clean
npm run build     # clean production build
```

The loyalty screenshots require a real browser because they prove *rendering* (artwork quality,
flip, layout) — a green build cannot prove that, and neither can SSR HTML. That is exactly why they
are left as a one-command step rather than reported as done.
