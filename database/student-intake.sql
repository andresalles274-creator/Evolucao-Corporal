-- Full student registration. No health data is stored in authentication metadata.
create schema if not exists ec_private;
revoke all on schema ec_private from public,anon,authenticated;
create table ec_private.student_registration_drafts(
 ticket uuid primary key default gen_random_uuid(), email text not null,
 payload jsonb not null, created_at timestamptz not null default now()
);
alter table ec_private.student_registration_drafts enable row level security;
create index student_registration_drafts_email_time on ec_private.student_registration_drafts(email,created_at);
revoke all on ec_private.student_registration_drafts from public,anon,authenticated;
create table public.student_intakes(
 user_id uuid primary key references auth.users(id) on delete cascade,
 email text not null, payload jsonb not null,
 consent_version text not null default '2026-11-20-v1',
 consent_at timestamptz not null default now(), submitted_at timestamptz not null default now(),
 finalized_at timestamptz
);
alter table public.student_intakes enable row level security;
revoke all on public.student_intakes from public,anon,authenticated;
grant select on public.student_intakes to authenticated;
create policy intake_read on public.student_intakes for select to authenticated
 using(user_id=(select auth.uid()) or (select public.is_coach()));
create table public.student_intake_files(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.student_intakes(user_id) on delete cascade,
 title text not null check(length(btrim(title)) between 1 and 160),
 exam_date date, notes text not null default '' check(length(notes)<=4000),
 storage_path text unique not null check(left(storage_path,37)=user_id::text||'/'),
 file_name text not null check(length(file_name) between 1 and 255),
 file_size integer not null check(file_size between 1 and 15728640),
 mime_type text not null check(mime_type in ('application/pdf','image/jpeg','image/png','image/webp')),
 created_at timestamptz not null default now()
);
create index student_intake_files_user_date on public.student_intake_files(user_id,created_at desc);
alter table public.student_intake_files enable row level security;
revoke all on public.student_intake_files from public,anon,authenticated;
grant select,insert on public.student_intake_files to authenticated;
create policy intake_file_read on public.student_intake_files for select to authenticated
 using(user_id=(select auth.uid()) or (select public.is_coach()));
create policy intake_file_insert on public.student_intake_files for insert to authenticated
 with check(user_id=(select auth.uid()) and exists(select 1 from public.student_intakes i where i.user_id=auth.uid()));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('student-intake-exams','student-intake-exams',false,15728640,array['application/pdf','image/jpeg','image/png','image/webp']);
create policy intake_storage_read on storage.objects for select to authenticated
 using(bucket_id='student-intake-exams' and ((storage.foldername(name))[1]=(select auth.uid())::text or (select public.is_coach())));
create policy intake_storage_insert on storage.objects for insert to authenticated
 with check(bucket_id='student-intake-exams' and (storage.foldername(name))[1]=(select auth.uid())::text
 and exists(select 1 from public.student_intakes where user_id=(select auth.uid())));
-- Cleanup is limited to an upload not yet referenced by an exam record.
create policy intake_storage_cleanup on storage.objects for delete to authenticated
 using(bucket_id='student-intake-exams' and (storage.foldername(name))[1]=(select auth.uid())::text
 and not exists(select 1 from public.student_intake_files f where f.storage_path=objects.name));
create function ec_private.validate_student_intake(p jsonb) returns jsonb language plpgsql
 set search_path='' as $$
