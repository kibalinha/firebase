import { Component, ChangeDetectionStrategy, inject, computed, signal, output } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DatabaseService } from '../services/database.service';
import { ToastService } from '../services/toast.service';
import { Item, RedShelfItem, View, StrategicSector } from '../models';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-red-shelf',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-4 sm:p-6 h-full flex flex-col">
      <header class="flex justify-between items-start mb-4 gap-2 flex-wrap">
        <div>
          <h2 class="text-2xl font-bold">Prateleira Vermelha</h2>
          <p class="text-sm text-slate-500 dark:text-slate-400">Itens importantes para setores específicos, usados em ocasiões especiais.</p>
        </div>
        @if (!authService.isViewer()) {
          <button (click)="openForm()" class="bg-accent text-white px-4 py-2 rounded-md hover:bg-info transition-colors">
            + Adicionar Item
          </button>
        }
      </header>
      
      <div class="flex-grow overflow-auto">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            @for(item of redShelfItems(); track item.id) {
              <div class="bg-white dark:bg-primary p-4 rounded-lg shadow-md flex flex-col border-l-4" [class]="sectorBorderColor(item.sector)">
                <div class="flex-grow">
                  <div class="flex justify-between items-start">
                    <h3 class="font-bold text-lg mb-1">{{ item.name }}</h3>
                    @if (!authService.isViewer()) {
                      <div class="flex items-center space-x-2">
                        <button (click)="openForm(item)" class="p-1 text-slate-500 dark:text-slate-300 hover:text-accent" title="Editar Item">✏️</button>
                        <button (click)="openDeleteConfirm(item)" class="p-1 text-slate-500 dark:text-slate-300 hover:text-error" title="Excluir Item">🗑️</button>
                      </div>
                    }
                  </div>
                   <p class="text-xs text-slate-400 mb-3">Adicionado em: {{ item.createdAt | date:'dd/MM/yyyy' }}</p>

                  <p class="text-sm text-slate-600 dark:text-slate-300">
                    <strong>Setor:</strong> {{ item.sector }}
                  </p>
                  <p class="text-sm text-slate-600 dark:text-slate-300">
                    <strong>Quantidade:</strong> {{ item.quantity }}
                  </p>
                  @if (item.notes) {
                    <p class="text-sm mt-2 pt-2 border-t border-dashed border-slate-200 dark:border-secondary italic text-slate-500">"{{ item.notes }}"</p>
                  }
                </div>
                @if (!authService.isViewer()) {
                  <div class="mt-4 pt-4 border-t border-slate-200 dark:border-secondary text-right">
                    <button (click)="openAdjustmentModal(item)" class="bg-amber-600 text-white px-4 py-2 rounded-md hover:bg-amber-700 text-sm">
                      Ajustar Estoque
                    </button>
                  </div>
                }
              </div>
            } @empty {
              <div class="col-span-full text-center p-10 text-slate-500 dark:text-slate-400 bg-white dark:bg-primary rounded-lg">
                <p>A Prateleira Vermelha está vazia.</p>
              </div>
            }
        </div>
      </div>
    </div>

    <!-- Add/Edit Form Modal -->
    @if(isFormOpen()) {
      <div class="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-40">
        <div class="bg-white dark:bg-primary p-6 rounded-lg shadow-xl w-full max-w-lg">
            <h3 class="text-xl font-bold mb-4">{{ currentItem() ? 'Editar' : 'Adicionar' }} Item à Prateleira Vermelha</h3>
            <form [formGroup]="itemForm" (ngSubmit)="saveItem()">
                <div class="space-y-4">
                    <input type="text" formControlName="name" placeholder="Nome do Item" class="w-full bg-slate-100 dark:bg-secondary p-2 rounded">
                    <select formControlName="sector" class="w-full bg-slate-100 dark:bg-secondary p-2 rounded">
                        @for (sector of sectorOptions; track sector) {
                          <option [value]="sector">{{sector}}</option>
                        }
                    </select>
                    <input type="number" formControlName="quantity" placeholder="Quantidade" class="w-full bg-slate-100 dark:bg-secondary p-2 rounded">
                    <textarea formControlName="description" placeholder="Descrição" rows="2" class="w-full bg-slate-100 dark:bg-secondary p-2 rounded"></textarea>
                    <textarea formControlName="notes" placeholder="Notas (opcional)" rows="2" class="w-full bg-slate-100 dark:bg-secondary p-2 rounded"></textarea>
                </div>
                <div class="flex justify-end gap-4 mt-6">
                    <button type="button" (click)="isFormOpen.set(false)" class="px-4 py-2 bg-slate-200 dark:bg-secondary rounded">Cancelar</button>
                    <button type="submit" [disabled]="itemForm.invalid" class="px-4 py-2 bg-accent text-white rounded disabled:opacity-50">Salvar Item</button>
                </div>
            </form>
        </div>
      </div>
    }

     <!-- Stock Adjustment Modal -->
    @if (isAdjustmentModalOpen() && itemToAdjust(); as item) {
      <div class="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
        <div class="bg-white dark:bg-primary p-6 rounded-lg shadow-xl w-full max-w-md">
            <h3 class="text-xl font-bold">Ajustar Estoque: {{ item.name }}</h3>
            <p class="text-sm text-slate-500 dark:text-slate-400 mb-4">Estoque atual: {{ item.quantity }}</p>
            <form [formGroup]="adjustmentForm" (ngSubmit)="saveAdjustment()">
              <div class="space-y-4">
                  <input type="number" formControlName="newQuantity" placeholder="Nova Quantidade" class="w-full bg-slate-100 dark:bg-secondary p-2 rounded" />
                  <input type="text" formControlName="notes" placeholder="Motivo do Ajuste" class="w-full bg-slate-100 dark:bg-secondary p-2 rounded" />
              </div>
              <div class="flex justify-end gap-4 mt-6 pt-4 border-t border-slate-200 dark:border-secondary">
                  <button type="button" (click)="isAdjustmentModalOpen.set(false)" class="px-4 py-2 bg-slate-200 dark:bg-secondary rounded">Cancelar</button>
                  <button type="submit" [disabled]="adjustmentForm.invalid" class="px-4 py-2 bg-amber-600 text-white p-2 rounded disabled:opacity-50">Salvar Ajuste</button>
              </div>
            </form>
        </div>
      </div>
    }

    <!-- Delete Confirmation Modal -->
    @if(itemToDelete()) {
       <div class="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
        <div class="bg-white dark:bg-primary p-6 rounded-lg shadow-xl w-full max-w-md">
            <h3 class="text-xl font-bold mb-4">Confirmar Exclusão</h3>
            <p>Tem certeza que deseja excluir o item <strong class="font-semibold">"{{ itemToDelete()!.name }}"</strong> da Prateleira Vermelha?</p>
            <div class="flex justify-end gap-4 mt-6">
                <button (click)="itemToDelete.set(null)" class="px-4 py-2 bg-slate-200 dark:bg-secondary rounded">Cancelar</button>
                <button (click)="deleteItem()" class="px-4 py-2 bg-error text-white rounded">Excluir</button>
            </div>
        </div>
       </div>
    }
  `
})
export class RedShelfComponent {
  private dbService = inject(DatabaseService);
  private toastService = inject(ToastService);
  private fb = inject(FormBuilder);
  authService = inject(AuthService);
  db = this.dbService.db;
  
  sectorOptions = Object.values(StrategicSector);

  isFormOpen = signal(false);
  itemForm!: FormGroup;
  currentItem = signal<RedShelfItem | null>(null);

  isAdjustmentModalOpen = signal(false);
  adjustmentForm!: FormGroup;
  itemToAdjust = signal<RedShelfItem | null>(null);
  
  itemToDelete = signal<RedShelfItem | null>(null);

  redShelfItems = computed(() => {
    return this.db().redShelfItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  });
  
  sectorBorderColor(sector: StrategicSector): string {
    switch (sector) {
      case StrategicSector.Bombeiros: return 'border-red-500';
      case StrategicSector.Civil: return 'border-gray-500';
      case StrategicSector.Hidraulica: return 'border-blue-500';
      case StrategicSector.Eletrica: return 'border-yellow-500';
      case StrategicSector.Mecanica: return 'border-green-500';
      default: return 'border-transparent';
    }
  }

  openForm(item: RedShelfItem | null = null) {
    this.currentItem.set(item);
    this.itemForm = this.fb.group({
      name: [item?.name || '', Validators.required],
      description: [item?.description || ''],
      sector: [item?.sector || this.sectorOptions[0], Validators.required],
      quantity: [item?.quantity || 1, [Validators.required, Validators.min(0)]],
      notes: [item?.notes || ''],
    });
    this.isFormOpen.set(true);
  }

  async saveItem() {
    if (this.itemForm.invalid) return;
    const itemData = { ...this.currentItem(), ...this.itemForm.value };
    
    try {
        await this.dbService.saveItem(itemData, true); // `true` indicates it's a red shelf item
        this.toastService.addToast('Item salvo na Prateleira Vermelha!', 'success');
        this.isFormOpen.set(false);
    } catch (e: any) {
        this.toastService.addToast(e.message, 'error');
    }
  }
  
  openAdjustmentModal(item: RedShelfItem) {
    this.itemToAdjust.set(item);
    this.adjustmentForm = this.fb.group({
      newQuantity: [item.quantity, [Validators.required, Validators.min(0)]],
      notes: ['', [Validators.required, Validators.minLength(3)]],
    });
    this.isAdjustmentModalOpen.set(true);
  }

  async saveAdjustment() {
    if (this.adjustmentForm.invalid) return;
    const { newQuantity, notes } = this.adjustmentForm.value;
    const item = this.itemToAdjust();
    if (!item) return;

    await this.dbService.adjustItemQuantity(item.id, newQuantity, notes, true); // `true` for red shelf
    this.isAdjustmentModalOpen.set(false);
  }

  openDeleteConfirm(item: RedShelfItem) {
    this.itemToDelete.set(item);
  }
  
  async deleteItem() {
    const item = this.itemToDelete();
    if (item) {
        await this.dbService.deleteItemById(item.id, true); // `true` for red shelf
        this.toastService.addToast('Item removido da Prateleira Vermelha.', 'success');
        this.itemToDelete.set(null);
    }
  }
}