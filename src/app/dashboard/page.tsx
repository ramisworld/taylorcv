"use client";

import { Download, FileText, Loader2, Plus, Settings, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { TaylorLogoMark } from "~/components/TaylorBrand";
import { authClient, useSession } from "~/lib/auth-client";
import { parseStructuredCv } from "~/lib/cvDocument";
import { exportCvDocx, exportCvPdf } from "~/lib/cvExport";
import { isPlanKey } from "~/lib/plans";
import { api } from "~/trpc/react";

const currentApplicationStorageKey = "currentApplicationId";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function DashboardButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-white/12 bg-white/[0.06] px-3 py-2 text-sm font-medium text-zinc-100 transition hover:scale-[1.02] hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-50",
        props.className
      )}
    />
  );
}

function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export default function DashboardPage() {
  const router = useRouter();
  const utils = api.useUtils();
  const session = useSession();
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isSignedIn = !!session.data?.user;
  const applicationsQuery = api.application.listUserApplications.useQuery(undefined, {
    enabled: isSignedIn,
    retry: false,
  });
  const entitlementQuery = api.billing.getEntitlement.useQuery(undefined, {
    enabled: isSignedIn,
    retry: false,
  });
  const exportData = api.application.getApplicationExportData.useMutation();
  const portal = api.billing.createPortalSession.useMutation({
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (mutationError) => setError(mutationError.message),
  });
  const checkout = api.billing.createCheckoutSession.useMutation({
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (mutationError) => {
      if (mutationError.message === "ALREADY_HAS_SUBSCRIPTION") {
        setError("You already have an active paid plan.");
        return;
      }
      setError(mutationError.message);
    },
  });
  const createApplication = api.application.createApplication.useMutation({
    onSuccess: async (data) => {
      localStorage.setItem(currentApplicationStorageKey, data.applicationId);
      await utils.application.listUserApplications.invalidate();
      router.push(`/?applicationId=${data.applicationId}`);
    },
    onError: (mutationError) => setError(mutationError.message),
  });

  async function newCv() {
    setError(null);
    const entitlement = entitlementQuery.data;
    if (entitlement && entitlement.remaining <= 0 && entitlement.planKey === "free") {
      router.push("/?pricing=1#pricing");
      return;
    }
    createApplication.mutate();
  }

  useEffect(() => {
    if (!isSignedIn || checkout.isPending) return;
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("checkoutPlan");
    const stored = localStorage.getItem("pendingPlanKey");
    const planKey = fromUrl || stored;
    if (!planKey || !isPlanKey(planKey) || planKey === "free") return;
    localStorage.removeItem("pendingPlanKey");
    checkout.mutate({ planKey });
  }, [isSignedIn, checkout]);

  async function exportApplication(applicationId: string, type: "pdf" | "docx") {
    setExportingId(applicationId);
    setError(null);
    try {
      const data = await exportData.mutateAsync({ applicationId });
      const cv = parseStructuredCv(data.cvDraft.cvJson);
      if (!cv) throw new Error("CV data is not ready for export.");
      if (type === "pdf") await exportCvPdf(cv, data.cvDraft.presentationJson);
      else await exportCvDocx(cv, data.cvDraft.presentationJson);
    } catch (exportError) {
      setError(
        exportError instanceof Error
          ? exportError.message
          : "Export failed. Open the CV and try again."
      );
    } finally {
      setExportingId(null);
    }
  }

  if (session.isPending) {
    return (
      <main className="grid min-h-screen place-items-center bg-zinc-950 text-white">
        <Loader2 className="h-6 w-6 animate-spin" />
      </main>
    );
  }

  if (!isSignedIn) {
    router.replace("/auth/sign-in?returnTo=/dashboard");
    return null;
  }

  const entitlement = entitlementQuery.data;

  return (
    <main className="relative min-h-screen overflow-hidden bg-zinc-950 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(45,212,191,0.18),transparent_30%),radial-gradient(circle_at_84%_24%,rgba(37,99,235,0.18),transparent_25%),linear-gradient(135deg,#09090b_0%,#111827_48%,#031525_100%)]" />
      <div className="relative z-10 flex min-h-screen">
        <aside className="hidden w-72 shrink-0 border-r border-white/10 p-5 backdrop-blur-xl lg:block">
          <div className="flex items-center gap-3">
            <TaylorLogoMark className="h-10 w-10" />
            <div>
              <p className="text-sm font-semibold text-white">Taylor CV</p>
              <p className="text-xs text-zinc-400">Dashboard</p>
            </div>
          </div>
          <nav className="mt-8 space-y-2">
            <a className="block rounded-lg bg-white/[0.08] px-3 py-2 text-sm text-white" href="/dashboard">
              Dashboard
            </a>
            <button
              className="block w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-400 hover:bg-white/[0.06] hover:text-white"
              onClick={newCv}
              type="button"
            >
              New CV
            </button>
          </nav>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-16 items-center justify-between border-b border-white/10 px-5 backdrop-blur-xl">
            <div className="flex items-center gap-3 lg:hidden">
              <TaylorLogoMark className="h-8 w-8" />
              <p className="text-sm font-semibold text-white">Dashboard</p>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <DashboardButton disabled={createApplication.isPending} onClick={newCv} type="button">
                {createApplication.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                New CV
              </DashboardButton>
              <DashboardButton
                disabled={portal.isPending}
                onClick={() => portal.mutate()}
                type="button"
              >
                <Settings className="h-4 w-4" />
                Manage billing
              </DashboardButton>
              <DashboardButton
                onClick={() => {
                  void authClient.signOut();
                  router.push("/");
                }}
                type="button"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </DashboardButton>
            </div>
          </header>

          <div className="min-h-0 flex-1 p-5 md:p-8">
            <div className="mb-7 grid gap-4 lg:grid-cols-[1fr_360px]">
              <div>
                <h1 className="text-4xl font-semibold tracking-normal text-white">
                  Dashboard
                </h1>
                <p className="mt-2 text-zinc-300">Your tailored CVs for each role.</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.07] p-4 backdrop-blur-xl">
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Plan</p>
                <p className="mt-1 text-lg font-semibold text-white">
                  {entitlement?.plan.displayName ?? "Loading"}
                </p>
                <p className="mt-2 text-sm text-zinc-300">
                  {entitlement
                    ? entitlement.planKey === "free"
                      ? entitlement.used > 0
                        ? "Free CV used"
                        : "Free CV unused"
                      : `${entitlement.used} used, ${entitlement.remaining} remaining this billing period`
                    : "Checking usage..."}
                </p>
              </div>
            </div>

            {error ? (
              <p className="mb-4 rounded-lg border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-100">
                {error}
              </p>
            ) : null}

            <div className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.07] backdrop-blur-xl">
              {applicationsQuery.isLoading ? (
                <div className="flex h-48 items-center justify-center text-zinc-400">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading applications
                </div>
              ) : applicationsQuery.data?.applications.length ? (
                <div className="divide-y divide-white/10">
                  {applicationsQuery.data.applications.map((application) => (
                    <div
                      className="grid gap-4 p-4 md:grid-cols-[1.2fr_0.7fr_0.6fr_0.9fr]"
                      key={application.id}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-lg font-semibold text-white">
                          {application.jobTitle}
                        </p>
                        <p className="mt-1 text-sm text-zinc-400">
                          {application.company ?? "Company not specified"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                          Match score
                        </p>
                        <p className="mt-1 text-sm text-zinc-200">
                          {application.evidenceMatchScore !== null &&
                          application.evidenceMatchScore !== undefined
                            ? `${application.evidenceMatchScore}%`
                            : "Not scored"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                          Status
                        </p>
                        <p className="mt-1 text-sm text-zinc-200">{application.status}</p>
                        <p className="mt-1 text-xs text-zinc-500">
                          Updated {formatDate(application.updatedAt)}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 md:justify-end">
                        <DashboardButton
                          onClick={() => {
                            localStorage.setItem(currentApplicationStorageKey, application.id);
                            router.push(`/?applicationId=${application.id}`);
                          }}
                          type="button"
                        >
                          <FileText className="h-4 w-4" />
                          Open CV
                        </DashboardButton>
                        <DashboardButton
                          disabled={!application.hasCv || exportingId === application.id}
                          onClick={() => void exportApplication(application.id, "pdf")}
                          type="button"
                        >
                          <Download className="h-4 w-4" />
                          PDF
                        </DashboardButton>
                        <DashboardButton
                          disabled={!application.hasCv || exportingId === application.id}
                          onClick={() => void exportApplication(application.id, "docx")}
                          type="button"
                        >
                          <Download className="h-4 w-4" />
                          DOCX
                        </DashboardButton>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <p className="text-lg font-semibold text-white">No applications yet.</p>
                  <p className="mt-2 text-sm text-zinc-400">
                    Start a new application to create your first tailored CV.
                  </p>
                  <DashboardButton className="mt-5" onClick={newCv} type="button">
                    <Plus className="h-4 w-4" />
                    New CV
                  </DashboardButton>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
