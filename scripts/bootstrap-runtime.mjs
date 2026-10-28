import { registerHooks, createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
registerHooks({ resolve(s,c,next) {
  // This entry point runs exclusively in Node on the operator's machine, never in a browser bundle.
  if (s === 'server-only') return { url: pathToFileURL(require.resolve('next/dist/compiled/server-only/empty')).href, shortCircuit: true };
  if (s.startsWith('@/')) {
    const url = new URL('../' + s.slice(2) + '.ts', import.meta.url);
    if (!existsSync(url)) throw new Error('Missing server module');
    return { url: url.href, shortCircuit: true };
  }
  if (s === 'next/headers' || s === 'next/navigation') return { url: pathToFileURL(require.resolve(s)).href, shortCircuit: true };
  return next(s,c);
} });