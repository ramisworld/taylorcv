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
} from "~/server/services/applicationWorkflow.service";

const applicationIdSchema = z.object({
  applicationId: z.string().min(1),
});

export const applicationRouter = createTRPCRouter({
  createApplication: publicProcedure.mutation(({ ctx }) =>
    createApplication({
      anonymousSessionId: ctx.anonymousSessionId,
      clerkUserId: ctx.clerkUserId,
    })
  ),

  resetApplication: publicProcedure
    .input(applicationIdSchema)
    .mutation(({ ctx, input }) =>
      resetApplication({
        anonymousSessionId: ctx.anonymousSessionId,
        applicationId: input.applicationId,
        clerkUserId: ctx.clerkUserId,
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
        clerkUserId: ctx.clerkUserId,
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
        clerkUserId: ctx.clerkUserId,
        source: input.source,
        rawCvText: input.rawCvText,
        rawBackgroundText: input.rawBackgroundText,
        sourceUrl: input.sourceUrl,
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
        clerkUserId: ctx.clerkUserId,
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
        clerkUserId: ctx.clerkUserId,
        strategyId: input.strategyId,
      })
    ),

  getApplicationState: publicProcedure
    .input(applicationIdSchema)
    .query(({ ctx, input }) =>
      getApplicationState({
        anonymousSessionId: ctx.anonymousSessionId,
        applicationId: input.applicationId,
        clerkUserId: ctx.clerkUserId,
      })
    ),

  claimApplication: protectedProcedure
    .input(applicationIdSchema)
    .mutation(({ ctx, input }) =>
      claimApplication({
        anonymousSessionId: ctx.anonymousSessionId,
        applicationId: input.applicationId,
        clerkUserId: ctx.clerkUserId,
      })
    ),

  listUserApplications: protectedProcedure.query(({ ctx }) =>
    listUserApplications({ clerkUserId: ctx.clerkUserId })
  ),

  getApplicationExportData: protectedProcedure
    .input(applicationIdSchema)
    .mutation(({ ctx, input }) =>
      getApplicationExportData({
        clerkUserId: ctx.clerkUserId,
        applicationId: input.applicationId,
      })
    ),
});
