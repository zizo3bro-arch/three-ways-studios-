import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { PageIntro } from '../components/layout/PageIntro';
import { Reveal } from '../components/ui/Reveal';
import { JOURNAL_ENTRIES, formatDate } from '../data/journal';

/* =========================================================
   /journal — the masthead. Entries are the house's own writing,
   set as a printed index: lead spread, then hairline-ruled rows.
   ========================================================= */

export function JournalPage() {
  const [lead, ...rest] = JOURNAL_ENTRIES;

  return (
    <>
      <PageIntro
        eyebrow="The journal"
        title={
          <>
            Notes
            <span className="block text-crimson">from the atelier</span>
          </>
        }
        meta={`${JOURNAL_ENTRIES.length} entries`}
        description={
          <p>
            Cloth, cutting and the arguments in between. Written by the people who draft the patterns —
            three entries, no newsletter filler.
          </p>
        }
      />

      <section className="pb-14 sm:pb-18">
        <div className="page-width">
          {lead ? (
            <Reveal preset="soft">
              <Link
                to={`/journal/${lead.slug}`}
                className="group grid gap-6 border-b border-ink/16 pb-10 lg:grid-cols-12 lg:items-end lg:gap-10"
              >
                <span className="relative block aspect-[16/10] overflow-hidden bg-[rgba(23,19,15,0.05)] lg:col-span-7">
                  <img
                    src={lead.image}
                    alt={lead.imageAlt}
                    decoding="async"
                    className="h-full w-full object-cover transition-transform duration-[1300ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.045]"
                  />
                </span>
                <span className="lg:col-span-5">
                  <span className="tws-eyebrow block text-crimson">
                    Lead entry · {formatDate(lead.date)}
                  </span>
                  <span
                    className="mt-3 block font-display uppercase leading-[0.88] tracking-[0.004em] text-ink transition-colors duration-300 group-hover:text-crimson"
                    style={{ fontSize: 'clamp(1.9rem, 5vw, 3.2rem)' }}
                  >
                    {lead.title.split('\n').join(' ')}
                  </span>
                  <span className="mt-4 block max-w-lg font-serif text-[15px] italic leading-relaxed text-ink-soft">
                    {lead.dek}
                  </span>
                  <span className="mt-5 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-ink transition-colors group-hover:text-crimson">
                    Read the entry
                    <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </span>
                </span>
              </Link>
            </Reveal>
          ) : null}

          <ul className="grid gap-x-8 gap-y-10 md:grid-cols-2 lg:gap-x-10">
            {rest.map((entry, index) => (
              <Reveal as="li" key={entry.slug} preset="soft" delay={index * 0.07}>
                <Link to={`/journal/${entry.slug}`} className="group flex h-full flex-col">
                  <span className="relative block aspect-[16/9] overflow-hidden bg-[rgba(23,19,15,0.05)]">
                    <img
                      src={entry.image}
                      alt=""
                      aria-hidden="true"
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-[1200ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.05]"
                    />
                  </span>
                  <span className="flex flex-1 flex-col border-t border-ink/16 pt-3.5">
                    <span className="tws-eyebrow block text-ink-faint">
                      {entry.kicker} · {entry.readingTime}
                    </span>
                    <span
                      className="mt-2.5 block font-display uppercase leading-[0.92] tracking-[0.004em] text-ink transition-colors duration-300 group-hover:text-crimson"
                      style={{ fontSize: 'clamp(1.35rem, 3.2vw, 2rem)' }}
                    >
                      {entry.title.split('\n').join(' ')}
                    </span>
                    <span className="mt-2.5 block text-[13px] leading-relaxed text-ink-soft">
                      {entry.dek}
                    </span>
                    <span className="mt-auto flex items-center gap-2 pt-4 text-[9px] font-bold uppercase tracking-[0.2em] text-ink-faint">
                      {formatDate(entry.date)}
                      <ArrowRight className="h-3.5 w-3.5" />
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
