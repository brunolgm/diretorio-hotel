// Test process fence, not an API substitute. Real local transports pass unchanged.
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import {syncBuiltinESMExports} from 'node:module';
const ports=new Set((process.env.FB_LAB_PORTS||'4317,54347').split(','));
function check(host,port,ipc=false) {
 const local=host==='localhost'||host==='127.0.0.1'||host==='::1'||host==='[::1]'||host?.endsWith('.localhost');
 if(!local||(!ipc&&!ports.has(String(port))))throw new Error('FB lab: external network forbidden');
}
for(const api of [net,tls]){
 const original=api.connect;
 api.connect=function(...args){const a=args[0];if(typeof a==='object'&&a.path)return original.apply(this,args);if(typeof a==='string'&&!/^\d+$/.test(a))return original.apply(this,args);check(typeof a==='object'?a.host||'localhost':typeof args[1]==='string'?args[1]:'localhost',typeof a==='object'?a.port:a,true);return original.apply(this,args);};
 if(api===net)api.createConnection=api.connect;
}
for(const api of [http,https])for(const method of ['request','get']){
 const original=api[method];api[method]=function(...args){const a=args[0];const u=typeof a==='string'||a instanceof URL?new URL(a):null;check(u?.hostname||a.hostname||a.host||'localhost',u?.port||a.port||(api===https?443:80));return original.apply(this,args);};
}
const originalFetch=globalThis.fetch;
globalThis.fetch=function(input,init){const u=new URL(typeof input==='string'||input instanceof URL?input:input.url);check(u.hostname,u.port||(u.protocol==='https:'?443:80));return originalFetch(input,init);};
syncBuiltinESMExports();
