import { cva, type VariantProps } from "class-variance-authority";

/**
 * Button variant styles — in their own non-component module so the Button
 * component file stays a Fast Refresh boundary (this file has no components).
 */
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium tracking-wide transition-all duration-200 ease-gentle outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 active:bg-primary",
        destructive: "bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90",
        outline:
          "border bg-background shadow-xs hover:border-ring/60 hover:bg-accent/50 hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/70",
        ghost: "hover:bg-accent/60 hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        // Mobile-first heights: ≥44px touch targets on phones, compact on
        // pointer devices (md:) — comfortable tapping without desktop sprawl.
        sm: "h-10 rounded-md px-4 text-xs has-[>svg]:px-3 md:h-9",
        default: "h-11 px-5 has-[>svg]:px-4 md:h-10",
        lg: "h-12 rounded-lg px-7 has-[>svg]:px-5 md:h-11",
        icon: "size-11 md:size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export type ButtonVariants = VariantProps<typeof buttonVariants>;
