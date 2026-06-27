import { Directive, Input, TemplateRef, ViewContainerRef, inject } from '@angular/core';
import { AuthService } from '../../features/auth/auth.service';

@Directive({
  selector: '[appHasPermission]',
  standalone: true
})
export class HasPermissionDirective {
  private authService = inject(AuthService);
  private templateRef = inject(TemplateRef);
  private viewContainer = inject(ViewContainerRef);

  private hasView = false;

  // 🚀 FIXED 1: Using a setter instead of ngDoCheck for massive performance gains.
  // 🚀 FIXED 2: Changed action type to `string` so it accepts our custom 'navigation' keys.
  @Input() set appHasPermission(permission: [string, string]) {
    if (!permission) return;

    const [resource, action] = permission;
    
    // Evaluates exactly once per element
    const isAuthorized = this.authService.hasPermission(resource, action);

    if (isAuthorized && !this.hasView) {
      this.viewContainer.createEmbeddedView(this.templateRef);
      this.hasView = true;
    } else if (!isAuthorized && this.hasView) {
      this.viewContainer.clear();
      this.hasView = false;
    }
  }
}