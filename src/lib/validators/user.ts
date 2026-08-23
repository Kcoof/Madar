import { z } from "zod";

// School admins can create teachers and students for their own school.
export const createSchoolUserSchema = z
  .object({
    fullName: z.string().min(2, "الاسم الكامل مطلوب"),
    email: z.string().email("البريد الإلكتروني غير صالح"),
    password: z.string().min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل"),
    role: z.enum(["TEACHER", "STUDENT"], { message: "الدور يجب أن يكون معلماً أو طالباً" }),
    gradeId: z.string().optional(),
  })
  .refine((v) => v.role !== "STUDENT" || Boolean(v.gradeId), {
    message: "يجب اختيار الصف للطالب",
    path: ["gradeId"],
  });
