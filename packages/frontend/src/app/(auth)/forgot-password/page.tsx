"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Button, Field, Input } from "@/components/ui";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.auth.forgotPassword(email);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <>
        <h1 className="font-display text-[var(--text-fs-6)] mb-2" style={{ fontFamily: "var(--font-display)" }}>
          Check your email
        </h1>
        <p className="text-[var(--text-fs-3)] text-[var(--text-muted)] mb-8">
          If an account exists for{" "}
          <span className="text-[var(--text)] font-medium">{email}</span>, we've sent a reset link.
        </p>
        <Link href="/login">
          <Button variant="primary" size="lg" fullWidth>
            Back to log in
          </Button>
        </Link>
      </>
    );
  }

  return (
    <>
      <h1 className="font-display text-[var(--text-fs-6)] mb-2" style={{ fontFamily: "var(--font-display)" }}>
        Forgot password?
      </h1>
      <p className="text-[var(--text-fs-3)] text-[var(--text-muted)] mb-8">
        Enter your email and we'll send a reset link.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <Field label="Email">
          {(p) => (
            <Input
              {...p}
              type="email"
              autoComplete="email"
              required
              fullWidth
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
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
          {loading ? "Sending" : "Send reset link"}
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
