"use client";

import * as React from "react";
import Link from "next/link";
import { Eye, EyeOff, Loader2, Pencil, Star, Trash2 } from "lucide-react";
import { useTransition } from "react";

import {
  deleteProductAction,
  toggleProductActiveAction,
  toggleProductFeaturedAction,
} from "@/app/admin/products/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

const iconButton =
  "text-muted-foreground hover:text-foreground hover:bg-accent inline-flex size-8 items-center justify-center rounded-md transition-colors disabled:opacity-50";

function RowButton({
  title,
  onClick,
  disabled,
  children,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={iconButton}
    >
      {children}
    </button>
  );
}

/**
 * Product row actions. Deletion requires explicit confirmation via an
 * alert dialog naming the product; the destructive server action is only
 * dispatched after confirmation.
 */
export function ProductRowActions({
  id,
  name,
  active,
  featured,
}: {
  id: string;
  name: string;
  active: boolean;
  featured: boolean;
}) {
  const [pendingDelete, startDelete] = useTransition();
  const [pendingToggle, startToggle] = useTransition();

  const toggle = (action: typeof toggleProductActiveAction, next: boolean, idValue: string) => {
    startToggle(() => {
      const data = new FormData();
      data.set("id", idValue);
      data.set("next", String(next));
      void action(data);
    });
  };

  return (
    <div className="flex items-center justify-end gap-0.5">
      <RowButton
        title={featured ? "Remove from featured" : "Mark as featured"}
        disabled={pendingToggle}
        onClick={() => toggle(toggleProductFeaturedAction, !featured, id)}
      >
        <Star
          aria-hidden="true"
          className={cn("size-4", featured && "fill-current text-amber-500")}
        />
      </RowButton>

      <RowButton
        title={active ? "Deactivate" : "Activate"}
        disabled={pendingToggle}
        onClick={() => toggle(toggleProductActiveAction, !active, id)}
      >
        {active ? (
          <EyeOff aria-hidden="true" className="size-4" />
        ) : (
          <Eye aria-hidden="true" className="size-4" />
        )}
      </RowButton>

      <Link
        href={`/admin/products/${id}/edit`}
        title="Edit"
        aria-label={`Edit ${name}`}
        className={iconButton}
      >
        <Pencil aria-hidden="true" className="size-4" />
      </Link>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button
            type="button"
            title="Delete"
            aria-label={`Delete ${name}`}
            disabled={pendingDelete}
            className={cn(iconButton, "hover:text-destructive")}
          >
            {pendingDelete ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <Trash2 aria-hidden="true" className="size-4" />
            )}
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the product and its images. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={(event) => {
                event.preventDefault();
                const data = new FormData();
                data.set("id", id);
                startDelete(() => void deleteProductAction(data));
              }}
            >
              {pendingDelete ? "Deleting…" : "Delete product"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
