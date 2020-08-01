import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { ModuleWithProviders, NgModule, Provider } from '@angular/core';
import { DefaultTracingOptions, DEFAULT_TRACING_OPTIONS } from './default-options';
import { TracingInterceptor } from './tracing-interceptor';

function normalizeUserInput(opts: DefaultTracingOptions): DefaultTracingOptions {
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
  static forRoot(opts?: DefaultTracingOptions): ModuleWithProviders<TracingModule> {
    const defaultOpts = normalizeUserInput(opts || {});

    const providers: Provider[] = defaultOpts.enabled ? [
      {
        provide: DEFAULT_TRACING_OPTIONS,
        useValue: defaultOpts,
      },
      {
        provide: HTTP_INTERCEPTORS,
        useClass: TracingInterceptor,
        multi: true,
      },
    ] : [];

    return {
      ngModule: TracingModule,
      providers,
    };
  }
}
