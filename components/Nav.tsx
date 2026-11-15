import Link from "next/link";

export default function Nav() {
  return (
    <header className="sticky top-0 z-20 glass-header">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
        <Link
          href="/"
          className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest font-bold text-slate-900"
        >
          <span className="h-2.5 w-2.5 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 shadow-xs" aria-hidden />
          <span>Lead Hunter</span>
          <span className="hidden text-orange-950/70 sm:inline">/ Lead OS</span>
        </Link>
        <nav className="flex items-center gap-6 font-mono text-xs font-bold text-slate-700">
          <Link href="/" className="transition hover:text-orange-600">
            Dashboard
          </Link>
          <Link href="/import" className="transition hover:text-orange-600">
            Ingestion &amp; Scan
          </Link>
        </nav>
      </div>
    </header>
  );
}
