import { Link } from 'react-router-dom';
import { ArrowRight, Scissors, ShieldCheck, Truck } from 'lucide-react';
import { PageIntro } from '../components/layout/PageIntro';
import { Reveal } from '../components/ui/Reveal';
import { EmblemPlate } from '../components/ui/Emblem';

/* =========================================================
   /about — concise studio overview, fit reference (#fit), and
   delivery/service essentials (#service).
   ========================================================= */

const PRINCIPLES = [
  {
    n: '01',
    title: 'Focused releases',
    copy: 'Small-batch drops built around one silhouette at a time.',
  },
  {
    n: '02',
    title: 'Heavyweight cloth',
    copy: 'Structured denim chosen for clean drape, weight, and daily wear.',
  },
  {
    n: '03',
    title: 'Tested fit',
    copy: 'Every pattern is wear-tested and refined in Cairo before release.',
  },
];

const SERVICE = [
  {
    Icon: Truck,
    title: 'Cash on delivery',
    copy: 'Pay the courier on arrival anywhere in Egypt. Dispatch in 1–2 working days; delivery in 2–5.',
  },
  {
    Icon: ShieldCheck,
    title: '14-day returns',
    copy: 'Unworn pieces with original tags and packaging can be returned within 14 days of delivery.',
  },
  {
    Icon: Scissors,
    title: 'Fit notes',
    copy: 'Add your preferred inseam or delivery note at checkout when ordering.',
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
        title={
          <>
            Fashion
            <span className="block text-crimson">beyond limits</span>
          </>
        }
        meta="Cairo Studio"
        description={
          <p>
            Three Ways Studios is an independent Cairo label creating heavyweight denim and
            structured everyday pieces in limited runs.
          </p>
        }
        actions={
          <Link to="/shop" className="tws-pill h-12">
            See the pieces
            <ArrowRight className="h-4 w-4" strokeWidth={2} />
          </Link>
        }
      />

      {/* studio overview */}
      <section className="pb-12 sm:pb-16">
        <div className="page-width grid items-center gap-10 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-6">
            <Reveal preset="soft">
              <p className="tws-index">01 / The studio</p>
              <h2
                className="mt-3 font-display uppercase leading-[0.88] tracking-[0.004em] text-ink"
                style={{ fontSize: 'clamp(1.9rem, 4.4vw, 3.3rem)' }}
              >
                Cut with weight, built to wear
              </h2>
              <p className="mt-5 border-t border-ink/16 pt-5 text-[15.5px] leading-[1.75] text-ink-soft sm:text-[16px]">
                Designed in Cairo, Three Ways Studios focuses on clean proportion, durable fabric,
                and deliberate construction. Rather than seasonal filler, we release essential cuts
                made to hold their shape over time.
              </p>
            </Reveal>
          </div>

          <div className="lg:col-span-4 lg:col-start-9">
            <Reveal preset="soft" delay={0.08}>
              <figure className="overflow-hidden">
                <div className="aspect-square w-full bg-[rgba(23,19,15,0.05)]">
                  <EmblemPlate />
                </div>
                <figcaption className="mt-2.5 flex items-baseline justify-between gap-4 text-[9px] font-bold uppercase tracking-[0.2em] text-ink-faint">
                  <span>Three Ways Studios</span>
                  <span>Cairo</span>
                </figcaption>
              </figure>
            </Reveal>
          </div>
        </div>
      </section>

      {/* essentials */}
      <section className="border-y border-ink/16 py-11 sm:py-14">
        <div className="page-width">
          <div className="grid gap-8 lg:grid-cols-12">
            <h2 className="tws-index lg:col-span-3">02 / Approach</h2>
            <ul className="grid gap-7 sm:grid-cols-3 sm:gap-6 lg:col-span-9 lg:gap-10">
              {PRINCIPLES.map((principle, index) => (
                <Reveal as="li" key={principle.n} preset="soft" delay={index * 0.06}>
                  <p className="font-display text-[2.3rem] leading-none text-crimson/80">
                    {principle.n}
                  </p>
                  <h3 className="mt-2 font-display text-[1.2rem] uppercase leading-[1.05] tracking-[0.008em] text-ink">
                    {principle.title}
                  </h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">{principle.copy}</p>
                </Reveal>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* fit + service */}
      <section className="py-12 sm:py-16">
        <div className="page-width grid gap-12 lg:grid-cols-12 lg:gap-12">
          <div id="fit" className="scroll-mt-28 lg:col-span-6">
            <Reveal preset="soft">
              <p className="tws-index">03 / Sizes &amp; fit</p>
              <h2
                className="mt-3 font-display uppercase leading-[0.86] tracking-[0.004em] text-ink"
                style={{ fontSize: 'clamp(1.85rem, 4.4vw, 3rem)' }}
              >
                True to size,
                <span className="block text-crimson">long in the leg</span>
              </h2>
              <div className="mt-5 overflow-x-auto border-t border-ink/20">
                <table className="w-full min-w-[400px] border-collapse text-left">
                  <caption className="sr-only">Size guide in centimetres</caption>
                  <thead>
                    <tr className="border-b border-ink/16 text-[8.5px] uppercase tracking-[0.2em] text-ink-faint">
                      <th scope="col" className="py-3 pr-4">
                        Size
                      </th>
                      <th scope="col" className="py-3 pr-4">
                        Waist (cm)
                      </th>
                      <th scope="col" className="py-3 pr-4">
                        Height (cm)
                      </th>
                      <th scope="col" className="py-3">
                        Inseam (cm)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {FIT_ROWS.map(([size, waist, height, inseam]) => (
                      <tr key={size} className="border-b border-ink/12">
                        <th
                          scope="row"
                          className="py-3 pr-4 font-display text-[1.05rem] uppercase text-ink"
                        >
                          {size}
                        </th>
                        <td className="py-3 pr-4 text-[12.5px] tabular-nums text-ink-soft">
                          {waist}
                        </td>
                        <td className="py-3 pr-4 text-[12.5px] tabular-nums text-ink-soft">
                          {height}
                        </td>
                        <td className="py-3 text-[12.5px] tabular-nums text-ink-soft">
                          {inseam}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-[11.5px] leading-relaxed text-ink-faint">
                Reference measurements in cm. Open &ldquo;Size guide&rdquo; on any product page for
                piece-specific specs.
              </p>
            </Reveal>
          </div>

          <div id="service" className="scroll-mt-28 lg:col-span-5 lg:col-start-8">
            <Reveal preset="soft" delay={0.08}>
              <p className="tws-index">04 / Service</p>
              <h2
                className="mt-3 font-display uppercase leading-[0.86] tracking-[0.004em] text-ink"
                style={{ fontSize: 'clamp(1.85rem, 4.4vw, 3rem)' }}
              >
                Delivery &amp; returns
              </h2>
              <ul className="mt-5 border-t border-ink/20">
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
    </>
  );
}
