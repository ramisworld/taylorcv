"use client";

import { AnimatePresence } from "framer-motion";
import { Loader2, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { CvGeneratingStep } from "~/components/cv-flow/CvGeneratingStep";
import { CvUploadStep } from "~/components/cv-flow/CvUploadStep";
import { FinalCvStep } from "~/components/cv-flow/FinalCvStep";
import { GapQuestionsStep } from "~/components/cv-flow/GapQuestionsStep";
import { JobDescriptionStep } from "~/components/cv-flow/JobDescriptionStep";
import { LandingPage } from "~/components/landing/LandingPage";
import { useSession } from "~/lib/auth-client";
import { parseStructuredCv } from "~/lib/cvDocument";
import { exportCvDocx, exportCvPdf } from "~/lib/cvExport";
import type { PlanKey } from "~/lib/plans";
import { api, type RouterOutputs } from "~/trpc/react";

const currentApplicationStorageKey = "currentApplicationId";
const staleApplicationErrorFragments = [
  "does not belong to this anonymous session",
  "does not belong to this session",
] as const;

type ApplicationState = NonNullable<RouterOutputs["application"]["getApplicationState"]>;

type FlowStage =
  | "job_description"
  | "cv_upload"
  | "gap_questions"
  | "cv_generating"
  | "final_cv";

function isStaleApplicationError(message: string) {
  const normalized = message.toLowerCase();
  return staleApplicationErrorFragments.some((fragment) => normalized.includes(fragment));
}

function clientErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Taylor could not start a new CV.";
}

function friendlyError(message: string) {
  if (/Unexpected token|<!DOCTYPE|not valid JSON|JSON\.parse|html/i.test(message)) {
    return "Taylor could not reach the analysis service cleanly. Check that the app server is running, then try again.";
  }
  if (/OpenAI Responses API (?:failed|returned)|OpenAI Responses API failed with HTTP|HTML error page returned by upstream/i.test(message)) {
    return "Taylor could not complete the AI step. Review your API configuration or try again shortly.";
  }
  if (message === "ACCOUNT_REQUIRED") return "Sign in to export your CV.";
  if (message === "QUOTA_EXCEEDED" || message === "FREE_CV_LIMIT_REACHED") {
    return "Your current plan has no CV exports remaining.";
  }
  return message;
}

function deriveFlowStage(state: ApplicationState | null): FlowStage {
  if (state?.cvDraft) return "final_cv";
  if (state?.gapQuestions.length) return "gap_questions";
  if (state?.job) return "cv_upload";
  return "job_description";
}

function hasOpenQuestions(state: ApplicationState | null) {
  return (state?.gapQuestions ?? []).some(
    (question) => question.status === "unanswered" && question.question.trim()
  );
}

