create table if not exists user_preferences (
  user_id uuid references auth.users(id) on delete cascade primary key,
  ai_mode text default 'ceova', -- 'ceova', 'custom'
  preferred_provider text,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table user_preferences enable row level security;

-- Policies
create policy "Users can view their own preferences"
  on user_preferences for select
  using (auth.uid() = user_id);

create policy "Users can insert their own preferences"
  on user_preferences for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own preferences"
  on user_preferences for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
