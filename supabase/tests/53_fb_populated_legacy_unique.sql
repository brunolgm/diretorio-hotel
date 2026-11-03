-- Local-only populated legacy identity audit; DDL and fixtures all roll back.
begin;
do $$ begin if current_database()<>'fb_s53_auth' then raise exception 'Disposable local DB only'; end if; end $$;
create temporary table s53_legacy_hash as
 select md5(string_agg((to_jsonb(s)||jsonb_build_object('xmin',s.xmin::text,'ctid',s.ctid::text))::text,',' order by id)) digest
 from public.hotel_sections s;
do $$
declare fk text; definition text; existing_index oid; after_hash text; actual_index oid;
begin
 if (select count(*) from public.hotel_sections)<18 then raise exception 'Requires populated six-hotel fixture'; end if;
 if exists(select 1 from pg_constraint where conrelid='public.hotel_sections'::regclass and conname='hotel_sections_fb_tenant_identity')
 then raise exception 'Unnecessary duplicate legacy index remains'; end if;
 select conindid into existing_index from pg_constraint where conrelid='public.hotel_sections'::regclass and conname='hotel_sections_id_hotel_id_key';
 select conname,pg_get_constraintdef(oid),conindid into fk,definition,actual_index from pg_constraint
 where conrelid='public.hotel_fb_service_links'::regclass and confrelid='public.hotel_sections'::regclass and contype='f';
 if fk is null or actual_index is distinct from existing_index then raise exception 'FB must reuse existing canonical composite identity'; end if;
 -- Removing that legacy key would also affect Guias do Quarto: never part of
 -- a Sprint-53 rollback. Recreate ONLY the new FK, against populated rows.
 execute format('alter table public.hotel_fb_service_links drop constraint %I',fk);
 execute format('alter table public.hotel_fb_service_links add constraint %I %s',fk,definition);
 if not exists(select 1 from pg_constraint where conrelid='public.hotel_fb_service_links'::regclass and conname=fk and convalidated and conindid=existing_index)
 then raise exception 'FK revalidation did not reuse existing index'; end if;
 select md5(string_agg((to_jsonb(s)||jsonb_build_object('xmin',s.xmin::text,'ctid',s.ctid::text))::text,',' order by id)) into after_hash from public.hotel_sections s;
 if after_hash is distinct from (select digest from s53_legacy_hash) then raise exception 'Legacy rows or tuple identity changed'; end if;
end $$;
select json_build_object('suite','fb_populated_legacy_unique','passed',true,'existingIndexReused',true,'heapRowsUnchanged',true,'tupleIdentityUnchanged',true,'rollback',true,'observedLocks',(select json_agg(mode) from pg_locks where pid=pg_backend_pid() and relation='public.hotel_sections'::regclass and granted));
rollback;
