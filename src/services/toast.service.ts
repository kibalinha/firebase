import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
  state: 'entering' | 'visible' | 'leaving';
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  toasts = signal<Toast[]>([]);
  private lastId = 0;
  private readonly animationDuration = 300;

  addToast(message: string, type: 'success' | 'error' | 'info') {
    const id = this.lastId++;
    this.toasts.update(toasts => [...toasts, { id, message, type, state: 'entering' }]);

    setTimeout(() => {
        this.toasts.update(toasts => 
            toasts.map(t => t.id === id ? { ...t, state: 'visible' } : t)
        );
    }, this.animationDuration);

    setTimeout(() => this.removeToast(id), 5000);
  }

  removeToast(id: number) {
    const toast = this.toasts().find(t => t.id === id);
    if (!toast || toast.state === 'leaving') {
      return;
    }

    this.toasts.update(toasts =>
      toasts.map(t => (t.id === id ? { ...t, state: 'leaving' } : t))
    );

    setTimeout(() => {
      this.toasts.update(toasts => toasts.filter(t => t.id !== id));
    }, this.animationDuration);
  }
}