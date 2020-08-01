
import { SpanOptions } from 'opentracing';
import { MockContext, MockSpan, MockTracer } from 'opentracing/lib/mock_tracer';

export const TEST_SPAN_ID_HEADER = 'X-Test-Span-Id';
export const TEST_TRACE_ID_HEADER = 'X-Test-Trace-Id';

export class TestTracer extends MockTracer {
  protected _startSpan(name: string, fields: SpanOptions): MockSpan {
    const span = super._startSpan(name, fields);
    span.addTags(fields.tags || {});
    return span;
  }

  // @ts-ignore
  protected _inject(span: MockContext, format: any, carrier: any): void {
    carrier[TEST_SPAN_ID_HEADER] = span.toSpanId();
    carrier[TEST_TRACE_ID_HEADER] = span.toTraceId();
  }
}
