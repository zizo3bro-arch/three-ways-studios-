export function AtmosphereBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#060405]"
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(153, 13, 20, 0.14) 0%, transparent 65%), radial-gradient(ellipse 60% 45% at 85% 85%, rgba(110, 8, 13, 0.10) 0%, transparent 60%)',
        }}
      />
    </div>
  );
}
