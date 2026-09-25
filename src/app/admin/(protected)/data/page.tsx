import type { Metadata } from "next";

import { PageHeader } from "@/components/admin/page-header";
import { DataToolbox } from "@/components/admin/data-toolbox";

export const metadata: Metadata = { title: "Data" };

/** Force dynamic: the page shells around live server actions only. */
export const dynamic = "force-dynamic";

/**
 * Admin data toolbox: export the full dataset (JSON bundle) or a single
 * table (CSV), and import a previously exported JSON bundle in merge or
 * replace mode. All reads/writes run through the admin session + RLS.
 */
export default function AdminDataPage() {
  return (
    <div>
      <PageHeader
        title="Data"
        description="Export a full backup or single tables; restore from a previous export."
      />
      <DataToolbox />
    </div>
  );
}
