-- 0016: Allow the original (struck-through) price to EQUAL the selling price.
--
-- A merchant's MRP often equals the current selling price — that is simply a
-- product with no discount running, not an error. The old constraint
-- (products_discount_gt_price, from 0012) rejected that case outright, so the
-- admin form refused to save "Original price = Selling price".
--
-- Storefront rendering is already discount-safe everywhere: struck-through
-- prices and "% off" badges only render when discountPrice > price, so equal
-- values display as a plain price. The constraint only needs to keep the
-- guarantee that an original price is never LOWER than the selling price —
-- a struck-through "discount" that raises the price would be deceptive.

ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_discount_gt_price";
ALTER TABLE "products"
  ADD CONSTRAINT "products_discount_gt_price"
  CHECK ("discountPrice" IS NULL OR "discountPrice" >= "price");
