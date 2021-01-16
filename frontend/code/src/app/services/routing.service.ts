import {Injectable} from '@angular/core';
import { FeatureCollection, Feature } from 'geojson';
import { DataService } from './data.service';
import {GeoJSON, Icon, Layer, LayerGroup, Map, Marker, Polyline, SidebarOptions, TileLayer, LatLng} from 'leaflet';
import {extract} from './leaflet-geometryutil.js';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class RoutingService {
  constructor(private dataservice: DataService) {
    
  }

  // TODO: TS best practice of getter and setter
  // departure, selected stations, destinations
  public wayPoints: FeatureCollection = {'type': 'FeatureCollection','features': []}
  public numOfSelectedStations: number = 0;
  public maxRange = 300000;
  public dangerBattery = 0.2;
  
  public addNewStation(station: Feature): void {
    if (station.properties) {
      station.properties.order = 1 + this.numOfSelectedStations++;
      this.wayPoints.features.push(station);
    }
  }

  public initDepDest(locations: FeatureCollection): void {
    locations.features.forEach((feature: Feature) => {
      if (feature.properties && feature.properties.type === 'Departure')
        feature.properties.order = 0;
      if (feature.properties && feature.properties.type === 'Destination')
        feature.properties.order = 99;
    })
    // console.log('processed locations:', locations);
    this.wayPoints = locations;
  }

  public getCurrentRoute(): Observable<FeatureCollection> {
    const features = this.wayPoints.features.sort((a, b) => {
      if (a.properties && b.properties)
      return a.properties.order - b.properties.order
    })
    // console.log('getCurrentRoute(): features:', features);
    const locations = Array.from(features, e => e.geometry.coordinates)
    // console.log('extract locations for getCurrentRoute():', locations);
    const routeObs = this.dataservice.getRoute('driving-car', locations);
    // console.log('route:', route);
    return routeObs;
  }

  public getCurrentWayPoints(): FeatureCollection {
    return this.wayPoints;
  }
}
