/* =========================================================
   SprayType — the airbrushed crimson titan lettering from the
   campaign frame. Three stacked static blur passes (one-time
   raster, no animated filters) + overspray speckle so the paint
   sits *on* the paper instead of over it.
   Decorative: the real word is exposed via the <h1> beside it.
   ========================================================= */

interface SprayTypeProps {
  text: string;
  className?: string;
}

export function SprayType({ text, className = '' }: SprayTypeProps) {
  return (
    <div aria-hidden="true" className={`tws-spray select-none ${className}`}>
      <span className="tws-spray__layer tws-spray__layer--far">{text}</span>
      <span className="tws-spray__layer tws-spray__layer--mid">{text}</span>
      <span className="tws-spray__layer tws-spray__layer--core">{text}</span>
      <span className="tws-spray__overspray" />
    </div>
  );
}
