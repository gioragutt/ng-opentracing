import { HttpEventType, HttpRequest } from '@angular/common/http';
import { InjectionToken } from '@angular/core';

/**
 * Options used to control the default behavior of the tracing of all requests.
 */
export interface DefaultTracingOptions {
  /**
   * Whether or not tracing is enabled or not.
   *
   * Default: `true`
   */
  enabled?: boolean;

  /**
   * Configure which individual HttpEvents to log.
   *
   * Default: `true`
   */
  logEvents?: boolean | HttpEventType[] | Set<HttpEventType>;

  /**
   * Configure how to extract the span name from an http request.
   *
   * Default: `${req.method} ${req.url}`
   */
  spanName?: (req: HttpRequest<any>) => string;

  /**
   * Configure whether or not to skip tracing certain requests.
   *
   * Default: `true`
   */
  skipTrace?: (req: HttpRequest<any>) => boolean;
}

export const DEFAULT_TRACING_OPTIONS =
  new InjectionToken<DefaultTracingOptions>('DEFAULT_TRACING_OPTIONS');
