"use client";

import { ArrowRight, Loader2, Mail, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { TaylorBrand } from "~/components/TaylorBrand";
import { authClient } from "~/lib/auth-client";

type Mode = "sign-in" | "sign-up" | "forgot" | "reset";

function redirectTarget(params: URLSearchParams) {
  return params.get("returnTo") || "/dashboard";
}

async function authCall<T>(fn: Promise<T>) {
  const result = (await fn) as { error?: { message?: string } | null };
  if (result?.error) throw new Error(result.error.message ?? "Authentication failed.");
  return result;
}

export function AuthShell(props: { mode: Mode }) {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const isSignIn = props.mode === "sign-in";
  const isSignUp = props.mode === "sign-up";
  const isForgot = props.mode === "forgot";
  const isReset = props.mode === "reset";
  const title = isSignIn
    ? "Sign in to TaylorCV"
    : isSignUp
      ? "Create your TaylorCV account"
      : isForgot
        ? "Reset your password"
        : "Choose a new password";
  const subtitle = isSignUp
    ? "Verify your email to unlock your free CV generation."
    : isSignIn
      ? "Continue to your dashboard, billing, and saved CVs."
      : "We will send a secure reset link if the account exists.";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setError(null);
    setMessage(null);
    try {
      if (isSignUp) {
        await authCall(
          authClient.signUp.email({
            name: name.trim() || email.split("@")[0] || "TaylorCV user",
            email,
            password,
            callbackURL: redirectTarget(params),
          })
        );
        setMessage("Check your email to verify your account before generating your free CV.");
        return;
      }
      if (isSignIn) {
        await authCall(
          authClient.signIn.email({
            email,
            password,
            callbackURL: redirectTarget(params),
          })
        );
        window.location.href = redirectTarget(params);
        return;
      }
      if (isForgot) {
        const response = await fetch("/api/auth/request-password-reset", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            email,
            redirectTo: `${window.location.origin}/auth/reset-password`,
          }),
        });
        if (!response.ok) throw new Error("Could not send reset link.");
        setMessage("If this email exists, a password reset link is on its way.");
        return;
      }
      await authCall(authClient.resetPassword({ newPassword: password, token }));
      setMessage("Password updated. You can sign in now.");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "TaylorCV could not complete that request."
      );
    } finally {
      setIsPending(false);
    }
  }

  async function resendVerification() {
    if (!email) return;
    setIsPending(true);
    setError(null);
    try {
      await authCall(
        authClient.sendVerificationEmail({
          email,
          callbackURL: redirectTarget(params),
        })
      );
      setMessage("Verification email sent.");
    } catch (resendError) {
      setError(resendError instanceof Error ? resendError.message : "Could not send email.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#030813] px-5 py-8 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(37,99,235,0.28),transparent_34%),linear-gradient(135deg,#030813,#071426_55%,#020611)]" />
      <div className="relative mx-auto flex min-h-[calc(100vh-64px)] max-w-5xl flex-col">
        <TaylorBrand markClassName="h-9 w-9" textClassName="text-[22px]" />
        <section className="grid flex-1 items-center gap-8 py-10 lg:grid-cols-[1fr_440px]">
          <div className="max-w-xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-blue-300/20 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">
              <ShieldCheck className="h-4 w-4" />
              Private TaylorCV account
            </p>
            <h1 className="mt-6 text-balance text-5xl font-semibold leading-tight tracking-[-0.055em]">
              Generate and save tailored CVs with verified access.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-slate-300">
              Your analysis can start without an account. Final CV generation,
              usage, billing, and saved applications are protected by your
              TaylorCV account.
            </p>
          </div>

          <form
            className="rounded-xl border border-white/12 bg-white/[0.07] p-6 shadow-[0_30px_90px_rgba(0,0,0,.34)] backdrop-blur-2xl"
            onSubmit={submit}
          >
            <h2 className="text-2xl font-semibold tracking-[-0.035em]">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">{subtitle}</p>

            <div className="mt-6 space-y-4">
              {isSignUp ? (
                <label className="block">
                  <span className="text-sm font-medium text-slate-200">Name</span>
                  <input
                    className="mt-2 h-11 w-full rounded-lg border border-white/12 bg-slate-950/70 px-3 text-sm outline-none focus:border-blue-300"
                    onChange={(event) => setName(event.target.value)}
                    value={name}
                  />
                </label>
              ) : null}
              {!isReset ? (
                <label className="block">
                  <span className="text-sm font-medium text-slate-200">Email</span>
                  <input
                    className="mt-2 h-11 w-full rounded-lg border border-white/12 bg-slate-950/70 px-3 text-sm outline-none focus:border-blue-300"
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    type="email"
                    value={email}
                  />
                </label>
              ) : null}
              {!isForgot ? (
                <label className="block">
                  <span className="text-sm font-medium text-slate-200">
                    {isReset ? "New password" : "Password"}
                  </span>
                  <input
                    className="mt-2 h-11 w-full rounded-lg border border-white/12 bg-slate-950/70 px-3 text-sm outline-none focus:border-blue-300"
                    minLength={8}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    type="password"
                    value={password}
                  />
                </label>
              ) : null}
            </div>

            {error ? (
              <p className="mt-4 rounded-lg border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-100">
                {error}
              </p>
            ) : null}
            {message ? (
              <p className="mt-4 rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-3 text-sm text-emerald-100">
                {message}
              </p>
            ) : null}

            <button
              className="mt-6 inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-blue-600 text-sm font-semibold text-white shadow-[0_0_30px_rgba(37,99,235,.34)] transition hover:scale-[1.02] hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isPending}
              type="submit"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              {isSignIn
                ? "Sign in"
                : isSignUp
                  ? "Create account"
                  : isForgot
                    ? "Send reset link"
                    : "Update password"}
              <ArrowRight className="h-4 w-4" />
            </button>

            {isSignUp ? (
              <button
                className="mt-3 cursor-pointer text-sm font-medium text-blue-300 transition hover:text-blue-200"
                disabled={isPending || !email}
                onClick={resendVerification}
                type="button"
              >
                Resend verification email
              </button>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-3 text-sm text-slate-300">
              {!isSignIn ? <Link href={`/auth/sign-in?${params}`}>Sign in</Link> : null}
              {!isSignUp ? <Link href={`/auth/sign-up?${params}`}>Create account</Link> : null}
              {!isForgot && !isReset ? <Link href="/auth/forgot-password">Forgot password?</Link> : null}
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
