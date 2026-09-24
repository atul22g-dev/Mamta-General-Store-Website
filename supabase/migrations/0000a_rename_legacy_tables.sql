-- Mamta General Store — preserve pre-existing hand-made tables
-- ============================================================
-- The live database already contained hand-made tables (products,
-- product_images, profiles) with shapes that differ from the canonical
-- schema. They hold real data (3 products, 3 images, 1 profile), so
-- nothing is deleted: each table is RENAMED to *_legacy before the
-- canonical migrations create the real ones.
--
-- Idempotent: renames only happen when the legacy name is free and the
-- original still exists. Re-running is a no-op.

DO $$
BEGIN
  -- products → products_legacy
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'products')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'products_legacy') THEN
    ALTER TABLE public.products RENAME TO products_legacy;
  END IF;

  -- product_images → product_images_legacy
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'product_images')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'product_images_legacy') THEN
    ALTER TABLE public.product_images RENAME TO product_images_legacy;
  END IF;

  -- profiles → profiles_legacy
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'profiles')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'profiles_legacy') THEN
    ALTER TABLE public.profiles RENAME TO profiles_legacy;
  END IF;
END
$$;
