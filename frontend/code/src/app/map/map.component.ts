/// <reference types='leaflet-sidebar-v2' />
import { Component, Input, OnInit } from '@angular/core';
import { Feature, FeatureCollection, Geometry } from 'geojson';
import {GeoJSON, Icon, Layer, LayerGroup, Map, Marker, TileLayer, SidebarOptions} from 'leaflet';
import * as d3 from 'd3';
import {extract} from './leaflet-geometryutil.js';

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.scss'],
})
export class MapComponent implements OnInit {
  public map!: Map;
  private amenitiesLayer: LayerGroup = new LayerGroup();

  public sidebarOptions: SidebarOptions = {
    position: 'left',
    autopan: true,
    closeButton: true,
    container: 'sidebar',
  };

  private _amenities: {
    name: string;
    latitude: number;
    longitude: number;
  }[] = [];

  get amenities(): { name: string; latitude: number; longitude: number }[] {
    return this._amenities;
  }

  @Input()
  set amenities(
    value: { name: string; latitude: number; longitude: number }[]
  ) {
    this._amenities = value;
    this.updateAmenitiesLayer();
  }

  private updateAmenitiesLayer() {
    if (!this.map) {
      return;
    }

    // remove old amenities
    this.map.removeLayer(this.amenitiesLayer);

    // create a marker for each supplied amenity
    const markers = this.amenities.map((a) =>
      new Marker([a.latitude, a.longitude]).bindPopup(a.name)
    );

    // create a new layer group and add it to the map
    this.amenitiesLayer = new LayerGroup(markers);
    markers.forEach((m) => m.addTo(this.amenitiesLayer));
    this.map.addLayer(this.amenitiesLayer);
  }

