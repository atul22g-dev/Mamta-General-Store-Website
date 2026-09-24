import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChevronRight, Package, Phone, Truck } from "lucide-react";

import { getProductBySlug, getRelatedProducts } from "@/lib/supabase/catalog";
import { DELIVERY_NOTE } from "@/config/site";
import { Container } from "@/components/ui/container";
import { ProductCard } from "@/components/product/product-card";
import { ProductGallery } from "@/components/product/product-gallery";
import { PurchasePanel } from "@/components/product/purchase-panel";

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

/** Product pages render per request so fresh stock/price is always shown. */
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Product not found" };

  const description = product.description ?? `Shop ${product.name} at Mamta General Store.`;

  return {
    title: product.name,
    description,
    openGraph: {
      title: product.name,
      description,
      type: "website",
      images: product.images[0]
        ? [{ url: product.images[0].url, alt: product.images[0].alt ?? product.name }]
        : undefined,
    },
    alternates: { canonical: `/products/${product.slug}` },
  };
}

/** Product detail page: gallery + purchase panel + description + related. */
export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;

  let product: Awaited<ReturnType<typeof getProductBySlug>> = null;
  let related: Awaited<ReturnType<typeof getRelatedProducts>> = [];
  let dbUnavailable = false;
  try {
    product = await getProductBySlug(slug);
    if (product) {
      related = await getRelatedProducts(product, 4);
    }
  } catch {
    // Database unreachable — show a friendly, retryable state.
    dbUnavailable = true;
  }

  if (dbUnavailable) {
    return (
      <Container className="flex flex-1 flex-col items-center justify-center py-24 text-center">
        <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
          Be right back
        </p>
        <h1 className="font-display mt-3 text-2xl font-medium tracking-tight">
          We couldn&apos;t load this product
        </h1>
        <p className="text-muted-foreground mt-3 max-w-md text-sm leading-relaxed">
          Our store is momentarily unavailable. Please refresh in a moment.
        </p>
      </Container>
    );
  }

  if (!product) notFound();

  return (
    <Container className="flex flex-1 flex-col py-8 sm:py-12">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-8">
        <ol className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <li>
            <Link href="/" className="transition-colors hover:text-foreground">
              Home
            </Link>
          </li>
          <ChevronRight aria-hidden="true" className="size-3" />
          <li>
            <Link
              href={`/category/${product.category.slug}`}
              className="transition-colors hover:text-foreground"
            >
              {product.category.name}
            </Link>
          </li>
          <ChevronRight aria-hidden="true" className="size-3" />
          <li aria-current="page" className="text-foreground">
            {product.name}
          </li>
        </ol>
      </nav>

      {/* Gallery + purchase */}
      <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
        <ProductGallery
          images={product.images}
          productName={product.name}
          className="lg:sticky lg:top-24 lg:self-start"
        />
        <div className="animate-fade-up">
          <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
            {product.category.name}
            {product.brand ? ` · ${product.brand}` : ""}
          </p>
          <h1 className="font-display mt-2 text-3xl leading-tight font-medium tracking-tight text-balance sm:text-4xl">
            {product.name}
          </h1>
          {product.sku && <p className="mt-2 text-xs text-muted-foreground">SKU: {product.sku}</p>}
          <PurchasePanel product={product} className="mt-8" />
        </div>
      </div>

      {/* Description + service notes */}
      <div className="mt-16 grid gap-10 lg:grid-cols-2 lg:gap-14">
        <section aria-labelledby="description-heading">
          <h2 id="description-heading" className="font-display text-xl font-medium">
            Product details
          </h2>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            {product.description ??
              "Details for this product are being updated. Visit the store or contact us for more information."}
          </p>
        </section>
        <section aria-labelledby="service-heading">
          <h2 id="service-heading" className="font-display text-xl font-medium">
            Good to know
          </h2>
          <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
            <li className="flex items-center gap-3">
              <Truck className="size-4 shrink-0" />
              {DELIVERY_NOTE} — contact us to order from anywhere in India.
            </li>
            <li className="flex items-center gap-3">
              <Package className="size-4 shrink-0" />
              Complete unstitched set — top, bottom and dupatta, ready for tailoring.
            </li>
            <li className="flex items-center gap-3">
              <Package className="size-4 shrink-0" />
              Hand-checked fabric, work and finish before dispatch.
            </li>
            <li className="flex items-center gap-3">
              <Phone className="size-4 shrink-0" />
              Questions? Call or WhatsApp the shop — details in the contact panel above.
            </li>
          </ul>
        </section>
      </div>

      {/* Related products */}
      {related.length > 0 && (
        <section aria-labelledby="related-heading" className="mt-20 border-t pt-14">
          <div className="flex items-end justify-between gap-4">
            <h2 id="related-heading" className="font-display text-2xl font-medium tracking-tight">
              You may also like
            </h2>
            <Link
              href={`/category/${product.category.slug}`}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              View all {product.category.name}
            </Link>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-4 sm:gap-6 xl:grid-cols-4">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      )}
    </Container>
  );
}
