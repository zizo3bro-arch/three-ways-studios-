import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { JOURNAL_ENTRIES, formatDate } from '../../data/journal';
import { Reveal } from '../ui/Reveal';

/* =========================================================
   CHAPTER 04 — THE JOURNAL
   House writing set as a masthead: one lead spread, then entries
   as a hairline-ruled index. Links resolve to real entry pages.
   ========================================================= */

export function JournalTeaser() {
  const [lead, ...rest] = JOURNAL_ENTRIES;

  return (
    <section
      id="journal"
      aria-labelledby="journal-title"
      className="relative border-t border-ink/14 py-14 sm:py-20 lg:py-24"
    >
      <div className="mx-auto w-full max-w-[1800px] px-4 sm:px-6 lg:px-10">
        <div className="flex flex-wrap items-end justify-between gap-5 border-b border-ink/14 pb-6">
          <Reveal preset="soft">
            <p className="tws-index">04 / The journal</p>
            <h2
              id="journal-title"
              className="mt-3 font-display uppercase leading-[0.86] tracking-[0.004em] text-ink"
              style={{ fontSize: 'clamp(2rem, 6vw, 4.2rem)' }}
            >
              Notes from the atelier
            </h2>
          </Reveal>
          <Link
            to="/journal"
            className="group inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-ink transition-colors hover:text-crimson"
          >
            All entries
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-12 lg:gap-10">
          {lead ? (
            <Reveal className="lg:col-span-7" preset="soft">
              <Link to={`/journal/${lead.slug}`} className="group block">
                <span className="relative block aspect-[16/10] overflow-hidden bg-[rgba(23,19,15,0.05)]">
                  <img
                    src={lead.image}
                    alt={lead.imageAlt}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover transition-transform duration-[1200ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]"
                  />
                </span>
                <span className="mt-4 block border-t border-ink/14 pt-3.5">
                  <span className="tws-eyebrow block text-ink-faint">
                    {lead.kicker} · {formatDate(lead.date)}
                  </span>
                  <span className="mt-2.5 block font-display uppercase leading-[0.92] tracking-[0.004em] text-ink transition-colors duration-300 group-hover:text-crimson" style={{ fontSize: 'clamp(1.6rem, 4.2vw, 2.9rem)' }}>
                    {lead.title.split('\n').join(' ')}
                  </span>
                  <span className="mt-2.5 block max-w-xl font-serif text-[15px] italic leading-relaxed text-ink-soft">
                    {lead.dek}
                  </span>
                </span>
              </Link>
            </Reveal>
          ) : null}

          <div className="flex flex-col lg:col-span-5">
            {rest.map((entry, index) => (
              <Reveal
                key={entry.slug}
                preset="soft"
                delay={0.06 + index * 0.06}
                className="flex-1"
              >
                <Link
                  to={`/journal/${entry.slug}`}
                  className="group flex h-full items-center gap-4 border-b border-ink/12 py-4 first:border-t first:border-ink/12 lg:first:border-t-0 lg:first:pt-0"
                >
                  <span className="relative h-[88px] w-[68px] shrink-0 overflow-hidden bg-[rgba(23,19,15,0.05)] sm:h-[104px] sm:w-20">
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
                    <span className="mt-1.5 block font-display text-[1.1rem] uppercase leading-[1.0] tracking-[0.006em] text-ink transition-colors duration-300 group-hover:text-crimson sm:text-[1.25rem]">
                      {entry.title.split('\n').join(' ')}
                    </span>
                    <span className="mt-2 block text-[10px] uppercase tracking-[0.16em] text-ink-faint">
                      {formatDate(entry.date)} · {entry.readingTime}
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-ink-faint transition-all duration-300 group-hover:translate-x-1 group-hover:text-crimson" />
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
