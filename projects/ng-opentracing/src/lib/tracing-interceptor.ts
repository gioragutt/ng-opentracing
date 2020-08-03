import {
  HttpErrorResponse,
  HttpEvent,
  HttpEventType,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import { FORMAT_HTTP_HEADERS, globalTracer, Span, Tags } from 'opentracing';
import { Observable, throwError } from 'rxjs';
import { catchError, finalize, tap } from 'rxjs/operators';
import { DefaultTracingOptions, DEFAULT_TRACING_OPTIONS } from './default-options';
import { getTracingOptions } from './request-options';

@Injectable({
  providedIn: 'root',
})
export class TracingInterceptor implements HttpInterceptor {
  private logEvents: Set<HttpEventType> | boolean;

  constructor(@Inject(DEFAULT_TRACING_OPTIONS) private opts: DefaultTracingOptions) {
    if (typeof opts.logEvents !== 'boolean') {
      this.logEvents = new Set([...opts.logEvents]);
    } else {
      this.logEvents = opts.logEvents;
    }
  }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (this.opts.skipTrace(req)) {
      return next.handle(req);
    }

    const {
      parentSpan,
      spanName,
      skipTrace,
      logResponseBody,
    } = getTracingOptions(req.params) ?? {};

    if (skipTrace) {
      return next.handle(req);
    }

    const span = globalTracer().startSpan(spanName || this.opts.spanName(req), {
      childOf: parentSpan,
      tags: {
        [Tags.HTTP_METHOD]: req.method,
        [Tags.HTTP_URL]: req.urlWithParams,
        [Tags.SPAN_KIND]: Tags.SPAN_KIND_RPC_CLIENT,
      },
    });

    const tracingHeaders: Record<string, string> = {};
    globalTracer().inject(span, FORMAT_HTTP_HEADERS, tracingHeaders);

    req = req.clone({ setHeaders: tracingHeaders });

    return next.handle(req).pipe(
      tap((event: HttpEvent<any>) => {
        switch (event.type) {
          case HttpEventType.Response:
            this.logResponseEvent(span, event, logResponseBody);
            break;
          default:
            this.logEvent(span, event);
            break;
        }
      }),
      catchError((error: HttpErrorResponse) => {
        this.logError(span, error);
        return throwError(error);
      }),
      finalize(() => span.finish()),
    );
  }

  private logError(span: Span, error: HttpErrorResponse): void {
    const tags = {
      [Tags.ERROR]: true,
      'error.kind': error.name,
      'error.object': error,
      message: error.message,
    };

    // zipkin-javascript-opentracing span implementation does not
    // implement the `addTags` method.
    if (typeof span.addTags === 'function') {
      span.addTags(tags);
    } else {
      Object.entries(tags).forEach(([key, value]) => {
        span.setTag(key, value);
      });
    }
  }

  private logEvent(span: Span, event: Partial<HttpEvent<any>>): void {
    if (!this.logEvents) {
      return;
    }

    if (this.logEvents === true || this.logEvents.has(event.type)) {
      span.log({ ...event, type: HttpEventType[event.type] });
    }
  }

  private logResponseEvent(span: Span, event: HttpResponse<any>, logResponseBody: boolean | undefined): void {
    span.setTag(Tags.HTTP_STATUS_CODE, event.status);
    const log = { ...event };

    if (logResponseBody !== true) {
      if (logResponseBody === false || !this.opts.logResponseBody) {
        delete log.body;
      }
    }

    this.logEvent(span, log);
  }
}
