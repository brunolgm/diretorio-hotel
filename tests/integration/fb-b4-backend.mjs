import '../../scripts/bootstrap-runtime.mjs';
import assert from 'node:assert/strict';
import{mkdirSync,writeFileSync}from'node:fs';import{join}from'node:path';
import{seedB23,rpc,config,saved,basket,fullIntent}from'./fb-b23-seed.mjs';
import{labSql}from'../../scripts/fb-local-lab.mjs';import{rows,literal}from'./fb-local-seed.mjs';
const lab=await seedB23(),checks=[];const directory=join(lab.s.dir,'b4-backend');mkdirSync(directory,{recursive:true});
const x={...lab,directory,backendOnly:true,rpc,config,saved,basket,fullIntent,rows,literal,labSql,check:(ok,label)=>{assert.ok(ok,label);checks.push(label);},resetAdmission:t=>labSql('delete from fb_order_private.admission_buckets where hotel_id='+literal(t.id))};
try{const{verifyB4}=await import('./fb-b4.mjs');await verifyB4(x);const result={suite:'fb-b4-backend-diagnostic',backendOnly:true,passed:checks.length,failed:0,checks};writeFileSync(join(directory,'report.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({...result,checks:undefined,directory}));}catch(error){writeFileSync(join(directory,'failure.json'),JSON.stringify({passed:checks.length,error:error.message,checks},null,2));console.error(error.stack);process.exitCode=1;}
