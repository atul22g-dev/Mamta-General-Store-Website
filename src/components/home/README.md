# `components/home/`

Homepage sections, one component per band, composed top-to-bottom in
`src/app/(storefront)/page.tsx`:

- **`hero.tsx`** — editorial split hero with headline and CTAs (shows a real
  shop product; a single Unsplash fallback renders while the catalog is empty)
- **`featured-products.tsx`** — handpicked products on a contrasting band
- **`new-arrivals.tsx`** — latest additions
- **`call-to-action.tsx`** — closing CTA banner

All product/category data comes from Supabase (`lib/supabase/catalog.ts`) via
server components in the storefront pages.