declare clean jsonb:='{}'; k text; val jsonb; t text; v numeric;
begin
 if jsonb_typeof(p) is distinct from 'object' or octet_length(p::text)>50000 then raise exception 'Ficha inválida ou muito extensa'; end if;
 if (p->>'consent') is distinct from 'true' then raise exception 'Confirme a autorização de uso dos dados'; end if;
 for k,val in select * from jsonb_each(p) loop
  if k = any(array['full_name','phone','birth_date','age','gender','height_cm','city','state','occupation','emergency_name','emergency_phone','goal','priority_areas','training_level','training_days','training_minutes','training_place','training_time','exercise_history','work_routine','wake_time','sleep_time','sleep_hours','meals_per_day','water_liters','food_preferences','food_aversions','current_diet','health_conditions','injuries','surgeries','pain','medications','allergies','medical_followup','restrictions','pregnancy_postpartum','exams_history','additional_notes','assessment_date','weight','waist','hip','glute','chest','arm_right','arm_left','forearm_right','forearm_left','thigh_right','thigh_left','calf_right','calf_left']) then
   if jsonb_typeof(val) not in ('string','number','null') then raise exception 'Campo inválido: %',k; end if;
   t:=btrim(p->>k); if t is not null and t<>'' then clean:=clean||jsonb_build_object(k,t); end if;
  end if;
 end loop;
 if length(clean->>'full_name') is null or length(clean->>'full_name')<2 then raise exception 'Preencha o nome completo'; end if;
 if length(clean->>'full_name') > 160 then raise exception 'Campo excede o tamanho permitido: full_name'; end if;
 if length(clean->>'phone') > 40 then raise exception 'Campo excede o tamanho permitido: phone'; end if;
 if length(clean->>'birth_date') > 200 then raise exception 'Campo excede o tamanho permitido: birth_date'; end if;
 if clean ? 'birth_date' then if (clean->>'birth_date') !~ '^\d{4}-\d{2}-\d{2}$' or (clean->>'birth_date')::date > current_date then raise exception 'Data inválida: birth_date'; end if; end if;
 if length(clean->>'age') > 200 then raise exception 'Campo excede o tamanho permitido: age'; end if;
 if clean ? 'age' then v := (clean->>'age')::numeric; if v < 1 or v > 120 or trunc(v) <> v then raise exception 'Valor inválido: age'; end if; clean := jsonb_set(clean, '{age}', to_jsonb(v)); end if;
 if length(clean->>'gender') > 200 then raise exception 'Campo excede o tamanho permitido: gender'; end if;
 if clean ? 'gender' and (clean->>'gender') not in ('male','female') then raise exception 'Opção inválida: gender'; end if;
 if length(clean->>'height_cm') > 200 then raise exception 'Campo excede o tamanho permitido: height_cm'; end if;
 if clean ? 'height_cm' then v := (clean->>'height_cm')::numeric; if v < 30 or v > 250 then raise exception 'Valor inválido: height_cm'; end if; clean := jsonb_set(clean, '{height_cm}', to_jsonb(v)); end if;
 if length(clean->>'city') > 120 then raise exception 'Campo excede o tamanho permitido: city'; end if;
 if length(clean->>'state') > 80 then raise exception 'Campo excede o tamanho permitido: state'; end if;
 if length(clean->>'occupation') > 160 then raise exception 'Campo excede o tamanho permitido: occupation'; end if;
 if length(clean->>'emergency_name') > 160 then raise exception 'Campo excede o tamanho permitido: emergency_name'; end if;
 if length(clean->>'emergency_phone') > 40 then raise exception 'Campo excede o tamanho permitido: emergency_phone'; end if;
 if length(clean->>'goal') > 200 then raise exception 'Campo excede o tamanho permitido: goal'; end if;
 if clean ? 'goal' and (clean->>'goal') not in ('Hipertrofia','Emagrecimento','Recomposição corporal','Condicionamento','Saúde') then raise exception 'Opção inválida: goal'; end if;
 if length(clean->>'priority_areas') > 4000 then raise exception 'Campo excede o tamanho permitido: priority_areas'; end if;
 if length(clean->>'training_level') > 200 then raise exception 'Campo excede o tamanho permitido: training_level'; end if;
 if clean ? 'training_level' and (clean->>'training_level') not in ('Iniciante','Intermediário','Avançado') then raise exception 'Opção inválida: training_level'; end if;
 if length(clean->>'training_days') > 200 then raise exception 'Campo excede o tamanho permitido: training_days'; end if;
 if clean ? 'training_days' then v := (clean->>'training_days')::numeric; if v < 1 or v > 7 or trunc(v) <> v then raise exception 'Valor inválido: training_days'; end if; clean := jsonb_set(clean, '{training_days}', to_jsonb(v)); end if;
 if length(clean->>'training_minutes') > 200 then raise exception 'Campo excede o tamanho permitido: training_minutes'; end if;
 if clean ? 'training_minutes' then v := (clean->>'training_minutes')::numeric; if v < 10 or v > 300 or trunc(v) <> v then raise exception 'Valor inválido: training_minutes'; end if; clean := jsonb_set(clean, '{training_minutes}', to_jsonb(v)); end if;
 if length(clean->>'training_place') > 200 then raise exception 'Campo excede o tamanho permitido: training_place'; end if;
 if length(clean->>'training_time') > 200 then raise exception 'Campo excede o tamanho permitido: training_time'; end if;
 if clean ? 'training_time' and (clean->>'training_time') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'Horário inválido: training_time'; end if;
 if length(clean->>'exercise_history') > 4000 then raise exception 'Campo excede o tamanho permitido: exercise_history'; end if;
 if length(clean->>'work_routine') > 4000 then raise exception 'Campo excede o tamanho permitido: work_routine'; end if;
 if length(clean->>'wake_time') > 200 then raise exception 'Campo excede o tamanho permitido: wake_time'; end if;
 if clean ? 'wake_time' and (clean->>'wake_time') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'Horário inválido: wake_time'; end if;
 if length(clean->>'sleep_time') > 200 then raise exception 'Campo excede o tamanho permitido: sleep_time'; end if;
 if clean ? 'sleep_time' and (clean->>'sleep_time') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'Horário inválido: sleep_time'; end if;
 if length(clean->>'sleep_hours') > 200 then raise exception 'Campo excede o tamanho permitido: sleep_hours'; end if;
 if clean ? 'sleep_hours' then v := (clean->>'sleep_hours')::numeric; if v < 1 or v > 16 then raise exception 'Valor inválido: sleep_hours'; end if; clean := jsonb_set(clean, '{sleep_hours}', to_jsonb(v)); end if;
 if length(clean->>'meals_per_day') > 200 then raise exception 'Campo excede o tamanho permitido: meals_per_day'; end if;
 if clean ? 'meals_per_day' then v := (clean->>'meals_per_day')::numeric; if v < 1 or v > 12 or trunc(v) <> v then raise exception 'Valor inválido: meals_per_day'; end if; clean := jsonb_set(clean, '{meals_per_day}', to_jsonb(v)); end if;
 if length(clean->>'water_liters') > 200 then raise exception 'Campo excede o tamanho permitido: water_liters'; end if;
 if clean ? 'water_liters' then v := (clean->>'water_liters')::numeric; if v < 0.1 or v > 15 then raise exception 'Valor inválido: water_liters'; end if; clean := jsonb_set(clean, '{water_liters}', to_jsonb(v)); end if;
 if length(clean->>'food_preferences') > 4000 then raise exception 'Campo excede o tamanho permitido: food_preferences'; end if;
 if length(clean->>'food_aversions') > 4000 then raise exception 'Campo excede o tamanho permitido: food_aversions'; end if;
 if length(clean->>'current_diet') > 4000 then raise exception 'Campo excede o tamanho permitido: current_diet'; end if;
 if length(clean->>'health_conditions') > 4000 then raise exception 'Campo excede o tamanho permitido: health_conditions'; end if;
 if length(clean->>'injuries') > 4000 then raise exception 'Campo excede o tamanho permitido: injuries'; end if;
 if length(clean->>'surgeries') > 4000 then raise exception 'Campo excede o tamanho permitido: surgeries'; end if;
 if length(clean->>'pain') > 4000 then raise exception 'Campo excede o tamanho permitido: pain'; end if;
 if length(clean->>'medications') > 4000 then raise exception 'Campo excede o tamanho permitido: medications'; end if;
 if length(clean->>'allergies') > 4000 then raise exception 'Campo excede o tamanho permitido: allergies'; end if;
 if length(clean->>'medical_followup') > 4000 then raise exception 'Campo excede o tamanho permitido: medical_followup'; end if;
 if length(clean->>'restrictions') > 4000 then raise exception 'Campo excede o tamanho permitido: restrictions'; end if;
 if length(clean->>'pregnancy_postpartum') > 4000 then raise exception 'Campo excede o tamanho permitido: pregnancy_postpartum'; end if;
 if length(clean->>'exams_history') > 4000 then raise exception 'Campo excede o tamanho permitido: exams_history'; end if;
 if length(clean->>'additional_notes') > 4000 then raise exception 'Campo excede o tamanho permitido: additional_notes'; end if;
 if length(clean->>'assessment_date') > 200 then raise exception 'Campo excede o tamanho permitido: assessment_date'; end if;
 if clean ? 'assessment_date' then if (clean->>'assessment_date') !~ '^\d{4}-\d{2}-\d{2}$' or (clean->>'assessment_date')::date > current_date then raise exception 'Data inválida: assessment_date'; end if; end if;
 if length(clean->>'weight') > 200 then raise exception 'Campo excede o tamanho permitido: weight'; end if;
 if clean ? 'weight' then v := (clean->>'weight')::numeric; if v < 1 or v > 500 then raise exception 'Valor inválido: weight'; end if; clean := jsonb_set(clean, '{weight}', to_jsonb(v)); end if;
 if length(clean->>'waist') > 200 then raise exception 'Campo excede o tamanho permitido: waist'; end if;
 if clean ? 'waist' then v := (clean->>'waist')::numeric; if v < 1 or v > 300 then raise exception 'Valor inválido: waist'; end if; clean := jsonb_set(clean, '{waist}', to_jsonb(v)); end if;
 if length(clean->>'hip') > 200 then raise exception 'Campo excede o tamanho permitido: hip'; end if;
 if clean ? 'hip' then v := (clean->>'hip')::numeric; if v < 1 or v > 300 then raise exception 'Valor inválido: hip'; end if; clean := jsonb_set(clean, '{hip}', to_jsonb(v)); end if;
 if length(clean->>'glute') > 200 then raise exception 'Campo excede o tamanho permitido: glute'; end if;
 if clean ? 'glute' then v := (clean->>'glute')::numeric; if v < 1 or v > 300 then raise exception 'Valor inválido: glute'; end if; clean := jsonb_set(clean, '{glute}', to_jsonb(v)); end if;
 if length(clean->>'chest') > 200 then raise exception 'Campo excede o tamanho permitido: chest'; end if;
 if clean ? 'chest' then v := (clean->>'chest')::numeric; if v < 1 or v > 300 then raise exception 'Valor inválido: chest'; end if; clean := jsonb_set(clean, '{chest}', to_jsonb(v)); end if;
 if length(clean->>'arm_right') > 200 then raise exception 'Campo excede o tamanho permitido: arm_right'; end if;
 if clean ? 'arm_right' then v := (clean->>'arm_right')::numeric; if v < 1 or v > 300 then raise exception 'Valor inválido: arm_right'; end if; clean := jsonb_set(clean, '{arm_right}', to_jsonb(v)); end if;
 if length(clean->>'arm_left') > 200 then raise exception 'Campo excede o tamanho permitido: arm_left'; end if;
 if clean ? 'arm_left' then v := (clean->>'arm_left')::numeric; if v < 1 or v > 300 then raise exception 'Valor inválido: arm_left'; end if; clean := jsonb_set(clean, '{arm_left}', to_jsonb(v)); end if;
 if length(clean->>'forearm_right') > 200 then raise exception 'Campo excede o tamanho permitido: forearm_right'; end if;
 if clean ? 'forearm_right' then v := (clean->>'forearm_right')::numeric; if v < 1 or v > 300 then raise exception 'Valor inválido: forearm_right'; end if; clean := jsonb_set(clean, '{forearm_right}', to_jsonb(v)); end if;
 if length(clean->>'forearm_left') > 200 then raise exception 'Campo excede o tamanho permitido: forearm_left'; end if;
 if clean ? 'forearm_left' then v := (clean->>'forearm_left')::numeric; if v < 1 or v > 300 then raise exception 'Valor inválido: forearm_left'; end if; clean := jsonb_set(clean, '{forearm_left}', to_jsonb(v)); end if;
 if length(clean->>'thigh_right') > 200 then raise exception 'Campo excede o tamanho permitido: thigh_right'; end if;
 if clean ? 'thigh_right' then v := (clean->>'thigh_right')::numeric; if v < 1 or v > 300 then raise exception 'Valor inválido: thigh_right'; end if; clean := jsonb_set(clean, '{thigh_right}', to_jsonb(v)); end if;
 if length(clean->>'thigh_left') > 200 then raise exception 'Campo excede o tamanho permitido: thigh_left'; end if;
 if clean ? 'thigh_left' then v := (clean->>'thigh_left')::numeric; if v < 1 or v > 300 then raise exception 'Valor inválido: thigh_left'; end if; clean := jsonb_set(clean, '{thigh_left}', to_jsonb(v)); end if;
 if length(clean->>'calf_right') > 200 then raise exception 'Campo excede o tamanho permitido: calf_right'; end if;
 if clean ? 'calf_right' then v := (clean->>'calf_right')::numeric; if v < 1 or v > 300 then raise exception 'Valor inválido: calf_right'; end if; clean := jsonb_set(clean, '{calf_right}', to_jsonb(v)); end if;
 if length(clean->>'calf_left') > 200 then raise exception 'Campo excede o tamanho permitido: calf_left'; end if;
 if clean ? 'calf_left' then v := (clean->>'calf_left')::numeric; if v < 1 or v > 300 then raise exception 'Valor inválido: calf_left'; end if; clean := jsonb_set(clean, '{calf_left}', to_jsonb(v)); end if;
 if clean ? 'birth_date' then
  v:=extract(year from age(current_date,(clean->>'birth_date')::date));
  if v<1 or v>120 then raise exception 'Data de nascimento inválida'; end if;
  clean:=jsonb_set(clean,'{age}',to_jsonb(v));
 end if;
 return clean;
