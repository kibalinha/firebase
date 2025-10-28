import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup, FormControl } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-center justify-center min-h-screen bg-slate-100 dark:bg-slate-900 px-4">
      <div class="w-full max-w-md">
        <div class="bg-white dark:bg-primary shadow-2xl rounded-2xl p-8 space-y-6">
          <div class="text-center">
            <h1 class="text-3xl font-bold text-slate-800 dark:text-slate-100">Bem-vindo</h1>
            <p class="text-slate-500 dark:text-slate-400">Faça login para acessar o sistema</p>
          </div>
          <form [formGroup]="loginForm" (ngSubmit)="login()" class="space-y-4">
            <div>
              <label for="username" class="block text-sm font-medium text-slate-700 dark:text-slate-300">Usuário</label>
              <input 
                id="username" 
                type="text" 
                formControlName="username"
                class="mt-1 block w-full px-3 py-2 bg-white dark:bg-secondary border border-slate-300 dark:border-slate-600 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-accent focus:border-accent sm:text-sm"
                placeholder="ex: admin"
              >
            </div>
            <div>
              <label for="password" class="block text-sm font-medium text-slate-700 dark:text-slate-300">Senha</label>
              <input 
                id="password" 
                type="password"
                formControlName="password" 
                class="mt-1 block w-full px-3 py-2 bg-white dark:bg-secondary border border-slate-300 dark:border-slate-600 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-accent focus:border-accent sm:text-sm"
                placeholder="••••••••"
              >
            </div>
            <div>
              <button 
                type="submit" 
                [disabled]="isLoading() || loginForm.invalid"
                class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-accent hover:bg-info focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent disabled:opacity-50"
              >
                @if (isLoading()) {
                  <div class="w-5 h-5 border-2 border-slate-400 border-t-white rounded-full animate-spin"></div>
                } @else {
                  <span>Entrar</span>
                }
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `,
})
export class LoginComponent {
  private fb: FormBuilder = inject(FormBuilder);
  private authService = inject(AuthService);
  // FIX: Explicitly type the router property to assist TypeScript's type inference.
  private router: Router = inject(Router);
  private toastService = inject(ToastService);

  isLoading = signal(false);

  loginForm = this.fb.group({
    username: ['', Validators.required],
    password: ['', Validators.required]
  });

  async login() {
    if (this.loginForm.invalid) {
      return;
    }
    this.isLoading.set(true);

    const { username, password } = this.loginForm.value;
    const success = await this.authService.login(username!, password!);

    this.isLoading.set(false);

    if (success) {
      this.router.navigate(['/dashboard']);
    } else {
      this.toastService.addToast('Usuário ou senha inválidos.', 'error');
    }
  }
}