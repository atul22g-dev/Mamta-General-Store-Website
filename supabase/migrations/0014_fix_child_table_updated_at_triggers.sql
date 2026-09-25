-- 0014: Fix updatedAt triggers on child tables that have no updatedAt column
--
-- Bug found by live testing: `updateImageAltAction` UPDATE on product_images
-- failed with `record "new" has no field "updatedAt"`. Migration 0012 added
-- BEFORE UPDATE triggers running set_updated_at() to ALL tables, but
-- product_images / product_sizes / product_colors were created in 0001
-- WITHOUT an updatedAt column (0001 itself only wired triggers on users,
-- categories, products, orders). Every UPDATE on those three tables —
-- alt-text edits, gallery reordering, cover changes — has been failing
-- since 0012 with `record "new" has no field "updatedAt"`.
--
-- Fix: drop the three triggers. There is no updatedAt column to maintain;
-- product_images rows change via explicit admin actions (alt text, position)
-- that are fully visible in the rows themselves. If a future migration adds
-- an updatedAt column to any of these tables, it must re-create its trigger
-- at the same time.

DROP TRIGGER IF EXISTS "product_images_updated_at" ON "product_images";
DROP TRIGGER IF EXISTS "product_sizes_updated_at" ON "product_sizes";
DROP TRIGGER IF EXISTS "product_colors_updated_at" ON "product_colors";

-- Sanity check (run manually if desired):
--   UPDATE "product_images" SET "alt" = "alt" WHERE false;  -- must not error
