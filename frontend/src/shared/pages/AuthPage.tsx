import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Radio,
  Lock,
  FileBadge,
  User,
  Shield,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import type { OperatorRole } from "../types/auth";

export const AuthPage: React.FC = () => {
  const [tab, setTab] = useState<"login" | "register">("login");
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Determine redirect path after login
  const from = (location.state as { from?: { pathname?: string } })?.from
    ?.pathname || "/";

  // Login form state
  const [loginLicense, setLoginLicense] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Register form state
  const [regName, setRegName] = useState("");
  const [regLicense, setRegLicense] = useState("");
  const [regRole, setRegRole] = useState<OperatorRole>("FLEET_OPERATOR");
  const [regPassword, setRegPassword] = useState("");

  // Status state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          license_no: loginLicense.trim(),
          password: loginPassword,
        }),
      });

      if (!res.ok) {
        if (res.status === 429) {
          throw new Error("Rate limit exceeded: Please wait 1 minute before trying again.");
        }
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Invalid license number or password.");
      }

      const data = await res.json();
      login(data.access_token, data.operator);
      navigate(from, { replace: true });
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred during login.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: regName.trim(),
          license_no: regLicense.trim(),
          role: regRole,
          password: regPassword,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(
          errData.detail || "Registration failed. Please check your details."
        );
      }

      const operatorData = await res.json();
      setSuccess(
        `Account created successfully for ${operatorData.name}! Logging you in...`
      );

      // Automatically log the new operator in
      const loginRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          license_no: regLicense.trim(),
          password: regPassword,
        }),
      });

      if (loginRes.ok) {
        const loginData = await loginRes.json();
        login(loginData.access_token, loginData.operator);
        setTimeout(() => navigate("/", { replace: true }), 700);
      } else {
        setTab("login");
        setLoginLicense(regLicense.trim());
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred during registration.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-utm-bg px-4 py-12">
      {/* Background glow effects */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-brand-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />

      <div className="relative w-full max-w-md">
        {/* Brand header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-brand-600 to-cyan-400 shadow-glow">
            <Radio className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            UTM AEROSHIELD
          </h1>
          <p className="mt-1 text-xs uppercase tracking-widest text-slate-400">
            Unmanned Traffic Management Network
          </p>
        </div>

        {/* Auth Card */}
        <div className="overflow-hidden rounded-2xl border border-utm-border bg-utm-surface/90 shadow-2xl backdrop-blur-xl">
          {/* Tab Selector */}
          <div className="flex border-b border-utm-border bg-utm-bg/40">
            <button
              type="button"
              onClick={() => {
                setTab("login");
                setError(null);
                setSuccess(null);
              }}
              className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider transition ${
                tab === "login"
                  ? "border-b-2 border-brand-500 bg-utm-surface text-brand-400"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setTab("register");
                setError(null);
                setSuccess(null);
              }}
              className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider transition ${
                tab === "register"
                  ? "border-b-2 border-brand-500 bg-utm-surface text-brand-400"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              New Operator
            </button>
          </div>

          <div className="p-6 sm:p-8">
            {/* Feedback Banners */}
            {error && (
              <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                <span>{success}</span>
              </div>
            )}

            {/* -------------------------------------------------------- */}
            {/* Login Form                                               */}
            {/* -------------------------------------------------------- */}
            {tab === "login" ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300">
                    License Number
                  </label>
                  <div className="relative mt-1.5">
                    <FileBadge className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. LIC-FLEET-001"
                      value={loginLicense}
                      onChange={(e) => setLoginLicense(e.target.value)}
                      className="w-full rounded-xl border border-utm-border bg-utm-card py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-400 transition focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300">
                    Password
                  </label>
                  <div className="relative mt-1.5">
                    <Lock className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full rounded-xl border border-utm-border bg-utm-card py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-400 transition focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-cyan-500 py-3 text-sm font-semibold text-white shadow-glow transition hover:from-brand-500 hover:to-cyan-400 focus:outline-none disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Authenticating...
                    </>
                  ) : (
                    <>
                      Authenticate
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              /* -------------------------------------------------------- */
              /* Register Form                                            */
              /* -------------------------------------------------------- */
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300">
                    Operator / Organization Name
                  </label>
                  <div className="relative mt-1.5">
                    <User className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. AeroDynamics Corp"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      className="w-full rounded-xl border border-utm-border bg-utm-card py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-400 transition focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300">
                    License Number (Unique)
                  </label>
                  <div className="relative mt-1.5">
                    <FileBadge className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. LIC-REG-002"
                      value={regLicense}
                      onChange={(e) => setRegLicense(e.target.value)}
                      className="w-full rounded-xl border border-utm-border bg-utm-card py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-400 transition focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300">
                    Operating Role
                  </label>
                  <div className="relative mt-1.5">
                    <Shield className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                    <select
                      value={regRole}
                      onChange={(e) => setRegRole(e.target.value as OperatorRole)}
                      className="w-full rounded-xl border border-utm-border bg-utm-card py-2.5 pl-10 pr-4 text-sm text-white transition focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    >
                      <option value="FLEET_OPERATOR">
                        FLEET_OPERATOR (Drone Fleet Management)
                      </option>
                      <option value="REGULATOR">
                        REGULATOR (Airspace Oversight & Audit)
                      </option>
                      <option value="DISPATCHER">
                        DISPATCHER (Flight Clearances & Routing)
                      </option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300">
                    Password
                  </label>
                  <div className="relative mt-1.5">
                    <Lock className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                    <input
                      type="password"
                      required
                      minLength={6}
                      placeholder="Minimum 6 characters"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      className="w-full rounded-xl border border-utm-border bg-utm-card py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-400 transition focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-cyan-500 py-3 text-sm font-semibold text-white shadow-glow transition hover:from-brand-500 hover:to-cyan-400 focus:outline-none disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating Account...
                    </>
                  ) : (
                    <>
                      Register Operator
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Footer info */}
        <p className="mt-6 text-center text-xs text-slate-400">
          Connected to local backend on{" "}
          <code className="font-mono text-brand-400">http://localhost:8000</code>
        </p>
      </div>
    </div>
  );
};
