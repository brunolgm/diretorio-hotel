-- Local-only reconstruction of the pre-45B inventory. The historic April
-- migration creates an unsafe policy whose later manual removal is not tracked.
-- Drop ONLY that exact known obsolete policy, before the unchanged 45B hardening.
-- Never execute this lab fixture against a hosted or pre-existing application DB.
do $$ begin
 if current_database()<>'fb_s53_auth' then raise exception 'Disposable local database only'; end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='hotel_analytics_events'
  and policyname='Allow public analytics inserts' and cmd='INSERT' and with_check='true')
 then raise exception 'Historical local baseline differs; review required'; end if;
end $$;
drop policy "Allow public analytics inserts" on public.hotel_analytics_events;
