import { AfterViewInit, Component, ViewChild } from '@angular/core';
import { FeatureCollection } from 'geojson';
import { MapComponent } from './map/map.component';
import { DataService } from './services/data.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements AfterViewInit {

  @ViewChild(MapComponent) mapcomponent!: MapComponent;

  /*
   * Services or other dependencies are often imported via dependency injection.
   * See https://angular.io/guide/dependency-injection for more details.
   */
  constructor(private dataservice: DataService) { }

  ngAfterViewInit(): void {
    // this.dataservice.getBarDistribution().subscribe((geojson: FeatureCollection) => {
    //  this.mapcomponent.addGeoJSON(geojson);
    // });

    let testCor: number[][] = [
      [8.681495, 49.41461],
      [8.686507, 49.41943],
      [8.687872, 49.420318],
    ]

    let testWayPoints = [{
      "type": "Feature",
      "properties": {
        "name": "departure place",
        "type": "Departure"
      },
      "geometry": {
        "type": "Point",
        "coordinates": testCor[0]
      }
    }, {
      "type": "Feature",
      "properties": {
        "name": "Random Station",
        "type": "Station"
      },
      "geometry": {
        "type": "Point",
        "coordinates": testCor[1]
      }
    }, {
      "type": "Feature",
      "properties": {
        "name": "destination place",
        "type": "Destination"
      },
      "geometry": {
        "type": "Point",
        "coordinates": testCor[2]
      }
    },];
    this.dataservice.getRoute('driving-car', testCor).subscribe((geojson: FeatureCollection) => {
      this.mapcomponent.addRoutePath(geojson);
      this.mapcomponent.addWayPoints(testWayPoints);
    })
  }
}
