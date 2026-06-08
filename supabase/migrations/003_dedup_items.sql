-- Migration 003 — reject duplicate items (case-insensitive, against active items).
-- Run once in the Supabase SQL editor (idempotent). schema.sql already includes this.

-- Guest submit + dedup.
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
  if exists (select 1 from choicewheel_items
             where wheel_id = p_wheel_id and is_active and lower(label) = lower(v_label)) then
    raise exception '"%" is already on the wheel', v_label;
  end if;
  select count(*) into v_count from choicewheel_items where wheel_id = p_wheel_id;
  if v_count >= 100 then raise exception 'wheel is full (max 100 items)'; end if;
  if v_name is not null and length(v_name) > 40 then v_name := left(v_name, 40); end if;
  v_hue := (v_count * 137) % 360;
  insert into choicewheel_items(wheel_id, label, color, submitter_name)
  values (p_wheel_id, v_label, 'hsl(' || v_hue || ' 70% 55%)', v_name)
  returning * into v_item;
  update choicewheel_wheels set total_submissions = total_submissions + 1 where id = p_wheel_id;
  return v_item;
end; $$;

-- Creator add + dedup.
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
  if exists (select 1 from choicewheel_items
             where wheel_id = v_wheel_id and is_active and lower(label) = lower(v_label)) then
    raise exception '"%" is already on the wheel', v_label;
  end if;
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
