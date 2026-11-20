-- Applied migration: coach_clinical_records_and_private_exams
-- Coach-only records and private exam attachments.

create table public.coach_student_records (
 user_id uuid primary key references auth.users(id) on delete cascade,
 phone text not null default '', occupation text not null default '',
 health_history text not null default '', medications text not null default '',
 limitations text not null default '', notes text not null default '',
 updated_at timestamptz not null default now()
);
alter table public.coach_student_records enable row level security;
revoke all on public.coach_student_records from anon;
grant select,insert,update,delete on public.coach_student_records to authenticated;
create policy coach_records_access on public.coach_student_records for all to authenticated
 using ((select public.is_coach())) with check ((select public.is_coach()));
create table public.coach_student_exams (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 title text not null check(length(title) between 1 and 160),
 exam_date date not null, notes text not null default '',
 storage_path text unique, file_name text,
 created_at timestamptz not null default now()
);
create index coach_student_exams_user_date on public.coach_student_exams(user_id,exam_date desc);
alter table public.coach_student_exams enable row level security;
revoke all on public.coach_student_exams from anon;
grant select,insert,update,delete on public.coach_student_exams to authenticated;
create policy coach_exams_access on public.coach_student_exams for all to authenticated
 using ((select public.is_coach())) with check ((select public.is_coach()));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('student-clinical-exams','student-clinical-exams',false,15728640,array['application/pdf','image/jpeg','image/png','image/webp']);
create policy coach_clinical_files_read on storage.objects for select to authenticated
 using(bucket_id='student-clinical-exams' and (select public.is_coach()));
create policy coach_clinical_files_insert on storage.objects for insert to authenticated
 with check(bucket_id='student-clinical-exams' and (select public.is_coach()) and (storage.foldername(name))[1] in (select user_id::text from public.profiles));
create policy coach_clinical_files_delete on storage.objects for delete to authenticated
 using(bucket_id='student-clinical-exams' and (select public.is_coach()));
;

