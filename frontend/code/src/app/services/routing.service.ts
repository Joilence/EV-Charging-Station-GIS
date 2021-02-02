import {Injectable} from '@angular/core';
import {Feature, FeatureCollection, LineString, Point} from 'geojson';
import {DataService} from './data.service';
import {Observable} from 'rxjs';
import {map} from 'rxjs/operators';
import {LatLng, LatLngExpression, Map, Polyline} from 'leaflet';
// @ts-ignore
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
  public wayPoints: FeatureCollection<Point> = {type: 'FeatureCollection', features: []};
  public numOfSelectedStations = 0;
  public maxRange = 300000;
  public startRange = 300000;
  public dangerBattery = 0.2;
  public amenityRange = 1000;
  public departureTime = new Date().getTime();

  public addNewStation(station: Feature<Point>): void {
    if (station.properties) {
      station.properties.order = 1 + this.numOfSelectedStations++;

      //TODO: [ugly fix]: [lat lng] of station are being changed strangely in map.component
      let coordinates = Array.from(station.geometry.coordinates, e => parseFloat(String(e)));
      if (coordinates[1] < coordinates[0]) {
        coordinates = coordinates.reverse();
      }
      station.geometry.coordinates = coordinates;
      // console.log('before add:', station.geometry.coordinates);

      this.wayPoints.features.push(station);
    }
    // console.log('new station added:', this.wayPoints);
  }

  public initDepDest(locations: FeatureCollection<Point>): void {
    locations.features.forEach((feature: Feature<Point>) => {
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

  public setDepartureTime(depTime: number): void {
    this.departureTime = depTime;
  }

  public updateSettings(amenityRange: number): void {
    this.amenityRange = amenityRange;
  }

  public handleRoute(featureCollection: FeatureCollection, map: Map, maxRange: number, dangerBattery: number): FeatureCollection {
    // console.log('handleRoute:', featureCollection);
    const wholeRoute = featureCollection.features[0] as Feature;

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
    const features = this.wayPoints.features.sort((a: Feature<Point>, b: Feature<Point>) => {
      if (a.properties && b.properties) {
        return a.properties.order - b.properties.order;
      }
      return 1;
    });
    // console.log('getCurrentRoute(): features:', features);
    const locations = Array.from(features, (e: Feature<Point>) => e.geometry.coordinates);
    // console.log('extract locations for getCurrentRoute():', locations);
    const routeObs = this.dataService.getRoute('driving-car', locations);
    // console.log('route:', route);
    return routeObs.pipe(map((routes) => this.handleRoute(routes, this.map, this.maxRange, this.dangerBattery)));
  }

  public getCurrentWayPoints(): FeatureCollection<Point> {
    return this.wayPoints;
  }

  // tslint:disable-next-line:no-shadowed-variable
  public setMap(map: Map): void {
    this.map = map;
  }
}
