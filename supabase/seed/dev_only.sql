-- DEVELOPMENT ONLY.
-- This file inserts an unpublished internal test record.
-- It is not a commercial product and must not be treated as a store listing.
-- Do not run when gamestore.environment = production.

do $$
begin
  if current_setting('gamestore.environment', true) = 'production' then
    raise exception 'Dev seed blocked in production.';
  end if;
end $$;

insert into public.categories (id, slug, name)
values ('00000000-0000-4000-8000-0000000000d1', 'desenvolvimento', 'Desenvolvimento')
on conflict (id) do nothing;

insert into public.games (
  id, title, slug, description, short_description, price_cents, currency, genre,
  platforms, current_version, min_requirements, recommended_requirements, status, is_featured
) values (
  '00000000-0000-4000-8000-0000000000d2',
  '[DEV] Pacote de teste interno',
  'dev-pacote-de-teste-interno',
  'Registro exclusivo de desenvolvimento. Não é um jogo comercial e não deve ser publicado na loja.',
  'Item interno de desenvolvimento. Não publicar.',
  0,
  'brl',
  'Teste',
  array['android'],
  '0.0.1',
  'Uso interno do desenvolvedor.',
  'Uso interno do desenvolvedor.',
  'draft',
  false
)
on conflict (id) do nothing;
