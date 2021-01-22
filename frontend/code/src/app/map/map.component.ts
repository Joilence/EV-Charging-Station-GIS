/// <reference types='leaflet-sidebar-v2' />
import {Component, EventEmitter, Output} from '@angular/core';
import {Feature, FeatureCollection, Geometry} from 'geojson';
import {GeoJSON, Icon, latLng, LatLngTuple, Layer, LayerGroup, Map, Marker, TileLayer} from 'leaflet';
import 'leaflet.heat/dist/leaflet-heat';
import {RoutingService} from '../services/routing.service';
import {DataService} from '../services/data.service';
import {Observable} from 'rxjs';
import {MapService} from '../services/map.service';
import {SpinnerOverlayService} from '../services/spinner-overlay.service';
import {max} from 'rxjs/operators';

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

  public onMapReady(map: Map): void {
    this.map = map;
    this.map$.emit(map);
    this.routingService.setMap(this.map);
    this.routingService.maxRange = 300000;
    this.routingService.dangerBattery = 0.2;
    console.log('map.com: set param to rs.');
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

  public initDepDest(initLocations: FeatureCollection): void {
    this.routingService.initDepDest(initLocations);
  }

  public route(): void {
    this.addRoutePath(this.routingService.getCurrentRoute());
  }

  public setMaxRange(maxRange: number): void {
    this.routingService.maxRange = maxRange;
  }

  public selectDropPoint(location: LatLngTuple, range: number): void {
    this.removeAllStations();
    this.removeAllIsochrones();
    this.dataService.getIsochrones([location], 'distance', [range]).subscribe((isochrones: FeatureCollection) => {
      this.addIsochrones(isochrones);
    });
    this.dataService.getStations([location], [range]).subscribe((stations: FeatureCollection) => {
      this.addStations(stations);
    });
  }

  public selectStation(station: Feature): void {
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
      console.log('addRoutePath: processed route', route);

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
      console.log('update isochrones');
      this.map.removeLayer(this.isochronesLayerGroup);
      this.isochronesLayerGroup = new LayerGroup();
      isochronesJSON.addTo(this.isochronesLayerGroup);
      this.isochronesLayerGroup.addTo(this.map);
      this.map.fitBounds(isochronesJSON.getBounds(), {padding: [100, 100]});
    } else {
      console.log('remove isochrones');
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

  public addStations(stations: FeatureCollection): void {
    console.log('addStations:', stations);
    const onEachFeature = (feature: Feature<Geometry, any>, layer: L.Layer) => {
      layer.bindPopup(`${feature.properties.type}: ${feature.properties.address}`);
    };

    const stationsGeoJSON = new GeoJSON(stations, {
      onEachFeature,
    });
    this.updateStationsLayer(stationsGeoJSON);
  }

  public updateStationsLayer(stationsGeoJSON: GeoJSON | undefined): void {
    if (stationsGeoJSON) {
      console.log('add stations');
      this.map.removeLayer(this.stationsLayerGroup);
      this.stationsLayerGroup = new LayerGroup();
      stationsGeoJSON.addTo(this.stationsLayerGroup);
      this.stationsLayerGroup.addTo(this.map);
    } else {
      console.log('remove all stations');
      this.map.removeLayer(this.stationsLayerGroup);
      this.stationsLayerGroup = new LayerGroup();
    }
  }

  public removeAllStations(): void {
    this.updateStationsLayer(undefined);
  }

  /**
   *  #######################################################################
   *  ############################# Way Points ##############################
   *  #######################################################################
   */

  public addWayPoints(wayPoints: FeatureCollection): void {
    // console.log('add way points:', wayPoints);
    const onEachFeature = (feature: Feature<Geometry, any>, layer: L.Layer) => {
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
    this.map.removeLayer(this.routeLayerGroup);
  }
}
