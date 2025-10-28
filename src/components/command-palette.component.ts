// FIX: Imported `output` from @angular/core to resolve the error.
import { Component, ChangeDetectionStrategy, output, inject, signal, computed, viewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { View } from '../models';
import { Router } from '@angular/router';

export interface Command {
  label: string;
  view?: View;
  action?: () => void;
  icon: string;
}

@Component({
  selector: 'app-command-palette',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-start pt-20 z-50" (click)="close.emit()">
      <div class="bg-white dark:bg-primary p-2 rounded-lg shadow-xl w-full max-w-lg flex flex-col" (click)="$event.stopPropagation()">
        <div class="relative">
          <input 
            #searchInput
            type="text" 
            [(ngModel)]="searchText"
            (ngModelChange)="filterCommands()"
            (keydown.arrow-down)="moveSelection(1)"
            (keydown.arrow-up)="moveSelection(-1)"
            (keydown.enter)="executeSelectedCommand()"
            placeholder="Digite um comando ou navegue..."
            class="w-full bg-slate-100 dark:bg-secondary p-4 rounded-md border-none focus:ring-2 focus:ring-accent focus:outline-none"
          >
          <div class="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400 border border-slate-300 dark:border-slate-500 rounded px-1.5 py-0.5">
            Ctrl+K
          </div>
        </div>

        <ul class="mt-2 max-h-80 overflow-y-auto">
          @for (command of filteredCommands(); track command.label; let i = $index) {
            <li 
              class="flex items-center gap-3 p-3 rounded-md cursor-pointer"
              [class.bg-accent]="selectedIndex() === i"
              [class.text-white]="selectedIndex() === i"
              [class.hover:bg-slate-100]="selectedIndex() !== i"
              [class.dark:hover:bg-secondary]="selectedIndex() !== i"
              (mouseenter)="selectedIndex.set(i)"
              (click)="executeSelectedCommand()"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" [attr.d]="command.icon" clip-rule="evenodd" /></svg>
              <span>{{ command.label }}</span>
            </li>
          } @empty {
            <li class="p-4 text-center text-slate-500">Nenhum comando encontrado.</li>
          }
        </ul>
      </div>
    </div>
  `
})
export class CommandPaletteComponent implements AfterViewInit {
  close = output<void>();
  command = output<Command>();
  
  // FIX: Explicitly type the router property to assist TypeScript's type inference.
  private router: Router = inject(Router);
  
  searchText = '';
  selectedIndex = signal(0);
  
  searchInput = viewChild.required<ElementRef<HTMLInputElement>>('searchInput');

  allCommands = signal<Command[]>([]);
  // FIX: Added the missing `filteredCommands` signal property.
  filteredCommands = signal<Command[]>([]);

  constructor() {
    const commands: Omit<Command, 'action'>[] = [
      { label: 'Ir para Dashboard', view: 'dashboard', icon: 'M10 2a1 1 0 00-1 1v1a1 1 0 002 0V3a1 1 0 00-1-1zM4 4h3a3 3 0 006 0h3a2 2 0 012 2v9a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zm2.5 7.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z' },
      { label: 'Ir para Inventário', view: 'inventory', icon: 'M5 8a1 1 0 00-1 1v10a1 1 0 001 1h10a1 1 0 001-1V9a1 1 0 00-1-1H5zM2 5a2 2 0 012-2h12a2 2 0 012 2v2a1 1 0 11-2 0V5a1 1 0 00-1-1H5a1 1 0 00-1 1v12a1 1 0 001 1h2a1 1 0 110 2H4a2 2 0 01-2-2V5z' },
      // FIX: Changed 'strategic_stock' to 'red_shelf' to match the existing route.
      { label: 'Ir para Prateleira Vermelha', view: 'red_shelf', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
      { label: 'Ir para Ordens de Compra', view: 'purchase_orders', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 8h.01M12 12h.01M12 16h.01M9 12h.01M9 16h.01' },
      { label: 'Ir para Modo Kiosk', view: 'kiosk', icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
      { label: 'Registrar Entrada de Itens', view: 'entry', icon: 'M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z' },
      { label: 'Registrar Saída de Itens', view: 'exit', icon: 'M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z' },
      { label: 'Ir para Listas de Coleta', view: 'picking_lists', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
      { label: 'Ir para Contagem Cíclica', view: 'cycle_count', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-5 3h2m-2 4h4m-4 4h4' },
      { label: 'Ir para Inventário Físico', view: 'stocktake', icon: 'M5 3a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2H5zm0 2h14v14H5V5zm2 2h2v2H7V7zm4 0h2v2h-2V7zm4 0h2v2h-2V7zm-8 4h2v2H7v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2zm-8 4h2v2H7v-2zm4 0h2v2h-2v-2z' },
      { label: 'Ver Sugestões de Compra', view: 'purchase_suggestion', icon: 'M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z' },
      { label: 'Gerenciar Técnicos', view: 'technicians', icon: 'M9 6a3 3 0 11-6 0 3 3 0 016 0zm-1.559 4.341a4.5 4.5 0 016.318 0 4.002 4.002 0 011.24 3.315V15a2 2 0 01-2 2H2.999a2 2 0 01-2-2v-1.344c0-1.288.521-2.48 1.34-3.315zM17 6a3 3 0 11-6 0 3 3 0 016 0zm-1.559 4.341a4.5 4.5 0 016.318 0 4.002 4.002 0 011.24 3.315V15a2 2 0 01-2 2h-1.001a1 1 0 100-2h1v-1.344a2.002 2.002 0 00-.67-1.488 2.5 2.5 0 00-3.536 0 2.002 2.002 0 00-.669 1.488V14h1a1 1 0 100 2h-1.001a2 2 0 01-2-2v-1.344c0-1.288.521-2.48 1.34-3.315z' },
      { label: 'Gerenciar Fornecedores', view: 'suppliers', icon: 'M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM18 8a1 1 0 01-1 1H4.41l1.42 1.42a1 1 0 11-1.41 1.41L1.71 9.12a1 1 0 010-1.41L4.41 5.17a1 1 0 011.41 1.41L4.41 8H17a1 1 0 011 1zM3 3a1 1 0 000 2h11.586l-1.293 1.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 00-1.414 1.414L14.586 3H3z' },
      { label: 'Ver Relatórios', view: 'reports', icon: 'M9 17v-4h4v4H9zM3 2a1 1 0 00-1 1v14a1 1 0 001 1h14a1 1 0 001-1V3a1 1 0 00-1-1H3zm3 2h8v2H6V4z' },
      // FIX: Changed invalid view 'smart_alerts' to 'anomaly_detection' to match the existing route.
      { label: 'Ver Alertas Inteligentes', view: 'anomaly_detection', icon: 'M10 18a8 8 0 100-16 8 8 0 000 16zM9 9a1 1 0 012 0v3a1 1 0 11-2 0V9zm2 6a1 1 0 11-2 0 1 1 0 012 0z' },
      { label: 'Ver Log de Auditoria', view: 'audit_log', icon: 'M10 2a1 1 0 00-1 1v1a1 1 0 002 0V3a1 1 0 00-1-1zM3 5a2 2 0 012-2h10a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V5zm3 4a1 1 0 00-1 1v6a1 1 0 102 0v-6a1 1 0 00-1-1zm5-1a1 1 0 011-1h2a1 1 0 110 2h-2a1 1 0 01-1-1z' },
      { label: 'Ir para Configurações', view: 'settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066 2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM10 13a3 3 0 100-6 3 3 0 000 6z' },
    ];
    this.allCommands.set(commands.map(c => ({
      ...c,
      action: () => this.router.navigate([c.view!])
    })));
    this.filteredCommands.set(this.allCommands());
  }
  
  ngAfterViewInit() {
    setTimeout(() => this.searchInput().nativeElement.focus(), 0);
  }

  filterCommands() {
    const term = this.searchText.toLowerCase();
    if (!term) {
      this.filteredCommands.set(this.allCommands());
    } else {
      this.filteredCommands.set(
        this.allCommands().filter(c => c.label.toLowerCase().includes(term))
      );
    }
    this.selectedIndex.set(0);
  }

  moveSelection(delta: number) {
    this.selectedIndex.update(current => {
      const newIndex = current + delta;
      if (newIndex < 0) return this.filteredCommands().length - 1;
      if (newIndex >= this.filteredCommands().length) return 0;
      return newIndex;
    });
  }

  executeSelectedCommand() {
    const commands = this.filteredCommands();
    const index = this.selectedIndex();
    if (commands.length > index) {
      this.command.emit(commands[index]);
    }
  }
}