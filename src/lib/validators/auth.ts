import { z } from "zod";

export const registerSchema = z.object({
  fullName: z.string().min(2, "الاسم الكامل مطلوب (حرفان على الأقل)"),
  email: z.string().email("البريد الإلكتروني غير صالح"),
  password: z.string().min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل"),
});

export const loginSchema = z.object({
  email: z.string().email("البريد الإلكتروني غير صالح"),
  password: z.string().min(1, "كلمة المرور مطلوبة"),
});
