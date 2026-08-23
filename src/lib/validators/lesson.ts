import { z } from "zod";

export const createLessonSchema = z.object({
  title: z.string().min(2, "عنوان الدرس مطلوب (حرفان على الأقل)"),
  unitId: z.string().min(1, "يجب اختيار الوحدة"),
});

export const attachVideoSchema = z.object({
  providerId: z.string().min(1, "معرّف الفيديو لدى مزوّد البث مطلوب"),
  durationSec: z.coerce.number().int().positive().optional(),
});

export const attachFileSchema = z.object({
  url: z.string().url("رابط الملف غير صالح"),
  fileName: z.string().min(1, "اسم الملف مطلوب"),
});
