# مدار التعليمية — خطة التنفيذ الدقيقة (v2.0)
### وثيقة تنفيذية جاهزة للتسليم إلى GLM، مرحلة بمرحلة

> هذه نسخة أعمق من v1.1: بدل "ماذا نبني"، هذه الوثيقة تحدد **كيف يُبنى بالضبط** — هيكلة المستودع، سكيمة قاعدة البيانات الكاملة بصيغة Prisma، كل مسار API مطلوب لكل مرحلة، وقواعد التزام ثابتة يتبعها GLM في كل مرحلة حتى لا يتغير أسلوب الكود بين مرحلة وأخرى.
> **طريقة الاستخدام:** انسخ قسم "تعليمات GLM" في كل مرحلة كما هو وأرسله كأمر عمل منفصل. لا تنتقل للمرحلة التالية قبل تحقق "معيار القبول" فعليًا.

---

## 0. القرارات الثابتة (لا تتغير بين المراحل)

هذه قواعد يجب أن تُعطى لـ GLM مرة واحدة في بداية أول محادثة تنفيذ، ويُطلب منه الالتزام بها في كل مرحلة لاحقة:

1. **المكدّس التقني:** Next.js 14 (App Router) + TypeScript + Tailwind CSS + Prisma + PostgreSQL. لا تُستخدم مكتبات بديلة (لا Express منفصل، لا MongoDB) إلا إذا نُصَّ على غير ذلك صراحة لاحقًا.
2. **اللغة والاتجاه:** كل الواجهات عربية RTL بشكل افتراضي (`dir="rtl"` على `<html>`)، لا إنجليزية إلا في التعليقات البرمجية (Code Comments).
3. **العزل متعدد المدارس:** كل استعلام لقاعدة بيانات لجدول يحمل `schoolId` **يجب** أن يمرّ عبر دالة مساعدة موحدة (`withSchoolScope`) تُضاف تلقائيًا شرط `schoolId`، بدل كتابة الشرط يدويًا في كل مسار — هذا يمنع نسيان العزل في مسار API واحد وتسرب بيانات مدرسة لأخرى.
4. **الصلاحيات:** كل مسار API يبدأ بفحص `session` ثم فحص الدور (`role`) عبر Middleware موحد اسمه `requireRole([...])`، لا تُكتب فحوصات صلاحية متفرقة داخل كل دالة.
5. **تسمية الملفات:** `kebab-case` للمجلدات، `PascalCase` لمكوّنات React، `camelCase` للدوال والمتغيرات.
6. **الأخطاء:** كل استجابة API فاشلة تُعيد شكلًا موحدًا: `{ error: { code: string, message: string } }` بدل نصوص أخطاء عشوائية.
7. **لا تُبنى واجهة أي دور قبل أن تكون بيانات ذلك الدور معزولة ومُختبرة على مستوى API أولًا.** (الواجهة تُبنى فوق API مُتحقَّق منه، وليس بالتوازي معه.)

---

## 1. هيكلة المستودع (Repo Structure)

```
madar/
├── prisma/
│   └── schema.prisma
├── src/
│   ├── app/
│   │   ├── (auth)/                # تسجيل الدخول / إنشاء حساب
│   │   ├── (student)/             # لوحة الطالب — مسارات محمية بدور STUDENT
│   │   ├── (teacher)/             # لوحة المعلم
│   │   ├── (school-admin)/        # لوحة مدير المدرسة
│   │   ├── (madar-admin)/         # لوحة إدارة مدار
│   │   ├── (parent)/              # واجهة ولي الأمر
│   │   └── api/                   # كل مسارات API
│   ├── components/
│   │   ├── ui/                    # مكونات عامة (أزرار، حقول، جداول)
│   │   └── shared/                # مكونات مشتركة بين أكثر من لوحة
│   ├── lib/
│   │   ├── auth.ts                # منطق JWT + الجلسات
│   │   ├── permissions.ts         # requireRole + withSchoolScope
│   │   ├── prisma.ts              # Prisma Client singleton
│   │   └── validators/            # مخططات Zod لكل نموذج إدخال
│   └── types/
├── .env.example
└── package.json
```

