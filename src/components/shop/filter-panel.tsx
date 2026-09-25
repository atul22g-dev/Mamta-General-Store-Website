"use client";

import * as React from "react";
import { Check, Search, X } from "lucide-react";

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
  const searchInputRef = React.useRef<HTMLInputElement>(null);
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
            ref={searchInputRef}
            type="search"
            value={filters.query}
            onChange={(event) => onFiltersChange({ ...filters, query: event.target.value })}
            placeholder="Search products…"
            aria-label="Search products"
            className="pr-9 pl-9 [&::-webkit-search-cancel-button]:hidden"
          />
          {/* Visual icon is 28px; the ::before expands the tap target to the
              44px minimum on touch without shifting the layout. */}
          {filters.query !== "" && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                onFiltersChange({ ...filters, query: "" });
                // Keep keyboard users anchored: the button unmounts on click,
                // which would otherwise drop focus to <body>.
                searchInputRef.current?.focus();
              }}
              className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full transition-colors focus-visible:ring-[3px] focus-visible:outline-none before:absolute before:top-1/2 before:left-1/2 before:size-11 before:-translate-x-1/2 before:-translate-y-1/2 before:rounded-full"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          )}
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
                    "flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent/50 has-focus-visible:ring-ring/50 has-focus-visible:ring-[3px] has-focus-visible:outline-none",
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
                  "focus-visible:ring-ring/50 min-h-11 rounded-full border px-3.5 text-xs transition-colors focus-visible:ring-[3px] focus-visible:outline-none sm:min-h-0 sm:py-1.5",
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

      <label className="focus-visible:ring-ring/50 -mx-2 flex min-h-11 cursor-pointer items-center gap-2.5 rounded-md px-2 text-sm transition-shadow has-focus-visible:ring-[3px] has-focus-visible:outline-none sm:min-h-0">
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
