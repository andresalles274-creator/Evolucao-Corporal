-- Atomic, coach-only publication. Existing media, students and prescriptions are untouched.
create or replace function public.coach_replace_exercise_media(
 p_ids uuid[], p_patch jsonb, p_expected jsonb
) returns setof public.exercise_library
language plpgsql security invoker set search_path = '' as $$
declare target_count integer; locked_count integer; item record;
begin
 if auth.uid() is null or not public.is_coach() then
  raise exception 'Somente o Coach pode substituir mídias.' using errcode='42501';
 end if;
 select count(distinct id) into target_count from unnest(p_ids) id;
 if target_count < 1 or target_count > 200 or array_position(p_ids,null) is not null then
  raise exception 'Selecione de 1 a 200 exercícios.';
 end if;
 if p_patch is null or jsonb_typeof(p_patch) <> 'object' or p_patch = '{}'::jsonb then
  raise exception 'Selecione pelo menos uma mídia.';
 end if;
 for item in select key,value from jsonb_each(p_patch) loop
  if item.key not in ('male_image_url','female_image_url','male_video_url','female_video_url')
   or jsonb_typeof(item.value) <> 'string'
   or (item.value #>> '{}') !~ '^https://[^[:space:]"<>]+$' then
   raise exception 'Campo ou endereço de mídia inválido.';
  end if;
 end loop;
 -- Lock before validating versions. Concurrent coach edits cause an explicit retry, never silent overwrites.
 perform id from public.exercise_library where id=any(p_ids) order by id for update;
 get diagnostics locked_count = row_count;
 if locked_count <> target_count then raise exception 'Um exercício não está mais disponível. Atualize a biblioteca.'; end if;
 if p_expected is null or jsonb_typeof(p_expected) <> 'object' or exists (
  select 1 from public.exercise_library e where e.id=any(p_ids)
  and (not (p_expected ? e.id::text) or e.updated_at is distinct from (p_expected->>e.id::text)::timestamptz)
 ) then raise exception 'A biblioteca mudou durante a edição. Atualize e revise a seleção antes de salvar.' using errcode='40001'; end if;
 return query update public.exercise_library e set
  male_image_url=case when p_patch ? 'male_image_url' then p_patch->>'male_image_url' else e.male_image_url end,
  female_image_url=case when p_patch ? 'female_image_url' then p_patch->>'female_image_url' else e.female_image_url end,
  male_video_url=case when p_patch ? 'male_video_url' then p_patch->>'male_video_url' else e.male_video_url end,
  female_video_url=case when p_patch ? 'female_video_url' then p_patch->>'female_video_url' else e.female_video_url end,
  updated_at=now()
 where e.id=any(p_ids) returning e.*;
end;
$$;
revoke all on function public.coach_replace_exercise_media(uuid[],jsonb,jsonb) from public,anon;
grant execute on function public.coach_replace_exercise_media(uuid[],jsonb,jsonb) to authenticated;