**تعليمات GLM للمرحلة 0:**
> أنشئ مشروع Next.js 14 بصيغة TypeScript مع App Router وTailwind، اتبع هيكلة المجلدات أعلاه بالضبط، أنشئ `lib/prisma.ts` كـ Prisma Client Singleton قياسي، وأنشئ `lib/permissions.ts` بدالتين فارغتين حاليًا: `requireRole(roles: string[])` و`withSchoolScope(schoolId: string, whereClause: object)` بدون منطق داخلي بعد (سيُبنى في المرحلة A). أضف `.env.example` يحوي `DATABASE_URL` و`JWT_SECRET` و`JWT_REFRESH_SECRET`.

**معيار القبول:** `npm run dev` يعمل بدون أخطاء، والمشروع يتصل بقاعدة بيانات PostgreSQL فارغة.

---

## 2. سكيمة قاعدة البيانات الكاملة (Prisma) — مصدر الحقيقة الوحيد

هذه السكيمة الكاملة لكل الجداول (الأصلية + المضافة في v1.1). تُبنى دفعة واحدة في المرحلة A حتى لا تتغير العلاقات لاحقًا، لكن الجداول تُستخدم تدريجيًا حسب المرحلة.

```prisma
enum Role {
  MADAR_OWNER
  MADAR_SUPPORT
  SCHOOL_ADMIN
  TEACHER
  STUDENT
  PARENT
}

enum SubscriptionStatus {
  PENDING
  ACTIVE
  EXPIRED
  SUSPENDED
  CANCELLED
}

enum LessonStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}

enum SubscriptionType {
  FULL_YEAR
  SINGLE_SUBJECT
}

model School {
  id            String    @id @default(cuid())
  name          String
  isActive      Boolean   @default(true)
  createdAt     DateTime  @default(now())
  users         User[]
  contracts     SchoolContract[]
  content       Lesson[]  @relation("SchoolContent")
}

model User {
  id            String    @id @default(cuid())
  fullName      String
  email         String    @unique
  passwordHash  String
  role          Role
  schoolId      String?   // null لمالك/مشرف مدار
  school        School?   @relation(fields: [schoolId], references: [id])
  stageId       String?   // للطالب فقط
  gradeId       String?   // للطالب فقط
  isActive      Boolean   @default(false) // تفعيل يدوي افتراضيًا
  createdAt     DateTime  @default(now())
  studentParents ParentStudentLink[] @relation("StudentLink")
  parentOf      ParentStudentLink[] @relation("ParentLink")
  auditLogs     AuditLog[]
  results       Result[]
  subscriptions Subscription[]
  progress      Progress[]
  supportTickets SupportTicket[]
}

model ParentStudentLink {
  id         String   @id @default(cuid())
  parentId   String
  studentId  String
  parent     User     @relation("ParentLink", fields: [parentId], references: [id])
  student    User     @relation("StudentLink", fields: [studentId], references: [id])
}

model AcademicStage {
  id      String  @id @default(cuid())
  name    String  // متوسط / ثانوي / ابتدائي (لاحقًا)
  grades  Grade[]
}

model Grade {
  id       String   @id @default(cuid())
  name     String
  stageId  String
  stage    AcademicStage @relation(fields: [stageId], references: [id])
  subjects Subject[]
}

model Subject {
  id       String   @id @default(cuid())
  name     String
  gradeId  String
  grade    Grade    @relation(fields: [gradeId], references: [id])
  units    Unit[]
}

model Unit {
  id         String   @id @default(cuid())
  title      String
  subjectId  String
  subject    Subject  @relation(fields: [subjectId], references: [id])
  lessons    Lesson[]
}

model Lesson {
  id          String       @id @default(cuid())
  title       String
  unitId      String
  unit        Unit         @relation(fields: [unitId], references: [id])
  status      LessonStatus @default(DRAFT)
  schoolId    String?      // null = محتوى مركزي من مدار
  school      School?      @relation("SchoolContent", fields: [schoolId], references: [id])
  videos      Video[]
  files       File[]
  quizzes     Quiz[]
  assignments Assignment[]
  createdAt   DateTime     @default(now())
}

model Video {
  id           String   @id @default(cuid())
  lessonId     String
  lesson       Lesson   @relation(fields: [lessonId], references: [id])
  providerId   String   // معرّف الفيديو عند مزوّد البث (Bunny/Mux)
  durationSec  Int?
  watchLogs    VideoWatchProgress[]
}

model VideoWatchProgress {
  id            String   @id @default(cuid())
  videoId       String
  studentId     String
  video         Video    @relation(fields: [videoId], references: [id])
  watchedPercent Int     @default(0)
  updatedAt     DateTime @updatedAt
}

model File {
  id        String   @id @default(cuid())
  lessonId  String
  lesson    Lesson   @relation(fields: [lessonId], references: [id])
  url       String
  fileName  String
}

model LiveClass {
  id            String   @id @default(cuid())
  subjectId     String
  teacherId     String
  scheduledAt   DateTime
  providerRoomId String?
  recordingUrl  String?
  createdAt     DateTime @default(now())
}

model Quiz {
  id           String     @id @default(cuid())
  lessonId     String
  lesson       Lesson     @relation(fields: [lessonId], references: [id])
  title        String
  timeLimitMin Int?
  maxAttempts  Int        @default(1)
  questions    Question[]
  results      Result[]
}

model Assignment {
  id        String   @id @default(cuid())
  lessonId  String
  lesson    Lesson   @relation(fields: [lessonId], references: [id])
  title     String
  dueDate   DateTime?
}

enum QuestionType {
  MCQ
  TRUE_FALSE
  SHORT_ANSWER
  MULTI_SELECT
}

model Question {
  id       String       @id @default(cuid())
  quizId   String
  quiz     Quiz         @relation(fields: [quizId], references: [id])
  type     QuestionType
  text     String
  points   Int          @default(1)
  answers  Answer[]
}

model Answer {
  id         String   @id @default(cuid())
  questionId String
  question   Question @relation(fields: [questionId], references: [id])
  text       String
  isCorrect  Boolean  @default(false)
}

model Result {
  id        String   @id @default(cuid())
  quizId    String
  studentId String
  quiz      Quiz     @relation(fields: [quizId], references: [id])
  student   User     @relation(fields: [studentId], references: [id])
  score     Int
  maxScore  Int
  attempt   Int      @default(1)
  createdAt DateTime @default(now())
}

model Progress {
  id             String   @id @default(cuid())
  studentId      String
  student        User     @relation(fields: [studentId], references: [id])
  subjectId      String
  completionRate Int      @default(0)
  updatedAt      DateTime @updatedAt
}

model SubscriptionPlan {
  id     String            @id @default(cuid())
  type   SubscriptionType
  name   String
  price  Int
}

model Subscription {
  id        String              @id @default(cuid())
  studentId String
  student   User                @relation(fields: [studentId], references: [id])
  planId    String
  subjectId String?             // فقط لو النوع SINGLE_SUBJECT
  status    SubscriptionStatus  @default(PENDING)
  startDate DateTime?
  endDate   DateTime?
  createdAt DateTime            @default(now())
}

model SchoolContract {
  id           String   @id @default(cuid())
  schoolId     String
  school       School   @relation(fields: [schoolId], references: [id])
  licenseCount Int
  startDate    DateTime
  endDate      DateTime
  isActive     Boolean  @default(true)
  invoices     Invoice[]
}

model Invoice {
  id          String        @id @default(cuid())
  contractId  String
  contract    SchoolContract @relation(fields: [contractId], references: [id])
  amount      Int
  isPaid      Boolean       @default(false)
  issuedAt    DateTime      @default(now())
}

model Notification {
  id        String   @id @default(cuid())
  userId    String
  title     String
  body      String
  channel   String   // IN_APP | EMAIL | SMS (لاحقًا)
  isRead    Boolean  @default(false)
  createdAt DateTime @default(now())
}

model SupportTicket {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  subject   String
  message   String
  status    String   @default("OPEN") // OPEN | CLOSED
  createdAt DateTime @default(now())
}

model AuditLog {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  action    String   // مثال: SUBSCRIPTION_ACTIVATED, USER_DELETED
  targetId  String?
  metadata  Json?
  createdAt DateTime @default(now())
}
```

