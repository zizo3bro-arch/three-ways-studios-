import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { JOURNAL_ENTRIES, formatDate, journalEntryBySlug } from '../data/journal';
import { Reveal } from '../components/ui/Reveal';
import { Parallax } from '../components/ui/Parallax';

/* =========================================================
   /journal/:slug — an entry, set as an editorial spread.
   ========================================================= */

export function JournalEntryPage() {
  const { slug } = useParams<{ slug: string }>();
  const entry = journalEntryBySlug(slug);
  const index = entry ? JOURNAL_ENTRIES.findIndex((item) => item.slug === entry.slug) : -1;
  const next = entry ? JOURNAL_ENTRIES[(index + 1) % JOURNAL_ENTRIES.length] : undefined;

  if (!entry) {
    return (
      <section className="relative flex min-h-[70svh] flex-col items-center justify-center px-4 pb-16 pt-[130px] text-center">
        <p className="tws-eyebrow text-crimson">Not filed</p>
        <h1 className="mt-4 font-display text-[clamp(2rem,6vw,3.4rem)] uppercase leading-[0.92] text-ink">
          That entry is not written yet
        </h1>
        <Link to="/journal" className="tws-pill mt-6 h-12">
          Back to the journal
          <ArrowRight className="h-4 w-4" strokeWidth={2} />
        </Link>
      </section>
    );
  }

  return (
    <article className="relative">
      <header className="relative isolate overflow-hidden px-4 pb-10 pt-[110px] sm:px-6 sm:pt-[150px] lg:px-10">
        <div className="relative z-10 mx-auto w-full max-w-[1120px]">
          <Link
            to="/journal"
            className="inline-flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.22em] text-ink-soft transition-colors hover:text-crimson"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            The journal
          </Link>
          <p className="tws-eyebrow mt-6 text-crimson">{entry.kicker}</p>
          <h1 className="mt-4 font-display uppercase leading-[0.84] tracking-[0.003em] text-ink text-[clamp(2.3rem,8vw,6rem)]">
            {entry.title.split('\n').map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </h1>
          <p className="mt-5 max-w-2xl font-serif text-[clamp(1.05rem,2.4vw,1.4rem)] italic leading-[1.45] text-ink-soft">
            {entry.dek}
          </p>
          <p className="mt-5 text-[9px] font-bold uppercase tracking-[0.24em] text-ink-faint">
            {formatDate(entry.date)} · {entry.readingTime} read · Three Ways Studios
          </p>
        </div>
      </header>

      <figure className="relative mx-auto -mt-2 w-full max-w-[1660px] px-4 sm:px-6 lg:px-10">
        <span className="relative block overflow-hidden">
          <Parallax distance={18}>
            <img
              src={entry.image}
              alt={entry.imageAlt}
              decoding="async"
              className="h-[clamp(240px,44vw,560px)] w-full object-cover"
            />
          </Parallax>
        </span>
        <figcaption className="mt-3 text-[9px] font-bold uppercase tracking-[0.2em] text-ink-faint">
          {entry.imageAlt}
        </figcaption>
      </figure>

      <div className="relative isolate border-t border-ink/16 py-14 sm:py-16">
        <div className="relative z-10 mx-auto grid w-full max-w-[1120px] gap-10 px-4 sm:px-6 lg:grid-cols-12">
          <div className="lg:col-span-8">
            {entry.body.map((paragraph, paragraphIndex) => (
              <Reveal key={paragraphIndex} preset="soft" delay={paragraphIndex * 0.04}>
                <p className="mb-5 max-w-[68ch] text-[15.5px] leading-[1.8] text-ink-soft sm:text-[16.5px]">
                  {paragraphIndex === 0 ? (
                    <span className="float-left mr-3 mt-1 font-display text-[3.4rem] leading-[0.72] text-crimson">
                      {paragraph.charAt(0)}
                    </span>
                  ) : null}
                  {paragraphIndex === 0 ? paragraph.slice(1) : paragraph}
                </p>
              </Reveal>
            ))}

            <Reveal className="my-9 border-y border-ink/14 py-7" preset="soft">
              <p className="font-signature text-[clamp(1.7rem,4.6vw,2.8rem)] leading-[1.05]">
                {entry.pullQuote}
              </p>
            </Reveal>
          </div>

          <aside className="lg:col-span-4">
            <div className="border-t border-ink/20 pt-5 lg:sticky lg:top-[120px]">
              <p className="tws-eyebrow text-ink-faint">Next in the journal</p>
              {next ? (
                <Link to={`/journal/${next.slug}`} className="group mt-3 block">
                  <p className="font-display text-[1.35rem] uppercase leading-[0.98] tracking-[0.004em] text-ink transition-colors group-hover:text-crimson">
                    {next.title.split('\n').join(' ')}
                  </p>
                  <p className="mt-2 text-[12.5px] leading-relaxed text-ink-soft">{next.dek}</p>
                  <span className="mt-3.5 inline-flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.2em] text-crimson">
                    Read it
                    <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
                  </span>
                </Link>
              ) : null}

              <div className="mt-6 border-t border-ink/14 pt-4">
                <p className="tws-eyebrow text-ink-faint">In the shop</p>
                <Link to="/shop" className="tws-pill mt-3 h-12 w-full justify-center">
                  See the two pieces
                  <ArrowRight className="h-4 w-4" strokeWidth={2} />
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </article>
  );
}
