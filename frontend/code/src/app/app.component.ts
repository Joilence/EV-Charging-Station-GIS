import { AfterViewInit, Component, ViewChild } from '@angular/core';
import {FeatureCollection} from 'geojson';
import { MapComponent } from './map/map.component';
import { DataService } from './services/data.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements AfterViewInit {

  @ViewChild(MapComponent) mapcomponent!: MapComponent;

  /*
   * Services or other dependencies are often imported via dependency injection.
   * See https://angular.io/guide/dependency-injection for more details.
   */
  constructor(private dataservice: DataService) { }

  ngAfterViewInit(): void {
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
    const wayPoints: FeatureCollection = {'type': 'FeatureCollection', 'features': []}
    wayPoints.features = [{
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
    }, ]

    // Get route path and display in the map
    this.dataservice.getRoute('driving-car', testCor).subscribe((featureCollection: FeatureCollection) => {
      this.mapcomponent.addRoutePath(featureCollection);
      this.mapcomponent.addWayPoints(wayPoints);
    });

    // User Action 2: Select points along the path and show isochrones with stations

    // select stuttgart
    const selectedPoint = {
      location: [[9.1829, 48.7758]],
      range: [10000]
    };

    this.dataservice.getIsochrones(selectedPoint.location, 'distance', selectedPoint.range).subscribe((featureCollection: FeatureCollection) => {
      this.mapcomponent.addIsochrones(featureCollection);
    });

    // this.dataservice.getStations(selectedPoint.location, selectedPoint.range).subscribe((featureCollection: JSON) => {
    //   console.log('getStations:', featureCollection);
    //   this.mapcomponent.addStations(featureCollection);
    // })

    // User Action 3: Select stations and re-route
    testCor = [
      [9.1732, 47.6779], // Konstanz
      [9.1829, 48.7758], // After 107km, Stuttgart
      [13.7373, 51.0504], // After 507km, Dresden
    ];

  }
}
