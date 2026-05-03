"use client";

import {
  SignInButton,
  UserButton,
  useAuth,
} from "@clerk/nextjs";
import { Download, FileText, Loader2, Plus, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { parseStructuredCv } from "~/lib/cvDocument";
import { exportCvDocx, exportCvPdf } from "~/lib/cvExport";
import { api } from "~/trpc/react";

const currentApplicationStorageKey = "currentApplicationId";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function HubButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg border border-white/12 bg-white/[0.06] px-3 py-2 text-sm font-medium text-zinc-100 transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-50",
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

export default function ApplicationHubPage() {
  const router = useRouter();
  const utils = api.useUtils();
  const { isLoaded, isSignedIn } = useAuth();
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const applicationsQuery = api.application.listUserApplications.useQuery(
    undefined,
    { enabled: !!isSignedIn, retry: false }
  );
  const exportData = api.application.getApplicationExportData.useMutation();
  const createApplication = api.application.createApplication.useMutation({
    onSuccess: async (data) => {
      localStorage.setItem(currentApplicationStorageKey, data.applicationId);
      await utils.application.listUserApplications.invalidate();
      router.push(`/?applicationId=${data.applicationId}`);
    },
    onError: (mutationError) => setError(mutationError.message),
  });

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

  return (
    <main className="relative min-h-screen overflow-hidden bg-zinc-950 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(45,212,191,0.20),transparent_30%),radial-gradient(circle_at_84%_24%,rgba(250,204,21,0.10),transparent_25%),linear-gradient(135deg,#09090b_0%,#111827_48%,#052e2b_100%)]" />
      <div className="relative z-10 flex min-h-screen">
        <aside className="hidden w-72 shrink-0 border-r border-white/10 p-5 backdrop-blur-xl lg:block">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-cyan-200/20 bg-cyan-200/10 text-cyan-100">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Taylor CV</p>
              <p className="text-xs text-zinc-400">Application Hub</p>
            </div>
          </div>
          <nav className="mt-8 space-y-2">
            <a className="block rounded-lg bg-white/[0.08] px-3 py-2 text-sm text-white" href="/hub">
              Application Hub
            </a>
            <button
              className="block w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-400 hover:bg-white/[0.06] hover:text-white"
              onClick={() => createApplication.mutate()}
              type="button"
            >
              New Application
            </button>
          </nav>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-16 items-center justify-between border-b border-white/10 px-5 backdrop-blur-xl">
            <div className="lg:hidden">
              <p className="text-sm font-semibold text-white">Taylor CV</p>
              <p className="text-xs text-zinc-400">Application Hub</p>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <HubButton
                disabled={createApplication.isPending}
                onClick={() => createApplication.mutate()}
                type="button"
              >
                {createApplication.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                New Application
              </HubButton>
              {isSignedIn ? (
                <UserButton />
              ) : (
                <SignInButton mode="modal">
                  <HubButton type="button">Sign in</HubButton>
                </SignInButton>
              )}
            </div>
          </header>

          <div className="min-h-0 flex-1 p-5 md:p-8">
            <div className="mb-7">
              <h1 className="text-4xl font-semibold tracking-normal text-white">
                Application Hub
              </h1>
              <p className="mt-2 text-zinc-300">
                Your tailored CVs for each role.
              </p>
            </div>

            {isLoaded && !isSignedIn ? (
              <div className="rounded-lg border border-white/10 bg-white/[0.07] p-6 text-zinc-200 backdrop-blur-xl">
                Sign in to view your saved applications.
              </div>
            ) : null}

            {isSignedIn ? (
              <>
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
                          <p className="mt-1 text-sm text-zinc-200">
                            {application.status}
                          </p>
                          <p className="mt-1 text-xs text-zinc-500">
                            Updated {formatDate(application.updatedAt)}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 md:justify-end">
                          <HubButton
                            onClick={() => {
                              localStorage.setItem(
                                currentApplicationStorageKey,
                                application.id
                              );
                              router.push(`/?applicationId=${application.id}`);
                            }}
                            type="button"
                          >
                            <FileText className="h-4 w-4" />
                            Open CV
                          </HubButton>
                          <HubButton
                            disabled={!application.hasCv || exportingId === application.id}
                            onClick={() => void exportApplication(application.id, "pdf")}
                            type="button"
                          >
                            <Download className="h-4 w-4" />
                            PDF
                          </HubButton>
                          <HubButton
                            disabled={!application.hasCv || exportingId === application.id}
                            onClick={() => void exportApplication(application.id, "docx")}
                            type="button"
                          >
                            <Download className="h-4 w-4" />
                            DOCX
                          </HubButton>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center">
                    <p className="text-lg font-semibold text-white">
                      No applications yet.
                    </p>
                    <p className="mt-2 text-sm text-zinc-400">
                      Start a new application to create your first tailored CV.
                    </p>
                    <HubButton
                      className="mt-5"
                      onClick={() => createApplication.mutate()}
                      type="button"
                    >
                      <Plus className="h-4 w-4" />
                      New Application
                    </HubButton>
                  </div>
                )}
              </div>
              </>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
