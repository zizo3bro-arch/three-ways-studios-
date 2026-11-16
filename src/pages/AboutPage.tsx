import { Link } from 'react-router-dom';
import { ArrowRight, Scissors, ShieldCheck, Truck } from 'lucide-react';
import { PageIntro } from '../components/layout/PageIntro';
import { Reveal } from '../components/ui/Reveal';
import { SmokeField } from '../components/ui/SmokeField';
import { EmblemPlate } from '../components/ui/Emblem';
import { Parallax } from '../components/ui/Parallax';

/* =========================================================
   /about — the house, the cloth, the service promises (the anchors
   the footer links to: #service and #fit).
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
            <span className="block">beyond limits</span>
          </>
        }
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

      {/* manifesto band with the house plate */}
      <section className="relative isolate overflow-hidden bg-ivory py-14 sm:py-20">
        <SmokeField variant="full" opacity="low" />
        <div className="relative z-10 mx-auto grid w-full max-w-[1660px] gap-9 px-4 sm:px-6 lg:grid-cols-12 lg:gap-10 lg:px-10">
          <div className="lg:col-span-6">
            <Reveal preset="soft">
              <p className="tws-eyebrow text-crimson-bright">Why one garment</p>
              <h2 className="mt-4 font-display uppercase leading-[0.9] tracking-[0.002em] text-ink text-[clamp(1.9rem,5vw,3.4rem)]">
                A house is defined
                <span className="block">by what it refuses</span>
              </h2>
              <div className="mt-6 space-y-4 text-[14px] leading-[1.75] text-ink-soft sm:text-[15px]">
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
              <Parallax distance={26} polarity={1}>
                <figure className="overflow-hidden rounded-[1.4rem] border border-ink/12">
                  <div className="aspect-square w-full">
                    <EmblemPlate />
                  </div>
                  <figcaption className="border-t border-ink/12 bg-paper px-4 py-3 text-[9px] font-bold uppercase tracking-[0.2em] text-ink-faint">
                    The house plate — three panthers, one crimson cross
                  </figcaption>
                </figure>
              </Parallax>
            </Reveal>
          </div>
        </div>
      </section>

      {/* principles */}
      <section className="border-y border-ink/12 bg-paper py-14 sm:py-16">
        <div className="mx-auto w-full max-w-[1660px] px-4 sm:px-6 lg:px-10">
          <div className="grid gap-8 lg:grid-cols-12">
            <h2 className="tws-eyebrow text-ink-faint lg:col-span-3">Three principles</h2>
            <ul className="grid gap-6 sm:grid-cols-3 lg:col-span-9">
              {PRINCIPLES.map((principle, index) => (
                <Reveal as="li" key={principle.n} preset="soft" delay={index * 0.08}>
                  <p className="font-display text-[2.6rem] leading-none text-crimson-bright/85">{principle.n}</p>
                  <h3 className="mt-3 font-display text-[1.25rem] uppercase leading-[1.02] tracking-[0.006em] text-ink">
                    {principle.title}
                  </h3>
                  <p className="mt-2.5 text-[13px] leading-relaxed text-ink-soft">{principle.copy}</p>
                </Reveal>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* fit + service */}
      <section className="bg-ivory py-14 sm:py-18">
        <div className="mx-auto grid w-full max-w-[1660px] gap-10 px-4 sm:px-6 lg:grid-cols-12 lg:px-10">
          <div id="fit" className="scroll-mt-28 lg:col-span-6">
            <Reveal preset="soft">
              <p className="tws-eyebrow text-crimson-bright">Sizes &amp; fit</p>
              <h2 className="mt-4 font-display uppercase leading-[0.92] tracking-[0.002em] text-ink text-[clamp(1.8rem,4.4vw,2.9rem)]">
                True to size,
                <span className="block">long in the leg</span>
              </h2>
              <div className="mt-6 overflow-hidden rounded-[1.1rem] border border-ink/14 bg-paper">
                <table className="w-full border-collapse text-left">
                  <caption className="sr-only">Size guide in centimetres</caption>
                  <thead>
                    <tr className="border-b border-ink/12 text-[8.5px] uppercase tracking-[0.2em] text-ink-faint">
                      <th scope="col" className="px-4 py-3">Size</th>
                      <th scope="col" className="px-4 py-3">Waist (cm)</th>
                      <th scope="col" className="px-4 py-3">Height (cm)</th>
                      <th scope="col" className="px-4 py-3">Inseam (cm)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {FIT_ROWS.map(([size, waist, height, inseam]) => (
                      <tr key={size} className="border-b border-ink/8 last:border-b-0">
                        <th scope="row" className="px-4 py-3 font-display text-[1.1rem] uppercase text-ink">{size}</th>
                        <td className="px-4 py-3 text-[12.5px] tabular-nums text-ink-soft">{waist}</td>
                        <td className="px-4 py-3 text-[12.5px] tabular-nums text-ink-soft">{height}</td>
                        <td className="px-4 py-3 text-[12.5px] tabular-nums text-ink-soft">{inseam}</td>
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
            <Reveal preset="soft" delay={0.1}>
              <p className="tws-eyebrow text-crimson-bright">Service</p>
              <h2 className="mt-4 font-display uppercase leading-[0.92] tracking-[0.002em] text-ink text-[clamp(1.8rem,4.4vw,2.9rem)]">
                How an order works
              </h2>
              <ul className="mt-6 space-y-3">
                {SERVICE.map(({ Icon, title, copy }) => (
                  <li key={title} className="flex gap-4 rounded-[1.1rem] border border-ink/12 bg-paper px-4 py-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-ivory">
                      <Icon className="h-4 w-4" strokeWidth={1.8} />
                    </span>
                    <span>
                      <span className="block text-[11px] font-bold uppercase tracking-[0.18em] text-ink">{title}</span>
                      <span className="mt-1.5 block text-[12.5px] leading-relaxed text-ink-soft">{copy}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </div>
      </section>

      {/* the cloth plate */}
      <section className="border-t border-ink/12 bg-ivory pb-16 pt-2 sm:pb-20">
        <div className="mx-auto w-full max-w-[1660px] px-4 sm:px-6 lg:px-10">
          <Reveal preset="soft">
            <figure className="relative overflow-hidden rounded-[1.4rem] border border-ink/12">
              <img
                src="/media/atelier.jpg"
                alt="The atelier worktable: raw selvedge denim, tailor's chalk, brass scissors and paper patterns"
                loading="lazy"
                decoding="async"
                className="h-[clamp(220px,32vw,420px)] w-full object-cover"
              />
              <figcaption className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-3 bg-gradient-to-t from-[#16130f]/80 via-[#16130f]/20 to-transparent p-5 sm:p-7">
                <p className="max-w-md font-serif text-[15px] italic leading-snug text-ivory sm:text-[17px]">
                  “We buy the cloth by the metre and cut it at night, when the machines are free and
                  the street is quiet.”
                </p>
                <Link to="/journal" className="text-[9px] font-bold uppercase tracking-[0.22em] text-ivory/85 underline underline-offset-4 hover:text-ivory">
                  Read the journal
                </Link>
              </figcaption>
            </figure>
          </Reveal>
        </div>
      </section>
    </>
  );
}
