import { Injectable, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { DatabaseService } from './database.service';
// FIX: Import 'View' type to resolve 'Cannot find name' error.
import { User, UserRole, Permission, View } from '../models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private dbService = inject(DatabaseService);
  private router = inject(Router);

  currentUser = signal<User | null>(this.loadUserFromSession());

  isAuthenticated = computed(() => !!this.currentUser());
  isAdmin = computed(() => this.currentUser()?.role === UserRole.Admin);

  constructor() {
    // This effect ensures that if the user is cleared from another tab (e.g., logout),
    // the current tab's state reflects that change.
    window.addEventListener('storage', (event) => {
      if (event.key === 'currentUser' && event.storageArea === sessionStorage) {
        this.currentUser.set(this.loadUserFromSession());
        if (!this.currentUser()) {
          this.router.navigate(['/login']);
        }
      }
    });
  }

  private loadUserFromSession(): User | null {
    const userJson = sessionStorage.getItem('currentUser');
    try {
      return userJson ? JSON.parse(userJson) : null;
    } catch (e) {
      return null;
    }
  }

  private saveUserToSession(user: User | null) {
    if (user) {
      sessionStorage.setItem('currentUser', JSON.stringify(user));
    } else {
      sessionStorage.removeItem('currentUser');
    }
  }

  async login(username: string, password_plaintext: string): Promise<boolean> {
    const users = this.dbService.db().users;
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());

    // In a real app, you would send the password to a backend to compare hashes.
    // Here, we "decode" the base64 stored in local storage for demonstration.
    if (user && atob(user.passwordHash) === password_plaintext) {
      this.currentUser.set(user);
      this.saveUserToSession(user);
      await this.dbService.logAction('USER_LOGIN', `Usuário '${user.username}' logado.`, user.username);
      return true;
    }

    this.logout();
    return false;
  }

  logout() {
    const user = this.currentUser();
    if(user) {
        this.dbService.logAction('USER_LOGOUT', `Usuário '${user.username}' deslogado.`, user.username);
    }
    this.currentUser.set(null);
    this.saveUserToSession(null);
    this.router.navigate(['/login']);
  }

  hasPermission(permission: Permission): boolean {
    const user = this.currentUser();
    if (!user) return false;
    // Admins can do anything, regardless of the permissions array
    if (user.role === UserRole.Admin) return true; 
    return user.permissions.includes(permission);
  }

  canAccess(view: View): boolean {
    // Special case: dashboard is the default landing page for all users
    if (view === 'dashboard') return true; 
    return this.hasPermission(view);
  }
}