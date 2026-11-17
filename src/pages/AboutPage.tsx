import { Link } from 'react-router-dom';
import { ArrowRight, Scissors, ShieldCheck, Truck } from 'lucide-react';
import { PageIntro } from '../components/layout/PageIntro';
import { Reveal } from '../components/ui/Reveal';
import { EmblemPlate } from '../components/ui/Emblem';

/* =========================================================
   /about — the house, the cloth, the service promises (the anchors
   the footer links to: #service and #fit).
   Set as a printed manifesto: no panels, only rules and type.
   ========================================================= */

const PRINCIPLES = [
  {
    n: '01',
    title: 'Two patterns a season',
    copy: 'Not twenty. A drop is finished when the second silhouette holds on its own, and then we stop.',
  },
  {
    n: '02',
    title: 'Cloth before concept',
    copy: 'Rope-dyed selvedge at 13–14 oz, bought by the metre in small runs, because a flare only works with weight.',
  },
  {
    n: '03',
    title: 'Fitted on real bodies',
    copy: 'Every pattern is worn in-house for a fortnight before it is photographed, then corrected once.',
  },
];

const SERVICE = [
  {
    Icon: Truck,
    title: 'Cash on delivery',
    copy: 'Pay the courier in cash when the parcel arrives, anywhere in Egypt. Dispatch in 1–2 working days, delivery in 2–5.',
  },
  {
    Icon: ShieldCheck,
    title: 'Returns in 14 days',
    copy: 'Unworn, tags on, in the original bag. We cover the pickup inside Greater Cairo.',
  },
  {
    Icon: Scissors,
    title: 'Hemming on request',
    copy: 'Order with your inseam noted at checkout and we finish the hem to it — the flare must pool, not drag.',
  },
];

const FIT_ROWS: Array<[string, string, string, string]> = [
  ['S', '74 — 78', '168 — 174', '104'],
  ['M', '78 — 84', '172 — 179', '106'],
  ['L', '84 — 92', '178 — 186', '108'],
  ['XL', '92 — 100', '184 — 192', '110'],
];

