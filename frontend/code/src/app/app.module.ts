// angular components
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';

// angular material
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';

// own components
import { AppComponent } from './app.component';
import { MapComponent } from './map/map.component';
import {NgxSidebarControlModule} from '@runette/ngx-leaflet-sidebar';
import {LeafletModule} from '@asymmetrik/ngx-leaflet';
import {SpinnerComponent} from './spinner/spinner.component';
import {SpinnerOverlayComponent} from './spinner/overlay/spinner-overlay.component';
import {Overlay, OverlayModule} from '@angular/cdk/overlay';
import {MatSliderModule} from '@angular/material/slider';
import {MatSnackBarModule} from '@angular/material/snack-bar';

@NgModule({
  declarations: [AppComponent, MapComponent, SpinnerComponent, SpinnerOverlayComponent],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    MatFormFieldModule,
    MatInputModule,
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    HttpClientModule,
    LeafletModule,
    NgxSidebarControlModule,
    OverlayModule,
    MatSliderModule,
    MatSnackBarModule
  ],
  providers: [Overlay],
  bootstrap: [AppComponent]
})
export class AppModule {}
