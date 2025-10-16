import { Component, ChangeDetectionStrategy, inject, computed, signal, input, viewChild, ElementRef, OnDestroy, effect } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormControl } from '@angular/forms';
import { DatabaseService } from '../services/database.service';
import { ToastService } from '../services/toast.service';
import { Movement, Item, ItemWithAvailableStock } from '../models';
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';
import { ImageRecognitionComponent } from './image-recognition.component';
import { GeminiService } from '../services/gemini.service';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-movements',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ImageRecognitionComponent, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-4 sm:p-6 h-full flex flex-col">
      <h2 class="text-2xl font-bold mb-2">{{ movementType() === 'in' ? 'Entrada de Itens' : 'Saída de Itens' }}</h2>

      @if (movementType() === 'in') {
        <div class="bg-sky-100 dark:bg-sky-900/50 border-l-4 border-sky-500 text-sky-800 dark:text-sky-200 p-4 rounded-r-lg mb-6 shadow-sm">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div class="ml-3">
              <p class="text-sm">
                Use esta tela para registrar entradas manuais, como devoluções ou transferências. Para receber itens de um fornecedor, utilize o módulo de <strong class="font-semibold">Ordens de Compra</strong>.
              </p>
            </div>
          </div>
        </div>
      }

      <div class="flex justify-end mb-4 gap-2">
        <button (click)="openMovementForm()" class="bg-accent text-white px-4 py-2 rounded-md hover:bg-info transition-colors">
          Registrar {{ movementType() === 'in' ? 'Entrada' : 'Saída' }}
        </button>
      </div>

      <div class="flex-grow overflow-auto">
        <!-- Table for desktop -->
        <table class="w-full text-left hidden md:table">
          <thead class="sticky top-0 bg-slate-50 dark:bg-secondary">
            <tr class="border-b border-slate-200 dark:border-slate-600">
              <th class="p-3 cursor-pointer" (click)="handleSort('date')">
                Data
                @if (sortColumn() === 'date') { <span class="ml-1">{{ sortDirection() === 'asc' ? '▲' : '▼' }}</span> }
              </th>
              <th class="p-3 cursor-pointer" (click)="handleSort('itemId')">
                Item
                 @if (sortColumn() === 'itemId') { <span class="ml-1">{{ sortDirection() === 'asc' ? '▲' : '▼' }}</span> }
              </th>
              <th class="p-3 cursor-pointer" (click)="handleSort('quantity')">
                Quantidade
                 @if (sortColumn() === 'quantity') { <span class="ml-1">{{ sortDirection() === 'asc' ? '▲' : '▼' }}</span> }
              </th>
              @if (movementType() === 'out') {
                <th class="p-3 cursor-pointer" (click)="handleSort('technicianId')">
                  Técnico
                   @if (sortColumn() === 'technicianId') { <span class="ml-1">{{ sortDirection() === 'asc' ? '▲' : '▼' }}</span> }
                </th>
              }
            </tr>
          </thead>
          <tbody>
            @for(movement of paginatedMovements(); track movement.id) {
              <tr class="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-primary">
                <td class="p-3">{{ movement.date | date:'dd/MM/yyyy' }}</td>
                <td class="p-3">{{ getItemName(movement.itemId) }}</td>
                <td class="p-3">{{ movement.quantity }}</td>
                @if (movementType() === 'out') {
                  <td class="p-3">{{ getTechnicianName(movement.technicianId) }}</td>
                }
              </tr>
            } @empty {
              <tr>
                <td [attr.colspan]="movementType() === 'out' ? 4 : 3" class="p-4 text-center text-slate-500 dark:text-slate-400">Nenhuma movimentação encontrada.</td>
              </tr>
            }
          </tbody>
        </table>

        <!-- Cards for mobile -->
        <div class="md:hidden space-y-3">
            @for(movement of paginatedMovements(); track movement.id) {
              <div class="bg-white dark:bg-primary rounded-lg p-4 shadow">
                <div class="flex justify-between items-start">
                  <p class="font-bold text-slate-800 dark:text-slate-100">{{ getItemName(movement.itemId) }}</p>
                  <p class="font-mono text-sm text-slate-500 dark:text-slate-400">{{ movement.date | date:'dd/MM/yy' }}</p>
                </div>
                <div class="mt-2 text-sm">
                  <p>Quantidade: <span class="font-bold">{{ movement.quantity }}</span></p>
                  @if (movementType() === 'out') {
                    <p>Técnico: <span class="font-medium">{{ getTechnicianName(movement.technicianId) }}</span></p>
                  }
                </div>
              </div>
            } @empty {
              <div class="p-4 text-center text-slate-500 dark:text-slate-400 bg-white dark:bg-secondary rounded-lg">Nenhuma movimentação encontrada.</div>
            }
        </div>
      </div>

       <!-- Pagination -->
       <div class="flex justify-between items-center pt-4">
        <span class="text-sm text-slate-500 dark:text-slate-400">
          Mostrando {{ paginatedMovements().length }} de {{ sortedMovements().length }} registros
        </span>
        <div class="flex gap-2">
          <button [disabled]="currentPage() === 1" (click)="prevPage()" class="px-3 py-1 bg-white dark:bg-secondary rounded disabled:opacity-50">Anterior</button>
          <button [disabled]="currentPage() === totalPages()" (click)="nextPage()" class="px-3 py-1 bg-white dark:bg-secondary rounded disabled:opacity-50">Próximo</button>
        </div>
      </div>
    </div>

    <!-- Movement Form Modal -->
    @if (isFormOpen()) {
      <div class="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-40">
        <div class="bg-white dark:bg-primary p-6 rounded-lg shadow-xl w-full max-w-lg">
          <h3 class="text-xl font-bold mb-4">Registrar {{ movementType() === 'in' ? 'Entrada' : 'Saída' }}</h3>
          <form [formGroup]="movementForm" (ngSubmit)="saveMovement()">
            <div class="space-y-4">
              <div>
                <label class="block text-sm mb-1 font-medium">Categoria</label>
                <select [formControl]="categoryFilterControl" class="w-full bg-slate-100 dark:bg-secondary p-2 rounded">
                  <option [ngValue]="null">Todas as Categorias</option>
                  @for(cat of db().categories; track cat) {
                    <option [value]="cat">{{cat}}</option>
                  }
                </select>
              </div>
              <div>
                <label class="block text-sm mb-1 font-medium">Item</label>
                <div class="flex gap-2">
                   <input 
                      type="text"
                      list="items-datalist"
                      formControlName="itemName"
                      autocomplete="off"
                      placeholder="Digite para buscar um item..."
                      class="w-full bg-slate-100 dark:bg-secondary p-2 rounded"
                    />
                    <datalist id="items-datalist">
                       @for(item of selectableItems(); track item.id) {
                        <option [value]="item.name"></option>
                      }
                    </datalist>
                   @if(movementType() === 'out') {
                    <button type="button" (click)="startScanner()" class="p-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors" title="Escanear Código de Barras">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 4a1 1 0 011-1h4a1 1 0 010 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h4a1 1 0 010 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h4a1 1 0 010 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h4a1 1 0 010 2H4a1 1 0 01-1-1zm14-8a1 1 0 00-1-1h-4a1 1 0 000 2h4a1 1 0 001-1zm-1 4a1 1 0 01-1 1h-4a1 1 0 010-2h4a1 1 0 011 1zm-1 4a1 1 0 01-1 1h-4a1 1 0 010-2h4a1 1 0 011 1z" clip-rule="evenodd" /></svg>
                    </button>
                     <button type="button" (click)="isImageRecognitionOpen.set(true)" class="p-2 bg-sky-600 text-white rounded hover:bg-sky-700 transition-colors" title="Saída com Câmera">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                           <path d="M2 6a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2-2H4a2 2 0 01-2-2V6zm4 3a2 2 0 100 4 2 2 0 000-4zm-2 2a4 4 0 118 0 4 4 0 01-8 0z" />
                        </svg>
                    </button>
                  }
                </div>
              </div>
              @if (movementType() === 'out') {
                <div>
                  <label class="block text-sm mb-1 font-medium">Técnico</label>
                  <select formControlName="technicianId" class="w-full bg-slate-100 dark:bg-secondary p-2 rounded">
                    <option [ngValue]="null" disabled>Selecione um técnico</option>
                    @for(tech of db().technicians; track tech.id) {
                      <option [value]="tech.id">{{ tech.name }}</option>
                    }
                  </select>
                </div>
              }
              <div>
                <label class="block text-sm mb-1 font-medium">Quantidade</label>
                <input type="number" formControlName="quantity" class="w-full bg-slate-100 dark:bg-secondary p-2 rounded" />
              </div>
              <div>
                <label class="block text-sm mb-1 font-medium">Data</label>
                <input type="date" formControlName="date" class="w-full bg-slate-100 dark:bg-secondary p-2 rounded" />
              </div>
            </div>
            <div class="flex justify-end gap-4 mt-6 pt-4 border-t border-slate-200 dark:border-secondary">
              <button type="button" (click)="isFormOpen.set(false)" class="px-4 py-2 bg-slate-200 dark:bg-secondary rounded">Cancelar</button>
              <button type="submit" [disabled]="movementForm.invalid" class="px-4 py-2 bg-accent text-white rounded disabled:opacity-50">Salvar</button>
            </div>
          </form>
        </div>
      </div>
    }

    <!-- Scanner Modal -->
    @if (isScannerOpen()) {
      <div class="fixed inset-0 bg-black bg-opacity-80 flex flex-col items-center justify-center z-50 p-4">
        <div class="relative w-full max-w-2xl bg-black rounded-lg overflow-hidden">
          <video #scannerVideo class="w-full h-auto"></video>
          <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div class="w-10/12 h-2/3 border-4 border-dashed border-accent/70 rounded-lg"></div>
          </div>
          <div class="animate-scan-line"></div>
        </div>
        @if (scannerError()) {
          <p class="mt-4 text-red-400 bg-red-900/50 p-3 rounded-md">{{ scannerError() }}</p>
        } @else {
          <p class="mt-4 text-slate-300">Aponte a câmera para o código de barras.</p>
        }
        <button (click)="stopScanner()" class="mt-6 px-6 py-3 bg-slate-200 dark:bg-secondary rounded-lg">Fechar Scanner</button>
      </div>
    }

    <!-- Image Recognition Modal -->
    @if (isImageRecognitionOpen()) {
      <app-image-recognition 
        (itemRecognized)="handleItemRecognizedForExit($event)"
        (close)="isImageRecognitionOpen.set(false)"
      />
    }

    <!-- Matching Items Modal -->
    @if (matchingItems(); as matches) {
      <div class="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
        <div class="bg-white dark:bg-primary p-6 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
          <h3 class="text-xl font-bold mb-4">Itens Correspondentes</h3>
          <p class="text-sm text-slate-500 dark:text-slate-400 mb-4">A IA encontrou estes itens. Por favor, selecione o item correto para a retirada.</p>
          <div class="flex-grow overflow-y-auto pr-2 space-y-2">
            @for (item of matches; track item.id) {
              <button (click)="selectMatchingItem(item)" class="w-full text-left bg-slate-100 dark:bg-secondary p-3 rounded-md hover:bg-slate-200 dark:hover:bg-primary transition-colors">
                <p class="font-bold">{{ item.name }}</p>
                <p class="text-xs text-slate-500 dark:text-slate-400">Estoque Total: {{ item.quantity }}</p>
              </button>
            }
          </div>
          <div class="flex justify-end mt-6 pt-4 border-t border-slate-200 dark:border-secondary">
            <button (click)="matchingItems.set(null)" class="px-4 py-2 bg-slate-200 dark:bg-secondary rounded">Cancelar</button>
          </div>
        </div>
      </div>
    }
  `
})
export class MovementsComponent implements OnDestroy {
  movementType = input.required<'in' | 'out'>();
  
  private dbService = inject(DatabaseService);
  private toastService = inject(ToastService);
  private fb = inject(FormBuilder);
  private geminiService = inject(GeminiService);
  db = this.dbService.db;

  private destroy$ = new Subject<void>();
  currentPage = signal(1);
  itemsPerPage = 10;
  isFormOpen = signal(false);
  sortColumn = signal<keyof Movement | ''>('date');
  sortDirection = signal<'asc' | 'desc'>('desc');
  
  movementForm!: FormGroup;
  
  // --- Filtering signals and controls ---
  categoryFilterControl = new FormControl<string | null>(null);
  private selectedCategory = signal<string | null>(null);

  allItems = computed((): ItemWithAvailableStock[] => {
    return this.dbService.itemsWithAvailableStock().sort((a,b) => a.name.localeCompare(b.name));
  });

  selectableItems = computed((): ItemWithAvailableStock[] => {
    const category = this.selectedCategory();
    let allItems = this.allItems();

    if (category) {
        allItems = allItems.filter(item => item.category === category);
    }
    
    return allItems;
  });

  isScannerOpen = signal(false);
  scannerError = signal<string | null>(null);
  private codeReader: BrowserMultiFormatReader | null = null;
  scannerVideoElement = viewChild<ElementRef<HTMLVideoElement>>('scannerVideo');
  
  isImageRecognitionOpen = signal(false);
  matchingItems = signal<Item[] | null>(null);

  filteredMovements = computed(() => this.db().movements.filter(m => m.type === this.movementType()));
  
  sortedMovements = computed(() => {
    const movements = [...this.filteredMovements()];
    const column = this.sortColumn();
    const direction = this.sortDirection();

    if (!column) return movements;

    return movements.sort((a, b) => {
      let aValue: any; let bValue: any;
      if (column === 'itemId') { aValue = this.getItemName(a.itemId); bValue = this.getItemName(b.itemId); } 
      else if (column === 'technicianId') { aValue = this.getTechnicianName(a.technicianId); bValue = this.getTechnicianName(b.technicianId); } 
      else { aValue = a[column]; bValue = b[column]; }
      if (typeof aValue === 'number' && typeof bValue === 'number') return direction === 'asc' ? aValue - bValue : bValue - aValue;
      if (column === 'date') return direction === 'asc' ? new Date(aValue).getTime() - new Date(bValue).getTime() : new Date(bValue).getTime() - new Date(aValue).getTime();
      if (typeof aValue === 'string' && typeof bValue === 'string') return direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      return 0;
    });
  });

  totalPages = computed(() => Math.ceil(this.sortedMovements().length / this.itemsPerPage));

  paginatedMovements = computed(() => {
    const start = (this.currentPage() - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    return this.sortedMovements().slice(start, end);
  });

  constructor() {
    this.categoryFilterControl.valueChanges.pipe(
      takeUntil(this.destroy$)
    ).subscribe(category => {
      this.selectedCategory.set(category || null);
      this.movementForm?.get('itemName')?.setValue(null);
    });
  }

  ngOnDestroy(): void {
    this.stopScanner();
    this.destroy$.next();
    this.destroy$.complete();
  }

  handleSort(column: keyof Movement) {
    if (this.sortColumn() === column) {
      this.sortDirection.update(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortColumn.set(column);
      this.sortDirection.set('asc');
    }
  }

  prevPage() { this.currentPage.update(p => Math.max(1, p - 1)); }
  nextPage() { this.currentPage.update(p => Math.min(this.totalPages(), p + 1)); }

  getItemName(id: string): string {
    const item = this.db().items.find(i => i.id === id);
    if (item) return item.name;
    return 'Desconhecido';
  }

  getTechnicianName(id?: string | null): string { return !id ? 'N/A' : this.db().technicians.find(t => t.id === id)?.name || 'Desconhecido'; }

  openMovementForm(itemId: string | null = null) {
    const initialItem = itemId ? this.allItems().find(i => i.id === itemId) : null;

    this.movementForm = this.fb.group({
      itemName: [initialItem?.name ?? null, Validators.required],
      quantity: [1, [Validators.required, Validators.min(1)]],
      date: [new Date().toISOString().split('T')[0], Validators.required],
      technicianId: [null, this.movementType() === 'out' ? Validators.required : []]
    });
    // Reset filters
    this.categoryFilterControl.setValue(null, { emitEvent: false });
    this.selectedCategory.set(null);
    this.isFormOpen.set(true);
  }

  async saveMovement() {
    if (this.movementForm.invalid) return this.toastService.addToast('Formulário inválido.', 'error');
    const formValue = this.movementForm.value;

    const selectedItem = this.allItems().find(i => i.name === formValue.itemName);
    if (!selectedItem) {
      this.toastService.addToast(`Item "${formValue.itemName}" não encontrado.`, 'error');
      return;
    }

    const movement: Omit<Movement, 'id'> = {
      itemId: selectedItem.id,
      type: this.movementType(),
      quantity: formValue.quantity,
      date: formValue.date,
      technicianId: this.movementType() === 'out' ? formValue.technicianId : null
    };
    const result = await this.dbService.addMovement(movement);
    if (result.success) {
      this.toastService.addToast('Movimentação registrada!', 'success');
      this.isFormOpen.set(false);
    } else {
      this.toastService.addToast(result.message, 'error');
    }
  }

  async startScanner() {
    this.isScannerOpen.set(true);
    this.scannerError.set(null);
    this.codeReader = new BrowserMultiFormatReader();

    try {
      const videoInputDevices = await this.codeReader.listVideoInputDevices();
      if (videoInputDevices.length === 0) {
        throw new Error('Nenhuma câmera encontrada.');
      }
      
      const rearCamera = videoInputDevices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('trás'));
      const deviceId = rearCamera ? rearCamera.deviceId : videoInputDevices[0].deviceId;
      
      setTimeout(() => {
        const videoEl = this.scannerVideoElement()?.nativeElement;
        if (videoEl) {
          this.codeReader?.decodeFromVideoDevice(deviceId, videoEl, (result, error) => {
            if (result) {
              this.handleScannedCode(result.getText());
            }
            if (error && !(error instanceof NotFoundException)) {
              console.error('Scanner error:', error);
              this.scannerError.set('Ocorreu um erro com o scanner.');
            }
          });
        }
      }, 100);

    } catch (err: any) {
      console.error('Error accessing camera for scanner:', err);
      this.scannerError.set(err.message || 'Não foi possível acessar a câmera. Verifique as permissões.');
    }
  }

  stopScanner() {
    if (this.codeReader) {
      this.codeReader.reset();
      this.codeReader = null;
    }
    this.isScannerOpen.set(false);
  }

  handleScannedCode(code: string) {
    const item = this.allItems().find(i => i.id === code);
    if (item) {
      if ('vibrate' in navigator) navigator.vibrate(100);
      this.openMovementForm(item.id);
      this.toastService.addToast(`Item "${item.name}" selecionado.`, 'success');
    } else {
      if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
      this.toastService.addToast(`Item com código "${code}" não encontrado.`, 'error');
    }
    this.stopScanner();
  }

  async handleItemRecognizedForExit(data: { name: string; description: string; category: string }) {
    this.isImageRecognitionOpen.set(false);
    
    if (!this.geminiService.isConfigured()) {
        this.toastService.addToast('Serviço de IA não configurado para encontrar correspondências.', 'error');
        return;
    }
    
    this.toastService.addToast('Buscando itens correspondentes no inventário...', 'info');
    
    const fullDescription = `${data.name} - ${data.description}`;
    const allItemsForSearch = this.db().items;
    
    const matchingIds = await this.geminiService.findMatchingItems(fullDescription, allItemsForSearch);
    
    if (matchingIds && matchingIds.length > 0) {
        const matches = matchingIds
            .map(id => allItemsForSearch.find(item => item.id === id))
            .filter((item): item is Item => !!item);
            
        if (matches.length > 0) {
            this.matchingItems.set(matches);
        } else {
            this.toastService.addToast('Nenhum item correspondente encontrado no inventário.', 'info');
        }
    } else {
        this.toastService.addToast('Nenhum item correspondente encontrado.', 'info');
    }
  }
  
  selectMatchingItem(item: Item) {
    this.matchingItems.set(null);
    this.openMovementForm(item.id);
  }
}