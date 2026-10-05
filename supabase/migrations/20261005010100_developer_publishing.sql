-- Publicação por desenvolvedores. O administrador continua sendo o único que publica.

alter table public.games
  add column if not exists owner_id uuid references public.profiles (id) on delete set null,
  add column if not exists age_rating text not null default 'L' check (age_rating in ('L', '10', '12', '14', '16', '18')),
  add column if not exists developer_website text check (developer_website is null or developer_website ~ '^https://'),
  add column if not exists privacy_policy_url text check (privacy_policy_url is null or privacy_policy_url ~ '^https://'),
  add column if not exists review_note text not null default '',
  add column if not exists submitted_at timestamptz,
  add column if not exists reviewed_at timestamptz;

update public.games
set owner_id = created_by
where owner_id is null and created_by is not null;

create index if not exists games_owner_status_idx on public.games (owner_id, status);

create or replace function public.owns_storage_game(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.games g
    where g.id::text = (storage.foldername(object_name))[2]
      and (g.owner_id = auth.uid() or g.created_by = auth.uid())
  );
$$;

create or replace function public.protect_game_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('gamestore.review', true) = '1' or public.is_admin() or auth.uid() is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.owner_id is distinct from auth.uid() then
      raise exception 'Você só pode criar jogos na sua conta.';
    end if;
    new.created_by := auth.uid();
    if new.status is distinct from 'draft' then
      raise exception 'Um jogo novo começa como rascunho.';
    end if;
    return new;
  end if;

  if old.owner_id is distinct from auth.uid() and old.created_by is distinct from auth.uid() then
    raise exception 'Você não pode editar o jogo de outro desenvolvedor.';
  end if;
  new.owner_id := old.owner_id;
  new.created_by := old.created_by;
  new.status := old.status;
  new.published_at := old.published_at;
  new.submitted_at := old.submitted_at;
  new.reviewed_at := old.reviewed_at;
  new.review_note := old.review_note;
  return new;
end;
$$;

drop trigger if exists protect_game_submission on public.games;
create trigger protect_game_submission
  before insert or update on public.games
  for each row execute function public.protect_game_submission();

create or replace function public.become_developer()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Faça login para publicar um jogo.';
  end if;
  perform set_config('gamestore.internal', '1', true);
  update public.profiles
  set role = 'developer'
  where id = auth.uid() and role = 'user' and deleted_at is null;
end;
$$;

