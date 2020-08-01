import { HttpClient, HttpEventType, HttpResponse } from '@angular/common/http';
import { HttpClientTestingModule, HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { initGlobalTracer, Tags } from 'opentracing';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { DefaultTracingOptions } from './default-options';
import { createTracingOptions } from './request-options';
import { logOfType, logsOf, TestTracer, TEST_SPAN_ID_HEADER, TEST_TRACE_ID_HEADER } from './test-tracer';
import { TracingModule } from './tracing.module';

describe('TracingInterceptorService', () => {
  let tracer: TestTracer;
  let httpMock: HttpTestingController;
  let http: HttpClient;

  beforeEach(() => {
    tracer = new TestTracer();
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

  it('should inject the span context to the http request', () => {
    http.get('/endpoint12').subscribe();

    const { request } = expectSuccessfulRequest(httpMock, '/endpoint12');

    expect(request.headers.get(TEST_SPAN_ID_HEADER)).toBeDefined();
    expect(request.headers.get(TEST_TRACE_ID_HEADER)).toBeDefined();
  });

  it('should log the response body by default', () => {
    http.get('/endpoint13').subscribe();

    expectSuccessfulRequest(httpMock, '/endpoint13', { body: 'response body' });

    const { fields } = logOfType(tracer.report().spans[0], HttpEventType.Response);

    expect(fields.body).toBe('response body');
  });

  it('should not log the response body when logResponseBody=false', () => {
    http.get('/endpoint16', { params: createTracingOptions({ logResponseBody: false }) }).subscribe();

    expectSuccessfulRequest(httpMock, '/endpoint16', { body: 'response body' });

    const { fields } = logOfType(tracer.report().spans[0], HttpEventType.Response);

    expect(fields.body).toBeUndefined();
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

  it('should not log the response body when logResponseBody=false', () => {
    const { http, httpMock, tracer } = configureTracingModule({ logResponseBody: false });

    http.get('/endpoint14').subscribe();

    expectSuccessfulRequest(httpMock, '/endpoint14', { body: 'response body' });

    const { fields } = logOfType(tracer.report().spans[0], HttpEventType.Response);

    expect(fields.body).toBeUndefined();
  });

  it('should log the response body when logResponseBody=false is overridden in the request', () => {
    const { http, httpMock, tracer } = configureTracingModule({ logResponseBody: false });

    http.get('/endpoint15', { params: createTracingOptions({ logResponseBody: true }) }).subscribe();

    expectSuccessfulRequest(httpMock, '/endpoint15', { body: 'response body' });

    const { fields } = logOfType(tracer.report().spans[0], HttpEventType.Response);

    expect(fields.body).toBe('response body');
  });
});

function expectSuccessfulRequest<T>(
  httpMock: HttpTestingController,
  url: string,
  extraData: Partial<Parameters<HttpResponse<any>['clone']>>[0] = {},
): TestRequest {
  const request = httpMock.expectOne(url);
  request.event(new HttpResponse<any>({ status: 200, ...extraData }));
  return request;
}

// tslint:disable-next-line: typedef
function configureTracingModule(opts?: DefaultTracingOptions) {
  const tracer = new TestTracer();
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
