import { AfterViewInit, Component, ViewChild } from '@angular/core';
import {Feature, FeatureCollection} from 'geojson';
import { MapComponent } from './map/map.component';
import { DataService } from './services/data.service';
import { RoutingService } from './services/routing.service'

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
  constructor(private dataservice: DataService, private routingservice: RoutingService) { }

  ngAfterViewInit(): void {
    // this.dataservice.getBarDistribution().subscribe((geojson: FeatureCollection) => {
    //  this.mapcomponent.addGeoJSON(geojson);
    // });

    /**
     * Test Routing Process
     * Konstanz [47.6779, 9.1732], Stuttgart [48.7758, 9.1829], Dresden [51.0504, 13.7373]
     */
     // User Action 1: input from Konstanz to Dresden
    const initLocations: FeatureCollection = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: {
          name: 'Konstanz',
          type: 'Departure'
        },
        geometry: {
          type: 'Point',
          coordinates: [9.1732, 47.6779], // Konstanz
        }
      }, {
        type: 'Feature',
        properties: {
          name: 'Dresden',
          type: 'Destination'
        },
        geometry: {
          type: 'Point',
          coordinates: [13.7373, 51.0504], // Dresden
        }
      }, ]
    }

    this.routingservice.initDepDest(initLocations);
    
    this.mapcomponent.addRoutePath(this.routingservice.getCurrentRoute());

    this.mapcomponent.addWayPoints(this.routingservice.getCurrentWayPoints());

    // User Action 2: Select points along the path and show isochrones with stations
    const selectedPoint = {
      location: [[9.1829, 48.7758]], // Stuttgart
      range: [10000]
    };
    this.dataservice.getIsochrones(selectedPoint.location, 'distance', selectedPoint.range).subscribe((isochrones: FeatureCollection) => {
      this.mapcomponent.addIsochrones(isochrones);
    });

    this.dataservice.getStations(selectedPoint.location, selectedPoint.range).subscribe((stations: FeatureCollection) => {
      this.mapcomponent.addStations(stations);
    })

    // User Action 3: Select stations and re-route
    setTimeout(() => {
      const selectedStation: Feature = {
        'type': 'Feature',
        'geometry': {
          'type': 'Point',
          'coordinates': [9.178289, 48.774372],
        },
        'properties': {
          'address': 'Eichstraße 7',
        }
      }
      this.routingservice.addNewStation(selectedStation);
      this.mapcomponent.addRoutePath(this.routingservice.getCurrentRoute());
    }, 3000);
  }
}
