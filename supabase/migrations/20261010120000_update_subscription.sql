-- S-02: edit a subscription.
-- Additive only: a column-level update grant, one update policy and the atomic update_subscription RPC.

-- Column-level: user_id and created_at stay immutable at the privilege level, whatever the policy says.
grant update (name, amount, currency, cycle, category_id) on table public.subscriptions to authenticated;

-- using: other users' rows are invisible to the UPDATE (it matches 0 rows).
-- with check: the row stays owned by the caller, and the category must be visible to the caller
-- (starter or own) — the foreign key alone would accept another user's private category id.
create policy "subscriptions_update_own_with_visible_category"
  on public.subscriptions
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.categories c
      where c.id = category_id
        and (c.user_id is null or c.user_id = (select auth.uid()))
    )
  );

-- Atomic "edit subscription": resolving or creating the category and updating the subscription happen
-- in one function call, so one transaction — any error rolls the whole call back and no orphan category
-- is left behind (context/foundation/lessons.md: writes in one API call are atomic).
--
-- security invoker: runs with the caller's role, so the grants and RLS policies above apply unchanged.
-- Under RLS an UPDATE of someone else's (or a missing) row matches 0 rows and succeeds silently, so the
-- function raises P0002 itself; that also rolls back a category created earlier in the same call.

create function public.update_subscription(
  p_id uuid,
  p_name text,
  p_amount numeric,
  p_currency text,
  p_cycle text,
  p_category_id uuid default null,
  p_new_category text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_category_id uuid := p_category_id;
  v_new_category text := nullif(btrim(p_new_category), '');
  v_subscription_id uuid;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  -- Category resolution: keep identical to public.create_subscription
  -- (20261003140000_create_subscription_rpc.sql). A change to one must be made in the other.
  if v_new_category is not null then
    -- Exact case-insensitive match against visible categories (RLS: starter or own), starters first.
    -- Plain equality on lower(): no LIKE/ILIKE, so '%' and '_' are literal characters.
    select c.id
      into v_category_id
      from public.categories c
     where lower(c.name) = lower(v_new_category)
     order by c.user_id nulls first
     limit 1;

    if v_category_id is null then
      insert into public.categories (user_id, name)
      values (v_user_id, v_new_category)
      on conflict (user_id, (lower(name))) do nothing
      returning id into v_category_id;

      if v_category_id is null then
        -- Created concurrently by the same user: reuse it.
        select c.id
          into v_category_id
          from public.categories c
         where c.user_id = v_user_id
           and lower(c.name) = lower(v_new_category);
      end if;
    end if;
  end if;

  update public.subscriptions
     set name = btrim(p_name),
         amount = p_amount,
         currency = p_currency,
         cycle = p_cycle,
         category_id = v_category_id
   where id = p_id
  returning id into v_subscription_id;

  if v_subscription_id is null then
    raise exception 'subscription not found' using errcode = 'P0002';
  end if;

  return v_subscription_id;
end;
$$;

-- Functions are executable by PUBLIC by default; only signed-in users may call this one.
revoke all on function public.update_subscription(uuid, text, numeric, text, text, uuid, text) from public, anon;
grant execute on function public.update_subscription(uuid, text, numeric, text, text, uuid, text) to authenticated;
