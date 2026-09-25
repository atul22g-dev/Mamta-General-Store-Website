import type { Metadata } from "next";

import { CheckoutForm } from "@/components/cart/checkout-form";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Complete your order at Mamta General Store.",
  alternates: { canonical: "/checkout" },
  robots: { index: false, follow: false },
};

export default function CheckoutPage() {
  return (
    <Container className="flex flex-1 flex-col py-10 sm:py-14">
      <h1 className="font-display mb-8 text-3xl font-semibold tracking-tight sm:text-4xl">
        Checkout
      </h1>
      <CheckoutForm />
    </Container>
  );
}
