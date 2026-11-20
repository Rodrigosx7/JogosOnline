-- Notify chat, partner signals and camera signalling through Realtime, not only game moves.
alter table public.game_revisions add column if not exists social_revision bigint not null default 0;

create or replace function public.project_game_revision() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- Rewrite memberships only when the seated humans change, not on every update.
  -- Compare ids only: lastSeen changes on every heartbeat.
  if tg_op = 'INSERT' or
     (select jsonb_agg(p->'id') from jsonb_array_elements(old.document->'state'->'players') p) is distinct from
     (select jsonb_agg(p->'id') from jsonb_array_elements(new.document->'state'->'players') p) then
    delete from public.game_memberships where code = new.code;
    insert into public.game_memberships(code, user_id)
      select new.code, (p->>'id')::uuid
      from jsonb_array_elements(new.document->'state'->'players') p
      where coalesce((p->>'isBot')::boolean, false) = false;
  end if;
  insert into public.game_revisions(code, revision, social_revision)
    values(new.code, (new.document->'state'->>'revision')::bigint, coalesce((new.document->'state'->>'socialRevision')::bigint, 0))
    on conflict(code) do update set revision = excluded.revision, social_revision = excluded.social_revision
    where public.game_revisions.revision <> excluded.revision or public.game_revisions.social_revision <> excluded.social_revision;
  return new;
end;
$$;
revoke all on function public.project_game_revision() from public;
