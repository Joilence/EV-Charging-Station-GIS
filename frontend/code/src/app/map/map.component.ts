/// <reference types='leaflet-sidebar-v2' />
import {Component, EventEmitter, HostListener, Output} from '@angular/core';
import {Feature, FeatureCollection, Geometry, Point} from 'geojson';
import {
  Circle,
  GeoJSON,
  Icon,
  LatLng,
  latLng,
  LatLngTuple,
  Layer,
  LayerGroup,
  LeafletMouseEvent,
  Map,
  Marker,
  Popup,
  TileLayer
} from 'leaflet';
import 'leaflet.heat/dist/leaflet-heat';
import {RoutingService} from '../services/routing.service';
import {DataService} from '../services/data.service';
import {Observable} from 'rxjs';
import {MapService} from '../services/map.service';
import {SpinnerOverlayService} from '../services/spinner-overlay.service';
import 'd3';
import * as d3 from 'd3';
import '../../../node_modules/leaflet-fa-markers/L.Icon.FontAwesome';
// @ts-ignore
import {legend} from './d3-legend';

declare var L: any;

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.scss'],
})
export class MapComponent {

  constructor(private routingService: RoutingService, private mapService: MapService,
              private spinnerService: SpinnerOverlayService, private dataService: DataService) {
    this.mapService.setMapComponent(this);
  }

  /**
   *  #######################################################################
   *  ############################ Map & Layers #############################
   *  #######################################################################
   */

  @Output() map$: EventEmitter<Map> = new EventEmitter();
  public map!: Map;
  private routeLayerGroup: LayerGroup = new LayerGroup();
  private wayPointsLayerGroup: LayerGroup = new LayerGroup();
  private stationsLayerGroup: LayerGroup = new LayerGroup();
  private isochronesLayerGroup: LayerGroup = new LayerGroup();
  private restaurantsLayerGroup: LayerGroup = new LayerGroup();

  private layers: Layer[] = [];

