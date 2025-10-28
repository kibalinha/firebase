import { Component, ChangeDetectionStrategy, inject, computed, signal, input, Signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormControl } from '@angular/forms';
import { DatabaseService } from '../services/database.service';
import { ToastService } from '../services/toast.service';
import { Technician, Supplier, AlmoxarifadoDB } from '../models';
import { cnpjValidator } from '../validators/cnpj.validator';
import { AuthService } from '../services/auth.service';

type ManagementType = 'technicians' | 'suppliers';
type Entity = Technician | Supplier;
type SortableEntityKey = keyof Technician | keyof Supplier;

interface Config {
  title: string;
  collection: 'technicians' | 'suppliers';
  headers: string[];
  fields: { name: SortableEntityKey, label: string, type: string }[];
}

@Component({
  selector: 'app-management',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-4 sm:p-6 h-full flex flex-col">
      <h2 class="text-2xl font-bold mb-6">Gerenciar {{ config().title }}</h2>

      <div class="flex justify-between items-center mb-4">
        <input 
          type="text" 
          placeholder="Busca..." 
          class="bg-white dark:bg-primary p-2 rounded-md border border-slate-300 dark:border-secondary focus:border-accent focus:outline-none"
          [formControl]="searchControl"
        />
        @if (!authService.isViewer()) {
          <button (click)="openForm()" class="bg-accent text-white px-4 py-2 rounded-md hover:bg-info transition-colors">
            Adicionar {{ config().title.slice(0, -1) }}
          </button>
        }
      </div>

      <div class="flex-grow overflow-auto">
        <!-- Table for desktop -->
        <table class="w-full text-left hidden md:table">
          <thead class="sticky top-0 bg-slate-50 dark:bg-secondary">
            <tr class="border-b border-slate-200 dark:border-slate-600">
              @for(field of config().fields; track field.name) {
                @if (field.type !== 'password') {
                  <th class="p-3 cursor-pointer" (click)="handleSort(field.name)">
                    {{ field.label }}
                    @if (sortColumn() === field.name) {
                      <span class="ml-1">{{ sortDirection() === 'asc' ? '▲' : '▼' }}</span>
                    }
                  </th>
                }
              }
              @if (!authService.isViewer()) {
                <th class="p-3">Ações</th>
              }
            </tr>
          </thead>
          <tbody>
            @for(item of paginatedItems(); track item.id) {
              <tr class="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-primary">
                @for(field of config().fields; track field.name) {
                  @if (field.type !== 'password') {
                    <td class="p-3">{{ $any(item)[field.name] }}</td>
                  }
                }
                @if (!authService.isViewer()) {
                  <td class="p-3 flex items-center space-x-2">
                    <button (click)="openForm(item)" class="p-1 text-slate-500 dark:text-slate-300 hover:text-accent">✏️</button>
                    <button (click)="openDeleteConfirm(item)" class="p-1 text-slate-500 dark:text-slate-300 hover:text-error">🗑️</button>
                  </td>
                }
              </tr>
            } @empty {
              <tr>
                <td [attr.colspan]="config().headers.length + 1" class="p-4 text-center text-slate-500 dark:text-slate-400">Nenhum item encontrado.</td>
              </tr>
            }
          </tbody>
        </table>

         <!-- Cards for mobile -->
        <div class="md:hidden space-y-3">
          @for(item of paginatedItems(); track item.id) {
            <div class="bg-white dark:bg-secondary rounded-lg p-4 shadow">
              <div class="flex justify-between items-start">
                <div>
                  <p class="font-bold text-slate-800 dark:text-slate-100">{{ item.name }}</p>
                  @for(field of config().fields; track field.name) {
                    @if(field.name !== 'name' && field.type !== 'password') {
                      <p class="text-sm text-slate-500 dark:text-slate-400">{{ field.label }}: {{ $any(item)[field.name] }}</p>
                    }
                  }
                </div>
                @if (!authService.isViewer()) {
                  <div class="flex items-center space-x-2 flex-shrink-0">
                    <button (click)="openForm(item)" class="p-1 text-slate-500 dark:text-slate-300 hover:text-accent" title="Editar">✏️</button>
                    <button (click)="openDeleteConfirm(item)" class="p-1 text-slate-500 dark:text-slate-300 hover:text-error" title="Excluir">🗑️</button>
                  </div>
                }
              </div>
            </div>
          } @empty {
            <div class="p-4 text-center text-slate-500 dark:text-slate-400 bg-white dark:bg-secondary rounded-lg">Nenhum item encontrado.</div>
          }
        </div>
      </div>

      <!-- Pagination -->
      <div class="flex justify-between items-center pt-4">
        <span class="text-sm text-slate-500 dark:text-slate-400">
          Mostrando {{ paginatedItems().length }} de {{ sortedItems().length }} itens
        </span>
        <div class="flex gap-2">
          <button [disabled]="currentPage() === 1" (click)="prevPage()" class="px-3 py-1 bg-white dark:bg-secondary rounded disabled:opacity-50">Anterior</button>
          <button [disabled]="currentPage() === totalPages()" (click)="nextPage()" class="px-3 py-1 bg-white dark:bg-secondary rounded disabled:opacity-50">Próximo</button>
        </div>
      </div>
    </div>

    <!-- Form Modal -->
    @if (isFormOpen()) {
      <div class="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-40">
        <div class="bg-white dark:bg-primary p-6 rounded-lg shadow-xl w-full max-w-md">
          <h3 class="text-xl font-bold mb-4">{{ currentEntity()?.id ? 'Editar' : 'Adicionar' }} {{ config().title.slice(0, -1) }}</h3>
          <form [formGroup]="entityForm" (ngSubmit)="saveEntity()">
            <div class="space-y-4">
              @for(field of config().fields; track field.name) {
                <div>
                  <label class="block text-sm mb-1">{{ field.label }}</label>
                  <input 
                    [type]="field.type" 
                    [formControlName]="field.name" 
                    [placeholder]="(type() === 'technicians' && field.name === 'password' && currentEntity()) ? 'Deixe em branco para não alterar' : ''"
                    class="w-full bg-slate-100 dark:bg-secondary p-2 rounded" />
                   @if(entityForm.get(field.name)?.hasError('cnpjInvalid') && entityForm.get(field.name)?.touched) {
                    <small class="text-error text-xs mt-1">{{ entityForm.get(field.name)?.getError('cnpjInvalid') }}</small>
                   }
                   @if(entityForm.get(field.name)?.hasError('minlength') && entityForm.get(field.name)?.touched) {
                    <small class="text-error text-xs mt-1">A senha deve ter pelo menos 4 caracteres.</small>
                   }
                </div>
              }
            </div>
            <div class="flex justify-end gap-4 mt-6 pt-4 border-t border-slate-200 dark:border-secondary">
              <button type="button" (click)="isFormOpen.set(false)" class="px-4 py-2 bg-slate-200 dark:bg-secondary rounded">Cancelar</button>
              <button type="submit" [disabled]="entityForm.invalid" class="px-4 py-2 bg-accent text-white rounded disabled:opacity-50">Salvar</button>
            </div>
          </form>
        </div>
      </div>
    }

    <!-- Delete Confirmation Modal -->
    @if (entityToDelete()) {
      <div class="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
        <div class="bg-white dark:bg-primary p-6 rounded-lg shadow-xl w-full max-w-md">
          <h3 class="text-xl font-bold mb-4">Confirmar Exclusão</h3>
          <p>Tem certeza que deseja excluir "{{ entityToDelete()?.name }}"?</p>
          <div class="flex justify-end gap-4 mt-6">
            <button (click)="entityToDelete.set(null)" class="px-4 py-2 bg-slate-200 dark:bg-secondary rounded">Cancelar</button>
            <button (click)="deleteEntity()" class="px-4 py-2 bg-error text-white rounded">Excluir</button>
          </div>
        </div>
      </div>
    }
  `
})
export class ManagementComponent {
  type = input.required<ManagementType>();
  
  private dbService = inject(DatabaseService);
  private toastService = inject(ToastService);
  private fb: FormBuilder = inject(FormBuilder);
  authService = inject(AuthService);
  db = this.dbService.db;

  searchTerm = signal('');
  searchControl = new FormControl('');
  currentPage = signal(1);
  itemsPerPage = 10;
  sortColumn = signal<SortableEntityKey | ''>('');
  sortDirection = signal<'asc' | 'desc'>('asc');
  
  isFormOpen = signal(false);
  currentEntity = signal<Entity | null>(null);
  entityToDelete = signal<Entity | null>(null);
  entityForm!: FormGroup;

  configs: Record<ManagementType, Config> = {
    technicians: {
      title: 'Técnicos',
      collection: 'technicians',
      headers: ['Nome', 'Matrícula'],
      fields: [
        { name: 'name', label: 'Nome', type: 'text' },
        { name: 'matricula', label: 'Matrícula', type: 'text' },
        { name: 'password', label: 'Senha', type: 'password' },
      ],
    },
    suppliers: {
      title: 'Fornecedores',
      collection: 'suppliers',
      headers: ['Nome', 'Responsável', 'Contato', 'CNPJ', 'Endereço'],
      fields: [
        { name: 'name', label: 'Nome', type: 'text' },
        { name: 'responsibleName', label: 'Nome do Responsável', type: 'text' },
        { name: 'contact', label: 'Contato (E-mail/Telefone)', type: 'text' },
        { name: 'cnpj', label: 'CNPJ', type: 'text' },
        { name: 'address', label: 'Endereço', type: 'text' },
      ],
    },
  };

  config: Signal<Config>;
  items: Signal<Entity[]>;
  filteredItems: Signal<Entity[]>;
  sortedItems: Signal<Entity[]>;
  totalPages: Signal<number>;
  paginatedItems: Signal<Entity[]>;
  
  constructor() {
    this.searchControl.valueChanges.subscribe(value => {
        this.searchTerm.set(value ?? '');
    });

    this.config = computed(() => this.configs[this.type()]);
    this.items = computed(() => this.db()[this.config().collection] as Entity[]);

    this.filteredItems = computed(() => {
      const term = this.searchTerm().toLowerCase();
      if (!term) return this.items();
      return this.items().filter(item => 
        Object.values(item).some(val => String(val).toLowerCase().includes(term))
      );
    });

    this.sortedItems = computed(() => {
      const items = [...this.filteredItems()];
      const column = this.sortColumn();
      const direction = this.sortDirection();

      if (!column) return items;

      return items.sort((a, b) => {
        const aValue = (a as any)[column];
        const bValue = (b as any)[column];

        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return direction === 'asc' 
            ? aValue.localeCompare(bValue) 
            : bValue.localeCompare(aValue);
        }
        return 0;
      });
    });

    this.totalPages = computed(() => Math.ceil(this.sortedItems().length / this.itemsPerPage));

    this.paginatedItems = computed(() => {
      const start = (this.currentPage() - 1) * this.itemsPerPage;
      const end = start + this.itemsPerPage;
      return this.sortedItems().slice(start, end);
    });
  }

  handleSort(column: SortableEntityKey) {
    if (this.sortColumn() === column) {
      if (this.sortDirection() === 'asc') {
        this.sortDirection.set('desc');
      } else {
        this.sortColumn.set('');
      }
    } else {
      this.sortColumn.set(column);
      this.sortDirection.set('asc');
    }
  }

  prevPage() { this.currentPage.update(p => Math.max(1, p - 1)); }
  nextPage() { this.currentPage.update(p => Math.min(this.totalPages(), p + 1)); }

  openForm(entity: Entity | null = null) {
    this.currentEntity.set(entity);
    
    const formControls: { [key: string]: any } = {};
    this.config().fields.forEach(field => {
        const value = field.type === 'password' ? '' : (entity ? (entity as any)[field.name] : '');
        let validators = [Validators.required];
        
        if (this.type() === 'technicians' && field.name === 'password') {
            validators = entity ? [Validators.minLength(4)] : [Validators.required, Validators.minLength(4)];
        } else if (this.type() === 'suppliers' && field.name === 'cnpj') {
            validators.push(cnpjValidator);
        } else if (field.name === 'password' && !entity) {
            validators = [Validators.required, Validators.minLength(4)];
        } else if (field.name === 'password' && entity) {
            validators = [Validators.minLength(4)];
        }

        formControls[field.name] = [value, validators];
    });
    this.entityForm = this.fb.group(formControls);

    this.isFormOpen.set(true);
  }

  openDeleteConfirm(entity: Entity) {
    this.entityToDelete.set(entity);
  }

  async saveEntity() {
    if (this.entityForm.invalid) {
      this.toastService.addToast('Por favor, preencha todos os campos obrigatórios corretamente.', 'error');
      return;
    }
    const collection = this.config().collection;
    const formValue = this.entityForm.value;
    const currentEntityVal = this.currentEntity();
    const typeLabel = this.config().title.slice(0,-1);

    if (currentEntityVal?.id) {
      const updatedEntity = { ...currentEntityVal, ...formValue };
      if (this.type() === 'technicians' && !formValue.password) {
        updatedEntity.password = (currentEntityVal as Technician).password;
      }
      await this.dbService.updateItem(collection, updatedEntity as Entity);
      await this.dbService.logAction(`UPDATE_${collection.toUpperCase()}`, `${typeLabel} '${updatedEntity.name}' (ID: ${updatedEntity.id}) atualizado.`);
    } else {
      const newItem = await this.dbService.addItem(collection, formValue as any);
      await this.dbService.logAction(`CREATE_${collection.toUpperCase()}`, `${typeLabel} '${(newItem as Entity).name}' (ID: ${newItem.id}) criado.`);
    }
    this.toastService.addToast('Salvo com sucesso!', 'success');
    this.isFormOpen.set(false);
  }

  async deleteEntity() {
    const entity = this.entityToDelete();
    if (entity) {
      const collection = this.config().collection;
      const typeLabel = this.config().title.slice(0,-1);
      await this.dbService.deleteItem(collection, entity.id);
      await this.dbService.logAction(`DELETE_${collection.toUpperCase()}`, `${typeLabel} '${entity.name}' (ID: ${entity.id}) removido.`);
      this.toastService.addToast('Excluído com sucesso!', 'success');
      this.entityToDelete.set(null);
    }
  }
}