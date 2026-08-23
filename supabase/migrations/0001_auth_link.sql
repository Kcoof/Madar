-- 0001_auth_link.sql
-- Links Supabase Auth (auth.users) to the public."User" table.
-- Copied from madar_plan_v2.0.md section 2b-A.
--
-- Local-dev compatibility (plain PostgreSQL, no Supabase): the guarded block
-- below creates a minimal stub of auth.users + auth.uid() so the same trigger
-- and the RLS policies in 0002 work locally. On Supabase the real objects
-- already exist and the guards are no-ops.

-- ---------------------------------------------------------------- local stub
create schema if not exists auth;

create table if not exists auth.users (
  id            uuid primary key default gen_random_uuid(),
  email         text unique not null,
  encrypted_password text,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at    timestamptz default now()
);

do $$
begin
  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'auth' and p.proname = 'uid'
  ) then
    execute $fn$
      create function auth.uid() returns uuid as $body$
        select (nullif(current_setting('request.jwt.claims', true), '')::json->>'sub')::uuid
      $body$ language sql stable
    $fn$;
  end if;
end $$;

-- ------------------------------------------------- handle_new_user (plan 2b-A)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  -- new.id is uuid (auth.users); public."User".id is text (Prisma String) — cast explicitly
  insert into public."User" (id, email, "fullName", role, "isActive")
  values (new.id::text, new.email, coalesce(new.raw_user_meta_data->>'fullName', ''), 'STUDENT', false);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
