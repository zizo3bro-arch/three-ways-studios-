import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { JOURNAL_ENTRIES, formatDate } from '../../data/journal';
import { Reveal } from '../ui/Reveal';

/* =========================================================
   CHAPTER 04 — THE JOURNAL
   House writing, set as a masthead strip. Links resolve to real
   entry pages.
   ========================================================= */

export function JournalTeaser() {
  const [lead, ...rest] = JOURNAL_ENTRIES;

  return (
    <section id="journal" aria-labelledby="journal-title" className="relative bg-ivory pb-20 pt-4 sm:pb-24">
      <div className="mx-auto w-full max-w-[1660px] px-4 sm:px-6 lg:px-10">
        <div className="flex flex-wrap items-end justify-between gap-4 border-t border-ink/12 pt-7">
          <Reveal preset="soft">
            <p className="tws-eyebrow text-crimson-bright">Chapter 04 — The Journal</p>
            <h2
              id="journal-title"
              className="mt-3 font-display uppercase leading-[0.9] tracking-[0.002em] text-ink text-[clamp(2rem,5.6vw,4rem)]"
            >
              Notes from the atelier
            </h2>
          </Reveal>
          <Link
            to="/journal"
            className="group inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-ink transition-colors hover:text-crimson-bright"
          >
            All entries
            <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-12">
          <Reveal className="lg:col-span-7" preset="soft">
            <Link to={`/journal/${lead.slug}`} className="group block">
              <span className="relative block aspect-[16/10] overflow-hidden rounded-[1.25rem] border border-ink/12 bg-paper">
                <img
                  src={lead.image}
                  alt={lead.imageAlt}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover transition-transform duration-[1200ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]"
                />
                <span aria-hidden="true" className="tws-grain absolute inset-0" />
              </span>
              <span className="mt-4 block">
                <span className="tws-eyebrow block text-ink-faint">
                  {lead.kicker} · {formatDate(lead.date)}
                </span>
                <span className="mt-2 block font-display uppercase leading-[0.94] tracking-[0.002em] text-ink text-[clamp(1.7rem,4.2vw,2.9rem)] transition-colors duration-300 group-hover:text-crimson-bright">
                  {lead.title.split('\n').join(' ')}
                </span>
                <span className="mt-2.5 block max-w-xl font-serif text-[15px] italic leading-relaxed text-ink-soft">
                  {lead.dek}
                </span>
              </span>
            </Link>
          </Reveal>

          <div className="flex flex-col gap-4 lg:col-span-5">
            {rest.map((entry, index) => (
              <Reveal key={entry.slug} preset="soft" delay={0.08 + index * 0.08} className="flex-1">
                <Link
                  to={`/journal/${entry.slug}`}
                  className="group flex h-full items-center gap-4 rounded-[1.1rem] border border-ink/12 bg-paper p-3.5 transition-colors duration-400 hover:border-ink/35 sm:p-4"
                >
                  <span className="relative h-[92px] w-[72px] shrink-0 overflow-hidden rounded-[6px] border border-ink/10 sm:h-[104px] sm:w-20">
                    <img
                      src={entry.image}
                      alt=""
                      aria-hidden="true"
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-[1100ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-105"
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="tws-eyebrow block text-ink-faint">{entry.kicker}</span>
                    <span className="mt-1.5 block font-display text-[1.15rem] uppercase leading-[0.98] tracking-[0.004em] text-ink transition-colors duration-300 group-hover:text-crimson-bright sm:text-[1.3rem]">
                      {entry.title.split('\n').join(' ')}
                    </span>
                    <span className="mt-1.5 block text-[11px] uppercase tracking-[0.14em] text-ink-faint">
                      {formatDate(entry.date)} · {entry.readingTime}
                    </span>
                  </span>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-ink-faint transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-crimson-bright" />
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