**تعليمات GLM للجزء الأول من المرحلة A:**
> انسخ سكيمة Prisma أعلاه كاملة إلى `prisma/schema.prisma`، شغّل `npx prisma migrate dev --name init`، وتأكد من نجاح الترحيل بدون أخطاء علاقات (Relations).

---

## 3. المراحل التنفيذية — تفصيل دقيق لكل مرحلة

كل مرحلة أدناه فيها: **الأهداف**، **النماذج المستخدمة**، **جدول مسارات API**، **الشاشات**، **معيار القبول**، ثم **تعليمات GLM جاهزة للنسخ**.

---

### المرحلة A — الأساس: المستخدمون، المدارس، الصلاحيات

**النماذج:** `School, User, AcademicStage, Grade, Subject, AuditLog`

**مسارات API:**

| الطريقة | المسار | الوصف | الصلاحية |
|---|---|---|---|
| POST | `/api/auth/register` | تسجيل حساب طالب/ولي أمر (isActive=false) | عام |
| POST | `/api/auth/login` | تسجيل دخول، إصدار JWT | عام |
| POST | `/api/auth/refresh` | تجديد Access Token | مصادَق عليه |
| GET | `/api/madar-admin/schools` | قائمة المدارس | MADAR_OWNER |
| POST | `/api/madar-admin/schools` | إنشاء مدرسة + مدير لها | MADAR_OWNER |
| PATCH | `/api/madar-admin/users/:id/activate` | تفعيل حساب يدويًا + تسجيل AuditLog | MADAR_OWNER, SCHOOL_ADMIN |
| GET | `/api/school-admin/users` | مستخدمو المدرسة (معزولة بـ withSchoolScope) | SCHOOL_ADMIN |

