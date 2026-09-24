-- Mamta General Store — product image storage
-- ============================================================
-- Creates the public `product-images` bucket for product photography.
-- Objects are named `products/<productId>/<timestamp>-<rand>.<ext>` so all
-- images for one product share a prefix and can be cleaned up per product.
--
-- Access model:
--   * READ  — public (storefront displays images via plain URLs).
--   * WRITE — service role only. No insert/update/delete policies are
--     granted to anon/authenticated, so uploads happen exclusively through
--     the server (which holds the service-role key). The service-role key
--     is never exposed to the browser.

-- ---------- Bucket (idempotent) ----------
INSERT INTO "storage"."buckets" ("id", "name", "public", "file_size_limit", "allowed_mime_types")
VALUES (
  'product-images',
  'product-images',
  true,
  5242880, -- 5 MB in bytes
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/avif'
  ]::text[]
)
ON CONFLICT ("id") DO UPDATE
SET "public" = EXCLUDED."public",
    "file_size_limit" = EXCLUDED."file_size_limit",
    "allowed_mime_types" = EXCLUDED."allowed_mime_types";

-- ---------- Read policy (public reads of product images) ----------
DROP POLICY IF EXISTS "product_images_public_read" ON "storage"."objects";
CREATE POLICY "product_images_public_read"
  ON "storage"."objects"
  FOR SELECT
  TO public
  USING ("bucket_id" = 'product-images');

-- ---------- Write policies (server/service role only) ----------
-- No INSERT/UPDATE/DELETE policies exist for anon or authenticated roles:
-- by default that denies everyone except privileged roles, so only the
-- application server (service key) can upload, replace or delete objects.
