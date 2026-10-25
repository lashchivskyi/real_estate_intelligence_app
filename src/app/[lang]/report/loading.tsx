/** Shown while live sources (geocoder, OSM, DIM.RIA, NBU) are queried. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6" aria-busy="true">
      <div className="h-4 w-48 animate-pulse rounded bg-surface2" />
      <div className="mt-4 h-12 w-2/3 animate-pulse rounded-lg bg-surface2" />
      <div className="mt-10 h-72 animate-pulse rounded-3xl bg-surface2" />
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-2xl bg-surface2" style={{ animationDelay: `${i * 120}ms` }} />
        ))}
      </div>
    </div>
  );
}
