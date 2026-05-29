-- Seed system exercises for voice logging and workout tracking
insert into public.exercises (name, slug, category, equipment, muscle_groups, is_system) values
  ('Bench Press', 'bench-press', 'push', 'barbell', array['chest', 'triceps', 'shoulders'], true),
  ('Incline Bench Press', 'incline-bench-press', 'push', 'barbell', array['chest', 'shoulders'], true),
  ('Overhead Press', 'overhead-press', 'push', 'barbell', array['shoulders', 'triceps'], true),
  ('Squat', 'squat', 'squat', 'barbell', array['quads', 'glutes'], true),
  ('Front Squat', 'front-squat', 'squat', 'barbell', array['quads', 'core'], true),
  ('Deadlift', 'deadlift', 'hinge', 'barbell', array['back', 'hamstrings', 'glutes'], true),
  ('Romanian Deadlift', 'romanian-deadlift', 'hinge', 'barbell', array['hamstrings', 'glutes'], true),
  ('Barbell Row', 'barbell-row', 'pull', 'barbell', array['back', 'biceps'], true),
  ('Pull Up', 'pull-up', 'pull', 'bodyweight', array['back', 'biceps'], true),
  ('Lat Pulldown', 'lat-pulldown', 'pull', 'cable', array['back', 'biceps'], true),
  ('Dumbbell Curl', 'dumbbell-curl', 'pull', 'dumbbell', array['biceps'], true),
  ('Tricep Pushdown', 'tricep-pushdown', 'push', 'cable', array['triceps'], true),
  ('Leg Press', 'leg-press', 'squat', 'machine', array['quads', 'glutes'], true),
  ('Leg Curl', 'leg-curl', 'hinge', 'machine', array['hamstrings'], true),
  ('Calf Raise', 'calf-raise', 'other', 'machine', array['calves'], true),
  ('Plank', 'plank', 'core', 'bodyweight', array['core'], true)
on conflict (slug) do nothing;

-- Storage bucket for progress photos
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('progress-photos', 'progress-photos', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "Users upload progress photos"
on storage.objects for insert
with check (
  bucket_id = 'progress-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Users read progress photos"
on storage.objects for select
using (
  bucket_id = 'progress-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Users delete progress photos"
on storage.objects for delete
using (
  bucket_id = 'progress-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- Default nutrition goals trigger for new users
create or replace function public.handle_new_user_nutrition()
returns trigger as $$
begin
  insert into public.nutrition_goals (user_id, daily_calories, protein_g, carbs_g, fat_g, water_ml)
  values (new.id, 2400, 180, 250, 70, 3000);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_profile_created_nutrition on public.profiles;
create trigger on_profile_created_nutrition
  after insert on public.profiles
  for each row execute function public.handle_new_user_nutrition();
