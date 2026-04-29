"use client";

import { useEffect, useMemo, useState } from "react";

import { AgentProgress } from "~/components/AgentProgress";
import { CandidateInput } from "~/components/CandidateInput";
import { CVPreview } from "~/components/CVPreview";
import { EvidenceMapView } from "~/components/EvidenceMapView";
import {
  GapQuestionsView,
  type GapAnswerDraft,
} from "~/components/GapQuestionsView";
import { JobDNAView } from "~/components/JobDNAView";
import { JobInput } from "~/components/JobInput";
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
  const [loadedDraftId, setLoadedDraftId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const submitJob = api.application.submitJob.useMutation({
    onSuccess: async () => {
      if (applicationId) {
        await utils.application.getApplicationState.invalidate({
          applicationId,
        });
      }
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
      setError(null);
    },
    onError: (mutationError) => setError(mutationError.message),
  });

  useEffect(() => {
    if (state?.cvDraft && state.cvDraft.id !== loadedDraftId) {
      setLoadedDraftId(state.cvDraft.id);
      setCvText(state.cvDraft.cvText);
    }
  }, [loadedDraftId, state?.cvDraft]);

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
            Minimal AI CV tailoring MVP.
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            Application: {applicationId ?? "creating..."}
          </p>
        </header>

        {error ? (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <AgentProgress
          agentRuns={state?.agentRuns ?? []}
          application={state?.application}
        />

        <JobInput
          disabled={!appIsReady}
          isLoading={submitJob.isPending}
          onChange={setJobText}
          onSubmit={() => {
            if (!applicationId) return;
            submitJob.mutate({ applicationId, rawJobText: jobText });
          }}
          value={jobText}
        />

        <JobDNAView
          job={state?.job ?? null}
          requirements={state?.jobRequirements ?? []}
        />

        <CandidateInput
          disabled={!appIsReady || !state?.job}
          isLoading={submitCandidate.isPending}
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

        {state?.candidateProfile ? (
          <section className="space-y-3 border-b border-zinc-200 py-6">
            <h2 className="text-lg font-semibold text-zinc-950">
              Candidate profile
            </h2>
            <p className="text-sm text-zinc-700">
              {state.candidateProfile.summary}
            </p>
            <div className="space-y-2">
              {state.candidateChunks.map((chunk) => (
                <p
                  className="rounded-md border border-zinc-200 p-3 text-sm text-zinc-700"
                  key={chunk.id}
                >
                  {chunk.content}
                </p>
              ))}
            </div>
          </section>
        ) : null}

        <EvidenceMapView
          disabled={!appIsReady || !state?.job || !state?.candidateChunks.length}
          isLoading={runMatching.isPending}
          matches={state?.evidenceMatches ?? []}
          onRun={() => {
            if (!applicationId) return;
            runMatching.mutate({ applicationId });
          }}
        />

        <GapQuestionsView
          answers={gapAnswers}
          disabled={!appIsReady || !state?.evidenceMatches.length}
          isGenerating={generateQuestions.isPending}
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
          onSubmit={() => {
            if (!applicationId || selectedGapAnswers.length === 0) return;
            answerQuestions.mutate({
              applicationId,
              answers: selectedGapAnswers,
            });
          }}
          questions={state?.gapQuestions ?? []}
        />

        {state?.cvStrategy ? (
          <section className="space-y-2 border-b border-zinc-200 py-6">
            <h2 className="text-lg font-semibold text-zinc-950">
              CV strategy
            </h2>
            <p className="text-sm text-zinc-700">
              {state.cvStrategy.strategySummary}
            </p>
            <p className="text-sm text-zinc-600">
              {state.cvStrategy.targetPositioning}
            </p>
          </section>
        ) : null}

        <CVPreview
          disabled={!appIsReady || !state?.evidenceMatches.length}
          hasStrategy={!!state?.cvStrategy}
          isGeneratingCv={generateCv.isPending}
          isGeneratingStrategy={generateStrategy.isPending}
          onChange={setCvText}
          onCopy={() => void navigator.clipboard.writeText(cvText)}
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
          value={cvText}
        />
      </div>
    </main>
  );
}
