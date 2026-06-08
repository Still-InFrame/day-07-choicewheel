-- choicewheel schema — Day 07. Lives in the shared "100-day-sandbox" Supabase project.
-- Run this whole file ONCE in the Supabase SQL editor. Safe to re-run (idempotent).
--
-- Ownership model (no login): a secret admin_token (in choicewheel_admin) proves the
-- creator owns a wheel. The publishable key is the only key we have, so EVERY query runs
-- under RLS with no auth.uid(). Privileged writes therefore go through SECURITY DEFINER
-- RPCs that take the admin_token and verify it; guests can't call them (no token).
-- Reads of wheels + items are public (also required for Realtime). The admin + claims
-- tables have RLS enabled with NO policies, so they are unreadable except via RPC.

-- ============================== tables ==============================

create table if not exists choicewheel_wheels (
  id                  uuid primary key default gen_random_uuid(),
  title               text not null default 'Untitled wheel',
  published           boolean not null default false, -- draft until the creator publishes
  submissions_open    boolean not null default true,
  submit_deadline     timestamptz,                 -- null = no timer
  total_submissions   integer not null default 0,  -- lifetime, survives deletions
  last_winner_item_id uuid,                         -- set on each spin; gates claims
  last_spun_at        timestamptz,
  created_at          timestamptz not null default now()
);
-- For DBs created before `published` existed:
alter table choicewheel_wheels add column if not exists published boolean not null default false;

create table if not exists choicewheel_admin (
  wheel_id    uuid primary key references choicewheel_wheels(id) on delete cascade,
  admin_token uuid not null unique default gen_random_uuid()
);

create table if not exists choicewheel_items (
  id             uuid primary key default gen_random_uuid(),
  wheel_id       uuid not null references choicewheel_wheels(id) on delete cascade,
  label          text not null,
  color          text not null,        -- hsl(...) assigned at insert
  submitter_name text,                  -- null => rendered "Anonymous"
  created_at     timestamptz not null default now()
);
create index if not exists choicewheel_items_wheel_idx on choicewheel_items(wheel_id, created_at);
-- FULL so Realtime DELETE events include wheel_id (needed to filter deletes per wheel).
alter table choicewheel_items replica identity full;

create table if not exists choicewheel_claims (
  id         uuid primary key default gen_random_uuid(),
  wheel_id   uuid not null references choicewheel_wheels(id) on delete cascade,
  item_id    uuid not null references choicewheel_items(id) on delete cascade,
  name       text not null,
  email      text not null,
  phone_e164 text not null,
  country    text,
  created_at timestamptz not null default now()
);
create index if not exists choicewheel_claims_wheel_idx on choicewheel_claims(wheel_id, created_at);

-- ============================== RLS ==============================

alter table choicewheel_wheels enable row level security;
alter table choicewheel_admin  enable row level security;
alter table choicewheel_items  enable row level security;
alter table choicewheel_claims enable row level security;

-- Public read on wheels + items (no secrets in these; also needed for Realtime).
drop policy if exists choicewheel_wheels_read on choicewheel_wheels;
create policy choicewheel_wheels_read on choicewheel_wheels for select using (true);

drop policy if exists choicewheel_items_read on choicewheel_items;
create policy choicewheel_items_read on choicewheel_items for select using (true);

-- choicewheel_admin and choicewheel_claims intentionally have NO policies:
-- RLS-enabled + no policy => no direct access for anon. Reachable only via the
-- SECURITY DEFINER functions below (which run as owner and bypass RLS).

-- ============================== functions ==============================

-- internal: resolve a token to its wheel_id (NULL if bad). Not granted to anon.
create or replace function choicewheel__wheel_for_token(p_token uuid)
returns uuid language sql security definer set search_path = public as $$
  select wheel_id from choicewheel_admin where admin_token = p_token;
$$;

-- create a wheel; returns its public id + the secret admin token (shown once to creator).
create or replace function choicewheel_create_wheel(p_title text)
returns table(id uuid, admin_token uuid)
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_token uuid;
begin
  insert into choicewheel_wheels(title)
    values (coalesce(nullif(trim(p_title), ''), 'Untitled wheel'))
    returning choicewheel_wheels.id into v_id;
  insert into choicewheel_admin(wheel_id) values (v_id)
    returning choicewheel_admin.admin_token into v_token;
  return query select v_id, v_token;
end; $$;

-- guest submission. Window (open flag + deadline) and anti-spam guards enforced here,
-- not just in the UI. Color is deterministic golden-angle HSL by submission index.
create or replace function choicewheel_submit_item(p_wheel_id uuid, p_label text, p_submitter_name text)
returns choicewheel_items
language plpgsql security definer set search_path = public as $$
declare
  v_wheel choicewheel_wheels;
  v_count int;
  v_hue   int;
  v_item  choicewheel_items;
  v_label text := trim(p_label);
  v_name  text := nullif(trim(coalesce(p_submitter_name, '')), '');