function AppChrome(props: {
  applicationId: string | null;
  isResetting: boolean;
  onReset: () => void;
  children: React.ReactNode;
}) {
  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-[#edf3ff] text-[#080d22]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_15%_0%,rgba(99,151,255,0.28),transparent_34%),radial-gradient(ellipse_at_88%_18%,rgba(70,214,190,0.18),transparent_30%),linear-gradient(180deg,#f8fbff_0%,#edf3ff_48%,#e9f1ff_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-white/38 backdrop-blur-2xl" />
      <header className="relative z-20 flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-2.5">
          <img
            alt=""
            aria-hidden="true"
            className="h-9 w-9 shrink-0 object-contain"
            src="/assets/taylorcv-logo-transparent.png"
          />
          <span className="truncate text-[24px] font-bold tracking-[-0.04em] text-[#080d22]">
            TaylorCV
          </span>
        </div>
        <button
          className="inline-flex h-10 items-center justify-center gap-2 rounded-[10px] border border-[#d8e0ee]/90 bg-white/62 px-4 text-[13px] font-semibold text-[#314066] shadow-sm backdrop-blur-xl transition hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2047f0]/14 disabled:cursor-not-allowed disabled:opacity-55"
          disabled={!props.applicationId || props.isResetting}
          onClick={props.onReset}
          type="button"
        >
          {props.isResetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
          New CV
        </button>
      </header>
      <div className="relative z-10 min-h-[calc(100dvh-64px)]">{props.children}</div>
    </main>
  );
}

export default function Home() {
  const utils = api.useUtils();
  const session = useSession();
  const [showLanding, setShowLanding] = useState(true);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [resumedApplicationId, setResumedApplicationId] = useState<string | null>(null);
  const [stage, setStage] = useState<FlowStage>("job_description");
  const [jobText, setJobText] = useState("");
  const [candidateText, setCandidateText] = useState("");
  const [candidateFileName, setCandidateFileName] = useState<string | null>(null);
  const [isCandidateFileReading, setIsCandidateFileReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const recoveryPromiseRef = useRef<Promise<string | null> | null>(null);

  const checkout = api.billing.createCheckoutSession.useMutation({
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (mutationError) => {
      if (mutationError.message === "ALREADY_HAS_SUBSCRIPTION") {
        window.location.href = "/dashboard";
        return;
      }
      setError(friendlyError(mutationError.message));
    },
  });

  const createApplication = api.application.createApplication.useMutation({
    onSuccess: (data) => {
      localStorage.setItem(currentApplicationStorageKey, data.applicationId);
      setApplicationId(data.applicationId);
      setResumedApplicationId(null);
      setShowLanding(false);
      setStage("job_description");
      window.history.pushState(null, "", `/?applicationId=${data.applicationId}`);
    },
    onError: (mutationError) => setError(friendlyError(mutationError.message)),
  });

  const stateQuery = api.application.getApplicationState.useQuery(
    { applicationId: applicationId ?? "" },
    {
      enabled: !!applicationId,
      retry: false,
    }
  );
  const state = stateQuery.data ?? null;
  const cv = useMemo(
    () => parseStructuredCv(state?.cvDraft?.cvJson ?? null),
    [state?.cvDraft?.cvJson]
  );

  function recoverFromStaleApplication(preserveDraft = true) {
    localStorage.removeItem(currentApplicationStorageKey);
    setApplicationId(null);
    setResumedApplicationId(null);
    setShowLanding(false);
    setStage("job_description");
    setError(null);
    window.history.replaceState(null, "", "/");

    if (!preserveDraft) {
      setJobText("");
      setCandidateText("");
      setCandidateFileName(null);
    }

    recoveryPromiseRef.current ??= createApplication
      .mutateAsync()
      .then((data) => data.applicationId)
      .catch((recoveryError) => {
        setError(clientErrorMessage(recoveryError));
        return null;
      })
      .finally(() => {
        recoveryPromiseRef.current = null;
      });

    return recoveryPromiseRef.current;
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("applicationId");
    if (requested) {
      localStorage.setItem(currentApplicationStorageKey, requested);
      setApplicationId(requested);
      setShowLanding(false);
      return;
    }
    setShowLanding(true);
  }, []);

  useEffect(() => {
    if (!applicationId || !state || resumedApplicationId === applicationId) return;
    setResumedApplicationId(applicationId);
    if (stage !== "cv_generating") {
      setStage(deriveFlowStage(state));
    }
    setJobText((current) => state.job?.rawText ?? current);
    setCandidateText((current) => state.candidateProfileRow?.rawCvText ?? current);
  }, [applicationId, resumedApplicationId, stage, state]);

  useEffect(() => {
    if (!applicationId || !stateQuery.error) return;
    if (isStaleApplicationError(stateQuery.error.message)) {
      void recoverFromStaleApplication(true);
      return;
    }
    setError(friendlyError(stateQuery.error.message));
  }, [applicationId, stateQuery.error]);

  const submitJob = api.application.submitJob.useMutation({
    onSuccess: async (_data, variables) => {
      localStorage.setItem(currentApplicationStorageKey, variables.applicationId);
      await utils.application.getApplicationState.invalidate({
        applicationId: variables.applicationId,
      });
      setStage("cv_upload");
      setError(null);
    },
    onError: (mutationError, variables) => {
      if (isStaleApplicationError(mutationError.message)) {
        void recoverFromStaleApplication(true).then((freshApplicationId) => {
          if (!freshApplicationId) return;
          setError(null);
          submitJob.mutate({
            applicationId: freshApplicationId,
            rawJobText: variables.rawJobText,
          });
        });
        return;
      }
      setError(friendlyError(mutationError.message));
      setStage("job_description");
    },
  });

  const submitCandidate = api.application.submitCandidate.useMutation({
    onSuccess: async (_data, variables) => {
      await utils.application.getApplicationState.invalidate({
        applicationId: variables.applicationId,
      });
      setStage("gap_questions");
      setError(null);
    },
    onError: (mutationError) => {
      if (isStaleApplicationError(mutationError.message)) {
        void recoverFromStaleApplication(true);
        return;
      }
      setError(friendlyError(mutationError.message));
      if (hasOpenQuestions(state)) {
        setStage("gap_questions");
      }
    },
  });

  const submitGapAnswers = api.application.submitGapAnswers.useMutation({
    onSuccess: async (_data, variables) => {
      await utils.application.getApplicationState.invalidate({
        applicationId: variables.applicationId,
      });
      startCvGeneration(variables.applicationId);
    },
    onError: (mutationError) => {
      if (isStaleApplicationError(mutationError.message)) {
        void recoverFromStaleApplication(true);
        return;
      }
      setError(friendlyError(mutationError.message));
      setStage("gap_questions");
    },
  });

  const generateCv = api.application.generateCv.useMutation({
    onSuccess: async (_data, variables) => {
      await utils.application.getApplicationState.invalidate({
        applicationId: variables.applicationId,
      });
      setStage("final_cv");
      setError(null);
    },
    onError: (mutationError) => {
      if (isStaleApplicationError(mutationError.message)) {
        void recoverFromStaleApplication(true);
        return;
      }
      setError(friendlyError(mutationError.message));
      setStage("gap_questions");
    },
  });

  const authorizeExport = api.application.authorizeExport.useMutation();

  const resetApplication = api.application.resetApplication.useMutation({
    onSuccess: (data) => {
      localStorage.setItem(currentApplicationStorageKey, data.applicationId);
      setApplicationId(data.applicationId);
      setResumedApplicationId(null);
      setShowLanding(false);
      setStage("job_description");
      setJobText("");
      setCandidateText("");
      setCandidateFileName(null);
      setError(null);
      setExportError(null);
      window.history.replaceState(null, "", `/?applicationId=${data.applicationId}`);
    },
    onError: (mutationError) => {
      if (isStaleApplicationError(mutationError.message)) {
        void recoverFromStaleApplication(false);
        return;
      }
      setError(friendlyError(mutationError.message));
    },
  });

  async function readCandidateFile(file: File) {
    setIsCandidateFileReading(true);
    setCandidateFileName(file.name);
    try {
      const name = file.name.toLowerCase();
      let text = "";
      if (file.type === "application/pdf" || name.endsWith(".pdf")) {
        const pdfjs = await import("pdfjs-dist/webpack.mjs");
        const data = new Uint8Array(await file.arrayBuffer());
        const pdf = await pdfjs.getDocument({ data }).promise;
        const pages: string[] = [];
        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          const page = await pdf.getPage(pageNumber);
          const content = await page.getTextContent();
          pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
        }
        text = pages.join("\n\n");
      } else if (name.endsWith(".docx")) {
        const mammoth = await import("mammoth");
        const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
        text = result.value;
      } else {
        text = await file.text();
      }
      if (!text.trim()) {
        setError("Taylor could not read text from that file. Paste your CV text instead.");
        return;
      }
      setCandidateText(text.slice(0, 30_000));
      setError(null);
    } catch (error) {
      console.error("CV file read error:", error);
      setError("Taylor could not read that file. Paste your CV text instead.");
    } finally {
      setIsCandidateFileReading(false);
    }
  }

  function enterWorkspace() {
    setError(null);
    const storedApplicationId = localStorage.getItem(currentApplicationStorageKey);
    if (storedApplicationId) {
      setApplicationId(storedApplicationId);
      setShowLanding(false);
      setStage("job_description");
      window.history.pushState(null, "", `/?applicationId=${storedApplicationId}`);
      return;
    }
    createApplication.mutate();
  }

  function selectPlan(planKey: PlanKey) {
    if (planKey === "free") {
      enterWorkspace();
      return;
    }
    if (!session.data?.user) {
      localStorage.setItem("pendingPlanKey", planKey);
      window.location.href = `/auth/sign-up?returnTo=${encodeURIComponent(`/dashboard?checkoutPlan=${planKey}`)}`;
      return;
    }
    checkout.mutate({ planKey: planKey as Exclude<PlanKey, "free"> });
  }

  function startCvGeneration(targetApplicationId = applicationId) {
    if (!targetApplicationId) return;
    setStage("cv_generating");
    setError(null);
    generateCv.mutate({ applicationId: targetApplicationId });
  }

  async function exportWithGate(kind: "pdf" | "docx") {
    if (!cv || !applicationId || !state?.cvDraft) return;
    setExportError(null);
    setIsExporting(true);
    try {
      await authorizeExport.mutateAsync({
        applicationId,
        cvDraftId: state.cvDraft.id,
      });
      if (kind === "pdf") await exportCvPdf(cv, state.cvDraft.presentationJson);
      else await exportCvDocx(cv, state.cvDraft.presentationJson);
    } catch (exportFailure) {
      const message =
        exportFailure instanceof Error ? exportFailure.message : "Export failed.";
      if (message === "ACCOUNT_REQUIRED") {
        const next = `/?applicationId=${applicationId}`;
        window.location.href = `/auth/claim?applicationId=${encodeURIComponent(applicationId)}&next=${encodeURIComponent(next)}`;
        return;
      }
      setExportError(friendlyError(message));
    } finally {
      setIsExporting(false);
    }
  }

  if (showLanding) {
    return (
      <LandingPage
        error={error}
        isCheckoutLoading={checkout.isPending}
        isLoading={createApplication.isPending}
        isSignedIn={!!session.data?.user}
        onDashboard={() => {
          window.location.href = "/dashboard";
        }}
        onGetStarted={enterWorkspace}
        onPlanSelected={selectPlan}
      />
    );
  }

  const waiting =
    submitJob.isPending ||
    submitCandidate.isPending ||
    submitGapAnswers.isPending ||
    generateCv.isPending;

  return (
    <AppChrome
      applicationId={applicationId}
      isResetting={resetApplication.isPending}
      onReset={() => {
        if (applicationId) resetApplication.mutate({ applicationId });
      }}
    >
      <AnimatePresence mode="wait">
        {stage === "job_description" ? (
          <JobDescriptionStep
            error={error}
            isLoading={submitJob.isPending}
            key="job"
            onChange={setJobText}
            onSubmit={() => {
              if (!applicationId) return;
              setError(null);
              submitJob.mutate({ applicationId, rawJobText: jobText });
            }}
            value={jobText}
          />
        ) : null}
        {stage === "cv_upload" ? (
          <CvUploadStep
            error={error}
            fileName={candidateFileName}
            isLoading={submitCandidate.isPending}
            isReadingFile={isCandidateFileReading}
            key="cv-upload"
            onBack={() => setStage("job_description")}
            onChange={setCandidateText}
            onFile={(file) => void readCandidateFile(file)}
            onSubmit={() => {
              if (!applicationId) return;
              setError(null);
              submitCandidate.mutate({ applicationId, rawCvText: candidateText });
            }}
            value={candidateText}
          />
        ) : null}
        {stage === "gap_questions" ? (
          <GapQuestionsStep
            error={error}
            isLoading={waiting}
            key="gap-questions"
            onBack={() => setStage("cv_upload")}
            onSkip={() => {
              if (!applicationId) return;
              if (hasOpenQuestions(state)) {
                submitGapAnswers.mutate({
                  applicationId,
                  answers: (state?.gapQuestions ?? []).map((question) => ({
                    gapQuestionId: question.id,
                    answerText: null,
                    skipped: true,
                  })),
                });
                return;
              }
              startCvGeneration();
            }}
            onSubmit={(answers) => {
              if (!applicationId) return;
              setError(null);
              submitGapAnswers.mutate({ applicationId, answers });
            }}
            questions={state?.gapQuestions ?? []}
          />
        ) : null}
        {stage === "cv_generating" ? <CvGeneratingStep key="generating" /> : null}
        {stage === "final_cv" ? (
          <FinalCvStep
            cv={cv}
            exportError={exportError}
            isExporting={isExporting || authorizeExport.isPending}
            isSignedIn={!!session.data?.user}
            key="final"
            onDocx={() => void exportWithGate("docx")}
            onNew={() => {
              if (applicationId) resetApplication.mutate({ applicationId });
            }}
            onPdf={() => void exportWithGate("pdf")}
            presentationJson={state?.cvDraft?.presentationJson}
          />
        ) : null}
      </AnimatePresence>
    </AppChrome>
  );
}
