import { z } from "zod";
import { TRPCError } from "@trpc/server";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { db } from "~/server/db";

const applicationIdSchema = z.object({
  applicationId: z.string().min(1),
});

async function assertApplicationOwnership(args: {
  applicationId: string;
  anonymousSessionId: string;
  userId?: string | null;
}) {
  const application = await db.application.findFirst({
    where: {
      id: args.applicationId,
      OR: [
        { anonymousSessionId: args.anonymousSessionId },
        ...(args.userId ? [{ userId: args.userId }] : []),
      ],
    },
  });

  if (!application) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Application does not belong to this session",
    });
  }

  return application;
}

export const applicationRouter = createTRPCRouter({
  getLandingActivity: publicProcedure.query(async () => {
    const count = await db.application.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    });
    return { count };
  }),

  createApplication: publicProcedure.mutation(async ({ ctx }) => {
    const application = await db.application.create({
      data: {
        anonymousSessionId: ctx.anonymousSessionId,
        userId: ctx.userId ?? null,
        status: "started",
        currentStep: "started",
      },
    });
    return { applicationId: application.id };
  }),

  resetApplication: publicProcedure
    .input(applicationIdSchema)
    .mutation(async ({ ctx, input }) => {
      await assertApplicationOwnership({
        applicationId: input.applicationId,
        anonymousSessionId: ctx.anonymousSessionId,
        userId: ctx.userId,
      });

      const newApplication = await db.application.create({
        data: {
          anonymousSessionId: ctx.anonymousSessionId,
          userId: ctx.userId ?? null,
          status: "started",
          currentStep: "started",
        },
      });

      return { applicationId: newApplication.id };
    }),

  submitJob: publicProcedure
    .input(
      applicationIdSchema.extend({
        rawJobText: z.string().min(1).max(20_000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertApplicationOwnership({
        applicationId: input.applicationId,
        anonymousSessionId: ctx.anonymousSessionId,
        userId: ctx.userId,
      });

      throw new TRPCError({
        code: "NOT_IMPLEMENTED",
        message: "CV workflow is being rebuilt. Job submission not available yet.",
      });
    }),

  submitCandidate: publicProcedure
    .input(
      applicationIdSchema.extend({
        rawCvText: z.string().min(1).max(30_000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertApplicationOwnership({
        applicationId: input.applicationId,
        anonymousSessionId: ctx.anonymousSessionId,
        userId: ctx.userId,
      });

      throw new TRPCError({
        code: "NOT_IMPLEMENTED",
        message: "CV workflow is being rebuilt. Candidate submission not available yet.",
      });
    }),

  submitGapAnswers: publicProcedure
    .input(
      applicationIdSchema.extend({
        answers: z.array(
          z.object({
            gapQuestionId: z.string().min(1),
            answerText: z.string().nullable(),
            skipped: z.boolean(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertApplicationOwnership({
        applicationId: input.applicationId,
        anonymousSessionId: ctx.anonymousSessionId,
        userId: ctx.userId,
      });

      throw new TRPCError({
        code: "NOT_IMPLEMENTED",
        message: "CV workflow is being rebuilt. Gap answers not available yet.",
      });
    }),

  generateCv: publicProcedure
    .input(applicationIdSchema)
    .mutation(async ({ ctx, input }) => {
      await assertApplicationOwnership({
        applicationId: input.applicationId,
        anonymousSessionId: ctx.anonymousSessionId,
        userId: ctx.userId,
      });

      throw new TRPCError({
        code: "NOT_IMPLEMENTED",
        message: "CV workflow is being rebuilt. CV generation not available yet.",
      });
    }),

  getApplicationState: publicProcedure
    .input(applicationIdSchema)
    .query(async ({ ctx, input }) => {
      const application = await assertApplicationOwnership({
        applicationId: input.applicationId,
        anonymousSessionId: ctx.anonymousSessionId,
        userId: ctx.userId,
      });

      const [job, candidateProfileRow, gapQuestions, gapAnswers, cvDraft] = await Promise.all([
        db.job.findUnique({ where: { applicationId: input.applicationId } }),
        db.candidateProfile.findFirst({
          where: { sourceApplicationId: input.applicationId },
          orderBy: { createdAt: "desc" },
        }),
        db.gapQuestion.findMany({
          where: { applicationId: input.applicationId },
          orderBy: { createdAt: "asc" },
        }),
        db.gapAnswer.findMany({
          where: { applicationId: input.applicationId },
          orderBy: { createdAt: "asc" },
        }),
        db.cvDraft.findFirst({
          where: { applicationId: input.applicationId },
          orderBy: { version: "desc" },
        }),
      ]);

      return {
        application,
        job,
        candidateProfileRow,
        gapQuestions,
        gapAnswers,
        cvDraft,
        cvJson: cvDraft?.cvJson ?? null,
        cvText: cvDraft?.cvText ?? null,
      };
    }),

  authorizeExport: publicProcedure
    .input(
      applicationIdSchema.extend({
        cvDraftId: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertApplicationOwnership({
        applicationId: input.applicationId,
        anonymousSessionId: ctx.anonymousSessionId,
        userId: ctx.userId,
      });

      throw new TRPCError({
        code: "NOT_IMPLEMENTED",
        message: "CV workflow is being rebuilt. Export authorization not available yet.",
      });
    }),

  claimApplication: protectedProcedure
    .input(applicationIdSchema)
    .mutation(async ({ ctx, input }) => {
      const application = await assertApplicationOwnership({
        applicationId: input.applicationId,
        anonymousSessionId: ctx.anonymousSessionId,
        userId: ctx.userId,
      });

      if (!ctx.userId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Must be signed in to claim an application",
        });
      }

      await db.application.update({
        where: { id: input.applicationId },
        data: { userId: ctx.userId },
      });

      return { success: true };
    }),

  listUserApplications: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.userId) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Must be signed in",
      });
    }

    const applications = await db.application.findMany({
      where: { userId: ctx.userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return { applications };
  }),

  getApplicationExportData: protectedProcedure
    .input(applicationIdSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.userId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Must be signed in",
        });
      }

      const application = await db.application.findFirst({
        where: {
          id: input.applicationId,
          userId: ctx.userId,
        },
        include: {
          cvDrafts: {
            orderBy: { version: "desc" },
            take: 1,
          },
        },
      });

      if (!application) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Application not found",
        });
      }

      const cvDraft = application.cvDrafts[0];

      return {
        applicationId: application.id,
        cvJson: cvDraft?.cvJson ?? null,
        cvText: cvDraft?.cvText ?? null,
        presentationJson: cvDraft?.presentationJson ?? null,
      };
    }),
});