begin
  select * into v_wheel from choicewheel_wheels where id = p_wheel_id;
  if v_wheel.id is null then raise exception 'wheel not found'; end if;
  if not v_wheel.published then raise exception 'this wheel is not published yet'; end if;
  if not v_wheel.submissions_open then raise exception 'submissions are closed'; end if;
  if v_wheel.submit_deadline is not null and now() > v_wheel.submit_deadline then
    raise exception 'submission window has ended';
  end if;
  if v_label is null or length(v_label) = 0 then raise exception 'label required'; end if;
  if length(v_label) > 60 then raise exception 'label too long (max 60)'; end if;

  select count(*) into v_count from choicewheel_items where wheel_id = p_wheel_id;
  if v_count >= 100 then raise exception 'wheel is full (max 100 items)'; end if;

  if v_name is not null and length(v_name) > 40 then v_name := left(v_name, 40); end if;
  v_hue := (v_count * 137) % 360;  -- golden-angle spacing so neighbours contrast

  insert into choicewheel_items(wheel_id, label, color, submitter_name)
  values (p_wheel_id, v_label, 'hsl(' || v_hue || ' 70% 55%)', v_name)
  returning * into v_item;

  update choicewheel_wheels set total_submissions = total_submissions + 1 where id = p_wheel_id;
  return v_item;
end; $$;

-- load the full wheel row for an admin (by secret token). Items are read separately
-- via the public select policy.
create or replace function choicewheel_get_wheel_by_token(p_token uuid)
returns choicewheel_wheels language plpgsql security definer set search_path = public as $$
declare v_wheel choicewheel_wheels;
begin
  select w.* into v_wheel
    from choicewheel_wheels w
    join choicewheel_admin a on a.wheel_id = w.id
   where a.admin_token = p_token;
  if v_wheel.id is null then raise exception 'wheel not found'; end if;
  return v_wheel;
end; $$;

create or replace function choicewheel_admin_update_wheel(
  p_token uuid, p_title text, p_submissions_open boolean, p_submit_deadline timestamptz)
returns choicewheel_wheels
language plpgsql security definer set search_path = public as $$
declare v_wheel_id uuid; v_wheel choicewheel_wheels;
begin
  v_wheel_id := choicewheel__wheel_for_token(p_token);
  if v_wheel_id is null then raise exception 'unauthorized'; end if;
  update choicewheel_wheels set
    title            = coalesce(nullif(trim(p_title), ''), title),
    submissions_open = coalesce(p_submissions_open, submissions_open),
    submit_deadline  = p_submit_deadline   -- pass null to clear the timer
  where id = v_wheel_id
  returning * into v_wheel;
  return v_wheel;
end; $$;

