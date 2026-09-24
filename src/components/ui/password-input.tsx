"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

/**
 * Password input with a show/hide visibility toggle (eye icon). Behaves
 * exactly like Input otherwise; the toggle is a real button with a pressed
 * state and screen-reader labels, and never submits the form.
 */
function PasswordInput({ className, ...props }: Omit<React.ComponentProps<"input">, "type">) {
  const [visible, setVisible] = React.useState(false);

  return (
    <div className="relative">
      <Input type={visible ? "text" : "password"} className={cn("pr-10", className)} {...props} />
      <button
        type="button"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        onClick={() => setVisible((current) => !current)}
        className="text-muted-foreground hover:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 absolute top-1/2 right-1 flex size-8 -translate-y-1/2 items-center justify-center rounded-md outline-none focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50"
        tabIndex={0}
      >
        {visible ? (
          <EyeOff aria-hidden="true" className="size-4" />
        ) : (
          <Eye aria-hidden="true" className="size-4" />
        )}
      </button>
    </div>
  );
}

export { PasswordInput };
