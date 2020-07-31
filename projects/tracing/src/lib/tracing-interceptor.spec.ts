import { HttpClient, HttpEventType, HttpResponse } from '@angular/common/http';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { initGlobalTracer, SpanOptions, Tags } from 'opentracing';
import { MockSpan, MockTracer } from 'opentracing/lib/mock_tracer';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { DefaultTracingOptions } from './default-options';
import { createTracingOptions } from './request-options';
import { TracingModule } from './tracing.module';

// @ts-ignore
const originalStartSpan = MockTracer.prototype._startSpan;
// @ts-ignore
MockTracer.prototype._startSpan = function _startSpan(this: MockTracer, name: string, fields: SpanOptions): MockSpan {
  const span: MockSpan = originalStartSpan.call(this, name, fields);
  span.addTags(fields.tags || {});
  return span;
};

describe('TracingInterceptorService', () => {
  let tracer: MockTracer;
  let httpMock: HttpTestingController;
  let http: HttpClient;

  beforeEach(() => {
    tracer = new MockTracer();
    initGlobalTracer(tracer);

    TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        TracingModule.forRoot(),
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);
    http = TestBed.inject(HttpClient);
  });

  it('should trace on an http request', () => {
    http.get('/endpoint1').subscribe();

    expectSuccessfulRequest(httpMock, '/endpoint1');

    const [span] = tracer.report().spans;

    expect(span.operationName()).toBe('GET /endpoint1');
    expect(span.tags()).toEqual({
      [Tags.HTTP_METHOD]: 'GET',
      [Tags.HTTP_STATUS_CODE]: 200,
      [Tags.HTTP_URL]: '/endpoint1',
      [Tags.SPAN_KIND]: Tags.SPAN_KIND_RPC_CLIENT,
    });
  });

  it('should log events of the http request', () => {
    http.get('/endpoint2').subscribe();

    const request = httpMock.expectOne('/endpoint2');
    request.event({ type: HttpEventType.DownloadProgress, loaded: 5, total: 5 });
    request.event(new HttpResponse<any>({ status: 200 }));

    const [span] = tracer.report().spans;
    expect(logsOf(span).length).toBe(3);
  });

  it('should skip trace of specified in params', () => {
    http.get('/endpoint3', { params: createTracingOptions({ skipTrace: true }) }).subscribe();

    expectSuccessfulRequest(httpMock, '/endpoint3');

    expect(tracer.report().spans.length).toBe(0);
  });

  it('should set a custom span name when using spanName', () => {
    http.get('/endpoint10', { params: createTracingOptions({ spanName: 'Span Name' }) }).subscribe();

    expectSuccessfulRequest(httpMock, '/endpoint10');

    expect(tracer.report().spans[0].operationName()).toBe('Span Name');
  });

  it('should use parent span if provided in parentSpan', () => {
    const parentSpan = tracer.startSpan('parent-span');
    http.get('/endpoint11', { params: createTracingOptions({ parentSpan }) }).subscribe();

    expectSuccessfulRequest(httpMock, '/endpoint11');

    const traceId = tracer.report().spans[0].context().toTraceId();
    expect(traceId).toBe(parentSpan.context().toTraceId());
  });

  it('should finish the span on the end of the http request', () => {
    http.get('/endpoint4').subscribe();

    const request = httpMock.expectOne('/endpoint4');
    request.event(new HttpResponse<any>({ status: 200 }));
    request.flush(null);

    expect(tracer.report().spans[0]._finishMs).toBeGreaterThan(0);
  });

  it('should set correct error tags and log on error', () => {
    http.get('/endpoint5').pipe(catchError(() => of(true))).subscribe();

    httpMock.expectOne('/endpoint5').error(new ErrorEvent('kaki'));
    const [span] = tracer.report().spans;

    expect(span.tags()[Tags.ERROR]).toBeTrue();
  });
});

describe('DefaultTracingOptions', () => {
  it('should not trace if enabled=true', () => {
    const { http, httpMock, tracer } = configureTracingModule({ enabled: false });

    http.get('/endpoint6').subscribe();

    expectSuccessfulRequest(httpMock, '/endpoint6');

    expect(tracer.report().spans.length).toBe(0);
  });

  it('should not log when logEvents=true', () => {
    const { http, httpMock, tracer } = configureTracingModule({ logEvents: false });
    http.get('/endpoint7').subscribe();

    expectSuccessfulRequest(httpMock, '/endpoint7');

    const [span] = tracer.report().spans;
    expect((span as any)._logs as any[]).toEqual([]);
  });

  it('should set a custom span name when using spanName', () => {
    const { http, httpMock, tracer } = configureTracingModule({
      spanName: () => 'Span Name',
    });

    http.get('/endpoint8').subscribe();

    expectSuccessfulRequest(httpMock, '/endpoint8');

    const [span] = tracer.report().spans;
    expect(span.operationName()).toBe('Span Name');
  });

  it('should not log events not included in logEvents', () => {
    const { http, httpMock, tracer } = configureTracingModule({
      logEvents: [HttpEventType.UploadProgress, HttpEventType.Response],
    });

    http.get('/endpoint9').subscribe();

    const request = httpMock.expectOne('/endpoint9');
    request.event({ type: HttpEventType.UploadProgress, loaded: 5, total: 5 });
    request.event({ type: HttpEventType.DownloadProgress, loaded: 5, total: 5 });
    request.event(new HttpResponse<any>({ status: 200 }));

    const [span] = tracer.report().spans;
    expect(logsOf(span).length).toEqual(2);
  });

  it('should skip tracing if skipTrace returns true', () => {
    const { http, httpMock, tracer } = configureTracingModule({
      skipTrace: req => req.url.includes('no-trace'),
    });

    http.get('/trace').subscribe();
    http.get('/no-trace').subscribe();

    expectSuccessfulRequest(httpMock, '/trace');
    expectSuccessfulRequest(httpMock, '/no-trace');

    const { spans } = tracer.report();
    expect(spans.length).toBe(1);
    expect(spans[0].operationName()).not.toContain('no-trace');
  });
});

function expectSuccessfulRequest(httpMock: HttpTestingController, url: string): void {
  httpMock.expectOne(url).event(new HttpResponse<any>({ status: 200 }));
}

function logsOf(span: MockSpan): Array<{
  fields: { [key: string]: any };
  timestamp?: number;
}> {
  return (span as any)._logs;
}

// tslint:disable-next-line: typedef
function configureTracingModule(opts?: DefaultTracingOptions) {
  const tracer = new MockTracer();
  initGlobalTracer(tracer);

  TestBed.configureTestingModule({
    imports: [
      HttpClientTestingModule,
      TracingModule.forRoot(opts),
    ],
  });

  const httpMock = TestBed.inject(HttpTestingController);
  const http = TestBed.inject(HttpClient);

  return { tracer, httpMock, http };
}

