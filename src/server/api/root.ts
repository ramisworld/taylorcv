import { applicationRouter } from "~/server/api/routers/application";
import { billingRouter } from "~/server/api/routers/billing";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

export const appRouter = createTRPCRouter({
  application: applicationRouter,
  billing: billingRouter,
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
