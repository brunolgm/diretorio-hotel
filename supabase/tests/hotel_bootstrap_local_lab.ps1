param([ValidateSet('supabase_db_libguest-45b-lab')][string]$Container='supabase_db_libguest-45b-lab')
$ErrorActionPreference='Stop'; $OutputEncoding=[Text.UTF8Encoding]::new($false)
$repoRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
function Read-Sql([string]$file){([IO.File]::ReadAllText((Join-Path $repoRoot $file))).TrimStart([char]0xFEFF) -replace '(?m)^begin;\r?$','' -replace '(?m)^commit;\r?$',''}
$files=@('20260910043520_52_1_tourism_foundation.sql','20260911011338_52_2a_tourism_main_image.sql','20260914014530_52_2b1_tourism_revision_conflict.sql','20261027215620_bugan_canonical_brand.sql','20261028012744_52_2_tourism_governance_available.sql','20261028034907_public_experience_media_v3.sql','20261028100544_platform_existing_hotel_admin.sql','20261028105402_hotel_bootstrap_and_slug.sql')
$migrations=($files | ForEach-Object {Read-Sql "supabase/migrations/$_"}) -join "`n"
$foundation=Read-Sql 'supabase/tests/52_1_tourism_behavioral_matrix.sql'
$fixtures=$foundation.Split(@('-- Constraints are exercised independently'),[StringSplitOptions]::None)[0]
('begin;'+$migrations+$fixtures+(Read-Sql 'supabase/tests/hotel_bootstrap_behavioral_matrix.sql')) | docker exec -i $Container psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres
if($LASTEXITCODE -ne 0){throw 'Bootstrap local matrix failed'}
Write-Output 'PASS bootstrap/slug authorization, idempotence, preservation and rollback'
# Full approved data is tested against each brand using synthetic local tenant IDs.
$manifest=Get-Content -Raw -Encoding UTF8 (Join-Path $repoRoot 'docs/bootstrap/bugan-recife-20261028.json') | ConvertFrom-Json
$target='52100000-0000-4000-8000-000000000001'
$payload=@{hotel=$manifest.hotel;slug=@{expected='s521-a';value='s521-ready'};entries=@($manifest.entries)}
foreach($media in $manifest.media){
 $values=$media.values
 $values | Add-Member -Force -NotePropertyName image_path -NotePropertyValue "$target/hero/$($media.key)/52130000-0000-4000-8000-000000000001.webp"
 if($media.key -eq 'hero'){$values | Add-Member -Force -NotePropertyName mobile_image_path -NotePropertyValue "$target/hero/hero/52130000-0000-4000-8000-000000000001.webp"}
 $payload.entries+=@{key=$media.key;domain='media';values=$values}
}
$payloadJson=($payload | ConvertTo-Json -Depth 40 -Compress).Replace("'","''")
foreach($brand in @('grand-mercure','novotel','mercure','bugan','default')){
 $brandSql=if($brand -eq 'default'){'null'}else{"'$brand'"}
 $setup=@"
update public.profiles set role='administrador' where id='52110000-0000-4000-8000-000000000002';
update public.hotels set platform_status='suspended',brand_code=$brandSql,theme_preset=$brandSql where id='$target';
insert into public.hotel_module_entitlements(hotel_id,module_key,is_enabled,enabled_at)
select '$target',k,true,now() from unnest(array['content.services','content.departments','content.policies','experience.appearance','travel.flights']) k
on conflict(hotel_id,module_key) do update set is_enabled=true;
insert into public.airports(iata_code,icao_code,name,city,country_code,timezone,latitude,longitude,is_active)
values('REC','SBRF','Recife / Guararapes - Gilberto Freyre','Recife','BR','America/Recife',-8.126389,-34.922778,true) on conflict(iata_code) do nothing;
select set_config('request.jwt.claim.sub','52110000-0000-4000-8000-000000000002',true);
set local role authenticated;
select public.apply_current_hotel_bootstrap('$target','full-fixture','$payloadJson');
select public.apply_current_hotel_bootstrap('$target','full-fixture','$payloadJson');
select public.apply_current_hotel_bootstrap_translation('$target','full-fixture','hotel','en','{"title":"Hotel","content":"Synthetic translation","cta":null,"category":"Hotel"}');
select public.apply_current_hotel_bootstrap_translation('$target','full-fixture','hotel','en','{"title":"Hotel","content":"Synthetic translation","cta":null,"category":"Hotel"}');
reset role;
do `$`$ begin
 assert (select count(*) from public.hotel_bootstrap_items where hotel_id='$target')=25,'full fixture duplicate';
 assert (select count(*) from public.hotel_sections where hotel_id='$target')=13,'services missing';
 assert (select count(*) from public.hotel_departments where hotel_id='$target')=3,'departments missing';
 assert (select count(*) from public.hotel_policies where hotel_id='$target')=2,'policies missing';
 assert (select count(*) from public.hotel_tourism_items where hotel_id='$target')=2,'tourism missing';
 assert (select count(*) from public.hotel_public_experience_media where hotel_id='$target')=4,'media missing';
 assert (select count(*) from public.hotel_airports where hotel_id='$target')=1,'airport missing';
 assert (select platform_status from public.hotels where id='$target')='suspended','lifecycle changed';
 assert (select count(*) from public.hotel_section_translations t join public.hotel_sections s on s.id=t.section_id where s.hotel_id='$target')=1,'translation duplicate';
end `$`$;
rollback;
"@
 ('begin;'+$migrations+$fixtures+$setup) | docker exec -i $Container psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres
 if($LASTEXITCODE -ne 0){throw "Full bootstrap fixture failed for $brand"}
 Write-Output "PASS full bootstrap fixture: $brand"
}