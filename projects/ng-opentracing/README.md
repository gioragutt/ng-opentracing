# ng-opentracing

![Build](https://github.com/gioragutt/ng-opentracing/workflows/Build/badge.svg)

`ng-opentracing` will help you easily integrate [`opentracing`](https://opentracing.io/) into your application.

> The library currently only wraps usage of `HttpClient`. For more integrations, please open issues!

# Getting started

```sh
npm i opentracing ng-opentracing
```

First, start by adding the `TracingModule` to your `AppModule`, and initializaing the [opentracing globalTracer](https://github.com/opentracing/opentracing-javascript#global-tracer).

```ts
import { NgModule } from '@angular/core';
import { TracingModule, DefaultTracingOptions } from 'ng-opentracing';
import { initGlobalTracer } from 'opentracing';

const tracingOptions: DefaultTracingOptions = { ... };

@NgModule({
  imports: [
    TracingModule.forRoot(tracingOptions),
  ],
})
export class AppModule {
  constructor() {
    initGlobalTracer(...);
  }
}
```

> See [DefaultTracingOptions](projects/ng-opentracing/src/lib/default-options.ts) for details about customization of the `TracingModule` default behavior.

From that point, all http requests done via an `HttpClient` will be traced!

## Example trace:

```ts
http.get('/endpoint').subscribe();
```

Will result in (approximately) the following span (depdending on your Tracer implementation):

```json
{
  "operationName": "GET /endpoint",
  "tags": {
    "http.url": "/endpoint",
    "http.method": "GET",
    "http.status_code": 200,
    "span.kind": "client"
  },
  "logs": [...list of http event logs],
  ...rest of the span fields
}
```

# Changing the tracing behavior per request

Often, you'd like to how your reqeusts' spans will be created.

To do that, pass an `HttpParams` wrapped with `HttpTracingOptions`:

```ts
import { HttpParams } from '@angular/common/http';
import { addTracingOptions, createTracingOptions, HttpTracingOptions } from 'ng-opentracing';

const tracingOptions: HttpTracingOptions = { ... };

let params: HttpParams = new HttpParams();
params = addTracingOptions(params, tracingOptions);

// Or

const params: HttpParams = createTracingOptions(tracingOptions);

http.get('/endpoint', { params });
```

> See [HttpTracingOptions](projects/ng-opentracing/src/lib/request-options.ts) for details about customizing the span created for the request.

# Development

First, fork the repository.

```sh
$ git clone git@github.com:<your-name>/ng-opentracing.git
# Or..
$ git clone https://github.com/<your-name>/ng-opentracing.git

npm i
npm test -- ng-opentracing
```