**الشاشات:** تسجيل دخول/حساب، لوحة إدارة مدار (قائمة مدارس + زر إضافة)، لوحة مدير المدرسة (قائمة مستخدمين فقط لمدرسته).

**معيار القبول:** إنشاء مدرستين تجريبيتين (أ) و(ب)، تسجيل دخول كمدير مدرسة (أ)، واستدعاء `/api/school-admin/users` يعيد فقط مستخدمي (أ) — أي محاولة تمرير `schoolId` يدويًا في الطلب للوصول لمدرسة (ب) يجب أن تُرفض من `withSchoolScope`.

**تعليمات GLM:**
> نفّذ منطق `requireRole` و`withSchoolScope` في `lib/permissions.ts` بشكل كامل الآن (كانا فارغين في المرحلة 0). ثم ابنِ مسارات API المذكورة في الجدول أعلاه بالترتيب: `auth` أولًا، ثم `madar-admin/schools`، ثم `activate`، ثم `school-admin/users`. كل مسار محمي يجب أن يستدعي `requireRole` كأول سطر. بعد كل مسار API، اكتب اختبارًا يدويًا (سكربت أو Postman collection) يثبت عزل المدارس قبل الانتقال للمسار التالي.

---

### المرحلة B — المحتوى: الدروس والفيديو والملفات

**النماذج:** `Unit, Lesson, Video, File`

**مسارات API:**

| الطريقة | المسار | الوصف | الصلاحية |
|---|---|---|---|
| POST | `/api/teacher/lessons` | إنشاء درس (status=DRAFT) | TEACHER, SCHOOL_ADMIN |
| PATCH | `/api/teacher/lessons/:id/publish` | نشر الدرس (DRAFT→PUBLISHED) | TEACHER, SCHOOL_ADMIN |
| POST | `/api/teacher/lessons/:id/video` | ربط فيديو (يستقبل `providerId` من مزوّد البث بعد الرفع) | TEACHER, SCHOOL_ADMIN |
| POST | `/api/teacher/lessons/:id/files` | إرفاق ملف | TEACHER, SCHOOL_ADMIN |
| GET | `/api/student/lessons` | دروس صف الطالب PUBLISHED فقط (مركزية + مدرسته) | STUDENT |

**الشاشات:** واجهة المعلم (مادة ← وحدة ← درس + رفع فيديو/ملف)، واجهة الطالب (قائمة دروس صفه).

**معيار القبول:** درس بحالة `DRAFT` لا يظهر إطلاقًا في `/api/student/lessons`. درس أنشأه معلم مدرسة (أ) لا يظهر لطالب مدرسة (ب) حتى لو نفس الصف والمادة، إلا إذا كان `schoolId = null` (محتوى مركزي).

