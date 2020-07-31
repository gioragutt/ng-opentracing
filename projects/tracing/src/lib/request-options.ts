import { HttpParams } from '@angular/common/http';
import { Span } from 'opentracing';

const TRACING_OPTS = Symbol('Tracing Options');

/**
 * Create a clean `HttpParams` with `HttpTracingOptions`
 *
 * @param opts http tracing options
 * @returns new `HttpParams`
 */
export function createTracingOptions(opts: HttpTracingOptions): HttpParams {
  return addTracingOptions(new HttpParams(), opts);
}

/**
 * Adds `HttpTracingOptions` to an existing `HttpParams`
 *
 * @param params http params to update
 * @param opts http tracing options
 * @returns the `params` instance
 */
export function addTracingOptions(params: HttpParams, opts: HttpTracingOptions): HttpParams {
  params[TRACING_OPTS] = opts;
  return params;
}

/**
 * Extracts `HttpTracingOptions` from an `HttpParams`
 *
 * @param params `HttpParams` which might have `HttpTracingOptions`
 * @returns the extracted `HttpTracingOptions`, or `null` if there were none in `params`
 */
export function getTracingOptions(params: HttpParams): HttpTracingOptions | null {
  const opts = params[TRACING_OPTS];
  return opts || null;
}

export interface HttpTracingOptions {
  skipTrace?: boolean;
  parentSpan?: Span;
  spanName?: string;
}
