import { z } from "zod";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import {
  answerGapQuestions,
  claimApplication,
  createApplication,
  generateCv,
  getApplicationExportData,
  getApplicationState,
  listUserApplications,
  resetApplication,
  submitCandidateProfileSource,
  submitJob,
  useSavedCandidateMemory,
} from "~/server/services/applicationWorkflow.service";

const applicationIdSchema = z.object({
  applicationId: z.string().min(1),
});

export const applicationRouter = createTRPCRouter({
  createApplication: publicProcedure.mutation(({ ctx }) =>
    createApplication({
      anonymousSessionId: ctx.anonymousSessionId,
      userId: ctx.userId,
    })
  ),

  resetApplication: publicProcedure
    .input(applicationIdSchema)
    .mutation(({ ctx, input }) =>
      resetApplication({
        anonymousSessionId: ctx.anonymousSessionId,
        applicationId: input.applicationId,
        userId: ctx.userId,
      })
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
        userId: ctx.userId,
        headers: ctx.headers,
        resHeaders: ctx.resHeaders,
        rawJobText: input.rawJobText,
      })
    ),

  submitCandidateProfileSource: publicProcedure
    .input(
      applicationIdSchema
        .extend({
          source: z.enum(["cv_upload", "linkedin_url"]),
          rawCvText: z.string().nullable().optional(),
          rawBackgroundText: z.string().nullable().optional(),
          sourceUrl: z.string().nullable().optional(),
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
      submitCandidateProfileSource({
        anonymousSessionId: ctx.anonymousSessionId,
        applicationId: input.applicationId,
        userId: ctx.userId,
        headers: ctx.headers,
        resHeaders: ctx.resHeaders,
        source: input.source,
        rawCvText: input.rawCvText,
        rawBackgroundText: input.rawBackgroundText,
        sourceUrl: input.sourceUrl,
      })
    ),

  useSavedCandidateMemory: publicProcedure
    .input(applicationIdSchema)
    .mutation(({ ctx, input }) =>
      useSavedCandidateMemory({
        anonymousSessionId: ctx.anonymousSessionId,
        applicationId: input.applicationId,
        userId: ctx.userId,
      })
    ),

  answerGapQuestions: publicProcedure
    .input(
      applicationIdSchema.extend({
        answers: z.array(
          z.object({
            gapQuestionId: z.string().min(1),
            answerText: z.string().nullable().optional(),
            selectedOption: z.string().nullable().optional(),
            followUpText: z.string().nullable().optional(),
            metricText: z.string().nullable().optional(),
            skipped: z.boolean().nullable().optional(),
          })
        ),
      })
    )
    .mutation(({ ctx, input }) =>
      answerGapQuestions({
        anonymousSessionId: ctx.anonymousSessionId,
        applicationId: input.applicationId,
        userId: ctx.userId,
        answers: input.answers,
      })
    ),

  generateCv: publicProcedure
    .input(
      applicationIdSchema.extend({
        strategyId: z.string().min(1).nullable().optional(),
      })
    )
    .mutation(({ ctx, input }) =>
      generateCv({
        anonymousSessionId: ctx.anonymousSessionId,
        applicationId: input.applicationId,
        userId: ctx.userId,
        headers: ctx.headers,
        resHeaders: ctx.resHeaders,
        strategyId: input.strategyId,
      })
    ),

  getApplicationState: publicProcedure
    .input(applicationIdSchema)
    .query(({ ctx, input }) =>
      getApplicationState({
        anonymousSessionId: ctx.anonymousSessionId,
        applicationId: input.applicationId,
        userId: ctx.userId,
      })
    ),

  claimApplication: protectedProcedure
    .input(applicationIdSchema)
    .mutation(({ ctx, input }) =>
      claimApplication({
        anonymousSessionId: ctx.anonymousSessionId,
        applicationId: input.applicationId,
        userId: ctx.userId,
      })
    ),

  listUserApplications: protectedProcedure.query(({ ctx }) =>
    listUserApplications({ userId: ctx.userId })
  ),

  getApplicationExportData: protectedProcedure
    .input(applicationIdSchema)
    .mutation(({ ctx, input }) =>
      getApplicationExportData({
        userId: ctx.userId,
        applicationId: input.applicationId,
      })
    ),
});
