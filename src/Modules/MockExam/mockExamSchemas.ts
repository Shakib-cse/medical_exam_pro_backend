import { z } from "zod";

export const startExamSchema = z.object({
  mockExamId: z.string().uuid(),
});

export const submitExamSchema = z.object({
  userAnswers: z.record(z.string(), z.number()),
  timeTakenSeconds: z.number().nonnegative(),
});

export type StartExamInput = z.infer<typeof startExamSchema>;
export type SubmitExamInput = z.infer<typeof submitExamSchema>;
