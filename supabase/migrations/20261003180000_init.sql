-- GameStore Studio: schema, constraints, indexes and row level security.
-- Apply in the Supabase SQL Editor or with the Supabase CLI. Do not put secrets in this file.

create extension if not exists pgcrypto;

create type public.user_role as enum ('user', 'admin');
create type public.game_status as enum ('draft', 'published', 'unpublished');
create type public.order_status as enum ('pending', 'paid', 'failed', 'cancelled', 'refunded');
create type public.payment_status as enum ('pending', 'succeeded', 'failed', 'refunded');
create type public.discount_type as enum ('percent', 'fixed');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text not null default 'Jogador' check (char_length(display_name) between 1 and 80),
  role public.user_role not null default 'user',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null unique check (char_length(name) between 2 and 40),
  created_at timestamptz not null default now()
);

create table public.games (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text not null check (char_length(description) between 20 and 8000),
  short_description text not null check (char_length(short_description) between 10 and 180),
  price_cents integer not null check (price_cents >= 0),
  currency text not null check (currency in ('brl', 'usd')),
  genre text not null check (char_length(genre) between 2 and 40),
  platforms text[] not null check (
    cardinality(platforms) > 0
    and platforms <@ array['android', 'windows', 'linux', 'macos']::text[]
  ),
  file_size_bytes bigint not null default 0 check (file_size_bytes >= 0),
  current_version text not null check (current_version ~ '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$'),
  min_requirements text not null,
  recommended_requirements text not null,
  cover_path text,
  status public.game_status not null default 'draft',
  is_featured boolean not null default false,
  average_rating numeric(3, 2) not null default 0 check (average_rating >= 0 and average_rating <= 5),
  ratings_count integer not null default 0 check (ratings_count >= 0),
  sales_count integer not null default 0 check (sales_count >= 0),
  created_by uuid references public.profiles (id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.game_versions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  version_name text not null check (version_name ~ '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$'),
  changelog text not null default '',
  storage_path text not null,
  file_name text not null,
  file_size_bytes bigint not null check (file_size_bytes >= 0),
  content_type text not null default 'application/octet-stream',
  platform text not null check (platform in ('android', 'windows', 'linux', 'macos')),
  is_latest boolean not null default false,
  published_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (game_id, platform, version_name)
);

create unique index game_versions_one_latest_per_platform
  on public.game_versions (game_id, platform)
  where is_latest;

create table public.game_images (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  storage_path text not null,
  alt_text text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.game_videos (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  storage_path text,
  external_url text,
  title text not null default 'Trailer',
  created_at timestamptz not null default now(),
  check (
    (storage_path is not null and external_url is null)
    or (storage_path is null and external_url is not null)
  ),
  check (external_url is null or external_url ~ '^https://')
);

create table public.game_categories (
  game_id uuid not null references public.games (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete restrict,
  primary key (game_id, category_id)
);

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null check (char_length(code) between 3 and 40),
  discount_type public.discount_type not null,
  discount_value integer not null check (discount_value > 0),
  active boolean not null default true,
  max_redemptions integer check (max_redemptions is null or max_redemptions > 0),
  redeemed_count integer not null default 0 check (redeemed_count >= 0),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  check (discount_type <> 'percent' or discount_value <= 100)
);

create unique index coupons_code_lower_idx on public.coupons (lower(code));

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  status public.order_status not null default 'pending',
  subtotal_cents integer not null check (subtotal_cents >= 0),
  discount_cents integer not null default 0 check (discount_cents >= 0),
  total_cents integer not null check (total_cents >= 0 and total_cents = subtotal_cents - discount_cents),
  currency text not null check (currency in ('brl', 'usd')),
  coupon_id uuid references public.coupons (id) on delete set null,
  payment_method text not null check (payment_method in ('card', 'pix', 'free')),
  idempotency_key text not null unique check (idempotency_key ~ '^[0-9a-fA-F-]{36}$'),
  stripe_session_id text unique,
  checkout_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  game_id uuid not null references public.games (id) on delete restrict,
  unit_price_cents integer not null check (unit_price_cents >= 0),
  quantity integer not null default 1 check (quantity = 1),
  unique (order_id, game_id)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  provider text not null check (provider in ('stripe', 'free')),
  provider_payment_id text not null,
  provider_event_id text not null unique,
  status public.payment_status not null,
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null check (currency in ('brl', 'usd')),
  created_at timestamptz not null default now()
);

create table public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons (id) on delete restrict,
  user_id uuid references public.profiles (id) on delete set null,
  order_id uuid not null unique references public.orders (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.downloads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  game_id uuid not null references public.games (id) on delete cascade,
  version_id uuid not null references public.game_versions (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  game_id uuid not null references public.games (id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  body text not null default '' check (char_length(body) <= 2000),
  author_name text not null default 'Jogador',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, game_id)
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index games_status_published_idx on public.games (status, published_at desc);
create index games_featured_idx on public.games (is_featured) where status = 'published';
create index games_sales_idx on public.games (sales_count desc);
create index game_versions_game_idx on public.game_versions (game_id, published_at desc);
create index orders_user_status_idx on public.orders (user_id, status);
create index order_items_game_idx on public.order_items (game_id);
create index payments_order_idx on public.payments (order_id);
create index reviews_game_idx on public.reviews (game_id, created_at desc);
create index downloads_user_game_idx on public.downloads (user_id, game_id, created_at desc);
create index audit_logs_created_idx on public.audit_logs (created_at desc);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and deleted_at is null
  );
$$;

create or replace function public.owns_game(p_game_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where oi.game_id = p_game_id
      and o.user_id = auth.uid()
      and o.status = 'paid'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      split_part(coalesce(new.email, 'jogador'), '@', 1)
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('gamestore.internal', '1', true);
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.sync_profile_email();

create or replace function public.protect_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('gamestore.internal', true) = '1' or auth.uid() is null then
    new.updated_at = now();
    return new;
  end if;
  if not public.is_admin() then
    new.role = old.role;
    new.deleted_at = old.deleted_at;
    new.email = old.email;
  end if;
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_protect
  before update on public.profiles
  for each row execute function public.protect_profile();

create trigger games_updated_at
  before update on public.games
  for each row execute function public.set_updated_at();

create trigger orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

create or replace function public.prepare_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Faça login para avaliar.';
  end if;
  if tg_op = 'INSERT' then
    new.user_id = auth.uid();
    new.author_name = coalesce(
      (select display_name from public.profiles where id = auth.uid()),
      'Jogador'
    );
  else
    new.user_id = old.user_id;
    new.author_name = old.author_name;
    new.game_id = old.game_id;
  end if;
  new.updated_at = now();
  return new;
end;
$$;

create trigger reviews_prepare
  before insert or update on public.reviews
  for each row execute function public.prepare_review();

create or replace function public.refresh_game_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid;
begin
  target = coalesce(new.game_id, old.game_id);
  update public.games g
  set
    ratings_count = stats.ratings_count,
    average_rating = stats.average_rating
  from (
    select
      count(*)::integer as ratings_count,
      coalesce(round(avg(rating)::numeric, 2), 0) as average_rating
    from public.reviews
    where game_id = target
  ) stats
  where g.id = target;
  return null;
end;
$$;

create trigger reviews_refresh_rating
  after insert or update or delete on public.reviews
  for each row execute function public.refresh_game_rating();

create or replace function public.bump_sales_on_paid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'paid' and (tg_op = 'INSERT' or old.status is distinct from 'paid') then
    update public.games g
      set sales_count = g.sales_count + oi.quantity
      from public.order_items oi
      where oi.order_id = new.id and oi.game_id = g.id;
    insert into public.audit_logs (actor_id, action, entity, entity_id, metadata)
    values (new.user_id, 'order_paid', 'orders', new.id, jsonb_build_object('total_cents', new.total_cents));
  end if;
  return new;
end;
$$;

create trigger orders_bump_sales
  after insert or update of status on public.orders
  for each row execute function public.bump_sales_on_paid();

create or replace function public.increment_coupon_redemption()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.coupons
    set redeemed_count = redeemed_count + 1
    where id = new.coupon_id;
  return new;
end;
$$;

create trigger coupon_redemptions_count
  after insert on public.coupon_redemptions
  for each row execute function public.increment_coupon_redemption();

create or replace function public.quote_coupon(p_code text, p_subtotal integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  coupon public.coupons%rowtype;
  discount integer;
begin
  if p_subtotal is null or p_subtotal < 0 then
    return jsonb_build_object('valid', false, 'discount_cents', 0, 'message', 'Subtotal inválido.');
  end if;
  if p_code is null or length(trim(p_code)) = 0 then
    return jsonb_build_object('valid', true, 'discount_cents', 0, 'message', '');
  end if;
  select * into coupon
  from public.coupons
  where lower(code) = lower(trim(p_code))
    and active
    and (expires_at is null or expires_at > now())
    and (max_redemptions is null or redeemed_count < max_redemptions);
  if not found then
    return jsonb_build_object('valid', false, 'discount_cents', 0, 'message', 'Cupom inválido ou expirado.');
  end if;
  if coupon.discount_type = 'percent' then
    discount = least(p_subtotal, (p_subtotal * coupon.discount_value) / 100);
  else
    discount = least(p_subtotal, coupon.discount_value);
  end if;
  return jsonb_build_object('valid', true, 'discount_cents', discount, 'message', 'Cupom aplicado.');
end;
$$;

create or replace function public.create_pending_order(
  p_user_id uuid,
  p_game_ids uuid[],
  p_idempotency_key text,
  p_coupon_code text,
  p_payment_method text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  existing public.orders%rowtype;
  coupon public.coupons%rowtype;
  coupon_id uuid;
  game_count integer;
  currency text;
  subtotal integer;
  discount integer := 0;
  total integer;
  order_row public.orders%rowtype;
  line_items jsonb;
begin
  if p_user_id is null or p_idempotency_key is null or p_idempotency_key !~ '^[0-9a-fA-F-]{36}$' then
    raise exception 'Pedido inválido.';
  end if;
  if p_game_ids is null or cardinality(p_game_ids) < 1 or cardinality(p_game_ids) > 20 then
    raise exception 'Selecione de 1 a 20 jogos.';
  end if;
  if (select count(distinct item) from unnest(p_game_ids) item) <> cardinality(p_game_ids) then
    raise exception 'Há jogos repetidos no pedido.';
  end if;
  if p_payment_method not in ('card', 'pix') then
    raise exception 'Método de pagamento inválido.';
  end if;

  select * into existing from public.orders where idempotency_key = p_idempotency_key for update;
  if found then
    if existing.user_id is distinct from p_user_id then
      raise exception 'Pedido inválido.';
    end if;
    select coalesce(jsonb_agg(jsonb_build_object(
      'title', g.title,
      'unit_amount', oi.unit_price_cents
    )), '[]'::jsonb)
      into line_items
    from public.order_items oi
    join public.games g on g.id = oi.game_id
    where oi.order_id = existing.id;
    return jsonb_build_object(
      'reused', true,
      'order_id', existing.id,
      'status', existing.status,
      'currency', existing.currency,
      'subtotal_cents', existing.subtotal_cents,
      'discount_cents', existing.discount_cents,
      'total_cents', existing.total_cents,
      'checkout_url', existing.checkout_url,
      'payment_method', existing.payment_method,
      'line_items', line_items
    );
  end if;

  perform 1
  from public.games g
  where g.id = any(p_game_ids)
    and g.status = 'published'
  for update;

  select count(*), min(g.currency), coalesce(sum(g.price_cents), 0)
    into game_count, currency, subtotal
  from public.games g
  where g.id = any(p_game_ids)
    and g.status = 'published';

  if game_count <> cardinality(p_game_ids) then
    raise exception 'Um ou mais jogos não estão disponíveis.';
  end if;
  if (select count(distinct g.currency) from public.games g where g.id = any(p_game_ids)) <> 1 then
    raise exception 'Não é possível misturar moedas no mesmo pedido.';
  end if;
  if p_payment_method = 'pix' and currency <> 'brl' then
    raise exception 'PIX está disponível apenas para preços em BRL.';
  end if;
  if exists (
    select 1
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where o.user_id = p_user_id
      and o.status = 'paid'
      and oi.game_id = any(p_game_ids)
  ) then
    raise exception 'Você já possui um dos jogos selecionados.';
  end if;

  if p_coupon_code is not null and length(trim(p_coupon_code)) > 0 then
    select * into coupon
    from public.coupons
    where lower(code) = lower(trim(p_coupon_code))
    for update;
    if not found or not coupon.active or (coupon.expires_at is not null and coupon.expires_at <= now())
      or (coupon.max_redemptions is not null and coupon.redeemed_count >= coupon.max_redemptions) then
      raise exception 'Cupom inválido ou expirado.';
    end if;
    if coupon.discount_type = 'percent' then
      discount = least(subtotal, (subtotal * coupon.discount_value) / 100);
    else
      discount = least(subtotal, coupon.discount_value);
    end if;
    coupon_id = coupon.id;
  end if;

  total = subtotal - discount;
  insert into public.orders (
    user_id, status, subtotal_cents, discount_cents, total_cents, currency,
    coupon_id, payment_method, idempotency_key
  ) values (
    p_user_id, 'pending', subtotal, discount, total, currency,
    coupon_id, case when total = 0 then 'free' else p_payment_method end, p_idempotency_key
  )
  returning * into order_row;

  insert into public.order_items (order_id, game_id, unit_price_cents, quantity)
  select order_row.id, g.id, g.price_cents, 1
  from public.games g
  where g.id = any(p_game_ids);

  if total = 0 then
    insert into public.payments (
      order_id, provider, provider_payment_id, provider_event_id, status, amount_cents, currency
    ) values (
      order_row.id, 'free', 'free_' || order_row.id::text, 'free_' || order_row.id::text,
      'succeeded', 0, currency
    );
    if coupon_id is not null then
      insert into public.coupon_redemptions (coupon_id, user_id, order_id)
      values (coupon_id, p_user_id, order_row.id);
    end if;
    update public.orders set status = 'paid' where id = order_row.id returning * into order_row;
  end if;

  select jsonb_agg(jsonb_build_object('title', g.title, 'unit_amount', oi.unit_price_cents))
    into line_items
  from public.order_items oi
  join public.games g on g.id = oi.game_id
  where oi.order_id = order_row.id;

  insert into public.audit_logs (actor_id, action, entity, entity_id, metadata)
  values (
    p_user_id, 'order_created', 'orders', order_row.id,
    jsonb_build_object('total_cents', order_row.total_cents, 'currency', currency)
  );

  return jsonb_build_object(
    'reused', false,
    'order_id', order_row.id,
    'status', order_row.status,
    'currency', order_row.currency,
    'subtotal_cents', order_row.subtotal_cents,
    'discount_cents', order_row.discount_cents,
    'total_cents', order_row.total_cents,
    'checkout_url', order_row.checkout_url,
    'payment_method', order_row.payment_method,
    'line_items', line_items
  );
end;
$$;

create or replace function public.mark_order_paid(
  p_order_id uuid,
  p_provider text,
  p_provider_payment_id text,
  p_provider_event_id text,
  p_amount_cents integer,
  p_currency text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  order_row public.orders%rowtype;
begin
  if p_provider <> 'stripe' then
    raise exception 'Provedor inválido.';
  end if;
  select * into order_row from public.orders where id = p_order_id for update;
  if not found then
    return jsonb_build_object('status', 'missing');
  end if;
  if exists (select 1 from public.payments where provider_event_id = p_provider_event_id)
    or exists (select 1 from public.payments where order_id = p_order_id and status = 'succeeded')
    or order_row.status = 'paid' then
    return jsonb_build_object('status', 'duplicate');
  end if;
  if lower(p_currency) is distinct from order_row.currency or p_amount_cents is distinct from order_row.total_cents then
    insert into public.audit_logs (actor_id, action, entity, entity_id, metadata)
    values (
      order_row.user_id, 'payment_amount_mismatch', 'orders', order_row.id,
      jsonb_build_object('expected', order_row.total_cents, 'received', p_amount_cents, 'currency', p_currency)
    );
    return jsonb_build_object('status', 'mismatch');
  end if;
  if order_row.status <> 'pending' then
    return jsonb_build_object('status', order_row.status);
  end if;

  insert into public.payments (
    order_id, provider, provider_payment_id, provider_event_id, status, amount_cents, currency
  ) values (
    order_row.id, 'stripe', p_provider_payment_id, p_provider_event_id, 'succeeded', p_amount_cents, order_row.currency
  );
  if order_row.coupon_id is not null then
    insert into public.coupon_redemptions (coupon_id, user_id, order_id)
    select c.id, order_row.user_id, order_row.id
    from public.coupons c
    where c.id = order_row.coupon_id
      and (c.max_redemptions is null or c.redeemed_count < c.max_redemptions);
  end if;
  update public.orders set status = 'paid' where id = order_row.id;
  return jsonb_build_object('status', 'paid');
end;
$$;

create or replace function public.mark_order_failed(p_order_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.orders
    set status = 'failed'
    where id = p_order_id and status = 'pending';
  insert into public.audit_logs (action, entity, entity_id, metadata)
  values ('order_failed', 'orders', p_order_id, jsonb_build_object('reason', left(coalesce(p_reason, ''), 300)));
end;
$$;

create or replace function public.cancel_own_pending_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Faça login.';
  end if;
  update public.orders
    set status = 'cancelled'
    where id = p_order_id and user_id = auth.uid() and status = 'pending';
  if not found then
    raise exception 'Não foi possível cancelar este pedido.';
  end if;
end;
$$;

create or replace function public.admin_cancel_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Acesso negado.';
  end if;
  update public.orders set status = 'cancelled' where id = p_order_id and status = 'pending';
  if not found then
    raise exception 'Somente pedidos pendentes podem ser cancelados.';
  end if;
  insert into public.audit_logs (actor_id, action, entity, entity_id)
  values (auth.uid(), 'order_cancelled', 'orders', p_order_id);
end;
$$;

create or replace function public.admin_set_role(p_user_id uuid, p_role public.user_role)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_count integer;
begin
  if not public.is_admin() then
    raise exception 'Acesso negado.';
  end if;
  if p_role = 'user' and exists (
    select 1 from public.profiles where id = p_user_id and role = 'admin' and deleted_at is null
  ) then
    select count(*) into admin_count from public.profiles where role = 'admin' and deleted_at is null;
    if admin_count <= 1 then
      raise exception 'O último administrador não pode ser rebaixado.';
    end if;
  end if;
  update public.profiles set role = p_role where id = p_user_id and deleted_at is null;
  if not found then
    raise exception 'Usuário não encontrado.';
  end if;
  insert into public.audit_logs (actor_id, action, entity, entity_id, metadata)
  values (auth.uid(), 'set_role', 'profiles', p_user_id, jsonb_build_object('role', p_role));
end;
$$;

create or replace function public.publish_game_version(
  p_game_id uuid,
  p_version_name text,
  p_changelog text,
  p_platform text,
  p_storage_path text,
  p_file_name text,
  p_file_size_bytes bigint,
  p_content_type text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  version_id uuid;
  extension text;
begin
  if not public.is_admin() then
    raise exception 'Acesso negado.';
  end if;
  if p_version_name !~ '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$' then
    raise exception 'Versão inválida.';
  end if;
  if p_platform not in ('android', 'windows', 'linux', 'macos') then
    raise exception 'Plataforma inválida.';
  end if;
  if p_storage_path !~ ('^games/' || p_game_id::text || '/[A-Za-z0-9._/-]+$') then
    raise exception 'Caminho de arquivo inválido.';
  end if;
  extension = lower(regexp_replace(p_file_name, '^.*\.', ''));
  if extension not in ('apk', 'aab', 'zip', 'exe', 'obb', 'xapk', '7z', 'msi', 'dmg', 'tar', 'gz', 'appimage', 'rar') then
    raise exception 'Tipo de arquivo não permitido.';
  end if;
  if not exists (select 1 from public.games where id = p_game_id) then
    raise exception 'Jogo não encontrado.';
  end if;

  update public.game_versions
    set is_latest = false
    where game_id = p_game_id and platform = p_platform and is_latest;

  insert into public.game_versions (
    game_id, version_name, changelog, storage_path, file_name, file_size_bytes,
    content_type, platform, is_latest, created_by
  ) values (
    p_game_id, p_version_name, coalesce(p_changelog, ''), p_storage_path, p_file_name,
    greatest(p_file_size_bytes, 0), coalesce(nullif(p_content_type, ''), 'application/octet-stream'),
    p_platform, true, auth.uid()
  )
  returning id into version_id;

  update public.games
    set current_version = p_version_name,
        file_size_bytes = greatest(p_file_size_bytes, 0)
    where id = p_game_id;

  insert into public.audit_logs (actor_id, action, entity, entity_id, metadata)
  values (
    auth.uid(), 'version_published', 'game_versions', version_id,
    jsonb_build_object('game_id', p_game_id, 'version', p_version_name, 'platform', p_platform)
  );
  return version_id;
end;
$$;

revoke all on function public.create_pending_order(uuid, uuid[], text, text, text) from public, anon, authenticated;
revoke all on function public.mark_order_paid(uuid, text, text, text, integer, text) from public, anon, authenticated;
revoke all on function public.mark_order_failed(uuid, text) from public, anon, authenticated;
grant execute on function public.create_pending_order(uuid, uuid[], text, text, text) to service_role;
grant execute on function public.mark_order_paid(uuid, text, text, text, integer, text) to service_role;
grant execute on function public.mark_order_failed(uuid, text) to service_role;
grant execute on function public.quote_coupon(text, integer) to anon, authenticated, service_role;
grant execute on function public.cancel_own_pending_order(uuid) to authenticated;
grant execute on function public.admin_cancel_order(uuid) to authenticated;
grant execute on function public.admin_set_role(uuid, public.user_role) to authenticated;
grant execute on function public.publish_game_version(uuid, text, text, text, text, text, bigint, text) to authenticated;

revoke all on table public.profiles from anon, authenticated;
grant select (id, display_name, email, role, deleted_at, created_at, updated_at) on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant select on public.categories, public.games, public.game_images, public.game_videos, public.game_categories to anon, authenticated;
grant insert, update, delete on public.categories, public.games, public.game_images, public.game_videos, public.game_categories to authenticated;
revoke all on table public.game_versions from anon, authenticated;
grant select (
  id, game_id, version_name, changelog, file_name, file_size_bytes, content_type, platform, is_latest, published_at, created_at
) on public.game_versions to anon, authenticated;
grant delete on public.game_versions to authenticated;

revoke all on table public.orders from anon, authenticated;
revoke all on table public.order_items from anon, authenticated;
revoke all on table public.payments from anon, authenticated;
revoke all on table public.downloads from anon, authenticated;
revoke all on table public.coupon_redemptions from anon, authenticated;
revoke all on table public.audit_logs from anon, authenticated;
revoke all on table public.coupons from anon, authenticated;
grant select on public.orders, public.order_items, public.payments, public.downloads to authenticated;
grant select, insert, update, delete on public.coupons to authenticated;
grant select on public.coupon_redemptions, public.audit_logs to authenticated;
grant select on public.reviews to anon, authenticated;
grant insert, update, delete on public.reviews to authenticated;

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.games enable row level security;
alter table public.game_versions enable row level security;
alter table public.game_images enable row level security;
alter table public.game_videos enable row level security;
alter table public.game_categories enable row level security;
alter table public.coupons enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.coupon_redemptions enable row level security;
alter table public.downloads enable row level security;
alter table public.reviews enable row level security;
alter table public.audit_logs enable row level security;

create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

create policy categories_read on public.categories
  for select to anon, authenticated
  using (true);

create policy categories_write on public.categories
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy games_read on public.games
  for select to anon, authenticated
  using (status = 'published' or public.is_admin());

create policy games_write on public.games
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy game_versions_read on public.game_versions
  for select to anon, authenticated
  using (
    public.is_admin()
    or public.owns_game(game_id)
    or exists (
      select 1 from public.games g
      where g.id = game_id and g.status = 'published'
    )
  );

create policy game_versions_delete on public.game_versions
  for delete to authenticated
  using (public.is_admin());

create policy game_images_read on public.game_images
  for select to anon, authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.games g where g.id = game_id and g.status = 'published')
  );

create policy game_images_write on public.game_images
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy game_videos_read on public.game_videos
  for select to anon, authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.games g where g.id = game_id and g.status = 'published')
  );

create policy game_videos_write on public.game_videos
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy game_categories_read on public.game_categories
  for select to anon, authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.games g where g.id = game_id and g.status = 'published')
  );

create policy game_categories_write on public.game_categories
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy coupons_admin on public.coupons
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy orders_select on public.orders
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy order_items_select on public.order_items
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.orders o
      where o.id = order_id and o.user_id = auth.uid()
    )
  );

