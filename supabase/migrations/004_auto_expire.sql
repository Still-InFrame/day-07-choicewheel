-- Migration 004 — auto-delete wheels 24h after creation, to keep the shared
-- sandbox from accumulating old wheels. Uses pg_cron (hourly cleanup).
--
-- If `create extension pg_cron` errors with a permissions message, enable pg_cron
-- once via Supabase Dashboard → Database → Extensions, then re-run this file.
-- The job is namespaced (choicewheel_expire) and only touches choicewheel tables,
-- so it's safe alongside other apps sharing this project.

create extension if not exists pg_cron;

-- Re-runnable: drop the old schedule if it exists, then (re)create it.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'choicewheel_expire') then
    perform cron.unschedule('choicewheel_expire');
  end if;
end $$;

-- Every hour, delete wheels older than 24h. Cascades to items/claims/admin.
select cron.schedule(
  'choicewheel_expire',
  '0 * * * *',
  $$ delete from choicewheel_wheels where created_at < now() - interval '24 hours' $$
);
