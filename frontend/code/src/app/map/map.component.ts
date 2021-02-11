/// <reference types='leaflet-sidebar-v2' />
import {Component, EventEmitter, HostListener, Input, NgZone, Output} from '@angular/core';
import {Feature, FeatureCollection, Geometry, Point} from 'geojson';
import {Circle, GeoJSON, Icon, LatLng, latLng, LatLngTuple, Layer, LayerGroup, LeafletMouseEvent, Map, Marker, TileLayer} from 'leaflet';
import 'leaflet.heat/dist/leaflet-heat';
import {RoutingService} from '../services/routing.service';
import {DataService} from '../services/data.service';
import {MapService} from '../services/map.service';
import {SpinnerOverlayService} from '../services/spinner-overlay.service';
import {Observable, Subscription} from 'rxjs';
import 'd3';
import * as d3 from 'd3';
import '../../../node_modules/leaflet-fa-markers/L.Icon.FontAwesome';
// @ts-ignore
import {legend} from './d3-legend';
// import {booleanContains, Polygon} from '@turf/turf';
import * as turf from '@turf/turf';
import {Polygon} from '@turf/turf';
import {MatSnackBar} from '@angular/material/snack-bar';
import '../../../node_modules/leaflet.markercluster/dist/leaflet.markercluster';
import {StorageMap} from '@ngx-pwa/local-storage';
import {MatDialog} from '@angular/material/dialog';
import {DialogComponent} from '../dialog/dialog.component';

declare var L: any;

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.scss'],
})


export class MapComponent {

  constructor(private routingService: RoutingService, private mapService: MapService,
              private spinnerService: SpinnerOverlayService, private dataService: DataService,
              private snackBarRef: MatSnackBar, private zone: NgZone, private localStorage: StorageMap, public dialog: MatDialog) {
    this.mapService.setMapComponent(this);
    this.routingService.setMapComponent(this);
    this.showFeat = false;
  }

  @Input() showFeat: boolean;

  /**
   *  #######################################################################
   *  ############################ Map & Layers #############################
   *  #######################################################################
   */

  @Output() map$: EventEmitter<Map> = new EventEmitter();
  public map!: Map;

  // Route Layers
  private routeLayerGroup: LayerGroup = new LayerGroup();
  private wayPointsLayerGroup: LayerGroup = new LayerGroup();
  private stationsLayerGroup: LayerGroup = new LayerGroup();
  private isochronesLayerGroup: LayerGroup = new LayerGroup();
  private restaurantsLayerGroup: LayerGroup = new LayerGroup();
  private timeLayer: LayerGroup = new LayerGroup();

  private layers: Layer[] = [];

  private destinationMarker!: Layer;
  private departureMarker!: Layer;

  private stationMarkers!: Array<Layer>;

  // Hove Members
  private hoverCircle?: Circle;
  private hoverEffect?: LayerGroup;
  private hoverTimeout = 500;
  private hoverThread?: ReturnType<typeof setTimeout>;
  private hoverSubscriptionRoute?: Subscription;
  private hoverSubscriptionIsochrone?: Subscription;

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

  // Cache
  public isochronesCache?: FeatureCollection<Polygon>;
  public stationsFeatureCollectionCache?: FeatureCollection<Point>;
  public restaurantsOfStations: { [id: string]: Array<Feature>; } = {};

  private isochroneMaxRange = 20000;
  private timeLayerAdded = false;
  private timeLayerShouldAdd = true;

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

  public updateSettings(isochroneMaxRange: number, amenityRange: number, fastChargeAmount: number): void {
    this.routingService.updateSettings(amenityRange);
    this.isochroneMaxRange = isochroneMaxRange;
    this.routingService.fastChargeAmount = fastChargeAmount;
  }

  public route(): void {
    this.map.off('click');
    this.map.off('mousemove');
    this.clearHover();
    this.addRoutePath(this.routingService.getCurrentRoute());
  }

  public setMaxRange(maxRange: number): void {
    this.routingService.maxRange = maxRange;
  }

  public setStartRange(range: number): void {
    this.routingService.startRange = range;
  }

  public setFastChargeAmount(amount: number): void {
    this.routingService.fastChargeAmount = amount;
  }

  public setMaxStationSearchRange(range: number): void {
    this.routingService.maxStationSearchRange = range;
  }

