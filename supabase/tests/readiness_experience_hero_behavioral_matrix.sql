-- Disposable local DB only. Runner supplies schema and S521 fixtures; always rollback.
do $$
declare
  target uuid := '52100000-0000-4000-8000-000000000001';
  other uuid := '52100000-0000-4000-8000-000000000002';
  brand text;
  reference_checks jsonb;
begin
  assert not has_function_privilege('anon','public.calculate_hotel_readiness(uuid)','EXECUTE');
  assert not has_function_privilege('authenticated','public.calculate_hotel_readiness(uuid)','EXECUTE');
  assert not has_function_privilege('service_role','public.calculate_hotel_readiness(uuid)','EXECUTE');
  foreach brand in array array['grand-mercure','novotel','mercure','bugan',null] loop
    update public.hotels set brand_code=brand,theme_preset=brand,platform_status='suspended',hero_image_url=null where id=target;
    insert into public.hotel_module_entitlements(hotel_id,module_key,is_enabled,enabled_at)
      values(target,'experience.appearance',true,now())
      on conflict(hotel_id,module_key) do update set is_enabled=true;
    delete from public.hotel_public_experience_media where hotel_id in(target,other);
    select jsonb_agg(to_jsonb(r) order by check_key) into reference_checks
      from public.calculate_hotel_readiness(target) r where check_key<>'visual.hero';
    assert not (select passed from public.calculate_hotel_readiness(target) where check_key='visual.hero'), 'no hero must warn';
    update public.hotels set hero_image_url='https://example.test/legacy.jpg' where id=target;
    assert (select passed from public.calculate_hotel_readiness(target) where check_key='visual.hero'), 'legacy-only must pass';
    update public.hotels set hero_image_url=null where id=target;
    insert into public.hotel_public_experience_media(hotel_id,slot,title,alt_text,image_path,is_published)
      values(target,'hero','Hero','Photo',target||'/hero/hero/52130000-0000-4000-8000-000000000001.webp',false);
    assert not (select passed from public.calculate_hotel_readiness(target) where check_key='visual.hero'), 'unpublished must warn';
    update public.hotel_public_experience_media set is_published=true where hotel_id=target;
    assert (select passed from public.calculate_hotel_readiness(target) where check_key='visual.hero'), 'V3-only must pass while suspended';
    assert not (select passed from public.calculate_hotel_readiness(other) where check_key='visual.hero'), 'other tenant hero must not count';
    update public.hotel_module_entitlements set is_enabled=false,enabled_at=null,enabled_by=null,disabled_at=now() where hotel_id=target and module_key='experience.appearance';
    assert not (select passed from public.calculate_hotel_readiness(target) where check_key='visual.hero'), 'appearance entitlement required';
    update public.hotel_module_entitlements set is_enabled=true,enabled_at=now(),disabled_at=null,disabled_by=null where hotel_id=target and module_key='experience.appearance';
    update public.hotel_module_entitlements set is_enabled=false,enabled_at=null,enabled_by=null,disabled_at=now() where hotel_id=target and module_key='core.directory';
    assert not (select passed from public.calculate_hotel_readiness(target) where check_key='visual.hero'), 'core entitlement required';
    update public.hotel_module_entitlements set is_enabled=true,enabled_at=now(),disabled_at=null,disabled_by=null where hotel_id=target and module_key='core.directory';
    update public.hotel_public_experience_media set image_path=null where hotel_id=target;
    assert not (select passed from public.calculate_hotel_readiness(target) where check_key='visual.hero'), 'published text-only hero must warn';
    assert reference_checks=(select jsonb_agg(to_jsonb(r) order by check_key) from public.calculate_hotel_readiness(target) r where check_key<>'visual.hero'), 'other readiness criteria changed';
    assert (select platform_status='suspended' and hero_image_url is null from public.hotels where id=target), 'must not activate or copy to legacy';
    raise notice 'PASS hero readiness: %',coalesce(brand,'default');
  end loop;
end $$;
rollback;
