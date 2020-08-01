import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { TracingModule } from 'projects/ng-opentracing';
import { AppComponent } from './app.component';

@NgModule({
  declarations: [
    AppComponent,
  ],
  imports: [
    BrowserModule,
    TracingModule,
  ],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule { }
