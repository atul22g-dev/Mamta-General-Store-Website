import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";

import { getProductBySlug, getRelatedProducts } from "@/lib/supabase/catalog";
import { siteUrl } from "@/config/site";
import { Container } from "@/components/ui/container";
import { ProductCard } from "@/components/product/product-card";
import { ProductGallery } from "@/components/product/product-gallery";
import { PurchasePanel } from "@/components/product/purchase-panel";

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

/** Product pages render per request so fresh stock/price is always shown. */
export const dynamic = "force-dynamic";

/** Product structured data — rich results (price, availability) in search. */
function ProductJsonLd({
  product,
}: {
  product: NonNullable<Awaited<ReturnType<typeof getProductBySlug>>>;
}) {
  const data = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description ?? undefined,
    sku: product.sku ?? product.id,
    image: product.images.map((image) => image.url),
    category: product.category.name,
    offers: {
      "@type": "Offer",
      url: `${siteUrl}/products/${product.slug}`,
      priceCurrency: "INR",
      price: (product.price / 100).toFixed(2),
      availability:
        product.stock === null || product.stock > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}

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
    <Container className="flex flex-1 flex-col py-8 pb-28 sm:py-12 lg:pb-12">
      <ProductJsonLd product={product} />
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
          <PurchasePanel product={product} className="mt-8" />
        </div>
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
