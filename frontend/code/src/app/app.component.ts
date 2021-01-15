/// <reference types='leaflet-sidebar-v2' />
import {AfterContentInit, Component, ElementRef, ViewChild} from '@angular/core';
import {Map, SidebarOptions} from 'leaflet';
import {FeatureCollection} from 'geojson';
import {MapComponent} from './map/map.component';
import {DataService} from './services/data.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements AfterContentInit {

  public map!: Map;

  public sidebarOptions: SidebarOptions = {
    position: 'left',
    autopan: true,
    closeButton: true,
    container: 'sidebar',
  };

  @ViewChild(MapComponent) mapcomponent!: MapComponent;

  @ViewChild('inputStart', {static: true})
  inputStart!: ElementRef;
  @ViewChild('inputTarget', {static: true})
  inputTarget!: ElementRef;
  @ViewChild('inputRange', {static: true})
  inputRange!: ElementRef;

  /*
   * Services or other dependencies are often imported via dependency injection.
   * See https://angular.io/guide/dependency-injection for more details.
   */
  constructor(private dataservice: DataService) {
  }

  receiveMap(map: Map): void {
    // This will throw an ExpressionChangedAfterItHasBeenCheckedError error in dev mode. That's okay and not problematic.
    this.map = map;
  }

  ngAfterContentInit(): void {
    // this.dataservice.getBarDistribution().subscribe((geojson: FeatureCollection) => {
    //  this.mapcomponent.addGeoJSON(geojson);
    // });

    /**
     * Test Routing Process
     * Konstanz [47.6779, 9.1732], Stuttgart [48.7758, 9.1829], Dresden [51.0504, 13.7373]
     */
    let testCor: number[][];

    // User Action 1: input from Konstanz to Dresden
    testCor = [
      [9.1732, 47.6779], // Konstanz
      // [9.1829, 48.7758], // After 107km, Stuttgart
      [13.7373, 51.0504], // After 507km, Dresden
    ];

    // TODO: function to construct way_points
    const testWayPoints = [{
      type: 'Feature',
      properties: {
        name: 'departure place',
        type: 'Departure'
      },
      geometry: {
        type: 'Point',
        coordinates: testCor[0]
      }
    }, {
      type: 'Feature',
      properties: {
        name: 'destination place',
        type: 'Destination'
      },
      geometry: {
        type: 'Point',
        coordinates: testCor[1]
      }
    },];

    // Get route path and display in the map
    this.dataservice.getRoute('driving-car', testCor).subscribe((featureCollection: FeatureCollection) => {
      this.mapcomponent.addRoutePath(featureCollection);
      // this.mapcomponent.addWayPoints(testWayPoints);
    });

    // User Action 2: Select points along the path and show isochrones with stations

    const testForIC = {
      locations: [[8.681495, 49.41461],
        [8.687872, 49.420318]],
      range: [300]
    };

    this.dataservice.getIsochrones(testForIC.locations, 'distance', testForIC.range).subscribe((features: FeatureCollection) => {
      this.mapcomponent.addIsochrones(features);
    });

    // User Action 3: Select stations and re-route
    testCor = [
      [9.1732, 47.6779], // Konstanz
      [9.1829, 48.7758], // After 107km, Stuttgart
      [13.7373, 51.0504], // After 507km, Dresden
    ];

  }

  public calculateRoute(): void {
    console.log(this.inputStart.nativeElement.value);
    console.log(this.inputTarget.nativeElement.value);
    console.log(this.inputRange.nativeElement.value);
  }
}
