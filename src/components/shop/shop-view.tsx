"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ListFilter, SlidersHorizontal, X } from "lucide-react";

import type { Product, ProductSort } from "@/types/product";
import type { CategoryRef } from "@/types/category";
import {
  countByCategory,
  filterAndSort,
  parseSort,
  PRICE_BANDS,
  type CatalogFilters,
  type PriceBandId,
} from "@/lib/catalog";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ProductCard } from "@/components/product/product-card";
import { FilterPanel } from "@/components/shop/filter-panel";

interface ShopViewProps {
  products: Product[];
  categories?: CategoryRef[];
  initialQuery?: string;
  initialCategory?: string;
  className?: string;
}

const SORT_LABELS: Record<ProductSort, string> = {
  newest: "Newest",
  "price-asc": "Price: Low to High",
  "price-desc": "Price: High to Low",
};

function bandFromFilters(filters: CatalogFilters): PriceBandId | null {
  return (
    PRICE_BANDS.find((b) => b.min === filters.priceMin && b.max === filters.priceMax)?.id ?? null
  );
}

/**
 * Interactive shop grid: search, category filter, price bands, sorting.
 * Filter state is mirrored to the URL (?q=&category=&sort=) so filtered views
 * are shareable and back/forward works.
 */
export function ShopView({
  products,
  categories,
  initialQuery = "",
  initialCategory = "",
  className,
}: ShopViewProps) {
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState<CatalogFilters>({
    query: initialQuery || (searchParams.get("q") ?? ""),
    categories: initialCategory
      ? [initialCategory]
      : (searchParams.get("category")?.split(",").filter(Boolean) ?? []),
    priceMin: undefined,
    priceMax: undefined,
    inStockOnly: searchParams.get("stock") === "in",
  });
  const [sort, setSort] = useState<ProductSort>(() => parseSort(searchParams.get("sort")));
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Keep a shareable URL without spamming history entries.
  // Optimistic address-bar sync (Next.js-documented History API pattern): the
  // URL mirrors filter state without navigating — no server round-trip per
  // keystroke, no flash of stale content, back/forward untouched.
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.query) params.set("q", filters.query);
    if (filters.categories.length) params.set("category", filters.categories.join(","));
    const band = bandFromFilters(filters);
    if (band) params.set("price", band);
    if (filters.inStockOnly) params.set("stock", "in");
    if (sort !== "newest") params.set("sort", sort);
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `/shop?${qs}` : "/shop");
  }, [filters, sort]);

  const counts = useMemo(() => countByCategory(products, filters), [products, filters]);
  const visible = useMemo(() => filterAndSort(products, filters, sort), [products, filters, sort]);

  const activeFilterCount =
    (filters.query ? 1 : 0) +
    filters.categories.length +
    (bandFromFilters(filters) ? 1 : 0) +
    (filters.inStockOnly ? 1 : 0);

  const applyPriceBand = useCallback((band: PriceBandId | null) => {
    setFilters((current) => {
      const found = PRICE_BANDS.find((b) => b.id === band);
      return { ...current, priceMin: found?.min, priceMax: found?.max };
    });
  }, []);

  const filterPanel = (
    <FilterPanel
      filters={filters}
      priceBand={bandFromFilters(filters)}
      categories={categories ?? []}
      counts={counts}
      resultCount={visible.length}
      onFiltersChange={setFilters}
      onPriceBandChange={applyPriceBand}
    />
  );

  return (
    <div className={cn("grid gap-10 lg:grid-cols-[240px_1fr]", className)}>
      {/* Desktop sidebar */}
      <aside className="hidden lg:block">
        <div className="sticky top-24">{filterPanel}</div>
      </aside>

      <div>
        {/* Toolbar — wraps on the narrowest phones where the filter button
            plus sort select exceed the viewport's min-content width. */}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {visible.length} {visible.length === 1 ? "product" : "products"}
          </p>
          <div className="flex items-center gap-2">
            <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="lg:hidden">
                  <SlidersHorizontal />
                  Filters
                  {activeFilterCount > 0 && (
                    <span
                      className="ml-0.5 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground"
                      aria-hidden="true"
                    >
                      {activeFilterCount}
                    </span>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[85vw] max-w-80 overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Filters</SheetTitle>
                  <SheetDescription className="sr-only">Filter products</SheetDescription>
                </SheetHeader>
                <div className="px-4 pb-6">
                  {filterPanel}
                  <Button className="mt-6 w-full" onClick={() => setIsFilterOpen(false)}>
                    Show {visible.length} results
                  </Button>
                </div>
              </SheetContent>
            </Sheet>

            <label className="flex min-w-0 items-center gap-2 text-sm">
              <ListFilter aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
              <span className="sr-only sm:not-sr-only">Sort</span>
              <select
                value={sort}
                onChange={(event) => setSort(parseSort(event.target.value))}
                className="h-9 min-w-0 max-w-full rounded-lg border bg-background px-2.5 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                aria-label="Sort products"
              >
                {(Object.keys(SORT_LABELS) as ProductSort[]).map((value) => (
                  <option key={value} value={value}>
                    {SORT_LABELS[value]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* Grid / empty state */}
        {visible.length > 0 ? (
          <div className="mt-6 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
            {visible.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-xl border border-dashed py-16 text-center">
            <p className="font-display text-lg font-medium">No products found</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
              Try a different search term, widen the price range, or clear the filters.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-6"
              onClick={() => {
                setFilters({
                  query: "",
                  categories: [],
                  priceMin: undefined,
                  priceMax: undefined,
                  inStockOnly: false,
                });
                setSort("newest");
              }}
            >
              <X />
              Clear all filters
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
