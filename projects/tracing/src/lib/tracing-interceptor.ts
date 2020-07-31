import {
  HttpErrorResponse,
  HttpEvent,
  HttpEventType,
  HttpHandler,
  HttpHeaderResponse,
  HttpInterceptor,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import { globalTracer, Span, Tags } from 'opentracing';
import { Observable, Observer } from 'rxjs';
import { tap } from 'rxjs/operators';
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

    const { parentSpan, spanName, skipTrace } = getTracingOptions(req.params) ?? {};
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

    const tracingObserver: Observer<HttpEvent<any>> = {
      next: (event: HttpEvent<any>) => {
        switch (event.type) {
          case HttpEventType.ResponseHeader:
            this.logResponseHeaderEvent(span, event);
            break;
          case HttpEventType.Response:
            this.logResponseEvent(span, event);
            break;
          default:
            this.logEvent(span, event);
            break;
        }
      },
      error: (error: HttpErrorResponse) => this.logError(span, error),
      complete: () => span.finish(),
    };

    return next.handle(req).pipe(tap(tracingObserver));
  }

  private logError(span: Span, error: HttpErrorResponse): void {
    span.setTag(Tags.ERROR, true);
    span.addTags({
      [Tags.ERROR]: true,
      'error.kind': error.name,
      'error.object': error,
      message: error.message,
    });
  }

  private logEvent(span: Span, event: Partial<HttpEvent<any>>): void {
    if (!this.logEvents) {
      return;
    }

    if (this.logEvents === true || this.logEvents.has(event.type)) {
      span.log({ ...event, type: HttpEventType[event.type] });
    }
  }

  private logResponseHeaderEvent(span: Span, event: HttpHeaderResponse): void {
    this.logEvent(span, event);
    span.setTag(Tags.HTTP_STATUS_CODE, event.status);
  }

  private logResponseEvent(span: Span, event: HttpResponse<any>): void {
    const { body, ...rest } = event;
    this.logEvent(span, rest);
  }
}
