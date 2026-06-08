-- Migration 005 — lifetime stats ticker (wheels created, total spins).
-- Counters are monotonic (only ever incremented), so deleting/expiring a wheel
-- never lowers them. Run once in the SQL editor (idempotent). schema.sql includes this.

-- 1. Single-row counter table, seeded from the current wheel count.
create table if not exists choicewheel_stats (
  id             int primary key default 1,
  wheels_created bigint not null default 0,
  total_spins    bigint not null default 0,
  constraint choicewheel_stats_single check (id = 1)
);
insert into choicewheel_stats (id, wheels_created)
  values (1, (select count(*) from choicewheel_wheels))
  on conflict (id) do nothing;

-- 2. Public read; writes only via the SECURITY DEFINER RPCs below.
alter table choicewheel_stats enable row level security;
drop policy if exists choicewheel_stats_read on choicewheel_stats;
create policy choicewheel_stats_read on choicewheel_stats for select using (true);

-- 3. Bump wheels_created on create.
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
  update choicewheel_stats set wheels_created = wheels_created + 1 where choicewheel_stats.id = 1;
  return query select v_id, v_token;
end; $$;

-- 4. Bump total_spins on each spin (admin_set_winner is called once per spin).
create or replace function choicewheel_admin_set_winner(p_token uuid, p_item_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_wheel_id uuid;
begin
  v_wheel_id := choicewheel__wheel_for_token(p_token);
  if v_wheel_id is null then raise exception 'unauthorized'; end if;
  update choicewheel_wheels
     set last_winner_item_id = p_item_id, last_spun_at = now()
   where id = v_wheel_id;
  update choicewheel_stats set total_spins = total_spins + 1 where choicewheel_stats.id = 1;
end; $$;

-- 5. Stream stats updates to the homepage.
do $$ begin
  if not exists (select 1 from pg_publication_tables
                 where pubname='supabase_realtime' and schemaname='public'
                   and tablename='choicewheel_stats') then
    alter publication supabase_realtime add table choicewheel_stats;
  end if;
end $$;
