"use client";

import { useState, FormEvent, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { Button, Field, Input } from "@/components/ui";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!token) {
    return (
      <>
        <h1 className="font-display text-[var(--text-fs-6)] mb-2" style={{ fontFamily: "var(--font-display)" }}>
          Invalid link
        </h1>
        <p className="text-[var(--text-fs-3)] text-[var(--text-muted)] mb-8">
          This password reset link is invalid or has expired.
        </p>
        <Link href="/forgot-password">
          <Button variant="primary" size="lg" fullWidth>
            Request a new link
          </Button>
        </Link>
      </>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);
    try {
      await api.auth.resetPassword(token!, password);
      router.push("/login?reset=success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h1 className="font-display text-[var(--text-fs-6)] mb-2" style={{ fontFamily: "var(--font-display)" }}>
        Set a new password
      </h1>
      <p className="text-[var(--text-fs-3)] text-[var(--text-muted)] mb-8">
        Choose a new password for your account.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <Field label="New password" hint="At least 8 characters">
          {(p) => (
            <Input
              {...p}
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              fullWidth
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="A strong password"
            />
          )}
        </Field>

        <Field label="Confirm password">
          {(p) => (
            <Input
              {...p}
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              fullWidth
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter the password"
            />
          )}
        </Field>

        {error && (
          <p
            role="alert"
            className="text-[var(--text-fs-2)] px-3 py-2 rounded-md"
            style={{ background: "var(--error-bg)", color: "var(--error)" }}
          >
            {error}
          </p>
        )}

        <Button type="submit" variant="primary" size="lg" loading={loading} fullWidth>
          {loading ? "Resetting" : "Reset password"}
        </Button>
      </form>

      <p className="mt-8 text-[var(--text-fs-2)] text-[var(--text-muted)]">
        Remember your password?{" "}
        <Link href="/login" className="text-[var(--brand-primary)] hover:underline">
          Log in
        </Link>
      </p>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
