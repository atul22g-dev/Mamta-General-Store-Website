import { Loader2 } from "lucide-react";

/**
 * Navigation loading state for every /admin route (excluding login, which
 * renders instantly). Admin pages are force-dynamic and hit the database on
 * every render — this skeleton keeps navigation feeling instant while the
 * data loads, and it inherits the protected layout's chrome.
 */
export default function AdminLoading() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading">
      <div className="space-y-2">
        <div className="bg-muted h-7 w-40 animate-pulse rounded-lg" />
        <div className="bg-muted h-4 w-72 animate-pulse rounded-lg" />
      </div>
      <div className="bg-muted h-24 animate-pulse rounded-xl" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="bg-muted h-28 animate-pulse rounded-xl" />
        ))}
      </div>
      <Loader2 aria-hidden="true" className="text-muted-foreground size-5 animate-spin" />
    </div>
  );
}