create or replace function public.attach_own_game_file(
  p_game_id uuid,
  p_version_name text,
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
  if auth.uid() is null then
    raise exception 'Faça login para publicar um jogo.';
  end if;
  if not exists (
    select 1 from public.games
    where id = p_game_id and (owner_id = auth.uid() or created_by = auth.uid())
  ) and not public.is_admin() then
    raise exception 'Você não pode enviar arquivo para o jogo de outro desenvolvedor.';
  end if;
  if p_version_name !~ '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$' then
    raise exception 'Use uma versão no formato 1.0.0.';
  end if;
  if p_platform not in ('android', 'windows', 'linux', 'macos') then
    raise exception 'Plataforma inválida.';
  end if;
  if p_storage_path !~ ('^games/' || p_game_id::text || '/[A-Za-z0-9._/-]+$') then
    raise exception 'Caminho de arquivo inválido.';
  end if;
  if exists (
    select 1 from public.game_versions
    where game_id = p_game_id and platform = p_platform and version_name = p_version_name
  ) then
    raise exception 'Esta versão já existe para a plataforma. Use um número novo, como 1.1.0.';
  end if;
  extension = lower(regexp_replace(p_file_name, '^.*\.', ''));
  if extension not in ('apk', 'aab', 'zip', 'exe', 'obb', 'xapk', '7z', 'msi', 'dmg', 'tar', 'gz', 'appimage', 'rar') then
    raise exception 'Formato de arquivo não permitido.';
  end if;

  update public.game_versions
  set is_latest = false
  where game_id = p_game_id and platform = p_platform and is_latest;

  insert into public.game_versions (
    game_id, version_name, changelog, storage_path, file_name, file_size_bytes,
    content_type, platform, is_latest, created_by
  ) values (
    p_game_id, p_version_name, 'Arquivo enviado pelo desenvolvedor.', p_storage_path, p_file_name,
    greatest(p_file_size_bytes, 0), coalesce(nullif(p_content_type, ''), 'application/octet-stream'),
    p_platform, true, auth.uid()
  )
  returning id into version_id;

  perform set_config('gamestore.review', '1', true);
  update public.games
  set current_version = p_version_name,
      file_size_bytes = greatest(p_file_size_bytes, 0)
  where id = p_game_id;
  return version_id;
end;
$$;

create or replace function public.submit_own_game(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  game public.games%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Faça login para publicar um jogo.';
  end if;
  select * into game from public.games where id = p_game_id;
  if not found or (game.owner_id is distinct from auth.uid() and game.created_by is distinct from auth.uid() and not public.is_admin()) then
    raise exception 'Jogo não encontrado.';
  end if;
  if game.status not in ('draft', 'rejected') then
    raise exception 'Este jogo já foi enviado para análise.';
  end if;
  if game.cover_path is null or char_length(game.title) < 2 or char_length(game.description) < 20 then
    raise exception 'Preencha nome, descrição e capa antes de enviar.';
  end if;
  if game.privacy_policy_url is null then
    raise exception 'Informe a política de privacidade do jogo.';
  end if;
  if not exists (select 1 from public.game_versions where game_id = p_game_id) then
    raise exception 'Selecione um arquivo.';
  end if;
  perform set_config('gamestore.review', '1', true);
  update public.games
  set status = 'submitted',
      submitted_at = now(),
      review_note = ''
  where id = p_game_id;
  insert into public.audit_logs (actor_id, action, entity, entity_id)
  values (auth.uid(), 'game_submitted', 'games', p_game_id);
end;
$$;

create or replace function public.admin_review_game(p_game_id uuid, p_action text, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Acesso negado.';
  end if;
  if p_action not in ('approve', 'reject', 'request_changes', 'start_review') then
    raise exception 'Ação inválida.';
  end if;
  if p_action in ('reject', 'request_changes') and char_length(coalesce(trim(p_note), '')) < 5 then
    raise exception 'Informe o motivo com pelo menos 5 caracteres.';
  end if;
  if not exists (select 1 from public.games where id = p_game_id) then
    raise exception 'Jogo não encontrado.';
  end if;
  perform set_config('gamestore.review', '1', true);
  if p_action = 'approve' then
    update public.games
    set status = 'published',
        published_at = coalesce(published_at, now()),
        reviewed_at = now(),
        review_note = ''
    where id = p_game_id;
  elsif p_action = 'reject' then
    update public.games
    set status = 'rejected',
        reviewed_at = now(),
        review_note = trim(p_note)
    where id = p_game_id;
  elsif p_action = 'request_changes' then
    update public.games
    set status = 'draft',
        reviewed_at = now(),
        review_note = trim(p_note)
    where id = p_game_id;
  else
    update public.games
    set status = 'in_review',
        reviewed_at = now()
    where id = p_game_id;
  end if;
  insert into public.audit_logs (actor_id, action, entity, entity_id, metadata)
  values (auth.uid(), 'game_reviewed', 'games', p_game_id, jsonb_build_object('action', p_action));
end;
$$;

revoke all on function public.become_developer() from public, anon;
revoke all on function public.attach_own_game_file(uuid, text, text, text, text, bigint, text) from public, anon;
revoke all on function public.submit_own_game(uuid) from public, anon;
revoke all on function public.admin_review_game(uuid, text, text) from public, anon;
grant execute on function public.become_developer() to authenticated;
grant execute on function public.attach_own_game_file(uuid, text, text, text, text, bigint, text) to authenticated;
grant execute on function public.submit_own_game(uuid) to authenticated;
grant execute on function public.admin_review_game(uuid, text, text) to authenticated;

drop policy if exists games_read on public.games;
drop policy if exists games_write on public.games;

create policy games_read on public.games
  for select to anon, authenticated
  using (
    status = 'published'
    or public.is_admin()
    or owner_id = auth.uid()
    or created_by = auth.uid()
  );

create policy games_insert on public.games
  for insert to authenticated
  with check (public.is_admin() or (owner_id = auth.uid() and status = 'draft'));

create policy games_update on public.games
  for update to authenticated
  using (public.is_admin() or owner_id = auth.uid() or created_by = auth.uid())
  with check (public.is_admin() or owner_id = auth.uid() or created_by = auth.uid());

create policy games_delete on public.games
  for delete to authenticated
  using (
    public.is_admin()
    or ((owner_id = auth.uid() or created_by = auth.uid()) and status = 'draft')
  );

create policy game_images_owner_read on public.game_images
  for select to authenticated
  using (
    exists (
      select 1 from public.games g
      where g.id = game_id and (g.owner_id = auth.uid() or g.created_by = auth.uid())
    )
  );

create policy game_images_owner_write on public.game_images
  for all to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.games g
      where g.id = game_id and (g.owner_id = auth.uid() or g.created_by = auth.uid())
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.games g
      where g.id = game_id and (g.owner_id = auth.uid() or g.created_by = auth.uid())
    )
  );

create policy game_videos_owner_read on public.game_videos
  for select to authenticated
  using (
    exists (
      select 1 from public.games g
      where g.id = game_id and (g.owner_id = auth.uid() or g.created_by = auth.uid())
    )
  );

create policy game_videos_owner_write on public.game_videos
  for all to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.games g
      where g.id = game_id and (g.owner_id = auth.uid() or g.created_by = auth.uid())
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.games g
      where g.id = game_id and (g.owner_id = auth.uid() or g.created_by = auth.uid())
    )
  );

