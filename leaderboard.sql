create or replace function public.get_global_leaderboard(result_limit integer default 5)
returns table (
  rank bigint,
  id uuid,
  username text,
  xp integer,
  tasks_done integer,
  sessions integer,
  streak integer
)
language sql
security definer
set search_path = public
as $$
  with ranked as (
    select
      row_number() over (
        order by
          coalesce(p.xp, 0) desc,
          coalesce(p.tasks_done, 0) desc,
          coalesce(p.sessions, 0) desc,
          p.id asc
      ) as rank,
      p.id,
      coalesce(nullif(trim(p.username), ''), 'Anonymous') as username,
      coalesce(p.xp, 0) as xp,
      coalesce(p.tasks_done, 0) as tasks_done,
      coalesce(p.sessions, 0) as sessions,
      coalesce(p.streak, 0) as streak
    from public.profiles p
  )
  select
    ranked.rank,
    ranked.id,
    ranked.username,
    ranked.xp,
    ranked.tasks_done,
    ranked.sessions,
    ranked.streak
  from ranked
  order by ranked.rank
  limit greatest(coalesce(result_limit, 5), 1);
$$;

grant execute on function public.get_global_leaderboard(integer) to anon, authenticated;
