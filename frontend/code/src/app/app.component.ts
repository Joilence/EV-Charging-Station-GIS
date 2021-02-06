/// <reference types='leaflet-sidebar-v2' />
import {AfterViewInit, ApplicationRef, Component, ElementRef, ViewChild} from '@angular/core';
import {FeatureCollection, Point} from 'geojson';
import {MapComponent} from './map/map.component';
import {DataService} from './services/data.service';
import {Map, SidebarOptions} from 'leaflet';
import {SpinnerOverlayService} from './services/spinner-overlay.service';
import * as d3 from 'd3';
// @ts-ignore
import {legend} from './map/d3-legend';
import {MatSnackBar} from '@angular/material/snack-bar';
import {DialogComponent} from './dialog/dialog.component';
import {StorageMap} from '@ngx-pwa/local-storage';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements AfterViewInit {

  public map!: Map;

  public maxZoomHeat = 11;
  public radiusHeat = 10;


  public sidebarOptions: SidebarOptions = {
    position: 'left',
    autopan: false,
    closeButton: true,
    container: 'sidebar',
  };

  @ViewChild(MapComponent) mapComponent!: MapComponent;

  @ViewChild(DialogComponent) dialogComponent!: DialogComponent;


  @ViewChild('inputStartLat', {static: true})
  inputStartLat!: ElementRef;
  @ViewChild('inputStartLong', {static: true})
  inputStartLong!: ElementRef;
  @ViewChild('inputTargetLat', {static: true})
  inputTargetLat!: ElementRef;
  @ViewChild('inputTargetLong', {static: true})
  inputTargetLong!: ElementRef;
  @ViewChild('inputRange', {static: true})
  inputRange!: ElementRef;
  @ViewChild('inputStartRange', {static: true})
  inputStartRange!: ElementRef;
  @ViewChild('inputTime', {static: true})
  inputTime!: ElementRef;
  @ViewChild('inputMaxRange', {static: true})
  inputMaxRange!: ElementRef;
  @ViewChild('inputAmenityRange', {static: true})
  inputAmenityRange!: ElementRef;
  @ViewChild('inputFastChargeAmount', {static: true})
  inputFastChargeAmount!: ElementRef;
  @ViewChild('sidebar', {static: true})
  sideBar!: ElementRef;
  @ViewChild('homeActive', {static: true})
  homeActive!: ElementRef;
  @ViewChild('layerTab', {static: true})
  layerTab!: ElementRef;

  featuredRestaurants = true;

  private zeroPad = (num: number, places: number) => String(num).padStart(places, '0');

  /*
   * Services or other dependencies are often imported via dependency injection.
   * See https://angular.io/guide/dependency-injection for more details.
   */
  constructor(private dataService: DataService, private spinnerService: SpinnerOverlayService, private snackBar: MatSnackBar,
              private localStorage: StorageMap) {
  }

  ngAfterViewInit(): void {
    let node = legend({
      color: d3.scaleSequential([0, 3], d3.interpolateRgb('blue', 'green')),
      title: 'Station score'
    });
    // @ts-ignore
    document.getElementById('legend-stations').append(node);

    node = legend({
      color: d3.scaleOrdinal(['0', '>0'], ['black', 'yellow']),
      title: 'Restaurant score'
    });
    // @ts-ignore
    document.getElementById('legend-restaurant').append(node);

    node = legend({
      color: d3.scaleLinear([0, 0.65, 1], ['blue', 'lime', 'red']),
      title: 'Heatmap colors'
    });
    // @ts-ignore
    document.getElementById('legend-heatmap').append(node);
    // this.inputTime.nativeElement.value = new Date().getHours() + ':' + new Date().getMinutes();

    this.localStorage.get('tutorial').subscribe((getTut) => {
      console.log(getTut);
      if (getTut === undefined) {
        this.dialogComponent.startTutorial(0);
      }
    });

    this.inputTime.nativeElement.value = this.zeroPad(new Date().getHours(), 2) + ':' +
      this.zeroPad(new Date().getMinutes(), 2);
    setTimeout(() => {
      this.openSideBar();
    }, 1000);
  }

  settingsChanged(): void {
    let fastChargeAmount = parseFloat(this.inputFastChargeAmount.nativeElement.value);
    if (fastChargeAmount > 1 || fastChargeAmount <= 0) {
      // Use default value.
      fastChargeAmount = 0.8;
      this.inputFastChargeAmount.nativeElement.value = fastChargeAmount;
      this.snackBar.open('Invalid value entered for fast charge amount. Resetting to default.', undefined,
        {duration: 2000});
    }
    let maxRange = parseInt(this.inputMaxRange.nativeElement.value, 10);
    let amenityRange = parseInt(this.inputAmenityRange.nativeElement.value, 10);
    if (maxRange <= 0) {
      this.snackBar.open('Invalid value entered for max range. Resetting to default.', undefined,
        {duration: 2000});
      maxRange = 20000;
      this.inputMaxRange.nativeElement.value = maxRange;
    }
    if (amenityRange <= 0) {
      this.snackBar.open('Invalid value entered for max range. Resetting to default.', undefined,
        {duration: 2000});
      amenityRange = 1000;
      this.inputAmenityRange.nativeElement.value = amenityRange;
    }
    this.mapComponent.updateSettings(
      maxRange,
      amenityRange,
      fastChargeAmount
    );
  }

  receiveMap(map: Map): void {
    // This will throw an ExpressionChangedAfterItHasBeenCheckedError error in dev mode. That's okay and not problematic.
    this.map = map;
  }

  public calculateRoute(): void {
    this.closeSideBar();
    // Format: [long ,lat]
    const start = [parseFloat(this.inputStartLong.nativeElement.value), parseFloat(this.inputStartLat.nativeElement.value)];
    const target = [parseFloat(this.inputTargetLong.nativeElement.value), parseFloat(this.inputTargetLat.nativeElement.value)];
    const range = parseFloat(this.inputRange.nativeElement.value);
    const startRange = parseFloat(this.inputStartRange.nativeElement.value);
    // Extract departure time.
    const timeSplit = String(this.inputTime.nativeElement.value);
    const splitted = timeSplit.split(':');
    const departureDate = new Date();
    departureDate.setHours(parseInt(splitted[0], 10), parseInt(splitted[1], 10), 0);
    // Convert km to m.
    this.mapComponent.setMaxRange(range * 1000);
    this.mapComponent.setStartRange(startRange * 1000);
    this.spinnerService.show();
    const initLocations: FeatureCollection<Point> = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: {
          name: 'Start',
          type: 'Departure'
        },
        geometry: {
          type: 'Point',
          coordinates: start
        }
      }, {
        type: 'Feature',
        properties: {
          name: 'Target',
          type: 'Destination'
        },
        geometry: {
          type: 'Point',
          coordinates: target
        }
      }]
    };
    this.mapComponent.initDepDest(initLocations);
    this.mapComponent.initDepTime(departureDate.getTime());
    this.mapComponent.route();
    this.spinnerService.hide();
  }

  private closeSideBar(): void {
    if (!this.sideBar.nativeElement.classList.contains('collapsed')) {
      this.sideBar.nativeElement.classList.add('collapsed');
    }
    if (this.homeActive.nativeElement.classList.contains('active')) {
      this.homeActive.nativeElement.classList.remove('active');
    }
    if (this.layerTab.nativeElement.classList.contains('active')) {
      this.layerTab.nativeElement.classList.remove('active');
    }
  }

  private openSideBar(): void {
    // @ts-ignore
    document.getElementById('clickHome').click();
  }

  public addHeatMapStationsLayer(): void {
    console.log(this.map.getZoom());
    this.mapComponent.addStationsHeat(this.radiusHeat, this.maxZoomHeat);
    // this.closeSideBar();
  }

  public toggleTimeVis(): void {
    this.mapComponent.toggleTimeLayer();
  }

  public changeAvgChargingTime(event: any): void {
    this.mapComponent.changeAvgChargingTime(event.target.value);
  }
}
