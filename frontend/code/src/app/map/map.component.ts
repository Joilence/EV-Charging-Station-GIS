/// <reference types='leaflet-sidebar-v2' />
import {Component, EventEmitter, Output} from '@angular/core';
import {Feature, FeatureCollection, Geometry} from 'geojson';
import {GeoJSON, Icon, latLng, LayerGroup, Map, Marker, TileLayer} from 'leaflet';
import {RoutingService} from '../services/routing.service';
import {Observable} from 'rxjs';

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.scss'],
})
export class MapComponent {

  constructor(private routingService: RoutingService) {

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

  public addNewStation(station: Feature): void {
    this.routingService.addNewStation(station);
  }

  /**
   *  #######################################################################
   *  ############################### Routes ################################
   *  #######################################################################
   */

  public addRoutePath(routeObs: Observable<FeatureCollection>): void {
    routeObs.subscribe((route: FeatureCollection) => {
      // const processedRoute = this.handleRoute(route);
      const processedRoute = route;
      console.log('addRoutePath: processed route', processedRoute);

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
      const routeGeoJSON = new GeoJSON(processedRoute, {
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
    this.map.fitBounds(routeGeoJSON.getBounds());
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
}
