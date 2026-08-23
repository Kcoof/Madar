# مدار التعليمية (Madar)

منصة تعليمية متعددة المدارس — Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui + Prisma + Supabase (PostgreSQL + Auth + Storage).

خطة التنفيذ الكاملة في [`madar_plan_v2.0.md`](./madar_plan_v2.0.md) — يتم التنفيذ مرحلة بمرحلة (0 → G) مع التحقق من معيار القبول قبل الانتقال للمرحلة التالية.

## التشغيل المحلي (Local Development)

قاعدة البيانات محلية حاليًا (PostgreSQL 17 محمّل في `C:\Users\STARS\postgres`) — سيتم الربط بمشروع Supabase السحابي لاحقًا.

### 1) تشغيل قاعدة البيانات المحلية

```bash
# بدء الخادم
C:/Users/STARS/postgres/pgsql/bin/pg_ctl.exe -D C:/Users/STARS/postgres/data -l C:/Users/STARS/postgres/pg.log start

# إيقاف الخادم
C:/Users/STARS/postgres/pgsql/bin/pg_ctl.exe -D C:/Users/STARS/postgres/data stop
```

### 2) متغيرات البيئة

انسخ القيم من `.env` المحلي (غير مرفوع إلى GitHub):

```
DATABASE_URL=postgresql://postgres:madar_local_dev_2026@127.0.0.1:5432/madar
```

قيم Supabase (`NEXT_PUBLIC_SUPABASE_URL` وغيرها) تُملأ عند الربط بالمشروع السحابي.

### 3) تشغيل التطبيق

```bash
npm install
npx prisma generate
npm run dev
```

ثم افتح http://localhost:3000

## الهيكل

```
prisma/schema.prisma    # سكيمة قاعدة البيانات (مصدر الحقيقة)
supabase/migrations/    # ملفات SQL للـ RLS والـ Triggers
src/app/                # الصفحات ومسارات API (App Router)
src/lib/supabase/       # عملاء Supabase (متصفح + خادم)
src/lib/permissions.ts  # requireRole + withSchoolScope
```
