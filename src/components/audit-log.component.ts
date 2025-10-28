import { Component, ChangeDetectionStrategy, inject, computed, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { DatabaseService } from '../services/database.service';
import { AuditLog } from '../models';

type SortableLogKey = keyof AuditLog;

@Component({
  selector: 'app-audit-log',
  standalone: true,
  imports: [CommonModule, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-4 sm:p-6 h-full flex flex-col">
      <h2 class="text-2xl font-bold mb-6">Log de Auditoria</h2>
      
      <div class="flex-grow overflow-auto">
        <!-- Table for Medium and up -->
        <table class="w-full text-left hidden md:table">
          <thead class="sticky top-0 bg-slate-50 dark:bg-secondary">
            <tr class="border-b border-slate-200 dark:border-slate-600">
              <th class="p-3 cursor-pointer w-48" (click)="handleSort('timestamp')">
                Data/Hora
                 @if (sortColumn() === 'timestamp') {
                  <span class="ml-1">{{ sortDirection() === 'asc' ? '▲' : '▼' }}</span>
                }
              </th>
              <th class="p-3 cursor-pointer w-64" (click)="handleSort('action')">
                Ação
                 @if (sortColumn() === 'action') {
                  <span class="ml-1">{{ sortDirection() === 'asc' ? '▲' : '▼' }}</span>
                }
              </th>
              <th class="p-3">Detalhes</th>
              <th class="p-3 cursor-pointer w-48" (click)="handleSort('user')">
                Usuário
                 @if (sortColumn() === 'user') {
                  <span class="ml-1">{{ sortDirection() === 'asc' ? '▲' : '▼' }}</span>
                }
              </th>
            </tr>
          </thead>
          <tbody>
            @for(log of paginatedLogs(); track log.id) {
              <tr class="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-primary">
                <td class="p-3 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">{{ log.timestamp | date:'dd/MM/yyyy HH:mm:ss' }}</td>
                <td class="p-3">
                  <span class="px-2.5 py-1 rounded-full text-xs font-semibold" [class]="getActionClass(log.action)">
                    {{ formatActionTitle(log.action) }}
                  </span>
                </td>
                <td class="p-3 text-sm text-slate-700 dark:text-slate-200">{{ log.details }}</td>
                <td class="p-3 font-medium">{{ log.user }}</td>
              </tr>
            } @empty {
              <tr>
                <td colspan="4" class="p-4 text-center text-slate-500 dark:text-slate-400">
                  <div class="flex flex-col items-center justify-center py-10">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 text-slate-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <h3 class="text-lg font-semibold text-slate-700 dark:text-slate-200">Nenhum registro de auditoria</h3>
                      <p class="text-sm mt-1">As ações importantes do sistema serão registradas aqui.</p>
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>

        <!-- Card List for Mobile -->
        <div class="md:hidden space-y-3">
            @for(log of paginatedLogs(); track log.id) {
              <div class="bg-white dark:bg-secondary rounded-lg p-4 shadow border-l-4" [class]="getActionClass(log.action, true)">
                <div class="flex justify-between items-start">
                  <div>
                    <span class="px-2 py-1 rounded-full text-xs font-semibold" [class]="getActionClass(log.action)">
                      {{ formatActionTitle(log.action) }}
                    </span>
                    <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">{{ log.timestamp | date:'dd/MM/yy HH:mm' }} por {{log.user}}</p>
                  </div>
                </div>
                <p class="mt-2 text-sm text-slate-700 dark:text-slate-300">{{ log.details }}</p>
              </div>
            } @empty {
                <div class="flex flex-col items-center justify-center p-10 text-center text-slate-500 dark:text-slate-400 bg-white dark:bg-secondary rounded-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 text-slate-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <h3 class="text-lg font-semibold text-slate-700 dark:text-slate-200">Nenhum registro de auditoria</h3>
                    <p class="text-sm mt-1">As ações importantes do sistema serão registradas aqui.</p>
                </div>
            }
        </div>
      </div>

      <!-- Pagination -->
      <div class="flex justify-between items-center pt-4">
        <span class="text-sm text-slate-500 dark:text-slate-400">
          Mostrando {{ paginatedLogs().length }} de {{ sortedLogs().length }} logs
        </span>
        <div class="flex gap-2">
          <button [disabled]="currentPage() === 1" (click)="prevPage()" class="px-3 py-1 bg-white dark:bg-secondary rounded disabled:opacity-50">Anterior</button>
          <button [disabled]="currentPage() === totalPages()" (click)="nextPage()" class="px-3 py-1 bg-white dark:bg-secondary rounded disabled:opacity-50">Próximo</button>
        </div>
      </div>
    </div>
  `
})
export class AuditLogComponent {
  private dbService = inject(DatabaseService);
  db = this.dbService.db;
  
  currentPage = signal(1);
  itemsPerPage = 15;
  sortColumn = signal<SortableLogKey | ''>('timestamp');
  sortDirection = signal<'asc' | 'desc'>('desc');

  logs = computed(() => this.db().auditLogs);

  sortedLogs = computed(() => {
    const items = [...this.logs()];
    const column = this.sortColumn();
    const direction = this.sortDirection();

    if (!column) return items;

    return items.sort((a, b) => {
      const aValue = a[column];
      const bValue = b[column];
      
      if (column === 'timestamp') {
        return direction === 'asc'
          ? new Date(aValue).getTime() - new Date(bValue).getTime()
          : new Date(bValue).getTime() - new Date(aValue).getTime();
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return direction === 'asc' 
          ? aValue.localeCompare(bValue) 
          : bValue.localeCompare(aValue);
      }
      return 0;
    });
  });

  totalPages = computed(() => Math.ceil(this.sortedLogs().length / this.itemsPerPage));

  paginatedLogs = computed(() => {
    const start = (this.currentPage() - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    return this.sortedLogs().slice(start, end);
  });
  
  handleSort(column: SortableLogKey) {
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

  formatActionTitle(action: string): string {
    return action.replace(/_/g, ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
  }

  getActionClass(action: string, forBorder: boolean = false): string {
    const actionPrefix = action.split('_')[0];
    switch (actionPrefix) {
      case 'CREATE':
      case 'ENTRADA':
      case 'RECEIVE':
        return forBorder ? 'border-green-500' : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'UPDATE':
      case 'ADJUST':
      case 'SEND':
      case 'PROCESS':
      case 'FULFILL':
      case 'SAVE':
        return forBorder ? 'border-blue-500' : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'DELETE':
        return forBorder ? 'border-red-500' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'SAIDA':
        return forBorder ? 'border-amber-500' : 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
      default:
        return forBorder ? 'border-slate-500' : 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200';
    }
  }

  prevPage() { this.currentPage.update(p => Math.max(1, p - 1)); }
  nextPage() { this.currentPage.update(p => Math.min(this.totalPages(), p + 1)); }
}