  public selectDropPoint(location: LatLngTuple, range: number): void {
    // TODO: Check if the location is reachable
    this.removeAllStations();
    this.removeAllIsochrones();
    this.removeAllRestaurants();
    this.cleanCache();
    this.clearHover();
    this.spinnerService.show('searching for stations...');
    this.dataService.getIsochrones([location], 'distance', [range]).subscribe((isochrones: FeatureCollection<Polygon>) => {
      this.isochronesCache = isochrones;
      this.addIsochrones(isochrones);
    });
    // this.dataService.getStations([location], [range]).subscribe((stations: FeatureCollection) => {
    //   this.addStations(stations);
    // });
    this.dataService.getStationsScore([location], [range], this.routingService.amenityRange)
      .subscribe((stations: FeatureCollection<Point>) => {
        if (stations.features.length === 0) {
          this.spinnerService.hide();
          this.showSnackBar('🤯 Sorry, there is no station. Please choose another area.', 3000);
        } else {
          this.spinnerService.hide();
          this.stationsFeatureCollectionCache = stations;
          this.addStations(stations);
          // console.log('caching stations: original:', stations);
          // console.log('caching stations: cache:', this.stationsFeatureCollectionCache);
          // console.log('caching stations: cache as FeatureCollection:', this.stationsFeatureCollectionCache as FeatureCollection);
          this.updateRestaurantCache(stations);

          this.localStorage.get('station-hint').subscribe((stationHint) => {
            console.log(stationHint);
            if (stationHint === undefined) {
              this.showStationHintDialog();
            }
            this.localStorage.has('station-hint').subscribe((stationHint) => {
              if (!stationHint) {
                this.localStorage.set('station-hint', true).subscribe();
              }
            });
          });
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
    this.localStorage.get('reroute-hint').subscribe((rerouteHint) => {
      console.log(rerouteHint);
      if (rerouteHint === undefined) {
        this.showReRouteHintDialog();
      }
      this.localStorage.has('reroute-hint').subscribe((rerouteHint) => {
        if (!rerouteHint) {
          this.localStorage.set('reroute-hint', true).subscribe();
        }
      });
    });
  }

  /**
   *  #######################################################################
   *  ############################### Routes ################################
   *  #######################################################################
   */

  public bindInteractiveMapEventListener(): void {
    const wayPoints = this.routingService.getCurrentWayPoints().features;
    const lastWayPointLocation = wayPoints[wayPoints.length - 2].geometry.coordinates;
    this.map.on('click', (e: LeafletMouseEvent) => {
      const loc = e.latlng;
      if (this.isInCurrentIsochrone(loc.lng, loc.lat)) {
        return;
      }

      this.clearHover();
      // const lastWayPointLatLng = new LatLng(lastWayPointLocation[1], lastWayPointLocation[0])
      this.dataService.getRoute('driving-car', [lastWayPointLocation, [loc.lng, loc.lat]]).subscribe((route: FeatureCollection) => {
        console.log('route of click and departure:', route);
        // TODO: danger segments not accurate
        const distance = route.features[0].properties!.summary.distance;
        console.log('Distance to last way point:', distance);
        const maxDistance = this.currentMaxDistance();
        if (distance >= maxDistance) {
          this.showSnackBar(`😰 Sorry, too far away and not reachable. Please select a closer point.`, 2000);
        } else {
          console.log('initial search range:', maxDistance - distance);
          console.log('max search range:', this.routingService.maxStationSearchRange);
          this.selectDropPoint([loc.lng, loc.lat],
            Math.min(maxDistance - distance,
              this.routingService.maxStationSearchRange));
        }
      });
    });

    this.map.on('mousemove', (e: LeafletMouseEvent) => {
      const loc = e.latlng;

      // clear last hover state
      this.clearHover();

      if (this.isInCurrentIsochrone(loc.lng, loc.lat)) {
        return;
      }

      // start count again
      this.hoverThread = setTimeout(() => {
        const loc = e.latlng;
        console.log('stop at:', e.latlng);
        this.hoverSubscriptionRoute = this.dataService.getRoute('driving-car', [lastWayPointLocation, [loc.lng, loc.lat]])
          .subscribe((route: FeatureCollection) => {
            if (this.hoverCircle) {
              this.map.removeLayer(this.hoverCircle);
            }
            if (this.hoverEffect) {
              this.map.removeLayer(this.hoverEffect);
            }
            // console.log('route of click and departure:', route);
            // TODO: danger segments not accurate

            const distance = route.features[0].properties!.summary.distance;
            const maxDistance = this.currentMaxDistance();
            if (distance <= maxDistance) {
              const restDistance = Math.min(maxDistance - distance, this.routingService.maxStationSearchRange);

              // Option 1: show circle
              // const metresPerPixel = 40075016.686 * Math.abs(Math.cos(this.map.getCenter().lat * Math.PI/180)) / Math.pow(2, this.map.getZoom()+8);
              // const r = restDistance / metresPerPixel;
              // this.hoverCircle = new Circle(loc, {radius: r*200}).addTo(this.map);

              // Option 2: show isochrone
              this.dataService.getIsochrones([[loc.lng, loc.lat]], 'distance', [restDistance]).subscribe((isochrones: FeatureCollection<Polygon>) => {
                this.hoverEffect = new LayerGroup();

                const isochronesJSON = new GeoJSON(isochrones);
                isochronesJSON.addTo(this.hoverEffect);
                // Option 3: show route
                const routeGeoJSON = new GeoJSON(route, {
                  style: {
                    color: '#000000',
                    weight: 8,
                    opacity: 0.2
                  },
                });
                routeGeoJSON.addTo(this.hoverEffect);

                this.hoverEffect.addTo(this.map);

                this.localStorage.get('hover-hint').subscribe((hoverHint) => {
                  console.log(hoverHint);
                  if (hoverHint === undefined) {
                    this.showHoverHintDialog();
                  }
                  this.localStorage.has('hover-hint').subscribe((hoverHint) => {
                    if (!hoverHint) {
                      this.localStorage.set('hover-hint', true).subscribe();
                    }
                  });
                });
              });
            } else {
              this.showSnackBar(`😰 Sorry, too far away and not reachable. Please select a closer point.`, 3000);
            }
          });
      }, this.hoverTimeout);
    });
  }

  public unbindInteractiveMapEventListener(): void {
    this.map.off('click');
    this.map.off('mousemove');
  }

  public addRoutePath(routeObs: Observable<FeatureCollection>): void {
    routeObs.subscribe((route: FeatureCollection) => {
      // console.log('addRoutePath: processed route', route);
      let isDanger = false;
      for (const path of route.features) {
        if (path.properties!.type === 'Danger Segment') {
          isDanger = true;
        }
      }

      if (!isDanger) {
        this.showReachHintDialog();
      } else {
        this.bindInteractiveMapEventListener();
      }

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

      this.localStorage.get('route-hint').subscribe((routeHint) => {
        console.log(routeHint);
        if (routeHint === undefined) {
          this.showRouteHintDialog();
        }
        this.localStorage.has('route-hint').subscribe((routeHint) => {
          if (!routeHint) {
            this.localStorage.set('route-hint', true).subscribe();
          }
        });
      });

      this.removeAllStations();
      this.removeAllIsochrones();
      this.removeAllRestaurants();
      this.stationMarkers = new Array<Layer>();
      this.updateRouteLayer(routeGeoJSON);
      this.addTimeLayer(route);
    });
  }

  public updateRouteLayer(routeGeoJSON: GeoJSON): void {
    this.map.removeLayer(this.routeLayerGroup);
    this.routeLayerGroup = new LayerGroup();
    routeGeoJSON.addTo(this.routeLayerGroup);
    this.routeLayerGroup.addTo(this.map);
    try {
      this.map.fitBounds(routeGeoJSON.getBounds(), {padding: [50, 50]});
    } catch (e) {
      this.clearMap();
      return;
    }
    this.addWayPoints(this.routingService.getCurrentWayPoints());
  }

  private clearHover(): void {
    if (this.hoverThread) {
      clearTimeout(this.hoverThread);
    }
    if (this.hoverCircle) {
      this.map.removeLayer(this.hoverCircle);
      this.hoverCircle = undefined;
    }
    if (this.hoverEffect) {
      this.map.removeLayer(this.hoverEffect);
      this.hoverEffect = undefined;
    }
    if (this.hoverSubscriptionIsochrone) {
      this.hoverSubscriptionIsochrone.unsubscribe();
    }
    if (this.hoverSubscriptionRoute) {
      this.hoverSubscriptionRoute.unsubscribe();
    }
  }

  private currentMaxDistance(): number {
    if (this.routingService.wayPoints.features.length === 2) {
      return this.routingService.startRange;
    } else {
      return this.routingService.maxRange;
    }
  }

  private addTimeLayer(route: FeatureCollection | undefined): void {
    if (route) {
      this.map.removeLayer(this.timeLayer);
      this.timeLayer = new L.markerClusterGroup();

      const routeDetails = route.features[0];

      // in seconds
      // @ts-ignore
      const totalDuration = routeDetails.properties.summary.duration + routeDetails.properties.segments.length *
        this.routingService.averageChargingTime * 60;
      // in meter
      // @ts-ignore
      const totalDistance = routeDetails.properties.summary.distance;

      let currentDuration = 0;
      let currentDistance = 0;
      let timeStep = 1;

      // @ts-ignore
      const wayPoints = route.features[0].geometry.coordinates;

      const icon = new L.icon.fontAwesome({
        iconClasses: 'fa fa-clock',
        markerColor: 'grey',
        markerFillOpacity: 0.3,
        markerStrokeWidth: 1,
        markerStrokeColor: 'grey',
        // icon style
        iconColor: '#FFF'
      });
      // @ts-ignore
      for (let j = 0; j < routeDetails.properties.segments.length; j++) {
        // @ts-ignore
        const segment = routeDetails.properties.segments[j];
        // @ts-ignore
        for (let i = 0; i < segment.steps.length; i++) {
          currentDuration += segment.steps[i].duration;
          currentDistance += segment.steps[i].distance;
          if (i === 0 && j === 0) {
            this.departureMarker.bindTooltip(`Departure Time:
            ${new Date(this.routingService.departureTime).toTimeString()}`, {offset: [0, 0]});
            continue;
          }
          // @ts-ignore
          if (i === segment.steps.length - 1 && j === routeDetails.properties.segments.length - 1) {
            this.destinationMarker.bindTooltip(`Time: ${new Date(this.routingService.departureTime + totalDuration * 1000).toTimeString()}<br/>
          Travel time: ${this.getTimeFromMins(totalDuration / 60)}<br/>
          Distance: ${this.formatDistance(totalDistance / 1000)} km`, {offset: [0, 0]});
            continue;
          }
          if (i === segment.steps.length - 1) {
            this.stationMarkers[j].bindTooltip(`Time: ${new Date(this.routingService.departureTime + currentDuration * 1000).toTimeString()}<br/>
          Travel time: ${this.getTimeFromMins(currentDuration / 60)}<br/>
          Distance: ${this.formatDistance(currentDistance / 1000)} km`, {offset: [0, 0]});
            if (currentDuration + this.routingService.averageChargingTime * 60 > timeStep * 3600) {
              timeStep++;
            }
            continue;
          }
          // Add a marker. Better overestimate time than underestimate.
          if (currentDuration > timeStep * 3600) {
            const startWayPoint = segment.steps[i].way_points[0];
            const wayPoint = wayPoints[startWayPoint];
            const marker = new Marker([wayPoint[1], wayPoint[0]], {opacity: 0.5, icon});
            marker.bindTooltip(`Time: ${new Date(this.routingService.departureTime + currentDuration * 1000).toTimeString()}<br/>
          Travel time: ${this.getTimeFromMins(currentDuration / 60)} hour(s)<br/>
          Distance: ${this.formatDistance(currentDistance / 1000)} km`, {offset: [0, 0]});

            this.timeLayer.addLayer(marker);
            timeStep++;
          }
        }
        currentDuration += this.routingService.averageChargingTime * 60;
      }

      if (this.timeLayerShouldAdd) {
        this.timeLayer.addTo(this.map);
        this.timeLayerAdded = true;
      }
    } else {
      this.map.removeLayer(this.timeLayer);
      this.timeLayer = new L.markerClusterGroup();
    }
  }

  private formatDistance(value: number): number {
    // tslint:disable-next-line:no-bitwise
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private zeroPad = (num: number, places: number) => String(num).padStart(places, '0');

  private getTimeFromMins(mins: number): string {
    // tslint:disable-next-line:no-bitwise
    const h = mins / 60 | 0;
    // tslint:disable-next-line:no-bitwise
    const m = mins % 60 | 0;
    return this.zeroPad(h, 2) + 'h ' + this.zeroPad(m, 2) + 'min';
  }

  public toggleTimeLayer(): void {
    if (this.timeLayerShouldAdd) {
      this.timeLayerShouldAdd = false;
      if (this.timeLayerAdded) {
        this.timeLayer.removeFrom(this.map);
        this.timeLayerAdded = false;
      }
    } else {
      this.timeLayerShouldAdd = true;
      if (!this.timeLayerAdded) {
        this.timeLayer.addTo(this.map);
        this.timeLayerAdded = true;
      }
    }
  }

  public changeAvgChargingTime(time: number): void {
    this.routingService.averageChargingTime = time;
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

  public isInCurrentIsochrone(lng: number, lat: number): boolean {
    if (this.isochronesCache) {
      const polygon = turf.polygon(this.isochronesCache.features[0].geometry.coordinates);
      const point = turf.point([lng, lat]);
      if (turf.booleanContains(polygon, point)) {
        console.log('inside isochrones');
        return true;
      }
    }
    return false;
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
      // tslint:disable-next-line:triple-equals
      if (station.id as number == stationID) {
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
          Charge Type: ${feature.properties.chargeType}<br/>
            <button id="1-${feature.id}" type="button" class="text-center w-100 mt-3 btn btn-secondary station-selected-click">
                    Select station (full charge)
            </button>
            <button id="3-${feature.id}" type="button" class="text-center w-100 mt-2 btn btn-secondary station-selected-click">
                    Select station (fast charge)
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

  public showSnackBar(message: string, duration: number): void {
    this.zone.run(() => {
      this.snackBarRef.open(message, undefined, {duration});
    });
  }

  public updateStationsLayer(stationsGeoJSON: GeoJSON | undefined): void {
    if (stationsGeoJSON) {
      this.map.removeLayer(this.stationsLayerGroup);
      this.stationsLayerGroup = new L.markerClusterGroup({disableClusteringAtZoom: 11});
      stationsGeoJSON.addTo(this.stationsLayerGroup);
      this.stationsLayerGroup.addTo(this.map);
    } else {
      // console.log('remove all stations markers');
      this.map.removeLayer(this.stationsLayerGroup);
      this.stationsLayerGroup = new L.markerClusterGroup({disableClusteringAtZoom: 11});
    }
  }

  public removeAllStations(): void {
    this.updateStationsLayer(undefined);
  }

  @HostListener('document:click', ['$event'])
  public popupClicked(event: any): void {
    if (event.target.classList.contains('station-selected-click')) {
      const clickId = parseInt(event.target.id.substr(0, 1), 10);
      const stationId = parseInt(event.target.id.substr(2), 10);
      console.log(stationId);
      // Full charge.
      if (clickId === 1) {
        if (this.routingService.fastCharge) {
          this.routingService.maxRange = this.routingService.maxRange / this.routingService.fastChargeAmount;
          this.routingService.fastCharge = false;
        }
      }
      // Fast charge.
      if (clickId === 3) {
        if (!this.routingService.fastCharge) {
          this.routingService.maxRange = this.routingService.maxRange * this.routingService.fastChargeAmount;
          this.routingService.fastCharge = true;
        }
      }
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
      let amenityType = feature.properties.amenity;
      amenityType = amenityType.replace('_', ' ');
      amenityType = amenityType
        .toLowerCase()
        .split(' ')
        .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      const restaurantName = feature.properties.name;
      let popupHtml = '';
      if (restaurantName !== undefined && restaurantName !== null) {
        popupHtml = `
      <div>Name: ${restaurantName}</div>
      <div>Type: ${amenityType}</div>`;
      } else {
        popupHtml = `
      <div>Name: Not available</div>
      <div>Type: ${amenityType}</div>`;
      }
      // layer.bindPopup(`${JSON.stringify(feature.properties, null, 2)}`);
      layer.bindPopup(popupHtml);
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

      const showFeaturedRest = this.showFeat;
      console.log(showFeaturedRest);
      const restaurantsGeoJSON = new GeoJSON(restaurants, {
        onEachFeature, pointToLayer(geoJsonPoint: Feature, latlng: LatLng): Layer {
          if (!showFeaturedRest && geoJsonPoint.properties && geoJsonPoint.properties.amenity && geoJsonPoint.properties.amenity === 'rated_restaurant') {
            // @ts-ignore
            return;
          }
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
            Charge Type: ${station.properties.chargeType}<br/>
            <button id="1-${station.id}" type="button" class="text-center w-100 mt-3 btn btn-secondary station-selected-click">
                    Select station (full charge)
            </button>
            <button id="3-${station.id}" type="button" class="text-center w-100 mt-2 btn btn-secondary station-selected-click">
                    Select station (fast charge)
            </button>
            <button id="2-${station.id}" type="button" class="text-center w-100 mt-2 btn btn-secondary station-show-all-click">
                    Return to see all stations
            </button>
        </div>`;
      const stationGeoJSON = new GeoJSON(station).bindPopup(popupHtml);

      this.updateRestaurantsLayer(restaurantsGeoJSON, stationGeoJSON, station.geometry.coordinates.reverse() as LatLngTuple, amenityRange);

      this.localStorage.get('restaurant-hint').subscribe((restaurantHint) => {
        console.log(restaurantHint);
        if (restaurantHint === undefined) {
          this.showRestauratHintDialog();
        }
        this.localStorage.has('restaurant-hint').subscribe((restaurantHint) => {
          if (!restaurantHint) {
            this.localStorage.set('restaurant-hint', true).subscribe();
          }
        });
      });
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
      if (feature.properties.type === 'Departure') {
        this.departureMarker = layer;
        layer.bindPopup(`${feature.properties.type}`);
        return;
      }
      if (feature.properties.type === 'Destination') {
        this.destinationMarker = layer;
        layer.bindPopup(`${feature.properties.type}`);
        return;
      }
      this.stationMarkers.push(layer);
      layer.bindPopup(`${feature.properties.type}: ${feature.properties.address}, ${feature.properties.city}`);
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
    this.addTimeLayer(undefined);
    this.removeLayers();
    this.map.off('click');
    this.map.off('mousemove');
    this.clearHover();
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

  /**
   *  #######################################################################
   *  ################################ Dialog ###############################
   *  #######################################################################
   */

  public showRestauratHintDialog(): void {
    setTimeout(() => {
      this.zone.run(() => {
        const dialogRef = this.dialog.open(DialogComponent, {autoFocus: false});
        dialogRef.componentInstance.content = {
          title: '👨‍🍳 Anything interested?',
          body: ['You can click the center marker to add this station to your route; or just go back to explore more stations! 🕵️‍♂️'],
          img: null,
          button1: null,
          button2: null,
          button3: 'Close',
          index: 0
        };
      });
    }, 1000);
  }

  public showStationHintDialog(): void {
    setTimeout(() => {
      this.zone.run(() => {
        const dialogRef = this.dialog.open(DialogComponent, {autoFocus: false});
        dialogRef.componentInstance.content = {
          title: '😱 Those are stations!',
          body: ['If you see some circle clusters, just click them!',
            'Now click one station to see if there is any restaurant around! 🍽'],
          img: null,
          button1: null,
          button2: null,
          button3: 'Close',
          index: 0
        };
      });
    }, 1000);
  }

  public showReRouteHintDialog(): void {
    setTimeout(() => {
      this.zone.run(() => {
        const dialogRef = this.dialog.open(DialogComponent, {autoFocus: false});
        dialogRef.componentInstance.content = {
          title: '👏 Bravo! You just added the first station!',
          body: ['Now you go further! 🛣',
            'If you are not sure where will be stations, you can also turn on stations heatmap 🔥 from the side bar.',
            'Just continue to add more stations along the route! Good luck! 😉'],
          img: null,
          button1: null,
          button2: null,
          button3: 'Close',
          index: 0
        };
      });
    }, 1000);
  }

  public showHoverHintDialog(): void {
    setTimeout(() => {
      this.zone.run(() => {
        const dialogRef = this.dialog.open(DialogComponent, {autoFocus: false});
        dialogRef.componentInstance.content = {
          title: '🥳 You just discovered the reachable area!',
          body: ['You can look for charge stations in that area.',
                 'Now try stay somewhere again and click there to see what is there! 😉'],
          img: null,
          button1: null,
          button2: null,
          button3: 'Close',
          index: 0
        };
      });
    }, 500);
  }

  public showRouteHintDialog(): void {
    setTimeout(() => {
      this.zone.run(() => {
        const dialogRef = this.dialog.open(DialogComponent, {autoFocus: false});
        dialogRef.componentInstance.content = {
          title: '🎉 Great! You just got your first route!',
          body: ['Now try to move you cursor around the highlight route and stay there for a while to see what would happen! 😉'],
          img: null,
          button1: null,
          button2: null,
          button3: 'Close',
          index: 0
        };
      });
    }, 0);
  }

  public showReachHintDialog(): void {
    setTimeout(() => {
      this.zone.run(() => {
        const dialogRef = this.dialog.open(DialogComponent, {autoFocus: false});
        dialogRef.componentInstance.content = {
          title: '🥳 Congrads!',
          body: ['Now you can safely reach your destination! Have a nice journey! 🎉'],
          img: null,
          button1: null,
          button2: null,
          button3: 'Close',
          index: 0
        };
      });
    }, 1000);
  }
}
