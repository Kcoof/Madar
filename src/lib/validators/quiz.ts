import { z } from "zod";

export const createQuizSchema = z.object({
  lessonId: z.string().min(1, "يجب اختيار الدرس"),
  title: z.string().min(2, "عنوان الاختبار مطلوب"),
  timeLimitMin: z.coerce.number().int().positive().optional(),
  maxAttempts: z.coerce.number().int().positive().max(10).default(1),
  questions: z
    .array(
      z.object({
        type: z.enum(["MCQ", "TRUE_FALSE", "SHORT_ANSWER", "MULTI_SELECT"]),
        text: z.string().min(1, "نص السؤال مطلوب"),
        points: z.coerce.number().int().positive().default(1),
        answers: z
          .array(
            z.object({
              text: z.string().min(1, "نص الإجابة مطلوب"),
              isCorrect: z.boolean().optional(),
            })
          )
          .min(1, "كل سؤال يحتاج إجابة واحدة على الأقل"),
      })
    )
    .min(1, "الاختبار يحتاج سؤالاً واحداً على الأقل"),
});

// Student submission — only answers; the score is ALWAYS computed server-side.
export const submitQuizSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1),
        answerIds: z.array(z.string()).optional(),
        text: z.string().optional(),
      })
    )
    .min(1, "لا توجد إجابات"),
});
