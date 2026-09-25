import { cva, type VariantProps } from "class-variance-authority";

/**
 * Button variant styles — in their own non-component module so the Button
 * component file stays a Fast Refresh boundary (this file has no components).
 */
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium tracking-wide transition-all duration-200 ease-gentle outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 disabled:active:scale-100 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 [-webkit-tap-highlight-color:transparent]",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 active:bg-primary active:shadow-none",
        destructive:
          "bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90 active:bg-destructive",
        outline:
          "border bg-background shadow-xs hover:border-ring/60 hover:bg-accent/50 hover:text-accent-foreground active:bg-accent",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/70 active:bg-secondary/90",
        ghost: "hover:bg-accent/60 hover:text-accent-foreground active:bg-accent",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        // Mobile-first heights: ≥44px touch targets on phones, compact on
        // pointer devices (md:). min-height mirrors height so buttons keep
        // their size inside column flex layouts, where a child's `flex-1`
        // (flex-basis: 0%) would otherwise override `height` and collapse
        // the control to its text line.
        sm: "h-10 min-h-10 rounded-md px-4 text-xs has-[>svg]:px-3 md:h-9 md:min-h-9",
        default: "h-11 min-h-11 px-5 has-[>svg]:px-4 md:h-10 md:min-h-10",
        lg: "h-12 min-h-12 rounded-lg px-7 has-[>svg]:px-5 md:h-11 md:min-h-11",
        icon: "size-11 min-h-11 md:size-10 md:min-h-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export type ButtonVariants = VariantProps<typeof buttonVariants>;
