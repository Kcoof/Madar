-- 0002_rls_school_isolation.sql
-- School isolation via Row Level Security — the primary isolation layer
-- (madar_plan_v2.0.md section 2b-B, fixed decision 3).
--
-- Plan pattern (verbatim) applies to tables that carry a "schoolId" column:
--   User, Lesson.
-- The plan lists Unit, Quiz, Assignment, LiveClass, Subscription,
-- Notification, SupportTicket as well, but the schema carries no direct
-- "schoolId" on them — their school resolves through the owning Lesson or
-- User. The policies below keep the same school_isolation_select /
-- school_isolation_write style, resolving the school via that join.
--
-- Idempotent: safe to re-run after every `prisma migrate`
-- (the plan requires applying these manually after each migration).

-- ============================================================ User
alter table public."User" enable row level security;

drop policy if exists school_isolation_select on public."User";
create policy school_isolation_select on public."User"
  for select using (
    "schoolId" is null -- Madar-level users / central content: visible to all
    or "schoolId" = (select "schoolId" from public."User" where id = auth.uid()::text)
  );

drop policy if exists school_isolation_write on public."User";
create policy school_isolation_write on public."User"
  for all using (
    "schoolId" = (select "schoolId" from public."User" where id = auth.uid()::text)
  );

-- ============================================================ Lesson
alter table public."Lesson" enable row level security;

drop policy if exists school_isolation_select on public."Lesson";
create policy school_isolation_select on public."Lesson"
  for select using (
    "schoolId" is null -- central Madar content, visible to everyone
    or "schoolId" = (select "schoolId" from public."User" where id = auth.uid()::text)
  );

drop policy if exists school_isolation_write on public."Lesson";
create policy school_isolation_write on public."Lesson"
  for all using (
    "schoolId" = (select "schoolId" from public."User" where id = auth.uid()::text)
  );

-- ============================================================ Quiz (via Lesson)
alter table public."Quiz" enable row level security;

drop policy if exists school_isolation_select on public."Quiz";
create policy school_isolation_select on public."Quiz"
  for select using (
    "lessonId" in (
      select l.id from public."Lesson" l
      where l."schoolId" is null
         or l."schoolId" = (select "schoolId" from public."User" where id = auth.uid()::text)
    )
  );

drop policy if exists school_isolation_write on public."Quiz";
create policy school_isolation_write on public."Quiz"
  for all using (
    "lessonId" in (
      select l.id from public."Lesson" l
      where l."schoolId" = (select "schoolId" from public."User" where id = auth.uid()::text)
    )
  );

-- ============================================================ Assignment (via Lesson)
alter table public."Assignment" enable row level security;

drop policy if exists school_isolation_select on public."Assignment";
create policy school_isolation_select on public."Assignment"
  for select using (
    "lessonId" in (
      select l.id from public."Lesson" l
      where l."schoolId" is null
         or l."schoolId" = (select "schoolId" from public."User" where id = auth.uid()::text)
    )
  );

drop policy if exists school_isolation_write on public."Assignment";
create policy school_isolation_write on public."Assignment"
  for all using (
    "lessonId" in (
      select l.id from public."Lesson" l
      where l."schoolId" = (select "schoolId" from public."User" where id = auth.uid()::text)
    )
  );

-- ============================================================ LiveClass (via teacher User)
alter table public."LiveClass" enable row level security;

drop policy if exists school_isolation_select on public."LiveClass";
create policy school_isolation_select on public."LiveClass"
  for select using (
    "teacherId" in (
      select u.id from public."User" u
      where u."schoolId" = (select "schoolId" from public."User" where id = auth.uid()::text)
    )
  );

drop policy if exists school_isolation_write on public."LiveClass";
create policy school_isolation_write on public."LiveClass"
  for all using (
    "teacherId" in (
      select u.id from public."User" u
      where u."schoolId" = (select "schoolId" from public."User" where id = auth.uid()::text)
    )
  );

-- ============================================================ Subscription (via student User)
alter table public."Subscription" enable row level security;

drop policy if exists school_isolation_select on public."Subscription";
create policy school_isolation_select on public."Subscription"
  for select using (
    "studentId" in (
      select u.id from public."User" u
      where u."schoolId" = (select "schoolId" from public."User" where id = auth.uid()::text)
    )
    or "studentId" = auth.uid()::text -- students see their own subscriptions
  );

drop policy if exists school_isolation_write on public."Subscription";
create policy school_isolation_write on public."Subscription"
  for all using (
    "studentId" in (
      select u.id from public."User" u
      where u."schoolId" = (select "schoolId" from public."User" where id = auth.uid()::text)
    )
  );

-- ============================================================ Notification (own rows + school admins)
alter table public."Notification" enable row level security;

drop policy if exists school_isolation_select on public."Notification";
create policy school_isolation_select on public."Notification"
  for select using (
    "userId" = auth.uid()::text -- each user sees their own notifications
    or "userId" in (
      select u.id from public."User" u
      where u."schoolId" = (select "schoolId" from public."User" where id = auth.uid()::text)
    )
  );

drop policy if exists school_isolation_write on public."Notification";
create policy school_isolation_write on public."Notification"
  for all using (
    "userId" = auth.uid()::text
    or "userId" in (
      select u.id from public."User" u
      where u."schoolId" = (select "schoolId" from public."User" where id = auth.uid()::text)
    )
  );

-- ============================================================ SupportTicket (own rows + school admins)
alter table public."SupportTicket" enable row level security;

drop policy if exists school_isolation_select on public."SupportTicket";
create policy school_isolation_select on public."SupportTicket"
  for select using (
    "userId" = auth.uid()::text
    or "userId" in (
      select u.id from public."User" u
      where u."schoolId" = (select "schoolId" from public."User" where id = auth.uid()::text)
    )
  );

drop policy if exists school_isolation_write on public."SupportTicket";
create policy school_isolation_write on public."SupportTicket"
  for all using (
    "userId" = auth.uid()::text
    or "userId" in (
      select u.id from public."User" u
      where u."schoolId" = (select "schoolId" from public."User" where id = auth.uid()::text)
    )
  );

-- ============================================================ Unit (shared curriculum)
-- Units belong to the global academic hierarchy (Stage > Grade > Subject > Unit):
-- the schema carries no schoolId and content is shared. Select is open to any
-- authenticated user; writes go through the service role only.
alter table public."Unit" enable row level security;

drop policy if exists school_isolation_select on public."Unit";
create policy school_isolation_select on public."Unit"
  for select using (auth.uid()::text is not null);
