import Link from "next/link";

export default function Nav() {
  return (
    <header className="sticky top-0 z-20 border-b border-ink-border bg-ink/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Link
          href="/"
          className="flex items-baseline gap-2 font-mono text-xs uppercase tracking-widest"
        >
          <span className="h-2 w-2 self-center rounded-full bg-signal" aria-hidden />
          <span className="text-paper">Lead Hunter</span>
          <span className="hidden text-paper-muted/60 sm:inline">/ lead management</span>
        </Link>
        <nav className="flex items-center gap-6 font-mono text-xs text-paper-muted">
          <Link href="/" className="transition hover:text-paper">
            Dashboard
          </Link>
          <Link href="/#scan" className="transition hover:text-paper">
            New scan
          </Link>
        </nav>
      </div>
    </header>
  );
}
