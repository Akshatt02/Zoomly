"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  LoaderCircle, 
  UserPlus, 
  Video, 
  Mail, 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  Zap, 
  Sparkles, 
  Check, 
  Users 
} from "lucide-react";
import { useAuth } from "@/lib/authContext";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { register } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const redirect = searchParams.get("redirect") ?? "/";

  const passwordLengthValid = password.length >= 6;
  const passwordsMatch = confirm.length > 0 && password === confirm;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    try {
      await register(name, email, password);
      router.push(redirect);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setLoading(false);
    }
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
            <h1>Start collaborating with your team today</h1>
            <p>
              Create your free Zoomly account in seconds and host HD meetings with unlimited team members.
            </p>
          </div>

          {/* Interactive Feature List Card */}
          <div className="hero-preview-card">
            <div className="hero-feature-list">
              <div className="hero-feature-item">
                <div className="feature-item-icon">
                  <Zap size={16} />
                </div>
                <div>
                  <strong>Instant One-Click Meetings</strong>
                  <p>No downloads required for guests, launch directly in browser.</p>
                </div>
              </div>

              <div className="hero-feature-item">
                <div className="feature-item-icon green">
                  <ShieldCheck size={16} />
                </div>
                <div>
                  <strong>Enterprise Grade Security</strong>
                  <p>Host waiting rooms, admit controls, and end-to-end encryption.</p>
                </div>
              </div>

              <div className="hero-feature-item">
                <div className="feature-item-icon purple">
                  <Users size={16} />
                </div>
                <div>
                  <strong>Interactive Team Chat</strong>
                  <p>In-meeting messaging, participant hand raises, and active speaker spotlight.</p>
                </div>
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
            <h1>Create account</h1>
            <p>Join Zoomly and unlock seamless video collaboration</p>
          </div>

          <form className="auth-form" onSubmit={submit}>
            <div className="form-field">
              <label htmlFor="register-name">Full name</label>
              <div className="input-wrapper">
                <User className="input-icon" size={18} />
                <input
                  id="register-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex Morgan"
                  required
                  minLength={2}
                  autoComplete="name"
                />
              </div>
            </div>

            <div className="form-field">
              <label htmlFor="register-email">Email address</label>
              <div className="input-wrapper">
                <Mail className="input-icon" size={18} />
                <input
                  id="register-email"
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
                <label htmlFor="register-password">Password</label>
                {password.length > 0 && (
                  <span className={`password-pill ${passwordLengthValid ? "valid" : ""}`}>
                    {passwordLengthValid ? <Check size={12} /> : null} 6+ chars
                  </span>
                )}
              </div>
              <div className="input-wrapper">
                <Lock className="input-icon" size={18} />
                <input
                  id="register-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                  minLength={6}
                  autoComplete="new-password"
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

            <div className="form-field">
              <div className="label-row">
                <label htmlFor="register-confirm">Confirm password</label>
                {confirm.length > 0 && (
                  <span className={`password-pill ${passwordsMatch ? "valid" : "invalid"}`}>
                    {passwordsMatch ? <Check size={12} /> : null}
                    {passwordsMatch ? "Matches" : "Doesn't match"}
                  </span>
                )}
              </div>
              <div className="input-wrapper">
                <Lock className="input-icon" size={18} />
                <input
                  id="register-confirm"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repeat your password"
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && <p className="form-error">{error}</p>}

            <button id="register-submit" className="primary-button form-submit" disabled={loading}>
              {loading ? <LoaderCircle className="spin" size={18} /> : <UserPlus size={18} />}
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>

          <div className="auth-divider">
            <span>Or</span>
          </div>

          <p className="auth-switch">
            Already have an account?{" "}
            <a href={`/login${redirect !== "/" ? `?redirect=${encodeURIComponent(redirect)}` : ""}`}>
              Sign in
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
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
      <RegisterForm />
    </Suspense>
  );
}

