-- Mamta General Store — Supabase Auth integration
-- ============================================================
-- Adds the profiles table that links Supabase Auth users to application
-- authorization data, plus RLS policies. This is additive: the existing
-- `users` table (used for customer records) is untouched.
--
-- Authorization model: an authenticated Supabase Auth user is an admin
-- if and only if their linked profiles row has role 'ADMIN' and
-- active = true. The check ALWAYS runs server-side; no client flag is
-- trusted.

-- ============ Profiles (linked to Supabase Auth users) ============
CREATE TABLE IF NOT EXISTS "profiles" (
    -- Matches auth.users.id exactly.
    "id" UUID PRIMARY KEY REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "role" TEXT NOT NULL DEFAULT 'CUSTOMER' CHECK ("role" IN ('CUSTOMER', 'ADMIN')),
    -- Disabled admins cannot sign in; their history is preserved.
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============ updated_at trigger ============
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW."updatedAt" := CAST(now() AT TIME ZONE 'utc' AS TIMESTAMP(3));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "profiles_updated_at" ON "profiles";
CREATE TRIGGER "profiles_updated_at"
  BEFORE UPDATE ON "profiles"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ Row Level Security ============
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;

-- 1. A signed-in user may read their own profile (the server also verifies
--    with the service-role client — this keeps client reads scoped, never
--    granting admin by client assertion).
CREATE POLICY "profiles_select_own"
  ON "profiles"
  FOR SELECT
  TO authenticated
  USING (auth.uid() = "id");

-- 2. Writes stay privileged: no INSERT/UPDATE/DELETE policies exist, so
--    admins are provisioned via SQL (see scripts/create-admin.ts) with the
--    service role / dashboard only.
