-- Enable pgvector extension for future use (V1 uses full-text search, but this prepares for V2)
create extension if not exists vector;

-- LAYER 2: USER MEMORY (Long-Term Structured Data)
create table if not exists public.user_memory_longterm (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    category text not null, -- e.g., Profile, Preference, Business, Goal
    title text not null,
    value text not null,
    confidence numeric(3,2) default 1.00 not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    last_accessed timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Full-text search index for user_memory_longterm
alter table public.user_memory_longterm add column fts tsvector generated always as (setweight(to_tsvector('english', coalesce(title, '')), 'A') || setweight(to_tsvector('english', coalesce(value, '')), 'B')) stored;
create index user_memory_longterm_fts on public.user_memory_longterm using gin (fts);

-- LAYER 3: KNOWLEDGE MEMORY (Unstructured Documents)
create table if not exists public.knowledge_memory (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    content text not null,
    embedding vector(1536), -- Nullable for V1
    metadata jsonb default '{}'::jsonb,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Full-text search index for knowledge_memory
alter table public.knowledge_memory add column fts tsvector generated always as (to_tsvector('english', coalesce(content, ''))) stored;
create index knowledge_memory_fts on public.knowledge_memory using gin (fts);

-- HNSW index for vector similarity (for future embedding models)
create index on public.knowledge_memory using hnsw (embedding vector_cosine_ops);

-- RLS POLICIES FOR LAYER 2
alter table public.user_memory_longterm enable row level security;

create policy "Users can view their own longterm memories"
    on public.user_memory_longterm for select
    using (auth.uid() = user_id);

create policy "Users can insert their own longterm memories"
    on public.user_memory_longterm for insert
    with check (auth.uid() = user_id);

create policy "Users can update their own longterm memories"
    on public.user_memory_longterm for update
    using (auth.uid() = user_id);

create policy "Users can delete their own longterm memories"
    on public.user_memory_longterm for delete
    using (auth.uid() = user_id);

-- RLS POLICIES FOR LAYER 3
alter table public.knowledge_memory enable row level security;

create policy "Users can view their own knowledge memories"
    on public.knowledge_memory for select
    using (auth.uid() = user_id);

create policy "Users can insert their own knowledge memories"
    on public.knowledge_memory for insert
    with check (auth.uid() = user_id);

create policy "Users can update their own knowledge memories"
    on public.knowledge_memory for update
    using (auth.uid() = user_id);

create policy "Users can delete their own knowledge memories"
    on public.knowledge_memory for delete
    using (auth.uid() = user_id);

-- PostgreSQL functions for searching
create or replace function search_memory_longterm_fts(search_query text, user_id_filter uuid, max_results int default 5)
returns setof public.user_memory_longterm as $$
begin
    return query
    select * from public.user_memory_longterm
    where user_id = user_id_filter
    and fts @@ plainto_tsquery('english', search_query)
    order by ts_rank(fts, plainto_tsquery('english', search_query)) desc, last_accessed desc
    limit max_results;
end;
$$ language plpgsql security definer;

create or replace function search_knowledge_memory_fts(search_query text, user_id_filter uuid, max_results int default 10)
returns setof public.knowledge_memory as $$
begin
    return query
    select * from public.knowledge_memory
    where user_id = user_id_filter
    and fts @@ plainto_tsquery('english', search_query)
    order by ts_rank(fts, plainto_tsquery('english', search_query)) desc, created_at desc
    limit max_results;
end;
$$ language plpgsql security definer;
