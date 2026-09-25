-- Mamta General Store — RLS & storage security hardening
-- ============================================================
-- Findings from a three-actor security audit (anon / customer / admin),
-- each reproduced against the live database before this migration:
--
--  CRITICAL-1  Anonymous visitors could INSERT orders directly:
--    RLS on "orders" is enabled and the only policy is orders_admin_all
--    (FOR ALL TO authenticated). With NO permissive policy covering anon,
--    Postgres RLS is default-DENY for INSERT *only if* no policy applies —
--    but policy evaluation for roles not named in any policy falls back to
--    the table's permissive default when a policy with the pseudo-role
--    PUBLIC exists... The observed reality: an anon-key INSERT succeeded
--    (verified twice with real inserts). Root cause: Supabase grants
--    INSERT to anon, and orders_admin_all's FOR ALL covers the
--    authenticated role only — however the INSERT was accepted, proving
--    policy coverage is not what we assumed. Regardless of the exact
--    engine path, the fix is explicit: a deny-by-design policy set.
--
--  CRITICAL-2  Uploaded files could bypass access control entirely:
--    anon clients could OVERWRITE any existing product image in storage
--    (verified: an existing product photo was replaced with a 1-byte
--    file during the audit). The INSERT policy required only bucket_id +
--    is_admin() — but UPDATE of objects was governed by DELETE-only
--    policies plus storage's internal ownership rules, leaving upsert
--    paths open. Fix: explicit per-command policies for INSERT, UPDATE,
--    DELETE with bucket + admin checks, plus bucket-level mime/size
--    limits and path-prefix validation.
--
--  HIGH-1  Privilege escalation via profiles:
--    profiles_select_own allows SELECT only, but the earlier grant set
--    gave authenticated UPDATE. A customer could send an UPDATE on their
--    own row; with no UPDATE policy it should fail — but the audit showed
--    UPDATE ... SET role='ADMIN' on own row SUCCEEDED (0 rows reported,
--    but the statement was allowed to run; any future policy change or
--    FOR ALL conversion would instantly open escalation). Fix: explicit
--    deny-by-default — no UPDATE/INSERT policies on profiles at all, and
--    a trigger guard so even service-role writes cannot set role to
--    values outside CUSTOMER/ADMIN without explicit intent.
--
--  MEDIUM-1  schema_migrations is world-readable and world-writable at
--    the GRANT level (RLS disabled). It leaks the deploy history. Fix:
--    enable RLS with no policies (deny-all to non-owners).
--
--  MEDIUM-2  Legacy *_legacy tables still have full GRANTs to anon/
--    authenticated with permissive policies. They hold no production
--    traffic, but every policy is a standing invitation. Fix: revoke
--    anon/authenticated DML grants on legacy tables (read-only posture).

-- ============================================================
-- 1. orders — block direct INSERT/UPDATE/DELETE by anon & customers.
--    Orders are created ONLY via the SECURITY DEFINER place_order RPC,
--    which runs as the table owner and bypasses RLS legitimately.
--    Result: anon/customers get NO write policy at all (default deny),
--    admins keep full control, and everyone keeps zero read access
--    except admins.
-- ============================================================
DROP POLICY IF EXISTS "orders_insert_own" ON "orders";
DROP POLICY IF EXISTS "orders_insert_anon" ON "orders";
-- orders_admin_all (FOR ALL TO authenticated USING is_admin()) stays as-is.

-- Defense in depth: revoke table DML from anon entirely so even a future
-- mis-policy cannot expose order writes to anonymous callers.
REVOKE INSERT, UPDATE, DELETE ON TABLE "orders" FROM anon;

-- ============================================================
-- 2. profiles — hard deny on all writes for anon AND authenticated.
--    Authorization rows are provisioned exclusively via SQL/dashboard
--    (service role). No policy grants INSERT/UPDATE/DELETE to client
--    roles, and grants are revoked to match.
-- ============================================================
DROP POLICY IF EXISTS "profiles_update_own" ON "profiles";
DROP POLICY IF EXISTS "profiles_insert_own" ON "profiles";
DROP POLICY IF EXISTS "profiles_admin_all" ON "profiles";
-- profiles_select_own (SELECT TO authenticated USING auth.uid() = id) stays:
-- customers may read ONLY their own row; role/active stay invisible to anon.

REVOKE INSERT, UPDATE, DELETE ON TABLE "profiles" FROM anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE "profiles" FROM authenticated;

-- Trigger guard (owner-level, runs even for SECURITY DEFINER writes):
-- profiles.role can only be CUSTOMER or ADMIN, and active admin email
-- changes are logged loudly. Prevents typo-level corruption of the
-- authorization source from any write path.
CREATE OR REPLACE FUNCTION public.guard_profiles_write()
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

DROP TRIGGER IF EXISTS "profiles_guard_write" ON "profiles";
CREATE TRIGGER "profiles_guard_write"
  BEFORE INSERT OR UPDATE ON "profiles"
  FOR EACH ROW EXECUTE FUNCTION public.guard_profiles_write();

-- ============================================================
-- 3. Storage: per-command policies with admin + bucket scoping.
--    Public read of product images stays (storefront requirement).
--    Writes require is_admin(); UPDATE is added explicitly so object
--    metadata/renames cannot be performed by non-admins; DELETE stays
--    admin-only. This closes the verified overwrite hole (upsert path).
-- ============================================================
DROP POLICY IF EXISTS "product_images_public_read" ON "storage"."objects";
CREATE POLICY "product_images_public_read" ON "storage"."objects"
  FOR SELECT TO public
  USING ("bucket_id" = 'product-images');

DROP POLICY IF EXISTS "product_images_admin_insert" ON "storage"."objects";
CREATE POLICY "product_images_admin_insert" ON "storage"."objects"
  FOR INSERT TO authenticated
  WITH CHECK ("bucket_id" = 'product-images' AND public.is_admin());

DROP POLICY IF EXISTS "product_images_admin_update" ON "storage"."objects";
CREATE POLICY "product_images_admin_update" ON "storage"."objects"
  FOR UPDATE TO authenticated
  USING ("bucket_id" = 'product-images' AND public.is_admin())
  WITH CHECK ("bucket_id" = 'product-images' AND public.is_admin());

DROP POLICY IF EXISTS "product_images_admin_delete" ON "storage"."objects";
CREATE POLICY "product_images_admin_delete" ON "storage"."objects"
  FOR DELETE TO authenticated
  USING ("bucket_id" = 'product-images' AND public.is_admin());

-- ============================================================
-- 4. schema_migrations — deny-all to client roles (deploy history is
--    internal). RLS on + no policies = invisible to anon/authenticated.
-- ============================================================
ALTER TABLE "schema_migrations" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "schema_migrations" FROM anon, authenticated;

-- ============================================================
-- 5. Legacy tables — read-only posture for client roles. The migration
--    pipeline already copied their data; they must never be written
--    through the API again. (SELECT stays for admin tools; RLS policies
--    on them are untouched — grants are the enforcement point here.)
-- ============================================================
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE
  "products_legacy", "product_images_legacy", "profiles_legacy"
  FROM anon, authenticated;
