-- DOCUMENTATION ONLY. Review in the target environment before running manually.
-- Expected public identity: slug + subdomain + current legacy preset.
begin;

do $activation$
declare
  matched_count integer;
  affected_count integer;
begin
  select count(*) into matched_count
  from public.hotels
  where slug = 'grandmercureriocopacabana'
    and subdomain = 'grandmercurecopacabana'
    and theme_preset = 'graphite-gold';

  if matched_count <> 1 then
    raise exception 'Grand Mercure activation aborted: expected exactly 1 matching hotel, found %', matched_count;
  end if;

  update public.hotels
  set theme_preset = 'grand-mercure'
  where slug = 'grandmercureriocopacabana'
    and subdomain = 'grandmercurecopacabana'
    and theme_preset = 'graphite-gold';

  get diagnostics affected_count = row_count;
  if affected_count <> 1 then
    raise exception 'Grand Mercure activation aborted: expected exactly 1 affected row, found %', affected_count;
  end if;
end
$activation$;

commit;
