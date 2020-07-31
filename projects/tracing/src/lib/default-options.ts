import { HttpEventType, HttpRequest } from '@angular/common/http';
import { InjectionToken } from '@angular/core';

export interface DefaultTracingOptions {
  /**
   * Whether or not tracing is enabled or not.
   *
   * Default: true
   */
  enabled?: boolean;

  /**
   * Configure which individual HttpEvents to log.
   *
   * Default: true
   */
  logEvents?: boolean | HttpEventType[] | Set<HttpEventType>;

  /**
   * Configure how to extract the span name from an http request.
   *
   * Default: `${req.method} ${req.url}`
   */
  spanName?: (req: HttpRequest<any>) => string;
  skipTrace?: (req: HttpRequest<any>) => boolean;
}

export const DEFAULT_TRACING_OPTIONS =
  new InjectionToken<DefaultTracingOptions>('DEFAULT_TRACING_OPTIONS');

export function normalizeUserInput(opts: DefaultTracingOptions): DefaultTracingOptions {
  return {
    enabled: opts.enabled ?? true,
    logEvents: opts.logEvents ?? true,
    skipTrace: opts.skipTrace ?? (() => false),
    spanName: opts.spanName ?? (req => `${req.method} ${req.url}`),
  };
}