create policy game_versions_owner_read on public.game_versions
  for select to authenticated
  using (
    exists (
      select 1 from public.games g
      where g.id = game_id and (g.owner_id = auth.uid() or g.created_by = auth.uid())
    )
  );

create policy game_categories_owner_read on public.game_categories
  for select to authenticated
  using (
    exists (
      select 1 from public.games g
      where g.id = game_id and (g.owner_id = auth.uid() or g.created_by = auth.uid())
    )
  );

create policy game_categories_owner_write on public.game_categories
  for all to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.games g
      where g.id = game_id and (g.owner_id = auth.uid() or g.created_by = auth.uid())
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.games g
      where g.id = game_id and (g.owner_id = auth.uid() or g.created_by = auth.uid())
    )
  );

alter table public.order_items
  add column if not exists seller_id uuid references public.profiles (id) on delete set null;

create or replace function public.fill_order_item_seller()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.seller_id is null then
    select g.owner_id into new.seller_id from public.games g where g.id = new.game_id;
  end if;
  return new;
end;
$$;

drop trigger if exists order_items_fill_seller on public.order_items;
create trigger order_items_fill_seller
  before insert on public.order_items
  for each row execute function public.fill_order_item_seller();

update public.order_items oi
set seller_id = g.owner_id
from public.games g
where g.id = oi.game_id and oi.seller_id is null;

create or replace view public.game_developers
with (security_invoker = false) as
select g.id as game_id, p.display_name
from public.games g
join public.profiles p on p.id = g.owner_id
where g.status = 'published';

grant select on public.game_developers to anon, authenticated;

create or replace function public.game_owner_name(p_game_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.display_name
  from public.games g
  join public.profiles p on p.id = coalesce(g.owner_id, g.created_by)
  where g.id = p_game_id
    and (
      g.status = 'published'
      or public.is_admin()
      or g.owner_id = auth.uid()
      or g.created_by = auth.uid()
    );
$$;

revoke all on function public.game_owner_name(uuid) from public, anon;
grant execute on function public.game_owner_name(uuid) to anon, authenticated;

create policy game_media_owner_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'game-media' and public.owns_storage_game(name));

create policy game_media_owner_update on storage.objects
  for update to authenticated
  using (bucket_id = 'game-media' and public.owns_storage_game(name))
  with check (bucket_id = 'game-media' and public.owns_storage_game(name));

create policy game_files_owner_read on storage.objects
  for select to authenticated
  using (bucket_id = 'game-files' and (public.is_admin() or public.owns_storage_game(name)));

create policy game_files_owner_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'game-files' and public.owns_storage_game(name));
