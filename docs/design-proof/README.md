# Hero — design proof

`hero-390 / 768 / 1024 / 1440 / 1920.jpg` are **renders of the hero's layout
model, not browser screenshots.** No browser was available in the build
environment (no Chrome/WebKit binary, and the sandbox has no package index to
install one), so these images were produced with Skia (`@napi-rs/canvas`) using
the *real* self-hosted webfonts — Anton, Alex Brush, Plus Jakarta Sans — and the
*real* `paper-tile.png`.

What that makes them good for, and what it does not:

| Faithful | Not faithful |
| --- | --- |
| Anton / Alex Brush glyph shapes and advance widths | Font hinting, subpixel AA |
| The exact scale formula (`(100vw − gutter) / 4.254` desktop, `/2.194` mobile) | Tailwind cascade edge cases |
| `scaleY(1.5)` desktop / `1.24` mobile paint stretch | CSS `mix-blend-mode: multiply` (approximated in the mock) |
| Per-band hero heights and furniture baselines | Browser scrollbar width, iOS `svh` behaviour |
| Paper tile and vignette | Hover/focus states, motion |

The mock geometry (`/tmp/pkgs/hero-mock.mjs` at build time) mirrors `index.css`
line for line: header height, the `clamp()` hero bands at each breakpoint, the
stage padding, and the measured furniture block height that reserves space for
the tagline + rule + scroll cue. Where it departs from a browser it is called
out above.

Verified against these images at 5 viewports: the paint fills the gutter
edge-to-edge without clipping, the white lockup crosses it and stays within
88% of the content width, no text overflows its container, and the furniture
never collides with the paint.

A numeric overflow audit of the same type sizes is in the smoke suite; the
measurements are reproduced here for reference.

| viewport | content | paint | signature | result |
| --- | --- | --- | --- | --- |
| 360 | 296 | 281 | 246 / 260 | ok |
| 390 | 326 | 309 | 271 / 287 | ok |
| 414 | 350 | 332 | 291 / 308 | ok |
| 640 | 544 | 543 | 420 / 479 | ok |
| 768 | 672 | 670 | 518 / 591 | ok |
| 1024 | 864 | 862 | 680 / 760 | ok |
| 1280 | 1120 | 1118 | 881 / 986 | ok |
| 1440 | 1280 | 1277 | 1007 / 1126 | ok |
| 1920 | 1640 | 1636 | 1290 / 1320 | ok |

All values in px. "signature" is `measured / container`.

_Last regenerated: 2026-11-17._
