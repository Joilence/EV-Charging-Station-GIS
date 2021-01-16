import {Injectable} from '@angular/core';
import {Feature, FeatureCollection, LineString, Point} from 'geojson';
import {DataService} from './data.service';
import {Observable} from 'rxjs';
import {map} from 'rxjs/operators'
import {LatLng, LatLngExpression, Map, Polyline} from 'leaflet';
import {extract} from './leaflet-geometryutil.js';

@Injectable({
  providedIn: 'root',
})
export class RoutingService {
  private map!: Map;

  constructor(private dataService: DataService) {

  }

  // TODO: TS best practice of getter and setter
  // departure, selected stations, destinations
  public wayPoints: FeatureCollection = {type: 'FeatureCollection', features: []};
  public numOfSelectedStations = 0;
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
      if (feature.properties && feature.properties.type === 'Departure') {
        feature.properties.order = 0;
      }
      if (feature.properties && feature.properties.type === 'Destination') {
        feature.properties.order = 99;
      }
    });
    // console.log('processed locations:', locations);
    this.wayPoints = locations;
    this.numOfSelectedStations = 0;
  }
  
  public handleRoute(featureCollection: FeatureCollection): FeatureCollection {
    const maxRange = this.maxRange;
    const dangerBattery = this.dangerBattery;
    const wholeRoute = featureCollection.features[0] as Feature;

    // data check
    console.log('rs.maxRange:', this.maxRange);
    console.log('rs.dangerBattery:', this.dangerBattery);
    console.log('rs.map:', this.map);

    if (wholeRoute.properties) {
      wholeRoute.properties.type = 'Whole Route';
      const wholeRouteLine = new Polyline((wholeRoute.geometry as LineString).coordinates as LatLngExpression[]);
      const wholeRouteDistance = wholeRoute.properties.summary.distance;

      // danger segment (ds)
      // TODO: check every segment instead of only last one
      let isDanger = false;
      const segments = wholeRoute.properties.segments;
      const lastSegmentDistance = segments[segments.length - 1].distance;
      // console.log('lastSegmentDistance: ', lastSegmentDistance);
      if (lastSegmentDistance > maxRange * (1 - dangerBattery)) {
        isDanger = true;
        const previousSegmentsDistance = wholeRouteDistance - lastSegmentDistance;
        const dsStartDistance = previousSegmentsDistance + maxRange * (1 - dangerBattery);
        const dsEndDistance = previousSegmentsDistance + Math.min(maxRange, lastSegmentDistance);
        const dsStartPercent = dsStartDistance / wholeRouteDistance;
        const dsEndPercent = dsEndDistance / wholeRouteDistance;
        // console.log('previous seg dis:', previousSegmentsDistance);
        // TODO: ugly code: reverse [lat, lng] for unknown problem; 3 places;
        const dsCors = Array.from(extract(this.map, wholeRouteLine, dsStartPercent, dsEndPercent), (e: LatLng) => {
          return [e.lat, e.lng];
        });
        // console.log(dsCors);
        const dsLine = new Polyline(dsCors as LatLngExpression[]);
        const dsGeoJSON = dsLine.toGeoJSON();
        dsGeoJSON.geometry.coordinates = dsCors;
        dsGeoJSON.properties.type = 'Danger Segment';
        // console.log('Danger Segment:', dsGeoJSON);
        // TODO: ugly code fix
        const ssCors = Array.from(extract(this.map, wholeRouteLine, 0, dsStartPercent), (e: LatLng) => {
          return [e.lat, e.lng];
        });
        const ssLine = new Polyline(ssCors as LatLngExpression[]);
        const ssGeoJSON = ssLine.toGeoJSON();
        ssGeoJSON.geometry.coordinates = ssCors;
        ssGeoJSON.properties.type = 'Safe Segment';

        featureCollection.features.push(dsGeoJSON);
        featureCollection.features.push(ssGeoJSON);
      }

      // safe segment (ss)
      if (!isDanger) {
        // TODO: ugly code fix
        const ssGeoJSON = wholeRouteLine.toGeoJSON();
        ssGeoJSON.geometry.coordinates = (wholeRoute.geometry as LineString).coordinates;
        ssGeoJSON.properties.type = 'Safe Segment';
        featureCollection.features.push(ssGeoJSON);
      }
    }

    // fc.features = fc.features.slice(1, 3);
    return featureCollection;
  }

  public getCurrentRoute(): Observable<FeatureCollection> {
    const features = this.wayPoints.features.sort((a: Feature, b: Feature) => {
      if (a.properties && b.properties) {
        return a.properties.order - b.properties.order;
      }
      return 1;
    });
    // console.log('getCurrentRoute(): features:', features);
    const locations = Array.from(features, (e: Feature) => (e.geometry as Point).coordinates);
    // console.log('extract locations for getCurrentRoute():', locations);
    const routeObs = this.dataService.getRoute('driving-car', locations);
    // console.log('route:', route);
    return routeObs.pipe(map(this.handleRoute));
  }

  public getCurrentWayPoints(): FeatureCollection {
    return this.wayPoints;
  }

  public setMap(map: Map): void {
    this.map = map;
  }
}
