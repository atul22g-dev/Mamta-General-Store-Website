import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { getAdminProduct, getAdminProductImages } from "@/lib/supabase/admin-products";
import { getCategoryOptions } from "@/lib/supabase/catalog";
import { PageHeader } from "@/components/admin/page-header";
import { ProductForm } from "@/components/admin/product-form";
import { ProductImagesManager } from "@/components/admin/product-images-manager";
import { DatabaseErrorState } from "@/components/admin/empty-state";

export const metadata: Metadata = { title: "Edit product" };
export const dynamic = "force-dynamic";

interface EditProductPageProps {
  params: Promise<{ id: string }>;
}

/** Edit-product page. Unknown ids 404 inside the admin shell. */
export default async function EditProductPage({ params }: EditProductPageProps) {
  const { id } = await params;

  let product = null;
  let categories: { id: string; name: string }[] = [];
  let productImages: Awaited<ReturnType<typeof getAdminProductImages>> = [];
  let dbAvailable = true;

  try {
    [product, categories, productImages] = await Promise.all([
      getAdminProduct(id),
      getCategoryOptions(),
      getAdminProductImages(id),
    ]);
  } catch {
    dbAvailable = false;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/admin/products"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm transition-colors"
      >
        <ChevronLeft aria-hidden="true" className="size-4" />
        Products
      </Link>

      {!dbAvailable ? (
        <>
          <PageHeader title="Edit product" />
          <div className="bg-card rounded-xl border shadow-soft">
            <DatabaseErrorState />
          </div>
        </>
      ) : !product ? (
        notFound()
      ) : (
        <>
          <PageHeader
            title={product.name}
            description={`Editing “${product.slug}” — changes appear on the storefront after saving.`}
          />
          <div className="bg-card rounded-xl border p-6 shadow-soft sm:p-8">
            <ProductForm categories={categories} product={product} />
          </div>
          <div className="bg-card mt-6 rounded-xl border p-6 shadow-soft sm:p-8">
            <ProductImagesManager
              productId={product.id}
              productName={product.name}
              images={productImages}
            />
          </div>
        </>
      )}
    </div>
  );
}
