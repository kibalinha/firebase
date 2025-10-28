import { Component, ChangeDetectionStrategy, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators, FormControl } from '@angular/forms';
import { DatabaseService, KitWithDetails } from '../services/database.service';
import { ToastService } from '../services/toast.service';
import { Kit } from '../models';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-kits',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-4 sm:p-6 h-full flex flex-col">
      <header class="flex justify-between items-start mb-4 gap-2 flex-wrap">
        <div>
            <h2 class="text-2xl font-bold">Gerenciar Kits</h2>
            <p class="text-sm text-slate-500 dark:text-slate-400">Crie e gerencie conjuntos de itens para facilitar as retiradas.</p>
        </div>
        <div class="flex gap-2 flex-wrap">
            <button (click)="openKitForm()" class="bg-accent text-white px-4 py-2 rounded-md hover:bg-info transition-colors">
              + Criar Kit
            </button>
        </div>
      </header>
      
      <!-- Kits List -->
      <div class="flex-grow overflow-auto">
        @if (kits().length > 0) {
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              @for(kit of kits(); track kit.id) {
                <div class="bg-white dark:bg-primary p-4 rounded-lg shadow-md flex flex-col">
                  <div class="flex-grow">
                    <div class="flex justify-between items-start">
                      <h3 class="font-bold text-lg mb-2">{{ kit.name }}</h3>
                      <div class="flex items-center space-x-2">
                        <button (click)="openKitForm(kit)" class="p-1 text-slate-500 dark:text-slate-300 hover:text-accent" title="Editar Kit">✏️</button>
                        <button (click)="openDeleteConfirm(kit)" class="p-1 text-slate-500 dark:text-slate-300 hover:text-error" title="Excluir Kit">🗑️</button>
                      </div>
                    </div>
                    <p class="text-xs text-slate-400 mb-3">ID: {{ kit.id }}</p>

                    <h4 class="text-sm font-semibold mb-2">Componentes:</h4>
                    <ul class="text-sm space-y-1 list-disc list-inside text-slate-600 dark:text-slate-300">
                      @for(component of kit.components; track component.itemId) {
                        <li>{{ getItemName(component.itemId) }} (x{{component.quantity}})</li>
                      }
                    </ul>
                  </div>
                  <div class="mt-4 pt-4 border-t border-slate-200 dark:border-secondary text-center">
                    <p class="text-sm text-slate-500 dark:text-slate-400">Disponível para montar:</p>
                    <p class="text-2xl font-bold text-accent">{{ kit.availableQuantity }}</p>
                  </div>
                </div>
              }
          </div>
        } @else {
          <div class="col-span-full text-center p-10 text-slate-500 dark:text-slate-400 bg-white dark:bg-primary rounded-lg flex flex-col items-center justify-center h-full border-2 border-dashed border-slate-300 dark:border-secondary">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 text-slate-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
                <path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <h3 class="text-lg font-semibold text-slate-700 dark:text-slate-200">Nenhum kit criado ainda</h3>
              <p class="text-sm mt-1">Kits são conjuntos de itens que podem ser retirados de uma só vez.</p>
              <button (click)="openKitForm()" class="mt-4 bg-accent text-white px-4 py-2 rounded-md hover:bg-info transition-colors text-sm">
                + Criar seu primeiro Kit
              </button>
          </div>
        }
      </div>
    </div>

    <!-- Kit Form Modal -->
    @if (isFormOpen()) {
      <div class="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-40">
        <div class="bg-white dark:bg-primary p-6 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
          <h3 class="text-xl font-bold mb-4">{{ currentKit()?.id ? 'Editar' : 'Criar' }} Kit</h3>
          
          <form [formGroup]="kitForm" (ngSubmit)="saveKit()" class="flex-grow overflow-y-auto pr-2">
            <div>
              <label class="block text-sm mb-1">Nome do Kit</label>
              <input type="text" formControlName="name" class="w-full bg-slate-100 dark:bg-secondary p-2 rounded mb-4" />
            </div>

            <h4 class="text-lg font-semibold mb-2">Componentes</h4>
            <div formArrayName="components" class="space-y-2">
              @for(componentGroup of componentsArray.controls; track $index) {
                <div [formGroupName]="$index" class="flex items-center gap-2 bg-slate-50 dark:bg-secondary p-2 rounded">
                  <div class="flex-grow">
                    <select formControlName="itemId" class="w-full bg-white dark:bg-primary p-2 rounded">
                      <option [ngValue]="null">Selecione um item</option>
                      @for (item of allItems(); track item.id) {
                        <option [value]="item.id">{{ item.name }} (Estoque: {{item.quantity}})</option>
                      }
                    </select>
                  </div>
                  <div>
                    <input type="number" formControlName="quantity" min="1" class="w-20 bg-white dark:bg-primary p-2 rounded">
                  </div>
                  <button type="button" (click)="removeComponent($index)" class="p-1 text-slate-400 hover:text-error transition-colors">🗑️</button>
                </div>
              }
            </div>

            <button type="button" (click)="addComponent()" class="mt-2 text-sm text-accent hover:underline">+ Adicionar Componente</button>

            <div class="flex justify-end gap-4 mt-6 pt-4 border-t border-slate-200 dark:border-secondary">
              <button type="button" (click)="closeKitForm()" class="px-4 py-2 bg-slate-200 dark:bg-secondary rounded">Cancelar</button>
              <button type="submit" [disabled]="kitForm.invalid" class="px-4 py-2 bg-accent text-white rounded disabled:opacity-50">Salvar Kit</button>
            </div>
          </form>
        </div>
      </div>
    }

     <!-- Delete Confirmation Modal -->
    @if (kitToDelete()) {
      <div class="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
        <div class="bg-white dark:bg-primary p-6 rounded-lg shadow-xl w-full max-w-md">
          <h3 class="text-xl font-bold mb-4">Confirmar Exclusão</h3>
          <p>Tem certeza que deseja excluir o kit "{{ kitToDelete()?.name }}"? Esta ação não pode ser desfeita.</p>
          <div class="flex justify-end gap-4 mt-6">
            <button (click)="kitToDelete.set(null)" class="px-4 py-2 bg-slate-200 dark:bg-secondary rounded">Cancelar</button>
            <button (click)="deleteKit()" class="px-4 py-2 bg-error text-white rounded">Excluir</button>
          </div>
        </div>
      </div>
    }
  `
})
export class KitsComponent {
  private dbService = inject(DatabaseService);
  private toastService = inject(ToastService);
  private fb: FormBuilder = inject(FormBuilder);
  private authService = inject(AuthService);

  kits = this.dbService.kitsWithDetails;
  isFormOpen = signal(false);
  currentKit = signal<Kit | null>(null);
  kitToDelete = signal<Kit | null>(null);
  kitForm!: FormGroup;
  
  allItems = computed(() => 
    this.dbService.db().items.slice().sort((a,b) => a.name.localeCompare(b.name))
  );

  get componentsArray(): FormArray {
    return this.kitForm.get('components') as FormArray;
  }

  getItemName(itemId: string): string {
    return this.allItems().find(i => i.id === itemId)?.name || 'Item desconhecido';
  }

  openKitForm(kit: Kit | null = null) {
    this.currentKit.set(kit);
    this.kitForm = this.fb.group({
      name: [kit?.name || '', Validators.required],
      components: this.fb.array(
        kit?.components.map(c => this.createComponentGroup(c.itemId, c.quantity)) || [],
        Validators.minLength(1)
      )
    });
    if (!kit) {
      this.addComponent(); // Add one empty component row for new kits
    }
    this.isFormOpen.set(true);
  }
  
  closeKitForm() {
    this.isFormOpen.set(false);
  }

  createComponentGroup(itemId: string | null, quantity: number | null): FormGroup {
    return this.fb.group({
      itemId: [itemId, Validators.required],
      quantity: [quantity, [Validators.required, Validators.min(1)]]
    });
  }

  addComponent() {
    this.componentsArray.push(this.createComponentGroup(null, 1));
  }
  
  removeComponent(index: number) {
    this.componentsArray.removeAt(index);
  }

  async saveKit() {
    if (this.kitForm.invalid) {
      this.toastService.addToast('Formulário inválido. Verifique o nome e os componentes.', 'error');
      return;
    };

    const formValue = this.kitForm.value;
    
    if (this.currentKit()?.id) {
      const kitData = { ...this.currentKit(), ...formValue };
      await this.dbService.updateItem('kits', kitData as Kit);
      await this.dbService.logAction('UPDATE_KIT', `Kit '${kitData.name}' (ID: ${kitData.id}) atualizado.`);
      this.toastService.addToast('Kit atualizado com sucesso!', 'success');
    } else {
      // FIX: Explicitly type the return of addItem to ensure newKit has all properties of Kit.
      const newKit = await this.dbService.addItem<Kit>('kits', formValue);
      const itemsDetails = newKit.components.map(c => `${c.quantity}x '${this.getItemName(c.itemId)}'`).join(', ');
      await this.dbService.logAction('CREATE_KIT', `Kit '${newKit.name}' (ID: ${newKit.id}) criado com componentes: ${itemsDetails}.`);
      this.toastService.addToast('Kit criado com sucesso!', 'success');
    }
    this.closeKitForm();
  }
  
  openDeleteConfirm(kit: Kit) {
    this.kitToDelete.set(kit);
  }

  async deleteKit() {
    const kit = this.kitToDelete();
    if (kit) {
      await this.dbService.deleteItem('kits', kit.id);
      await this.dbService.logAction('DELETE_KIT', `Kit '${kit.name}' (ID: ${kit.id}) excluído.`);
      this.toastService.addToast('Kit excluído com sucesso!', 'success');
      this.kitToDelete.set(null);
    }
  }
}
