create extension if not exists pgcrypto;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug in ('a', 'b')),
  title text not null,
  rate numeric(10,2) not null default 12.50,
  updated_at timestamptz not null default now(),
  updated_by text
);

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  position integer not null default 0,
  image_mode text not null default 'url' check (image_mode in ('url', 'file')),
  image_url text,
  image_data text,
  title text,
  yupoo_url text,
  taobao_url text,
  size text,
  price_cny numeric(10,2) not null default 0,
  owner_email text,
  updated_by text,
  updated_at timestamptz not null default now()
);

create index if not exists cart_items_workspace_idx on public.cart_items(workspace_id, position);

alter table public.workspaces enable row level security;
alter table public.cart_items enable row level security;

create policy "auth users can read workspaces" on public.workspaces for select using (auth.role() = 'authenticated');
create policy "auth users can update workspaces" on public.workspaces for update using (auth.role() = 'authenticated');
create policy "auth users can read cart_items" on public.cart_items for select using (auth.role() = 'authenticated');
create policy "auth users can insert cart_items" on public.cart_items for insert with check (auth.role() = 'authenticated');
create policy "auth users can update cart_items" on public.cart_items for update using (auth.role() = 'authenticated');
create policy "auth users can delete cart_items" on public.cart_items for delete using (auth.role() = 'authenticated');

insert into public.workspaces (slug, title, rate)
values ('a', 'Заказы 1', 12.50), ('b', 'Заказы 2', 12.50)
on conflict (slug) do nothing;

alter publication supabase_realtime add table public.workspaces;
alter publication supabase_realtime add table public.cart_items;