export function AboutPage() {
  return (
    <>
      <PageIntro
        eyebrow="The house — Cairo"
        sprayText="ABOUT"
        title={
          <>
            Fashion
            <span className="block text-crimson">beyond limits</span>
          </>
        }
        meta="Est. Cairo 2024"
        description={
          <p>
            Three Ways Studios is an independent house built around the leg. Wide, longer, heavier
            — and cut by the same two hands from the first run to the last.
          </p>
        }
        actions={
          <Link to="/shop" className="tws-pill h-12">
            See the pieces
            <ArrowRight className="h-4 w-4" strokeWidth={2} />
          </Link>
        }
      />

      {/* manifesto */}
      <section className="pb-14 sm:pb-20">
        <div className="mx-auto grid w-full max-w-[1800px] gap-10 px-4 sm:px-6 lg:grid-cols-12 lg:gap-12 lg:px-10">
          <div className="lg:col-span-6">
            <Reveal preset="soft">
              <p className="tws-index">01 / The refusal</p>
              <h2
                className="mt-3 font-display uppercase leading-[0.86] tracking-[0.004em] text-ink"
                style={{ fontSize: 'clamp(1.9rem, 4.6vw, 3.4rem)' }}
              >
                A house is defined by what it refuses
              </h2>
              <div className="mt-5 space-y-4 border-t border-ink/16 pt-5 text-[14px] leading-[1.75] text-ink-soft">
                <p>
                  We refuse the tight leg, the seasonal print and the filler drop. What is left is a
                  trouser that has to carry the whole idea on its own — so the cloth, the rise and
                  the hem are all we argue about.
                </p>
                <p>
                  The atelier sits in downtown Cairo, above a fabric merchant who has been cutting
                  selvedge longer than we have been designing. Patterns are drafted on the body,
                  corrected on the floor, and closed only when the fitting log stops moving.
                </p>
              </div>
            </Reveal>
          </div>

          <div className="lg:col-span-5 lg:col-start-8">
            <Reveal preset="soft" delay={0.1}>
              <figure className="overflow-hidden">
                <div className="aspect-square w-full bg-[rgba(23,19,15,0.05)]">
                  <EmblemPlate />
                </div>
                <figcaption className="mt-2.5 flex items-baseline justify-between gap-4 text-[9px] font-bold uppercase tracking-[0.2em] text-ink-faint">
                  <span>Three Ways Studios — Cairo</span>
                  <span>Three panthers, one cross</span>
                </figcaption>
              </figure>
            </Reveal>
          </div>
        </div>
      </section>

      {/* principles */}
      <section className="border-y border-ink/16 py-12 sm:py-16">
        <div className="mx-auto w-full max-w-[1800px] px-4 sm:px-6 lg:px-10">
          <div className="grid gap-9 lg:grid-cols-12">
            <h2 className="tws-index lg:col-span-3">02 / Three principles</h2>
            <ul className="grid gap-8 sm:grid-cols-3 sm:gap-6 lg:col-span-9 lg:gap-10">
              {PRINCIPLES.map((principle, index) => (
                <Reveal as="li" key={principle.n} preset="soft" delay={index * 0.07}>
                  <p className="font-display text-[2.4rem] leading-none text-crimson/80">
                    {principle.n}
                  </p>
                  <h3 className="mt-2.5 font-display text-[1.2rem] uppercase leading-[1.02] tracking-[0.008em] text-ink">
                    {principle.title}
                  </h3>
                  <p className="mt-2.5 text-[12.5px] leading-relaxed text-ink-soft">{principle.copy}</p>
                </Reveal>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* fit + service */}
      <section className="py-14 sm:py-20">
        <div className="mx-auto grid w-full max-w-[1800px] gap-12 px-4 sm:px-6 lg:grid-cols-12 lg:gap-12 lg:px-10">
          <div id="fit" className="scroll-mt-28 lg:col-span-6">
            <Reveal preset="soft">
              <p className="tws-index">03 / Sizes &amp; fit</p>
              <h2
                className="mt-3 font-display uppercase leading-[0.86] tracking-[0.004em] text-ink"
                style={{ fontSize: 'clamp(1.9rem, 4.6vw, 3.2rem)' }}
              >
                True to size,
                <span className="block text-crimson">long in the leg</span>
              </h2>
              <div className="mt-6 overflow-x-auto border-t border-ink/20">
                <table className="w-full min-w-[420px] border-collapse text-left">
                  <caption className="sr-only">Size guide in centimetres</caption>
                  <thead>
                    <tr className="border-b border-ink/16 text-[8.5px] uppercase tracking-[0.2em] text-ink-faint">
                      <th scope="col" className="py-3 pr-4">Size</th>
                      <th scope="col" className="py-3 pr-4">Waist (cm)</th>
                      <th scope="col" className="py-3 pr-4">Height (cm)</th>
                      <th scope="col" className="py-3">Inseam (cm)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {FIT_ROWS.map(([size, waist, height, inseam]) => (
                      <tr key={size} className="border-b border-ink/12">
                        <th scope="row" className="py-3 pr-4 font-display text-[1.05rem] uppercase text-ink">
                          {size}
                        </th>
                        <td className="py-3 pr-4 text-[12.5px] tabular-nums text-ink-soft">{waist}</td>
                        <td className="py-3 pr-4 text-[12.5px] tabular-nums text-ink-soft">{height}</td>
                        <td className="py-3 text-[12.5px] tabular-nums text-ink-soft">{inseam}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-[11.5px] leading-relaxed text-ink-faint">
                The figures above are the house reference measurements for the 2026 flare blocks.
                Use “Find my size” on any piece to get a recommendation from your weight and height.
              </p>
            </Reveal>
          </div>

          <div id="service" className="scroll-mt-28 lg:col-span-5 lg:col-start-8">
            <Reveal preset="soft" delay={0.08}>
              <p className="tws-index">04 / Service</p>
              <h2
                className="mt-3 font-display uppercase leading-[0.86] tracking-[0.004em] text-ink"
                style={{ fontSize: 'clamp(1.9rem, 4.6vw, 3.2rem)' }}
              >
                How an order works
              </h2>
              <ul className="mt-6 border-t border-ink/20">
                {SERVICE.map(({ Icon, title, copy }) => (
                  <li key={title} className="flex gap-4 border-b border-ink/14 py-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-ink/22 text-crimson">
                      <Icon className="h-4 w-4" strokeWidth={1.7} />
                    </span>
                    <span>
                      <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-ink">
                        {title}
                      </span>
                      <span className="mt-1.5 block text-[12.5px] leading-relaxed text-ink-soft">
                        {copy}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </div>
      </section>

      {/* the atelier plate */}
      <section className="pb-16 sm:pb-20">
        <div className="mx-auto w-full max-w-[1800px] px-4 sm:px-6 lg:px-10">
          <Reveal preset="soft">
            <figure className="relative overflow-hidden">
              <img
                src="/media/atelier.jpg"
                alt="The atelier worktable: raw selvedge denim, tailor's chalk, brass scissors and paper patterns"
                loading="lazy"
                decoding="async"
                className="h-[clamp(220px,32vw,440px)] w-full object-cover"
              />
              <figcaption className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-3 bg-gradient-to-t from-[#120e0b]/82 via-[#120e0b]/25 to-transparent p-4 sm:p-6">
                <p className="text-[9px] font-bold uppercase tracking-[0.26em] text-[#f7f4ed]/90">
                  The atelier — downtown Cairo
                </p>
                <p className="hidden max-w-[380px] text-right font-serif text-[12.5px] italic leading-snug text-[#f7f4ed]/85 sm:block">
                  Patterns drafted on the body, corrected on the floor, closed only when the fitting
                  log stops moving.
                </p>
              </figcaption>
            </figure>
          </Reveal>
        </div>
      </section>
    </>
  );
}
