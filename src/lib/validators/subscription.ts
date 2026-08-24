import { z } from "zod";

export const requestSubscriptionSchema = z.object({
  planId: z.string().min(1, "يجب اختيار الخطة"),
  subjectId: z.string().optional(),
});
