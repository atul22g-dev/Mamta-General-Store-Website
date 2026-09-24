"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Package, ReceiptText, Tag } from "lucide-react";

import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/categories", label: "Categories", icon: Tag },
  { href: "/admin/orders", label: "Orders", icon: ReceiptText },
] as const;

/**
 * Admin primary navigation with active-route highlighting. Rendered in the
 * protected layout header (desktop row) and reused for mobile.
 */
export function AdminNav({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin" className={cn("items-center gap-1", className)}>
      {LINKS.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);

        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
              active
                ? "bg-accent text-accent-foreground font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/60",
            )}
          >
            <Icon aria-hidden="true" className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
