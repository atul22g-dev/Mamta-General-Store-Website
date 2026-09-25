"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  MessageCircle,
  Minus,
  Phone,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Truck,
  Zap,
} from "lucide-react";

import type { Product } from "@/types/product";
import { useCart } from "@/components/cart/cart-provider";
import { discountPercent, isAvailable } from "@/lib/catalog";
import { siteContact } from "@/config/site";
import { DEFAULT_CURRENCY } from "@/lib/constants";
import { cn, formatPrice } from "@/lib/utils";
import { Button } from "@/components/ui/button";

function OptionButton({
  selected,
  disabled,
  onClick,
  children,
  className,
  ...props
}: {
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
} & Omit<React.ComponentProps<"button">, "onClick" | "disabled">) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-all duration-200 ease-gentle outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-40",
        selected
          ? "border-primary bg-primary text-primary-foreground shadow-xs"
          : "bg-background hover:border-ring/60 hover:bg-accent/50",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/** Price, struck-through original, savings callout and the tax note. */
function PriceBlock({
  product,
  discount,
}: {
  product: Product;
  /** Null when the product has no discount. */
  discount: number | null;
}) {
  const hasDiscount = Boolean(product.discountPrice && product.discountPrice > product.price);

  return (
    <div className="space-y-1.5">
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-display text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl">
          {formatPrice(product.price, DEFAULT_CURRENCY)}
        </span>
        {hasDiscount && (
          <span className="text-lg text-muted-foreground line-through tabular-nums">
            {formatPrice(product.discountPrice!, DEFAULT_CURRENCY)}
          </span>
        )}
        {hasDiscount && (
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
            {discount}% off
          </span>
        )}
      </p>
      {hasDiscount && (
        <p className="text-sm font-medium text-emerald-700">
          You save {formatPrice(product.discountPrice! - product.price, DEFAULT_CURRENCY)}
        </p>
      )}
      <p className="text-xs text-muted-foreground">Inclusive of all taxes · {DEFAULT_CURRENCY}</p>
    </div>
  );
}

/** Size radio group with its "select a size" prompt. */
function SizePicker({
  sizes,
  needsSize,
  selectedSize,
  onSelect,
}: {
  sizes: Product["sizes"];
  needsSize: boolean;
  selectedSize: string | null;
  onSelect: (id: string) => void;
}) {
  if (sizes.length === 0) return null;

  return (
    <div>
      <div className="flex items-baseline justify-between pb-2.5">
        <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">Size</p>
        {needsSize && !selectedSize && (
          <p className="text-xs text-muted-foreground">Select a size</p>
        )}
      </div>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Select size">
        {sizes.map((size) => (
          <OptionButton
            key={size.id}
            selected={selectedSize === size.id}
            onClick={() => onSelect(size.id)}
            aria-label={`Size ${size.label}`}
          >
            {size.label}
          </OptionButton>
        ))}
      </div>
    </div>
  );
}

/** Color radio group with swatches and its "select a color" prompt. */
function ColorPicker({
  colors,
  needsColor,
  selectedColor,
  onSelect,
}: {
  colors: Product["colors"];
  needsColor: boolean;
  selectedColor: string | null;
  onSelect: (id: string) => void;
}) {
  if (colors.length === 0) return null;

  return (
    <div>
      <div className="flex items-baseline justify-between pb-2.5">
        <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">Color</p>
        {needsColor && !selectedColor && (
          <p className="text-xs text-muted-foreground">Select a color</p>
        )}
      </div>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Select color">
        {colors.map((color) => (
          <OptionButton
            key={color.id}
            selected={selectedColor === color.id}
            onClick={() => onSelect(color.id)}
            aria-label={`Color ${color.name}`}
          >
            {color.hex && (
              <span
                aria-hidden="true"
                className="size-3.5 rounded-full border"
                style={{ backgroundColor: color.hex }}
              />
            )}
            {color.name}
          </OptionButton>
        ))}
      </div>
    </div>
  );
}

/** Quantity stepper — bordered control with generous touch targets. */
function QuantityStepper({
  quantity,
  maxQuantity,
  available,
  onDecrease,
  onIncrease,
}: {
  quantity: number;
  maxQuantity: number;
  available: boolean;
  onDecrease: () => void;
  onIncrease: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
        Quantity
      </p>
      <div className="flex items-center rounded-full border">
        <button
          type="button"
          aria-label="Decrease quantity"
          className="focus-visible:ring-ring/50 flex size-10 items-center justify-center rounded-l-full transition-colors hover:bg-accent/60 focus-visible:ring-[3px] focus-visible:outline-none disabled:opacity-40"
          onClick={onDecrease}
          disabled={quantity <= 1 || !available}
        >
          <Minus className="size-4" />
        </button>
        <span
          aria-live="polite"
          aria-label={`Quantity: ${quantity}`}
          className="w-10 text-center text-sm font-semibold tabular-nums"
        >
          {quantity}
        </span>
        <button
          type="button"
          aria-label="Increase quantity"
          className="focus-visible:ring-ring/50 flex size-10 items-center justify-center rounded-r-full transition-colors hover:bg-accent/60 focus-visible:ring-[3px] focus-visible:outline-none disabled:opacity-40"
          onClick={onIncrease}
          disabled={quantity >= maxQuantity || !available}
        >
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  );
}

/** Quiet reassurance strip: delivery, easy payment, quality checks. */
function TrustStrip() {
  const items = [
    { icon: Truck, label: "India Post delivery" },
    { icon: ShieldCheck, label: "Quality checked" },
    { icon: MessageCircle, label: "Easy phone ordering" },
  ];

  return (
    <ul className="grid grid-cols-3 gap-2 rounded-xl border bg-secondary/40 px-2 py-3">
      {items.map(({ icon: Icon, label }) => (
        <li
          key={label}
          className="flex flex-col items-center gap-1.5 text-center text-[11px] font-medium text-muted-foreground"
        >
          <Icon aria-hidden="true" className="size-4 shrink-0 text-foreground/70" />
          {label}
        </li>
      ))}
    </ul>
  );
}

