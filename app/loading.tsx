export default function Loading() {
  return (
    <div className="grid gap-6">
      <div className="h-56 animate-pulse rounded-3xl border border-white/10 bg-white/5" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-40 animate-pulse rounded-3xl border border-white/10 bg-white/5" />
        ))}
      </div>
    </div>
  );
}
