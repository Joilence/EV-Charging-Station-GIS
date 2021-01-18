/// <reference types='leaflet-sidebar-v2' />
import {Component, ElementRef, ViewChild} from '@angular/core';
import {Feature, FeatureCollection} from 'geojson';
import {MapComponent} from './map/map.component';
import {DataService} from './services/data.service';
import {Map, SidebarOptions} from 'leaflet';
import {SpinnerOverlayService} from './services/spinner-overlay.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {

  public map!: Map;

  public sidebarOptions: SidebarOptions = {
    position: 'left',
    autopan: true,
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

  initTestProcess(): void {
    /**
     *  #######################################################################
     *  ############################ Test Process #############################
     *  #######################################################################
     *
     * Konstanz [47.6779, 9.1732], Stuttgart [48.7758, 9.1829], Dresden [51.0504, 13.7373]
     */

    // User Action 2: Select points along the path and show isochrones with stations
    setTimeout(() => {
      const selectedPoint = {
        location: [[9.1829, 48.7758]], // Stuttgart
        range: [10000]
      };
      this.dataService.getIsochrones(selectedPoint.location, 'distance', selectedPoint.range).subscribe((isochrones: FeatureCollection) => {
        this.mapComponent.addIsochrones(isochrones);
      });

      this.dataService.getStations(selectedPoint.location, selectedPoint.range).subscribe((stations: FeatureCollection) => {
        this.mapComponent.addStations(stations);
      });
    }, 3000);

    // User Action 3: Select stations and re-route
    setTimeout(() => {
      const selectedStation: Feature = {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [9.178289, 48.774372],
        },
        properties: {
          address: 'Eichstraße 7',
        }
      };
      this.mapComponent.addNewStation(selectedStation);
      this.mapComponent.route();
    }, 5000);
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
    const initLocations: FeatureCollection = {
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
    this.initTestProcess();
    this.spinnerService.hide();
  }

  private closeSideBar(): void {
    if (!this.sideBar.nativeElement.classList.contains('collapsed')) {
      this.sideBar.nativeElement.classList.add('collapsed');
    }
    if (this.homeActive.nativeElement.classList.contains('active')) {
      this.homeActive.nativeElement.classList.remove('active');
    }
  }
}
