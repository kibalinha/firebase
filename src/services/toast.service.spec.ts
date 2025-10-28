import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ToastService, Toast } from './toast.service';

// FIX: Add ambient declarations for Jasmine types to resolve "Cannot find name" errors
// in an environment where test runner type definitions are not available.
declare var describe: any;
declare var beforeEach: any;
declare var it: any;
declare var expect: any;

describe('ToastService', () => {
  let service: ToastService;
  const animationDuration = 300;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ToastService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should add a toast and transition its state', fakeAsync(() => {
    // Initial state should be empty
    expect(service.toasts().length).toBe(0);

    // Add a toast
    service.addToast('Test message', 'success');

    // Check if toast was added with 'entering' state
    expect(service.toasts().length).toBe(1);
    const toast = service.toasts()[0];
    expect(toast.message).toBe('Test message');
    expect(toast.type).toBe('success');
    expect(toast.state).toBe('entering');

    // Tick forward for the animation duration
    tick(animationDuration);
    
    // Check if toast is now 'visible'
    expect(service.toasts()[0].state).toBe('visible');

    // Clean up timers
    tick(5000 + animationDuration); 
  }));

  it('should automatically remove a toast after the specified duration', fakeAsync(() => {
    service.addToast('Auto remove', 'info');
    
    expect(service.toasts().length).toBe(1);

    // Tick past the animation and visibility duration
    tick(5000);

    // The state should now be 'leaving'
    expect(service.toasts()[0].state).toBe('leaving');

    // Tick past the final removal animation
    tick(animationDuration);

    // The toasts array should be empty
    expect(service.toasts().length).toBe(0);
  }));

  it('should remove a toast manually', fakeAsync(() => {
    service.addToast('Manual remove', 'error');
    tick(animationDuration); // Let it become visible

    const toastId = service.toasts()[0].id;
    
    // Manually remove it
    service.removeToast(toastId);
    
    // State should be 'leaving'
    expect(service.toasts().length).toBe(1);
    expect(service.toasts()[0].state).toBe('leaving');

    // Tick past the removal animation
    tick(animationDuration);
    
    // Array should be empty
    expect(service.toasts().length).toBe(0);
  }));

  it('should handle multiple toasts correctly', fakeAsync(() => {
    service.addToast('Toast 1', 'success');
    tick(1000);
    service.addToast('Toast 2', 'error');

    expect(service.toasts().length).toBe(2);
    
    // Let the first toast expire
    tick(4000 + animationDuration); 

    // Only the second toast should remain
    expect(service.toasts().length).toBe(1);
    expect(service.toasts()[0].message).toBe('Toast 2');

    // Let the second toast expire
    tick(1000 + animationDuration);

    expect(service.toasts().length).toBe(0);
  }));

  it('should not do anything when trying to remove a non-existent toast', fakeAsync(() => {
    service.addToast('Existing', 'info');
    const initialToasts = [...service.toasts()];

    service.removeToast(999); // Non-existent ID

    expect(service.toasts()).toEqual(initialToasts);

    tick(5000 + animationDuration); // clean up
  }));

});