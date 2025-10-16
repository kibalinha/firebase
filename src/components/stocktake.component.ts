import { Component, ChangeDetectionStrategy, inject, signal, viewChild, ElementRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators, FormControl } from '@angular/forms';
import { DatabaseService } from '../services/database.service';
import { ToastService } from '../services/toast.service';
import { Item } from '../models';
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';

@Component({
  selector: 'app-stocktake',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
     <div class="p-4 sm:p-6 h-full flex flex-col">
        <header class="mb-6">
            <h2 class="text-2xl font-bold">Inventário Físico (Stocktake)</h2>
            <p class="text-sm text-slate-500 dark:text-slate-400">Realize uma contagem completa de todo o estoque para auditoria e ajuste.</p>
        </header>

        <div class="flex-grow overflow-y-auto min-h-0">
            @switch(step()) {
                @case('idle') {
                    <div class="text-center p-10 bg-white dark:bg-primary rounded-lg flex flex-col items-center justify-center h-full border-2 border-dashed border-slate-300 dark:border-secondary">
                        <p class="text-lg font-semibold">Pronto para iniciar um novo Inventário Físico?</p>
                        <p class="text-slate-500 dark:text-slate-400 mt-2 max-w-lg">
                           <strong class="text-amber-600 dark:text-amber-400">Atenção:</strong> Ao iniciar, todas as outras movimentações de estoque (entradas, saídas, ajustes) serão bloqueadas até a finalização ou cancelamento do inventário.
                        </p>
                        <button (click)="startStocktake()" [disabled]="isLoading()" class="mt-6 bg-accent text-white px-6 py-3 rounded-md hover:bg-info transition-colors flex items-center justify-center w-52 disabled:opacity-50">
                            @if(isLoading()) {
                                <div class="w-5 h-5 border-2 border-slate-400 border-t-white rounded-full animate-spin"></div>
                            } @else {
                                <span>Iniciar Inventário</span>
                            }
                        </button>
                    </div>
                }
                 @case('counting') {
                    <div class="bg-white dark:bg-primary p-6 rounded-lg shadow-md">
                        <div class="flex justify-between items-center mb-4">
                            <h3 class="text-xl font-bold">Realizando Contagem</h3>
                            <button (click)="startScanner()" class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 4a1 1 0 011-1h4a1 1 0 010 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h4a1 1 0 010 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h4a1 1 0 010 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h4a1 1 0 010 2H4a1 1 0 01-1-1zm14-8a1 1 0 00-1-1h-4a1 1 0 000 2h4a1 1 0 001-1zm-1 4a1 1 0 01-1 1h-4a1 1 0 010-2h4a1 1 0 011 1zm-1 4a1 1 0 01-1 1h-4a1 1 0 010-2h4a1 1 0 011 1z" clip-rule="evenodd" /></svg>
                                Escanear Item
                            </button>
                        </div>
                        <form [formGroup]="countForm">
                             <!-- Table for desktop -->
                            <table class="w-full text-left hidden md:table">
                                <thead>
                                    <tr class="border-b dark:border-slate-600">
                                        <th class="p-2 w-3/5">Item</th>
                                        <th class="p-2">Quantidade Contada</th>
                                    </tr>
                                </thead>
                                <tbody formArrayName="items">
                                    @for(control of itemsArray.controls; track $index) {
                                        <tr [formGroupName]="$index" class="border-b dark:border-slate-700">
                                            <td class="p-2">{{ itemsToCount()[$index].name }}</td>
                                            <td class="p-2">
                                                <input type="number" formControlName="countedQuantity" min="0" class="w-full bg-slate-100 dark:bg-secondary p-2 rounded">
                                            </td>
                                        </tr>
                                    }
                                </tbody>
                            </table>
                             <!-- Cards for mobile -->
                             <div formArrayName="items" class="space-y-3 md:hidden">
                                @for(control of itemsArray.controls; track $index; let i = $index) {
                                    <div [formGroupName]="$index" class="bg-slate-50 dark:bg-secondary p-4 rounded-lg">
                                        <p class="font-bold text-slate-800 dark:text-slate-100">{{ itemsToCount()[i].name }}</p>
                                        <div class="mt-2">
                                            <label class="block text-sm font-medium mb-1">Qtd. Contada</label>
                                            <input type="number" formControlName="countedQuantity" min="0" class="w-full bg-white dark:bg-primary p-2 rounded">
                                        </div>
                                    </div>
                                }
                            </div>
                            <div class="flex justify-end gap-4 mt-6">
                                <button type="button" (click)="cancelStocktake()" class="px-4 py-2 bg-slate-200 dark:bg-secondary rounded">Cancelar</button>
                                <button type="button" (click)="reviewCount()" class="px-4 py-2 bg-accent text-white rounded">Revisar Contagem</button>
                            </div>
                        </form>
                    </div>
                }
                 @case('review') {
                     <div class="bg-white dark:bg-primary p-6 rounded-lg shadow-md">
                        <h3 class="text-xl font-bold mb-4">Revisar Discrepâncias</h3>
                         <p class="text-sm mb-4">Somente os itens com divergências são mostrados. Itens não listados tiveram a contagem zerada.</p>
                        <table class="w-full text-left">
                            <thead>
                                <tr class="border-b dark:border-slate-600">
                                    <th class="p-2">Item</th>
                                    <th class="p-2 text-center">Sistema</th>
                                    <th class="p-2 text-center">Contado</th>
                                    <th class="p-2 text-center">Diferença</th>
                                </tr>
                            </thead>
                            <tbody>
                                @for(item of discrepancies(); track item.id) {
                                    <tr class="border-b dark:border-slate-700 font-medium" [class.bg-red-50]="item.difference !== 0" [class.dark:bg-red-900/20]="item.difference !== 0">
                                        <td class="p-2">{{ item.name }}</td>
                                        <td class="p-2 text-center">{{ item.systemQuantity }}</td>
                                        <td class="p-2 text-center">{{ item.countedQuantity }}</td>
                                        <td class="p-2 text-center font-bold" [class.text-red-500]="item.difference < 0" [class.text-green-500]="item.difference > 0">
                                            {{ item.difference > 0 ? '+' : '' }}{{ item.difference }}
                                        </td>
                                    </tr>
                                }
                            </tbody>
                        </table>
                        <div class="flex justify-end gap-4 mt-6">
                            <button type="button" (click)="step.set('counting')" class="px-4 py-2 bg-slate-200 dark:bg-secondary rounded">Voltar e Corrigir</button>
                            <button (click)="confirmAdjustments()" [disabled]="isLoading()" class="px-4 py-2 bg-success text-white rounded w-48 flex items-center justify-center disabled:opacity-50">
                                @if(isLoading()) {
                                    <div class="w-5 h-5 border-2 border-slate-400 border-t-white rounded-full animate-spin"></div>
                                } @else {
                                    <span>Finalizar Inventário</span>
                                }
                            </button>
                        </div>
                    </div>
                }
            }
        </div>
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
    </div>
  `
})
export class StocktakeComponent implements OnDestroy {
    private dbService = inject(DatabaseService);
    private toastService = inject(ToastService);
    private fb = inject(FormBuilder);

    step = signal<'idle' | 'counting' | 'review'>('idle');
    isLoading = signal(false);
    
    itemsToCount = signal<Item[]>([]);
    discrepancies = signal<{id: string, name: string, systemQuantity: number, countedQuantity: number, difference: number}[]>([]);
    
    countForm: FormGroup = this.fb.group({ items: this.fb.array([]) });

    isScannerOpen = signal(false);
    scannerError = signal<string | null>(null);
    private codeReader: BrowserMultiFormatReader | null = null;
    scannerVideoElement = viewChild<ElementRef<HTMLVideoElement>>('scannerVideo');

    get itemsArray(): FormArray {
        return this.countForm.get('items') as FormArray;
    }

    ngOnDestroy() {
        this.stopScanner();
    }
    
    startStocktake() {
        const allItems = this.dbService.db().items.slice().sort((a,b) => a.name.localeCompare(b.name));
        this.itemsToCount.set(allItems);
        this.setupCountForm();
        this.step.set('counting');
        this.toastService.addToast('Inventário físico iniciado.', 'info');
    }

    setupCountForm() {
        const controls = this.itemsToCount().map(item => 
          this.fb.group({
            id: [item.id],
            countedQuantity: [null, [Validators.required, Validators.min(0)]]
          })
        );
        this.countForm = this.fb.group({ items: this.fb.array(controls) });
    }

    reviewCount() {
        const countedValues = this.itemsArray.value;
        const discrepancies = this.itemsToCount().map((item, index) => {
          const counted = countedValues[index].countedQuantity ?? 0;
          return {
            id: item.id,
            name: item.name,
            systemQuantity: item.quantity,
            countedQuantity: counted,
            difference: counted - item.quantity,
          };
        }).filter(d => d.difference !== 0);

        this.discrepancies.set(discrepancies);
        this.step.set('review');
    }

    async confirmAdjustments() {
        this.isLoading.set(true);
        try {
          for (const discrepancy of this.discrepancies()) {
            await this.dbService.adjustItemQuantity(
              discrepancy.id,
              discrepancy.countedQuantity,
              `Ajuste via Inventário Físico. Contado: ${discrepancy.countedQuantity}, Sistema: ${discrepancy.systemQuantity}.`,
              false // Stocktake is only for main inventory
            );
          }
          this.toastService.addToast('Inventário físico finalizado e ajustes aplicados!', 'success');
          this.reset();
        } catch(e) {
            this.toastService.addToast('Falha ao aplicar ajustes do inventário.', 'error');
        } finally {
          this.isLoading.set(false);
        }
    }

    cancelStocktake() {
        if (confirm('Tem certeza que deseja cancelar o inventário? Nenhuma alteração será salva.')) {
            this.reset();
        }
    }

    reset() {
        this.step.set('idle');
        this.itemsToCount.set([]);
        this.discrepancies.set([]);
        this.countForm = this.fb.group({ items: this.fb.array([]) });
        this.toastService.addToast('Inventário cancelado.', 'info');
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
        const itemIndex = this.itemsToCount().findIndex(i => i.id === code);
        if (itemIndex > -1) {
            if ('vibrate' in navigator) navigator.vibrate(100);
            this.toastService.addToast(`Item "${this.itemsToCount()[itemIndex].name}" encontrado!`, 'success');
            
            // Focus on the input
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
            this.toastService.addToast(`Item com código escaneado não encontrado no inventário.`, 'error');
        }
    }
}