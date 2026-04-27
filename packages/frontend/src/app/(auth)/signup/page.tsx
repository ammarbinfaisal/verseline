"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/stores/auth-store";
import { Button, Field, Input } from "@/components/ui";

export default function SignupPage() {
  const router = useRouter();
  const signup = useAuthStore((s) => s.signup);
  const loading = useAuthStore((s) => s.loading);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await signup(email, password);
      router.push("/projects");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed");
    }
  }

  return (
    <>
      <h1 className="font-display text-[var(--text-fs-6)] mb-2" style={{ fontFamily: "var(--font-display)" }}>
        Create your account
      </h1>
      <p className="text-[var(--text-fs-3)] text-[var(--text-muted)] mb-8">
        Free to start. No credit card required.
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

        <Field label="Password" hint="At least 8 characters">
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
          {loading ? "Creating account" : "Create account"}
        </Button>
      </form>

      <p className="mt-8 text-[var(--text-fs-2)] text-[var(--text-muted)]">
        Already have an account?{" "}
        <Link href="/login" className="text-[var(--brand-primary)] hover:underline">
          Log in
        </Link>
      </p>
    </>
  );
}
