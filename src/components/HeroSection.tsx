import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export function HeroSection() {
  return (
    <section className="relative overflow-hidden border-b border-white/10 bg-[#060405]">
      <div className="relative mx-auto grid min-h-[82vh] max-w-7xl grid-cols-1 items-center gap-8 px-4 py-12 sm:px-6 lg:grid-cols-12 lg:gap-12 lg:px-8 lg:py-16">
        {/* Left Editorial Content */}
        <div className="relative z-10 flex flex-col items-start lg:col-span-6">
          <div className="mb-5 inline-flex items-center gap-2.5 rounded-full border border-[#b30e16]/40 bg-[#b30e16]/10 px-4 py-1.5">
            <span className="h-2 w-2 rounded-full bg-[#d4121b]" />
            <span className="text-[11px] font-semibold tracking-[0.26em] text-[#f2eded] uppercase">
              2026 Underground Campaign
            </span>
          </div>

          <h1 className="font-display-tall text-5xl leading-[0.95] tracking-wide text-white uppercase sm:text-6xl lg:text-7xl">
            FASHION
            <span className="block text-[#d4121b]">BEYOND LIMITS</span>
          </h1>

          <p className="mt-5 max-w-lg text-sm leading-relaxed text-[#b8adad] sm:text-base">
            THREE WAYS STUDIOS is an underground luxury streetwear house engineered around
            architectural wide-flare and super-flare silhouettes. Cut from heavyweight raw denim,
            technical ripstop, and Italian wool.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              to="/collections"
              className="inline-flex items-center gap-3 rounded-full bg-[#b30e16] px-8 py-4 text-xs font-bold tracking-[0.24em] text-white uppercase shadow-[0_0_30px_rgba(179,14,22,0.4)] transition hover:bg-[#d4121b] active:scale-[0.98]"
            >
              SHOP NOW
              <ArrowRight className="h-4 w-4" />
            </Link>

            <Link
              to="/collections?filter=new"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-7 py-4 text-xs font-semibold tracking-[0.22em] text-[#f2eded] uppercase transition hover:border-white/40 hover:bg-white/10 active:scale-[0.98]"
            >
              NEW ARRIVALS
            </Link>
          </div>

          <div className="mt-10 grid grid-cols-3 gap-6 border-t border-white/10 pt-6 text-left">
            <div>
              <p className="font-display-tall text-2xl tracking-wider text-white">14 OZ</p>
              <p className="mt-0.5 text-[11px] tracking-[0.16em] text-[#9e9494] uppercase">
                Raw Selvedge
              </p>
            </div>
            <div>
              <p className="font-display-tall text-2xl tracking-wider text-white">34 CM</p>
              <p className="mt-0.5 text-[11px] tracking-[0.16em] text-[#9e9494] uppercase">
                Super-Flare Hem
              </p>
            </div>
            <div>
              <p className="font-display-tall text-2xl tracking-wider text-white">COD</p>
              <p className="mt-0.5 text-[11px] tracking-[0.16em] text-[#9e9494] uppercase">
                Nationwide Delivery
              </p>
            </div>
          </div>
        </div>

        {/* Right Campaign Photography */}
        <div className="relative lg:col-span-6">
          <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0d0809] shadow-2xl">
            <img
              src="/images/hero-campaign.jpg"
              alt="THREE WAYS STUDIOS 2026 Underground Streetwear Campaign"
              fetchPriority="high"
              decoding="async"
              className="h-full w-full object-cover object-center"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#060405] via-transparent to-transparent opacity-70" />
            <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between">
              <div>
                <p className="text-[10px] font-semibold tracking-[0.24em] text-[#d4121b] uppercase">
                  Editorial Look 01
                </p>
                <p className="mt-1 text-sm font-medium text-white">
                  Obsidian Super-Flare &amp; Nocturne Cargo
                </p>
              </div>
              <Link
                to="/collections"
                className="rounded-full border border-white/25 bg-black/60 px-4 py-2 text-[10px] font-semibold tracking-[0.2em] text-white uppercase backdrop-blur-sm transition hover:border-[#d4121b] hover:bg-[#b30e16]"
              >
                Explore
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
