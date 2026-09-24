"use client";

import { categoryNav, mainNav } from "@/config/navigation";
import { SheetClose } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { NavLink } from "@/components/layout/nav-link";

/**
 * Mobile navigation menu content: primary links, then categories.
 * Rendered inside the header's sheet; each link is a dialog close target
 * (`SheetClose asChild` renders a single anchor), so tapping a link closes
 * the menu and navigates in one interaction.
 */
export function MobileNav() {
  return (
    <nav aria-label="Mobile navigation" className="flex flex-1 flex-col overflow-y-auto px-4 pb-6">
      <ul className="space-y-1">
        {mainNav.map((item) => (
          <li key={item.href}>
            {" "}
            <SheetClose asChild>
              <NavLink
                item={item}
                className="block rounded-lg px-3 py-2.5 text-base hover:bg-accent/60"
              />
            </SheetClose>
          </li>
        ))}
      </ul>

      {categoryNav.length > 0 && (
        <>
          <Separator className="my-4" />
          <p className="px-3 pb-2 text-xs font-medium tracking-widest text-muted-foreground uppercase">
            Categories
          </p>
          <ul className="space-y-1">
            {categoryNav.map((item) => (
              <li key={item.href}>
                <SheetClose asChild>
                  <NavLink
                    item={item}
                    className="block rounded-lg px-3 py-2.5 text-base hover:bg-accent/60"
                  />
                </SheetClose>
              </li>
            ))}
          </ul>
        </>
      )}
    </nav>
  );
}
