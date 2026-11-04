import 'server-only';
import {randomUUID} from 'node:crypto';
export function printingDiagnostic(status:number){const diagnostic_id=randomUUID();const code=status===403?'access_denied':status===409?'conflict':status===429?'rate_limited':status===503?'unavailable':'validation_rejected';try{console.info(JSON.stringify({scope:'fb.printing',code,diagnostic_id}));}catch{}return diagnostic_id;}
