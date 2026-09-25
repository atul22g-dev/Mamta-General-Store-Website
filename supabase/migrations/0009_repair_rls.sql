-- Mamta General Store — repair drifted RLS (service-key-free operation)
-- ============================================================
-- Rebuilds the app's RLS policy set after drift (a broken is_admin()
-- returning an enum instead of boolean made every admin query fail).
--
-- Every optional operation is exception-safe so one mismatch can never
-- roll back the whole script. Safe to run repeatedly.

-- ---------- 1. Drop all business-data policies (public schema) ----------
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname, tablename FROM pg_policies
           WHERE schemaname = 'public' AND tablename IN
           ('categories','products','product_images','product_sizes',
            'product_colors','orders','order_items','profiles')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- ---------- 2. Drop product-image policies on storage.objects ----------
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'storage' AND tablename = 'objects'
             AND (policyname LIKE 'product_images%'
                  OR qual::text LIKE '%product-images%'
                  OR with_check::text LIKE '%product-images%'
                  OR qual::text LIKE '%is_admin%'
                  OR with_check::text LIKE '%is_admin%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
  END LOOP;
END $$;

-- ---------- 3. Rebuild the admin check helper (any signature) ----------
DO $$
DECLARE r record;
BEGIN
  -- Drop every overload of is_admin, whatever its signature/return type.
  FOR r IN
    SELECT p.oid::regprocedure::text AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'is_admin'
  LOOP
    EXECUTE format('DROP FUNCTION %s', r.sig);
  END LOOP;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM "profiles"
    WHERE "id" = auth.uid()
      AND "role" = 'ADMIN'
      AND "active" = true
  );
$$;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ---------- 4. RLS enabled on every application table ----------
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "product_images" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "product_sizes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "product_colors" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;

-- ---------- 5. Category visibility column (idempotent) ----------
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true;

-- ---------- 6. Storefront: public catalog reads ----------
CREATE POLICY "categories_public_read" ON "categories" FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "products_public_read" ON "products" FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "product_images_public_read" ON "product_images" FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "product_sizes_public_read" ON "product_sizes" FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "product_colors_public_read" ON "product_colors" FOR SELECT TO anon, authenticated USING (true);

-- ---------- 7. Admin: full management of business data ----------
CREATE POLICY "categories_admin_all" ON "categories" FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "products_admin_all" ON "products" FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "product_images_admin_all" ON "product_images" FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "product_sizes_admin_all" ON "product_sizes" FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "product_colors_admin_all" ON "product_colors" FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "orders_admin_all" ON "orders" FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "order_items_admin_all" ON "order_items" FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---------- 8. Profiles: read own row (login/session resolution) ----------
CREATE POLICY "profiles_select_own" ON "profiles" FOR SELECT TO authenticated
  USING (auth.uid() = "id");

-- ---------- 9. Storage: public reads, admin-managed writes ----------
CREATE POLICY "product_images_public_read" ON "storage"."objects" FOR SELECT TO public
  USING ("bucket_id" = 'product-images');
CREATE POLICY "product_images_admin_insert" ON "storage"."objects" FOR INSERT TO authenticated
  WITH CHECK ("bucket_id" = 'product-images' AND public.is_admin());
CREATE POLICY "product_images_admin_delete" ON "storage"."objects" FOR DELETE TO authenticated
  USING ("bucket_id" = 'product-images' AND public.is_admin());

-- ---------- 10. RPC grants (exception-safe: signature drift tolerated) ----------
DO $$
BEGIN
  REVOKE ALL ON FUNCTION public.place_order(jsonb, jsonb, text) FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION public.place_order(jsonb, jsonb, text) TO anon, authenticated;
EXCEPTION WHEN OTHERS THEN NULL; -- drifted signature: grants stay as-is
END $$;

DO $$
BEGIN
  REVOKE ALL ON FUNCTION public.db_health() FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION public.db_health() TO anon, authenticated;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
