/// <reference types='leaflet-sidebar-v2' />
import {Component, ElementRef, ViewChild} from '@angular/core';
import {Feature, FeatureCollection, Point} from 'geojson';
import {MapComponent} from './map/map.component';
import {DataService} from './services/data.service';
import {Map, SidebarOptions, LatLngTuple} from 'leaflet';
import {SpinnerOverlayService} from './services/spinner-overlay.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {

  public map!: Map;

  public maxZoomHeat = 11;
  public radiusHeat = 10;

  public sidebarOptions: SidebarOptions = {
    position: 'left',
    autopan: false,
    closeButton: true,
    container: 'sidebar',
  };

  @ViewChild(MapComponent) mapComponent!: MapComponent;

  @ViewChild('inputStartLat', {static: true})
  inputStartLat!: ElementRef;
  @ViewChild('inputStartLong', {static: true})
  inputStartLong!: ElementRef;
  @ViewChild('inputTargetLat', {static: true})
  inputTargetLat!: ElementRef;
  @ViewChild('inputTargetLong', {static: true})
  inputTargetLong!: ElementRef;
  @ViewChild('inputRange', {static: true})
  inputRange!: ElementRef;
  @ViewChild('sidebar', {static: true})
  sideBar!: ElementRef;
  @ViewChild('homeActive', {static: true})
  homeActive!: ElementRef;
  @ViewChild('layerTab', {static: true})
  layerTab!: ElementRef;

  /*
   * Services or other dependencies are often imported via dependency injection.
   * See https://angular.io/guide/dependency-injection for more details.
   */
  constructor(private dataService: DataService, private spinnerService: SpinnerOverlayService) {
  }

  receiveMap(map: Map): void {
    // This will throw an ExpressionChangedAfterItHasBeenCheckedError error in dev mode. That's okay and not problematic.
    this.map = map;
  }

  public calculateRoute(): void {
    this.closeSideBar();
    // Format: [long ,lat]
    const start = [parseFloat(this.inputStartLong.nativeElement.value), parseFloat(this.inputStartLat.nativeElement.value)];
    const target = [parseFloat(this.inputTargetLong.nativeElement.value), parseFloat(this.inputTargetLat.nativeElement.value)];
    const range = parseFloat(this.inputRange.nativeElement.value);
    // Convert km to m.
    this.mapComponent.setMaxRange(range * 1000);
    this.spinnerService.show();
    const initLocations: FeatureCollection<Point> = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: {
          name: 'Start',
          type: 'Departure'
        },
        geometry: {
          type: 'Point',
          coordinates: start
        }
      }, {
        type: 'Feature',
        properties: {
          name: 'Target',
          type: 'Destination'
        },
        geometry: {
          type: 'Point',
          coordinates: target
        }
      }, ]
    };
    this.mapComponent.initDepDest(initLocations);
    this.mapComponent.route();
    this.spinnerService.hide();
  }

  private closeSideBar(): void {
    if (!this.sideBar.nativeElement.classList.contains('collapsed')) {
      this.sideBar.nativeElement.classList.add('collapsed');
    }
    if (this.homeActive.nativeElement.classList.contains('active')) {
      this.homeActive.nativeElement.classList.remove('active');
    }
    if (this.layerTab.nativeElement.classList.contains('active')) {
      this.layerTab.nativeElement.classList.remove('active');
    }
  }

  public addHeatMapStationsLayer(): void {
    console.log(this.map.getZoom());
    this.mapComponent.addStationsHeat(this.radiusHeat, this.maxZoomHeat);
    // this.closeSideBar();
  }
}
