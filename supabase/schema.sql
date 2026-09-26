-- ============================================================================
--  MAMTA GENERAL STORE — COMPLETE DATABASE SCHEMA (single-file build)
-- ============================================================================
--  Consolidates supabase/migrations/0000a…0016 into their FINAL state.
--  Running this file on an empty database produces the complete, production
--  schema — no other migration needs to be applied afterwards.
--
--  Run:   psql "$DATABASE_URL" -f supabase/schema.sql
--         (on Supabase: SQL Editor → paste → Run, or `npm run db:deploy`
--          for the incremental path via supabase/migrations/)
--
--  REQUIREMENTS
--  ----------
--  This file targets a SUPABASE Postgres database. It depends on:
--    * the `auth`    schema + roles anon/authenticated (Supabase),
--    * the `storage` schema + storage.objects table (Supabase),
--    * gen_random_uuid() for order ids (built into Postgres 13+; pgcrypto is
--      enabled below for older instances).
--  On plain Postgres, create equivalent roles/schemas or drop the
--  Supabase-specific statements (marked "Supabase-specific" below).
--
--  FRESH vs EXISTING DATABASE
--  ----------
--  * Fresh/empty database: run top to bottom — every statement is guarded and
--    the script is idempotent (re-running is safe).
--  * Existing database already carrying this app's schema: re-running is a
--    safe repair pass (drops/recreates nothing canonical, never deletes data;
--    the seed uses ON CONFLICT DO NOTHING).
--  * Rehearsal on a live database (recommended before first use): wrap in a
--    test transaction —  BEGIN; \i supabase/schema.sql; ROLLBACK;
--
--  CONTENTS
--  ----------
--    0.  Cleanup of retired objects (legacy tables, users, UserRole)
--    1.  Extensions & enum types
--    2.  Tables, columns, keys, FKs, CHECK constraints (final state)
--    3.  Indexes
--    4.  updated_at triggers
--    5.  Functions (place_order [0015], db_health, is_admin) + grants
--    6.  Row Level Security: enable, policies, write denies, profiles guard,
--        API table grants
--    7.  Storage bucket `product-images` + object policies
--    8.  schema_migrations tracking table (used by scripts/db-deploy.ts)
--    9.  Seed data (one starter category)
--    10. End-of-script verification of the final schema (aborts on drift)
--
--  FINAL-STATE NOTES (which migration won, per object)
--  ----------
--    * products."discountPrice" is the ORIGINAL (struck-through) price and
--      may EQUAL price; only LOWER is rejected  (0012 + 0016).
--    * Shipping is a flat ₹100 = 10000 paise on every order          (0010).
--    * orders."userId" is uuid → profiles (Supabase Auth ids); the old
--      users table and UserRole enum are retired                      (0011).
--    * place_order uses SELECT … FOR UPDATE locking, quantity 1..99,
--      duplicate-line rejection and CART_INVALID / OUT_OF_STOCK /
--      PRODUCT_GONE / ORDER_NUMBER_TAKEN error prefixes               (0015).
--    * product_images / product_sizes / product_colors have NO updatedAt
--      column and NO updated_at trigger (editing them errored before) (0014).
--    * Storage writes are admin-only, per-command (incl. UPDATE)      (0013).
--    * RLS is enabled on every application table; policies are deny-by-
--      default: public catalog reads, admin CRUD via is_admin(), orders
--      written only through place_order, profiles readable by owner   (0007/0009/0012/0013).
--    * The legacy-data migration (0005) is intentionally NOT reproduced: it
--      moved the original hand-made rows into the canonical schema once. A
--      fresh install seeds its own catalog (Section 9) instead.
-- ============================================================================


-- ############################################################################
--  SECTION 0 — CLEANUP OF RETIRED OBJECTS (recreate-from-clean-state)
-- ############################################################################
--  Removes objects that later migrations retired, so the script can bring any
--  database (even one carrying the old Prisma-era model) to the final state.
--  Every statement is guarded: nothing here can fail if objects are absent,
--  and every DROP is safe to run BEFORE the canonical tables exist.
--  Canonical data (categories/products/orders/profiles/…) is NEVER deleted.

-- The retired users table is referenced by the pre-0011 orders FK; drop that
-- FK first (guarded — a fresh database has no orders table yet).
DO $cleanup$
BEGIN
  IF to_regclass('public.orders') IS NOT NULL THEN
    ALTER TABLE "public"."orders" DROP CONSTRAINT IF EXISTS "orders_userId_users_id_fk";
    ALTER TABLE "public"."orders" DROP CONSTRAINT IF EXISTS "orders_userId_fkey";
  END IF;
END
$cleanup$;

-- Legacy Prisma-era `users` table: duplicate auth model, retired by 0011.
DROP TABLE IF EXISTS "public"."users";

-- Legacy enum from the retired users table (0011).
DROP TYPE IF EXISTS "public"."UserRole";

-- Pre-Supabase hand-made tables preserved by migrations 0000a/0000b and
-- copied into the canonical schema by 0005. They hold no app traffic
-- (0013 already revoked client grants on them) and a fresh canonical install
-- does not need them — dropped so the database starts from a clean state.
-- (To keep the archives, comment these three lines out.)
-- Child tables first (in case the hand-made schema linked them by FK).
DROP TABLE IF EXISTS "public"."product_images_legacy";
DROP TABLE IF EXISTS "public"."profiles_legacy";
DROP TABLE IF EXISTS "public"."products_legacy";

-- is_admin(): drop ALL overloads with any signature/return type (the 0009/0013
-- repair path), so Section 5 recreates exactly one canonical boolean form.
DO $cleanup$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'is_admin'
  LOOP
    EXECUTE format('DROP FUNCTION %s', r.sig);
  END LOOP;
EXCEPTION WHEN OTHERS THEN NULL; -- nothing to drop on a fresh database
END
$cleanup$;


-- ############################################################################
--  SECTION 1 — EXTENSIONS & ENUM TYPES
-- ############################################################################

-- gen_random_uuid(): built into Postgres 13+; pgcrypto provides it on older
-- instances (Supabase has it available — IF NOT EXISTS keeps this idempotent).
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS "public";