  options = {
    layers: [
      new TileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      })
    ],
    zoom: 10,
    center: latLng(48.13, 8.20)
  };

  public isochronesCache: FeatureCollection | undefined;
  public stationsFeatureCollectionCache: FeatureCollection<Point> | undefined;
  public restaurantsOfStations: { [id: string]: Array<Feature>; } = {};

  public onMapReady(map: Map): void {
    this.map = map;
    this.map$.emit(map);
    this.routingService.setMap(this.map);
    this.routingService.maxRange = 300000;
    this.routingService.dangerBattery = 0.2;
    this.routingService.amenityRange = 1000;
    // console.log('map.com: set param to rs.');
    // some settings for a nice shadows, etc.
    const iconRetinaUrl = './assets/marker-icon-2x.png';
    const iconUrl = './assets/marker-icon.png';
    const shadowUrl = './assets/marker-shadow.png';
    Marker.prototype.options.icon = new Icon({
      iconRetinaUrl,
      iconUrl,
      shadowUrl,
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      tooltipAnchor: [16, -28],
      shadowSize: [41, 41],
    });
  }

  /**
   *  #######################################################################
   *  ########################### Exposed API ###############################
   *  #######################################################################
   */

  public initDepDest(initLocations: FeatureCollection<Point>): void {
    this.routingService.initDepDest(initLocations);
  }

  public initDepTime(time: number): void {
    this.routingService.setDepartureTime(time);
  }

  public updateSettings(isochroneMaxRange: number, amenityRange: number): void {
    this.routingService.updateSettings(isochroneMaxRange, amenityRange);
  }

  public route(): void {
    this.addRoutePath(this.routingService.getCurrentRoute());
    this.map.on('click', (e: LeafletMouseEvent) => {
      const popLocation = e.latlng;
      const wayPoints = this.routingService.getCurrentWayPoints().features;
      const lastWayPointLocation = wayPoints[wayPoints.length - 2].geometry.coordinates;
      // const lastWayPointLatLng = new LatLng(lastWayPointLocation[1], lastWayPointLocation[0])
      this.dataService.getRoute('driving-car',
        [lastWayPointLocation, [popLocation.lng, popLocation.lat]])
        .subscribe((route: FeatureCollection) => {
          console.log('route of click and departure:', route);
          // TODO: danger segments not accurate
          // tslint:disable-next-line:no-non-null-assertion
          const distance = route.features[0].properties!.summary.distance * 0.9;
          if (distance >= this.routingService.maxRange) {
            new Popup()
              .setLatLng(popLocation)
              .setContent(`Sorry. Too far away, not reachable.<br /> distance from last point ${distance}`)
              .openOn(this.map);
          } else {
            // TODO: decide max isochrones for searching stations
            this.selectDropPoint([popLocation.lng, popLocation.lat], Math.min(this.routingService.maxRange - distance, 20000));
          }
        });
    });
  }

  public setMaxRange(maxRange: number): void {
    this.routingService.maxRange = maxRange;
  }

  public setAmenityRange(range: number): void {
    this.routingService.amenityRange = range;
  }

  public selectDropPoint(location: LatLngTuple, range: number): void {
    // TODO: Check if the location is reachable
    this.removeAllStations();
    this.removeAllIsochrones();
    this.removeAllRestaurants();
    this.cleanCache();
    this.spinnerService.show('searching for stations...');
    this.dataService.getIsochrones([location], 'distance', [range]).subscribe((isochrones: FeatureCollection) => {
      this.isochronesCache = isochrones;
      this.addIsochrones(isochrones);
    });
    // this.dataService.getStations([location], [range]).subscribe((stations: FeatureCollection) => {
    //   this.addStations(stations);
    // });
    this.dataService.getStationsScore([location], [range], this.routingService.amenityRange)
      .subscribe((stations: FeatureCollection<Point>) => {
        // TODO: Alert when no stations found.
        if (stations.features.length === 0) {
          new Popup()
            .setLatLng([location[1], location[0]])
            .setContent('<p>Sorry, there is no station T_T</p>')
            .openOn(this.map);
          this.spinnerService.hide();
        } else {
          this.spinnerService.hide();
          console.log('hide spinner');
          this.stationsFeatureCollectionCache = stations;
          this.addStations(stations);
          // console.log('caching stations: original:', stations);
          // console.log('caching stations: cache:', this.stationsFeatureCollectionCache);
          // console.log('caching stations: cache as FeatureCollection:', this.stationsFeatureCollectionCache as FeatureCollection);
          this.updateRestaurantCache(stations);
        }
      });
  }

  public showRestaurantsOfStation(station: Feature<Point>): void {
    this.addRestaurants(station, this.routingService.amenityRange);
  }

  public returnToSeeStations(): void {
    this.removeAllRestaurants();
    this.addStations(this.stationsFeatureCollectionCache as FeatureCollection<Point>);
    this.addIsochrones(this.isochronesCache as FeatureCollection);
  }

  public selectStation(station: Feature<Point>): void {
    // console.log('selectStation: add station to selection:', station);
    this.routingService.addNewStation(station);
    this.route();
  }

  /**
   *  #######################################################################
   *  ############################### Routes ################################
   *  #######################################################################
   */

  public addRoutePath(routeObs: Observable<FeatureCollection>): void {
    routeObs.subscribe((route: FeatureCollection) => {
      // console.log('addRoutePath: processed route', route);

      const styles = (feature: any) => {
        // console.log(feature);
        switch (feature.properties.type) {
          case 'Whole Route':
            return {
              color: '#000000',
              weight: 8,
              opacity: 0.2
            };

          case 'Danger Segment':
            return {
              color: '#ff7800',
              weight: 5,
              opacity: 0.65
            };

          case 'Safe Segment':
            return {
              color: '#03fc94',
              weight: 5,
              opacity: 0.65
            };

          default:
            return {
              color: '#ff7800',
              weight: 5,
              opacity: 0.65
            };
        }
      };
      const routeGeoJSON = new GeoJSON(route, {
        style: styles,
      });
      this.removeAllStations();
      this.removeAllIsochrones();
      this.removeAllRestaurants();
      this.updateRouteLayer(routeGeoJSON);
    });
  }

  public updateRouteLayer(routeGeoJSON: GeoJSON): void {
    this.map.removeLayer(this.routeLayerGroup);
    this.routeLayerGroup = new LayerGroup();
    routeGeoJSON.addTo(this.routeLayerGroup);
    this.routeLayerGroup.addTo(this.map);
    this.map.fitBounds(routeGeoJSON.getBounds(), {padding: [50, 50]});
    this.addWayPoints(this.routingService.getCurrentWayPoints());
  }

  /**
   *  #######################################################################
   *  ############################# Isochrones ##############################
   *  #######################################################################
   */

  public addIsochrones(isochrones: FeatureCollection): void {
    // console.log('addIsochrones:', isochrones);
    const isochronesJSON = new GeoJSON(isochrones);
    this.updateIsochronesLayer(isochronesJSON);
  }

  public updateIsochronesLayer(isochronesJSON: GeoJSON | undefined): void {
    if (isochronesJSON) {
      // console.log('update isochrones');
      this.map.removeLayer(this.isochronesLayerGroup);
      this.isochronesLayerGroup = new LayerGroup();
      isochronesJSON.addTo(this.isochronesLayerGroup);
      this.isochronesLayerGroup.addTo(this.map);
      this.map.fitBounds(isochronesJSON.getBounds(), {padding: [100, 100]});
    } else {
      // console.log('remove isochrones');
      this.map.removeLayer(this.isochronesLayerGroup);
      this.isochronesLayerGroup = new LayerGroup();
    }
  }

  public removeAllIsochrones(): void {
    this.updateIsochronesLayer(undefined);
  }

  /**
   *  #######################################################################
   *  ############################## Stations ###############################
   *  #######################################################################
   */

  public getStationFeatureByID(stationID: number): Feature<Point> | undefined {
    // console.log('looking for stations by id:', this.stationsFeatureCollectionCache);
    for (const station of (this.stationsFeatureCollectionCache as FeatureCollection<Point>).features) {
      // console.log('check:', station.id as number);
      if (station.id as number === stationID) {
        // console.log(station);
        // console.log(station as Feature);
        return station;
      }
    }
    // TODO: correctly handle exception instead of using `undefined`
    console.log(`cannot find station ${stationID} in`, this.stationsFeatureCollectionCache);
    return undefined;
  }

  public addStations(stations: FeatureCollection<Point>): void {
    console.log('addStations:', stations);

    // TODO: [ugly fix]: [lat lng] of station are being changed strangely in map.component
    for (const station of stations.features) {
      let coordinates = station.geometry.coordinates;
      coordinates = Array.from(coordinates, e => parseFloat(String(e)));
      if (coordinates[0] > coordinates[1]) {
        coordinates = coordinates.reverse();
      }
      station.geometry.coordinates = coordinates as LatLngTuple;
    }

    if (!stations) {
      return;
    }
    const onEachFeature = (feature: Feature<Geometry, any>, layer: L.Layer) => {
      const popupHtml = `
        <div>${feature.properties.type}: ${feature.properties.address}; ${feature.id}<br/>
            <button id="1-${feature.id}" type="button" class="text-center w-100 mt-3 btn btn-secondary station-selected-click">
                    Select station
            </button>
            <button id="2-${feature.id}" type="button" class="text-center w-100 mt-2 btn btn-secondary station-show-restaurant-click">
                    Show restaurants
            </button>
        </div>`;
      layer.bindPopup(popupHtml);
    };

    const maxValue = d3.max(stations.features, (station) => {
      if (!station.properties) {
        return 0;
      }
      return station.properties.score;
    });
    // Use a linear scaling.
    const scale = d3.scaleLinear().domain([0, maxValue]);

    const node = legend({
      color: d3.scaleSequential([0, maxValue], d3.interpolateRgb('blue', 'green')),
      title: 'Station score'
    });
    // @ts-ignore
    document.getElementById('legend-stations').innerHTML = '';
    // @ts-ignore
    document.getElementById('legend-stations').append(node);

    const colorScaleLog = d3.scaleSequential((d) => d3.interpolateRgb('blue', 'green')(scale(d)));

    const stationsGeoJSON = new GeoJSON(stations, {
      onEachFeature, pointToLayer(geoJsonPoint: Feature<Point, any>, latlng: LatLng): Layer {
        const icon = new L.icon.fontAwesome({
          iconClasses: 'fa fa-charging-station',
          markerColor: colorScaleLog(geoJsonPoint.properties.score),
          markerFillOpacity: 0.6,
          markerStrokeWidth: 2,
          markerStrokeColor: 'grey',
          // icon style
          iconColor: '#FFF'
        });
        return new Marker(latlng, {icon});
      }
    });
    this.updateStationsLayer(stationsGeoJSON);
  }

  public updateStationsLayer(stationsGeoJSON: GeoJSON | undefined): void {
    if (stationsGeoJSON) {
      // console.log('add stations markers');
      this.map.removeLayer(this.stationsLayerGroup);
      this.stationsLayerGroup = new LayerGroup();
      stationsGeoJSON.addTo(this.stationsLayerGroup);
      this.stationsLayerGroup.addTo(this.map);
    } else {
      // console.log('remove all stations markers');
      this.map.removeLayer(this.stationsLayerGroup);
      this.stationsLayerGroup = new LayerGroup();
    }
  }

  public removeAllStations(): void {
    this.updateStationsLayer(undefined);
  }

  @HostListener('document:click', ['$event'])
  public popupClicked(event: any): void {
    if (event.target.classList.contains('station-selected-click')) {
      const stationId = parseInt(event.target.id.substr(2), 10);
      this.selectStation(this.getStationFeatureByID(stationId) as Feature<Point>);
      console.log(`clicked select ${stationId}`);
      return;
    }
    if (event.target.classList.contains('station-show-restaurant-click')) {
      const stationId = parseInt(event.target.id.substr(2), 10);
      this.addRestaurantsByStationID(stationId);
      console.log(`clicked show restaurants of ${stationId}`);
      return;
    }
    if (event.target.classList.contains('station-show-all-click')) {
      // const stationId = parseInt(event.target.id.substr(2), 10);
      // this.addRestaurantsByStationID(stationId);
      this.returnToSeeStations();
      console.log(`clicked and return to see all stations`);
      return;
    }
  }

  /**
   *  #######################################################################
   *  ############################# Restaurants #############################
   *  #######################################################################
   */

  public addRestaurantsByStationID(stationID: number): void {
    this.addRestaurants(this.getStationFeatureByID(stationID) as Feature<Point>, this.routingService.amenityRange);
  }

  public addRestaurants(station: Feature<Point>, amenityRange: number): void {
    this.removeAllStations();
    this.removeAllIsochrones();

    const onEachFeature = (feature: Feature<Geometry, any>, layer: Layer) => {
      layer.bindPopup(`${JSON.stringify(feature.properties, null, 2)}`);
      // TODO on click
    };

    if (this.restaurantsOfStations && station.id && station.properties && station.geometry.coordinates) {
      // console.log('add restaurants to:', station.id);
      const restaurants: FeatureCollection = {
        type: 'FeatureCollection',
        features: this.restaurantsOfStations[station.id as string] as Array<Feature>
      };
      // console.log(restaurants);
      if (restaurants.features === undefined) {
        return;
      }
      const restaurantsGeoJSON = new GeoJSON(restaurants, {
        onEachFeature, pointToLayer(geoJsonPoint: Feature, latlng: LatLng): Layer {
          let color = 'black';
          if (geoJsonPoint.properties && geoJsonPoint.properties.rating && geoJsonPoint.properties.rating > 0) {
            color = 'yellow';
          }
          const icon = new L.icon.fontAwesome({
            iconClasses: 'fa fa-utensils',
            markerColor: color,
            markerFillOpacity: 0.6,
            markerStrokeWidth: 2,
            markerStrokeColor: 'grey',
            // icon style
            iconColor: '#FFF'
          });
          return new Marker(latlng, {icon});
        }
      });

      const popupHtml = `
        <div>${station.properties.type}: ${station.properties.address}; ${station.id}<br/>
            <button id="1-${station.id}" type="button" class="text-center w-100 mt-3 btn btn-secondary station-selected-click">
                    Select station
            </button>
            <button id="2-${station.id}" type="button" class="text-center w-100 mt-2 btn btn-secondary station-show-all-click">
                    Return to see all stations
            </button>
        </div>`;
      const stationGeoJSON = new GeoJSON(station).bindPopup(popupHtml);

      this.updateRestaurantsLayer(restaurantsGeoJSON, stationGeoJSON, station.geometry.coordinates.reverse() as LatLngTuple, amenityRange);
    }
  }

  public updateRestaurantsLayer(restaurantsGeoJSON: GeoJSON | undefined, stationGeoJSON: GeoJSON, coordinate: LatLngTuple,
                                amenityRange: number): void {
    if (restaurantsGeoJSON) {
      this.map.removeLayer(this.restaurantsLayerGroup);
      this.restaurantsLayerGroup = new LayerGroup();
      restaurantsGeoJSON.addTo(this.restaurantsLayerGroup);

      // Add amenity circle based on amenity range
      const amenityCircle = new Circle(coordinate, {radius: amenityRange});
      amenityCircle.addTo(this.restaurantsLayerGroup);
      // Add the center - station
      stationGeoJSON.addTo(this.restaurantsLayerGroup);

      this.restaurantsLayerGroup.addTo(this.map);
      this.map.fitBounds(amenityCircle.getBounds(), {padding: [100, 100]});
    } else {
      this.map.removeLayer(this.restaurantsLayerGroup);
      this.restaurantsLayerGroup = new LayerGroup();
    }
  }

  public removeAllRestaurants(): void {
    this.updateRestaurantsLayer(undefined, new GeoJSON(), [0, 0], NaN);
  }


  /**
   *  #######################################################################
   *  ############################# Way Points ##############################
   *  #######################################################################
   */

  public addWayPoints(wayPoints: FeatureCollection): void {
    console.log('add way points:', wayPoints);
    const onEachFeature = (feature: Feature<Geometry, any>, layer: Layer) => {
      layer.bindPopup(`${feature.properties.type}: ${feature.properties.name}`);
    };
    const wayPointsGeoJSON = new GeoJSON(wayPoints, {
      onEachFeature,
    });
    this.updateWayPointsLayer(wayPointsGeoJSON);
  }

  public updateWayPointsLayer(wayPointsGeoJSON: GeoJSON | undefined): void {
    if (wayPointsGeoJSON) {
      this.map.removeLayer(this.wayPointsLayerGroup);
      this.wayPointsLayerGroup = new LayerGroup();
      wayPointsGeoJSON.addTo(this.wayPointsLayerGroup);
      this.wayPointsLayerGroup.addTo(this.map);
    } else {
      this.map.removeLayer(this.wayPointsLayerGroup);
      this.wayPointsLayerGroup = new LayerGroup();
    }
  }

  public removeAllWayPoints(): void {
    this.updateWayPointsLayer(undefined);
  }

  public addStationsHeat(radius: number, maxZoom: number): void {
    this.spinnerService.show('Loading heat map...');
    this.mapService.parseStations(radius, maxZoom);
  }

  public addHeatMapLayer(data: any[], clearMap: boolean = false, radius: number, maxZoom: number): void {
    if (clearMap) {
      this.clearMap();
    }
    this.removeLayers();
    const heatMapLayer = L.heatLayer(data, {
      radius,
      gradient: {0.0: 'blue', 0.65: 'lime', 1.0: 'red'},
      blur: 15,
      maxZoom
    });
    this.layers.push(heatMapLayer);
    this.map.addLayer(heatMapLayer);
    this.spinnerService.hide();
  }

  public removeLayers(): void {
    for (const layer of this.layers) {
      this.map.removeLayer(layer);
    }
    this.layers = [];
  }

  public clearMap(): void {
    this.removeAllIsochrones();
    this.removeAllStations();
    this.removeAllWayPoints();
    this.removeLayers();
    this.map.off('click');
    this.map.removeLayer(this.routeLayerGroup);
  }

  /**
   *  #######################################################################
   *  ################################ Cache ################################
   *  #######################################################################
   */

  public cleanCache(): void {
    console.log('cache clear.');
    this.isochronesCache = undefined;
    this.stationsFeatureCollectionCache = undefined;
    this.restaurantsOfStations = {};
  }

  public updateRestaurantCache(stations: FeatureCollection<Point>): void {
    this.restaurantsOfStations = {};
    // console.log(stations);
    for (const station of stations.features) {
      if (station.properties && station.properties.closeRestaurants && station.id) {
        this.restaurantsOfStations[station.id] = station.properties.closeRestaurants;
      }
    }
  }
}
