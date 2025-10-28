import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  // FIX: Explicitly type the router constant to assist TypeScript's type inference.
  const router: Router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  // Redirect to the login page if not authenticated
  return router.parseUrl('/login');
};