**تعليمات GLM:**
> ابنِ مسارات API بنفس الترتيب في الجدول، مع الالتزام بقاعدة العزل من المرحلة A (`withSchoolScope`) على كل استعلام `Lesson`. لا تنفّذ رفع فيديو فعليًا إلى مزوّد خارجي الآن — اكتفِ بحقل `providerId` يُدخَل يدويًا مؤقتًا (Placeholder)، وسنربطه بمزوّد بث حقيقي في مرحلة لاحقة منفصلة عند تحديد المزوّد.

---

### المرحلة C — التعلّم: الاختبارات، الواجبات، النتائج، التقدم

**النماذج:** `Quiz, Question, Answer, Assignment, Result, Progress, VideoWatchProgress`

**مسارات API:**

| الطريقة | المسار | الوصف | الصلاحية |
|---|---|---|---|
| POST | `/api/teacher/quizzes` | إنشاء اختبار مع أسئلته | TEACHER |
| GET | `/api/student/quizzes/:id` | عرض الاختبار (بدون كشف `isCorrect`) | STUDENT |
| POST | `/api/student/quizzes/:id/submit` | إرسال الإجابات + حساب `Result` تلقائيًا | STUDENT |
| GET | `/api/teacher/quizzes/:id/results` | نتائج كل الطلاب + من لم يحل بعد | TEACHER |
| POST | `/api/student/videos/:id/progress` | تحديث `watchedPercent` | STUDENT |
| GET | `/api/student/progress` | نسبة الإنجاز الكلية للطالب | STUDENT |

**معيار القبول:** إرسال إجابات اختبار عبر `submit` يحسب `score` في الخادم فقط (لا يُقبل `score` من الطلب مباشرة أبدًا)، ومحاولة إرسال بعد استنفاد `maxAttempts` تُرفض بخطأ واضح.

**تعليمات GLM:**
> نفّذ منطق حساب `Result` بالكامل في الخادم (Server-Side) بمقارنة إجابات الطالب مع `Answer.isCorrect`، وارفض أي محاولة يتجاوز عددها `Quiz.maxAttempts`. بعد إنشاء `Result`، حدّث `Progress.completionRate` للمادة المرتبطة بحساب تناسبي بسيط (عدد الدروس/الاختبارات المكتملة ÷ الإجمالي).

---

### المرحلة D — البث المباشر

**النماذج:** `LiveClass`

**مسارات API:**

| الطريقة | المسار | الوصف | الصلاحية |
|---|---|---|---|
| POST | `/api/teacher/live-classes` | جدولة حصة | TEACHER |
| GET | `/api/student/live-classes` | الحصص المجدولة لصف/مادة الطالب المشترك بها | STUDENT |
| POST | `/api/live-classes/:id/join` | إصدار رابط/توكن دخول من مزوّد البث المباشر | STUDENT, TEACHER |
| POST | `/api/live-classes/:id/end` | إنهاء الحصة + حفظ `recordingUrl` | TEACHER |

**معيار القبول:** `join` يتحقق أولًا من اشتراك الطالب في المادة (وليس فقط من كونه في نفس الصف) قبل إصدار توكن الدخول.

**تعليمات GLM:**
> نفّذ `join` بحيث يستدعي نفس منطق التحقق من الاشتراك المبني في المرحلة E (إن لم تُبنَ المرحلة E بعد، اجعلها Placeholder ترجع `true` مؤقتًا وعلّق بوضوح `// TODO: ربط فعلي بعد المرحلة E`، ولا تُطلق هذا المسار للإنتاج قبل إكمال ذلك الربط).

---

### المرحلة E — الاشتراكات والتفعيل اليدوي

**النماذج:** `SubscriptionPlan, Subscription, SchoolContract, Invoice`

**مسارات API:**

| الطريقة | المسار | الوصف | الصلاحية |
|---|---|---|---|
| POST | `/api/student/subscriptions/request` | طلب اشتراك (PENDING) | STUDENT |
| GET | `/api/madar-admin/subscriptions/pending` | الطلبات المعلقة | MADAR_OWNER |
| PATCH | `/api/madar-admin/subscriptions/:id/activate` | تفعيل + تسجيل AuditLog | MADAR_OWNER |
| GET | `/api/student/access-check?subjectId=` | فحص وصول الطالب لمادة معينة (تُستخدم داخليًا من مسارات المحتوى والبث) | STUDENT |

**معيار القبول:** طالب مشترك `SINGLE_SUBJECT` في مادة الرياضيات فقط، عند استدعاء دروس مادة الفيزياء، يُرفض بخطأ `SUBSCRIPTION_REQUIRED` وليس بخطأ صلاحيات عام غير واضح.

