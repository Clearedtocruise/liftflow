-- Copy the signup name onto profiles, and heal rows that already missed it.
--
-- handle_new_user used to insert only id+email. The name lived in auth metadata, so Home greeted
-- nobody even though signup collected a display name.

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    nullif(
      trim(
        coalesce(
          new.raw_user_meta_data->>'display_name',
          new.raw_user_meta_data->>'full_name',
          new.raw_user_meta_data->>'name',
          trim(
            coalesce(new.raw_user_meta_data->>'given_name', '') || ' ' ||
            coalesce(new.raw_user_meta_data->>'family_name', '')
          )
        )
      ),
      ''
    )
  );
  insert into public.user_preferences (user_id) values (new.id);
  insert into public.subscriptions (user_id) values (new.id);
  return new;
end;
$$ language plpgsql security definer;

-- Heal existing accounts where the name is only on auth metadata.
update public.profiles as p
set display_name = nullif(
  trim(
    coalesce(
      u.raw_user_meta_data->>'display_name',
      u.raw_user_meta_data->>'full_name',
      u.raw_user_meta_data->>'name',
      trim(
        coalesce(u.raw_user_meta_data->>'given_name', '') || ' ' ||
        coalesce(u.raw_user_meta_data->>'family_name', '')
      )
    )
  ),
  ''
)
from auth.users as u
where u.id = p.id
  and (p.display_name is null or length(trim(p.display_name)) = 0)
  and nullif(
    trim(
      coalesce(
        u.raw_user_meta_data->>'display_name',
        u.raw_user_meta_data->>'full_name',
        u.raw_user_meta_data->>'name',
        trim(
          coalesce(u.raw_user_meta_data->>'given_name', '') || ' ' ||
          coalesce(u.raw_user_meta_data->>'family_name', '')
        )
      )
    ),
    ''
  ) is not null;
