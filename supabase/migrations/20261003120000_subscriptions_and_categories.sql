-- S-01: subscriptions and categories with row-level security.
-- Additive only: creates new tables, starter rows, grants and policies.

-- categories: starter rows (user_id null, shared read-only) and per-user rows.
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references auth.users (id) on delete cascade,
  name text not null check (name = btrim(name) and char_length(name) between 1 and 50),
  created_at timestamptz not null default now()
);

create unique index categories_user_id_lower_name_key
  on public.categories (user_id, lower(name)) nulls not distinct;

insert into public.categories (user_id, name) values
  (null, 'Streaming'),
  (null, 'Music'),
  (null, 'Software & tools'),
  (null, 'Cloud storage'),
  (null, 'News & media'),
  (null, 'Gaming'),
  (null, 'Fitness'),
  (null, 'Other');

-- subscriptions: always owned by the caller.
-- category_id uses the default NO ACTION (deferred to statement end), not RESTRICT, so the
-- auth.users cascade can delete a user's categories and subscriptions in the same statement.
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (name = btrim(name) and char_length(name) between 1 and 100),
  amount numeric(10, 2) not null check (amount > 0),
  currency text not null default 'PLN' check (currency in ('PLN', 'EUR', 'USD')),
  cycle text not null check (cycle in ('monthly', 'yearly')),
  category_id uuid not null references public.categories (id),
  created_at timestamptz not null default now()
);

create index subscriptions_user_id_created_at_idx
  on public.subscriptions (user_id, created_at desc);

-- Explicit grants: do not rely on Supabase's default privileges for new public tables.
revoke all on table public.categories from anon, authenticated;
revoke all on table public.subscriptions from anon, authenticated;
grant select, insert on table public.categories to authenticated;
grant select, insert on table public.subscriptions to authenticated;

-- Row-level security: per-operation, authenticated role only. No update/delete policies yet (S-02/S-03).
alter table public.categories enable row level security;
alter table public.subscriptions enable row level security;

create policy "categories_select_starter_or_own"
  on public.categories
  for select
  to authenticated
  using (user_id is null or user_id = (select auth.uid()));

create policy "categories_insert_own"
  on public.categories
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "subscriptions_select_own"
  on public.subscriptions
  for select
  to authenticated
  using (user_id = (select auth.uid()));

-- The category must be visible to the caller (starter or own); the foreign key alone would accept
-- another user's private category id.
create policy "subscriptions_insert_own_with_visible_category"
  on public.subscriptions
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.categories c
      where c.id = category_id
        and (c.user_id is null or c.user_id = (select auth.uid()))
    )
  );
