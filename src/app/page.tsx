"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";

import { AgentProgress } from "~/components/AgentProgress";
import { CandidateInput } from "~/components/CandidateInput";
import { CandidateProfileView } from "~/components/CandidateProfileView";
import { CVPlanView } from "~/components/CVPlanView";
import { CVPreview } from "~/components/CVPreview";
import { EvidenceMapView } from "~/components/EvidenceMapView";
import {
  GapQuestionsView,
  type GapAnswerDraft,
} from "~/components/GapQuestionsView";
import { JobDNAView } from "~/components/JobDNAView";
import { JobInput } from "~/components/JobInput";
import { ProgressStepper, type ProgressStep } from "~/components/ProgressStepper";
import { SummaryCard } from "~/components/SummaryCard";
import { api } from "~/trpc/react";

const currentApplicationStorageKey = "currentApplicationId";

export default function Home() {
  const utils = api.useUtils();
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [jobText, setJobText] = useState("");
  const [candidateText, setCandidateText] = useState("");
  const [gapAnswers, setGapAnswers] = useState<
    Record<string, GapAnswerDraft>
  >({});
  const [cvText, setCvText] = useState("");
  const [loadedDraftKey, setLoadedDraftKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isEditingJob, setIsEditingJob] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const jobRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const fitRef = useRef<HTMLDivElement>(null);
  const questionsRef = useRef<HTMLDivElement>(null);
  const cvRef = useRef<HTMLDivElement>(null);

  function scrollTo(ref: RefObject<HTMLDivElement | null>) {
    setTimeout(() => {
      ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  const createApplication = api.application.createApplication.useMutation({
    onSuccess: (data) => {
      localStorage.setItem(currentApplicationStorageKey, data.applicationId);
      setApplicationId(data.applicationId);
      setError(null);
    },
    onError: (mutationError) => setError(mutationError.message),
  });

  useEffect(() => {
    const storedApplicationId = localStorage.getItem(
      currentApplicationStorageKey
    );
    if (storedApplicationId) {
      setApplicationId(storedApplicationId);
      return;
    }
    createApplication.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stateQuery = api.application.getApplicationState.useQuery(
    { applicationId: applicationId ?? "" },
    { enabled: !!applicationId, retry: false }
  );

  useEffect(() => {
    if (
      applicationId &&
      stateQuery.data === null &&
      !createApplication.isPending
    ) {
      localStorage.removeItem(currentApplicationStorageKey);
      createApplication.mutate();
    }
  }, [applicationId, createApplication, stateQuery.data]);

  const state = stateQuery.data ?? null;
  const appIsReady = !!applicationId && !!state;
  const hasJob = !!state?.job;
  const hasProfile = !!state?.candidateProfile;
  const hasFit = !!state?.evidenceMatches.length;
  const hasQuestions = !!state?.gapQuestions.length;
  const hasAnswers = !!state?.gapAnswers.length;
  const hasStrategy = !!state?.cvStrategy;
  const hasCv = !!state?.cvDraft;
  const currentStep: ProgressStep = !hasJob
    ? "Job"
    : !hasProfile
      ? "Profile"
      : !hasFit
        ? "Fit"
        : !hasStrategy && (!hasQuestions || !hasAnswers)
          ? "Questions"
          : "CV";
  const primaryAction =
    !hasJob || isEditingJob
      ? "job"
      : !hasProfile || isEditingProfile
        ? "profile"
        : !hasFit
          ? "fit"
          : !hasStrategy && (!hasQuestions || !hasAnswers)
            ? "questions"
            : !hasStrategy
              ? "cvPlan"
              : !hasCv
                ? "cv"
                : null;

  const submitJob = api.application.submitJob.useMutation({
    onSuccess: async () => {
      if (applicationId) {
        await utils.application.getApplicationState.invalidate({
          applicationId,
        });
      }
      setIsEditingJob(false);
      setSuccessMessage("Job analyzed");
      scrollTo(profileRef);
      setError(null);
    },
    onError: (mutationError) => setError(mutationError.message),
  });

  const submitCandidate = api.application.submitCandidateInfo.useMutation({
    onSuccess: async () => {
      if (applicationId) {
        await utils.application.getApplicationState.invalidate({
          applicationId,
        });
      }
      setIsEditingProfile(false);
      setSuccessMessage("Profile built");
      scrollTo(fitRef);
      setError(null);
    },
    onError: (mutationError) => setError(mutationError.message),
  });

  const runMatching = api.application.runEvidenceMatching.useMutation({
    onSuccess: async () => {
      if (applicationId) {
        await utils.application.getApplicationState.invalidate({
          applicationId,
        });
      }
      setSuccessMessage("Fit checked");
      scrollTo(questionsRef);
      setError(null);
    },
    onError: (mutationError) => setError(mutationError.message),
  });

  const generateQuestions = api.application.generateGapQuestions.useMutation({
    onSuccess: async () => {
      if (applicationId) {
        await utils.application.getApplicationState.invalidate({
          applicationId,
        });
      }
      scrollTo(questionsRef);
      setError(null);
    },
    onError: (mutationError) => setError(mutationError.message),
  });

  const answerQuestions = api.application.answerGapQuestions.useMutation({
    onSuccess: async () => {
      if (applicationId) {
        await utils.application.getApplicationState.invalidate({
          applicationId,
        });
      }
      scrollTo(cvRef);
      setError(null);
    },
    onError: (mutationError) => setError(mutationError.message),
  });

  const generateStrategy = api.application.generateCvStrategy.useMutation({
    onSuccess: async () => {
      if (applicationId) {
        await utils.application.getApplicationState.invalidate({
          applicationId,
        });
      }
      scrollTo(cvRef);
      setError(null);
    },
    onError: (mutationError) => setError(mutationError.message),
  });

  const generateCv = api.application.generateCv.useMutation({
    onSuccess: async () => {
      if (applicationId) {
        await utils.application.getApplicationState.invalidate({
          applicationId,
        });
      }
      setSuccessMessage("CV ready");
      scrollTo(cvRef);
      setError(null);
    },
    onError: (mutationError) => setError(mutationError.message),
  });

  const rewriteSection = api.application.rewriteCvSection.useMutation({
    onSuccess: async () => {
      if (applicationId) {
        await utils.application.getApplicationState.invalidate({
          applicationId,
        });
      }
      scrollTo(cvRef);
      setError(null);
    },
    onError: (mutationError) => setError(mutationError.message),
  });

  useEffect(() => {
    const nextDraftKey = state?.cvDraft
      ? `${state.cvDraft.id}:${state.cvDraft.version}`
      : null;
    if (state?.cvDraft && nextDraftKey !== loadedDraftKey) {
      setLoadedDraftKey(nextDraftKey);
      setCvText(state.cvDraft.cvText);
    }
  }, [loadedDraftKey, state?.cvDraft]);

  const selectedGapAnswers = useMemo(
    () =>
      Object.entries(gapAnswers)
        .filter(([, answer]) => !!answer.buttonAnswer)
        .map(([gapQuestionId, answer]) => ({
          gapQuestionId,
          buttonAnswer: answer.buttonAnswer!,
          elaboration: answer.elaboration ?? null,
        })),
    [gapAnswers]
  );

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-6 text-zinc-950">
      <div className="mx-auto max-w-5xl">
        <header className="border-b border-zinc-200 pb-5">
          <h1 className="text-3xl font-semibold tracking-normal">Taylor CV</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Paste a role and your background, then create a focused tailored CV.
          </p>
        </header>

        <ProgressStepper currentStep={currentStep} />

        {error ? (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        {successMessage ? (
          <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            {successMessage}
          </div>
        ) : null}

        <div ref={jobRef}>
          {hasJob && !isEditingJob ? (
            <SummaryCard
              description={state.job?.summary}
              heading={state.job?.title ?? "Job analyzed"}
              meta={state.job?.company ?? null}
              onEdit={() => {
                setJobText(state.job?.rawText ?? "");
                setIsEditingJob(true);
                scrollTo(jobRef);
              }}
              title="Target Job"
            />
          ) : (
            <JobInput
              disabled={!appIsReady}
              isLoading={submitJob.isPending}
              isPrimary={primaryAction === "job"}
              onChange={setJobText}
              onSubmit={() => {
                if (!applicationId) return;
                submitJob.mutate({ applicationId, rawJobText: jobText });
              }}
              value={jobText}
            />
          )}
        </div>

        <JobDNAView
          job={state?.job ?? null}
          requirements={state?.jobRequirements ?? []}
        />

        <div ref={profileRef}>
          {hasProfile && !isEditingProfile ? (
            <SummaryCard
              description={state.candidateProfile?.summary}
              heading="Profile built"
              meta={`${state.candidateChunks.length} background evidence items`}
              onEdit={() => {
                setCandidateText(
                  state.candidateProfile?.rawBackgroundText ??
                    state.candidateProfile?.rawCvText ??
                    ""
                );
                setIsEditingProfile(true);
                scrollTo(profileRef);
              }}
              title="Your Background"
            />
          ) : (
            <CandidateInput
              disabled={!appIsReady || !state?.job}
              isLoading={submitCandidate.isPending}
              isPrimary={primaryAction === "profile"}
              onChange={setCandidateText}
              onSubmit={() => {
                if (!applicationId) return;
                submitCandidate.mutate({
                  applicationId,
                  rawCvText: null,
                  rawBackgroundText: candidateText,
                });
              }}
              value={candidateText}
            />
          )}
        </div>

        <CandidateProfileView
          evidence={state?.candidateChunks ?? []}
          profile={state?.candidateProfile ?? null}
        />

        <div ref={fitRef}>
          <EvidenceMapView
            disabled={
              !appIsReady || !state?.job || !state?.candidateChunks.length
            }
            isLoading={runMatching.isPending}
            isPrimary={primaryAction === "fit"}
            matches={state?.evidenceMatches ?? []}
            onRun={() => {
              if (!applicationId) return;
              runMatching.mutate({ applicationId });
            }}
          />
        </div>

        <div ref={questionsRef}>
          <GapQuestionsView
            answers={gapAnswers}
            disabled={!appIsReady || !state?.evidenceMatches.length}
            isGenerating={generateQuestions.isPending}
            isPrimary={primaryAction === "questions"}
            isSubmitting={answerQuestions.isPending}
            onChange={(questionId, answer) =>
              setGapAnswers((current) => ({
                ...current,
                [questionId]: answer,
              }))
            }
            onGenerate={() => {
              if (!applicationId) return;
              generateQuestions.mutate({ applicationId });
            }}
            onSkipAll={() => {
              if (!applicationId || !state?.gapQuestions.length) return;
              answerQuestions.mutate({
                applicationId,
                answers: state.gapQuestions.map((question) => ({
                  gapQuestionId: question.id,
                  buttonAnswer: "skip",
                  elaboration: null,
                })),
              });
            }}
            onSubmit={() => {
              if (!applicationId || selectedGapAnswers.length === 0) return;
              answerQuestions.mutate({
                applicationId,
                answers: selectedGapAnswers,
              });
            }}
            questions={state?.gapQuestions ?? []}
          />
        </div>

        <div ref={cvRef}>
          <CVPlanView strategy={state?.cvStrategy ?? null} />

          <CVPreview
            cvDraft={state?.cvDraft ?? null}
            disabled={!appIsReady || !state?.evidenceMatches.length}
            hasStrategy={!!state?.cvStrategy}
            isGeneratingCv={generateCv.isPending}
            isGeneratingStrategy={generateStrategy.isPending}
            isCvPrimary={primaryAction === "cv"}
            isPlanPrimary={primaryAction === "cvPlan"}
            isRewritingSection={rewriteSection.isPending}
            onChange={setCvText}
            onCopy={() =>
              void navigator.clipboard.writeText(
                state?.cvDraft?.cvText ?? cvText
              )
            }
            onGenerateCv={() => {
              if (!applicationId || !state?.cvStrategy) return;
              generateCv.mutate({
                applicationId,
                strategyId: state.cvStrategy.id,
              });
            }}
            onGenerateStrategy={() => {
              if (!applicationId) return;
              generateStrategy.mutate({ applicationId });
            }}
            onRewriteSection={(sectionId, instruction) => {
              if (!applicationId || !state?.cvDraft) return;
              rewriteSection.mutate({
                applicationId,
                cvDraftId: state.cvDraft.id,
                sectionId,
                instruction,
              });
            }}
            value={cvText}
          />
        </div>

        <AgentProgress
          agentRuns={state?.agentRuns ?? []}
          application={state?.application}
        />
      </div>
    </main>
  );
}
