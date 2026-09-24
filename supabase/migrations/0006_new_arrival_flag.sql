-- Mamta General Store — "New Arrival" product flag
-- ============================================================
-- Additive, idempotent: adds products."isNewArrival" (default false) so the
-- admin can mark products as New Arrivals and the homepage lists them.
-- No existing data is modified; the shared schema stays compatible with the
-- mobile app (new nullable-defaulted column is ignored by older clients).

ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "isNewArrival" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "products_new_arrival_active_idx"
  ON "products"("isNewArrival", "active", "createdAt");