  /**
   * Often divs and other HTML element are not available in the constructor. Thus we use onInit()
   */
  ngOnInit(): void {
    // some settings for a nice shadows, etc.
    const iconRetinaUrl = './assets/marker-icon-2x.png';
    const iconUrl = './assets/marker-icon.png';
    const shadowUrl = './assets/marker-shadow.png';
    const iconDefault = new Icon({
      iconRetinaUrl,
      iconUrl,
      shadowUrl,
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      tooltipAnchor: [16, -28],
      shadowSize: [41, 41],
    });

    Marker.prototype.options.icon = iconDefault;

    // basic setup, create a map in the div with the id "map"
    this.map = new Map('map').setView([48.12, 8.2], 10);

    // set a tilelayer, e.g. a world map in the background
    new TileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.map);
  }

  /**
   * Add a GeoJSON FeatureCollection to this map
   */
  public addGeoJSON(geojson: FeatureCollection): void {
    // find maximum numbars value in array
    let max = d3.max(
      geojson.features.map((f: Feature<Geometry, any>) => +f.properties.numbars)
    );

    // if max is undefined, enforce max = 1
    if (!max) {
      max = 1;
    }

    const colorscale = d3
      .scaleSequential()
      .domain([0, max])
      .interpolator(d3.interpolateViridis);

    // each feature has a custom style
    const style = (feature: Feature<Geometry, any> | undefined) => {
      const numbars = feature?.properties?.numbars
        ? feature.properties.numbars
        : 0;

      return {
        fillColor: colorscale(numbars),
        weight: 2,
        opacity: 1,
        color: 'white',
        dashArray: '3',
        fillOpacity: 0.7,
      };
    };

    // each feature gets an additional popup!
    const onEachFeature = (feature: Feature<Geometry, any>, layer: Layer) => {
      if (
        feature.properties &&
        feature.properties.name &&
        typeof feature.properties.numbars !== 'undefined'
      ) {
        layer.bindPopup(
          `${feature.properties.name} has ${feature.properties.numbars} bar${feature.properties.numbars > 0 ? 's' : ''
          }`
        );
      }
    };

    // create one geoJSON layer and add it to the map
    const geoJSON = new GeoJSON(geojson, {
      onEachFeature,
      style,
    });
    geoJSON.addTo(this.map);
  }

  public handleRoute(fc: FeatureCollection, maxRange: number = 5000000, dangerBattery: number = 0.2): FeatureCollection {
    const wholeRoute = fc.features[0];
    // TODO: TS data safety check
    wholeRoute.properties.type = 'Whole Route';
    const wholeRouteLine = L.polyline(wholeRoute.geometry.coordinates);
    const wholeRouteDistance = wholeRoute.properties.summary.distance;

    // danger segment (ds)
    // TODO: check every segment instead of only last one
    let isDanger = false;
    const segments = wholeRoute.properties.segments;
    const lastSegmentDistance = segments[segments.length - 1].distance;
    console.log('lastSegmentDistance: ', lastSegmentDistance);
    if (lastSegmentDistance > maxRange) {
      isDanger = true;
      const previousSegmentsDistance = wholeRouteDistance - lastSegmentDistance;
      const dsStartDistance = previousSegmentsDistance + maxRange * (1 - dangerBattery);
      const dsEndDistance = previousSegmentsDistance + maxRange;
      const dsStartPercent = dsStartDistance / wholeRouteDistance;
      const dsEndPercent = dsEndDistance / wholeRouteDistance;
      // console.log('previous seg dis:', previousSegmentsDistance);
      // TODO: ugly code: reverse [lat, lng] for unknown problem; 3 places;
      const dsCors = Array.from(extract(this.map, wholeRouteLine, dsStartPercent, dsEndPercent), e => {return [e.lat, e.lng]});
      // console.log(dsCors);
      const dsLine = L.polyline(dsCors);
      const dsGeoJSON = dsLine.toGeoJSON();
      dsGeoJSON.geometry.coordinates = dsCors;
      dsGeoJSON.properties.type = 'Danger Segment';
      console.log('Danger Segment:', dsGeoJSON);
      // TODO: ugly code fix
      const ssCors = Array.from(extract(this.map, wholeRouteLine, 0, dsStartPercent), e => {return [e.lat, e.lng]});;
      const ssLine = L.polyline(ssCors);
      const ssGeoJSON = ssLine.toGeoJSON();
      ssGeoJSON.geometry.coordinates = ssCors;
      ssGeoJSON.properties.type = 'Safe Segment';

      fc.features.push(dsGeoJSON);
      fc.features.push(ssGeoJSON);
    }

    // safe segment (ss)
    if (!isDanger) {
      // TODO: ugly code fix
      const ssGeoJSON = wholeRouteLine.toGeoJSON();
      ssGeoJSON.geometry.coordinates = wholeRoute.geometry.coordinates;
      ssGeoJSON.properties.type = 'Safe Segment';
      fc.features.push(ssGeoJSON);
    }

    // fc.features = fc.features.slice(1, 3);
    return fc;
  }

  public addRoutePath(fc: FeatureCollection): void {
    const processedFC = this.handleRoute(fc);
    console.log('addRoutePath:', processedFC);
    // const style = {
    //   "color": "#ff7800",
    //   "weight": 5,
    //   "opacity": 0.65
    // }

    const styles = function(feature) {
      console.log(feature);
      switch (feature.properties.type) {
        case 'Whole Route': return {
          "color": "#000000",
          "weight": 8,
          "opacity": 0.2
        };

        case 'Danger Segment': return {
          "color": "#ff7800",
          "weight": 5,
          "opacity": 0.65
          };

        case 'Safe Segment': return {
          "color": "#03fc94",
          "weight": 5,
          "opacity": 0.65
        };

        default: return {
          "color": "#ff7800",
          "weight": 5,
          "opacity": 0.65
        };
      }
    }
    const geoJSON = L.geoJSON(processedFC, {
      'style': styles,
    });
    geoJSON.addTo(this.map);
    // console.log('setView:', features.bbox);
    const bbox = processedFC.bbox;
    if (bbox) {
      this.map.fitBounds([[bbox[1], bbox[0]], [bbox[3], bbox[2]]]);
    }

    // way points will be depature, destination and selected stations with related info, maybe added by other functions
  }

  public addWayPoints(features: FeatureCollection): void {
    const onEachFeature = (feature: Feature<Geometry, any>, layer: L.Layer) => {
      layer.bindPopup(`${feature.properties.type}: ${feature.properties.name}`);
    };

    const geoJSON = new GeoJSON(features, {
      onEachFeature,
    });
    geoJSON.addTo(this.map);
  }

  public addIsochrones(features: FeatureCollection): void {
    console.log('addIsochrones:', features);
    const geoJSON = new GeoJSON(features);
    geoJSON.addTo(this.map);
  }
}
