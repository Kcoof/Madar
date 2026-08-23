import { z } from "zod";

export const createSchoolSchema = z.object({
  name: z.string().min(2, "اسم المدرسة مطلوب (حرفان على الأقل)"),
  adminFullName: z.string().min(2, "اسم مدير المدرسة مطلوب"),
  adminEmail: z.string().email("بريد مدير المدرسة غير صالح"),
  adminPassword: z.string().min(8, "كلمة مرور المدير يجب أن تكون 8 أحرف على الأقل"),
});
