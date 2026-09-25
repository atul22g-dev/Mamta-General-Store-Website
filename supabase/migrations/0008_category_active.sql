-- Mamta General Store — category visibility (active/inactive)
-- ============================================================
-- Adds the `active` flag to categories. Inactive categories disappear from
-- every storefront surface (navigation, category index, home tiles, shop
-- filters, sitemap), their category pages 404, and their products are hidden;
-- the admin panel keeps listing them with a Show/Hide toggle.
--
-- This statement is also included in 0007_rls_policies.sql for fresh
-- projects; it is repeated here (idempotently) for projects that applied
-- 0007 before this column section was added to it.

ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true;
