-- Hidden "Kitten mode": a per-game flag the host can toggle.
-- Players read it with the game row and get changes through Realtime.
alter table public.games
  add column if not exists kitten_mode boolean not null default false;
