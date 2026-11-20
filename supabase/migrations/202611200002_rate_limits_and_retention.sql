-- Rate limits shared by every server instance (one atomic upsert per check).
create table if not exists public.rate_limits (
  key text primary key check (length(key) <= 200),
  count integer not null,
  reset_at timestamptz not null
);
alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;
grant all on public.rate_limits to service_role;

create or replace function public.rate_limit_hit(p_key text, p_max integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare current_count integer;
begin
  insert into public.rate_limits as r(key, count, reset_at)
    values (p_key, 1, now() + make_interval(secs => p_window_seconds))
    on conflict (key) do update set
      count = case when r.reset_at <= now() then 1 else r.count + 1 end,
      reset_at = case when r.reset_at <= now() then now() + make_interval(secs => p_window_seconds) else r.reset_at end
    returning count into current_count;
  return current_count <= p_max;
end;
$$;
revoke all on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;

-- Retention: rooms idle for the given number of days, and expired limit rows.
-- Deletion cascades to memberships and revisions. Nothing runs this automatically.
create or replace function public.purge_stale_rooms(p_days integer default 14)
returns integer language plpgsql security definer set search_path = '' as $$
declare removed integer;
begin
  if p_days < 1 then raise exception 'p_days must be at least 1'; end if;
  delete from public.game_rooms where updated_at < now() - make_interval(days => p_days);
  get diagnostics removed = row_count;
  delete from public.rate_limits where reset_at < now() - interval '1 hour';
  return removed;
end;
$$;
revoke all on function public.purge_stale_rooms(integer) from public, anon, authenticated;
grant execute on function public.purge_stale_rooms(integer) to service_role;
