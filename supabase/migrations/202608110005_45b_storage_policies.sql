-- Sprint 45B: make administrative media server-only.
-- Uploads and removals use validated server actions with service_role. Public URLs
-- continue to serve the public bucket. Supabase-managed table grants are preserved;
-- authorization for browser roles remains enforced by Storage RLS.

do $$
declare
  unexpected_policies text;
begin
  select string_agg(policyname, ', ' order by policyname)
    into unexpected_policies
  from pg_policies
  where schemaname = 'storage'
    and tablename = 'objects'
    and policyname not in (
      'Allow authenticated uploads to hotel-assets',
      'Allow authenticated updates in hotel-assets',
      'Hotel users can upload promotional banners',
      'Hotel users can update promotional banners',
      'Hotel users can delete promotional banners',
      'Hotel users can upload promotional banners in hotel folder',
      'Hotel users can update promotional banners in hotel folder',
      'Hotel users can delete promotional banners in hotel folder'
    )
    -- Automatically ignore only simple conjunctive policies with a strict equality
    -- to another bucket. Policies without a bucket predicate, policies mentioning
    -- hotel-assets, and broad/complex OR or NOT predicates require manual review.
    and not (
      (coalesce(qual, '') || ' ' || coalesce(with_check, '')) not ilike '%hotel-assets%'
      and (coalesce(qual, '') || ' ' || coalesce(with_check, ''))
        ~* 'bucket_id[[:space:]]*=[[:space:]]*''[a-z0-9][a-z0-9._-]*''(::text)?'
      and (coalesce(qual, '') || ' ' || coalesce(with_check, ''))
        !~* '(^|[^a-z_])or([^a-z_]|$)'
      and (coalesce(qual, '') || ' ' || coalesce(with_check, ''))
        !~* '(^|[^a-z_])not([^a-z_]|$)'
    );

  if unexpected_policies is not null then
    raise exception '45B Storage preflight failed: manually review policies that may reach hotel-assets: %', unexpected_policies;
  end if;
end;
$$;

drop policy if exists "Allow authenticated uploads to hotel-assets" on storage.objects;
drop policy if exists "Allow authenticated updates in hotel-assets" on storage.objects;
drop policy if exists "Hotel users can upload promotional banners" on storage.objects;
drop policy if exists "Hotel users can update promotional banners" on storage.objects;
drop policy if exists "Hotel users can delete promotional banners" on storage.objects;
drop policy if exists "Hotel users can upload promotional banners in hotel folder" on storage.objects;
drop policy if exists "Hotel users can update promotional banners in hotel folder" on storage.objects;
drop policy if exists "Hotel users can delete promotional banners in hotel folder" on storage.objects;

-- public.has_active_hotel_path_role remains available for future narrowly scoped
-- policies, but this migration intentionally creates no browser policy for hotel-assets.
-- Structural grants on storage.objects are managed by Supabase and do not authorize
-- a browser operation without an applicable RLS policy.
-- Server actions keep operador+ for promotional banners and editor+ for logo/hero.
-- Their service-role cleanup recognizes both modern paths and legacy
-- <hotel_id>/logo.* and <hotel_id>/hero.* assets, including historical SVG files.
-- New server-side uploads remain limited to validated PNG, JPEG, and WebP bytes.
