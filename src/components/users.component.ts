import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray, FormControl } from '@angular/forms';
import { DatabaseService } from '../services/database.service';
import { ToastService } from '../services/toast.service';
import { User, UserRole, Permission, ALL_PERMISSIONS } from '../models';
import { AuthService } from '../services/auth.service';

type UIRole = 'Administrador' | 'Gerente' | 'Operador' | 'Visualizador' | 'Personalizado';

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
                    <div>
                      <h3 class="font-bold text-lg">{{ user.name }}</h3>
                      <p class="text-sm text-slate-500 dark:text-slate-400">{{ user.username }}</p>
                    </div>
                    <div class="flex items-center space-x-2">
                       <button (click)="openForm(user)" class="p-1 text-slate-500 dark:text-slate-300 hover:text-accent" title="Editar">✏️</button>
                       @if (user.id !== 'user-admin-default') {
                        <button (click)="openDeleteConfirm(user)" class="p-1 text-slate-500 dark:text-slate-300 hover:text-error" title="Excluir">🗑️</button>
                       }
                    </div>
                  </div>
                  <span class="mt-2 px-2 py-1 rounded-full text-xs font-semibold self-start"
                    [class.bg-accent/20]="user.role === UserRole.Admin" [class.text-accent]="user.role === UserRole.Admin"
                    [class.bg-sky-100]="user.role === UserRole.User" [class.text-sky-800]="user.role === UserRole.User"
                    [class.dark:bg-sky-900]="user.role === UserRole.User" [class.dark:text-sky-200]="user.role === UserRole.User"
                    [class.bg-slate-200]="user.role === UserRole.Viewer" [class.text-slate-800]="user.role === UserRole.Viewer"
                    [class.dark:text-slate-200]="user.role === UserRole.Viewer"
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
        <div class="bg-white dark:bg-primary p-6 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
          <h3 class="text-xl font-bold mb-4">{{ currentUser()?.id ? 'Editar' : 'Novo' }} Usuário</h3>
          <form [formGroup]="userForm" (ngSubmit)="saveUser()" class="flex-grow overflow-y-auto pr-2">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm mb-1">Nome Completo</label>
                <input type="text" formControlName="name" class="w-full bg-slate-100 dark:bg-secondary p-2 rounded">
              </div>
              <div>
                <label class="block text-sm mb-1">Nome de Usuário (para login)</label>
                <input type="text" formControlName="username" class="w-full bg-slate-100 dark:bg-secondary p-2 rounded">
              </div>
              <div>
                <label class="block text-sm mb-1">Senha</label>
                <input type="password" formControlName="password" [placeholder]="currentUser()?.id ? 'Deixe em branco para não alterar' : ''" class="w-full bg-slate-100 dark:bg-secondary p-2 rounded">
              </div>
              <div>
                <label class="block text-sm mb-1">Perfil de Permissões</label>
                <select [formControl]="uiRoleControl" class="w-full bg-slate-100 dark:bg-secondary p-2 rounded">
                  @for (role of uiRoles; track role) {
                    <option [value]="role">{{ role }}</option>
                  }
                </select>
              </div>
            </div>
            
            <h4 class="text-lg font-semibold mt-6 mb-2">Permissões Detalhadas</h4>
            @if (uiRoleControl.value === 'Administrador') {
              <div class="p-4 bg-sky-100 dark:bg-sky-900/50 rounded-md text-sky-800 dark:text-sky-200 text-sm">
                Administradores têm acesso irrestrito a todas as funcionalidades.
              </div>
            } @else {
              <div class="space-y-2" formArrayName="permissions">
                @for(group of permissionGroups(); track group[0]) {
                  <details class="p-2 rounded-lg bg-slate-50 dark:bg-secondary/50 border border-slate-200 dark:border-secondary" open>
                    <summary class="font-semibold cursor-pointer text-slate-800 dark:text-slate-100">{{ group[0] }}</summary>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 pt-2 pl-4">
                        @for(permission of group[1]; track permission.id) {
                            @if(getPermissionControl(permission.id); as control) {
                                 <label class="flex items-center gap-2 p-1">
                                    <input type="checkbox" [formControl]="control" class="h-4 w-4 rounded text-accent focus:ring-accent disabled:opacity-50">
                                    <span class="text-sm">{{ permission.label }}</span>
                                </label>
                            }
                        }
                    </div>
                  </details>
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
  private fb: FormBuilder = inject(FormBuilder);
  private authService = inject(AuthService);
  db = this.dbService.db;

  UserRole = UserRole;
  uiRoles: UIRole[] = ['Administrador', 'Gerente', 'Operador', 'Visualizador', 'Personalizado'];
  allPermissions = ALL_PERMISSIONS;

  isFormOpen = signal(false);
  currentUser = signal<User | null>(null);
  userToDelete = signal<User | null>(null);
  userForm!: FormGroup;
  uiRoleControl = new FormControl<UIRole>('Personalizado', { nonNullable: true });

  permissionGroups = computed(() => {
    const groups = this.allPermissions.reduce((acc, p) => {
        (acc[p.group] = acc[p.group] || []).push(p);
        return acc;
    }, {} as Record<string, typeof ALL_PERMISSIONS>);
    return Object.entries(groups);
  });

  roleTemplates: Record<UIRole, Permission[]> = {
    Administrador: [],
    Visualizador: ['dashboard', 'inventory', 'red_shelf', 'reports', 'audit_log', 'item_lifecycle'],
    Operador: ['dashboard', 'inventory', 'red_shelf', 'entry', 'exit', 'picking_lists', 'cycle_count', 'stocktake', 'kiosk', 'kits', 'reservations', 'item_lifecycle'],
    Gerente: ['dashboard', 'inventory', 'red_shelf', 'entry', 'exit', 'picking_lists', 'cycle_count', 'stocktake', 'kiosk', 'kits', 'reservations', 'purchase_orders', 'purchase_suggestion', 'suppliers', 'reports', 'anomaly_detection', 'demand_estimation', 'technicians', 'audit_log', 'item_lifecycle'],
    Personalizado: []
  };

  constructor() {
    this.uiRoleControl.valueChanges.subscribe(uiRole => this.applyRoleTemplate(uiRole));
  }

  get permissions(): FormArray {
    return this.userForm.get('permissions') as FormArray;
  }

  getPermissionControl(permissionId: Permission): FormControl | null {
    const index = this.allPermissions.findIndex(p => p.id === permissionId);
    if (index === -1) return null;
    return this.permissions.at(index) as FormControl;
  }

  openForm(user: User | null = null) {
    this.currentUser.set(user);
    
    let uiRole: UIRole = 'Personalizado';
    if (user) {
        if (user.role === UserRole.Admin) uiRole = 'Administrador';
        else if (user.role === UserRole.Viewer) uiRole = 'Visualizador';
    }
    this.uiRoleControl.setValue(uiRole, { emitEvent: false });

    this.userForm = this.fb.group({
      name: [user?.name || '', Validators.required],
      username: [user?.username || '', Validators.required],
      password: ['', user?.id ? [Validators.minLength(6)] : [Validators.required, Validators.minLength(6)]],
      permissions: this.fb.array(this.allPermissions.map(p => 
        (user?.role === UserRole.Admin) || (user?.permissions.includes(p.id)) || false
      ))
    });

    this.applyRoleTemplate(uiRole);
    this.isFormOpen.set(true);
  }

  applyRoleTemplate(uiRole: UIRole) {
    if (!this.userForm) return;
    const permissionsArray = this.permissions;
    const isReadOnly = uiRole === 'Administrador' || uiRole === 'Gerente' || uiRole === 'Operador' || uiRole === 'Visualizador';
    
    if (isReadOnly) {
      permissionsArray.disable();
    } else {
      permissionsArray.enable();
    }
    
    const template = this.roleTemplates[uiRole];
    const newPermissionsValue = this.allPermissions.map(p => 
        uiRole === 'Administrador' || template.includes(p.id)
    );
    permissionsArray.setValue(newPermissionsValue);
  }

  openDeleteConfirm(user: User) {
    this.userToDelete.set(user);
  }

  async saveUser() {
    if (this.userForm.invalid) return;

    const formValue = this.userForm.getRawValue(); // Use getRawValue to get disabled control values
    const current = this.currentUser();
    const uiRole = this.uiRoleControl.value;

    let dbRole: UserRole;
    switch(uiRole) {
        case 'Administrador': dbRole = UserRole.Admin; break;
        case 'Visualizador': dbRole = UserRole.Viewer; break;
        default: dbRole = UserRole.User; break;
    }
    
    const selectedPermissions = dbRole === UserRole.User 
        ? this.allPermissions.filter((p, i) => formValue.permissions[i]).map(p => p.id)
        : this.roleTemplates[uiRole];

    const userData = {
      ...current,
      name: formValue.name,
      username: formValue.username,
      role: dbRole,
      permissions: dbRole === UserRole.Admin ? [] : selectedPermissions,
      passwordHash: formValue.password ? btoa(formValue.password) : current?.passwordHash
    };

    if (current?.id) {
      await this.dbService.updateItem('users', userData as User);
      await this.dbService.logAction('UPDATE_USER', `Usuário '${userData.name}' (${userData.username}) atualizado. Perfil: '${dbRole}'.`);
      this.toastService.addToast(`Usuário "${userData.name}" atualizado.`, 'success');
    } else {
      // FIX: Explicitly type the return of addItem to ensure newUser has all properties of User.
      const newUser = await this.dbService.addItem<User>('users', userData);
      await this.dbService.logAction('CREATE_USER', `Usuário '${newUser.name}' (${newUser.username}) criado com o perfil '${dbRole}'.`);
      this.toastService.addToast(`Usuário "${userData.name}" criado.`, 'success');
    }
    this.isFormOpen.set(false);
  }

  async deleteUser() {
    const user = this.userToDelete();
    if (user && user.id !== 'user-admin-default') {
      await this.dbService.deleteItem('users', user.id);
      await this.dbService.logAction('DELETE_USER', `Usuário '${user.name}' (${user.username}, ID: ${user.id}) excluído.`);
      this.toastService.addToast(`Usuário "${user.username}" excluído.`, 'success');
    }
    this.userToDelete.set(null);
  }
}
