"use client";

import Link from "next/link";
import { Menu, ShoppingBag } from "lucide-react";

import { mainNav, type NavItem } from "@/config/navigation";
import { CartButton } from "@/components/cart/cart-button";
import { SITE_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { MobileNav } from "@/components/layout/mobile-nav";
import { NavLink } from "@/components/layout/nav-link";

/**
 * Sticky site header.
 *
 * Desktop: brand, primary nav, Shop Now + cart actions.
 * Mobile: menu button, brand, cart button — the hamburger opens a clean
 * full navigation sheet.
 */
export function SiteHeader({ className }: { className?: string }) {
  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60",
        className,
      )}
    >
      <Container>
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Mobile: menu button */}
          <div className="lg:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Open navigation menu">
                  <Menu />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80">
                <SheetHeader>
                  <SheetTitle className="font-display text-lg">{SITE_NAME}</SheetTitle>
                  <SheetDescription className="sr-only">Site navigation</SheetDescription>
                </SheetHeader>
                <MobileNav />
              </SheetContent>
            </Sheet>
          </div>

          {/* Brand */}
          <Link
            href="/"
            className="absolute left-1/2 -translate-x-1/2 font-display text-lg font-medium tracking-tight transition-opacity hover:opacity-80 sm:static sm:translate-x-0 lg:mr-8"
          >
            {SITE_NAME}
          </Link>

          {/* Desktop nav */}
          <nav aria-label="Main navigation" className="hidden flex-1 items-center gap-6 lg:flex">
            {mainNav.map((item: NavItem) => (
              <NavLink key={item.href} item={item} className="text-sm" />
            ))}
          </nav>

          {/* Actions: clear Shop Now CTA + cart */}
          <div className="flex items-center gap-2">
            <Button size="sm" asChild className="hidden md:inline-flex">
              <Link href="/shop">
                <ShoppingBag aria-hidden="true" />
                Shop Now
              </Link>
            </Button>
            <CartButton />
          </div>
        </div>
      </Container>
    </header>
  );
}
