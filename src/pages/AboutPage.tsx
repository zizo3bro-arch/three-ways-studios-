import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

export function AboutPage() {
  useEffect(() => {
    document.title = 'About — THREE WAYS STUDIOS';
  }, []);

  return (
    <main className="mx-auto max-w-4xl px-5 pt-32 pb-24 sm:px-8">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <p className="text-[10px] tracking-[0.26em] text-[#d4121b] uppercase">
          THE STUDIO MANIFESTO
        </p>
        <h1 className="mt-3 text-3xl font-normal text-white sm:text-4xl">
          THREE WAYS STUDIOS
        </h1>
        <p className="font-script mt-2 text-3xl text-[#e6dfdf]">Fashion Beyond Limits.</p>

        <div className="mt-10 space-y-6 border-t border-white/12 pt-8 text-sm leading-[1.85] text-[#cfc6c6]">
          <p>
            THREE WAYS STUDIOS is a Cairo-born luxury streetwear house dedicated to a single obsession:
            women&apos;s pants. By focusing exclusively on trousers, cargos, tailored wide-legs, and
            sculptural denim, every pattern is refined from waist tension to floor break.
          </p>
          <p>
            Our visual identity lives between shadow and crimson — represented by three panthers in
            motion. Unapologetic, agile, and precise. Each drop is released in disciplined runs with
            verified sizing data so every piece fits with intention.
          </p>
          <p>
            Every order within Egypt is fulfilled via Cash on Delivery, supported by personal sizing
            guidance through our garment-specific Smart Size Finder.
          </p>
        </div>

        <div className="mt-10">
          <Link
            to="/#products"
            className="inline-block rounded-full border border-white/25 px-7 py-2.5 text-xs tracking-[0.2em] text-white uppercase transition-colors hover:border-[#d4121b] hover:bg-[#b30e16]"
          >
            Explore the Collection
          </Link>
        </div>
      </motion.div>
    </main>
  );
}
