import {Injectable} from '@angular/core';
import {HttpClient, HttpHeaders} from '@angular/common/http';
import {Observable} from 'rxjs';
import {FeatureCollection, Geometry} from 'geojson';
import { Polygon } from '@turf/turf';

const httpOptions = {
  headers: new HttpHeaders({
    'Content-Type': 'application/json',
  }),
};

/**
 * Dataservice responsible to call our backend to retrieve routing and database information.
 */
@Injectable({
  providedIn: 'root',
})
export class DataService {
  constructor(private http: HttpClient) {
  }

  private baseUrl = 'http://localhost:5000/';

  public getBarDistribution(): Observable<FeatureCollection> {
    const url = this.baseUrl + 'numbars';
    return this.http.post<FeatureCollection>(url, {}, httpOptions);
  }

  public getDistance(geom1: Geometry, geom2: Geometry): Observable<string> {
    const url = this.baseUrl + 'distance';
    return this.http.post<string>(url, {geom1, geom2}, httpOptions);
  }

  public getStations(locations: number[][], range: number[]): Observable<any> {
    const url = this.baseUrl + 'stations';
    return this.http.post<any>(url, {locations, range}, httpOptions);
  }

  public getStationsScore(locations: number[][], stationRange: number[], amenityRange: number): Observable<any> {
    const url = this.baseUrl + 'stations-score';
    return this.http.post<any>(url, {locations, stationRange, amenityRange}, httpOptions);
  }

  public getRestaurants(station: string, distance: string): Observable<any> {
    const url = this.baseUrl + 'restaurants';
    return this.http.post<any>(url, {station, distance}, httpOptions);
  }

  public getRoute(profile: string, coordinates: number[][]): Observable<FeatureCollection> {
    const url = this.baseUrl + 'route';
    return this.http.post<any>(url, {profile, coordinates}, httpOptions);
  }

  public getIsochrones(locations: number[][], rangeType: string, range: number[]): Observable<FeatureCollection<Polygon>> {
    const url = this.baseUrl + 'isochrones';
    return this.http.post<any>(url, {locations, 'range_type': rangeType, range}, httpOptions);
  }

  public getAllStations(): Observable<any> {
    const url = this.baseUrl + 'stations/all';
    return this.http.get<any>(url, httpOptions);
  }
}
