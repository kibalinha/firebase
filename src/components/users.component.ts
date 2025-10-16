import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { DatabaseService } from '../services/database.service';
import { ToastService } from '../services/toast.service';
import { User, UserRole, Permission, ALL_PERMISSIONS } from '../models';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-4 sm:p-6 h-full flex flex-col">
      <header class="flex justify-between items-start mb-4 gap-2 flex-wrap">
        <div>
            <h2 class="text-2xl font-bold">Gerenciar Usuários</h2>
            <p class="text-sm text-slate-500 dark:text-slate-400">Crie e edite usuários e suas permissões de acesso.</p>
        </div>
        <button (click)="openForm()" class="bg-accent text-white px-4 py-2 rounded-md hover:bg-info transition-colors">
          + Novo Usuário
        </button>
      </header>

      <div class="flex-grow overflow-auto">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            @for(user of db().users; track user.id) {
              <div class="bg-white dark:bg-primary p-4 rounded-lg shadow-md flex flex-col">
                <div class="flex-grow">
                  <div class="flex justify-between items-start">
                    <h3 class="font-bold text-lg mb-2">{{ user.username }}</h3>
                    <div class="flex items-center space-x-2">
                       <button (click)="openForm(user)" class="p-1 text-slate-500 dark:text-slate-300 hover:text-accent" title="Editar">✏️</button>
                       @if (user.id !== 'user-admin-default') {
                        <button (click)="openDeleteConfirm(user)" class="p-1 text-slate-500 dark:text-slate-300 hover:text-error" title="Excluir">🗑️</button>
                       }
                    </div>
                  </div>
                  <span class="px-2 py-1 rounded-full text-xs font-semibold"
                    [class.bg-accent/20]="user.role === UserRole.Admin" [class.text-accent]="user.role === UserRole.Admin"
                    [class.bg-slate-200]="user.role !== UserRole.Admin" [class.text-slate-800]="user.role !== UserRole.Admin"
                    [class.dark:text-slate-200]="user.role !== UserRole.Admin"
                  >{{ user.role }}</span>
                </div>
              </div>
            }
        </div>
      </div>
    </div>

    <!-- Form Modal -->
    @if (isFormOpen()) {
      <div class="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-40">
        <div class="bg-white dark:bg-primary p-6 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
          <h3 class="text-xl font-bold mb-4">{{ currentUser()?.id ? 'Editar' : 'Novo' }} Usuário</h3>
          <form [formGroup]="userForm" (ngSubmit)="saveUser()" class="flex-grow overflow-y-auto pr-2">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm mb-1">Nome de Usuário</label>
                <input type="text" formControlName="username" class="w-full bg-slate-100 dark:bg-secondary p-2 rounded">
              </div>
              <div>
                <label class="block text-sm mb-1">Senha</label>
                <input type="password" formControlName="password" [placeholder]="currentUser()?.id ? 'Deixe em branco para não alterar' : ''" class="w-full bg-slate-100 dark:bg-secondary p-2 rounded">
              </div>
              <div class="md:col-span-2">
                <label class="block text-sm mb-1">Função</label>
                <select formControlName="role" class="w-full bg-slate-100 dark:bg-secondary p-2 rounded">
                  @for (role of userRoles; track role) {
                    <option [value]="role">{{ role }}</option>
                  }
                </select>
              </div>
            </div>
            
            <h4 class="text-lg font-semibold mt-6 mb-2">Permissões</h4>
            @if (userForm.get('role')?.value === UserRole.Admin) {
              <div class="p-4 bg-sky-100 dark:bg-sky-900/50 rounded-md text-sky-800 dark:text-sky-200 text-sm">
                Administradores têm acesso a todas as funcionalidades.
              </div>
            } @else {
              <div class="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm" formArrayName="permissions">
                @for(permission of permissions.controls; track $index) {
                  <label class="flex items-center gap-2 p-2 bg-slate-50 dark:bg-secondary rounded-md">
                    <input type="checkbox" [formControlName]="$index" class="h-4 w-4 rounded text-accent focus:ring-accent">
                    <span>{{ allPermissions[$index].label }}</span>
                  </label>
                }
              </div>
            }

            <div class="flex justify-end gap-4 mt-6 pt-4 border-t border-slate-200 dark:border-secondary">
              <button type="button" (click)="isFormOpen.set(false)" class="px-4 py-2 bg-slate-200 dark:bg-secondary rounded">Cancelar</button>
              <button type="submit" [disabled]="userForm.invalid" class="px-4 py-2 bg-accent text-white rounded disabled:opacity-50">Salvar</button>
            </div>
          </form>
        </div>
      </div>
    }

    <!-- Delete Confirmation -->
    @if(userToDelete()) {
      <div class="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
        <div class="bg-white dark:bg-primary p-6 rounded-lg shadow-xl w-full max-w-md">
          <h3 class="text-xl font-bold mb-4">Confirmar Exclusão</h3>
          <p>Tem certeza que deseja excluir o usuário "{{ userToDelete()!.username }}"?</p>
          <div class="flex justify-end gap-4 mt-6">
            <button (click)="userToDelete.set(null)" class="px-4 py-2 bg-slate-200 dark:bg-secondary rounded">Cancelar</button>
            <button (click)="deleteUser()" class="px-4 py-2 bg-error text-white rounded">Excluir</button>
          </div>
        </div>
      </div>
    }
  `
})
export class UsersComponent {
  private dbService = inject(DatabaseService);
  private toastService = inject(ToastService);
  private fb = inject(FormBuilder);
  db = this.dbService.db;

  UserRole = UserRole;
  userRoles = Object.values(UserRole);
  allPermissions = ALL_PERMISSIONS;

  isFormOpen = signal(false);
  currentUser = signal<User | null>(null);
  userToDelete = signal<User | null>(null);
  userForm!: FormGroup;

  get permissions(): FormArray {
    return this.userForm.get('permissions') as FormArray;
  }

  openForm(user: User | null = null) {
    this.currentUser.set(user);
    this.userForm = this.fb.group({
      username: [user?.username || '', Validators.required],
      password: ['', user ? [] : [Validators.required, Validators.minLength(6)]],
      role: [user?.role || UserRole.User, Validators.required],
      permissions: this.fb.array(this.allPermissions.map(p => 
        user?.permissions.includes(p.id) || false
      ))
    });

    // Disable permissions if role is admin
    this.userForm.get('role')?.valueChanges.subscribe(role => {
      const permissionsArray = this.userForm.get('permissions');
      if (role === UserRole.Admin) {
        permissionsArray?.disable();
      } else {
        permissionsArray?.enable();
      }
    });

    if (user?.role === UserRole.Admin) {
      this.userForm.get('permissions')?.disable();
    }

    this.isFormOpen.set(true);
  }

  openDeleteConfirm(user: User) {
    this.userToDelete.set(user);
  }

  async saveUser() {
    if (this.userForm.invalid) return;

    const formValue = this.userForm.value;
    const current = this.currentUser();

    const selectedPermissions = this.allPermissions
      .filter((p, i) => formValue.permissions[i])
      .map(p => p.id);
    
    const userData = {
      ...current,
      username: formValue.username,
      role: formValue.role,
      permissions: formValue.role === UserRole.Admin ? [] : selectedPermissions,
      passwordHash: formValue.password ? btoa(formValue.password) : current?.passwordHash
    };

    if (current?.id) {
      await this.dbService.updateItem('users', userData as User);
      this.toastService.addToast(`Usuário "${userData.username}" atualizado.`, 'success');
    } else {
      await this.dbService.addItem('users', userData);
      this.toastService.addToast(`Usuário "${userData.username}" criado.`, 'success');
    }

    this.isFormOpen.set(false);
  }

  async deleteUser() {
    const user = this.userToDelete();
    if (user && user.id !== 'user-admin-default') {
      await this.dbService.deleteItem('users', user.id);
      this.toastService.addToast(`Usuário "${user.username}" excluído.`, 'success');
    }
    this.userToDelete.set(null);
  }
}
