-- Bots have no authentication session and must never become room members.
create or replace function public.project_game_revision() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.game_memberships where code = new.code;
  insert into public.game_memberships(code, user_id)
    select new.code, (p->>'id')::uuid
    from jsonb_array_elements(new.document->'state'->'players') p
    where coalesce((p->>'isBot')::boolean, false) = false;
  insert into public.game_revisions(code, revision)
    values(new.code, (new.document->'state'->>'revision')::bigint)
    on conflict(code) do update set revision = excluded.revision
    where public.game_revisions.revision <> excluded.revision;
  return new;
end;
$$;
revoke all on function public.project_game_revision() from public;
