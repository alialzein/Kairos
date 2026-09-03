begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

-- two users: 1111… becomes owner, 2222… stays guest (profile rows come from the trigger)
insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner@test.local', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'guest@test.local', '{}'::jsonb, '{}'::jsonb, now(), now());

select is((select count(*) from public.profiles), 2::bigint, 'trigger created two profiles');
update public.profiles set role = 'owner' where id = '11111111-1111-1111-1111-111111111111';

insert into public.sessions (id, user_id, channel)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'web'),
       ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'guest');
insert into public.episodes (text) values ('a private memory');

-- as owner
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select is((select count(*) from public.sessions), 2::bigint, 'owner sees all sessions');
select is((select count(*) from public.episodes), 1::bigint, 'owner sees memory tables');
reset role;

-- as guest
set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select is((select count(*) from public.sessions), 1::bigint, 'guest sees only own session');
select is((select count(*) from public.episodes), 0::bigint, 'guest sees no memory rows');
select throws_ok(
  $$ insert into public.sessions (user_id, channel) values ('11111111-1111-1111-1111-111111111111', 'web') $$,
  '42501',
  'new row violates row-level security policy for table "sessions"',
  'guest cannot create a session for another user');
select lives_ok(
  $$ insert into public.sessions (user_id, channel) values ('22222222-2222-2222-2222-222222222222', 'guest') $$,
  'guest can create own session');
-- a guest cannot promote themselves (no update policy on profiles → 0 rows affected, no error)
update public.profiles set role = 'owner' where id = '22222222-2222-2222-2222-222222222222';
select is((select role from public.profiles where id = '22222222-2222-2222-2222-222222222222'), 'guest', 'guest cannot self-promote to owner');
reset role;

-- anonymous requests see nothing
set local role anon;
select is((select count(*) from public.sessions), 0::bigint, 'anon sees no sessions');
reset role;

select * from finish();
rollback;
