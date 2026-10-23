-- Short, human-friendly game codes for join links: supquiz.vercel.app/g/K7M3QX
-- 6 characters from 31 unambiguous symbols (no 0/O, 1/I/L): ~887 million codes.
-- New codes are checked against existing ones, and a unique index backs it up,
-- so two games never share a code.

create or replace function public.generate_game_code()
returns text
language plpgsql
volatile
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code_length constant int := 6;
  random_bytes bytea;
  candidate text;
begin
  loop
    -- 16 random bytes from a v4 UUID; we only need 6
    random_bytes := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
    candidate := '';
    for i in 0 .. code_length - 1 loop
      candidate := candidate || substr(alphabet, (get_byte(random_bytes, i) % length(alphabet)) + 1, 1);
    end loop;
    exit when not exists (select 1 from public.games where code = candidate);
  end loop;
  return candidate;
end;
$$;

alter table public.games add column if not exists code text;

-- Give existing games a code too
update public.games set code = public.generate_game_code() where code is null;

alter table public.games
  alter column code set default public.generate_game_code(),
  alter column code set not null;

create unique index if not exists games_code_key on public.games (code);
