"""Run only inside the dedicated networkless disposable Docker database. No remote URL accepted."""
from pathlib import Path
import subprocess,re,json,secrets,uuid,time,tempfile,os

root=Path(__file__).resolve().parents[1]
def run(container):
    inspection=json.loads(subprocess.check_output(['docker','inspect',container],text=True))[0]
    if inspection['HostConfig']['NetworkMode']!='none' or inspection['HostConfig'].get('PortBindings') or inspection.get('Mounts'):
        raise SystemExit('Refusing non-isolated container')
    sql=['begin;', (root/'supabase/tests/53_fb_local_bootstrap.sql').read_text(encoding='utf8')]
    baseline=(root/'supabase/migrations/202608110001_45b_authz_helpers_and_rls_baseline.sql').read_text(encoding='utf8')
    start=baseline.index('create function public.has_active_hotel_role(')
    end=baseline.index('create function public.has_active_hotel_path_role(')
    sql.append(baseline[start:end])
    sql.append((root/'supabase/migrations/202608110003_45b_admin_audit_log.sql').read_text(encoding='utf8'))
    def function(source,marker):
        start=source.index(marker); body=source.index('$$',start); end=source.index('$$;',body+2)+3
        return source[start:end]
    platform=(root/'supabase/migrations/202608170001_47_multi_hotel_onboarding.sql').read_text(encoding='utf8')
    sql.append(function(platform,'create or replace function public.record_platform_audit_event('))
    governance=(root/'supabase/migrations/20261028012744_52_2_tourism_governance_available.sql').read_text(encoding='utf8')
    sql.append(function(governance,'create or replace function public.update_platform_hotel_module('))
    sql.append('revoke all on function public.update_platform_hotel_module(uuid,text,boolean) from public,anon,authenticated,service_role; grant execute on function public.update_platform_hotel_module(uuid,text,boolean) to authenticated;')
    for migration in sorted((root/'supabase/migrations').glob('*sprint_53_fb*.sql')):
        contents=migration.read_text(encoding='utf8')
        # Keep the whole matrix in its outer rollback transaction.
        contents=re.sub(r'(?mi)^(begin|commit);\s*$','',contents)
        if migration.name.endswith('_foundation.sql'):
            preflight=contents[:contents.index('end $$;')+len('end $$;')]
            sql.append("create policy s53_fixture_unsafe on storage.objects for insert to authenticated with check(bucket_id='hotel-assets');")
            sql.append("do $driver$ begin begin execute $fb_preflight$"+preflight+"$fb_preflight$; raise exception 'Expected Storage drift rejection'; exception when others then if sqlerrm<>'53 preflight: Storage hotel-assets must remain server-only' then raise; end if; end; perform set_config('fb_fixture.storage_unsafe_verified','true',true); end $driver$;")
            sql.append('drop policy s53_fixture_unsafe on storage.objects;')
            sql.append("create role s53_fixture_storage_writer; grant s53_fixture_storage_writer to authenticated; create policy s53_fixture_inherited on storage.objects for insert to s53_fixture_storage_writer with check(bucket_id='hotel-assets');")
            sql.append("do $driver$ begin begin execute $fb_preflight$"+preflight+"$fb_preflight$; raise exception 'Expected inherited Storage rejection'; exception when others then if sqlerrm<>'53 preflight: Storage hotel-assets must remain server-only' then raise; end if; end; perform set_config('fb_fixture.storage_inherited_verified','true',true); end $driver$;")
            sql.append('drop policy s53_fixture_inherited on storage.objects; revoke s53_fixture_storage_writer from authenticated; drop role s53_fixture_storage_writer;')
            sql.append("create policy s53_fixture_other on storage.objects for insert to authenticated with check(bucket_id='s53-other');")
            sql.append(preflight)
            sql.append("select set_config('fb_fixture.storage_other_verified','true',true); drop policy s53_fixture_other on storage.objects;")
        sql.append(contents)
    sql.append((root/'supabase/tests/53_fb_behavioral_matrix.sql').read_text(encoding='utf8'))
    sql.append('rollback;')
    result=subprocess.run(['docker','exec','-i',container,'psql','-X','-q','-U','supabase_admin','-d','fb_s53','-v','ON_ERROR_STOP=1'],input='\n'.join(sql),text=True,encoding='utf8',capture_output=True)
    (root/'out').mkdir(exist_ok=True)
    (root/'out/fb-sql.log').write_text(result.stdout+result.stderr,encoding='utf8')
    print(result.stdout+result.stderr)
    return result.returncode

if __name__=='__main__':
    context=json.loads(subprocess.check_output(['docker','context','inspect'],text=True))[0]
    endpoint=os.environ.get('DOCKER_HOST') or context['Endpoints']['docker']['Host']
    if not endpoint.startswith(('npipe://','unix://')): raise SystemExit('Only a local Docker socket is allowed')
    (root/'out').mkdir(exist_ok=True)
    name='libguest-fb-sql-'+uuid.uuid4().hex[:8]
    image='public.ecr.aws/supabase/postgres:17.6.1.158'
    subprocess.run(['docker','image','inspect',image],check=True,stdout=subprocess.DEVNULL)
    with tempfile.TemporaryDirectory(prefix='fb-sql-',dir=root/'out') as directory:
        env=Path(directory)/'postgres.env'
        env.write_text('POSTGRES_PASSWORD='+secrets.token_hex(24)+'\nPOSTGRES_DB=fb_s53\n',encoding='utf8')
        container=subprocess.check_output(['docker','run','--detach','--pull','never','--name',name,'--label','libguest.fb.sql='+name,'--network','none','--env-file',str(env),image],text=True).strip()
        try:
            for attempt in range(120):
                if subprocess.run(['docker','exec',container,'pg_isready','-h','127.0.0.1','-U','supabase_admin','-d','fb_s53'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0: break
                time.sleep(.5)
            else: raise RuntimeError('Disposable PostgreSQL did not start')
            status=run(container)
        finally:
            label=subprocess.check_output(['docker','inspect','-f','{{index .Config.Labels "libguest.fb.sql"}}',container],text=True).strip()
            if label!=name: raise RuntimeError('Container cleanup ownership mismatch')
            subprocess.run(['docker','rm','--force','--volumes',container],check=True,stdout=subprocess.DEVNULL)
        raise SystemExit(status)
