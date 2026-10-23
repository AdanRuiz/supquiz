-- Staff accounts (@tec.mx only) and quiz editing.
--
-- Players keep using anonymous sign-in. Hosts sign in with an email account,
-- which must be @tec.mx and must have proven ownership of the inbox
-- (accounts are created passwordless through an emailed link; the password
-- is set after the link is opened).

-------------------------------------------------------------------------------
-- Who counts as staff
-------------------------------------------------------------------------------
create or replace function public.is_staff()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
     and coalesce(auth.jwt() ->> 'email', '') ~* '^[^@[:space:]]+@tec\.mx$'
$$;

-------------------------------------------------------------------------------
-- Guard auth.users: only @tec.mx email accounts, never created with a password
-- directly (that would skip proving the inbox belongs to them).
-------------------------------------------------------------------------------
create or replace function public.guard_staff_accounts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Anonymous players are always allowed
  if new.is_anonymous then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    -- Ordinary updates (sign-in timestamps, password changes…) pass through
    if new.email is not distinct from old.email
       and new.is_anonymous = old.is_anonymous then
      return new;
    end if;
    -- An anonymous player can't turn into an email account
    if old.is_anonymous then
      raise exception 'Anonymous accounts cannot be converted to staff accounts';
    end if;
  end if;

  if coalesce(new.email, '') !~* '^[^@[:space:]]+@tec\.mx$' then
    raise exception 'Only @tec.mx email addresses can create an account';
  end if;

  if tg_op = 'INSERT' and coalesce(new.encrypted_password, '') <> '' then
    raise exception 'Create your account through the SupaQuiz sign-up form';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_staff_accounts on auth.users;
create trigger guard_staff_accounts
  before insert or update on auth.users
  for each row execute function public.guard_staff_accounts();

-------------------------------------------------------------------------------
-- Quiz ownership and write policies
-------------------------------------------------------------------------------
alter table public.quiz_sets
  add column if not exists created_by uuid default auth.uid()
    references auth.users(id) on delete set null on update cascade;

-- Quizzes with no owner (the seeded ones) can be managed by any staff member
create policy "Staff can create quiz sets" on public.quiz_sets
  for insert with check (public.is_staff() and created_by = auth.uid());
create policy "Staff can update their quiz sets" on public.quiz_sets
  for update using (public.is_staff() and (created_by = auth.uid() or created_by is null))
  with check (public.is_staff());
create policy "Staff can delete their quiz sets" on public.quiz_sets
  for delete using (public.is_staff() and (created_by = auth.uid() or created_by is null));

-------------------------------------------------------------------------------
-- Stable choice order (answer colors depend on it)
-------------------------------------------------------------------------------
alter table public.choices add column if not exists "order" smallint not null default 0;

update public.choices c
set "order" = ranked.position
from (
  select id, (row_number() over (partition by question_id order by created_at, ctid) - 1)::smallint as position
  from public.choices
) ranked
where ranked.id = c.id;

