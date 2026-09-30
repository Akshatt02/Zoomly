"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  LoaderCircle, 
  LogIn, 
  Video, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  Zap, 
  Sparkles, 
  CheckCircle2, 
  Users
} from "lucide-react";
import { useAuth } from "@/lib/authContext";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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

  function handleDemoFill() {
    setEmail("alex@zoomly.com");
    setPassword("password123");
    setError("");
  }

  return (
    <div className="auth-page">
      {/* Background ambient lighting */}
      <div className="auth-bg-glow glow-1"></div>
      <div className="auth-bg-glow glow-2"></div>
      <div className="auth-bg-grid"></div>

      <div className="auth-container">
        {/* Left Side: Brand Showcase Panel */}
        <div className="auth-hero-panel">
          <div className="hero-brand">
            <div className="hero-brand-logo">
              <Video size={24} />
            </div>
            <span className="hero-brand-name">Zoomly</span>
            <span className="hero-badge">
              <Sparkles size={12} /> Next-Gen Video
            </span>
          </div>

          <div className="hero-content">
            <h1>Connect instantly with crystal clear video calls</h1>
            <p>
              Experience ultra-low latency meetings, instant screen sharing, and secure team collaboration.
            </p>
          </div>

          {/* Interactive Feature Card Preview */}
          <div className="hero-preview-card">
            <div className="preview-header">
              <div className="preview-live-indicator">
                <span className="pulse-dot"></span>
                <span>Team Sync Meeting</span>
              </div>
              <span className="preview-tag">
                <Users size={12} /> 4 Active
              </span>
            </div>

            <div className="preview-video-grid">
              <div className="preview-tile speaker">
                <div className="preview-avatar">AK</div>
                <div className="preview-wave">
                  <span></span><span></span><span></span><span></span>
                </div>
                <div className="preview-tile-name">Alex K. (Host)</div>
              </div>
              <div className="preview-tile">
                <div className="preview-avatar bg-purple">SJ</div>
                <div className="preview-tile-name">Sarah J.</div>
              </div>
            </div>

            <div className="preview-footer">
              <div className="preview-feature-pill">
                <ShieldCheck size={14} /> End-to-end Encrypted
              </div>
              <div className="preview-feature-pill">
                <Zap size={14} /> 1080p HD Video
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Auth Card Form */}
        <div className="auth-card">
          <div className="auth-logo-mobile">
            <Video size={24} />
            <span>Zoomly</span>
          </div>

          <div className="auth-header">
            <h1>Welcome back</h1>
            <p>Sign in to your Zoomly account to continue</p>
          </div>

          <form className="auth-form" onSubmit={submit}>
            <div className="form-field">
              <label htmlFor="login-email">Email address</label>
              <div className="input-wrapper">
                <Mail className="input-icon" size={18} />
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="form-field">
              <div className="label-row">
                <label htmlFor="login-password">Password</label>
              </div>
              <div className="input-wrapper">
                <Lock className="input-icon" size={18} />
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && <p className="form-error">{error}</p>}

            <button id="login-submit" className="primary-button form-submit" disabled={loading}>
              {loading ? <LoaderCircle className="spin" size={18} /> : <LogIn size={18} />}
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          {/* Quick Demo Helper */}
          <div className="demo-fill-box">
            <span>Want to test quickly?</span>
            <button type="button" onClick={handleDemoFill} className="demo-fill-btn">
              <Sparkles size={14} /> Fill Demo Credentials
            </button>
          </div>

          <div className="auth-divider">
            <span>Or</span>
          </div>

          <p className="auth-switch">
            Don&apos;t have an account yet?{" "}
            <a href={`/register${redirect !== "/" ? `?redirect=${encodeURIComponent(redirect)}` : ""}`}>
              Create an account
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="auth-page">
          <div className="auth-card" style={{ display: "grid", placeItems: "center", minHeight: "300px" }}>
            <LoaderCircle className="spin" size={28} color="#3b82f6" />
          </div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

