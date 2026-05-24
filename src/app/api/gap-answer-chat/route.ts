import { type NextRequest } from "next/server";
import { z } from "zod";

import { createTRPCContext } from "~/server/api/trpc";
import { evaluateGapAnswerChatMessage } from "~/server/services/applicationWorkflow.service";

const inputSchema = z.object({
  applicationId: z.string().min(1),
  gapQuestionId: z.string().min(1),
  userMessage: z.string().trim().min(1).max(4000),
});

const encoder = new TextEncoder();

function event(name: string, data: unknown) {
  return encoder.encode(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`);
}

function tokens(text: string) {
  return text.match(/\S+\s*|\s+/g) ?? [text];
}

export async function POST(request: NextRequest) {
  const body = inputSchema.parse(await request.json());
  const responseHeaders = new Headers();
  const context = await createTRPCContext({
    headers: request.headers,
    resHeaders: responseHeaders,
  });
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const push = (name: string, data: unknown) => controller.enqueue(event(name, data));
      try {
        push("thinking", { gapQuestionId: body.gapQuestionId });
        const result = await evaluateGapAnswerChatMessage({
          anonymousSessionId: context.anonymousSessionId,
          applicationId: body.applicationId,
          userId: context.userId,
          gapQuestionId: body.gapQuestionId,
          userMessage: body.userMessage,
          onAssistantReplyDelta: async (delta) => {
            push("assistant_delta", { delta });
          },
          onAcceptedBoost: async (boost) => {
            push("boost", boost);
          },
        });

        const nextQuestion = result.gapQuestions.find(
          (question) => question.status === "unanswered"
        );
        if (result.evaluatorOutput.shouldMoveToNextQuestion && nextQuestion) {
          push("next_question_thinking", { gapQuestionId: nextQuestion.id });
          await new Promise((resolve) => setTimeout(resolve, 240));
          for (const delta of tokens(nextQuestion.question)) {
            push("next_question_delta", {
              gapQuestionId: nextQuestion.id,
              delta,
            });
            await new Promise((resolve) => setTimeout(resolve, 22));
          }
        }
        push("result", {
          ...result,
          nextGapQuestionId: nextQuestion?.id ?? null,
          allQuestionsComplete: !nextQuestion,
        });
      } catch (error) {
        push("error", {
          message:
            error instanceof Error
              ? error.message
              : "Taylor could not evaluate that answer.",
        });
      } finally {
        controller.close();
      }
    },
  });
  responseHeaders.set("Content-Type", "text/event-stream; charset=utf-8");
  responseHeaders.set("Cache-Control", "no-cache, no-transform");
  responseHeaders.set("Connection", "keep-alive");
  return new Response(stream, { headers: responseHeaders });
}
