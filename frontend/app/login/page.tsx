"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LoaderCircle, LogIn, Video } from "lucide-react";
import { useAuth } from "@/lib/authContext";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const redirect = searchParams.get("redirect") ?? "/";

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      router.push(redirect);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <Video size={28} />
          <span>Zoomly</span>
        </div>

        <div className="auth-header">
          <h1>Welcome back</h1>
          <p>Sign in to your Zoomly account</p>
        </div>

        <form className="auth-form" onSubmit={submit}>
          <label>
            Email address
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </label>

          <label>
            Password
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              required
              autoComplete="current-password"
            />
          </label>

          {error && <p className="form-error">{error}</p>}

          <button id="login-submit" className="primary-button form-submit" disabled={loading}>
            {loading ? <LoaderCircle className="spin" size={18} /> : <LogIn size={18} />}
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="auth-switch">
          Don&apos;t have an account?{" "}
          <a href={`/register${redirect !== "/" ? `?redirect=${encodeURIComponent(redirect)}` : ""}`}>
            Create one
          </a>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="auth-page"><div className="auth-card"><LoaderCircle className="spin" size={24} /></div></div>}>
      <LoginForm />
    </Suspense>
  );
}
