-- All writes are rolled back. Run with administrative SQL access.
begin;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select user_id from public.coach_users limit 1),'role','authenticated')::text,true);
set local role authenticated;
do $$
declare ids uuid[]; versions jsonb; before_rows jsonb; after_rows jsonb; changed integer; rejected boolean;
begin
 select array_agg(id),jsonb_object_agg(id::text,updated_at),jsonb_agg(to_jsonb(e) order by id)
 into ids,versions,before_rows from (select * from public.exercise_library order by id limit 2) e;
 if cardinality(ids)<>2 then raise exception 'Need two existing exercises for test'; end if;
 select count(*) into changed from public.coach_replace_exercise_media(ids,'{"female_image_url":"https://example.com/test-only.png"}',versions);
 if changed<>2 then raise exception 'Batch did not update both'; end if;
 select jsonb_agg(to_jsonb(e) order by id) into after_rows from public.exercise_library e where id=any(ids);
 if exists(select 1 from jsonb_array_elements(after_rows) a where a->>'female_image_url'<>'https://example.com/test-only.png') then raise exception 'New media missing'; end if;
 if (select jsonb_agg(x-'female_image_url'-'updated_at') from jsonb_array_elements(before_rows) x)
 is distinct from (select jsonb_agg(x-'female_image_url'-'updated_at') from jsonb_array_elements(after_rows) x) then raise exception 'Untargeted fields changed'; end if;
 rejected=false;
 begin perform public.coach_replace_exercise_media(ids,'{"male_video_url":"https://example.com/conflict.mp4"}',versions);
 exception when serialization_failure then rejected=true; end;
 if not rejected then raise exception 'Stale version was accepted'; end if;
 rejected=false;
 begin perform public.coach_replace_exercise_media(ids,'{"instructions":"https://example.com/bad"}',versions);
 exception when others then rejected=true; end;
 if not rejected then raise exception 'Non-media field was accepted'; end if;
 rejected=false;
 begin perform public.coach_replace_exercise_media(ids,'{"male_image_url":null}',versions);
 exception when others then rejected=true; end;
 if not rejected then raise exception 'Null media was accepted'; end if;
 select jsonb_object_agg(id::text,updated_at) into versions from public.exercise_library where id=any(ids);
 rejected=false;
 begin perform public.coach_replace_exercise_media(array_append(ids,'00000000-0000-0000-0000-000000000000'::uuid),'{"male_video_url":"https://example.com/invalid-target.mp4"}',versions);
 exception when others then rejected=true; end;
 if not rejected then raise exception 'Missing target was accepted'; end if;
 if after_rows is distinct from (select jsonb_agg(to_jsonb(e) order by id) from public.exercise_library e where id=any(ids)) then raise exception 'Rejected batch changed data'; end if;
 perform set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
 rejected=false;
 begin perform public.coach_replace_exercise_media(ids,'{"male_video_url":"https://example.com/denied.mp4"}',versions);
 exception when insufficient_privilege then rejected=true; end;
 if not rejected then raise exception 'Non-coach was accepted'; end if;
end;
$$;
reset role;
select 'PASS: atomic batch, other fields preserved, stale edit rejected, invalid fields/null/missing target rejected, non-coach denied; all test writes rolled back.' as media_library_tests;
rollback;
