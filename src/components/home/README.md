# `components/home/`

Homepage sections, one component per band:

- **`hero.tsx`** — editorial split hero with headline and CTAs
- **`featured-products.tsx`** — handpicked products on a contrasting band
- **`new-arrivals.tsx`** — latest additions
- **`why-shop-with-us.tsx`** — quiet trust badges
- **`call-to-action.tsx`** — closing CTA banner

Composed top-to-bottom in `src/app/page.tsx`. Product/category data comes from
`src/lib/placeholder-data.ts` until the database is connected — the components
themselves will keep working with real data since they accept plain props.
