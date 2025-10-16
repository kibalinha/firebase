import { Component, ChangeDetectionStrategy, inject, signal, computed, viewChild, ElementRef, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { DatabaseService } from '../services/database.service';
import { ToastService } from '../services/toast.service';
import { PickingList, PickingListItem, PickingListStatus } from '../models';
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';

interface EnrichedPickingList extends PickingList {
  totalItems: number;
  totalPicked: number;
}

@Component({
  selector: 'app-picking-lists',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-4 sm:p-6 h-full flex flex-col">
      <header class="flex justify-between items-start mb-4 gap-2 flex-wrap">
        <div>
          <h2 class="text-2xl font-bold">Listas de Coleta (Picking)</h2>
          <p class="text-sm text-slate-500 dark:text-slate-400">Otimize a retirada de múltiplos itens com rotas de coleta inteligentes.</p>
        </div>
        <button (click)="openForm()" class="bg-accent text-white px-4 py-2 rounded-md hover:bg-info transition-colors">
          + Nova Lista de Coleta
        </button>
      </header>

      @if (!currentList()) {
        <!-- List View -->
        <div class="flex-grow overflow-auto">
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            @for(list of enrichedPickingLists(); track list.id) {
              <div class="bg-white dark:bg-primary p-4 rounded-lg shadow-md flex flex-col">
                <div class="flex-grow">
                  <div class="flex justify-between items-start">
                    <h3 class="font-bold text-lg mb-2">{{ list.name }}</h3>
                    <div class="flex items-center space-x-2">
                       @if (list.status === PickingListStatus.Pendente) {
                        <button (click)="openForm(list)" class="p-1 text-slate-500 dark:text-slate-300 hover:text-accent" title="Editar">✏️</button>
                      }
                      <button (click)="openDeleteConfirm(list)" class="p-1 text-slate-500 dark:text-slate-300 hover:text-error" title="Excluir">🗑️</button>
                    </div>
                  </div>
                  <p class="text-sm text-slate-500 dark:text-slate-400">Para: {{ getTechnicianName(list.technicianId) }}</p>
                  <p class="text-xs text-slate-400 mb-3">Criada em: {{ list.createdAt | date:'dd/MM/yyyy' }}</p>
                </div>
                <div class="mt-4 pt-4 border-t border-slate-200 dark:border-secondary flex justify-between items-center">
                   <div class="w-full bg-slate-200 dark:bg-secondary rounded-full h-2.5">
                    <div class="bg-accent h-2.5 rounded-full" [style.width.%]="(list.totalPicked / list.totalItems) * 100"></div>
                  </div>
                  <span class="ml-3 text-sm font-semibold">{{ list.totalPicked }} / {{ list.totalItems }}</span>
                  <button (click)="startPicking(list)" class="ml-4 text-sm font-bold bg-green-600 text-white px-3 py-1 rounded-md hover:bg-green-700">
                    {{ list.status === PickingListStatus.Concluida ? 'Ver' : 'Coletar' }}
                  </button>
                </div>
              </div>
            } @empty {
              <div class="col-span-full text-center p-10 text-slate-500 dark:text-slate-400 bg-white dark:bg-primary rounded-lg">
                <p>Nenhuma lista de coleta criada.</p>
              </div>
            }
          </div>
        </div>
      } @else {
        <!-- Picking View -->
        <div class="bg-white dark:bg-primary p-6 rounded-lg shadow-md flex-grow flex flex-col overflow-y-auto">
           <div class="flex justify-between items-start mb-4">
              <div>
                <h3 class="text-xl font-bold">Coletando Itens: {{ currentList()!.name }}</h3>
                <p class="text-sm text-slate-500 dark:text-slate-400">Siga a rota otimizada e insira as quantidades coletadas.</p>
              </div>
              <div>
                <button (click)="currentList.set(null)" class="text-sm text-accent hover:underline">&larr; Voltar</button>
                <button (click)="startScanner()" class="ml-4 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">Escanear</button>
              </div>
           </div>
           <form [formGroup]="pickingForm" class="flex-grow overflow-auto pr-2">
            <!-- Table for Desktop -->
            <table class="w-full text-left hidden md:table">
              <thead>
                <tr class="border-b dark:border-slate-600">
                  <th class="p-2">Item</th>
                  <th class="p-2">Qtd. Pedida</th>
                  <th class="p-2">Qtd. Coletada</th>
                </tr>
              </thead>
              <tbody formArrayName="items">
                @for(itemControl of pickingItemsArray.controls; track $index) {
                  <tr [formGroupName]="$index">
                    <td class="p-2 font-medium">{{ getItemName(optimizedPickingRoute()[$index].itemId) }}</td>
                    <td class="p-2 text-center">{{ optimizedPickingRoute()[$index].quantity }}</td>
                    <td class="p-2">
                      <input type="number" formControlName="pickedQuantity" class="w-full bg-slate-100 dark:bg-secondary p-2 rounded">
                    </td>
                  </tr>
                }
              </tbody>
            </table>
            <!-- Cards for Mobile -->
            <div formArrayName="items" class="md:hidden space-y-3">
                @for(itemControl of pickingItemsArray.controls; track $index) {
                    <div [formGroupName]="$index" class="p-4 rounded-lg bg-slate-50 dark:bg-secondary">
                        <div class="flex justify-between items-start">
                            <p class="font-bold text-slate-800 dark:text-slate-100">{{ getItemName(optimizedPickingRoute()[$index].itemId) }}</p>
                            <p class="text-sm">Pedido: <span class="font-bold">{{ optimizedPickingRoute()[$index].quantity }}</span></p>
                        </div>
                        <div class="mt-2">
                            <label class="block text-sm font-medium mb-1">Qtd. Coletada</label>
                            <input type="number" formControlName="pickedQuantity" class="w-full bg-white dark:bg-primary p-2 rounded">
                        </div>
                    </div>
                }
            </div>
           </form>
            <div class="flex justify-end gap-4 mt-6 pt-4 border-t border-slate-200 dark:border-secondary">
              <button (click)="processPicking()" [disabled]="isLoading()" class="px-4 py-2 bg-success text-white rounded w-52 flex justify-center disabled:opacity-50">
                @if(isLoading()) { <div class="w-5 h-5 border-2 border-slate-400 border-t-white rounded-full animate-spin"></div> }
                @else { <span>Confirmar Coleta e Dar Baixa</span> }
              </button>
            </div>
        </div>
      }
    </div>
    
    <!-- Form Modal -->
    @if (isFormOpen()) {
      <div class="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-40">
        <div class="bg-white dark:bg-primary p-6 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
          <h3 class="text-xl font-bold mb-4">{{ listToEdit()?.id ? 'Editar' : 'Nova' }} Lista de Coleta</h3>
          
          <form [formGroup]="form" (ngSubmit)="save()" class="flex-grow overflow-y-auto pr-2">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label class="block text-sm mb-1">Nome da Lista</label>
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
            </div>

            <h4 class="text-lg font-semibold mb-2">Itens para Coleta</h4>
            <div formArrayName="items" class="space-y-2">
              @for(itemGroup of itemsArray.controls; track $index) {
                <div [formGroupName]="$index" class="flex items-center gap-2 bg-slate-50 dark:bg-secondary p-2 rounded">
                  <div class="flex-grow">
                     <input 
                        type="text"
                        list="available-items-list"
                        formControlName="itemName"
                        autocomplete="off"
                        placeholder="Digite para buscar um item..."
                        class="w-full bg-white dark:bg-primary p-2 rounded"
                      />
                  </div>
                  <div>
                    <input type="number" formControlName="quantity" min="1" class="w-20 bg-white dark:bg-primary p-2 rounded">
                  </div>
                  <button type="button" (click)="removeItem($index)" class="p-1 text-slate-400 hover:text-error transition-colors">🗑️</button>
                </div>
              }
            </div>
             <datalist id="available-items-list">
                @for (item of availableItems(); track item.id) {
                  <option [value]="item.name"></option>
                }
              </datalist>
            <button type="button" (click)="addItem()" class="mt-2 text-sm text-accent hover:underline">+ Adicionar Item</button>

            <div class="flex justify-end gap-4 mt-6 pt-4 border-t border-slate-200 dark:border-secondary">
              <button type="button" (click)="isFormOpen.set(false)" class="px-4 py-2 bg-slate-200 dark:bg-secondary rounded">Cancelar</button>
              <button type="submit" [disabled]="form.invalid" class="px-4 py-2 bg-accent text-white rounded disabled:opacity-50">Salvar Lista</button>
            </div>
          </form>
        </div>
      </div>
    }

    <!-- Delete Confirmation Modal -->
    @if (listToDelete()) {
      <div class="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
        <div class="bg-white dark:bg-primary p-6 rounded-lg shadow-xl w-full max-w-md">
          <h3 class="text-xl font-bold mb-4">Confirmar Exclusão</h3>
          <p>Tem certeza que deseja excluir a lista "{{ listToDelete()?.name }}"?</p>
          <div class="flex justify-end gap-4 mt-6">
            <button (click)="listToDelete.set(null)" class="px-4 py-2 bg-slate-200 dark:bg-secondary rounded">Cancelar</button>
            <button (click)="deleteList()" class="px-4 py-2 bg-error text-white rounded">Excluir</button>
          </div>
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
  `
})
export class PickingListsComponent implements OnDestroy {
  private dbService = inject(DatabaseService);
  private toastService = inject(ToastService);
  private fb = inject(FormBuilder);
  db = this.dbService.db;
  
  PickingListStatus = PickingListStatus;

  isLoading = signal(false);
  currentList = signal<PickingList | null>(null);
  
  isFormOpen = signal(false);
  listToEdit = signal<PickingList | null>(null);
  listToDelete = signal<PickingList | null>(null);
  form!: FormGroup;
  pickingForm!: FormGroup;

  isScannerOpen = signal(false);
  scannerError = signal<string | null>(null);
  private codeReader: BrowserMultiFormatReader | null = null;
  scannerVideoElement = viewChild<ElementRef<HTMLVideoElement>>('scannerVideo');

  enrichedPickingLists = computed((): EnrichedPickingList[] => {
    return this.db().pickingLists.map(list => ({
      ...list,
      totalItems: list.items.reduce((sum, i) => sum + i.quantity, 0),
      totalPicked: list.items.reduce((sum, i) => sum + i.pickedQuantity, 0),
    })).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  });
  
  availableItems = computed(() => this.dbService.itemsWithAvailableStock());
  
  optimizedPickingRoute = computed(() => {
    const list = this.currentList();
    if (!list) return [];
    
    return list.items.map(item => {
      const dbItem = this.dbService.itemsWithAvailableStock().find(i => i.id === item.itemId);
      return {
        ...item,
        itemName: dbItem?.name || 'Desconhecido',
      };
    });
  });

  get itemsArray() { return this.form.get('items') as FormArray; }
  get pickingItemsArray() { return this.pickingForm.get('items') as FormArray; }
  
  getTechnicianName(id: string) { return this.db().technicians.find(t => t.id === id)?.name || 'N/A'; }
  getItemName(id: string) { return this.dbService.itemsWithAvailableStock().find(i => i.id === id)?.name || 'N/A'; }

  ngOnDestroy(): void {
    this.stopScanner();
  }

  openForm(list: PickingList | null = null) {
    this.listToEdit.set(list);
    const itemControls = list?.items.map(i => {
      const itemName = this.getItemName(i.itemId);
      return this.createItemGroup(itemName, i.quantity);
    }) || [];

    this.form = this.fb.group({
      name: [list?.name || '', Validators.required],
      technicianId: [list?.technicianId || this.db().technicians[0]?.id, Validators.required],
      items: this.fb.array(itemControls, Validators.minLength(1))
    });
    if (!list) {
      this.addItem();
    }
    this.isFormOpen.set(true);
  }

  createItemGroup(itemName: string | null, quantity: number | null): FormGroup {
    return this.fb.group({
      itemName: [itemName, Validators.required],
      quantity: [quantity, [Validators.required, Validators.min(1)]]
    });
  }

  addItem() { this.itemsArray.push(this.createItemGroup(null, 1)); }
  removeItem(index: number) { this.itemsArray.removeAt(index); }

  async save() {
    if (this.form.invalid) {
      this.toastService.addToast('Formulário inválido.', 'error');
      return;
    }
    const formValue = this.form.value;
    const current = this.listToEdit();
    
    const items: PickingListItem[] = [];
    for (const formItem of formValue.items) {
        const item = this.availableItems().find(i => i.name === formItem.itemName);
        if (!item) {
            this.toastService.addToast(`Item "${formItem.itemName}" não encontrado.`, 'error');
            return;
        }
        const existingItem = current?.items.find(i => i.itemId === item.id);
        items.push({
            itemId: item.id,
            quantity: formItem.quantity,
            pickedQuantity: existingItem?.pickedQuantity || 0
        });
    }

    const data = { 
      ...current, ...formValue, items,
      status: current?.status || PickingListStatus.Pendente,
      createdAt: current?.createdAt || new Date().toISOString()
    };
    
    if (current?.id) {
      await this.dbService.updateItem('pickingLists', data as PickingList);
      this.toastService.addToast('Lista de coleta atualizada!', 'success');
    } else {
      await this.dbService.addItem('pickingLists', data);
      this.toastService.addToast('Lista de coleta criada!', 'success');
    }
    this.isFormOpen.set(false);
  }
  
  openDeleteConfirm(list: PickingList) { 
    this.listToDelete.set(list);
  }

  async deleteList() {
    const list = this.listToDelete();
    if (list) {
      await this.dbService.deleteItem('pickingLists', list.id);
      this.toastService.addToast('Lista de coleta excluída!', 'success');
      this.listToDelete.set(null);
    }
  }
  
  startPicking(list: PickingList) {
    this.currentList.set(list);
    
    const sortedItems = this.optimizedPickingRoute();
    const controls = sortedItems.map(item => 
      this.fb.group({
        itemId: [item.itemId],
        pickedQuantity: [item.pickedQuantity || item.quantity, [Validators.required, Validators.min(0), Validators.max(item.quantity)]]
      })
    );
    this.pickingForm = this.fb.group({ items: this.fb.array(controls) });
  }

  async processPicking() {
    const list = this.currentList();
    if (!list || this.pickingForm.invalid) return;

    this.isLoading.set(true);
    try {
      const pickedItems: {itemId: string, pickedQuantity: number}[] = this.pickingForm.value.items.map((val: any, index: number) => ({
          itemId: this.optimizedPickingRoute()[index].itemId,
          pickedQuantity: val.pickedQuantity
      }));
      
      await this.dbService.processPickingList(list.id, pickedItems);
      this.toastService.addToast(`Coleta da lista "${list.name}" processada!`, 'success');
      this.currentList.set(null);
    } catch (e: any) {
      this.toastService.addToast(e.message, 'error');
    } finally {
      this.isLoading.set(false);
    }
  }

  async startScanner() {
    this.isScannerOpen.set(true);
    this.scannerError.set(null);
    this.codeReader = new BrowserMultiFormatReader();

    try {
      const videoInputDevices = await this.codeReader.listVideoInputDevices();
      if (videoInputDevices.length === 0) throw new Error('Nenhuma câmera encontrada.');
      
      const rearCamera = videoInputDevices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('trás'));
      const deviceId = rearCamera ? rearCamera.deviceId : videoInputDevices[0].deviceId;
      
      setTimeout(() => {
        const videoEl = this.scannerVideoElement()?.nativeElement;
        if (videoEl) {
          this.codeReader?.decodeFromVideoDevice(deviceId, videoEl, (result, error) => {
            if (result) {
              this.handleScannedCode(result.getText());
              this.stopScanner();
            }
            if (error && !(error instanceof NotFoundException)) {
              this.scannerError.set('Ocorreu um erro com o scanner.');
            }
          });
        }
      }, 100);

    } catch (err: any) {
      this.scannerError.set(err.message || 'Não foi possível acessar a câmera.');
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
    const route = this.optimizedPickingRoute();
    const itemIndex = route.findIndex(i => i.itemId === code);
    
    if (itemIndex > -1) {
        if ('vibrate' in navigator) navigator.vibrate(100);
        this.toastService.addToast(`Item "${route[itemIndex].itemName}" encontrado!`, 'success');
        
        const rowElements = document.querySelectorAll('tbody tr, .md\\:hidden > div');
        if (rowElements.length > itemIndex) {
            const rowElement = rowElements[itemIndex];
            const inputElement = rowElement?.querySelector('input[type="number"]');
            if (inputElement) {
                (inputElement as HTMLElement).focus();
                rowElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    } else {
        if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
        this.toastService.addToast(`Item escaneado não está nesta lista de coleta.`, 'error');
    }
  }
}
