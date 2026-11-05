// Explicit audited exception for historical contract regressions, never a production bypass.
// Called only by seeds which already enforce the owned, empty local LAB.
import {randomUUID} from 'node:crypto';
export async function legacyCommissionFixture(t){
 const rpc=async(name,args)=>{const r=await t.admin.client.rpc(name,args);if(r.error)throw Error(name+': '+r.error.code);return r.data;};
 const grant=await rpc('grant_current_hotel_fb_print_capability',{p_user_id:t.admin.id,p_capability:'printing.configure',p_sector_id:null,p_active:true,p_expected_revision:0});
 const settings=await rpc('save_current_hotel_fb_print_config',{p_kind:'settings',p_id:null,p_expected_revision:0,p_values:{ticket_minutes:15}});
 await rpc('execute_current_hotel_fb_commissioning',{p_operation:'technical_override',p_body:{enabled:false,revision:settings.revision,reason:'isolated_contract_validation'},p_key:randomUUID()});
 await rpc('grant_current_hotel_fb_print_capability',{p_user_id:t.admin.id,p_capability:'printing.configure',p_sector_id:null,p_active:false,p_expected_revision:grant.revision});
}
