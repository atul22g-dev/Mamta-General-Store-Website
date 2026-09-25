"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

import type { CategoryOption } from "@/components/admin/product-form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Search box + category/status filters. State lives in the URL
 * (?q=&category=&status=&page=) so lists are shareable and back/forward-safe.
 * Debounced, server-refetching via router.replace.
 */
export function ProductFilters({ categories }: { categories: CategoryOption[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Lazy initializer: the function runs once on mount, not on every render.
  const [query, setQuery] = React.useState(() => searchParams.get("q") ?? "");
  const debounceRef = React.useRef<ReturnType<typeof setTimeout>>(null);

  const updateParams = React.useCallback(
    (changes: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(changes)) {
        if (value === null || value === "") params.delete(key);
        else params.set(key, value);
      }
      params.delete("page"); // any filter change resets pagination
      router.replace(params.size ? `/admin/products?${params}` : "/admin/products");
    },
    [router, searchParams],
  );

  const onQueryChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => updateParams({ q: value }), 300);
  };

  const category = searchParams.get("category") ?? "all";
  const status = searchParams.get("status") ?? "all";

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search
          aria-hidden="true"
          className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2"
        />
        <Input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search name, SKU or slug…"
          aria-label="Search products"
          className="pl-9 md:pl-9"
        />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => onQueryChange("")}
            className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2.5 -translate-y-1/2"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        )}
      </div>

      {/* Selects stack full-width on phones so long category names stay
          readable; share the row from sm: up. */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Select
          value={category}
          onValueChange={(value) => updateParams({ category: value === "all" ? null : value })}
        >
          <SelectTrigger className="w-full sm:w-44" aria-label="Filter by category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={status}
          onValueChange={(value) => updateParams({ status: value === "all" ? null : value })}
        >
          <SelectTrigger className="w-full sm:w-36" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
