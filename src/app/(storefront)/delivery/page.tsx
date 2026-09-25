import type { Metadata } from "next";
import { MessageCircle, PackageCheck, Phone } from "lucide-react";

import { DELIVERY_NOTE, siteContact } from "@/config/site";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";

export const metadata: Metadata = {
  title: "Delivery",
  description: `${DELIVERY_NOTE} — order unstitched dress materials from Mamta General Store, Jatwar from anywhere in India. Simple ordering by phone or WhatsApp.`,
};

const steps = [
  {
    title: "Contact us with your product",
    description:
      "Tell us which dress material you want — send a photo or the product name from this website by phone or WhatsApp.",
  },
  {
    title: "We confirm availability",
    description:
      "We check the fabric is in stock and let you know right away. If it's sold out, we'll suggest similar options.",
  },
  {
    title: "Confirm price and delivery details",
    description:
      "We confirm the price and the shipping cost for your PIN code before you commit to anything.",
  },
  {
    title: "Share your shipping address",
    description:
      "Give us your name, mobile number and full address — the same details you'd write on a Post parcel.",
  },
  {
    title: "We prepare and dispatch",
    description: "Your dress material is packed carefully and sent through India Post.",
  },
  {
    title: "Tracking shared when available",
    description:
      "If the booking provides tracking details, we share them with you so you can follow the parcel.",
  },
] as const;

/** "Delivery Available" — the honest, simple India Post ordering guide. */
export default function DeliveryPage() {
  return (
    <Container className="flex-1 py-16 sm:py-20">
      <SectionHeading
        align="center"
        eyebrow="Delivery Available"
        title="Can't visit our shop? We'll send it by India Post."
        description="We serve customers far beyond Jatwar. Here's exactly how ordering from outside the area works — no account, no online payment needed."
      />

      <ol className="mx-auto mt-14 max-w-2xl space-y-8">
        {steps.map((step, index) => (
          <li key={step.title} className="flex gap-4">
            <span
              aria-hidden="true"
              className="bg-primary text-primary-foreground flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
            >
              {index + 1}
            </span>
            <div>
              <h2 className="text-sm font-semibold">{step.title}</h2>
              <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                {step.description}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <div className="bg-card mx-auto mt-14 max-w-2xl rounded-2xl border p-6 shadow-soft">
        <p className="flex items-center gap-2 text-sm font-medium">
          <PackageCheck aria-hidden="true" className="size-4" />
          {DELIVERY_NOTE}
        </p>
        <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
          Delivery times and charges depend on your location and India Post&apos;s service — we
          confirm both with you before dispatch, so there are never surprises.
        </p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          {siteContact.whatsappUrl && (
            <Button asChild className="w-full sm:w-auto">
              <a href={siteContact.whatsappUrl} target="_blank" rel="noopener noreferrer">
                <MessageCircle />
                WhatsApp the shop
              </a>
            </Button>
          )}
          {siteContact.phone && (
            <Button variant="outline" asChild className="w-full sm:w-auto">
              <a href={`tel:${siteContact.phone}`}>
                <Phone />
                Call {siteContact.phone}
              </a>
            </Button>
          )}
        </div>
      </div>
    </Container>
  );
}
