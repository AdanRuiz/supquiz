-- Short 3-question quiz for testing a full game end to end.
-- Idempotent: does nothing if the quiz already exists.
do $$
declare
  test_quiz_id uuid := 'fab379e0-ccbc-45ce-8082-95c6c2ef8f3d';
begin
  if exists (select 1 from public.quiz_sets where id = test_quiz_id) then
    return;
  end if;

  insert into public.quiz_sets (id, name, description)
  values (test_quiz_id, 'Quiz de prueba', 'Tres preguntas rápidas para probar una partida completa.');

  perform add_question(
    quiz_set_id => test_quiz_id,
    body => '¿Cuál es el planeta más grande del sistema solar?',
    "order" => 0,
    choices => array[
      '{"body": "Saturno", "is_correct": false}'::json,
      '{"body": "Júpiter", "is_correct": true}'::json,
      '{"body": "Neptuno", "is_correct": false}'::json,
      '{"body": "La Tierra", "is_correct": false}'::json
    ]
  );

  perform add_question(
    quiz_set_id => test_quiz_id,
    body => '¿Cuántos lados tiene un hexágono?',
    "order" => 1,
    choices => array[
      '{"body": "5", "is_correct": false}'::json,
      '{"body": "8", "is_correct": false}'::json,
      '{"body": "6", "is_correct": true}'::json,
      '{"body": "7", "is_correct": false}'::json
    ]
  );

  perform add_question(
    quiz_set_id => test_quiz_id,
    body => '¿Qué base de datos usa Supabase por debajo?',
    "order" => 2,
    choices => array[
      '{"body": "MySQL", "is_correct": false}'::json,
      '{"body": "MongoDB", "is_correct": false}'::json,
      '{"body": "SQLite", "is_correct": false}'::json,
      '{"body": "PostgreSQL", "is_correct": true}'::json
    ]
  );
end;
$$;
