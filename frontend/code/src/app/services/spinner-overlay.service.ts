import {Overlay, OverlayRef} from '@angular/cdk/overlay';
import {ComponentPortal} from '@angular/cdk/portal';
import {ApplicationRef, Injectable} from '@angular/core';
import {SpinnerOverlayComponent} from '../spinner/overlay/spinner-overlay.component';

@Injectable({
  providedIn: 'root'
})
export class SpinnerOverlayService {
  private overlayRef!: OverlayRef;

  constructor(private overlay: Overlay, private ref: ApplicationRef) {
  }

  public show(message = ''): void {
    if (!this.overlayRef) {
      this.overlayRef = this.overlay.create();
    }
    // Create ComponentPortal that can be attached to a PortalHost
    const spinnerOverlayPortal = new ComponentPortal(SpinnerOverlayComponent);
    this.overlayRef.attach(spinnerOverlayPortal);
  }

  public hide(): void {
    if (this.overlayRef) {
      this.overlayRef.detach();
      this.ref.tick();
    }
  }
}
