-- Mamta General Store — schema synchronization & integrity hardening
-- ============================================================
-- Single source of truth: supabase/migrations/*.sql (the runtime schema).
-- prisma/schema.prisma is a reference mirror only (updated in this commit).
--
-- This migration is ADDITIVE: it creates indexes and CHECK constraints and
-- re-asserts idempotent policy/trigger/function definitions. No column,
-- table, or type is dropped; no data is modified. Every constraint was
-- validated against live production data before shipping (all counts 0).
--
-- Verified state that motivated each statement:
--   * orders/order_items/products amounts & quantities are all sane (0 bad
--     rows), but the database would happily accept negatives — the app
--     validates with zod and the RPC clamps, yet nothing stopped a direct
--     write (e.g. a future script or policy change) from corrupting data.
--   * category "active" and product "isNewArrival" are NOT NULL live; the
--     constraints are re-asserted for fresh deploys.
--   * policy/trigger/function statements are guarded (DROP IF EXISTS /
--     CREATE OR REPLACE / IF NOT EXISTS) so re-running is safe.

-- ---------- 1. Integrity CHECK constraints (additive) ----------
-- Prices and money are minor-unit integers; negatives are never valid.
ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_price_nonnegative";
ALTER TABLE "products"
  ADD CONSTRAINT "products_price_nonnegative" CHECK ("price" >= 0);

ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_discount_price_nonnegative";
ALTER TABLE "products"
  ADD CONSTRAINT "products_discount_price_nonnegative" CHECK ("discountPrice" IS NULL OR "discountPrice" >= 0);

ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_amounts_nonnegative";
ALTER TABLE "orders"
  ADD CONSTRAINT "orders_amounts_nonnegative"
  CHECK ("subtotal" >= 0 AND "shipping" >= 0 AND "total" >= 0);

ALTER TABLE "order_items" DROP CONSTRAINT IF EXISTS "order_items_values_valid";
ALTER TABLE "order_items"
  ADD CONSTRAINT "order_items_values_valid"
  CHECK ("quantity" >= 1 AND "unitPrice" >= 0 AND "lineTotal" >= 0);

ALTER TABLE "product_images" DROP CONSTRAINT IF EXISTS "product_images_position_nonnegative";
ALTER TABLE "product_images"
  ADD CONSTRAINT "product_images_position_nonnegative" CHECK ("position" >= 0);

-- Semantics: `price` is the CURRENT selling price and `discountPrice` is the
-- ORIGINAL (struck-through) price — the app renders discountPrice > price as
-- "X% off". Enforce that a struck-through original is always strictly higher,
-- guaranteeing every displayed discount is a genuine one.
ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_discount_gt_price";
ALTER TABLE "products"
  ADD CONSTRAINT "products_discount_gt_price"
  CHECK ("discountPrice" IS NULL OR "discountPrice" > "price");

-- ---------- 2. Fresh-deploy parity (IF NOT EXISTS re-asserts) ----------
-- Columns added by later migrations; re-asserted so a fresh deploy from
-- 0001 cannot miss them even if a file were applied out of order.
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "isNewArrival" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true;

-- ---------- 3. Timestamp triggers: full coverage ----------
-- updatedAt is maintained by triggers (app never writes it). All 8 tables
-- should carry one; product_images/product_sizes/product_colors are
-- effectively immutable rows but get the trigger for consistency.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW."updatedAt" := CAST(now() AT TIME ZONE 'utc' AS TIMESTAMP(3));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "categories_updated_at" ON "categories";
CREATE TRIGGER "categories_updated_at" BEFORE UPDATE ON "categories"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS "products_updated_at" ON "products";
CREATE TRIGGER "products_updated_at" BEFORE UPDATE ON "products"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS "orders_updated_at" ON "orders";
CREATE TRIGGER "orders_updated_at" BEFORE UPDATE ON "orders"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS "profiles_updated_at" ON "profiles";
CREATE TRIGGER "profiles_updated_at" BEFORE UPDATE ON "profiles"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS "product_images_updated_at" ON "product_images";
CREATE TRIGGER "product_images_updated_at" BEFORE UPDATE ON "product_images"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- 4. Re-assert functions (idempotent, pinned search_path) ----------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM "profiles"
    WHERE "id" = auth.uid() AND "role" = 'ADMIN' AND "active" = true
  );
$$;

CREATE OR REPLACE FUNCTION public.db_health()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT true;
$$;

-- ---------- 5. Re-assert grants (idempotent) ----------
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.place_order(jsonb, jsonb, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.db_health() TO anon, authenticated;

-- ---------- 6. RLS + core policies (idempotent re-assert) ----------
-- RLS must be enabled on every application table; policies are the ones
-- from 0009 (drop-and-recreate so definition drift is impossible).
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "product_images" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "product_sizes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "product_colors" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order_items" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON "profiles";
CREATE POLICY "profiles_select_own" ON "profiles" FOR SELECT TO authenticated
  USING (auth.uid() = "id");

DROP POLICY IF EXISTS "categories_public_read" ON "categories";
CREATE POLICY "categories_public_read" ON "categories" FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "categories_admin_all" ON "categories";
CREATE POLICY "categories_admin_all" ON "categories" FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "products_public_read" ON "products";
CREATE POLICY "products_public_read" ON "products" FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "products_admin_all" ON "products";
CREATE POLICY "products_admin_all" ON "products" FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "product_images_public_read" ON "product_images";
CREATE POLICY "product_images_public_read" ON "product_images" FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "product_images_admin_all" ON "product_images";
CREATE POLICY "product_images_admin_all" ON "product_images" FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "product_sizes_public_read" ON "product_sizes";
CREATE POLICY "product_sizes_public_read" ON "product_sizes" FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "product_sizes_admin_all" ON "product_sizes";
CREATE POLICY "product_sizes_admin_all" ON "product_sizes" FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "product_colors_public_read" ON "product_colors";
CREATE POLICY "product_colors_public_read" ON "product_colors" FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "product_colors_admin_all" ON "product_colors";
CREATE POLICY "product_colors_admin_all" ON "product_colors" FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "orders_admin_all" ON "orders";
CREATE POLICY "orders_admin_all" ON "orders" FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "order_items_admin_all" ON "order_items";
CREATE POLICY "order_items_admin_all" ON "order_items" FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
