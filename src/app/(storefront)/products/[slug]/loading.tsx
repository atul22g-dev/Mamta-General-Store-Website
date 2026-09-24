/** Route-level loading state for the product detail page. */
export default function ProductLoading() {
  return (
    <div
      className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-12"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="bg-muted mb-8 h-3 w-40 rounded" />
      <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
        <div className="bg-muted aspect-square w-full rounded-2xl" />
        <div className="space-y-4">
          <div className="bg-muted h-3 w-24 rounded" />
          <div className="bg-muted h-10 w-3/4 rounded" />
          <div className="bg-muted h-4 w-32 rounded" />
          <div className="bg-muted mt-8 h-24 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
