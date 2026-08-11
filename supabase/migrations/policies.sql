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
