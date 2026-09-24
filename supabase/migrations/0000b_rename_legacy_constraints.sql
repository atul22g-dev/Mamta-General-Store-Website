-- Mamta General Store — free schema-wide names used by the legacy tables
-- ============================================================
-- Renaming a table does NOT rename its constraints or indexes. The renamed
-- *_legacy tables still own schema-wide names (e.g. the `product_images_pkey`
-- index, `products_pkey` constraint) that the canonical migrations need.
-- This renames every constraint/index on the legacy tables to <name>_legacy.
--
-- Constraint renames carry their indexes along; standalone indexes are
-- renamed afterwards. Idempotent: names ending in _legacy are skipped and
-- the target name must be free.

DO $$
DECLARE
  r RECORD;
  legacy_tables TEXT[] := ARRAY['products_legacy', 'product_images_legacy', 'profiles_legacy'];
BEGIN
  -- 1. Table constraints (pkey/unique/fkey/check) — renames their indexes too.
  FOR r IN
    SELECT con.conname, con.conrelid::regclass AS tbl
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = ANY(legacy_tables)
      AND con.conname NOT LIKE '%_legacy'
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c2
      JOIN pg_class c3 ON c3.oid = c2.conrelid
      JOIN pg_namespace n2 ON n2.oid = c3.relnamespace
      WHERE n2.nspname = 'public'
        AND c3.relname = ANY(legacy_tables)
        AND c2.conname = r.conname || '_legacy'
    ) THEN
      EXECUTE format('ALTER TABLE %s RENAME CONSTRAINT %I TO %I', r.tbl, r.conname, r.conname || '_legacy');
    END IF;
  END LOOP;

  -- 2. Any remaining standalone indexes on the legacy tables.
  FOR r IN
    SELECT i.indexname, i.tablename
    FROM pg_indexes i
    WHERE i.schemaname = 'public'
      AND i.tablename = ANY(legacy_tables)
      AND i.indexname NOT LIKE '%_legacy'
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes i2
      WHERE i2.schemaname = 'public'
        AND i2.indexname = r.indexname || '_legacy'
    ) THEN
      EXECUTE format('ALTER INDEX public.%I RENAME TO %I', r.indexname, r.indexname || '_legacy');
    END IF;
  END LOOP;
END
$$;
