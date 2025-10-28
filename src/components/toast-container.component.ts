import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../services/toast.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed top-5 right-5 z-50 space-y-2">
      @for(toast of toastService.toasts(); track toast.id) {
        <div 
          class="flex items-center justify-between p-4 rounded-lg shadow-lg max-w-sm text-white"
          [class.bg-green-500]="toast.type === 'success'"
          [class.bg-red-500]="toast.type === 'error'"
          [class.bg-blue-500]="toast.type === 'info'"
          [class.toast-slide-in]="toast.state === 'entering'"
          [class.toast-slide-out]="toast.state === 'leaving'"
        >
          <span>{{ toast.message }}</span>
          <button (click)="toastService.removeToast(toast.id)" class="ml-4 text-xl font-bold">&times;</button>
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToastContainerComponent {
  toastService = inject(ToastService);
}