/**
 * "Interested in this product?" — direct contact actions for customers who
 * prefer to ask before ordering (or when the item is out of stock). Local
 * visitors call/WhatsApp; out-of-area visitors ask about India Post delivery.
 */
function ContactOrderBlock({
  productName,
  unavailable,
}: {
  productName: string;
  unavailable: boolean;
}) {
  const askMessage = encodeURIComponent(
    `Hello! I'm interested in "${productName}" from Mamta General Store. Is it available?`,
  );
  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <p className="text-sm leading-relaxed">
        Interested in this product? Contact us to check availability and place your order.
      </p>
      <div className="flex flex-col gap-2.5 sm:flex-row">
        {siteContact.whatsappUrl && (
          <Button variant="outline" size="sm" asChild className="flex-1">
            <a
              href={`${siteContact.whatsappUrl}?text=${askMessage}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle />
              WhatsApp
            </a>
          </Button>
        )}
        {siteContact.phone && (
          <Button variant="outline" size="sm" asChild className="flex-1">
            <a href={`tel:${siteContact.phone}`}>
              <Phone />
              Call Shop
            </a>
          </Button>
        )}
      </div>
      <p className="text-muted-foreground text-xs">
        {unavailable
          ? "Out of stock right now — ask us and we'll tell you when it's back or suggest something similar."
          : "Ordering from outside the area? We deliver across India by India Post."}
      </p>
    </div>
  );
}

/** Add to Cart (with the added confirmation) and Buy Now buttons. */
function CartActions({
  added,
  canAdd,
  onAddToCart,
  onBuyNow,
}: {
  added: boolean;
  canAdd: boolean;
  onAddToCart: () => void;
  onBuyNow: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <Button size="lg" className="h-12 flex-1 text-base" disabled={!canAdd} onClick={onAddToCart}>
        {added ? <Check /> : <ShoppingBag />}
        {added ? "Added to cart" : "Add to Cart"}
      </Button>
      <Button
        size="lg"
        variant="outline"
        className="h-12 flex-1 text-base"
        disabled={!canAdd}
        onClick={onBuyNow}
      >
        <Zap />
        Buy Now
      </Button>
    </div>
  );
}

/**
 * Product purchase panel: modern price block with savings callout, pill-style
 * size/color pickers, quantity selector, trust strip and Add to Cart /
 * Buy Now actions. State and cart wiring live here; the sections are
 * presentational.
 */
export function PurchasePanel({ product, className }: { product: Product; className?: string }) {
  const available = isAvailable(product);
  const discount = discountPercent(product);

  const [selectedSize, setSelectedSize] = React.useState<string | null>(
    product.sizes.length === 1 ? (product.sizes[0]?.id ?? null) : null,
  );
  const [selectedColor, setSelectedColor] = React.useState<string | null>(
    product.colors.length === 1 ? (product.colors[0]?.id ?? null) : null,
  );
  const [quantity, setQuantity] = React.useState(1);
  const [added, setAdded] = React.useState(false);
  const { addItem } = useCart();
  const router = useRouter();

  const needsSize = product.sizes.length > 1;
  const needsColor = product.colors.length > 1;
  const canAdd = Boolean(
    available && (!needsSize || selectedSize) && (!needsColor || selectedColor),
  );

  const size = product.sizes.find((s) => s.id === selectedSize) ?? null;
  const color = product.colors.find((c) => c.id === selectedColor) ?? null;
  const maxQuantity = product.stock === null ? 10 : Math.min(product.stock, 10);

  const dispatchToCart = React.useCallback(() => {
    addItem({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      unitPrice: product.price,
      imageUrl: product.images[0]?.url ?? null,
      sizeId: size?.id ?? null,
      sizeLabel: size?.label ?? null,
      colorId: color?.id ?? null,
      colorName: color?.name ?? null,
      quantity,
      maxQuantity: product.stock,
    });
  }, [addItem, product, size, color, quantity]);

  const handleAddToCart = () => {
    if (!canAdd) return;
    dispatchToCart();
    setAdded(true);
    window.setTimeout(() => setAdded(false), 2000);
  };

  const handleBuyNow = () => {
    if (!canAdd) return;
    dispatchToCart();
    router.push("/checkout");
  };

  const hasVariants = product.sizes.length > 0 || product.colors.length > 0;

  return (
    <div className={cn("space-y-6", className)}>
      <PriceBlock product={product} discount={discount} />

      {hasVariants && (
        <div className="space-y-5 border-t pt-6">
          <SizePicker
            sizes={product.sizes}
            needsSize={needsSize}
            selectedSize={selectedSize}
            onSelect={setSelectedSize}
          />
          <ColorPicker
            colors={product.colors}
            needsColor={needsColor}
            selectedColor={selectedColor}
            onSelect={setSelectedColor}
          />
        </div>
      )}

      <div className="space-y-5 border-t pt-6">
        <QuantityStepper
          quantity={quantity}
          maxQuantity={maxQuantity}
          available={available}
          onDecrease={() => setQuantity((q) => Math.max(1, q - 1))}
          onIncrease={() => setQuantity((q) => Math.min(maxQuantity, q + 1))}
        />

        <CartActions
          added={added}
          canAdd={canAdd}
          onAddToCart={handleAddToCart}
          onBuyNow={handleBuyNow}
        />

        <TrustStrip />
      </div>

      <ContactOrderBlock productName={product.name} unavailable={!available} />
    </div>
  );
}
