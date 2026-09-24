-- Mamta General Store — initial Supabase schema
-- ============================================================
-- Source of truth: prisma/schema.prisma (DDL generated via
-- `prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script`).
--
-- Faithful to the Prisma datamodel so the existing application queries keep
-- working unchanged:
--   * Quoted camelCase identifiers ("categoryId", "createdAt", ...) because
--     Prisma maps model fields to these exact column names.
--   * TIMESTAMP(3) (millisecond precision) as Prisma writes/reads.
--   * Text primary keys — IDs are generated client-side by Prisma (cuid),
--     so no DB default is added on "id" (a DB default would show up as
--     drift on `prisma db pull`).
--
-- Idempotent: safe to run repeatedly on the same database. Every statement
-- is guarded — existing enums/tables/indexes/constraints are left untouched
-- and NO data is ever deleted or modified.
--
-- Supabase-specific hardening (additive, no effect on Prisma):
--   * Row Level Security is ENABLED on every table with no policies yet.
--     Prisma connects as a privileged role and bypasses RLS; enabling it
--     blocks the public PostgREST API (anon key) from touching the data
--     until deliberate policies are added in a later step.
--   * A trigger keeps "updatedAt" fresh for writes that bypass the app
--     (Supabase dashboard edits, seed scripts).

-- ============ Schema ============
CREATE SCHEMA IF NOT EXISTS "public";

-- ============ Enums ============
DO $$
BEGIN
  CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'ADMIN');
EXCEPTION WHEN duplicate_object THEN NULL; -- already exists
END $$;

DO $$
BEGIN
  CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============ Tables ============
-- Store customer or admin. "passwordHash" is nullable to allow guest
-- checkout before authentication is introduced.
CREATE TABLE IF NOT EXISTS "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "passwordHash" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'CUSTOMER',
    -- Disabled accounts cannot sign in; their history is preserved.
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- Storefront product category. Categories are data, not code: new
-- categories (Kurtis, Sarees, ...) are new rows, never schema changes.
CREATE TABLE IF NOT EXISTS "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- Product photo. "position" controls ordering within the gallery.
CREATE TABLE IF NOT EXISTS "product_images" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "alt" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "productId" TEXT NOT NULL,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

-- Product size option, e.g. S / M / L / XL / Free Size.
CREATE TABLE IF NOT EXISTS "product_sizes" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "productId" TEXT NOT NULL,

    CONSTRAINT "product_sizes_pkey" PRIMARY KEY ("id")
);

-- Product color option with an optional swatch hex.
CREATE TABLE IF NOT EXISTS "product_colors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hex" TEXT,
    "productId" TEXT NOT NULL,

    CONSTRAINT "product_colors_pkey" PRIMARY KEY ("id")
);

-- A sellable item. Money is stored in minor units (paise):
-- 199900 = ₹1,999.00 — no floats. "stock" NULL = not tracked
-- (made-to-order). Only "active" products are visible on the storefront.
CREATE TABLE IF NOT EXISTS "products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "price" INTEGER NOT NULL,
    "discountPrice" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "stock" INTEGER,
    "sku" TEXT,
    "brand" TEXT,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- A customer order. Immutable snapshots of contact/shipping details and
