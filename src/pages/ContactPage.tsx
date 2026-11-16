import { useEffect } from 'react';
import { Banknote, MapPin, Mail, Truck } from 'lucide-react';

export function ContactPage() {
  useEffect(() => {
    document.title = 'Contact — THREE WAYS STUDIOS';
  }, []);

  return (
    <main className="mx-auto max-w-4xl px-5 pt-32 pb-24 sm:px-8">
      <div className="border-b border-white/12 pb-8">
        <p className="text-[10px] tracking-[0.24em] text-[#d4121b] uppercase">CLIENT CONCIERGE</p>
        <h1 className="mt-2 text-3xl font-normal text-white">Contact THREE WAYS STUDIOS</h1>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="border border-white/12 bg-black/35 p-6">
          <Mail className="h-5 w-5 text-[#d4121b]" />
          <h2 className="mt-3 text-xs font-medium tracking-[0.18em] text-white uppercase">
            Studio Inquiries
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-[#b8adad]">
            For sizing questions, order modifications, or press requests, use your checkout email
            reference when reaching out to our Cairo studio team.
          </p>
        </div>

        <div className="border border-white/12 bg-black/35 p-6">
          <MapPin className="h-5 w-5 text-[#d4121b]" />
          <h2 className="mt-3 text-xs font-medium tracking-[0.18em] text-white uppercase">
            Delivery Coverage
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-[#b8adad]">
            Shipping across Cairo, Giza, Alexandria, and all Egyptian governorates.
          </p>
        </div>

        <div className="border border-white/12 bg-black/35 p-6">
          <Banknote className="h-5 w-5 text-[#d4121b]" />
          <h2 className="mt-3 text-xs font-medium tracking-[0.18em] text-white uppercase">
            Cash on Delivery Only
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-[#b8adad]">
            All orders are settled in cash directly with the courier upon delivery.
          </p>
        </div>

        <div className="border border-white/12 bg-black/35 p-6">
          <Truck className="h-5 w-5 text-[#d4121b]" />
          <h2 className="mt-3 text-xs font-medium tracking-[0.18em] text-white uppercase">
            Order Dispatch
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-[#b8adad]">
            Orders are verified by phone and dispatched within 24–48 business hours.
          </p>
        </div>
      </div>
    </main>
  );
}
