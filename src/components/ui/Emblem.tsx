import { Link } from 'react-router-dom';

export function Emblem() {
  return (
    <Link to="/" className="brand-lockup" aria-label="Three Ways Studios — home">
      <img className="brand-mark" src="/media/studio-mark.webp" width="144" height="166" alt="" />
      <img className="brand-name" src="/media/signature.svg" width="1593" height="465" alt="" />
    </Link>
  );
}

export function EmblemPlate({ className = '' }: { className?: string }) {
  return (
    <img
      src="/assets/three-ways-studios-logo-full.jpeg"
      alt="Three Ways Studios — three panthers over the crimson cross"
      width="1200"
      height="1287"
      decoding="async"
      loading="lazy"
      className={`h-full w-full object-cover ${className}`}
    />
  );
}