-- line-item data keep history correct even after catalog/account changes.
CREATE TABLE IF NOT EXISTS "orders" (
    "id" TEXT NOT NULL,
    -- Human-friendly reference, e.g. MGS-2026-000123.
    "orderNumber" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    -- Placed by a registered user; NULL for guest orders.
    "userId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT,
    "customerPhone" TEXT,
    -- Shipping address snapshot at purchase time.
    "shippingLine1" TEXT NOT NULL,
    "shippingLine2" TEXT,
    "shippingCity" TEXT NOT NULL,
    "shippingState" TEXT NOT NULL,
    "shippingPostalCode" TEXT NOT NULL,
    "shippingCountry" TEXT NOT NULL DEFAULT 'India',
    -- All amounts in minor units (paise).
    "subtotal" INTEGER NOT NULL,
    "shipping" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- A line item on an order. Snapshots the product's name/slug/price at
-- purchase time; "productId" becomes NULL (history kept) if the product
-- is ever deleted.
CREATE TABLE IF NOT EXISTS "order_items" (
    "id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    -- quantity × unitPrice, denormalized for fast order totals/history.
    "lineTotal" INTEGER NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "productSlug" TEXT NOT NULL,
    "sku" TEXT,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- ============ Indexes ============
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email");

CREATE UNIQUE INDEX IF NOT EXISTS "categories_slug_key" ON "categories"("slug");

CREATE INDEX IF NOT EXISTS "product_images_productId_idx" ON "product_images"("productId");

CREATE INDEX IF NOT EXISTS "product_sizes_productId_idx" ON "product_sizes"("productId");

CREATE INDEX IF NOT EXISTS "product_colors_productId_idx" ON "product_colors"("productId");

CREATE UNIQUE INDEX IF NOT EXISTS "products_slug_key" ON "products"("slug");

CREATE UNIQUE INDEX IF NOT EXISTS "products_sku_key" ON "products"("sku");

CREATE INDEX IF NOT EXISTS "products_categoryId_active_idx" ON "products"("categoryId", "active");

CREATE INDEX IF NOT EXISTS "products_active_createdAt_idx" ON "products"("active", "createdAt");

CREATE INDEX IF NOT EXISTS "products_active_price_idx" ON "products"("active", "price");

CREATE INDEX IF NOT EXISTS "products_featured_active_idx" ON "products"("featured", "active");

CREATE UNIQUE INDEX IF NOT EXISTS "orders_orderNumber_key" ON "orders"("orderNumber");

CREATE INDEX IF NOT EXISTS "orders_userId_createdAt_idx" ON "orders"("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "orders_status_createdAt_idx" ON "orders"("status", "createdAt");

CREATE INDEX IF NOT EXISTS "order_items_orderId_idx" ON "order_items"("orderId");

CREATE INDEX IF NOT EXISTS "order_items_productId_idx" ON "order_items"("productId");

-- ============ Foreign keys ============
-- Match Prisma exactly: images/sizes/colors cascade with their product;
-- deleting a category is restricted while products exist; deleting a user
-- or product nullifies order references but keeps history.
DO $$
BEGIN
  ALTER TABLE "product_images"
    ADD CONSTRAINT "product_images_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "products"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "product_sizes"
    ADD CONSTRAINT "product_sizes_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "products"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "product_colors"
    ADD CONSTRAINT "product_colors_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "products"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "products"
    ADD CONSTRAINT "products_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "categories"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "orders"
    ADD CONSTRAINT "orders_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "order_items"
    ADD CONSTRAINT "order_items_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "orders"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "order_items"
    ADD CONSTRAINT "order_items_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "products"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============ Row Level Security (hardening) ============
-- Enable RLS now so the public anon key can never read or write this data
-- through the Supabase API. Privileged roles used by the app (postgres /
-- service_role) bypass RLS, so Prisma and server actions are unaffected.
-- Data-API policies are a deliberate, later step.
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "product_images" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "product_sizes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "product_colors" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order_items" ENABLE ROW LEVEL SECURITY;

-- ============ updated_at trigger ============
-- Keeps "updatedAt" correct for writes that bypass the application
-- (Supabase dashboard edits, seed scripts). Writes in UTC to match how
-- Prisma stores naive UTC timestamps. Prisma-managed writes already set
-- the column; the trigger merely overwrites it with the same semantics.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW."updatedAt" := CAST(now() AT TIME ZONE 'utc' AS TIMESTAMP(3));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "users_updated_at" ON "users";
CREATE TRIGGER "users_updated_at"
  BEFORE UPDATE ON "users"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS "categories_updated_at" ON "categories";
CREATE TRIGGER "categories_updated_at"
  BEFORE UPDATE ON "categories"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS "products_updated_at" ON "products";
CREATE TRIGGER "products_updated_at"
  BEFORE UPDATE ON "products"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS "orders_updated_at" ON "orders";
CREATE TRIGGER "orders_updated_at"
  BEFORE UPDATE ON "orders"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