-- Order lifecycle (admin status pipeline). 'PENDING' is the place_order default.
DO $$
BEGIN
  CREATE TYPE "public"."OrderStatus" AS ENUM
    ('PENDING', 'CONFIRMED', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; -- already exists
END $$;

-- Payment lifecycle (cash-on-delivery starts at 'PENDING').
DO $$
BEGIN
  CREATE TYPE "public"."PaymentStatus" AS ENUM
    ('PENDING', 'PAID', 'FAILED', 'REFUNDED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- NOTE: there is deliberately NO "UserRole" enum. profiles."role" is TEXT
-- constrained by CHECK + the guard trigger in Section 6 (0011/0013).


-- ############################################################################
--  SECTION 2 — TABLES (columns, PKs, FKs, defaults — final state)
-- ############################################################################
--  Conventions carried over from the original Prisma datamodel:
--    * quoted camelCase column names ("categoryId", "createdAt", …) — the
--      application queries these exact identifiers;
--    * TIMESTAMP(3) (millisecond precision);
--    * text primary keys for catalog/order rows (client-generated ids — no
--      DB default on "id"), uuid PK for profiles (Supabase Auth ids);
--    * money in minor units (paise) as INTEGER — never floats.
--  CHECK constraints are added in 2.10 (drop-then-add) so this script can
--  also repair an older database onto the final constraint definitions.

-- ----------------------------------------------------------------------------
-- 2.1 categories — storefront product categories (data, not code)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id"          TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "slug"        TEXT NOT NULL,
    "description" TEXT,
    "imageUrl"    TEXT,
    -- Inactive categories disappear from every storefront surface and their
    -- pages 404; the admin panel keeps a Show/Hide toggle (0007/0008).
    "active"      BOOLEAN NOT NULL DEFAULT true,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- ----------------------------------------------------------------------------
-- 2.2 products — a sellable item
-- ----------------------------------------------------------------------------
-- Money: "price" = current selling price, "discountPrice" = ORIGINAL
-- struck-through price (nullable). Both in paise. "stock": NULL = not tracked
-- (made-to-order), 0 = out of stock, N = N available (0012 + stock modes).
CREATE TABLE IF NOT EXISTS "public"."products" (
    "id"            TEXT NOT NULL,
    "name"          TEXT NOT NULL,
    "slug"          TEXT NOT NULL,
    "description"   TEXT,
    "price"         INTEGER NOT NULL,
    "discountPrice" INTEGER,
    "currency"      TEXT NOT NULL DEFAULT 'INR',
    "stock"         INTEGER,
    "sku"           TEXT,
    "brand"         TEXT,
    "featured"      BOOLEAN NOT NULL DEFAULT false,
    "active"        BOOLEAN NOT NULL DEFAULT false,
    "isNewArrival"  BOOLEAN NOT NULL DEFAULT false, -- 0006
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "categoryId"    TEXT NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id"),

    -- Deleting a category is restricted while products still reference it.
    CONSTRAINT "products_categoryId_fkey"
      FOREIGN KEY ("categoryId") REFERENCES "public"."categories"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE
);

-- ----------------------------------------------------------------------------
-- 2.3 profiles — Supabase Auth users → application authorization
-- ----------------------------------------------------------------------------
-- Authorization model: an authenticated Supabase Auth user is an admin iff
-- their profiles row has role 'ADMIN' AND active = true (checked server-side
-- by is_admin(), Section 5). Rows are provisioned via SQL/dashboard only
-- (scripts/create-admin.ts); no client role can ever write this table
-- (Section 6). "id" matches auth.users.id exactly — Supabase-specific.
CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id"        UUID NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "email"     TEXT NOT NULL,
    "name"      TEXT NOT NULL DEFAULT '',
    "role"      TEXT NOT NULL DEFAULT 'CUSTOMER',
    "active"    BOOLEAN NOT NULL DEFAULT true, -- disabled admins cannot sign in
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "profiles_role_valid" CHECK ("role" IN ('CUSTOMER', 'ADMIN'))
);

-- ----------------------------------------------------------------------------
-- 2.4 product_images — product photo gallery (position orders the gallery)
-- ----------------------------------------------------------------------------
-- NOTE: no "updatedAt" column by design (0014).
CREATE TABLE IF NOT EXISTS "public"."product_images" (
    "id"        TEXT NOT NULL,
    "url"       TEXT NOT NULL,
    "alt"       TEXT,
    "position"  INTEGER NOT NULL DEFAULT 0,
    "productId" TEXT NOT NULL,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id"),

    -- Images cascade with their product (0001).
    CONSTRAINT "product_images_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "public"."products"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

-- ----------------------------------------------------------------------------
-- 2.5 product_sizes — size options, e.g. S / M / L / XL / Free Size
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."product_sizes" (
    "id"        TEXT NOT NULL,
    "label"     TEXT NOT NULL,
    "productId" TEXT NOT NULL,

    CONSTRAINT "product_sizes_pkey" PRIMARY KEY ("id"),

    CONSTRAINT "product_sizes_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "public"."products"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

-- ----------------------------------------------------------------------------
-- 2.6 product_colors — color options with an optional swatch hex
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."product_colors" (
    "id"        TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "hex"       TEXT,
    "productId" TEXT NOT NULL,

    CONSTRAINT "product_colors_pkey" PRIMARY KEY ("id"),

    CONSTRAINT "product_colors_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "public"."products"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

-- ----------------------------------------------------------------------------
-- 2.7 orders — customer orders (immutable contact/address/amount snapshots)
-- ----------------------------------------------------------------------------
-- "userId" is uuid → profiles (Supabase Auth ids) since 0011; NULL for guest
-- orders, the only mode the storefront currently uses. "orderNumber" is the
-- human-friendly reference (e.g. MGS-2026-000123), unique for collision
-- retry. Orders are created ONLY via the place_order RPC (Section 5); RLS
-- denies direct client writes (Section 6).
CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id"             TEXT NOT NULL,
    "orderNumber"    TEXT NOT NULL,
    "status"         "public"."OrderStatus" NOT NULL DEFAULT 'PENDING',
    "paymentStatus"  "public"."PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "userId"         UUID, -- → profiles; NULL = guest checkout
    "customerName"   TEXT NOT NULL,
    "customerEmail"  TEXT,
    "customerPhone"  TEXT,
    -- Shipping address snapshot at purchase time.
    "shippingLine1"      TEXT NOT NULL,
    "shippingLine2"      TEXT,
    "shippingCity"       TEXT NOT NULL,
    "shippingState"      TEXT NOT NULL,
    "shippingPostalCode" TEXT NOT NULL,
    "shippingCountry"    TEXT NOT NULL DEFAULT 'India',
    -- All amounts in minor units (paise).
    "subtotal"       INTEGER NOT NULL,
    "shipping"       INTEGER NOT NULL DEFAULT 0,
    "total"          INTEGER NOT NULL,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id"),

    -- Final auth source: profiles (0011). For databases predating 0011 the
    -- repair path in 2.11 converts the column and re-points the FK.
    CONSTRAINT "orders_userId_profiles_id_fk"
      FOREIGN KEY ("userId") REFERENCES "public"."profiles"("id")
      ON DELETE SET NULL
);

-- ----------------------------------------------------------------------------
-- 2.8 order_items — line items (snapshot name/slug/sku + prices at purchase)
-- ----------------------------------------------------------------------------
-- "productId" is nullable: it becomes NULL if the product is ever deleted,
-- keeping order history intact.
CREATE TABLE IF NOT EXISTS "public"."order_items" (
    "id"          TEXT NOT NULL,
    "quantity"    INTEGER NOT NULL,
    "unitPrice"   INTEGER NOT NULL,
    "lineTotal"   INTEGER NOT NULL, -- quantity × unitPrice (denormalized)
    "orderId"     TEXT NOT NULL,
    "productId"   TEXT,
    "productName" TEXT NOT NULL,
    "productSlug" TEXT NOT NULL,
    "sku"         TEXT,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id"),

    CONSTRAINT "order_items_orderId_fkey"
      FOREIGN KEY ("orderId") REFERENCES "public"."orders"("id")
      ON DELETE CASCADE ON UPDATE CASCADE,

    CONSTRAINT "order_items_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "public"."products"("id")
      ON DELETE SET NULL ON UPDATE CASCADE
);

-- ----------------------------------------------------------------------------
-- 2.9 Fresh-deploy parity re-asserts (harmless if the columns already exist)
-- ----------------------------------------------------------------------------
ALTER TABLE "public"."products"   ADD COLUMN IF NOT EXISTS "isNewArrival" BOOLEAN NOT NULL DEFAULT false; -- 0006
ALTER TABLE "public"."categories" ADD COLUMN IF NOT EXISTS "active"       BOOLEAN NOT NULL DEFAULT true;  -- 0007/0008

-- ----------------------------------------------------------------------------
-- 2.10 Integrity CHECK constraints (final state of 0012 + 0016)
-- ----------------------------------------------------------------------------
-- Drop-then-add so an older database is repaired onto the final definitions
-- (re-adding revalidates existing rows — production data satisfies all of
-- them). On a fresh database the DROPs are no-ops.

-- Prices and money are minor-unit integers; negatives are never valid.
ALTER TABLE "public"."products" DROP CONSTRAINT IF EXISTS "products_price_nonnegative";
ALTER TABLE "public"."products"
  ADD CONSTRAINT "products_price_nonnegative" CHECK ("price" >= 0);

ALTER TABLE "public"."products" DROP CONSTRAINT IF EXISTS "products_discount_price_nonnegative";
ALTER TABLE "public"."products"
  ADD CONSTRAINT "products_discount_price_nonnegative"
  CHECK ("discountPrice" IS NULL OR "discountPrice" >= 0);

ALTER TABLE "public"."orders" DROP CONSTRAINT IF EXISTS "orders_amounts_nonnegative";
ALTER TABLE "public"."orders"
  ADD CONSTRAINT "orders_amounts_nonnegative"
  CHECK ("subtotal" >= 0 AND "shipping" >= 0 AND "total" >= 0);

ALTER TABLE "public"."order_items" DROP CONSTRAINT IF EXISTS "order_items_values_valid";
ALTER TABLE "public"."order_items"
  ADD CONSTRAINT "order_items_values_valid"
  CHECK ("quantity" >= 1 AND "unitPrice" >= 0 AND "lineTotal" >= 0);

ALTER TABLE "public"."product_images" DROP CONSTRAINT IF EXISTS "product_images_position_nonnegative";
ALTER TABLE "public"."product_images"
  ADD CONSTRAINT "product_images_position_nonnegative" CHECK ("position" >= 0);

-- "price" is the CURRENT selling price and "discountPrice" the ORIGINAL
-- (struck-through) price — rendered as "X% off". An original price may EQUAL
-- the selling price (an MRP equal to the selling price is simply no discount
-- running — 0016 relaxed 0012's strict ">"); it must never be LOWER, which
-- would make a struck-through "discount" raise the price.
ALTER TABLE "public"."products" DROP CONSTRAINT IF EXISTS "products_discount_gt_price";
ALTER TABLE "public"."products"
  ADD CONSTRAINT "products_discount_gt_price"
  CHECK ("discountPrice" IS NULL OR "discountPrice" >= "price");

-- ----------------------------------------------------------------------------
-- 2.11 orders."userId" → profiles (repair path for databases predating 0011)
-- ----------------------------------------------------------------------------
-- On a fresh or already-migrated database the FK exists (created in 2.7) and
-- this block is skipped. On a pre-0011 database it drops the old FK names,
-- converts TEXT → uuid (only sound while every value is NULL — guest
-- checkout; the guard refuses otherwise) and re-points the FK at profiles.
DO $orders_user$
BEGIN
  IF to_regclass('public.orders') IS NOT NULL
     AND to_regclass('public.profiles') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'orders_userId_profiles_id_fk'
         AND conrelid = 'public.orders'::regclass
     )
  THEN
    ALTER TABLE "public"."orders" DROP CONSTRAINT IF EXISTS "orders_userId_users_id_fk";
    ALTER TABLE "public"."orders" DROP CONSTRAINT IF EXISTS "orders_userId_fkey";

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'orders'
        AND column_name = 'userId' AND data_type <> 'uuid'
    ) THEN
      IF EXISTS (SELECT 1 FROM "public"."orders" WHERE "userId" IS NOT NULL) THEN
        RAISE EXCEPTION 'orders.userId holds values; map them to profiles before re-pointing';
      END IF;
      ALTER TABLE "public"."orders" ALTER COLUMN "userId" TYPE uuid USING NULL::uuid;
    END IF;

    ALTER TABLE "public"."orders"
      ADD CONSTRAINT "orders_userId_profiles_id_fk"
      FOREIGN KEY ("userId") REFERENCES "public"."profiles"("id")
      ON DELETE SET NULL;
  END IF;
END
$orders_user$;


-- ############################################################################
--  SECTION 3 — INDEXES
-- ############################################################################
--  *_key unique indexes back the unique identifiers (slug/sku/orderNumber);
--  the composite indexes cover the hot storefront and admin query paths
--  (category browsing, listing sorts, gallery lookup, order history, admin
--  status filters, New Arrivals row).

-- identifiers / uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS "categories_slug_key"    ON "public"."categories"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "products_slug_key"      ON "public"."products"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "products_sku_key"       ON "public"."products"("sku");
CREATE UNIQUE INDEX IF NOT EXISTS "orders_orderNumber_key" ON "public"."orders"("orderNumber");

-- catalog queries
CREATE INDEX IF NOT EXISTS "products_categoryId_active_idx"  ON "public"."products"("categoryId", "active");
CREATE INDEX IF NOT EXISTS "products_active_createdAt_idx"   ON "public"."products"("active", "createdAt");
CREATE INDEX IF NOT EXISTS "products_active_price_idx"       ON "public"."products"("active", "price");
CREATE INDEX IF NOT EXISTS "products_featured_active_idx"    ON "public"."products"("featured", "active");
CREATE INDEX IF NOT EXISTS "products_new_arrival_active_idx" ON "public"."products"("isNewArrival", "active", "createdAt"); -- 0006

-- product children (gallery / variant lookups)
CREATE INDEX IF NOT EXISTS "product_images_productId_idx" ON "public"."product_images"("productId");
CREATE INDEX IF NOT EXISTS "product_sizes_productId_idx"  ON "public"."product_sizes"("productId");
CREATE INDEX IF NOT EXISTS "product_colors_productId_idx" ON "public"."product_colors"("productId");

-- orders / order_items
CREATE INDEX IF NOT EXISTS "orders_userId_createdAt_idx" ON "public"."orders"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "orders_status_createdAt_idx" ON "public"."orders"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "order_items_orderId_idx"     ON "public"."order_items"("orderId");
CREATE INDEX IF NOT EXISTS "order_items_productId_idx"   ON "public"."order_items"("productId");


-- ############################################################################
--  SECTION 4 — updated_at TRIGGERS
-- ############################################################################
--  Keeps "updatedAt" correct for writes that bypass the application (dashboard
--  edits, seed scripts). Written in UTC to match how the app reads timestamps.
--  Wired on the four tables that HAVE an updatedAt column. The product child
--  tables (product_images / product_sizes / product_colors) deliberately get
--  NO trigger — they have no updatedAt column (0014).
CREATE OR REPLACE FUNCTION "public"."set_updated_at"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW."updatedAt" := CAST(now() AT TIME ZONE 'utc' AS TIMESTAMP(3));
  RETURN NEW;
END;
$$;

-- 0014: ensure no stale trigger exists on the child tables (they have no
-- updatedAt column; a BEFORE UPDATE trigger here would break every UPDATE).
DROP TRIGGER IF EXISTS "product_images_updated_at" ON "public"."product_images";
DROP TRIGGER IF EXISTS "product_sizes_updated_at"  ON "public"."product_sizes";
DROP TRIGGER IF EXISTS "product_colors_updated_at" ON "public"."product_colors";

DROP TRIGGER IF EXISTS "categories_updated_at" ON "public"."categories";
CREATE TRIGGER "categories_updated_at"
  BEFORE UPDATE ON "public"."categories"
  FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

DROP TRIGGER IF EXISTS "products_updated_at" ON "public"."products";
CREATE TRIGGER "products_updated_at"
  BEFORE UPDATE ON "public"."products"
  FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

DROP TRIGGER IF EXISTS "orders_updated_at" ON "public"."orders";
CREATE TRIGGER "orders_updated_at"
  BEFORE UPDATE ON "public"."orders"
  FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

DROP TRIGGER IF EXISTS "profiles_updated_at" ON "public"."profiles";
CREATE TRIGGER "profiles_updated_at"
  BEFORE UPDATE ON "public"."profiles"
  FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


-- ############################################################################
--  SECTION 5 — FUNCTIONS (final state) + EXECUTE grants
-- ############################################################################

-- ----------------------------------------------------------------------------
-- 5.1 place_order(p_items, p_customer, p_order_number) → order number
-- ----------------------------------------------------------------------------
--  Atomic guest checkout. SECURITY DEFINER so cash-on-delivery needs no
--  client auth; it only writes orders/order_items and decrements stock.
--  Final version = migration 0015:
--    * server-side price re-read — never the client's price;
--    * SELECT … FOR UPDATE on each product row → concurrent checkouts
--      serialize per product (no oversell); the whole call is one transaction;
--    * quantity validated as integer 1..99 (mirrors MAX_CART_QUANTITY);
--    * duplicate product lines rejected (they would double-decrement stock);
--    * variant (size/color) membership validated → PRODUCT_GONE;
--    * tracked stock must be ≥ 1 → OUT_OF_STOCK, clamped to available;
--    * flat ₹100 shipping = 10000 paise (0010; mirrors FLAT_SHIPPING_PAISE
--      in src/lib/constants.ts — keep the two in sync);
--    * order-number collision → ORDER_NUMBER_TAKEN (caller retries).
CREATE OR REPLACE FUNCTION "public"."place_order"(
  p_items jsonb,
  -- [{"productId": string, "quantity": int, "sizeId": string|null, "colorId": string|null}]
  p_customer jsonb,
  -- {"customerName", "mobile", "addressLine", "city", "state", "pinCode"}
  p_order_number text
)
RETURNS text -- the order number
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item        jsonb;
  v_product     RECORD;
  v_size_label  TEXT;
  v_color_name  TEXT;
  v_raw_qty     INTEGER;
  v_qty         INTEGER;
  v_unit_price  INTEGER;
  v_line_total  INTEGER;
  v_subtotal    INTEGER := 0;
  v_shipping    INTEGER;
  v_name_suffix TEXT;
  v_lines       jsonb := '[]'::jsonb;
  v_order_id    TEXT;
  v_seen        text[] := '{}';
BEGIN
  IF p_order_number IS NULL OR length(p_order_number) = 0 THEN
    RAISE EXCEPTION 'order number is required';
  END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'cart is empty';
  END IF;

  -- ---------- Single pass: re-read server-side truth, build line data ----------
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    -- Quantity must be a whole number between 1 and 99. The checkout action
    -- validates the same rule; this is the DB-side backstop (the RPC is
    -- callable by anon directly).
    v_raw_qty := (v_item->>'quantity')::int;
    IF v_raw_qty IS NULL OR v_raw_qty < 1 OR v_raw_qty > 99 THEN
      RAISE EXCEPTION 'CART_INVALID: An item in your cart has an invalid quantity. Please review your cart and try again.';
    END IF;

    -- Duplicate line for the same product+size+color would double-decrement
    -- stock for one visible line — reject rather than guess.
    IF v_item->>'productId' = ANY(v_seen) THEN
      RAISE EXCEPTION 'CART_INVALID: Your cart has duplicate lines for one product. Please refresh the page and try again.';
    END IF;
    v_seen := v_seen || (v_item->>'productId');

    -- Lock the product row for the rest of the transaction: concurrent
    -- checkouts serialize here, so the stock read-check-decrement below
    -- cannot interleave (no oversell).
    SELECT "id", "name", "slug", "price", "sku", "stock"
      INTO v_product
      FROM "products"
     WHERE "id" = v_item->>'productId'
       AND "active" = true
     LIMIT 1
     FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'PRODUCT_GONE: A product in your cart is no longer available.';
    END IF;

    v_name_suffix := '';
    IF v_item->>'sizeId' IS NOT NULL THEN
      SELECT "label" INTO v_size_label
        FROM "product_sizes"
       WHERE "id" = v_item->>'sizeId' AND "productId" = v_product."id"
       LIMIT 1;
      IF v_size_label IS NULL THEN
        RAISE EXCEPTION 'PRODUCT_GONE: A selected size is no longer available.';
      END IF;
      v_name_suffix := v_name_suffix || ' · ' || v_size_label;
    END IF;

    IF v_item->>'colorId' IS NOT NULL THEN
      SELECT "name" INTO v_color_name
        FROM "product_colors"
       WHERE "id" = v_item->>'colorId' AND "productId" = v_product."id"
       LIMIT 1;
      IF v_color_name IS NULL THEN
        RAISE EXCEPTION 'PRODUCT_GONE: A selected colour is no longer available.';
      END IF;
      v_name_suffix := v_name_suffix || ' · ' || v_color_name;
    END IF;

    v_qty := v_raw_qty;

    -- Stock check: tracked products must have the quantity available; clamp
    -- to what is left (a simultaneous purchase may have taken some while the
    -- customer browsed). With the row locked, this read is authoritative.
    IF v_product."stock" IS NOT NULL THEN
      IF v_product."stock" < 1 THEN
        RAISE EXCEPTION 'OUT_OF_STOCK: "%" just went out of stock.', v_product."name";
      END IF;
      v_qty := LEAST(v_qty, v_product."stock");
    END IF;

    v_unit_price := v_product."price"; -- server-side truth, never the client's
    v_line_total := v_unit_price * v_qty;
    v_subtotal := v_subtotal + v_line_total;

    v_lines := v_lines || jsonb_build_object(
      'productId',   v_product."id",
      'productName', v_product."name" || v_name_suffix,
      'productSlug', v_product."slug",
      'sku',         v_product."sku",
      'quantity',    v_qty,
      'unitPrice',   v_unit_price,
      'lineTotal',   v_line_total,
      'stockTracked', v_product."stock" IS NOT NULL
    );
  END LOOP;

  -- Flat ₹100 shipping on every order (10000 paise).
  v_shipping := 10000;

  -- ---------- Write pass: order first, then items linked directly ----------
  INSERT INTO "orders"
    ("id", "orderNumber", "status", "paymentStatus", "userId",
     "customerName", "customerEmail", "customerPhone",
     "shippingLine1", "shippingLine2", "shippingCity", "shippingState",
     "shippingPostalCode", "shippingCountry",
     "subtotal", "shipping", "total")
  VALUES (
    gen_random_uuid()::text,
    p_order_number,
    'PENDING',
    'PENDING',
    NULL, -- guest checkout (registered users are a later step)
    p_customer->>'customerName',
    NULL,
    p_customer->>'mobile',
    p_customer->>'addressLine',
    NULL,
    p_customer->>'city',
    p_customer->>'state',
    p_customer->>'pinCode',
    'India',
    v_subtotal,
    v_shipping,
    v_subtotal + v_shipping
  )
  RETURNING "id" INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_lines) LOOP
    INSERT INTO "order_items"
      ("id", "quantity", "unitPrice", "lineTotal", "orderId", "productId",
       "productName", "productSlug", "sku")
    VALUES (
      gen_random_uuid()::text,
      (v_item->>'quantity')::int,
      (v_item->>'unitPrice')::int,
      (v_item->>'lineTotal')::int,
      v_order_id,
      v_item->>'productId',
      v_item->>'productName',
      v_item->>'productSlug',
      v_item->>'sku'
    );

    IF (v_item->>'stockTracked')::boolean THEN
      -- Belt-and-braces guard: the row lock makes `stock >= quantity` a given,
      -- but the WHERE keeps a manual stock edit mid-flight from going negative.
      UPDATE "products"
         SET "stock" = "stock" - (v_item->>'quantity')::int
       WHERE "id" = v_item->>'productId'
         AND "stock" >= (v_item->>'quantity')::int;
    END IF;
  END LOOP;

  RETURN p_order_number;
EXCEPTION
  WHEN unique_violation THEN
    -- orderNumber collision — caller retries with a fresh number
    RAISE EXCEPTION 'ORDER_NUMBER_TAKEN: order number already exists';
END;
$$;

-- ----------------------------------------------------------------------------
-- 5.2 db_health() — cheap liveness probe
-- ----------------------------------------------------------------------------
-- Distinguishes "database unreachable" from "query failed" so pages can
-- render their graceful fallback states.
CREATE OR REPLACE FUNCTION "public"."db_health"()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT true;
$$;

-- ----------------------------------------------------------------------------
-- 5.3 is_admin() — the single admin check (Supabase-specific)
-- ----------------------------------------------------------------------------
-- True iff the caller's Supabase Auth id maps to an ACTIVE ADMIN profile.
-- SECURITY DEFINER so it reads profiles without recursing into that table's
-- own RLS; cheap (indexed PK lookup); evaluated once per statement. Only
-- authenticated may execute it — anon and PUBLIC are revoked.
CREATE OR REPLACE FUNCTION "public"."is_admin"()
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

-- ----------------------------------------------------------------------------
-- 5.4 EXECUTE grants (least privilege; revoked from PUBLIC first)
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION "public"."place_order"(jsonb, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."place_order"(jsonb, jsonb, text) TO anon, authenticated;

REVOKE ALL ON FUNCTION "public"."db_health"() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."db_health"() TO anon, authenticated;

REVOKE ALL ON FUNCTION "public"."is_admin"() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION "public"."is_admin"() TO authenticated;


-- ############################################################################
--  SECTION 6 — ROW LEVEL SECURITY (final policy set)
-- ############################################################################
--  Identity model: the app holds NO service-role key. Every operation runs as
--  anon (storefront reads, guest checkout via place_order) or authenticated
--  (admin CRUD authorized by is_admin(), own-profile reads). SECURITY DEFINER
--  functions bypass RLS legitimately as the table owner.
--
--  Policy summary (13 policies on public tables + 4 on storage.objects):
--    * public catalog reads (5): categories/products/product_images/
--      product_sizes/product_colors → SELECT to anon+authenticated.
--    * admin CRUD (7): those five + orders + order_items → FOR ALL to
--      authenticated USING/CHECK is_admin().
--    * profiles_select_own (1): SELECT to authenticated USING auth.uid()=id.
--    * orders: NO anon/customer write policy at all (deny-by-design); table
--      DML is also revoked from anon (defense in depth). Writes happen only
--      through place_order; no public read either — only admins see orders.
--    * profiles: NO write policies + DML revoked from anon AND authenticated
--      (blocks privilege escalation via role tampering). Provisioning is a
--      SQL/dashboard operation (scripts/create-admin.ts).

-- ---------- 6.0 Drop retired policy names (superseded by the 0013 set) ----------
DROP POLICY IF EXISTS "orders_insert_own"   ON "public"."orders";
DROP POLICY IF EXISTS "orders_insert_anon"  ON "public"."orders";
DROP POLICY IF EXISTS "profiles_update_own" ON "public"."profiles";
DROP POLICY IF EXISTS "profiles_insert_own" ON "public"."profiles";
DROP POLICY IF EXISTS "profiles_admin_all"  ON "public"."profiles";

-- ---------- 6.1 Enable RLS on every application table ----------
ALTER TABLE "public"."profiles"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."categories"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."products"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."product_images" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."product_sizes"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."product_colors" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."orders"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."order_items"    ENABLE ROW LEVEL SECURITY;

-- ---------- 6.2 Storefront: public catalog reads ----------
DROP POLICY IF EXISTS "categories_public_read" ON "public"."categories";
CREATE POLICY "categories_public_read"
  ON "public"."categories" FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "products_public_read" ON "public"."products";
CREATE POLICY "products_public_read"
  ON "public"."products" FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "product_images_public_read" ON "public"."product_images";
CREATE POLICY "product_images_public_read"
  ON "public"."product_images" FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "product_sizes_public_read" ON "public"."product_sizes";
CREATE POLICY "product_sizes_public_read"
  ON "public"."product_sizes" FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "product_colors_public_read" ON "public"."product_colors";
CREATE POLICY "product_colors_public_read"
  ON "public"."product_colors" FOR SELECT
  TO anon, authenticated
  USING (true);

-- ---------- 6.3 Admin: full management of business data ----------
DROP POLICY IF EXISTS "categories_admin_all" ON "public"."categories";
CREATE POLICY "categories_admin_all"
  ON "public"."categories" FOR ALL
  TO authenticated
  USING ("public"."is_admin"())
  WITH CHECK ("public"."is_admin"());

DROP POLICY IF EXISTS "products_admin_all" ON "public"."products";
CREATE POLICY "products_admin_all"
  ON "public"."products" FOR ALL
  TO authenticated
  USING ("public"."is_admin"())
  WITH CHECK ("public"."is_admin"());

DROP POLICY IF EXISTS "product_images_admin_all" ON "public"."product_images";
CREATE POLICY "product_images_admin_all"
  ON "public"."product_images" FOR ALL
  TO authenticated
  USING ("public"."is_admin"())
  WITH CHECK ("public"."is_admin"());

DROP POLICY IF EXISTS "product_sizes_admin_all" ON "public"."product_sizes";
CREATE POLICY "product_sizes_admin_all"
  ON "public"."product_sizes" FOR ALL
  TO authenticated
  USING ("public"."is_admin"())
  WITH CHECK ("public"."is_admin"());

DROP POLICY IF EXISTS "product_colors_admin_all" ON "public"."product_colors";
CREATE POLICY "product_colors_admin_all"
  ON "public"."product_colors" FOR ALL
  TO authenticated
  USING ("public"."is_admin"())
  WITH CHECK ("public"."is_admin"());

DROP POLICY IF EXISTS "orders_admin_all" ON "public"."orders";
CREATE POLICY "orders_admin_all"
  ON "public"."orders" FOR ALL
  TO authenticated
  USING ("public"."is_admin"())
  WITH CHECK ("public"."is_admin"());

DROP POLICY IF EXISTS "order_items_admin_all" ON "public"."order_items";
CREATE POLICY "order_items_admin_all"
  ON "public"."order_items" FOR ALL
  TO authenticated
  USING ("public"."is_admin"())
  WITH CHECK ("public"."is_admin"());

-- ---------- 6.4 Profiles: read own row only ----------
DROP POLICY IF EXISTS "profiles_select_own" ON "public"."profiles";
CREATE POLICY "profiles_select_own"
  ON "public"."profiles" FOR SELECT
  TO authenticated
  USING (auth.uid() = "id");

-- ---------- 6.5 Write denies (defense in depth, from 0013) ----------
-- Orders: created ONLY via place_order; no direct client DML for anon.
REVOKE INSERT, UPDATE, DELETE ON TABLE "public"."orders" FROM anon;

-- Profiles: authorization rows are never client-writable.
REVOKE INSERT, UPDATE, DELETE ON TABLE "public"."profiles" FROM anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE "public"."profiles" FROM authenticated;

-- ---------- 6.6 profiles guard trigger (owner-level, from 0013) ----------
-- Runs even for service-role writes: role can only be CUSTOMER/ADMIN, and
-- demoting an active admin requires active=false in the same statement —
-- prevents typo-level corruption of the authorization source.
CREATE OR REPLACE FUNCTION "public"."guard_profiles_write"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."role" NOT IN ('CUSTOMER', 'ADMIN') THEN
    RAISE EXCEPTION 'profiles.role must be CUSTOMER or ADMIN';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD."role" = 'ADMIN' AND NEW."role" <> 'ADMIN' AND NEW."active" IS NOT FALSE THEN
    RAISE EXCEPTION 'demoting an admin requires active=false in the same statement';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "profiles_guard_write" ON "public"."profiles";
CREATE TRIGGER "profiles_guard_write"
  BEFORE INSERT OR UPDATE ON "public"."profiles"
  FOR EACH ROW EXECUTE FUNCTION "public"."guard_profiles_write"();

-- ---------- 6.7 Table grants for the Data API (reproduces Supabase defaults +
--            the 0013 revokes) ----------
-- RLS policies are the real gate; these GRANTs are what PostgREST needs to
-- consider a statement admissible at all.
GRANT SELECT ON TABLE "public"."categories", "public"."products",
         "public"."product_images", "public"."product_sizes",
         "public"."product_colors"
  TO anon, authenticated;

-- Admin CRUD (writes still gated by is_admin() policies). Anon gets no DML.
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE "public"."categories", "public"."products",
         "public"."product_images", "public"."product_sizes",
         "public"."product_colors", "public"."orders", "public"."order_items"
  TO authenticated;

-- Profiles: authenticated may read (RLS scopes it to their own row); no writes.
GRANT SELECT ON TABLE "public"."profiles" TO authenticated;


-- ############################################################################
--  SECTION 7 — STORAGE: bucket `product-images` + object policies
-- ############################################################################
--  Public bucket for product photography (5 MB cap; jpeg/png/webp/avif).
--  Objects are named products/<productId>/<timestamp>-<rand>.<ext> so all
--  images for one product share a prefix. Reads are public (storefront);
--  writes (insert/update/delete) require an authenticated admin — there is
--  deliberately no anon write path (0013 closed the verified overwrite hole).

-- ---------- Bucket (upsert keeps settings pinned on re-runs) ----------
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
SET "public"             = EXCLUDED."public",
    "file_size_limit"    = EXCLUDED."file_size_limit",
    "allowed_mime_types" = EXCLUDED."allowed_mime_types";

-- ---------- Object policies (4: SELECT public; INSERT/UPDATE/DELETE admin) ----------
DROP POLICY IF EXISTS "product_images_public_read" ON "storage"."objects";
CREATE POLICY "product_images_public_read"
  ON "storage"."objects"
  FOR SELECT
  TO public
  USING ("bucket_id" = 'product-images');

DROP POLICY IF EXISTS "product_images_admin_insert" ON "storage"."objects";
CREATE POLICY "product_images_admin_insert"
  ON "storage"."objects"
  FOR INSERT
  TO authenticated
  WITH CHECK ("bucket_id" = 'product-images' AND "public"."is_admin"());

DROP POLICY IF EXISTS "product_images_admin_update" ON "storage"."objects";
CREATE POLICY "product_images_admin_update"
  ON "storage"."objects"
  FOR UPDATE
  TO authenticated
  USING ("bucket_id" = 'product-images' AND "public"."is_admin"())
  WITH CHECK ("bucket_id" = 'product-images' AND "public"."is_admin"());

DROP POLICY IF EXISTS "product_images_admin_delete" ON "storage"."objects";
CREATE POLICY "product_images_admin_delete"
  ON "storage"."objects"
  FOR DELETE
  TO authenticated
  USING ("bucket_id" = 'product-images' AND "public"."is_admin"());


-- ############################################################################
--  SECTION 8 — schema_migrations (deploy tracking for scripts/db-deploy.ts)
-- ############################################################################
--  The incremental deployer records applied migration filenames here (same
--  shape it creates itself — pre-creating keeps the two paths compatible).
--  RLS on + no policies + grants revoked = invisible to client roles; deploy
--  history is internal (0013).
CREATE TABLE IF NOT EXISTS "public"."schema_migrations" (
    "name"       TEXT PRIMARY KEY,
    "applied_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE "public"."schema_migrations" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."schema_migrations" FROM anon, authenticated;

-- Mark every migration in supabase/migrations/ as applied. This file already
-- IS their consolidated final state, so the incremental deployer
-- (npm run db:deploy) becomes a no-op on a database built here instead of
-- re-applying migrations onto the finished schema (0011's unguarded ADD
-- CONSTRAINT would fail on the second application). ON CONFLICT keeps the
-- live database's existing rows untouched.
INSERT INTO "public"."schema_migrations" ("name")
SELECT v.name
FROM unnest(ARRAY[
  '0000a_rename_legacy_tables.sql',
  '0000b_rename_legacy_constraints.sql',
  '0001_initial_schema.sql',
  '0002_place_order_rpc.sql',
  '0003_profiles_auth.sql',
  '0004_product_images_bucket.sql',
  '0005_migrate_legacy_data.sql',
  '0006_new_arrival_flag.sql',
  '0007_rls_policies.sql',
  '0008_category_active.sql',
  '0009_repair_rls.sql',
  '0010_flat_shipping_100.sql',
  '0011_single_auth_source.sql',
  '0012_schema_sync_and_integrity.sql',
  '0013_rls_storage_hardening.sql',
  '0014_fix_child_table_updated_at_triggers.sql',
  '0015_place_order_locking.sql',
  '0016_allow_equal_discount_price.sql'
]) AS v(name)
ON CONFLICT ("name") DO NOTHING;


-- ############################################################################
--  SECTION 9 — SEED DATA
-- ############################################################################
--  Intentionally minimal: the catalog is merchant data, not schema. Exactly
--  one starter category is inserted so a fresh install can create products
--  immediately (the admin product form requires a category). Nothing is
--  overwritten (ON CONFLICT DO NOTHING), so re-runs and existing databases
--  keep their data untouched. The legacy-data migration (0005) is NOT
--  reproduced — a fresh install builds its own catalog.
--
--  After running this file, provision an admin:
--    npx tsx scripts/create-admin.ts <email> "<Full Name>"
--  (inserts a profiles row with role='ADMIN', active=true for the given
--  Supabase Auth user.)

INSERT INTO "public"."categories" ("id", "name", "slug", "description", "active")
VALUES (
  'seed-cat-groceries',
  'Groceries',
  'groceries',
  'Daily essentials — staples, snacks, and household items.',
  true
)
ON CONFLICT DO NOTHING; -- bare: also tolerates a colliding slug on re-runs


-- ############################################################################
--  SECTION 10 — VERIFICATION (end-of-script schema check)
-- ############################################################################
--  Fails loudly (aborts the script) if any required object is missing or has
--  drifted from the final state, so a partially-applied file can never pass
--  silently. Mirrors the checks in scripts/db-deploy.ts plus constraint-
--  level checks the deployer does not make.
DO $verify$
DECLARE
  v_missing text;
  v_count   integer;
BEGIN
  -- ---------- 10.1 All eight application tables exist ----------
  SELECT string_agg(t, ', ') INTO v_missing
    FROM unnest(ARRAY[
      'categories', 'products', 'profiles', 'product_images',
      'product_sizes', 'product_colors', 'orders', 'order_items'
    ]) AS t
    WHERE NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    );
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'VERIFY FAILED — missing table(s): %', v_missing;
  END IF;

  -- ---------- 10.2 Retired objects are gone ----------
  IF to_regclass('public.users') IS NOT NULL THEN
    RAISE EXCEPTION 'VERIFY FAILED — retired "users" table still exists (0011)';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
             WHERE n.nspname = 'public' AND t.typname = 'UserRole') THEN
    RAISE EXCEPTION 'VERIFY FAILED — retired "UserRole" enum still exists (0011)';
  END IF;

  -- ---------- 10.3 Key columns (camelCase contract with the app) ----------
  SELECT string_agg(v.tbl || '.' || v.col, ', ') INTO v_missing
    FROM (VALUES
      ('categories', 'name'),        ('categories', 'slug'),
      ('categories', 'active'),      ('categories', 'imageUrl'),
      ('products', 'name'),          ('products', 'slug'),
      ('products', 'price'),         ('products', 'discountPrice'),
      ('products', 'stock'),         ('products', 'sku'),
      ('products', 'featured'),      ('products', 'active'),
      ('products', 'isNewArrival'),  ('products', 'categoryId'),
      ('product_images', 'url'),     ('product_images', 'position'),
      ('product_images', 'productId'),
      ('product_sizes', 'label'),    ('product_sizes', 'productId'),
      ('product_colors', 'name'),    ('product_colors', 'hex'),
      ('product_colors', 'productId'),
      ('orders', 'orderNumber'),     ('orders', 'status'),
      ('orders', 'paymentStatus'),   ('orders', 'userId'),
      ('orders', 'customerName'),    ('orders', 'subtotal'),
      ('orders', 'shipping'),        ('orders', 'total'),
      ('order_items', 'quantity'),   ('order_items', 'unitPrice'),
      ('order_items', 'lineTotal'),  ('order_items', 'orderId'),
      ('order_items', 'productId'),  ('order_items', 'productName'),
      ('profiles', 'email'),         ('profiles', 'name'),
      ('profiles', 'role'),          ('profiles', 'active')
    ) AS v(tbl, col)
    WHERE NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = v.tbl
        AND column_name = v.col
    );
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'VERIFY FAILED — missing column(s): %', v_missing;
  END IF;

  -- ---------- 10.4 Final CHECK constraint state ----------
  -- products_discount_gt_price must be the relaxed >= form (0016).
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.products'::regclass
      AND conname = 'products_discount_gt_price'
      AND pg_get_constraintdef(oid) LIKE '%>= %price%'
  ) THEN
    RAISE EXCEPTION 'VERIFY FAILED — products_discount_gt_price is not the final (>= price) form';
  END IF;
  SELECT count(*) INTO v_count
    FROM pg_constraint
    WHERE conrelid IN (
      'public.products'::regclass, 'public.orders'::regclass,
      'public.order_items'::regclass, 'public.product_images'::regclass
    )
    AND conname IN (
      'products_price_nonnegative', 'products_discount_price_nonnegative',
      'orders_amounts_nonnegative', 'order_items_values_valid',
      'product_images_position_nonnegative'
    );
  IF v_count <> 5 THEN
    RAISE EXCEPTION 'VERIFY FAILED — expected 5 nonneg/validity CHECKs, found %', v_count;
  END IF;

  -- ---------- 10.5 Final FK state ----------
  -- orders.userId → profiles (uuid, 0011) — the old users FK must be gone.
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.orders'::regclass
      AND conname IN ('orders_userId_users_id_fk', 'orders_userId_fkey')
  ) THEN
    RAISE EXCEPTION 'VERIFY FAILED — orders still carries a retired userId FK (0011)';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_userId_profiles_id_fk'
      AND conrelid = 'public.orders'::regclass
  ) THEN
    RAISE EXCEPTION 'VERIFY FAILED — orders_userId_profiles_id_fk missing (orders must reference profiles)';
  END IF;
  -- Ordered products are protected from deletion (RESTRICT).
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_categoryId_fkey'
      AND conrelid = 'public.products'::regclass
      AND pg_get_constraintdef(oid) LIKE '%ON DELETE RESTRICT%'
  ) THEN
    RAISE EXCEPTION 'VERIFY FAILED — products_categoryId_fkey must be ON DELETE RESTRICT';
  END IF;

  -- ---------- 10.6 Functions ----------
  SELECT string_agg(fn, ', ') INTO v_missing
    FROM unnest(ARRAY['place_order', 'db_health', 'is_admin', 'set_updated_at', 'guard_profiles_write']) AS fn
    WHERE NOT EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = fn
    );
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'VERIFY FAILED — missing function(s): %', v_missing;
  END IF;

  -- ---------- 10.7 RLS enabled on every application table ----------
  SELECT string_agg(tablename, ', ') INTO v_missing
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename IN ('categories', 'products', 'profiles', 'product_images',
                        'product_sizes', 'product_colors', 'orders', 'order_items',
                        'schema_migrations')
      AND NOT rowsecurity;
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'VERIFY FAILED — RLS not enabled on: %', v_missing;
  END IF;

  -- ---------- 10.8 Policy set: 13 public + 4 storage ----------
  SELECT count(*) INTO v_count
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('categories', 'products', 'product_images',
                        'product_sizes', 'product_colors', 'orders',
                        'order_items', 'profiles');
  IF v_count <> 13 THEN
    RAISE EXCEPTION 'VERIFY FAILED — expected 13 RLS policies on public tables, found %', v_count;
  END IF;
  SELECT count(*) INTO v_count
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname LIKE 'product_images%';
  IF v_count <> 4 THEN
    RAISE EXCEPTION 'VERIFY FAILED — expected 4 storage object policies, found %', v_count;
  END IF;

  -- ---------- 10.9 Triggers ----------
  SELECT count(*) INTO v_count
    FROM information_schema.triggers
    WHERE trigger_schema = 'public'
      AND event_object_table IN ('categories', 'products', 'orders', 'profiles')
      AND trigger_name = (
        CASE event_object_table
          WHEN 'categories' THEN 'categories_updated_at'
          WHEN 'products'   THEN 'products_updated_at'
          WHEN 'orders'     THEN 'orders_updated_at'
          ELSE 'profiles_updated_at'
        END
      );
  IF v_count <> 4 THEN
    RAISE EXCEPTION 'VERIFY FAILED — expected 4 updated_at triggers, found %', v_count;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_schema = 'public'
      AND trigger_name IN ('product_images_updated_at', 'product_sizes_updated_at',
                           'product_colors_updated_at')
  ) THEN
    RAISE EXCEPTION 'VERIFY FAILED — retired child-table updated_at triggers still present (0014)';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_schema = 'public' AND trigger_name = 'profiles_guard_write'
  ) THEN
    RAISE EXCEPTION 'VERIFY FAILED — profiles_guard_write trigger missing';
  END IF;

  -- ---------- 10.10 Storage bucket ----------
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets
    WHERE id = 'product-images' AND "public" = true
  ) THEN
    RAISE EXCEPTION 'VERIFY FAILED — storage bucket "product-images" missing or not public';
  END IF;

  -- ---------- 10.11 place_order pinned search_path ----------
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'place_order'
      AND NOT coalesce(p.proconfig && ARRAY['search_path=public'], false)
  ) THEN
    RAISE EXCEPTION 'VERIFY FAILED — place_order must pin search_path=public';
  END IF;

  RAISE NOTICE 'VERIFY OK — final schema complete: 8 tables, 6 CHECK constraints, 13+4 policies, RLS on, place_order(0015), storage bucket ready.';
END
$verify$;

-- ============================================================================
--  DONE. Next steps after running this file on a fresh database:
--    1. npx tsx scripts/create-admin.ts <email> "<Full Name>"   (admin profile)
--    2. Log into /admin and create your real categories/products
--       (or import them via the admin Data toolbox).
-- ============================================================================
