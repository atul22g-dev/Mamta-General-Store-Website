-- Mamta General Store — order placement (atomic)
-- ============================================================
-- The checkout server action previously ran inside a Prisma $transaction:
--   1. re-read real prices for the cart's product ids (never trust the client)
--   2. validate variants and availability, clamp quantities to stock
--   3. insert the order with snapshot data + line items
--   4. decrement stock for tracked products
--
-- This RPC preserves those guarantees atomically in the database. It is
-- SECURITY DEFINER (runs as the table owner, bypassing RLS) so the
-- cash-on-delivery checkout needs no client auth; it only ever writes
-- orders/order_items and decrements stock — nothing else is exposed.
--
-- Error messages intentionally carry the prefixes the action layer matches
-- on ("out of stock", "no longer available") so customer-facing copy stays
-- identical to the previous behaviour.

CREATE OR REPLACE FUNCTION public.place_order(
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
  v_qty         INTEGER;
  v_unit_price  INTEGER;
  v_line_total  INTEGER;
  v_subtotal    INTEGER := 0;
  v_shipping    INTEGER;
  v_name_suffix TEXT;
  v_lines       jsonb := '[]'::jsonb;
  v_order_id    TEXT;
BEGIN
  IF p_order_number IS NULL OR length(p_order_number) = 0 THEN
    RAISE EXCEPTION 'order number is required';
  END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'cart is empty';
  END IF;

  -- ---------- Single pass: re-read server-side truth, build line data ----------
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT "id", "name", "slug", "price", "sku", "stock"
      INTO v_product
      FROM "products"
     WHERE "id" = v_item->>'productId'
       AND "active" = true
     LIMIT 1;

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

    v_qty := LEAST((v_item->>'quantity')::int, 99);

    -- Stock check: tracked products must have quantity available; clamp.
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

  v_shipping := CASE WHEN v_subtotal >= 99900 THEN 0 ELSE 9900 END; -- free over ₹999, else ₹99

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
      UPDATE "products"
         SET "stock" = "stock" - (v_item->>'quantity')::int
       WHERE "id" = v_item->>'productId';
    END IF;
  END LOOP;

  RETURN p_order_number;
EXCEPTION
  WHEN unique_violation THEN
    -- orderNumber collision — caller retries with a fresh number
    RAISE EXCEPTION 'ORDER_NUMBER_TAKEN: order number already exists';
END;
$$;

-- ---------- Health probe ----------
-- Cheap SELECT used by the data layer to distinguish "database unreachable"
-- from "query failed" so pages can render their graceful fallback states.
CREATE OR REPLACE FUNCTION public.db_health()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT true;
$$;
