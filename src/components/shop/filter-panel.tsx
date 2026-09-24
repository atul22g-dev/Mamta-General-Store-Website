"use client";

import { Check, Search } from "lucide-react";

import type { CatalogFilters } from "@/lib/catalog";
import type { CategoryRef } from "@/types/category";
import { PRICE_BANDS, type PriceBandId } from "@/lib/catalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface FilterPanelProps {
  filters: CatalogFilters;
  /** Selected price band id, or null for custom/none. */
  priceBand: PriceBandId | null;
  categories: CategoryRef[];
  counts: Record<string, number>;
  resultCount: number;
  onFiltersChange: (filters: CatalogFilters) => void;
  onPriceBandChange: (band: PriceBandId | null) => void;
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="pb-2.5 text-xs font-medium tracking-widest text-muted-foreground uppercase">
        {title}
      </p>
      {children}
    </div>
  );
}

/**
 * Shop filters: search, category checkboxes with counts, price-band chips and
 * an in-stock toggle. Presentational — state lives in ShopView.
 */
export function FilterPanel({
  filters,
  priceBand,
  categories,
  counts,
  resultCount,
  onFiltersChange,
  onPriceBandChange,
}: FilterPanelProps) {
  const selectedCategories = new Set(filters.categories);
  const toggleCategory = (slug: string) => {
    const next = filters.categories.includes(slug)
      ? filters.categories.filter((c) => c !== slug)
      : [...filters.categories, slug];
    onFiltersChange({ ...filters, categories: next });
  };

  const hasActiveFilters =
    filters.query !== "" ||
    filters.categories.length > 0 ||
    filters.inStockOnly ||
    priceBand !== null;

  return (
    <div className="space-y-6">
      <FilterGroup title="Search">
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            value={filters.query}
            onChange={(event) => onFiltersChange({ ...filters, query: event.target.value })}
            placeholder="Search products…"
            aria-label="Search products"
            className="pl-9"
          />
        </div>
      </FilterGroup>

      <Separator />

      <FilterGroup title="Category">
        <ul className="space-y-1.5">
          {categories.map((category) => {
            const checked = selectedCategories.has(category.slug);
            const count = counts[category.slug] ?? 0;
            return (
              <li key={category.slug}>
                <label
                  className={cn(
                    "flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent/50",
                    count === 0 && "text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded border transition-colors",
                      checked
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input bg-background",
                    )}
                  >
                    {checked && <Check className="size-3" />}
                  </span>
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    onChange={() => toggleCategory(category.slug)}
                  />
                  <span className="flex-1">{category.name}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </FilterGroup>

      <Separator />

      <FilterGroup title="Price">
        <div className="flex flex-wrap gap-2">
          {PRICE_BANDS.map((band) => {
            const active = priceBand === band.id;
            return (
              <button
                key={band.id}
                type="button"
                aria-pressed={active}
                onClick={() => onPriceBandChange(active ? null : band.id)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-background hover:bg-accent/60",
                )}
              >
                {band.label}
              </button>
            );
          })}
        </div>
      </FilterGroup>

      <Separator />

      <label className="flex cursor-pointer items-center gap-2.5 text-sm">
        <span
          className={cn(
            "relative h-5 w-9 shrink-0 rounded-full transition-colors",
            filters.inStockOnly ? "bg-primary" : "bg-input",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 size-4 rounded-full bg-background shadow-xs transition-all",
              filters.inStockOnly ? "left-4.5" : "left-0.5",
            )}
          />
        </span>
        <input
          type="checkbox"
          className="sr-only"
          checked={filters.inStockOnly}
          onChange={(event) => onFiltersChange({ ...filters, inStockOnly: event.target.checked })}
        />
        In stock only
      </label>

      {hasActiveFilters && (
        <>
          <Separator />
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">{resultCount} results</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onFiltersChange({ query: "", categories: [], inStockOnly: false });
                onPriceBandChange(null);
              }}
            >
              Clear all
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