end $$;
revoke all on function ec_private.validate_student_intake(jsonb) from public,anon,authenticated;
create function ec_private.persist_student_intake(uid uuid,mail text,p jsonb) returns void
 language plpgsql set search_path='' as $$
declare existed boolean;
begin
 perform pg_advisory_xact_lock(hashtextextended(uid::text,402));
 select exists(select 1 from public.student_intakes where user_id=uid) into existed;
 insert into public.student_intakes(user_id,email,payload) values(uid,mail,p)
 on conflict(user_id) do update set email=excluded.email,payload=excluded.payload,consent_at=now(),submitted_at=now();
 update public.profiles set full_name=p->>'full_name',goal=coalesce(p->>'goal',goal),
 age=coalesce((p->>'age')::integer,age),height_cm=coalesce((p->>'height_cm')::numeric,height_cm),
 gender=coalesce(p->>'gender',gender) where user_id=uid;
 insert into public.coach_student_records(user_id,phone,occupation,health_history,medications,limitations)
 values(uid,coalesce(p->>'phone',''),coalesce(p->>'occupation',''),coalesce(p->>'health_conditions',''),coalesce(p->>'medications',''),concat_ws(E'\n',p->>'injuries',p->>'pain',p->>'restrictions'))
 on conflict(user_id) do nothing;
 if not existed and p ?| array['weight','waist','hip','glute','chest','arm_right','arm_left','forearm_right','forearm_left','thigh_right','thigh_left','calf_right','calf_left'] then
  insert into public.measurements(user_id,assessment_date,weight,waist,hip,glute,chest,arm_right,arm_left,forearm_right,forearm_left,thigh_right,thigh_left,calf_right,calf_left)
  values(uid,coalesce((p->>'assessment_date')::date,current_date),(p->>'weight')::numeric,(p->>'waist')::numeric,(p->>'hip')::numeric,(p->>'glute')::numeric,(p->>'chest')::numeric,(p->>'arm_right')::numeric,(p->>'arm_left')::numeric,(p->>'forearm_right')::numeric,(p->>'forearm_left')::numeric,(p->>'thigh_right')::numeric,(p->>'thigh_left')::numeric,(p->>'calf_right')::numeric,(p->>'calf_left')::numeric);
 end if;