create or replace function choicewheel_admin_delete_item(p_token uuid, p_item_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_wheel_id uuid;
begin
  v_wheel_id := choicewheel__wheel_for_token(p_token);
  if v_wheel_id is null then raise exception 'unauthorized'; end if;
  delete from choicewheel_items where id = p_item_id and wheel_id = v_wheel_id;
end; $$;

create or replace function choicewheel_admin_clear_items(p_token uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_wheel_id uuid;
begin
  v_wheel_id := choicewheel__wheel_for_token(p_token);
  if v_wheel_id is null then raise exception 'unauthorized'; end if;
  delete from choicewheel_items where wheel_id = v_wheel_id;
  update choicewheel_wheels set last_winner_item_id = null where id = v_wheel_id;
end; $$;

create or replace function choicewheel_admin_delete_wheel(p_token uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_wheel_id uuid;
begin
  v_wheel_id := choicewheel__wheel_for_token(p_token);
  if v_wheel_id is null then raise exception 'unauthorized'; end if;
  delete from choicewheel_wheels where id = v_wheel_id;  -- cascades to admin/items/claims
end; $$;

-- creator records the spin result; gates who may claim.
create or replace function choicewheel_admin_set_winner(p_token uuid, p_item_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_wheel_id uuid;
begin
  v_wheel_id := choicewheel__wheel_for_token(p_token);
  if v_wheel_id is null then raise exception 'unauthorized'; end if;
  update choicewheel_wheels
     set last_winner_item_id = p_item_id, last_spun_at = now()
   where id = v_wheel_id;
end; $$;

-- winner-only prize claim. Validates the item is the wheel's CURRENT winner, plus
-- basic field checks (the client also validates phone via libphonenumber + email regex).
create or replace function choicewheel_submit_claim(
  p_item_id uuid, p_name text, p_email text, p_phone text, p_country text)
returns void language plpgsql security definer set search_path = public as $$
declare v_item choicewheel_items; v_wheel choicewheel_wheels;
begin
  select * into v_item from choicewheel_items where id = p_item_id;
  if v_item.id is null then raise exception 'item not found'; end if;
  select * into v_wheel from choicewheel_wheels where id = v_item.wheel_id;
  if v_wheel.last_winner_item_id is distinct from p_item_id then
    raise exception 'this item is not the current winner';
  end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'name required'; end if;
  if p_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'invalid email';
  end if;
  if coalesce(trim(p_phone), '') = '' then raise exception 'phone required'; end if;

  insert into choicewheel_claims(wheel_id, item_id, name, email, phone_e164, country)
  values (v_item.wheel_id, p_item_id, left(trim(p_name), 80),
          lower(trim(p_email)), trim(p_phone), p_country);
end; $$;

create or replace function choicewheel_admin_get_claims(p_token uuid)
returns setof choicewheel_claims language plpgsql security definer set search_path = public as $$
declare v_wheel_id uuid;
begin
  v_wheel_id := choicewheel__wheel_for_token(p_token);
  if v_wheel_id is null then raise exception 'unauthorized'; end if;
  return query select * from choicewheel_claims where wheel_id = v_wheel_id order by created_at desc;
end; $$;

-- creator adds an item directly. Token-gated, and intentionally NOT subject to the
-- published / submissions_open / deadline checks — the creator seeds the wheel freely
-- (e.g. while it is still a draft).
create or replace function choicewheel_admin_add_item(p_token uuid, p_label text, p_submitter_name text)
returns choicewheel_items
language plpgsql security definer set search_path = public as $$
declare
  v_wheel_id uuid;
  v_count int;
  v_hue   int;
  v_item  choicewheel_items;
  v_label text := trim(p_label);
  v_name  text := nullif(trim(coalesce(p_submitter_name, '')), '');
begin
  v_wheel_id := choicewheel__wheel_for_token(p_token);
  if v_wheel_id is null then raise exception 'unauthorized'; end if;
  if v_label is null or length(v_label) = 0 then raise exception 'label required'; end if;
  if length(v_label) > 60 then raise exception 'label too long (max 60)'; end if;
  select count(*) into v_count from choicewheel_items where wheel_id = v_wheel_id;
  if v_count >= 100 then raise exception 'wheel is full (max 100 items)'; end if;
  if v_name is not null and length(v_name) > 40 then v_name := left(v_name, 40); end if;
  v_hue := (v_count * 137) % 360;
  insert into choicewheel_items(wheel_id, label, color, submitter_name)
  values (v_wheel_id, v_label, 'hsl(' || v_hue || ' 70% 55%)', v_name)
  returning * into v_item;
  update choicewheel_wheels set total_submissions = total_submissions + 1 where id = v_wheel_id;
  return v_item;
end; $$;

create or replace function choicewheel_admin_set_published(p_token uuid, p_published boolean)
returns choicewheel_wheels
language plpgsql security definer set search_path = public as $$
declare v_wheel_id uuid; v_wheel choicewheel_wheels;
begin
  v_wheel_id := choicewheel__wheel_for_token(p_token);
  if v_wheel_id is null then raise exception 'unauthorized'; end if;
  update choicewheel_wheels set published = coalesce(p_published, published)
   where id = v_wheel_id returning * into v_wheel;
  return v_wheel;
end; $$;

-- ============================== grants ==============================
-- Expose only the public-facing RPCs to anon. The internal helper stays private.
grant execute on function
  choicewheel_create_wheel(text),
  choicewheel_submit_item(uuid, text, text),
  choicewheel_get_wheel_by_token(uuid),
  choicewheel_admin_update_wheel(uuid, text, boolean, timestamptz),
  choicewheel_admin_delete_item(uuid, uuid),
  choicewheel_admin_clear_items(uuid),
  choicewheel_admin_delete_wheel(uuid),
  choicewheel_admin_set_winner(uuid, uuid),
  choicewheel_admin_add_item(uuid, text, text),
  choicewheel_admin_set_published(uuid, boolean),
  choicewheel_submit_claim(uuid, text, text, text, text),
  choicewheel_admin_get_claims(uuid)
to anon, authenticated;

-- ============================== realtime ==============================
-- Items + wheels stream to all clients. (Admin/claims stay off Realtime.)
do $$ begin
  if not exists (select 1 from pg_publication_tables
                 where pubname='supabase_realtime' and schemaname='public'
                   and tablename='choicewheel_items') then
    alter publication supabase_realtime add table choicewheel_items;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname='supabase_realtime' and schemaname='public'
                   and tablename='choicewheel_wheels') then
    alter publication supabase_realtime add table choicewheel_wheels;
  end if;
end $$;
