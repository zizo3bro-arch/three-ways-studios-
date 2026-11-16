import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { PageIntro } from '../components/layout/PageIntro';
import { Reveal } from '../components/ui/Reveal';
import { JOURNAL_ENTRIES, formatDate } from '../data/journal';

/* =========================================================
   /journal — the masthead. Entries are the house's own writing.
   ========================================================= */

export function JournalPage() {
  const [lead, ...rest] = JOURNAL_ENTRIES;

  return (
    <>
      <PageIntro
        eyebrow="The journal"
        sprayText="JOURNAL"
        title={
          <>
            Notes
            <span className="block">from the atelier</span>
          </>
        }
        description={
          <p>
            Cloth, cutting and the arguments in between. Written by the people who draft the
            patterns — three entries, no newsletter filler.
          </p>
        }
      />

      <section className="bg-ivory py-12 sm:py-16">
        <div className="mx-auto w-full max-w-[1660px] px-4 sm:px-6 lg:px-10">
          <Reveal preset="soft">
            <Link to={`/journal/${lead.slug}`} className="group grid gap-6 border-b border-ink/12 pb-10 lg:grid-cols-12 lg:items-center">
              <span className="relative block aspect-[16/10] overflow-hidden rounded-[1.3rem] border border-ink/12 bg-paper lg:col-span-7">
                <img
                  src={lead.image}
                  alt={lead.imageAlt}
                  decoding="async"
                  className="h-full w-full object-cover transition-transform duration-[1300ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.045]"
                />
                <span aria-hidden="true" className="tws-grain absolute inset-0" />
              </span>
              <span className="lg:col-span-5">
                <span className="tws-eyebrow block text-crimson-bright">Lead entry · {formatDate(lead.date)}</span>
                <span className="mt-3 block font-display uppercase leading-[0.9] tracking-[0.002em] text-ink text-[clamp(1.9rem,5vw,3.2rem)] transition-colors duration-300 group-hover:text-crimson-bright">
                  {lead.title.split('\n').join(' ')}
                </span>
                <span className="mt-4 block max-w-lg font-serif text-[15px] italic leading-relaxed text-ink-soft">
                  {lead.dek}
                </span>
                <span className="mt-5 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-ink transition-colors group-hover:text-crimson-bright">
                  Read the entry
                  <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </span>
              </span>
            </Link>
          </Reveal>

          <ul className="mt-10 grid gap-5 md:grid-cols-2">
            {rest.map((entry, index) => (
              <Reveal as="li" key={entry.slug} preset="soft" delay={index * 0.08}>
                <Link
                  to={`/journal/${entry.slug}`}
                  className="group flex h-full flex-col overflow-hidden rounded-[1.3rem] border border-ink/12 bg-paper transition-shadow duration-500 hover:shadow-plate"
                >
                  <span className="relative block aspect-[16/9] overflow-hidden">
                    <img
                      src={entry.image}
                      alt=""
                      aria-hidden="true"
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-[1200ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.05]"
                    />
                  </span>
                  <span className="flex flex-1 flex-col px-5 pb-5 pt-4">
                    <span className="tws-eyebrow block text-ink-faint">
                      {entry.kicker} · {entry.readingTime}
                    </span>
                    <span className="mt-2.5 block font-display uppercase leading-[0.95] tracking-[0.004em] text-ink text-[clamp(1.4rem,3.4vw,2.1rem)] transition-colors duration-300 group-hover:text-crimson-bright">
                      {entry.title.split('\n').join(' ')}
                    </span>
                    <span className="mt-3 block text-[13px] leading-relaxed text-ink-soft">{entry.dek}</span>
                    <span className="mt-4 flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.2em] text-ink-faint">
                      {formatDate(entry.date)}
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </span>
                  </span>
                </Link>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
