create table public.user_memory (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    content text not null,
    type text default 'automatic',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- set up RLS
alter table public.user_memory enable row level security;

create policy "Users can view their own memories"
    on public.user_memory for select
    using (auth.uid() = user_id);

create policy "Users can insert their own memories"
    on public.user_memory for insert
    with check (auth.uid() = user_id);

create policy "Users can update their own memories"
    on public.user_memory for update
    using (auth.uid() = user_id);

create policy "Users can delete their own memories"
    on public.user_memory for delete
    using (auth.uid() = user_id);
