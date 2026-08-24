-- Shared calendars: run this migration in Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.shared_calendars (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Shared calendar',
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.shared_calendar_members (
  calendar_id uuid not null references public.shared_calendars(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (calendar_id, user_id)
);

create table if not exists public.shared_calendar_invites (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.shared_calendars(id) on delete cascade,
  inviter_id uuid not null references auth.users(id) on delete cascade,
  invitee_email text not null,
  token uuid not null unique default gen_random_uuid(),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

create table if not exists public.shared_calendar_tasks (
  id bigint not null,
  calendar_id uuid not null references public.shared_calendars(id) on delete cascade,
  name text not null default '',
  priority text not null default 'medium',
  done boolean not null default false,
  scheduled_for date,
  scheduled_until date,
  scheduled_time time,
  scheduled_end_time time,
  duration_minutes integer not null default 0,
  repeat text not null default 'none',
  completed_dates jsonb not null default '[]'::jsonb,
  kind text not null default 'task',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  primary key (calendar_id, id)
);

create index if not exists shared_calendar_invites_email_idx on public.shared_calendar_invites (lower(invitee_email));
create index if not exists shared_calendar_members_user_idx on public.shared_calendar_members (user_id);

alter table public.shared_calendars enable row level security;
alter table public.shared_calendar_members enable row level security;
alter table public.shared_calendar_invites enable row level security;
alter table public.shared_calendar_tasks enable row level security;

create or replace function public.is_shared_calendar_member(target_calendar_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.shared_calendar_members
    where calendar_id = target_calendar_id and user_id = auth.uid()
  );
$$;

create or replace function public.create_shared_calendar(calendar_name text default 'Shared calendar')
returns uuid language plpgsql security definer set search_path = public
as $$
declare
  new_calendar_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  insert into public.shared_calendars (name, owner_id) values (coalesce(nullif(trim(calendar_name), ''), 'Shared calendar'), auth.uid()) returning id into new_calendar_id;
  insert into public.shared_calendar_members (calendar_id, user_id, role) values (new_calendar_id, auth.uid(), 'owner');
  return new_calendar_id;
end;
$$;

grant execute on function public.is_shared_calendar_member(uuid) to authenticated;
grant execute on function public.create_shared_calendar(text) to authenticated;

create policy "members can read calendars" on public.shared_calendars for select to authenticated using (public.is_shared_calendar_member(id));
create policy "members can read members" on public.shared_calendar_members for select to authenticated using (public.is_shared_calendar_member(calendar_id));
create policy "members can read tasks" on public.shared_calendar_tasks for select to authenticated using (public.is_shared_calendar_member(calendar_id));
create policy "members can add tasks" on public.shared_calendar_tasks for insert to authenticated with check (public.is_shared_calendar_member(calendar_id) and updated_by = auth.uid());
create policy "members can edit tasks" on public.shared_calendar_tasks for update to authenticated using (public.is_shared_calendar_member(calendar_id)) with check (public.is_shared_calendar_member(calendar_id) and updated_by = auth.uid());
create policy "members can delete tasks" on public.shared_calendar_tasks for delete to authenticated using (public.is_shared_calendar_member(calendar_id));
create policy "owners can read invites" on public.shared_calendar_invites for select to authenticated using (inviter_id = auth.uid() or lower(invitee_email) = lower(coalesce(auth.jwt() ->> 'email', '')));

-- The Edge Function performs invite creation and acceptance so tokens are never exposed unnecessarily.
create policy "owners can insert invites" on public.shared_calendar_invites for insert to authenticated with check (inviter_id = auth.uid() and exists (select 1 from public.shared_calendars where id = calendar_id and owner_id = auth.uid()));
