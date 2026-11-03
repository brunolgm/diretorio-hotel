import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {mkdirSync} from 'node:fs';
const {build}=createRequire(import.meta.url)('esbuild');
mkdirSync('out/fb-ssr',{recursive:true});
await build({entryPoints:['tests/browser/fb-ssr.tsx'],bundle:true,platform:'node',format:'cjs',packages:'external',jsx:'automatic',tsconfig:'tsconfig.json',outfile:'out/fb-ssr/fixture.cjs',loader:{'.png':'dataurl'},define:{'process.env.NEXT_PUBLIC_SUPABASE_URL':JSON.stringify('http://127.0.0.1:4193')},alias:{'next/image':resolve('tests/browser/public-v3-next-stubs.tsx'),'next/link':resolve('tests/browser/public-v3-link-stub.tsx'),'next/navigation':resolve('tests/browser/public-v3-next-stubs.tsx'),'@/app/admin/cardapio/actions':resolve('tests/browser/fb-actions-stub.ts')}});
process.stdout.write(execFileSync(process.execPath,['out/fb-ssr/fixture.cjs'],{encoding:'utf8'}));
