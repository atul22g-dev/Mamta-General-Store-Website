-- Mamta General Store — single authentication source (Supabase Auth)
-- ============================================================
-- The app authenticates exclusively through Supabase Auth; authorization
-- comes only from `profiles` (role 'ADMIN' + active) checked server-side
-- (is_admin()). This migration retires the legacy Prisma-era `users` table,
-- which was a DUPLICATE authentication model: it carried its own
-- passwordHash column (a second, never-used password system) and its own
-- role column, and no application code has ever read or written it
-- (verified: zero references in src/, scripts/; 0 rows in production).
--
-- What changes (non-destructive to real data):
--   1. orders."userId" is re-pointed from the retired users table to
--      profiles (the id space of Supabase Auth users, UUID). The column
--      converts TEXT → uuid; this is only sound while every value is NULL
--      (guest checkout — verified in production), which the guard below
--      enforces instead of assuming.
--   2. The `users` table is dropped together with the UserRole type and
--      its indexes. Orders keep the "userId" column (nullable, now
--      profile-scoped) so order attribution is possible in the future.
--   3. RLS stays enabled on every remaining table; no policy referenced
--      `users` (verified), so nothing else needs to change.
--
-- Auth architecture after this migration:
--   Next.js → Supabase Auth (identity, HttpOnly cookies)
--           → profiles (role/active authorization)
--           → products/categories/orders/order_items (+ Storage)
-- No application-database passwords exist anywhere.

-- ---------- 1. Re-point orders."userId" at profiles ----------
ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_userId_users_id_fk";
ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_userId_fkey";

-- Guard: refuse to run if any order is attributed to a users row. In that
-- (never-seen) case the data would need manual mapping to profiles first.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "orders" WHERE "userId" IS NOT NULL) THEN
    RAISE EXCEPTION 'orders.userId holds values; map them to profiles before re-pointing';
  END IF;
END
$$;

-- profiles.id is UUID; the column only ever held NULL, so the conversion
-- is trivial (USING is required by Postgres for text → uuid).
ALTER TABLE "orders" ALTER COLUMN "userId" TYPE uuid USING NULL::uuid;

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_userId_profiles_id_fk"
  FOREIGN KEY ("userId") REFERENCES "profiles"("id")
  ON DELETE SET NULL;

-- ---------- 2. Drop the duplicate auth model ----------
DROP TABLE IF EXISTS "users";
DROP TYPE IF EXISTS "UserRole";
