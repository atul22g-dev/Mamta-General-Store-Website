-- Mamta General Store — RLS policies (service-role-key-free operation)
-- ============================================================
-- The Next.js app no longer holds a service-role key. Every database
-- operation now runs under one of two scoped identities:
--
--   * anon / authenticated with the publishable key — storefront reads
--     (catalog, images, order placement via RPC) and, when signed in,
--     admin operations authorized by `is_admin()`.
--   * No third "app server" identity exists: there is nothing to leak.
--
-- Authorization model (unchanged): an Auth user is an admin iff their
-- profiles row has role 'ADMIN' and active = true. The check is evaluated
-- by Row Level Security itself — a client can never assert admin.
--
-- `is_admin()` is SECURITY DEFINER so it can read `profiles` without
-- recursing into that table's own RLS. It is cheap (indexed PK lookup)
-- and evaluated once per statement by Postgres.

-- ---------- Admin check helper ----------
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

-- ---------- Storefront: public catalog reads ----------
-- Anyone (anon or signed-in) may read the catalog; writes stay admin-only.
DROP POLICY IF EXISTS "categories_public_read" ON "categories";
CREATE POLICY "categories_public_read"
  ON "categories" FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "products_public_read" ON "products";
CREATE POLICY "products_public_read"
  ON "products" FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "product_images_public_read" ON "product_images";
CREATE POLICY "product_images_public_read"
  ON "product_images" FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "product_sizes_public_read" ON "product_sizes";
CREATE POLICY "product_sizes_public_read"
  ON "product_sizes" FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "product_colors_public_read" ON "product_colors";
CREATE POLICY "product_colors_public_read"
  ON "product_colors" FOR SELECT
  TO anon, authenticated
  USING (true);

-- ---------- Admin: full management of business data ----------
-- Signed-in admins get unrestricted CRUD (the app's server actions already
-- require a verified admin session before reaching the database; these
-- policies are the database-side backstop).
DROP POLICY IF EXISTS "categories_admin_all" ON "categories";
CREATE POLICY "categories_admin_all"
  ON "categories" FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "products_admin_all" ON "products";
CREATE POLICY "products_admin_all"
  ON "products" FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "product_images_admin_all" ON "product_images";
CREATE POLICY "product_images_admin_all"
  ON "product_images" FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "product_sizes_admin_all" ON "product_sizes";
CREATE POLICY "product_sizes_admin_all"
  ON "product_sizes" FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "product_colors_admin_all" ON "product_colors";
CREATE POLICY "product_colors_admin_all"
  ON "product_colors" FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "orders_admin_all" ON "orders";
CREATE POLICY "orders_admin_all"
  ON "orders" FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "order_items_admin_all" ON "order_items";
CREATE POLICY "order_items_admin_all"
  ON "order_items" FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---------- Profiles ----------
-- profiles_select_own (migration 0003) already lets the login flow and
-- session resolution read the caller's own profile with the user's own
-- JWT. Admin provisioning stays a dashboard/SQL operation — no policy
-- grants client-side writes on profiles.

-- ---------- Checkout RPC ----------
-- place_order is SECURITY DEFINER and writes only orders/order_items and
-- decrements stock; guests (anon) check out without an account.
REVOKE ALL ON FUNCTION public.place_order(jsonb, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_order(jsonb, jsonb, text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.db_health() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.db_health() TO anon, authenticated;

-- ---------- Category visibility (active/inactive) ----------
-- Inactive categories disappear from every storefront surface (navigation,
-- category index, home tiles, shop filters, sitemap) and their pages 404;
-- products under them are hidden as well. Admin sees and toggles them.
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true;

-- ---------- Storage: admin-managed product images ----------
-- Reads stay public (storefront); uploads/replaces/deletes now run under
-- the signed-in admin's JWT enforced by these policies — previously this
-- required the service-role key.
DROP POLICY IF EXISTS "product_images_admin_insert" ON "storage"."objects";
CREATE POLICY "product_images_admin_insert"
  ON "storage"."objects" FOR INSERT
  TO authenticated
  WITH CHECK ("bucket_id" = 'product-images' AND public.is_admin());

DROP POLICY IF EXISTS "product_images_admin_delete" ON "storage"."objects";
CREATE POLICY "product_images_admin_delete"
  ON "storage"."objects" FOR DELETE
  TO authenticated
  USING ("bucket_id" = 'product-images' AND public.is_admin());
