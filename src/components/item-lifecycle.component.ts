import { Component, ChangeDetectionStrategy, inject, computed, signal, output, Signal } from '@angular/core';
import { CommonModule, DatePipe, CurrencyPipe } from '@angular/common';
import { DatabaseService } from '../services/database.service';
import { Item, Movement, AuditLog, View } from '../models';

interface TimelineEvent {
  date: string;
  type: 'creation' | 'edit' | 'movement-in' | 'movement-out' | 'adjustment-in' | 'adjustment-out' | 'redshelf-add' | 'redshelf-resolve' | 'log';
  title: string;
  details: any;
  icon: string;
}

@Component({
  selector: 'app-item-lifecycle',
  standalone: true,
  imports: [CommonModule, DatePipe, CurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-4 sm:p-6 h-full flex flex-col">
       @if (item(); as currentItem) {
        <header class="mb-6">
            <div class="flex justify-between items-start">
                <div>
                    <h2 class="text-2xl font-bold text-slate-800 dark:text-slate-100">{{ currentItem.name }}</h2>
                    <p class="text-sm text-slate-500 dark:text-slate-400">Ciclo de Vida do Item</p>
                </div>
                <button (click)="returnToPreviousView()" class="text-sm text-accent hover:underline">&larr; Voltar</button>
            </div>
        </header>

        <div class="flex-grow overflow-y-auto pr-4">
            <div class="relative pl-8">
                <!-- Vertical timeline line -->
                <div class="absolute left-4 top-0 h-full w-0.5 bg-slate-200 dark:bg-slate-700"></div>

                @for (event of timelineEvents(); track event.date + event.title) {
                    <div class="relative mb-8">
                        <!-- Circle icon -->
                        <div class="absolute -left-1.5 top-1.5 w-7 h-7 rounded-full flex items-center justify-center"
                            [class.bg-green-500]="event.type === 'creation' || event.type === 'movement-in' || event.type === 'adjustment-in' || event.type === 'redshelf-resolve'"
                            [class.bg-red-500]="event.type === 'movement-out' || event.type === 'adjustment-out' || event.type === 'redshelf-add'"
                            [class.bg-amber-500]="event.type === 'edit'"
                            [class.bg-slate-500]="event.type === 'log'">
                            <span class="text-white text-sm font-bold">{{ event.icon }}</span>
                        </div>
                        
                        <div class="pl-8">
                            <p class="text-xs text-slate-500 dark:text-slate-400">{{ event.date | date:'dd/MM/yyyy HH:mm:ss' }}</p>
                            <h4 class="font-bold">{{ event.title }}</h4>
                            <div class="text-sm text-slate-600 dark:text-slate-300 mt-1">
                                @switch (event.type) {
                                    @case ('creation') {
                                        <p>Item catalogado no sistema.</p>
                                    }
                                    @case ('edit') {
                                        <p>Dados do item foram atualizados.</p>
                                    }
                                    @case ('movement-in') {
                                        <p>
                                            <span class="font-semibold text-green-600 dark:text-green-400">+{{ event.details.quantity }}</span> unidades deram entrada.
                                            @if (event.details.unitPrice !== undefined) {
                                                <span class="font-bold"> (Preço: {{ event.details.unitPrice | currency:'BRL' }})</span>
                                            }
                                            @if (event.details.notes) {
                                                <span class="italic text-slate-500"> (Motivo: {{ event.details.notes }})</span>
                                            }
                                        </p>
                                    }
                                    @case ('movement-out') {
                                        <p>
                                            <span class="font-semibold text-red-600 dark:text-red-400">-{{ event.details.quantity }}</span> unidades saíram para 
                                            <span class="font-semibold">{{ getTechnicianName(event.details.technicianId) }}</span>.
                                             @if (event.details.notes) {
                                                <span class="italic text-slate-500"> (Notas: {{ event.details.notes }})</span>
                                            }
                                        </p>
                                    }
                                    @case ('adjustment-in') {
                                         <p>
                                            <span class="font-semibold text-green-600 dark:text-green-400">+{{ event.details.quantity }}</span> unidades adicionadas por ajuste.
                                            <span class="italic text-slate-500"> (Motivo: {{ event.details.notes }})</span>
                                        </p>
                                    }
                                    @case ('adjustment-out') {
                                         <p>
                                            <span class="font-semibold text-red-600 dark:text-red-400">-{{ event.details.quantity }}</span> unidades removidas por ajuste.
                                            <span class="italic text-slate-500"> (Motivo: {{ event.details.notes }})</span>
                                        </p>
                                    }
                                    @default {
                                        <p class="italic">{{ event.details }}</p>
                                    }
                                }
                            </div>
                        </div>
                    </div>
                } @empty {
                     <div class="pl-8 text-slate-500">Nenhum evento registrado para este item.</div>
                }
            </div>
        </div>
       } @else {
        <div class="text-center p-10">
            <p>Nenhum item selecionado. Volte para o inventário e selecione o histórico de um item.</p>
             <button (click)="returnToPreviousView()" class="mt-4 bg-accent text-white px-4 py-2 rounded-md">Voltar ao Inventário</button>
        </div>
       }
    </div>
  `
})
export class ItemLifecycleComponent {
  private dbService = inject(DatabaseService);
  navigateBack = output<View>();

  item: Signal<Item | null> = this.dbService.currentItemForLifecycle;
  
  timelineEvents: Signal<TimelineEvent[]> = computed(() => {
    const currentItem = this.item();
    if (!currentItem) return [];

    const allMovements = this.dbService.db().movements;
    const allAuditLogs = this.dbService.db().auditLogs;

    const events: TimelineEvent[] = [];

    // 1. Add Movements
    allMovements
      .filter(m => m.itemId === currentItem.id)
      .forEach(m => {
        const isAdjustment = !m.technicianId && m.notes && (m.notes.toLowerCase().includes('ajuste') || m.notes.toLowerCase().includes('inventário físico'));
        const isPurchase = m.type === 'in' && m.notes && m.notes.startsWith('Recebimento da Ordem de Compra');

        if (isPurchase) {
            const poNumber = m.notes.replace('Recebimento da Ordem de Compra ', '');
            const po = this.dbService.db().purchaseOrders.find(p => p.poNumber === poNumber);
            const poItem = po?.items.find(i => i.itemId === currentItem.id);
            
            events.push({
                date: m.date,
                type: 'movement-in',
                title: 'Entrada por Compra',
                details: { ...m, unitPrice: poItem?.unitPrice },
                icon: '💰'
            });
        } else if (isAdjustment) {
            events.push({
                date: m.date,
                type: m.type === 'in' ? 'adjustment-in' : 'adjustment-out',
                title: 'Ajuste de Estoque',
                details: m,
                icon: '✏️'
            });
        } else {
            events.push({
                date: m.date,
                type: m.type === 'in' ? 'movement-in' : 'movement-out',
                title: m.type === 'in' ? 'Entrada de Material' : 'Saída de Material',
                details: m,
                icon: m.type === 'in' ? '📦' : '🔧'
            });
        }
      });

    // 2. Add Audit Logs related to this item
    allAuditLogs
      .filter(log => log.details.toLowerCase().includes(currentItem.name.toLowerCase()))
      .forEach(log => {
        let type: TimelineEvent['type'] = 'log';
        let icon = 'ℹ️';

        if (log.action === 'CREATE_ITEM') { type = 'creation'; icon = '✨'; }
        if (log.action === 'UPDATE_ITEM') { type = 'edit'; icon = '📝'; }
        if (log.action === 'MOVE_TO_RED_SHELF') { type = 'redshelf-add'; icon = '🔴'; }
        if (log.action === 'RESOLVE_RED_SHELF') { type = 'redshelf-resolve'; icon = '🟢'; }
        
        events.push({
            date: log.timestamp,
            type: type,
            title: this.formatActionTitle(log.action),
            details: log.details,
            icon: icon
        });
      });
      
    // 3. Sort all events chronologically
    return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  });

  getTechnicianName(technicianId?: string | null): string {
    if (!technicianId) return 'N/A';
    return this.dbService.db().technicians.find(t => t.id === technicianId)?.name || 'Desconhecido';
  }
  
  formatActionTitle(action: string): string {
    return action
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  returnToPreviousView() {
    this.navigateBack.emit(this.dbService.lifecycleReturnView());
  }
}
