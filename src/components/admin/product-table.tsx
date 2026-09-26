import type { LinkProps } from "next/link";
import Link from "next/link";
import { ImageOff, PackageOpen } from "lucide-react";

import type { listAdminProducts } from "@/lib/supabase/admin-products";
import { formatPrice } from "@/lib/utils";
import { ProductRowActions } from "@/components/admin/product-actions";
import { SafeImage } from "@/components/product/safe-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type AdminProductRow = Awaited<ReturnType<typeof listAdminProducts>>["rows"][number];

/** Product thumbnail: image when available, placeholder icon otherwise. */
function ProductThumb({ imageUrl, size }: { imageUrl: string | null; size: "sm" | "md" }) {
  return (
    <span
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted ${
        size === "sm" ? "size-10" : "size-12"
      }`}
    >
      {imageUrl ? (
        <SafeImage
          src={imageUrl}
          alt=""
          fill
          sizes="48px"
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <ImageOff aria-hidden="true" className="text-muted-foreground size-4" />
      )}
    </span>
  );
}

/** Active/Featured/stock status badges. Untracked (null) stock = available. */
function ProductBadges({
  active,
  featured,
  stock,
}: {
  active: boolean;
  featured: boolean;
  stock: number | null;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge variant={active ? "secondary" : "outline"}>{active ? "Active" : "Inactive"}</Badge>
      {featured && <Badge variant="accent">Featured</Badge>}
      {stock === 0 && <Badge variant="destructive">Out of stock</Badge>}
    </div>
  );
}

/** Price with optional struck-through original (only when it's a real discount). */
function ProductPrice({ price, discountPrice }: { price: number; discountPrice: number | null }) {
  const hasDiscount = discountPrice !== null && discountPrice > price;
  return (
    <span className="tabular-nums">
      {hasDiscount ? (
        <span className="text-muted-foreground line-through">{formatPrice(discountPrice)}</span>
      ) : null}{" "}
      <span className="font-medium">{formatPrice(price)}</span>
    </span>
  );
}

/** Desktop table layout. */
function ProductTable({ rows }: { rows: AdminProductRow[] }) {
  return (
    <div className="bg-card mt-3 hidden overflow-hidden rounded-xl border shadow-soft md:block">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th scope="col" className="px-5 py-3 font-medium">
              Product
            </th>
            <th scope="col" className="px-5 py-3 font-medium">
              Category
            </th>
            <th scope="col" className="px-5 py-3 text-right font-medium">
              Price
            </th>
            <th scope="col" className="px-5 py-3 font-medium">
              Status
            </th>
            <th scope="col" className="px-5 py-3 text-right font-medium">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((product) => (
            <tr key={product.id} className="hover:bg-accent/40 transition-colors">
              <td className="px-5 py-3">
                <div className="flex items-center gap-3">
                  <ProductThumb imageUrl={product.imageUrl} size="sm" />
                  <div className="min-w-0">
                    <p className="max-w-56 truncate font-medium">{product.name}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      {product.sku ?? product.slug}
                    </p>
                  </div>
                </div>
              </td>
              <td className="text-muted-foreground px-5 py-3">{product.categoryName}</td>
              <td className="px-5 py-3 text-right">
                <ProductPrice price={product.price} discountPrice={product.discountPrice} />
              </td>
              <td className="px-5 py-3">
                <ProductBadges
                  active={product.active}
                  featured={product.featured}
                  stock={product.stock}
                />
              </td>
              <td className="px-5 py-3">
                <ProductRowActions
                  id={product.id}
                  name={product.name}
                  active={product.active}
                  featured={product.featured}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Mobile card layout. */
function ProductCards({ rows }: { rows: AdminProductRow[] }) {
  return (
    <div className="mt-3 space-y-3 md:hidden">
      {rows.map((product) => (
        <article key={product.id} className="bg-card rounded-xl border p-4 shadow-soft">
          {/* Title row: thumb + full-width name — actions live on their own
              row below so the name is never squeezed to a single letter. */}
          <div className="flex min-w-0 items-center gap-3">
            <ProductThumb imageUrl={product.imageUrl} size="md" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{product.name}</p>
              <p className="text-muted-foreground mt-0.5 truncate text-xs">
                {product.categoryName} · {formatPrice(product.price)}
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <ProductBadges
              active={product.active}
              featured={product.featured}
              stock={product.stock}
            />
            <ProductRowActions
              id={product.id}
              name={product.name}
              active={product.active}
              featured={product.featured}
            />
          </div>
        </article>
      ))}
    </div>
  );
}

/** Shown when the current search/filters match nothing. */
function NoProductsFound({ filtered }: { filtered: boolean }) {
  return (
    <div className="text-muted-foreground mt-8 flex flex-col items-center gap-3 py-12 text-center">
      <PackageOpen aria-hidden="true" className="size-8" />
      <p className="text-sm font-medium text-foreground">No products found</p>
      <p className="max-w-xs text-xs">
        {filtered
          ? "Try clearing the search or filters."
          : "Add your first product to get started."}
      </p>
    </div>
  );
}

interface ProductPaginationProps {
  page: number;
  totalPages: number;
  /** Current filter values — pagination links preserve them. */
  filters: { query?: string; categoryId?: string; status: string };
}

function pageHref(filters: ProductPaginationProps["filters"], page: number): LinkProps["href"] {
  const search = new URLSearchParams();
  if (filters.query) search.set("q", filters.query);
  if (filters.categoryId) search.set("category", filters.categoryId);
  if (filters.status !== "all") search.set("status", filters.status);
  search.set("page", String(page));
  return `/admin/products?${search}`;
}

/** Previous/next pagination over the filtered product list. */
function ProductPagination({ page, totalPages, filters }: ProductPaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <nav aria-label="Pagination" className="mt-6 flex items-center justify-center gap-2">
      {page > 1 ? (
        <Button variant="outline" size="sm" asChild>
          <Link href={pageHref(filters, page - 1)}>Previous</Link>
        </Button>
      ) : (
        <Button variant="outline" size="sm" disabled>
          Previous
        </Button>
      )}
      <span className="text-muted-foreground px-3 text-sm">
        Page {page} of {totalPages}
      </span>
      {page < totalPages ? (
        <Button variant="outline" size="sm" asChild>
          <Link href={pageHref(filters, page + 1)}>Next</Link>
        </Button>
      ) : (
        <Button variant="outline" size="sm" disabled>
          Next
        </Button>
      )}
    </nav>
  );
}

export interface AdminProductListProps {
  list: NonNullable<Awaited<ReturnType<typeof listAdminProducts>>>;
  /** Must match the pageSize used to fetch the list. */
  pageSize: number;
  query?: string;
  categoryId?: string;
  status: "all" | "active" | "inactive";
  page: number;
}

/** The full product list: count, desktop table, mobile cards, empty state, pagination. */
export function AdminProductList({
  list,
  pageSize,
  query,
  categoryId,
  status,
  page,
}: AdminProductListProps) {
  const totalPages = Math.max(1, Math.ceil(list.total / pageSize));
  const filtered = Boolean(query || categoryId || status !== "all");

  return (
    <>
      <p className="text-muted-foreground mt-4 text-sm">
        {list.total} product{list.total === 1 ? "" : "s"}
        {query ? ` matching “${query}”` : ""}
      </p>

      {list.rows.length === 0 ? (
        <NoProductsFound filtered={filtered} />
      ) : (
        <>
          <ProductTable rows={list.rows} />
          <ProductCards rows={list.rows} />
        </>
      )}

      <ProductPagination
        page={page}
        totalPages={totalPages}
        filters={{ query, categoryId, status }}
      />
    </>
  );
}
