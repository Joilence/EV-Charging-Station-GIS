import {Injectable} from '@angular/core';
import {Feature, FeatureCollection, LineString, Point} from 'geojson';
import {DataService} from './data.service';
import {Observable} from 'rxjs';
import {map} from 'rxjs/operators';
import {LatLng, LatLngExpression, Map, Polyline} from 'leaflet';
// @ts-ignore
import {extract} from './leaflet-geometryutil.js';
import {MapComponent} from '../map/map.component';

@Injectable({
  providedIn: 'root',
})
export class RoutingService {
  private map!: Map;
  private mapComponent!: MapComponent;

  constructor(private dataService: DataService) {
  }

  // departure, selected stations, destinations
  public wayPoints: FeatureCollection<Point> = {type: 'FeatureCollection', features: []};
  public numOfSelectedStations = 0;
  public maxRange = 300000;
  public startRange = 300000;
  public dangerBattery = 0.2;
  public amenityRange = 1000;
  public maxStationSearchRange = 30000;
  public fastCharge = false;
  public fastChargeAmount = 0.8;
  public departureTime = new Date().getTime();
  // in minutes
  public averageChargingTime = 45;

  public setMapComponent(mapComponent: MapComponent): void {
    this.mapComponent = mapComponent;
  }

  public addNewStation(station: Feature<Point>): void {
    if (station.properties) {
      station.properties.order = 1 + this.numOfSelectedStations++;

      let coordinates = Array.from(station.geometry.coordinates, e => parseFloat(String(e)));
      if (coordinates[1] < coordinates[0]) {
        coordinates = coordinates.reverse();
      }
      station.geometry.coordinates = coordinates;

      this.wayPoints.features.push(station);
    }
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
    let wholeRoute = null;
    try {
      wholeRoute = featureCollection.features[0] as Feature;
    } catch (e) {
      this.mapComponent.showSnackBar('Point out of Germany. You are not allowed to leave this country.', 2000);
      // @ts-ignore
      return null;
    }

    if (wholeRoute.properties) {
      wholeRoute.properties.type = 'Whole Route';
      const wholeRouteLine = new Polyline((wholeRoute.geometry as LineString).coordinates as LatLngExpression[]);
      const wholeRouteDistance = wholeRoute.properties.summary.distance;

      // danger segment (ds)
      let isDanger = false;
      const segments = wholeRoute.properties.segments;
      const lastSegmentDistance = segments[segments.length - 1].distance;
      if (lastSegmentDistance > maxRange * (1 - dangerBattery)) {
        isDanger = true;
        const previousSegmentsDistance = wholeRouteDistance - lastSegmentDistance;
        const dsStartDistance = previousSegmentsDistance + maxRange * (1 - dangerBattery);
        const dsEndDistance = previousSegmentsDistance + Math.min(maxRange, lastSegmentDistance);
        const dsStartPercent = dsStartDistance / wholeRouteDistance;
        const dsEndPercent = dsEndDistance / wholeRouteDistance;
        const dsCors = Array.from(extract(this.map, wholeRouteLine, dsStartPercent, dsEndPercent), (e: LatLng) => {
          return [e.lat, e.lng];
        });
        const dsLine = new Polyline(dsCors as LatLngExpression[]);
        const dsGeoJSON = dsLine.toGeoJSON();
        dsGeoJSON.geometry.coordinates = dsCors;
        dsGeoJSON.properties.type = 'Danger Segment';
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
    const locations = Array.from(features, (e: Feature<Point>) => e.geometry.coordinates);
    const routeObs = this.dataService.getRoute('driving-car', locations);
    if (this.wayPoints.features.length === 2) {
      return routeObs.pipe(map((routes) => this.handleRoute(routes, this.map, this.startRange, this.dangerBattery)));
    } else {
      return routeObs.pipe(map((routes) => this.handleRoute(routes, this.map, this.maxRange, this.dangerBattery)));
    }
  }

  public getCurrentWayPoints(): FeatureCollection<Point> {
    return this.wayPoints;
  }

  // tslint:disable-next-line:no-shadowed-variable
  public setMap(map: Map): void {
    this.map = map;
  }
}
