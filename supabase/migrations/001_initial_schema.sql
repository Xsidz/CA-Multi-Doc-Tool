-- ============================================================
-- StatutorySync — Initial Database Schema
-- ============================================================

-- Enable necessary extensions
create extension if not exists "uuid-ossp";

-- ============================================================
-- PROFILES
-- ============================================================
create table if not exists public.profiles (
    id           uuid primary key references auth.users(id) on delete cascade,
    full_name    text,
    company_name text,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
    insert into public.profiles (id, full_name, company_name)
    values (
        new.id,
        new.raw_user_meta_data ->> 'full_name',
        new.raw_user_meta_data ->> 'company_name'
    );
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- Update updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger profiles_updated_at
    before update on public.profiles
    for each row execute function public.set_updated_at();

-- RLS for profiles
alter table public.profiles enable row level security;

create policy "Users can view own profile"
    on public.profiles for select
    using (auth.uid() = id);

create policy "Users can update own profile"
    on public.profiles for update
    using (auth.uid() = id)
    with check (auth.uid() = id);


-- ============================================================
-- SUBSCRIPTIONS
-- ============================================================
create table if not exists public.subscriptions (
    id                      uuid primary key default uuid_generate_v4(),
    user_id                 uuid not null references auth.users(id) on delete cascade,
    stripe_customer_id      text,
    stripe_subscription_id  text unique,
    plan                    text not null default 'free'
                            check (plan in ('free', 'starter', 'standard', 'pro')),
    status                  text not null default 'active'
                            check (status in ('active', 'trialing', 'past_due', 'canceled', 'incomplete')),
    current_period_start    timestamptz,
    current_period_end      timestamptz,
    created_at              timestamptz not null default now(),
    updated_at              timestamptz not null default now()
);

create index if not exists subscriptions_user_id_idx
    on public.subscriptions(user_id);

create trigger subscriptions_updated_at
    before update on public.subscriptions
    for each row execute function public.set_updated_at();

-- RLS for subscriptions
alter table public.subscriptions enable row level security;

create policy "Users can view own subscription"
    on public.subscriptions for select
    using (auth.uid() = user_id);

-- Service role can upsert (used by Stripe webhook handler)
create policy "Service role can manage subscriptions"
    on public.subscriptions for all
    using (auth.role() = 'service_role');


-- ============================================================
-- USAGE LOGS
-- ============================================================
create table if not exists public.usage_logs (
    id              uuid primary key default uuid_generate_v4(),
    user_id         uuid not null references auth.users(id) on delete cascade,
    doc_type        text not null
                    check (doc_type in ('gstr3b', 'esic', 'pf_ecr', 'ptrc', 'tds_itns281')),
    filename_hash   text not null,
    status          text not null default 'success',
    created_at      timestamptz not null default now()
);

create index if not exists usage_logs_user_id_created_at_idx
    on public.usage_logs(user_id, created_at desc);

-- RLS for usage_logs
alter table public.usage_logs enable row level security;

create policy "Users can view own usage logs"
    on public.usage_logs for select
    using (auth.uid() = user_id);

create policy "Service role can insert usage logs"
    on public.usage_logs for insert
    with check (auth.role() = 'service_role');


-- ============================================================
-- COMPOSIO CONNECTIONS
-- ============================================================
create table if not exists public.composio_connections (
    id              uuid primary key default uuid_generate_v4(),
    user_id         uuid not null references auth.users(id) on delete cascade,
    app             text not null default 'GOOGLESHEETS',
    connected_at    timestamptz not null default now(),
    metadata        jsonb
);

create unique index if not exists composio_connections_user_app_idx
    on public.composio_connections(user_id, app);

-- RLS for composio_connections
alter table public.composio_connections enable row level security;

create policy "Users can view own composio connections"
    on public.composio_connections for select
    using (auth.uid() = user_id);

create policy "Users can manage own composio connections"
    on public.composio_connections for all
    using (auth.uid() = user_id);


-- ============================================================
-- USAGE THIS PERIOD VIEW
-- ============================================================
-- Returns one row per user with their current billing period usage.
-- Falls back to calendar month if no active subscription found.
create or replace view public.usage_this_period as
select
    u.id                                as user_id,
    coalesce(s.plan, 'free')           as plan,
    coalesce(s.status, 'active')       as subscription_status,
    count(ul.id)::int                  as files_used,
    case
        when coalesce(s.plan, 'free') = 'starter'  then 25
        when coalesce(s.plan, 'free') = 'standard' then 50
        when coalesce(s.plan, 'free') = 'pro'       then 120
        else 2
    end                                 as plan_limit,
    coalesce(
        s.current_period_start,
        date_trunc('month', now())
    )                                   as period_start,
    coalesce(
        s.current_period_end,
        date_trunc('month', now()) + interval '1 month'
    )                                   as period_end
from
    auth.users u
    left join public.subscriptions s
        on s.user_id = u.id
        and s.status in ('active', 'trialing')
    left join public.usage_logs ul
        on ul.user_id = u.id
        and ul.status = 'success'
        and ul.created_at >= coalesce(
            s.current_period_start,
            date_trunc('month', now())
        )
        and ul.created_at <  coalesce(
            s.current_period_end,
            date_trunc('month', now()) + interval '1 month'
        )
group by
    u.id, s.plan, s.status, s.current_period_start, s.current_period_end;

-- Grant select on view to authenticated role
grant select on public.usage_this_period to authenticated;
grant select on public.usage_this_period to service_role;
