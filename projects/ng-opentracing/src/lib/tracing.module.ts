import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { ModuleWithProviders, NgModule } from '@angular/core';
import { DefaultTracingOptions, DEFAULT_TRACING_OPTIONS } from './default-options';
import { TracingInterceptor } from './tracing-interceptor';

export function normalizeUserInput(opts: DefaultTracingOptions): DefaultTracingOptions {
  return {
    enabled: opts.enabled ?? true,
    logEvents: opts.logEvents ?? true,
    skipTrace: opts.skipTrace ?? (() => false),
    spanName: opts.spanName ?? (req => `${req.method} ${req.url}`),
    logResponseBody: opts.logResponseBody ?? true,
  };
}

@NgModule()
export class TracingModule {
  static forRoot(opts: DefaultTracingOptions = {}): ModuleWithProviders<TracingModule> {
    return {
      ngModule: TracingModule,
      providers: opts.enabled !== false ? [
        {
          provide: DEFAULT_TRACING_OPTIONS,
          useValue: normalizeUserInput(opts),
        },
        {
          provide: HTTP_INTERCEPTORS,
          useClass: TracingInterceptor,
          multi: true,
        },
      ] : [],
    };
  }
}
