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
  constructor(private dataservice: DataService) {}

  ngAfterViewInit(): void {
    this.dataservice.getBarDistribution().subscribe((geojson: FeatureCollection) => {
      this.mapcomponent.addGeoJSON(geojson);
    });
  }
}
