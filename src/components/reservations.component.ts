

import { Component, ChangeDetectionStrategy, inject, computed, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { DatabaseService } from '../services/database.service';
import { ToastService } from '../services/toast.service';
// FIX: Imported missing Reservation and ReservationStatus types.
import { Reservation, ReservationStatus } from '../models';

@Component({
  selector: 'app-reservations',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-4 sm:p-6 h-full flex flex-col">
      <header class="flex justify-between items-start mb-4 gap-2 flex-wrap">
        <div>
          <h2 class="text-2xl font-bold">Gerenciar Reservas</h2>
          <p class="text-sm text-slate-500 dark:text-slate-400">Reserve itens para projetos ou trabalhos futuros.</p>
        </div>
        <button (click)="openForm()" class="bg-accent text-white px-4 py-2 rounded-md hover:bg-info transition-colors">
          + Criar Reserva
        </button>
      </header>
      
      <div class="flex-grow overflow-auto">
        @if (reservations().length > 0) {
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              @for(reservation of reservations(); track reservation.id) {
                <div class="bg-white dark:bg-primary p-4 rounded-lg shadow-md flex flex-col">
                  <div class="flex-grow">
                    <div class="flex justify-between items-start">
                      <h3 class="font-bold text-lg mb-2">{{ reservation.name }}</h3>
                      <div class="flex items-center space-x-2">
                        @if (reservation.status === ReservationStatus.Pendente) {
                          <button (click)="openForm(reservation)" class="p-1 text-slate-500 dark:text-slate-300 hover:text-accent" title="Editar">✏️</button>
                        }
                        <button (click)="openDeleteConfirm(reservation)" class="p-1 text-slate-500 dark:text-slate-300 hover:text-error" title="Excluir">🗑️</button>
                      </div>
                    </div>
                    <p class="text-sm text-slate-500 dark:text-slate-400 mb-3">Para: {{ getTechnicianName(reservation.technicianId) }}</p>
                    <p class="text-sm text-slate-500 dark:text-slate-400 mb-3">Data: {{ reservation.dueDate | date:'dd/MM/yyyy' }}</p>

                    <h4 class="text-sm font-semibold mb-2">Itens Reservados:</h4>
                    <ul class="text-sm space-y-1 list-disc list-inside text-slate-600 dark:text-slate-300">
                      @for(item of reservation.items; track item.itemId) {
                        <li>{{ getItemName(item.itemId) }} (x{{item.quantity}})</li>
                      }
                    </ul>
                  </div>
                  <div class="mt-4 pt-4 border-t border-slate-200 dark:border-secondary flex justify-between items-center">
                    <span class="px-2 py-1 rounded-full text-xs font-semibold"
                      [class.bg-yellow-100]="reservation.status === ReservationStatus.Pendente" [class.text-yellow-800]="reservation.status === ReservationStatus.Pendente"
                      [class.dark:bg-yellow-900]="reservation.status === ReservationStatus.Pendente" [class.dark:text-yellow-200]="reservation.status === ReservationStatus.Pendente"
                      [class.bg-green-100]="reservation.status === ReservationStatus.Atendida" [class.text-green-800]="reservation.status === ReservationStatus.Atendida"
                      [class.dark:bg-green-900]="reservation.status === ReservationStatus.Atendida" [class.dark:text-green-200]="reservation.status === ReservationStatus.Atendida"
                      [class.bg-red-100]="reservation.status === ReservationStatus.Cancelada" [class.text-red-800]="reservation.status === ReservationStatus.Cancelada"
                      [class.dark:bg-red-900]="reservation.status === ReservationStatus.Cancelada" [class.dark:text-red-200]="reservation.status === ReservationStatus.Cancelada"
                    >{{ reservation.status }}</span>

                    @if (reservation.status === ReservationStatus.Pendente) {
                      <div class="flex gap-2">
                         <button (click)="updateStatus(reservation, ReservationStatus.Cancelada)" class="text-xs text-error hover:underline">Cancelar</button>
                         <button (click)="openFulfillConfirm(reservation)" class="text-xs font-bold bg-green-600 text-white px-3 py-1 rounded-md hover:bg-green-700">Atender</button>
                      </div>
                    }
                  </div>
                </div>
              }
          </div>
        } @else {
            <div class="col-span-full text-center p-10 text-slate-500 dark:text-slate-400 bg-white dark:bg-primary rounded-lg flex flex-col items-center justify-center h-full border-2 border-dashed border-slate-300 dark:border-secondary">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 text-slate-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              <h3 class="text-lg font-semibold text-slate-700 dark:text-slate-200">Nenhuma reserva encontrada</h3>
              <p class="text-sm mt-1">Crie uma reserva para garantir o estoque para trabalhos futuros.</p>
              <button (click)="openForm()" class="mt-4 bg-accent text-white px-4 py-2 rounded-md hover:bg-info transition-colors text-sm">
                + Criar Reserva
              </button>
          </div>
        }
      </div>
    </div>

    <!-- Form Modal -->
    @if (isFormOpen()) {
      <div class="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-40">
        <div class="bg-white dark:bg-primary p-6 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
          <h3 class="text-xl font-bold mb-4">{{ currentReservation()?.id ? 'Editar' : 'Criar' }} Reserva</h3>
          
          <form [formGroup]="form" (ngSubmit)="save()" class="flex-grow overflow-y-auto pr-2">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label class="block text-sm mb-1">Nome do Projeto/Reserva</label>
                  <input type="text" formControlName="name" class="w-full bg-slate-100 dark:bg-secondary p-2 rounded" />
                </div>
                <div>
                  <label class="block text-sm mb-1">Técnico</label>
                  <select formControlName="technicianId" class="w-full bg-slate-100 dark:bg-secondary p-2 rounded">
                    @for(tech of db().technicians; track tech.id) {
                      <option [value]="tech.id">{{tech.name}}</option>
                    }
                  </select>
                </div>
                <div>
                  <label class="block text-sm mb-1">Data de Vencimento</label>
                  <input type="date" formControlName="dueDate" class="w-full bg-slate-100 dark:bg-secondary p-2 rounded" />
                </div>
            </div>

            <h4 class="text-lg font-semibold mb-2">Itens a Reservar</h4>
            <div formArrayName="items" class="space-y-2">
              @for(itemGroup of itemsArray.controls; track $index) {
                <div [formGroupName]="$index" class="flex items-center gap-2 bg-slate-50 dark:bg-secondary p-2 rounded">
                  <div class="flex-grow">
                    <select formControlName="itemId" class="w-full bg-white dark:bg-primary p-2 rounded">
                      <option [ngValue]="null">Selecione um item</option>
                      @for (item of allItems(); track item.id) {
                        <option [value]="item.id">{{ item.name }} (Estoque Físico: {{item.quantity}})</option>
                      }
                    </select>
                  </div>
                  <div>
                    <input type="number" formControlName="quantity" min="1" class="w-20 bg-white dark:bg-primary p-2 rounded">
                  </div>
                  <button type="button" (click)="removeItem($index)" class="p-1 text-slate-400 hover:text-error transition-colors">🗑️</button>
                </div>
              }
            </div>
            <button type="button" (click)="addItem()" class="mt-2 text-sm text-accent hover:underline">+ Adicionar Item</button>

            <div class="flex justify-end gap-4 mt-6 pt-4 border-t border-slate-200 dark:border-secondary">
              <button type="button" (click)="isFormOpen.set(false)" class="px-4 py-2 bg-slate-200 dark:bg-secondary rounded">Cancelar</button>
              <button type="submit" [disabled]="form.invalid" class="px-4 py-2 bg-accent text-white rounded disabled:opacity-50">Salvar Reserva</button>
            </div>
          </form>
        </div>
      </div>
    }

    <!-- Fulfill/Delete Confirmation Modals -->
    @if (toConfirm()) {
      <div class="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
        <div class="bg-white dark:bg-primary p-6 rounded-lg shadow-xl w-full max-w-md">
          <h3 class="text-xl font-bold mb-4">Confirmar Ação</h3>
          @if (toConfirm()!.action === 'fulfill') {
            <p>Tem certeza que deseja atender a reserva <strong class="font-semibold">"{{ toConfirm()!.reservation.name }}"</strong>? O estoque físico dos itens será baixado.</p>
          } @else {
            <p>Tem certeza que deseja excluir a reserva <strong class="font-semibold">"{{ toConfirm()!.reservation.name }}"</strong>?</p>
          }
          <div class="flex justify-end gap-4 mt-6">
            <button (click)="toConfirm.set(null)" class="px-4 py-2 bg-slate-200 dark:bg-secondary rounded">Cancelar</button>
            @if (toConfirm()!.action === 'fulfill') {
              <button (click)="fulfillReservation()" class="px-4 py-2 bg-success text-white rounded">Atender Reserva</button>
            } @else {
               <button (click)="delete()" class="px-4 py-2 bg-error text-white rounded">Excluir</button>
            }
          </div>
        </div>
      </div>
    }
  `
})
export class ReservationsComponent {
  private dbService = inject(DatabaseService);
  private toastService = inject(ToastService);
  private fb = inject(FormBuilder);
  db = this.dbService.db;
  
  ReservationStatus = ReservationStatus;

  isFormOpen = signal(false);
  currentReservation = signal<Reservation | null>(null);
  toConfirm = signal<{reservation: Reservation, action: 'delete' | 'fulfill'} | null>(null);
  form!: FormGroup;

  reservations = computed(() => this.db().reservations.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  allItems = computed(() => this.db().items.slice().sort((a, b) => a.name.localeCompare(b.name)));

  get itemsArray(): FormArray {
    return this.form.get('items') as FormArray;
  }

  getItemName(itemId: string): string {
    return this.allItems().find(i => i.id === itemId)?.name || 'Item desconhecido';
  }

  getTechnicianName(technicianId: string): string {
    return this.db().technicians.find(t => t.id === technicianId)?.name || 'Desconhecido';
  }

  openForm(reservation: Reservation | null = null) {
    this.currentReservation.set(reservation);
    this.form = this.fb.group({
      name: [reservation?.name || '', Validators.required],
      technicianId: [reservation?.technicianId || this.db().technicians[0]?.id, Validators.required],
      dueDate: [reservation?.dueDate || new Date().toISOString().split('T')[0], Validators.required],
      items: this.fb.array(
        reservation?.items.map(i => this.createItemGroup(i.itemId, i.quantity)) || [],
        Validators.minLength(1)
      )
    });
    if (!reservation) {
      this.addItem();
    }
    this.isFormOpen.set(true);
  }

  createItemGroup(itemId: string | null, quantity: number | null): FormGroup {
    return this.fb.group({
      itemId: [itemId, Validators.required],
      quantity: [quantity, [Validators.required, Validators.min(1)]]
    });
  }

  addItem() { this.itemsArray.push(this.createItemGroup(null, 1)); }
  removeItem(index: number) { this.itemsArray.removeAt(index); }

  async save() {
    if (this.form.invalid) return this.toastService.addToast('Formulário inválido.', 'error');

    const formValue = this.form.value;
    const current = this.currentReservation();
    const data = { ...current, ...formValue, status: current?.status || ReservationStatus.Pendente, createdAt: current?.createdAt || new Date().toISOString() };

    if (current?.id) {
      await this.dbService.updateItem('reservations', data as Reservation);
      await this.dbService.logAction('UPDATE_RESERVATION', `Reserva "${data.name}" atualizada.`);
      this.toastService.addToast('Reserva atualizada!', 'success');
    } else {
      await this.dbService.addItem('reservations', data);
      await this.dbService.logAction('CREATE_RESERVATION', `Reserva "${data.name}" criada.`);
      this.toastService.addToast('Reserva criada!', 'success');
    }
    this.isFormOpen.set(false);
  }

  openDeleteConfirm(reservation: Reservation) { this.toConfirm.set({reservation, action: 'delete'}); }
  openFulfillConfirm(reservation: Reservation) { this.toConfirm.set({reservation, action: 'fulfill'}); }

  async delete() {
    const reservation = this.toConfirm()?.reservation;
    if (reservation) {
      await this.dbService.deleteItem('reservations', reservation.id);
      await this.dbService.logAction('DELETE_RESERVATION', `Reserva "${reservation.name}" removida.`);
      this.toastService.addToast('Reserva excluída!', 'success');
      this.toConfirm.set(null);
    }
  }
  
  async fulfillReservation() {
    const reservation = this.toConfirm()?.reservation;
    if (!reservation) return;
    try {
        await this.dbService.fulfillReservation(reservation.id);
        this.toastService.addToast(`Reserva "${reservation.name}" atendida com sucesso!`, 'success');
    } catch (e: any) {
        this.toastService.addToast(e.message, 'error');
    } finally {
        this.toConfirm.set(null);
    }
  }
  
  async updateStatus(reservation: Reservation, status: ReservationStatus) {
    if (status === ReservationStatus.Atendida) {
        this.openFulfillConfirm(reservation);
        return;
    }
    const updatedReservation = { ...reservation, status };
    await this.dbService.updateItem('reservations', updatedReservation);
    await this.dbService.logAction('UPDATE_RESERVATION_STATUS', `Status da reserva "${reservation.name}" alterado para ${status}.`);
    this.toastService.addToast(`Status da reserva alterado para ${status}!`, 'info');
  }
}
