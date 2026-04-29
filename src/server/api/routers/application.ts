import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import {
  answerGapQuestions,
  createApplication,
  generateCv,
  generateCvStrategy,
  generateGapQuestions,
  getApplicationState,
  rewriteCvSection,
  runEvidenceMatching,
  submitCandidateInfo,
  submitJob,
} from "~/server/services/applicationWorkflow.service";

const applicationIdSchema = z.object({
  applicationId: z.string().min(1),
});

export const applicationRouter = createTRPCRouter({
  createApplication: publicProcedure.mutation(({ ctx }) =>
    createApplication({ anonymousSessionId: ctx.anonymousSessionId })
  ),

  submitJob: publicProcedure
    .input(
      applicationIdSchema.extend({
        rawJobText: z.string().min(1).max(20_000),
      })
    )
    .mutation(({ ctx, input }) =>
      submitJob({
        anonymousSessionId: ctx.anonymousSessionId,
        applicationId: input.applicationId,
        rawJobText: input.rawJobText,
      })
    ),

  submitCandidateInfo: publicProcedure
    .input(
      applicationIdSchema
        .extend({
          rawCvText: z.string().nullable().optional(),
          rawBackgroundText: z.string().nullable().optional(),
        })
        .refine(
          (input) =>
            (input.rawCvText?.length ?? 0) +
              (input.rawBackgroundText?.length ?? 0) <=
            30_000,
          "Candidate background must be 30,000 characters or fewer"
        )
    )
    .mutation(({ ctx, input }) =>
      submitCandidateInfo({
        anonymousSessionId: ctx.anonymousSessionId,
        applicationId: input.applicationId,
        rawCvText: input.rawCvText,
        rawBackgroundText: input.rawBackgroundText,
      })
    ),

  runEvidenceMatching: publicProcedure
    .input(applicationIdSchema)
    .mutation(({ ctx, input }) =>
      runEvidenceMatching({
        anonymousSessionId: ctx.anonymousSessionId,
        applicationId: input.applicationId,
      })
    ),

  generateGapQuestions: publicProcedure
    .input(applicationIdSchema)
    .mutation(({ ctx, input }) =>
      generateGapQuestions({
        anonymousSessionId: ctx.anonymousSessionId,
        applicationId: input.applicationId,
      })
    ),

  answerGapQuestions: publicProcedure
    .input(
      applicationIdSchema.extend({
        answers: z.array(
          z.object({
            gapQuestionId: z.string().min(1),
            buttonAnswer: z.enum(["yes", "kind_of", "no", "skip"]),
            elaboration: z.string().nullable().optional(),
          })
        ),
      })
    )
    .mutation(({ ctx, input }) =>
      answerGapQuestions({
        anonymousSessionId: ctx.anonymousSessionId,
        applicationId: input.applicationId,
        answers: input.answers,
      })
    ),

  generateCvStrategy: publicProcedure
    .input(applicationIdSchema)
    .mutation(({ ctx, input }) =>
      generateCvStrategy({
        anonymousSessionId: ctx.anonymousSessionId,
        applicationId: input.applicationId,
      })
    ),

  generateCv: publicProcedure
    .input(
      applicationIdSchema.extend({
        strategyId: z.string().min(1),
      })
    )
    .mutation(({ ctx, input }) =>
      generateCv({
        anonymousSessionId: ctx.anonymousSessionId,
        applicationId: input.applicationId,
        strategyId: input.strategyId,
      })
    ),

  rewriteCvSection: publicProcedure
    .input(
      applicationIdSchema.extend({
        cvDraftId: z.string().min(1),
        sectionId: z.string().min(1),
        instruction: z.string().min(1),
      })
    )
    .mutation(({ ctx, input }) =>
      rewriteCvSection({
        anonymousSessionId: ctx.anonymousSessionId,
        applicationId: input.applicationId,
        cvDraftId: input.cvDraftId,
        sectionId: input.sectionId,
        instruction: input.instruction,
      })
    ),

  getApplicationState: publicProcedure
    .input(applicationIdSchema)
    .query(({ ctx, input }) =>
      getApplicationState({
        anonymousSessionId: ctx.anonymousSessionId,
        applicationId: input.applicationId,
      })
    ),
});
