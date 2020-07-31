import { ModuleWithProviders, NgModule, Provider } from '@angular/core';
import { DefaultTracingOptions, DEFAULT_TRACING_OPTIONS, normalizeUserInput } from './default-options';
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { TracingInterceptor } from './tracing-interceptor';

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
