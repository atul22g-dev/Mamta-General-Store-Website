-- Mamta General Store — migrate legacy data into the canonical schema
-- ============================================================
-- Runs AFTER 0001 creates the canonical tables. Re-creates the data from
-- the *_legacy tables (saved by 0000a) in the new shapes:
--   * legacy categories (text) become real rows in categories
--   * prices in rupees (numeric) become paise (integer): ×100
--   * product_images.image_url → product_images.url (position 0)
--   * the legacy profile is copied only if its auth user still exists
--     (the new profiles.id references auth.users) — otherwise skipped
--     and reported.
--
-- Idempotent: guarded by NOT EXISTS checks keyed on the legacy ids.
-- Legacy tables themselves are NEVER modified or dropped here.

-- ============ Categories from legacy text values ============
INSERT INTO "categories" ("id", "name", "slug", "description")
SELECT v.slug,
       v.name,
       v.slug,
       'Imported from the store''s earlier records.'
FROM (VALUES
  ('toys', 'Toys'),
  ('personal_care', 'Personal Care')
) AS v(slug, name)
WHERE NOT EXISTS (SELECT 1 FROM "categories" WHERE "slug" = v.slug);

-- ============ Products ============
INSERT INTO "products"
  ("id", "name", "slug", "description", "price", "discountPrice", "currency",
   "stock", "sku", "brand", "featured", "active", "categoryId")
SELECT
  l.id,                                   -- keep the same ids
  l.name,
  -- slug from the legacy name; suffix the id when it collides
  CASE
    WHEN EXISTS (SELECT 1 FROM "products" p WHERE p."slug" = lower(regexp_replace(l.name, '[^a-zA-Z0-9]+', '-', 'g')))
      THEN lower(regexp_replace(l.name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || left(l.id::text, 8)
    ELSE lower(regexp_replace(l.name, '[^a-zA-Z0-9]+', '-', 'g'))
  END,
  l.description,
  round(l.selling_price * 100)::int,      -- rupees → paise
  CASE WHEN l.mrp > l.selling_price THEN round(l.mrp * 100)::int ELSE NULL END,
  'INR',
  l.stock,
  NULL,                                   -- legacy had no SKU
  l.brand,
  false,
  l.is_active,
  c.id
FROM public.products_legacy l
JOIN "categories" c ON c."slug" = l.category::text  -- legacy column is an enum
WHERE NOT EXISTS (SELECT 1 FROM "products" p WHERE p."id" = l.id::text); -- canonical id is text

-- ============ Product images (position 0 = main) ============
INSERT INTO "product_images" ("id", "url", "alt", "position", "productId")
SELECT l.id,
       l.image_url,
       NULL,
       0,
       l.product_id
FROM public.product_images_legacy l
WHERE l.image_type = 'main'
  AND NOT EXISTS (SELECT 1 FROM "product_images" pi WHERE pi."id" = l.id::text); -- canonical id is text

-- ============ Profile (only if the auth user still exists) ============
INSERT INTO "profiles" ("id", "email", "name", "role", "active")
SELECT l.id, l.email, 'Store Owner', 'ADMIN', true
FROM public.profiles_legacy l
WHERE EXISTS (SELECT 1 FROM auth.users u WHERE u.id = l.id)
  AND NOT EXISTS (SELECT 1 FROM "profiles" p WHERE p."id" = l.id);

DO $$
DECLARE
  skipped_profile TEXT;
BEGIN
  SELECT l.email INTO skipped_profile
  FROM public.profiles_legacy l
  WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = l.id)
    AND NOT EXISTS (SELECT 1 FROM "profiles" p WHERE p."id" = l.id);

  IF skipped_profile IS NOT NULL THEN
    RAISE NOTICE 'Profile % skipped: no matching Supabase Auth user (recreate with create-admin.ts)', skipped_profile;
  END IF;
END
$$;
