"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import type { NavItem } from "@/config/navigation";

type NavLinkProps = {
  item: NavItem;
  className?: string;
} & Omit<React.ComponentProps<typeof Link>, "href">;

/**
 * Navigation link with active-route styling, shared by the desktop header and
 * the mobile menu so both stay visually consistent. Extra props (e.g. the
 * onClick that Radix's SheetClose attaches) are forwarded to the underlying
 * Link — required for "close menu on navigate" to work.
 */
export function NavLink({ item, className, ...props }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

  return (
    <Link
      href={item.href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "transition-colors duration-200 ease-gentle hover:text-foreground",
        isActive ? "text-foreground" : "text-muted-foreground",
        className,
      )}
      {...props}
    >
      {item.label}
    </Link>
  );
}
