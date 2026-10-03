-- Atomic "add subscription": resolving or creating the category and inserting the subscription
-- happen in one function call, so one transaction — any error rolls the whole call back and no
-- orphan category is left behind (context/foundation/lessons.md: writes in one API call are atomic).
--
-- security invoker: runs with the caller's role, so the existing RLS policies and grants on
-- categories/subscriptions apply unchanged (e.g. a category the caller cannot see is rejected).

create function public.create_subscription(
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

  insert into public.subscriptions (user_id, name, amount, currency, cycle, category_id)
  values (v_user_id, btrim(p_name), p_amount, p_currency, p_cycle, v_category_id)
  returning id into v_subscription_id;

  return v_subscription_id;
end;
$$;

-- Functions are executable by PUBLIC by default; only signed-in users may call this one.
revoke all on function public.create_subscription(text, numeric, text, text, uuid, text) from public, anon;
grant execute on function public.create_subscription(text, numeric, text, text, uuid, text) to authenticated;
