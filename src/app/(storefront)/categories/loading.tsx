import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/skeleton";

/** Categories page skeleton — shown while the database query streams. */
export default function CategoriesLoading() {
  return (
    <Container className="flex flex-1 flex-col py-16 sm:py-20">
      <div className="flex flex-col items-center gap-3">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="aspect-4/5 rounded-xl" />
        ))}
      </div>
    </Container>
  );
}
