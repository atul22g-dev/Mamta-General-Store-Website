import Link from "next/link";
import { ArrowRight, MessageCircle, Phone } from "lucide-react";

import { DELIVERY_NOTE, siteContact } from "@/config/site";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";

const steps = [
  {
    title: "Contact us",
    description: "Tell us which dress material you like — by phone or WhatsApp.",
  },
  {
    title: "Check availability",
    description: "We confirm the fabric is in stock and reserve it for you.",
  },
  {
    title: "Confirm price & delivery",
    description: "We share the price and the shipping details for your area.",
  },
  {
    title: "Dispatch by India Post",
    description: "Your order is packed and sent — tracking shared when available.",
  },
] as const;

/**
 * "Delivery Available" — the simple India Post story for out-of-area
 * customers. No delivery-time or charge claims: those come only from the
 * shop when confirming each order.
 */
export function DeliveryBand() {
  return (
    <section
      id="delivery"
      className="border-t bg-secondary/40 py-16 sm:py-20"
      aria-labelledby="delivery-heading"
    >
      <Container>
        <SectionHeading
          align="center"
          eyebrow="Delivery Available"
          title="Can't visit our shop? We'll send it by India Post."
          description={`${DELIVERY_NOTE} — anywhere in India. Ordering from outside the area is simple:`}
        />

        <ol className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <li key={step.title} className="flex flex-col items-center text-center">
              <span
                aria-hidden="true"
                className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-full text-sm font-semibold"
              >
                {index + 1}
              </span>
              <h3 className="mt-3 text-sm font-semibold">{step.title}</h3>
              <p className="text-muted-foreground mt-1.5 max-w-[28ch] text-sm leading-relaxed">
                {step.description}
              </p>
            </li>
          ))}
        </ol>

        <div className="mt-12 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {siteContact.whatsappUrl && (
            <Button asChild className="w-full sm:w-auto">
              <a href={siteContact.whatsappUrl} target="_blank" rel="noopener noreferrer">
                <MessageCircle />
                WhatsApp us
              </a>
            </Button>
          )}
          {siteContact.phone && (
            <Button variant="outline" asChild className="w-full sm:w-auto">
              <a href={`tel:${siteContact.phone}`}>
                <Phone />
                Call the shop
              </a>
            </Button>
          )}
          <Button variant="ghost" asChild className="w-full sm:w-auto">
            <Link href="/delivery">
              Delivery details
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </Container>
    </section>
  );
}
