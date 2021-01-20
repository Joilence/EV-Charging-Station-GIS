import {Injectable} from '@angular/core';
import {DataService} from './data.service';
import {MapComponent} from '../map/map.component';

@Injectable({
  providedIn: 'root',
})
export class MapService {
  private mapComponent!: MapComponent;

  constructor(private dataService: DataService) {
  }

  public setMapComponent(mapComponent: MapComponent): void {
    this.mapComponent = mapComponent;
  }

  public parseStations(radius: number, maxZoom: number): void {
    this.dataService.getAllStations().subscribe((feature) => {
      const result: any[] = [];
      feature.features.forEach((element: any) => {
        result.push([parseFloat(element.lat), parseFloat(element.lng)]);
      });
      this.mapComponent.addHeatMapLayer(result, false, radius, maxZoom);
    });
  }
}
