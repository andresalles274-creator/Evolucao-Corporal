begin;
select set_config('ec.test_email','registration-check-'||gen_random_uuid()::text||'@example.invalid',true);
set local role anon;
select set_config('ec.test_ticket',public.prepare_student_registration(current_setting('ec.test_email'),'{"full_name":"Cadastro de teste","age":35,"height_cm":170,"weight":80,"waist":90,"surgeries":"Informação sintética","phone":"000","consent":true}')::text,true);
reset role;
select set_config('ec.test_uid',gen_random_uuid()::text,true);
insert into auth.users(id,instance_id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
 values(current_setting('ec.test_uid')::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',current_setting('ec.test_email'),now(),'{"provider":"email","providers":["email"]}',jsonb_build_object('full_name','Cadastro de teste','goal','Saúde','registration_ticket',current_setting('ec.test_ticket')),now(),now());
do $$ begin
 if not exists(select 1 from public.student_intakes where user_id=current_setting('ec.test_uid')::uuid and payload->>'surgeries'='Informação sintética') then raise exception 'Intake not captured'; end if;
 if not exists(select 1 from public.measurements where user_id=current_setting('ec.test_uid')::uuid and weight=80 and waist=90) then raise exception 'Initial measurements missing'; end if;
 if not exists(select 1 from public.profiles where user_id=current_setting('ec.test_uid')::uuid and age=35 and height_cm=170) then raise exception 'Profile not synchronized'; end if;
 if exists(select 1 from ec_private.student_registration_drafts where ticket=current_setting('ec.test_ticket')::uuid) then raise exception 'Ticket was not consumed'; end if;
 if exists(select 1 from auth.users where id=current_setting('ec.test_uid')::uuid and raw_user_meta_data::text like '%Informação sintética%') then raise exception 'Health data leaked into auth metadata'; end if;
end $$;
select set_config('request.jwt.claim.sub',current_setting('ec.test_uid'),true);
set local role authenticated;
do $$ begin
 if (select count(*) from public.student_intakes)<>1 then raise exception 'Own intake read failed'; end if;
 if exists(select 1 from public.coach_student_records) then raise exception 'Private coach notes exposed'; end if;
 insert into public.student_intake_files(user_id,title,storage_path,file_name,file_size,mime_type) values(current_setting('ec.test_uid')::uuid,'Exame de teste',current_setting('ec.test_uid')||'/own-test.pdf','own-test.pdf',100,'application/pdf');
 if (select count(*) from public.student_intake_files)<>1 then raise exception 'Own exam read failed'; end if;
 perform public.submit_student_intake('{"full_name":"Cadastro atualizado","weight":81,"consent":true}');
 if (select count(*) from public.measurements where user_id=current_setting('ec.test_uid')::uuid)<>1 then raise exception 'Retry duplicated initial measurements'; end if;
 perform public.finalize_student_intake();
 if not exists(select 1 from public.student_intakes where finalized_at is not null) then raise exception 'Finalize failed'; end if;
 begin
 perform ec_private.validate_student_intake('{}');
 raise exception 'Private helper accessible';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
do $$ begin
 if exists(select 1 from public.student_intakes) then raise exception 'Another student can read intake'; end if;
 if exists(select 1 from public.student_intake_files) then raise exception 'Another student can read exam files'; end if;
 begin
 insert into public.student_intake_files(user_id,title,storage_path,file_name,file_size,mime_type) values(current_setting('ec.test_uid')::uuid,'teste',current_setting('ec.test_uid')||'/test.pdf','test.pdf',100,'application/pdf');
 raise exception 'Cross-user file insert succeeded';
 exception when insufficient_privilege then null; end;
end $$;
rollback;
