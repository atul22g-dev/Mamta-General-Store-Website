-- Site settings — admin-editable storefront configuration
-- ============================================================
-- Key/value settings for storefront surfaces that are not catalog data.
-- One row per setting; the admin panel writes, the storefront reads (anon
-- SELECT), only admins write.
--
-- First consumer: `hero_image` — the homepage hero photo. Admins upload to
-- the new 'site-media' storage bucket (public read, admin write, images
-- only) and the setting stores the object's public URL. When the setting is
-- absent the hero falls back to its built-in placeholder — the storefront
-- never breaks because a setting is missing.

-- ------------------------------------------------------------
-- 1. site_settings table
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "site_settings" (
  "key" text PRIMARY KEY,
  "value" text NOT NULL,
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE "site_settings" ENABLE ROW LEVEL SECURITY;

-- Everyone (incl. anon) may read settings — they configure public surfaces.
DROP POLICY IF EXISTS "site_settings_public_read" ON "site_settings";
CREATE POLICY "site_settings_public_read" ON "site_settings"
  FOR SELECT TO public
  USING (true);

-- Only active admins may write.
DROP POLICY IF EXISTS "site_settings_admin_write" ON "site_settings";
CREATE POLICY "site_settings_admin_write" ON "site_settings"
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "site_settings_admin_update" ON "site_settings";
CREATE POLICY "site_settings_admin_update" ON "site_settings"
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "site_settings_admin_delete" ON "site_settings";
CREATE POLICY "site_settings_admin_delete" ON "site_settings"
  FOR DELETE TO authenticated
  USING (public.is_admin());

GRANT SELECT ON TABLE "site_settings" TO anon, authenticated;

-- ------------------------------------------------------------
-- 2. site-media storage bucket (public read, admin write, images only)
-- ------------------------------------------------------------
INSERT INTO "storage"."buckets" ("id", "name", "public", "file_size_limit", "allowed_mime_types")
VALUES (
  'site-media',
  'site-media',
  true,
  5 * 1024 * 1024, -- 5 MB, same as product images
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
ON CONFLICT ("id") DO UPDATE
  SET "public" = true,
      "file_size_limit" = 5 * 1024 * 1024,
      "allowed_mime_types" = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

DROP POLICY IF EXISTS "site_media_public_read" ON "storage"."objects";
CREATE POLICY "site_media_public_read" ON "storage"."objects"
  FOR SELECT TO public
  USING ("bucket_id" = 'site-media');

DROP POLICY IF EXISTS "site_media_admin_insert" ON "storage"."objects";
CREATE POLICY "site_media_admin_insert" ON "storage"."objects"
  FOR INSERT TO authenticated
  WITH CHECK ("bucket_id" = 'site-media' AND public.is_admin());

DROP POLICY IF EXISTS "site_media_admin_update" ON "storage"."objects";
CREATE POLICY "site_media_admin_update" ON "storage"."objects"
  FOR UPDATE TO authenticated
  USING ("bucket_id" = 'site-media' AND public.is_admin())
  WITH CHECK ("bucket_id" = 'site-media' AND public.is_admin());

DROP POLICY IF EXISTS "site_media_admin_delete" ON "storage"."objects";
CREATE POLICY "site_media_admin_delete" ON "storage"."objects"
  FOR DELETE TO authenticated
  USING ("bucket_id" = 'site-media' AND public.is_admin());
