import 'server-only';
import {createHash,randomBytes,randomUUID,timingSafeEqual} from 'node:crypto';
import {uuid} from '../validation.ts';
export function newPrintCredential(){const id=randomUUID(),secret=randomBytes(32).toString('base64url');return {id,digest:printSecretDigest(secret),token:id+'.'+secret};}
export function printSecretDigest(secret:string){if(!/^[A-Za-z0-9_-]{43}$/.test(secret)||Buffer.from(secret,'base64url').toString('base64url')!==secret)throw Error('printing_credential_invalid');return createHash('sha256').update(secret,'utf8').digest('hex');}
export function parsePrintCredential(value:unknown){if(typeof value!=='string'||value.length!==80)return null;const [id,secret,...rest]=value.split('.');if(rest.length||!uuid(id))return null;try{return {id:id.toLowerCase(),digest:printSecretDigest(secret)};}catch{return null;}}
export function printDigestsEqual(a:string,b:string){if(!/^[0-9a-f]{64}$/.test(a)||!/^[0-9a-f]{64}$/.test(b))return false;return timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'));}
/** Rate correlation is technical and irreversible; raw credentials never reach counters. */
export const printCorrelation=(value:string)=>createHash('sha256').update('fb-print-http-v1:'+value).digest('hex');
