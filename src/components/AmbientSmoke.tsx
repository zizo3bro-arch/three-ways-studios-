export function AmbientSmoke() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none"
    >
      {/* Plume 1 — sweeping crimson drift from upper-left across center */}
      <div className="tws-smoke-plume tws-smoke-plume-1" />
      {/* Plume 2 — slow deep-crimson counter-drift from lower-right */}
      <div className="tws-smoke-plume tws-smoke-plume-2" />
      {/* Plume 3 — central organic crimson haze breathing gently */}
      <div className="tws-smoke-plume tws-smoke-plume-3" />
    </div>
  );
}
