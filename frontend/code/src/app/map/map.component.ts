import { Component, Input, OnInit } from '@angular/core';
import { Feature, FeatureCollection, Geometry, MultiPolygon } from 'geojson';
import * as L from 'leaflet';
import * as d3 from 'd3';

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.scss'],
})
export class MapComponent implements OnInit {
  private map!: L.Map;
  private amenitiesLayer: L.LayerGroup<any> = L.layerGroup();

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
      L.marker([a.latitude, a.longitude]).bindPopup(a.name)
    );

    // create a new layer group and add it to the map
    this.amenitiesLayer = L.layerGroup(markers);
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
    const iconDefault = L.icon({
      iconRetinaUrl,
      iconUrl,
      shadowUrl,
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      tooltipAnchor: [16, -28],
      shadowSize: [41, 41],
    });

    L.Marker.prototype.options.icon = iconDefault;

    // basic setup, create a map in the div with the id "map"
    this.map = L.map('map').setView([48.12, 8.2], 10);

    // set a tilelayer, e.g. a world map in the background
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.map);
  }

  /**
   * Add a GeoJSON FeatureCollection to this map
   * @param latitude
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
    const onEachFeature = (feature: Feature<Geometry, any>, layer: L.Layer) => {
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
    const geoJSON = L.geoJSON(geojson, {
      onEachFeature,
      style,
    });
    geoJSON.addTo(this.map);
  }
  public addRoutePath(geojson: FeatureCollection): void {
    // console.log('addRoutePath:', geojson);
    const style = {
      "color": "#ff7800",
      "weight": 5,
      "opacity": 0.65
    }
    const geoJSON = L.geoJSON(geojson, {
      style,
    });
    geoJSON.addTo(this.map);
    // console.log('setView:', geojson.bbox);
    const bbox = geojson.bbox;
    this.map.fitBounds([[bbox[1], bbox[0]], [bbox[3], bbox[2]]]);

    
    //TODO: way points will be depature, destination and  selected stations, maybe added by other functions
    // const wayPoints = Array.from(geojson.features[0].properties.way_points, i => {
    //   console.log(geojson.features[0].geometry.coordinates[i])
    //   return geojson.features[0].geometry.coordinates[i];
    // })
    // console.log('wayPoints:', wayPoints);
  }
}
