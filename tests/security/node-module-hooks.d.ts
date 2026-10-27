// Node 22.15+ runtime used by the security suite. @types/node 20 does not yet
// declare synchronous module hooks; keep this test-only declaration bounded.
import 'node:module';

declare module 'node:module' {
  export function registerHooks(options: {
    resolve: (
      specifier: string,
      context: { conditions: string[]; importAttributes: Record<string, string>; parentURL?: string },
      nextResolve: (specifier: string, context?: object) => { url: string; format?: string; shortCircuit?: boolean }
    ) => { url: string; format?: string; shortCircuit?: boolean };
  }): { deregister(): void };
}
