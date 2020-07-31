import { HttpParams } from '@angular/common/http';
import { Span } from 'opentracing';

const TRACING_OPTS = Symbol('Tracing Options');

export function createTracingOptions(opts: HttpTracingOptions): HttpParams {
  return addTracingOptions(new HttpParams(), opts);
}

export function addTracingOptions(params: HttpParams, opts: HttpTracingOptions): HttpParams {
  params[TRACING_OPTS] = opts;
  return params;
}

export function getTracingOptions(params: HttpParams): HttpTracingOptions | null {
  const opts = params[TRACING_OPTS];
  return opts || null;
}

export interface HttpTracingOptions {
  skipTrace?: boolean;
  parentSpan?: Span;
  spanName?: string;
}
