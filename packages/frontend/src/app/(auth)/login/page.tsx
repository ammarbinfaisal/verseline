"use client";

import { useState, FormEvent, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/stores/auth-store";
import { Button, Field, Input } from "@/components/ui";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resetSuccess = searchParams.get("reset") === "success";

  const login = useAuthStore((s) => s.login);
  const loading = useAuthStore((s) => s.loading);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await login(email, password);
      router.push("/projects");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  }

  return (
    <>
      <h1 className="font-display text-[var(--text-fs-6)] mb-2" style={{ fontFamily: "var(--font-display)" }}>
        Welcome back
      </h1>
      <p className="text-[var(--text-fs-3)] text-[var(--text-muted)] mb-8">
        Log in to keep editing where you left off.
      </p>

      {resetSuccess && (
        <p
          role="status"
          className="text-[var(--text-fs-2)] mb-6 px-3 py-2 rounded-md"
          style={{ background: "var(--success-bg)", color: "var(--success)" }}
        >
          ✓ Password reset. Sign in with the new one.
        </p>
      )}

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

        <Field label="Password">
          {(p) => (
            <Input
              {...p}
              type="password"
              autoComplete="current-password"
              required
              fullWidth
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
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
          {loading ? "Logging in" : "Log in"}
        </Button>
      </form>

      <div className="mt-8 flex items-center justify-between text-[var(--text-fs-2)]">
        <Link href="/forgot-password" className="text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
          Forgot password?
        </Link>
        <span className="text-[var(--text-muted)]">
          No account?{" "}
          <Link href="/signup" className="text-[var(--brand-primary)] hover:underline">
            Sign up
          </Link>
        </span>
      </div>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
