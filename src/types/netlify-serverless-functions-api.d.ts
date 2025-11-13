// src/types/netlify-serverless-functions-api.d.ts
// Minimal stub to avoid TS18028 from @netlify/serverless-functions-api.
// We only need basic shapes for Netlify Function handlers.

declare module '@netlify/serverless-functions-api' {
  export interface FunctionContext {
    event: unknown;
    context: unknown;
  }

  export type Handler<TEvent = any, TResult = any> = (
    event: TEvent,
    context: FunctionContext
  ) => Promise<TResult> | TResult;
}
