"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getAdminSession } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface ChangePasswordState {
  error?: string;
  success?: string;
}

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: z
      .string()
      .min(8, "New password must be at least 8 characters.")
      .max(72, "New password must be at most 72 characters."),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "New passwords do not match.",
    path: ["confirmPassword"],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "The new password must be different from the current one.",
    path: ["newPassword"],
  });

/**
 * Change the signed-in admin's own password.
 *
 * The current password is verified by signing in with it before the update —
 * so a hijacked tab (or a distracted owner) cannot rotate the credential
 * without knowing it. Supabase Auth refreshes session cookies after the
 * update, so the admin stays signed in on every device they re-authenticate.
 */
export async function changePasswordAction(
  _prev: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const session = await getAdminSession();
  if (!session) throw new Error("Unauthorized");

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    const errors = z.flattenError(parsed.error).fieldErrors;
    return {
      error:
        errors.currentPassword?.[0] ??
        errors.newPassword?.[0] ??
        errors.confirmPassword?.[0] ??
        "Check the form.",
    };
  }

  const { currentPassword, newPassword } = parsed.data;
  const supabase = await createSupabaseServerClient();

  // 1. Verify the current password (signs in with the same credentials).
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: session.email,
    password: currentPassword,
  });
  if (verifyError) {
    return { error: "The current password is incorrect." };
  }

  // 2. Update to the new password (scoped to the caller's own session —
  //    no admin API and no service key involved).
  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
  if (updateError) {
    console.error("[change-password] update failed:", updateError.message);
    return { error: "Could not change the password. Please try again." };
  }

  revalidatePath("/admin", "layout");
  return { success: "Password changed successfully." };
}