**تعليمات GLM:**
> ابنِ دالة موحدة `checkSubjectAccess(studentId, subjectId)` في `lib/permissions.ts`، تُستخدم داخل مسارات `student/lessons` (مرحلة B) و`student/live-classes/join` (مرحلة D) و`student/quizzes` (مرحلة C) — عدّل تلك المسارات الثلاثة الآن لاستدعاء هذه الدالة بدل الوصول المفتوح الذي بُني بها سابقًا.

---

### المرحلة F — لوحات التحكم النهائية والإشعارات

**النماذج:** `Notification`

**العمل:** تجميع كل الشاشات المبنية في المراحل A–E داخل لوحة واحدة متكاملة لكل دور (Sidebar + بيانات حقيقية من API لا بيانات وهمية Mock)، بالإضافة إلى:

| الطريقة | المسار | الوصف |
|---|---|---|
| GET | `/api/notifications` | إشعارات المستخدم الحالي |
| PATCH | `/api/notifications/:id/read` | تعليم كمقروء |

**معيار القبول:** كل رابط في القائمة الجانبية (Sidebar) لكل دور يفتح شاشة تعرض بيانات حقيقية من API مبني فعليًا، ولا توجد أي شاشة "قريبًا" ضمن نطاق MVP.

**تعليمات GLM:**
> اربط إشعارًا تلقائيًا (سطر في جدول `Notification` + بريد إلكتروني) عند: تفعيل اشتراك، نشر درس جديد لصف الطالب، جدولة بث مباشر جديد. لا تبنِ قناة SMS/واتساب الآن.

---

### المرحلة G — التشغيل والإطلاق

**العمل غير البرمجي بشكل أساسي:**
- تفعيل `AuditLog` فعليًا على كل نقطة ذُكرت (`activate`, حذف مستخدم، تعديل درجة يدويًا إن وُجد).
- نسخ احتياطي يومي مجدول لقاعدة البيانات (Cron على مزوّد الاستضافة المُدار).
- صفحة سياسة الخصوصية وشروط الاستخدام (نص ثابت، بدون منطق برمجي معقد).
- مسار `SupportTicket` بسيط: `POST /api/support/tickets`, `GET /api/madar-admin/support/tickets`.
- اختبار يدوي شامل: تسجيل مدرسة تجريبية حقيقية واحدة وتشغيلها أسبوعًا كاملًا.

**تعليمات GLM:**
> أضف استدعاء `createAuditLog(...)` داخل كل مسار API عدّلناه سابقًا في هذه القائمة: `activate` (مرحلة A وE)، حذف مستخدم إن وُجد. لا تُنشئ نظام تدقيق عام تلقائي (Auto-instrumentation) — فقط النقاط المذكورة صراحة.

---

## 4. ما يبقى مؤجلًا (بدون تغيير)

**المرحلة الثانية:** واجهة ولي الأمر المتقدمة، بنك الأسئلة المتقدم، التحليلات المتقدمة، الشهادات الرقمية، نظام التوصيات، تطبيقات الهاتف، العروض والكوبونات، واتساب/SMS.

**المرحلة الثالثة:** تحليل مستوى الطالب بالذكاء الاصطناعي، مساعد تعليمي ذكي، توصيات شخصية، تحليلات متقدمة.

---

## 5. كيف تتابع التنفيذ مع GLM عمليًا

1. أرسل القسم "0. القرارات الثابتة" مرة واحدة فقط في بداية أول جلسة تنفيذ.
2. أرسل كل مرحلة (تعليمات GLM الخاصة بها) في محادثة/جلسة منفصلة — لا تُدمج مرحلتان في طلب واحد، حتى لو بدتا صغيرتين.
3. بعد كل مرحلة، اختبر بنفسك "معيار القبول" يدويًا (عبر Postman أو المتصفح) قبل نسخ تعليمات المرحلة التالية.
4. إن انحرف GLM عن "القرارات الثابتة" في أي مرحلة (مثلًا استخدم مكتبة غير Prisma)، صحّح ذلك فورًا قبل الاستمرار — تراكم الانحراف بين المراحل أصعب إصلاحًا من تصحيحه فور حدوثه.