end $$;
revoke all on function ec_private.persist_student_intake(uuid,text,jsonb) from public,anon,authenticated;
-- Public write-only entry point for a new registration. Only an opaque ticket is returned.
create function public.prepare_student_registration(registration_email text,intake_payload jsonb) returns uuid
 language plpgsql security definer set search_path='' as $$
declare mail text:=lower(btrim(registration_email)); p jsonb; result uuid;
begin
 if mail is null or length(mail)>254 or mail !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'E-mail inválido'; end if;
 p:=ec_private.validate_student_intake(intake_payload);
 perform pg_advisory_xact_lock(hashtextextended(mail,401));
 delete from ec_private.student_registration_drafts where created_at < now()-interval '3 days';
 if (select count(*) from ec_private.student_registration_drafts where email=mail and created_at>now()-interval '1 hour')>=5 then raise exception 'Muitas tentativas. Aguarde para tentar novamente.'; end if;
 insert into ec_private.student_registration_drafts(email,payload) values(mail,p) returning ticket into result;
 return result;
end $$;
revoke all on function public.prepare_student_registration(text,jsonb) from public;
grant execute on function public.prepare_student_registration(text,jsonb) to anon,authenticated;
create function ec_private.capture_student_registration() returns trigger
 language plpgsql security definer set search_path='' as $$
