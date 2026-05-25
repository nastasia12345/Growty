import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Protects routes that require authentication.
 * Redirects unauthenticated users to /sign-in instead of showing a blank page.
 */
export const authGuard: CanActivateFn = () => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  if (auth.isLoggedIn) return true;

  // Not authenticated — send to home page where the login modal lives
  return router.createUrlTree(['/']);
};