create policy payments_select on public.payments
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.orders o
      where o.id = order_id and o.user_id = auth.uid()
    )
  );

create policy redemptions_admin on public.coupon_redemptions
  for select to authenticated
  using (public.is_admin());

create policy downloads_select on public.downloads
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy reviews_read on public.reviews
  for select to anon, authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.games g where g.id = game_id and g.status = 'published')
  );

create policy reviews_insert on public.reviews
  for insert to authenticated
  with check (user_id = auth.uid() and public.owns_game(game_id));

create policy reviews_update on public.reviews
  for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

create policy reviews_delete on public.reviews
  for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy audit_admin on public.audit_logs
  for select to authenticated
  using (public.is_admin());

insert into storage.buckets (id, name, public, file_size_limit)
values
  ('game-media', 'game-media', true, 104857600),
  ('game-files', 'game-files', false, 5368709120)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit;

create policy game_media_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'game-media');

create policy game_media_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'game-media' and public.is_admin());

create policy game_media_update on storage.objects
  for update to authenticated
  using (bucket_id = 'game-media' and public.is_admin())
  with check (bucket_id = 'game-media' and public.is_admin());

create policy game_media_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'game-media' and public.is_admin());

create policy game_files_admin_read on storage.objects
  for select to authenticated
  using (bucket_id = 'game-files' and public.is_admin());

create policy game_files_admin_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'game-files' and public.is_admin());

create policy game_files_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'game-files' and public.is_admin());
