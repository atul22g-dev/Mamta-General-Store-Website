import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/skeleton";

/** Route-level loading state: toolbar + card skeleton grid. */
export default function ShopLoading() {
  return (
    <Container className="flex flex-1 flex-col py-12 sm:py-16">
      <div className="mx-auto w-full max-w-md space-y-3 text-center">
        <Skeleton className="mx-auto h-3 w-16" />
        <Skeleton className="mx-auto h-8 w-48" />
        <Skeleton className="mx-auto h-4 w-72" />
      </div>
      <div className="mt-10 flex items-center justify-between">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>
      <div className="mt-6 grid grid-cols-2 gap-4 sm:gap-6 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="space-y-3">
            <Skeleton className="aspect-[3/4] w-full rounded-xl" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-9 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </Container>
  );
}