-------------------------------------------------------------------------------
-- Create or update a whole quiz in one call.
-- payload: { id?, name, description?, questions: [{ id?, body, choices: [{ id?, body, is_correct }] }] }
-- Existing questions/choices are updated in place (by id) so past game
-- results stay linked; ones missing from the payload are deleted.
-------------------------------------------------------------------------------
create or replace function public.save_quiz_set(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid;
  quiz_name text := btrim(coalesce(payload ->> 'name', ''));
  quiz_description text := nullif(btrim(coalesce(payload ->> 'description', '')), '');
  question jsonb;
  choice jsonb;
  question_index int := 0;
  choice_index int;
  question_id uuid;
  choice_id uuid;
  kept_questions uuid[] := '{}';
  kept_choices uuid[];
  correct_count int;
begin
  if not public.is_staff() then
    raise exception 'Only signed-in @tec.mx staff can save quizzes' using errcode = '42501';
  end if;

  -- Validate the whole payload before writing anything
  if quiz_name = '' or length(quiz_name) > 120 then
    raise exception 'The quiz needs a name (up to 120 characters)';
  end if;
  if jsonb_typeof(payload -> 'questions') <> 'array'
     or jsonb_array_length(payload -> 'questions') = 0
     or jsonb_array_length(payload -> 'questions') > 100 then
    raise exception 'The quiz needs between 1 and 100 questions';
  end if;

  for question in select value from jsonb_array_elements(payload -> 'questions') loop
    question_index := question_index + 1;
    if btrim(coalesce(question ->> 'body', '')) = '' then
      raise exception 'Question % has no text', question_index;
    end if;
    if jsonb_typeof(question -> 'choices') <> 'array'
       or jsonb_array_length(question -> 'choices') < 2
       or jsonb_array_length(question -> 'choices') > 4 then
      raise exception 'Question % needs between 2 and 4 answers', question_index;
    end if;
    select count(*) filter (where coalesce((value ->> 'is_correct')::boolean, false))
      into correct_count
      from jsonb_array_elements(question -> 'choices');
    if correct_count = 0 then
      raise exception 'Question % needs at least one correct answer', question_index;
    end if;
    if exists (
      select 1 from jsonb_array_elements(question -> 'choices')
      where btrim(coalesce(value ->> 'body', '')) = ''
    ) then
      raise exception 'Question % has an empty answer', question_index;
    end if;
  end loop;

  -- Quiz row
  target_id := nullif(payload ->> 'id', '')::uuid;
  if target_id is not null then
    update quiz_sets
       set name = quiz_name, description = quiz_description
     where id = target_id
       and (created_by = auth.uid() or created_by is null);
    if not found then
      raise exception 'Quiz not found or you can''t edit it' using errcode = '42501';
    end if;
  else
    insert into quiz_sets (name, description, created_by)
    values (quiz_name, quiz_description, auth.uid())
    returning id into target_id;
  end if;

  -- Questions and choices
  question_index := 0;
  for question in select value from jsonb_array_elements(payload -> 'questions') loop
    question_id := nullif(question ->> 'id', '')::uuid;

    if question_id is not null then
      update questions
         set body = btrim(question ->> 'body'), "order" = question_index
       where id = question_id and quiz_set_id = target_id;
      if not found then
        question_id := null;
      end if;
    end if;

    if question_id is null then
      insert into questions (quiz_set_id, body, "order")
      values (target_id, btrim(question ->> 'body'), question_index)
      returning id into question_id;
    end if;

    kept_questions := kept_questions || question_id;
    kept_choices := '{}';
    choice_index := 0;

    for choice in select value from jsonb_array_elements(question -> 'choices') loop
      choice_id := nullif(choice ->> 'id', '')::uuid;

      if choice_id is not null then
        update choices
           set body = btrim(choice ->> 'body'),
               is_correct = coalesce((choice ->> 'is_correct')::boolean, false),
               "order" = choice_index
         where id = choice_id and choices.question_id = save_quiz_set.question_id;
        if not found then
          choice_id := null;
        end if;
      end if;

      if choice_id is null then
        insert into choices (question_id, body, is_correct, "order")
        values (question_id, btrim(choice ->> 'body'),
                coalesce((choice ->> 'is_correct')::boolean, false), choice_index)
        returning id into choice_id;
      end if;

      kept_choices := kept_choices || choice_id;
      choice_index := choice_index + 1;
    end loop;

    delete from choices
     where choices.question_id = save_quiz_set.question_id
       and not (id = any (kept_choices));

    question_index := question_index + 1;
  end loop;

  delete from questions
   where quiz_set_id = target_id
     and not (id = any (kept_questions));

  return target_id;
end;
$$;

revoke all on function public.save_quiz_set(jsonb) from public, anon;
grant execute on function public.save_quiz_set(jsonb) to authenticated;
