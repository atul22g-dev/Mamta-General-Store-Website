# `components/layout/`

Site chrome shared across all pages:

- **`site-header.tsx`** — sticky, responsive header (desktop nav + search/cart; mobile menu button + cart)
- **`mobile-nav.tsx`** — clean mobile navigation menu (rendered in the header's slide-in sheet)
- **`nav-link.tsx`** — active-state navigation link shared by desktop and mobile navs
- **`site-footer.tsx`** — brand blurb, shop/category link columns, contact details, copyright

All links come from `src/config/navigation.ts`; contact details from
`src/config/site.ts`.