declare p jsonb; ticket_id uuid;
begin
 if not (coalesce(new.raw_user_meta_data,'{}') ? 'registration_ticket') then return new; end if;
 ticket_id:=(new.raw_user_meta_data->>'registration_ticket')::uuid;
 delete from ec_private.student_registration_drafts d
 where d.ticket=ticket_id and d.email=lower(new.email) and d.created_at>now()-interval '3 days'
 returning d.payload into p;
 if p is null then raise exception 'Ficha de cadastro expirada. Reenvie o cadastro.'; end if;
 perform ec_private.persist_student_intake(new.id,lower(new.email),p);
 return new;
end $$;
revoke all on function ec_private.capture_student_registration() from public,anon,authenticated;
-- Runs after the existing on_auth_user_created trigger, which creates profiles.
create trigger zz_capture_student_registration after insert on auth.users for each row execute function ec_private.capture_student_registration();
create function public.submit_student_intake(intake_payload jsonb) returns void
 language plpgsql security definer set search_path='' as $$
declare uid uuid:=(select auth.uid()); mail text; p jsonb;
begin
 if uid is null then raise exception 'Entre na sua conta para salvar a ficha'; end if;
 if public.is_coach() then raise exception 'Use uma conta de aluno para preencher a ficha'; end if;
 select email into mail from auth.users where id=uid and email_confirmed_at is not null;
 if mail is null then raise exception 'Confirme seu e-mail para continuar'; end if;
 p:=ec_private.validate_student_intake(intake_payload);
 perform ec_private.persist_student_intake(uid,mail,p);
end $$;
revoke all on function public.submit_student_intake(jsonb) from public,anon;
grant execute on function public.submit_student_intake(jsonb) to authenticated;
create function public.finalize_student_intake() returns timestamptz
 language plpgsql security definer set search_path='' as $$
declare result timestamptz;
begin
 if (select auth.uid()) is null then raise exception 'Entre na sua conta'; end if;
 update public.student_intakes set finalized_at=coalesce(finalized_at,now()) where user_id=(select auth.uid()) returning finalized_at into result;
 if result is null then raise exception 'Preencha e salve a ficha primeiro'; end if;
 return result;
end $$;
revoke all on function public.finalize_student_intake() from public,anon;
grant execute on function public.finalize_student_intake() to authenticated;
