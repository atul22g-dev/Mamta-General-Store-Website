import Link from "next/link";

export default function ProductEditNotFound() {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <p className="text-sm font-medium">Product not found</p>
      <p className="text-muted-foreground max-w-xs text-xs">
        It may have been deleted. Head back to the product list.
      </p>
      <Link
        href="/admin/products"
        className="mt-2 inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
      >
        Back to products
      </Link>
    </div>
  );
}
