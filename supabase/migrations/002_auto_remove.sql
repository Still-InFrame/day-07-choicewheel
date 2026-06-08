-- Migration 002 — elimination mode: auto-remove the winner after each spin.
-- Run once in the Supabase SQL editor (idempotent). schema.sql already includes all of this.

-- 1. Per-wheel toggle + soft-remove flag on items.
alter table choicewheel_wheels add column if not exists auto_remove boolean not null default false;
alter table choicewheel_items  add column if not exists is_active   boolean not null default true;

-- 2. Toggle elimination mode.
create or replace function choicewheel_admin_set_auto_remove(p_token uuid, p_auto_remove boolean)
returns choicewheel_wheels
language plpgsql security definer set search_path = public as $$
declare v_wheel_id uuid; v_wheel choicewheel_wheels;
begin
  v_wheel_id := choicewheel__wheel_for_token(p_token);
  if v_wheel_id is null then raise exception 'unauthorized'; end if;
  update choicewheel_wheels set auto_remove = coalesce(p_auto_remove, auto_remove)
   where id = v_wheel_id returning * into v_wheel;
  return v_wheel;
end; $$;

-- 3. Soft-remove an item (keeps the row so a winner's claim still works).
create or replace function choicewheel_admin_remove_item(p_token uuid, p_item_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_wheel_id uuid;
begin
  v_wheel_id := choicewheel__wheel_for_token(p_token);
  if v_wheel_id is null then raise exception 'unauthorized'; end if;
  update choicewheel_items set is_active = false
   where id = p_item_id and wheel_id = v_wheel_id;
end; $$;

grant execute on function
  choicewheel_admin_set_auto_remove(uuid, boolean),
  choicewheel_admin_remove_item(uuid, uuid)
to anon, authenticated;
