-- Run this whole file once in Supabase → SQL Editor → New query.
create extension if not exists pgcrypto;
create table if not exists public.products (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 name text not null, keywords text not null, max_price numeric(10,2) not null default 709.99,
 currency text not null default 'CAD', enabled boolean not null default true,
 ignore_marketplace boolean not null default true, alert_email text, created_at timestamptz not null default now()
);
create table if not exists public.retailers (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 product_id uuid not null references public.products(id) on delete cascade,
 name text not null, url text not null, kind text not null default 'generic', enabled boolean not null default true,
 created_at timestamptz not null default now()
);
create table if not exists public.stock_state (
 id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id) on delete cascade,
 retailer_id uuid not null references public.retailers(id) on delete cascade,
 status text not null, price numeric(10,2), detail text, checked_at timestamptz not null default now(),
 unique(product_id, retailer_id)
);
alter table public.products enable row level security;
alter table public.retailers enable row level security;
alter table public.stock_state enable row level security;
create policy "Users manage own products" on public.products for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own retailers" on public.retailers for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users read own stock state" on public.stock_state for select using (exists (select 1 from public.products p where p.id=product_id and p.user_id=auth.uid()));
-- The GitHub Action uses the service-role key, which bypasses RLS. Never put that key in the website.
