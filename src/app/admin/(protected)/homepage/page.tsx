import type { Metadata } from "next";

import { getHeroImageUrl } from "@/lib/supabase/site-settings";
import { PageHeader } from "@/components/admin/page-header";
import { SectionCard } from "@/components/admin/section-card";
import { HeroImageManager } from "@/components/admin/hero-image-manager";

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
      />

      <div className="mt-6 max-w-2xl">
        <SectionCard title="Hero image">
          <HeroImageManager initialUrl={heroImageUrl} />
        </SectionCard>
      </div>
    </div>
  );
}
