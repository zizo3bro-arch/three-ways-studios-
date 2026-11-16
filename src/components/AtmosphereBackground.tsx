import { useEffect, useState } from 'react';

export function AtmosphereBackground() {
  const [pointer, setPointer] = useState({ x: 50, y: 35 });

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (media.matches) return;

    let rafId = 0;
    const handleMove = (e: MouseEvent) => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const x = (e.clientX / window.innerWidth) * 100;
        const y = (e.clientY / window.innerHeight) * 100;
        setPointer({ x, y });
      });
    };

    window.addEventListener('mousemove', handleMove, { passive: true });
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', handleMove);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#060405]"
    >
      {/* SVG Turbulence Filter for organic code-generated red smoke */}
      <svg className="absolute h-0 w-0" focusable="false">
        <defs>
          <filter id="tws-smoke-turbulence" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.012 0.018"
              numOctaves="3"
              seed="7"
              result="noise"
            >
              <animate
                attributeName="baseFrequency"
                dur="36s"
                values="0.012 0.018;0.017 0.013;0.010 0.021;0.012 0.018"
                repeatCount="indefinite"
              />
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="78" />
          </filter>
        </defs>
      </svg>

      {/* Base continuous deep charcoal-to-crimson atmospheric gradient */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 24%, rgba(125, 10, 18, 0.32) 0%, rgba(45, 5, 8, 0.28) 38%, rgba(6, 4, 5, 0.96) 78%)',
        }}
      />

      {/* Code-generated animated crimson smoke plumes */}
      <div className="tws-smoke-core absolute -top-[12%] left-[8%] h-[78vh] w-[84vw] rounded-full mix-blend-screen" />
      <div className="tws-smoke-plume-a absolute -top-[8%] -left-[12%] h-[92vh] w-[96vw] rounded-full mix-blend-screen" />
      <div className="tws-smoke-plume-b absolute top-[18%] -right-[16%] h-[95vh] w-[72vw] rounded-full mix-blend-screen" />
      <div className="tws-smoke-plume-c absolute -bottom-[18%] -right-[10%] h-[82vh] w-[78vw] rounded-full mix-blend-screen" />

      {/* Subtle mouse-responsive red ambient aura */}
      <div
        className="absolute inset-0 transition-opacity duration-500"
        style={{
          background: `radial-gradient(520px circle at ${pointer.x}% ${pointer.y}%, rgba(180, 14, 22, 0.14), transparent 72%)`,
        }}
      />

      {/* Fine editorial scratches and film grain */}
      <div className="tws-editorial-scratches absolute inset-0 opacity-80" />
      <div className="tws-film-grain absolute inset-0" />

      {/* Gentle edge vignette to protect typography contrast */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 45%, transparent 45%, rgba(4, 2, 3, 0.62) 100%)',
        }}
      />
    </div>
  );
}
