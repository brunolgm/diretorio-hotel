// The installed Node 22 supports synchronous hooks; @types/node 20 lacks this API.
import 'node:module';
declare module 'node:module' {
  export function registerHooks(options: {
    resolve: (specifier: string, context: { conditions: string[]; importAttributes: Record<string, string>; parentURL?: string }, nextResolve: (specifier: string, context?: object) => { url: string; format?: string; shortCircuit?: boolean }) => { url: string; format?: string; shortCircuit?: boolean };
  }): { deregister(): void };
}
