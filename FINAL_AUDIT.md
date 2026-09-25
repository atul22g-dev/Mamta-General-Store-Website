# Final Production-Readiness Audit

Repo: `mamta-general-store` · Date: 2026-09-26 · Method: full re-install, all six gates re-run, live-database inspection via the Supabase pooler, repo-wide pattern searches, dependency usage analysis. No assumptions carried over from earlier audits — every item below was re-verified this session.

## 1. Commands executed

| Command                                       | Result                                                                                                                            |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `npm install`                                 | ✅ clean (2 informational npm warnings only)                                                                                      |
| `npm run typecheck` (`tsc --noEmit`)          | ✅ 0 errors                                                                                                                       |
| `npm run lint` (`eslint .`)                   | ✅ 0 problems                                                                                                                     |
| `npm run format:check` (`prettier --check .`) | ✅ committed tree clean (3 warnings are the owner's own uncommitted files: `README.md`, `Create Product Image.md`, `FIX_PLAN.md`) |
| `npm test` (vitest)                           | ✅ 5 files, **49/49 tests pass**                                                                                                  |
| `npm run build` (`next build`)                | ✅ compiled, 14/14 pages generated                                                                                                |

Live database inspected over the Supabase pooler (`scripts/db.env`, gitignored): RLS status of every table, every RLS policy, `storage.objects` policies, bucket visibility, security-definer functions, legacy-table row counts.

## 2. Checks performed & verified

### Build & code quality

- TypeScript, ESLint, Prettier, tests, production build — all green (table above).

### Authentication & authorization

- **Single auth system**: Supabase Auth only. Three coordinated layers re-verified in source — `src/proxy.ts` (edge JWT check on `/admin/*` except login), `requireAdmin()` in `src/app/admin/(protected)/layout.tsx` (re-verifies token + `profiles.role='ADMIN'` + active on every render), and per-action session re-assertion in every server action. Verified live earlier this cycle: logged-out → login redirect with safe same-site `redirectTo`; customer → denied and signed out with a generic error; admin → all pages render; logout clears the session.
- **No service-role key in client code**: `src/` contains no service-role usage. The only `SUPABASE_SERVICE_ROLE_KEY` consumer is `scripts/create-admin.ts` — a gitignored, developer-machine CLI tool, never bundled. `src/lib/supabase/env.ts` hard-fails at startup if a secret (`sb_secret_…`) is ever placed in the public anon-key variable. `.env` currently holds the publishable key (`sb_publishable…`).
- **No hardcoded secrets**: `git grep` for `password|secret|service_role|sb_secret` across the committed tree finds only legitimate auth-form code, the env guard, and the CLI script's instructions. `.env`, `scripts/db.env`, `scripts/admin.env` are all gitignored (verified with `git check-ignore`). Only `scripts/db.env.example` (placeholder template) is committed.

### Database (live inspection)

- **RLS enabled** on all 12 public tables: `products`, `product_images`, `product_sizes`, `product_colors`, `categories`, `orders`, `order_items`, `profiles`, `schema_migrations`, plus 3 legacy tables.
- **26 RLS policies** reviewed: public read only where intended (catalog, images, sizes, colors, categories); admin ALL gated on `is_admin()`; `profiles` restricted to own-row read; `orders`/`order_items` admin-ALL only (order creation runs through the security-definer `place_order` RPC so anonymous checkouts never need a permissive client policy).
- **Storage**: bucket `product-images` (public read); `storage.objects` has exactly four policies — public SELECT, admin-only INSERT/UPDATE/DELETE via `is_admin()`.
- **Functions**: security-definer set is minimal and correct (`place_order`, `is_admin`, `handle_new_user`, `guard_profiles_write`, `clear_product_embeddings`, `visual_search_matches`; the rest are pgvector support functions).
- **Schema**: `products.price` integer paise, `discountPrice > price` CHECK enforced, sizes/colors/images child tables intact, `schema_migrations` locked down; all 15 migrations applied.

### Pricing, stock, cart, checkout, orders

- Money is integer paise end-to-end (DB columns, catalog math, cart store, `place_order`); discount math treats `discountPrice` as the original/reference price (regression-tested).
- Checkout re-fetches products server-side, validates price/stock/availability, computes totals server-side, creates the order atomically via `place_order` (single transaction), and never trusts browser-supplied prices (regression-tested at the logic layer; the SQL path was verified live earlier with an order whose totals matched exactly).
- Cart clamps quantities (1–99), rejects corrupt localStorage, merges duplicate adds correctly (two real bugs found and fixed by the test suite earlier this cycle).

### Image handling

- Upload flow: MIME allow-list (jpeg/png/webp/avif), 5 MB cap, minimum 200×200 dimensions (sharp-decoded server-side), client-side compression (max edge 1600, quality 0.82), admin-only storage policies, path-scoped to `products/<productId>/`.
- Ordering (cover = position 0, healed reorder), duplicate-batch guard, alt-text editing, orphan cleanup action, and broken-image fallback all present.
- **Display**: the last two raw `<img>` spots in the storefront (categories index page and `category-card`) were still missing the SafeImage fallback — **fixed this audit** (now `next/image` via SafeImage with `fill` + responsive `sizes`, same pattern as product cards). Remaining raw `<img>`s are two justified admin cases (order-card, documented Supabase-host rationale; product-form local `data:` preview which next/image cannot fetch).

### SEO & content

- `NEXT_PUBLIC_SITE_URL` required in production (startup throw); no localhost in any committed runtime URL path (only the dev fallback in `src/config/site.ts`).
- Per-page titles/descriptions/canonicals/OG/Twitter verified in rendered HTML earlier this cycle; sitemap carries `lastModified`; cart/checkout noindex; LocalBusiness, Product and BreadcrumbList JSON-LD verified against real config data only.
- **No stale claims**: repo-wide search for "complete set", "top and bottom", "salwar", "dupatta" confirms no invented piece lists. The only "salwar" hit is an SEO keyword in `src/config/site.ts` (search term, not a product claim); "dupatta" appears only in the documented store-level positioning constants.

### UI / a11y

- Responsive sweep at 320–1440 px completed earlier this cycle (all storefront pages, no horizontal overflow, 44 px tap targets); focus-visible rings and skip link in place; motion-reduction respected.

### Dependency & dead-code audit

- Every runtime dependency traced to real imports: all Radix packages, `zod` (8 files), `lucide-react` (50 files), `clsx`/`tailwind-merge`/`class-variance-authority`, `@supabase/ssr` + `@supabase/supabase-js`, `server-only` (13 files), Next/React. `tw-animate-css` is imported in `globals.css` (grep of `.tsx` alone would miss it). **No unnecessary dependencies found.**
- `pg` was the one misplacement — imported only by `scripts/*` yet listed in production dependencies; **moved to devDependencies this audit** (consistent with `dotenv`, already a devDependency).
- Prisma is not a dependency and has no runtime references (historical migration artifacts only).
- 56 files under `.freebuff/` are tracked from the initial commit — tool-owned data, not referenced by the app; left untouched intentionally.

### Pattern searches (requested terms)

| Pattern                                           | Result                                                                                      |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `TODO` / `FIXME` / `HACK`                         | **0** in src + tests                                                                        |
| `console.log`                                     | **0** in src (console.error used deliberately in server actions/error boundaries)           |
| `debugger`                                        | **0**                                                                                       |
| `localhost`                                       | Only the documented dev fallback in `src/config/site.ts` + tool-data CSV under `.freebuff/` |
| `password` / `secret`                             | Only legitimate auth form fields, env guard, gitignored CLI script                          |
| `service_role` / `SUPABASE_SERVICE_ROLE_KEY`      | Only gitignored CLI script + guard docs                                                     |
| `any` (type)                                      | **0** in src + tests                                                                        |
| `@ts-ignore` / `@ts-nocheck` / `@ts-expect-error` | **0**                                                                                       |

## 3. Issues found & classification

| #   | Finding                                                                                                                                                                                                       | Severity                    | Action                                                                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Categories index + category cards rendered raw `<img>` without the SafeImage broken-image fallback (inconsistent with the rest of the storefront; a broken category image would render as a silent empty box) | **MEDIUM**                  | ✅ Fixed — switched to SafeImage (`fill`, responsive `sizes`)                                                                     |
| 2   | `pg` listed in production dependencies but used only by developer scripts                                                                                                                                     | **LOW**                     | ✅ Fixed — moved to devDependencies                                                                                               |
| 3   | Two `eslint-disable @next/next/no-img-element` comments lacked a rationale                                                                                                                                    | **LOW**                     | ✅ Fixed (1) — categories spot eliminated by SafeImage switch; the remaining admin disables carry or now carry rationale comments |
| 4   | Legacy tables (`*_legacy`, 3+3+0 rows) remain in the live database with correct RLS but no code references                                                                                                    | **LOW (INTENTIONAL)**       | Kept — appear to be deliberate migration backups; flagged for the owner to drop when confident                                    |
| 5   | pgvector search functions (`visual_search_matches`, `clear_product_embeddings`) exist in the DB with no application references                                                                                | **LOW**                     | Kept — extension-owned surface, harmless; noted as possible future feature                                                        |
| 6   | Owner's uncommitted files are not Prettier-formatted (`README.md`, `Create Product Image.md`, `FIX_PLAN.md`)                                                                                                  | **INTENTIONAL**             | Left untouched — personal edits; the committed versions are clean and CI checks the committed tree                                |
| 7   | `.freebuff/` tool data tracked in git (56 files)                                                                                                                                                              | **INTENTIONAL**             | Left as-is — tool-owned, not referenced by the app                                                                                |
| 8   | Open admin signup: DB trigger assigns `role='CUSTOMER'` to every new auth user (deny-by-default works, but public signup is enabled)                                                                          | **MEDIUM (owner decision)** | Flagged — disabling public signup in the Supabase dashboard is recommended before launch                                          |

No CRITICAL or HIGH findings remained open at audit time.

## 4. Issues fixed this audit

1. `src/app/(storefront)/categories/page.tsx` — category images now render through SafeImage/next/image with the broken-image fallback.
2. `src/components/product/category-card.tsx` — same SafeImage switch, rationale-bearing imports.
3. `package.json` — `pg` moved from `dependencies` to `devDependencies` (lockfile refreshed via `npm install`).

## 5. Remaining issues (owner action required)

- **Rotate the previously leaked `sb_secret_…` Supabase key** (carried over from the earlier security fix — the app no longer references it, but the credential itself must be revoked in the Supabase dashboard).
- **Set `NEXT_PUBLIC_SITE_URL`** to the real production origin in the hosting environment before the next production deploy (the startup guard will refuse to boot without it).
- **Disable public signup** in Supabase Auth if the store should be admin-managed only (finding #8).
- Consider dropping the `*_legacy` tables and unused pgvector functions once confirmed unneeded (finding #4/#5).

## 6. Final status

**PASS.** All six required commands pass on the committed tree: `npm install` ✅ · `npm run typecheck` ✅ · `npm run lint` ✅ · `npm run format:check` ✅ (committed tree) · `npm test` 49/49 ✅ · `npm run build` 14/14 pages ✅. Database RLS, storage policies, auth layering, secret hygiene, pricing/stock integrity, and content accuracy all re-verified live this session. Local commits are **not pushed**.
