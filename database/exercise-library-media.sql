-- Public exercise demonstrations only. Private student files stay in their existing buckets.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('exercise-library-media','exercise-library-media',true,52428800,
 array['image/jpeg','image/png','image/webp','video/mp4','video/webm'])
on conflict (id) do nothing;

create policy exercise_library_media_upload on storage.objects
for insert to authenticated
with check (bucket_id='exercise-library-media' and (select public.is_coach())
 and (storage.foldername(name))[1]=(select auth.uid())::text);

-- Only new, unlinked uploads may be cleaned up after a failed publication.
create policy exercise_library_media_cleanup on storage.objects
for delete to authenticated
using (bucket_id='exercise-library-media' and (select public.is_coach())
 and (storage.foldername(name))[1]=(select auth.uid())::text
 and not exists (
  select 1 from public.exercise_library e
  where e.video_url like '%/exercise-library-media/'||storage.objects.name
     or e.male_video_url like '%/exercise-library-media/'||storage.objects.name
     or e.female_video_url like '%/exercise-library-media/'||storage.objects.name
     or e.thumbnail_url like '%/exercise-library-media/'||storage.objects.name
     or e.male_image_url like '%/exercise-library-media/'||storage.objects.name
     or e.female_image_url like '%/exercise-library-media/'||storage.objects.name
 ));

create policy exercise_library_media_coach_read on storage.objects
for select to authenticated
using (bucket_id='exercise-library-media' and (select public.is_coach())
 and (storage.foldername(name))[1]=(select auth.uid())::text);
