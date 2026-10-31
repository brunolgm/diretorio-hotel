// Read-only, offline gate: consumes a newly collected snapshot without credentials, clients or network writes.
// Snapshot: {hotelId,announcements:[],banners:[],observedAt, functionalPassed?}.
// It is intentionally independent of build/security/functional tests. Red does not block development.
import {readFile} from 'node:fs/promises';
import {evaluateCommunicationEditorialGate} from '../lib/communications/editorial-gate.ts';
const args=process.argv.slice(2);
if(args.length!==1){console.error('Usage: node --experimental-strip-types scripts/check-communications-editorial.mjs <snapshot.json>');process.exitCode=2;}
else try {
 const snapshot=JSON.parse(await readFile(args[0],'utf8'));
 if(typeof snapshot.hotelId!=='string'||!Array.isArray(snapshot.announcements)||!Array.isArray(snapshot.banners)||!Number.isFinite(Date.parse(snapshot.observedAt)))throw new Error('invalid_snapshot');
 for(const [kind,rows] of [['announcement',snapshot.announcements],['banner',snapshot.banners]])for(const row of rows){
  if(!row||typeof row.id!=='string'||typeof row.hotel_id!=='string'||![true,false,null].includes(row.is_active)||!(row.starts_at===null||typeof row.starts_at==='string')||!(row.ends_at===null||typeof row.ends_at==='string')||!(row.title===null||typeof row.title==='string')||(kind==='announcement'&&(!(row.body===null||typeof row.body==='string')||!['alerta','manutencao','informativo','promocao'].includes(row.category))))throw new Error('invalid_row');
 }
 const result=evaluateCommunicationEditorialGate({...snapshot,now:Date.parse(snapshot.observedAt)});
 console.log(JSON.stringify({...result,source:'read-only snapshot; not a live production attestation',observedAt:snapshot.observedAt},null,2));
 process.exitCode=result.editorial==='green'?0:1;
} catch {console.error('Editorial gate unavailable: provide a complete, valid read-only snapshot.');process.exitCode=2;}
