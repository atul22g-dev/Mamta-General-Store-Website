"use client";

import * as React from "react";
import { useActionState } from "react";
import { Eye, EyeOff, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";

import {
  createCategoryAction,
  deleteCategoryAction,
  toggleCategoryActiveAction,
  updateCategoryAction,
  type CategoryActionState,
} from "@/app/admin/categories/actions";
import type { AdminCategory } from "@/lib/supabase/admin-categories";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const initialState: CategoryActionState = {};

function Feedback({ state }: { state: CategoryActionState }) {
  if (state.error) {
    return (
      <p className="text-destructive mt-2 text-sm" role="alert">
        {state.error}
      </p>
    );
  }
  if (state.success) {
    return (
      <p className="text-emerald-600 mt-2 text-sm" role="status">
        {state.success}
      </p>
    );
  }
  return null;
}

/**
 * Admin category manager: create new categories (with storefront visibility),
 * rename/re-describe existing ones inline, hide/show and delete when allowed.
 * Storefront changes apply immediately — categories are data, not code.
 */
export function CategoryManager({ categories }: { categories: AdminCategory[] }) {
  const [createState, createAction, isCreating] = useActionState(
    createCategoryAction,
    initialState,
  );
  const [editState, editAction, isEditing] = useActionState(updateCategoryAction, initialState);
  const [editingId, setEditingId] = React.useState<string | null>(null);

  return (
    <div className="space-y-8">
      {/* Create */}
      <form action={createAction} className="border-border rounded-xl border border-dashed p-4">
        <p className="flex items-center gap-2 text-sm font-medium">
          <Plus className="size-4" />
          Add a category
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="new-name">Name *</Label>
            <Input id="new-name" name="name" placeholder="Festive Wear" required maxLength={60} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-slug">URL slug (optional)</Label>
            <Input id="new-slug" name="slug" placeholder="festive-wear" maxLength={60} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-image">Image URL (optional)</Label>
            <Input id="new-image" name="imageUrl" type="url" placeholder="https://…" />
          </div>
        </div>
        <div className="mt-3 space-y-1.5">
          <Label htmlFor="new-description">Short description (optional)</Label>
          <Input
            id="new-description"
            name="description"
            placeholder="Shown on the category tile and page."
            maxLength={300}
          />
        </div>
        <label className="mt-3 flex items-center gap-2.5 text-sm font-medium">
          <input
            type="checkbox"
            name="active"
            defaultChecked
            className="accent-[var(--primary)] size-4 rounded"
          />
          Visible on the storefront (hide to prepare it before launch)
        </label>
        <Feedback state={createState} />
        <Button type="submit" size="sm" className="mt-3" disabled={isCreating}>
          {isCreating ? <Loader2 className="animate-spin" /> : <Plus />}
          Create category
        </Button>
      </form>

      {/* List */}
      <ul className="divide-y rounded-xl border">
        {categories.map((category) => (
          <li key={category.id} className="p-4">
            {editingId === category.id ? (
              <form action={editAction} className="space-y-3">
                <input type="hidden" name="id" value={category.id} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor={`name-${category.id}`}>Name</Label>
                    <Input
                      id={`name-${category.id}`}
                      name="name"
                      defaultValue={category.name}
                      required
                      maxLength={60}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`image-${category.id}`}>Image URL</Label>
                    <Input
                      id={`image-${category.id}`}
                      name="imageUrl"
                      type="url"
                      defaultValue={category.imageUrl ?? ""}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`desc-${category.id}`}>Description</Label>
                  <Input
                    id={`desc-${category.id}`}
                    name="description"
                    defaultValue={category.description ?? ""}
                    maxLength={300}
                  />
                </div>
                <Feedback state={editState} />
                <div className="flex gap-2">
                  <Button type="submit" size="sm" disabled={isEditing}>
                    {isEditing ? <Loader2 className="animate-spin" /> : null}
                    Save
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditingId(null)}
                  >
                    <X />
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-medium">
                    <span className="truncate">{category.name}</span>
                    <Badge variant="secondary">{category.productCount} products</Badge>
                    {category.active ? (
                      <Badge className="bg-emerald-100 text-emerald-700">Active</Badge>
                    ) : (
                      <Badge variant="outline">Inactive</Badge>
                    )}
                  </p>
                  <p className="text-muted-foreground mt-0.5 truncate text-xs">
                    /category/{category.slug}
                    {category.description ? ` — ${category.description}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <form action={toggleCategoryActiveAction}>
                    <input type="hidden" name="id" value={category.id} />
                    <input type="hidden" name="next" value={category.active ? "false" : "true"} />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="sm"
                      aria-label={
                        category.active
                          ? `Hide ${category.name} from the storefront`
                          : `Show ${category.name} on the storefront`
                      }
                    >
                      {category.active ? <EyeOff /> : <Eye />}
                      {category.active ? "Hide" : "Show"}
                    </Button>
                  </form>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingId(category.id)}
                    aria-label={`Edit ${category.name}`}
                  >
                    <Pencil />
                    Edit
                  </Button>
                  <form
                    action={deleteCategoryAction}
                    onSubmit={(event) => {
                      if (!window.confirm(`Delete category “${category.name}”?`)) {
                        event.preventDefault();
                      }
                    }}
                  >
                    <input type="hidden" name="id" value={category.id} />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-destructive"
                      aria-label={`Delete ${category.name}`}
                    >
                      <Trash2 />
                      Delete
                    </Button>
                  </form>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
      {categories.length === 0 && (
        <p className={cn("text-muted-foreground text-sm")}>
          No categories yet — create the first one above.
        </p>
      )}
    </div>
  );
}
