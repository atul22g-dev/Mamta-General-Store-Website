import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, ImageIcon, ListOrdered } from "lucide-react";

import { getHeroImageUrl } from "@/lib/supabase/site-settings";
import { PageHeader } from "@/components/admin/page-header";
import { SectionCard } from "@/components/admin/section-card";
import { HeroImageManager } from "@/components/admin/hero-image-manager";
import { buttonVariants } from "@/components/ui/button-variants";

export const metadata: Metadata = { title: "Homepage" };
export const dynamic = "force-dynamic";

/**
 * Homepage settings — currently the hero image. The image the storefront
 * shows (or its graceful placeholder) is fully admin-controlled here.
 */
export default async function AdminHomepagePage() {
  const heroImageUrl = await getHeroImageUrl().catch(() => null);

  return (
    <div>
      <PageHeader
        title="Homepage"
        description="Control what visitors see on the storefront's front page."
      >
        <Link href="/" target="_blank" rel="noopener" className={buttonVariants({ variant: "outline", size: "sm" })}>
          <ExternalLink aria-hidden="true" className="size-4" />
          View storefront
        </Link>
      </PageHeader>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <SectionCard title="Hero image">
          <HeroImageManager initialUrl={heroImageUrl} />
        </SectionCard>

        <aside className="space-y-6">
          <SectionCard title="Which photo shows">
            <ol className="text-muted-foreground space-y-3 text-sm">
              {[
                "The photo you upload here — always wins.",
                "The newest product's first photo, when no custom photo is set.",
                "A built-in placeholder, while the catalog is empty.",
              ].map((line, index) => (
                <li key={line} className="flex gap-2.5">
                  <span className="bg-accent text-foreground inline-flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                    {index + 1}
                  </span>
                  <span>{line}</span>
                </li>
              ))}
            </ol>
          </SectionCard>

          <SectionCard title="Photo tips">
            <ul className="text-muted-foreground space-y-2.5 text-sm">
              <li className="flex gap-2.5">
                <ImageIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                <span>
                  Use a <strong className="text-foreground font-medium">wide, well-lit</strong>{" "}
                  photo — it fills the top of the homepage.
                </span>
              </li>
              <li className="flex gap-2.5">
                <ListOrdered aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                <span>
                  Large photos are compressed automatically; keep the original under 25&nbsp;MB.
                </span>
              </li>
              <li className="flex gap-2.5">
                <ExternalLink aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                <span>
                  Changes go live immediately — open the storefront to confirm.
                </span>
              </li>
            </ul>
          </SectionCard>
        </aside>
      </div>
    </div>
  );
}
