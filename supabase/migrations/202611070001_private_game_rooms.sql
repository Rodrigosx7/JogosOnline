-- Apply with Supabase SQL Editor or the CLI. Full hands and dedup keys stay service-only.
create table public.game_rooms (
  code text primary key check (code ~ '^[A-Za-z0-9_-]{18,64}$'),
  version bigint not null default 0,
  document jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.game_rooms enable row level security;
revoke all on public.game_rooms from anon, authenticated;
grant all on public.game_rooms to service_role;

create table public.game_memberships (
  code text not null references public.game_rooms(code) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (code, user_id)
);
alter table public.game_memberships enable row level security;
revoke all on public.game_memberships from anon, authenticated;
grant select on public.game_memberships to authenticated;
grant all on public.game_memberships to service_role;
create policy own_membership on public.game_memberships for select to authenticated
  using (user_id = (select auth.uid()));

-- Optional Realtime projection contains no identities, cards, names or hidden game state.
create table public.game_revisions (
  code text primary key references public.game_rooms(code) on delete cascade,
  revision bigint not null default 0
);
alter table public.game_revisions enable row level security;
revoke all on public.game_revisions from anon, authenticated;
grant select on public.game_revisions to authenticated;
grant all on public.game_revisions to service_role;
create policy member_revision on public.game_revisions for select to authenticated
  using (exists (select 1 from public.game_memberships m where m.code = game_revisions.code and m.user_id = (select auth.uid())));

create function public.project_game_revision() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.game_memberships where code = new.code;
  insert into public.game_memberships(code, user_id)
    select new.code, (p->>'id')::uuid
    from jsonb_array_elements(new.document->'state'->'players') p;
  insert into public.game_revisions(code, revision)
    values(new.code, (new.document->'state'->>'revision')::bigint)
    on conflict(code) do update set revision = excluded.revision
    where public.game_revisions.revision <> excluded.revision;
  return new;
end;
$$;
revoke all on function public.project_game_revision() from public;
-- AFTER allows the projection FK to see newly inserted rooms.
create trigger game_projection after insert or update on public.game_rooms
  for each row execute function public.project_game_revision();

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') and
     not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'game_revisions') then
    alter publication supabase_realtime add table public.game_revisions;
  end if;
end $$;
