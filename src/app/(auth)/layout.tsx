/** Chrome for signed-out screens: warm wash, no bottom navigation. */
export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="relative min-h-dvh overflow-x-clip">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-primary/10 via-brand-amber/10 to-transparent"
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
