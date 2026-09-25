import type { Metadata } from "next";

import { CartView } from "@/components/cart/cart-view";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = {
  title: "Cart",
  description: "Your shopping cart at Mamta General Store.",
  alternates: { canonical: "/cart" },
  robots: { index: false, follow: false },
};

export default function CartPage() {
  return (
    <Container className="flex flex-1 flex-col pt-10 pb-36 sm:pb-14 lg:pb-14">
      <h1 className="font-display mb-8 text-3xl font-semibold tracking-tight sm:text-4xl">
        Your cart
      </h1>
      <CartView />
    </Container>
  );
}
