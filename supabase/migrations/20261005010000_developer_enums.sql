-- Novos valores de enum. Precisam ser commitados antes de serem usados.

alter type public.user_role add value if not exists 'developer';
alter type public.game_status add value if not exists 'submitted';
alter type public.game_status add value if not exists 'in_review';
alter type public.game_status add value if not exists 'rejected';
