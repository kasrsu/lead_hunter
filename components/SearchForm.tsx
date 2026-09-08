"use client";

interface SearchFormProps {
  keyword: string;
  location: string;
  apiKey: string;
  minRating: number;
  minReviews: number;
  loading: boolean;
  onChange: (field: string, value: string | number) => void;
  onSubmit: () => void;
}

export default function SearchForm({
  keyword,
  location,
  apiKey,
  minRating,
  minReviews,
  loading,
  onChange,
  onSubmit,
}: SearchFormProps) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="grid gap-4 rounded-xl border border-ink-border bg-ink-surface p-6"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm">
          <span className="text-paper-muted">Google Places API key</span>
          <input
            type="password"
            required
            value={apiKey}
            onChange={(e) => onChange("apiKey", e.target.value)}
            placeholder="AIza..."
            className="rounded-lg border border-ink-border bg-ink px-3 py-2 font-mono text-sm text-paper placeholder:text-paper-muted/50 focus:border-signal"
          />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="text-paper-muted">Business type</span>
          <input
            required
            value={keyword}
            onChange={(e) => onChange("keyword", e.target.value)}
            placeholder="restaurant"
            className="rounded-lg border border-ink-border bg-ink px-3 py-2 text-sm text-paper placeholder:text-paper-muted/50 focus:border-signal"
          />
        </label>
      </div>

      <label className="grid gap-1.5 text-sm">
        <span className="text-paper-muted">Location</span>
        <input
          required
          value={location}
          onChange={(e) => onChange("location", e.target.value)}
          placeholder="Colombo, Sri Lanka"
          className="rounded-lg border border-ink-border bg-ink px-3 py-2 text-sm text-paper placeholder:text-paper-muted/50 focus:border-signal"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm">
          <span className="text-paper-muted">Minimum rating</span>
          <input
            type="number"
            min={0}
            max={5}
            step={0.1}
            value={minRating}
            onChange={(e) => onChange("minRating", Number(e.target.value))}
            className="rounded-lg border border-ink-border bg-ink px-3 py-2 font-mono text-sm text-paper focus:border-signal"
          />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="text-paper-muted">Minimum reviews</span>
          <input
            type="number"
            min={0}
            value={minReviews}
            onChange={(e) => onChange("minReviews", Number(e.target.value))}
            className="rounded-lg border border-ink-border bg-ink px-3 py-2 font-mono text-sm text-paper focus:border-signal"
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="mt-2 rounded-lg bg-signal px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-signal/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Scanning…" : "Scan for leads"}
      </button>
    </form>
  );
}
