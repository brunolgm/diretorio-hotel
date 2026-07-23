-- DOCUMENTATION ONLY. Review in the target environment before running manually.
-- Reverts only the exact public identity while it is on the Grand Mercure preset.
begin;

do $reversion$
declare
  matched_count integer;
  affected_count integer;
begin
  select count(*) into matched_count
  from public.hotels
  where slug = 'grandmercureriocopacabana'
    and subdomain = 'grandmercurecopacabana'
    and theme_preset = 'grand-mercure';

  if matched_count <> 1 then
    raise exception 'Grand Mercure reversion aborted: expected exactly 1 matching hotel, found %', matched_count;
  end if;

  update public.hotels
  set theme_preset = 'graphite-gold'
  where slug = 'grandmercureriocopacabana'
    and subdomain = 'grandmercurecopacabana'
    and theme_preset = 'grand-mercure';

  get diagnostics affected_count = row_count;
  if affected_count <> 1 then
    raise exception 'Grand Mercure reversion aborted: expected exactly 1 affected row, found %', affected_count;
  end if;
end
$reversion$;

commit;
