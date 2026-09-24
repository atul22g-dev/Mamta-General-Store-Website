"use client";

import * as React from "react";
import { useActionState } from "react";
import { Loader2, Lock } from "lucide-react";

import { loginAction } from "@/app/admin/login/actions";
import type { LoginActionState } from "@/app/admin/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";

const initialState: LoginActionState = {};

/**
 * Admin login form. Client-side validation gives instant feedback; the
 * server action re-validates and performs the real credential check.
 */
export function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const [state, formAction, isPending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <input type="hidden" name="redirectTo" value={redirectTo ?? ""} />

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="admin@example.com"
          required
          aria-invalid={Boolean(state.error)}
          aria-describedby={state.error ? "login-error" : undefined}
          className="h-11"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="current-password"
          placeholder="••••••••"
          required
          minLength={8}
          aria-invalid={Boolean(state.error)}
          aria-describedby={state.error ? "login-error" : undefined}
          className="h-11"
        />
      </div>

      {state.error && (
        <p
          id="login-error"
          role="alert"
          className="text-destructive flex items-start gap-2 text-sm"
        >
          <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {state.error}
        </p>
      )}

      <Button type="submit" className="h-11 w-full" disabled={isPending}>
        {isPending ? (
          <>
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            Signing in…
          </>
        ) : (
          "Sign in"
        )}
      </Button>
    </form>
  );
}
