import "server-only";

import { formatPrice } from "@/lib/utils";
import { getSupabasePublicClient } from "@/lib/supabase/public";
import type { OrderNotification, OrderItemNotification } from "./order-webhook";

/**
 * Builds the full n8n order payload from the checkout cart.
 *
 * The checkout action only holds product/variant ids + quantities (prices are
 * never trusted from the client), so this looks the products back up by id
 * and attaches everything an n8n workflow needs to act without re-querying:
 * names, slugs, SKUs, category, chosen size/color, unit prices, line totals,
 * all image URLs and order-level totals.
 *
 * Prices come from the current catalog rows, not the order snapshot — the
 * look-up happens milliseconds after placement, so drift is practically
 * impossible; n8n can still fetch authoritative money data by orderNumber.
 */

export interface CartLine {
  productId: string;
  quantity: number;
  sizeId: string | null;
  colorId: string | null;
}

export interface OrderCustomer {
  customerName: string;
  mobile: string;
  addressLine: string;
  city: string;
  state: string;
  pinCode: string;
}

export async function buildOrderNotification(input: {
  orderNumber: string;
  customer: OrderCustomer;
  cart: CartLine[];
}): Promise<OrderNotification> {
  const { orderNumber, customer, cart } = input;

  // One round-trip for every product in the cart, with relations embedded.
  const { data, error } = await getSupabasePublicClient()
    .from("products")
    .select(
      `id, name, slug, sku, brand, price, "discountPrice", currency,
       categories ( name ),
       product_images ( url, position ),
       product_sizes ( id, label ),
       product_colors ( id, name )`,
    )
    .in("id", cart.map((line) => line.productId));

  if (error) throw new Error(`Failed to load order products: ${error.message}`);

  interface ProductDetailRow {
    id: string;
    name: string;
    slug: string;
    sku: string | null;
    brand: string | null;
    price: number;
    discountPrice: number | null;
    currency: string;
    categories: { name: string } | null;
    product_images: { url: string; position: number }[] | null;
    product_sizes: { id: string; label: string }[] | null;
    product_colors: { id: string; name: string }[] | null;
  }
  const byId = new Map<string, ProductDetailRow>(
    ((data ?? []) as ProductDetailRow[]).map((row) => [row.id, row]),
  );

  let subtotal = 0;
  let total = 0;
  let itemCount = 0;
  let currency = "INR";

  const items: OrderItemNotification[] = cart.map((line) => {
    const product = byId.get(line.productId);

    // A product deleted between "Add to cart" and checkout: keep the line
    // with what we know (the order itself already succeeded).
    if (!product) {
      return {
        productId: line.productId,
        productName: "Unknown product",
        productSlug: null,
        productUrl: null,
        sku: null,
        brand: null,
        category: null,
        quantity: line.quantity,
        size: null,
        color: null,
        unitPrice: 0,
        unitPriceFormatted: formatPrice(0),
        lineTotal: 0,
        lineTotalFormatted: formatPrice(0),
        images: [],
      };
    }

    currency = product.currency || currency;
    const images = (product.product_images ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((image) => image.url);

    const unitPrice = product.discountPrice ?? product.price;
    const lineTotal = unitPrice * line.quantity;
    subtotal += product.price * line.quantity;
    total += lineTotal;
    itemCount += line.quantity;

    return {
      productId: product.id,
      productName: product.name,
      productSlug: product.slug,
      productUrl: product.slug ? `/products/${product.slug}` : null,
      sku: product.sku,
      brand: product.brand,
      category: product.categories?.name ?? null,
      quantity: line.quantity,
      size: product.product_sizes?.find((size) => size.id === line.sizeId)?.label ?? null,
      color: product.product_colors?.find((color) => color.id === line.colorId)?.name ?? null,
      unitPrice,
      unitPriceFormatted: formatPrice(unitPrice, currency),
      lineTotal,
      lineTotalFormatted: formatPrice(lineTotal, currency),
      images,
    };
  });

  const discount = subtotal - total;

  return {
    orderNumber,
    customerName: customer.customerName,
    mobile: customer.mobile,
    addressLine: customer.addressLine,
    city: customer.city,
    state: customer.state,
    pinCode: customer.pinCode,
    items,
    totals: {
      itemCount,
      currency,
      subtotal,
      subtotalFormatted: formatPrice(subtotal, currency),
      discount,
      discountFormatted: formatPrice(discount, currency),
      total,
      totalFormatted: formatPrice(total, currency),
    },
  };
}
