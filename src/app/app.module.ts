import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { TracingModule } from 'projects/tracing';
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
