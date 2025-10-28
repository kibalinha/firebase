import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';

export const adminGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  // FIX: Explicitly type the router constant to assist TypeScript's type inference.
  const router: Router = inject(Router);
  const toastService = inject(ToastService);

  if (authService.isAdmin()) {
    return true;
  }

  // If not an admin, show a toast and redirect
  toastService.addToast('Acesso negado. Requer permissão de administrador.', 'error');
  return router.parseUrl('/dashboard');
};