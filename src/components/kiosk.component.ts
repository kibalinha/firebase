import { Component, ChangeDetectionStrategy, inject, signal, computed, viewChild, ElementRef, OnDestroy, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormControl } from '@angular/forms';
import { DatabaseService } from '../services/database.service';
import { ToastService } from '../services/toast.service';
import { Item, Technician, ItemWithAvailableStock } from '../models';
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';

interface CartItem {
  item: ItemWithAvailableStock;
  quantity: number;
}

@Component({
  selector: 'app-kiosk',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-slate-200 dark:bg-slate-800 h-full w-full flex flex-col items-center justify-center p-4 sm:p-8">
      @switch (step()) {
        @case ('select_technician') {
          <div class="w-full max-w-4xl text-center">
            <h1 class="text-4xl font-bold mb-2">Modo Kiosk</h1>
            <h2 class="text-2xl text-slate-600 dark:text-slate-300 mb-8">Quem está fazendo a retirada?</h2>
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
              @for (tech of db().technicians; track tech.id) {
                <button (click)="selectTechnician(tech)" class="bg-white dark:bg-primary p-6 rounded-lg shadow-lg hover:shadow-xl hover:scale-105 transition-transform duration-200 flex flex-col items-center gap-3">
                  <span class="text-5xl">👨‍🔧</span>
                  <span class="font-bold text-lg">{{ tech.name }}</span>
                </button>
              }
              @empty {
                <p class="col-span-full text-slate-500">Nenhum técnico cadastrado.</p>
              }
            </div>
          </div>
        }
        @case ('enter_password') {
          <div class="w-full max-w-sm text-center bg-white dark:bg-primary p-8 rounded-xl shadow-2xl">
            <h1 class="text-2xl font-bold mb-2">Verificação de Senha</h1>
            <p class="text-slate-600 dark:text-slate-300 mb-6">Olá, <span class="font-bold">{{ selectedTechnician()?.name }}</span>! Digite sua senha para continuar.</p>
            <form [formGroup]="passwordForm" (ngSubmit)="verifyPassword()" class="space-y-4">
              <input 
                #passwordInput
                type="password" 
                formControlName="password"
                class="w-full text-center text-lg p-3 bg-slate-100 dark:bg-secondary rounded-md focus:ring-2 focus:ring-accent focus:outline-none"
                placeholder="••••••••"
              >
              <div class="flex gap-4 pt-4">
                <button type="button" (click)="backToTechnicianSelection()" class="w-full px-4 py-3 bg-slate-200 dark:bg-secondary rounded-lg font-semibold">Voltar</button>
                <button type="submit" [disabled]="passwordForm.invalid" class="w-full px-4 py-3 bg-accent text-white rounded-lg font-semibold disabled:opacity-50">Confirmar</button>
              </div>
            </form>
          </div>
        }
        @case ('scan_items') {
          <div class="bg-white dark:bg-primary w-full max-w-6xl h-full flex flex-col rounded-xl shadow-2xl overflow-hidden">
            <header class="p-4 flex justify-between items-center border-b border-slate-200 dark:border-secondary flex-wrap gap-4">
              <div class="flex items-center gap-4">
                <button (click)="reset()" class="text-sm text-accent hover:underline">Trocar Técnico</button>
                <h2 class="font-bold">Olá, {{ selectedTechnician()?.name }}!</h2>
              </div>
               <div class="flex items-center gap-2">
                  <button (click)="startScanner()" class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2 h-10">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 4a1 1 0 011-1h4a1 1 0 010 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h4a1 1 0 010 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h4a1 1 0 010 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h4a1 1 0 010 2H4a1 1 0 01-1-1zm14-8a1 1 0 00-1-1h-4a1 1 0 000 2h4a1 1 0 001-1zm-1 4a1 1 0 01-1 1h-4a1 1 0 010-2h4a1 1 0 011 1zm-1 4a1 1 0 01-1 1h-4a1 1 0 010-2h4a1 1 0 011 1z" clip-rule="evenodd" /></svg>
                      Escanear
                  </button>
                  <button (click)="goToConfirm()" [disabled]="cart().length === 0" class="flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-md hover:bg-info transition-colors disabled:opacity-50 h-10">
                    Concluir ({{ totalCartItems() }})
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clip-rule="evenodd" /></svg>
                  </button>
                </div>
            </header>
            <main class="flex-grow p-4 overflow-y-auto relative">
              <!-- Manual Add Form -->
              <div class="mb-4 p-4 border border-slate-200 dark:border-secondary rounded-lg bg-slate-50 dark:bg-secondary/30">
                <h3 class="font-semibold mb-2">Adicionar Item Manualmente</h3>
                <form [formGroup]="addItemForm" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 items-end">
                  <div class="md:col-span-2">
                    <label class="text-xs text-slate-500 dark:text-slate-400">Categoria</label>
                    <select [formControl]="kioskCategoryFilterControl" class="bg-white dark:bg-secondary p-2 rounded-md border border-slate-300 dark:border-slate-600 focus:border-accent focus:outline-none w-full h-10">
                      <option [ngValue]="null">Todas</option>
                      @for (cat of db().categories; track cat) { <option [value]="cat">{{cat}}</option> }
                    </select>
                  </div>
                  <div class="sm:col-span-2 md:col-span-2">
                    <label class="text-xs text-slate-500 dark:text-slate-400">Item</label>
                     <input 
                        type="text"
                        list="kiosk-items-datalist"
                        formControlName="itemName"
                        autocomplete="off"
                        placeholder="Digite para buscar..."
                        class="bg-white dark:bg-secondary p-2 rounded-md border border-slate-300 dark:border-slate-600 focus:border-accent focus:outline-none w-full h-10"
                      />
                      <datalist id="kiosk-items-datalist">
                        @for (item of availableItemsForKiosk(); track item.id) {
                          <option [value]="item.name"></option>
                        }
                      </datalist>
                  </div>
                  <div class="sm:col-span-2 md:col-span-1 flex items-end gap-2">
                    <div class="flex-grow">
                      <label class="text-xs text-slate-500 dark:text-slate-400">Qtd.</label>
                      <input type="number" formControlName="quantity" class="bg-white dark:bg-secondary p-2 rounded-md border border-slate-300 dark:border-slate-600 focus:border-accent focus:outline-none w-full h-10">
                    </div>
                    <button type="button" (click)="addItemToCart()" [disabled]="addItemForm.invalid" class="bg-sky-600 text-white px-4 py-2 rounded-md hover:bg-sky-700 transition-colors disabled:opacity-50 h-10 self-end">Add</button>
                  </div>
                </form>
              </div>

              @if(cart().length > 0) {
                <ul class="space-y-3">
                  @for (cartItem of cart(); track cartItem.item.id) {
                    <li class="bg-slate-50 dark:bg-secondary p-3 rounded-lg flex items-center justify-between gap-4">
                      <div class="flex-grow">
                        <p class="font-bold">{{ cartItem.item.name }}</p>
                        <p class="text-sm text-slate-500 dark:text-slate-400">Disponível: {{ cartItem.item.availableStock }}</p>
                      </div>
                      <div class="flex items-center gap-3">
                        <button (click)="updateCartQuantity(cartItem.item.id, -1)" class="w-8 h-8 rounded-full bg-slate-200 dark:bg-primary hover:bg-slate-300 dark:hover:bg-slate-500">-</button>
                        <span class="font-bold text-lg w-10 text-center">{{ cartItem.quantity }}</span>
                        <button (click)="updateCartQuantity(cartItem.item.id, 1)" class="w-8 h-8 rounded-full bg-slate-200 dark:bg-primary hover:bg-slate-300 dark:hover:bg-slate-500">+</button>
                      </div>
                    </li>
                  }
                </ul>
              } @else {
                <div class="h-full flex flex-col items-center justify-center text-center text-slate-500 dark:text-slate-400 min-h-[200px]">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-24 w-24 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1"><path stroke-linecap="round" stroke-linejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                  <p class="text-xl font-semibold">Carrinho vazio</p>
                  <p>Use a seleção de item ou o scanner para adicionar produtos à sua retirada.</p>
                </div>
              }
              <!-- Scanner Modal -->
              @if (isScannerOpen()) {
                <div class="absolute inset-0 bg-black bg-opacity-90 flex flex-col items-center justify-center z-20 p-4">
                  <div class="relative w-full max-w-5xl bg-black rounded-lg overflow-hidden">
                    <video #scannerVideo class="w-full h-auto"></video>
                    <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div class="w-11/12 h-3/4 border-4 border-dashed border-accent/70 rounded-lg"></div>
                    </div>
                    <div class="animate-scan-line"></div>
                  </div>
                  
                  <!-- Confirmation Dialog -->
                  @if (scannedItem(); as item) {
                    <div class="absolute inset-0 bg-black/80 flex items-center justify-center flex-col p-4 z-30">
                        <div class="bg-white dark:bg-primary p-6 rounded-lg shadow-xl text-center">
                            <h3 class="text-xl font-bold mb-2">{{ item.name }}</h3>
                            <p class="text-slate-500 dark:text-slate-400 mb-4">Estoque disponível: {{ item.availableStock }}</p>
                            <p class="mb-6">Adicionar 1 unidade ao carrinho?</p>
                            <div class="flex justify-center gap-4">
                                <button (click)="cancelAddItem()" class="px-6 py-2 bg-slate-200 dark:bg-secondary rounded">Cancelar</button>
                                <button (click)="confirmAddItemToCart()" class="px-6 py-2 bg-accent text-white rounded">Adicionar</button>
                            </div>
                        </div>
                    </div>
                  }

                  @if (scannerError()) {
                    <p class="mt-4 text-red-400 bg-red-900/50 p-3 rounded-md">{{ scannerError() }}</p>
                  } @else if (!scannedItem()) {
                    <p class="mt-4 text-slate-300">Aponte a câmera para o código de barras do item.</p>
                  }
                  <button (click)="stopScanner()" class="mt-6 px-6 py-3 bg-slate-200 dark:bg-secondary rounded-lg">Fechar Scanner</button>
                </div>
              }
            </main>
          </div>
        }
        @case ('confirm') {
          <div class="bg-white dark:bg-primary w-full max-w-2xl rounded-xl shadow-2xl p-8">
            <h2 class="text-2xl font-bold mb-4">Confirmar Retirada</h2>
            <p class="mb-6">Por favor, confirme os itens e quantidades abaixo para <strong class="text-accent">{{ selectedTechnician()?.name }}</strong>.</p>
            <ul class="space-y-2 max-h-64 overflow-y-auto pr-2 border-t border-b py-4 border-slate-200 dark:border-secondary">
              @for(cartItem of cart(); track cartItem.item.id) {
                 <li class="flex justify-between items-center p-2 rounded-md bg-slate-100 dark:bg-secondary">
                    <span class="font-medium">{{ cartItem.item.name }}</span>
                    <span class="font-bold">{{ cartItem.quantity }} un.</span>
                 </li>
              }
            </ul>
            <div class="flex justify-end gap-4 mt-8">
                <button (click)="step.set('scan_items')" class="px-6 py-3 bg-slate-200 dark:bg-secondary rounded-lg">Voltar</button>
                <button (click)="completeWithdrawal()" [disabled]="isSubmitting()" class="px-6 py-3 bg-success text-white rounded-lg flex items-center justify-center w-48 disabled:opacity-50">
                   @if (isSubmitting()) {
                    <div class="w-5 h-5 border-2 border-slate-400 border-t-white rounded-full animate-spin"></div>
                   } @else {
                    <span>Confirmar Retirada</span>
                   }
                </button>
            </div>
          </div>
        }
      }
    </div>
  `
})
export class KioskComponent implements OnDestroy {
  private dbService = inject(DatabaseService);
  private toastService = inject(ToastService);
  private fb = inject(FormBuilder);
  db = this.dbService.db;

  private destroy$ = new Subject<void>();
  step = signal<'select_technician' | 'enter_password' | 'scan_items' | 'confirm'>('select_technician');
  selectedTechnician = signal<Technician | null>(null);
  cart = signal<CartItem[]>([]);
  isSubmitting = signal(false);
  isScannerOpen = signal(false);
  scannerError = signal<string | null>(null);
  scannedItem = signal<ItemWithAvailableStock | null>(null);

  private codeReader: BrowserMultiFormatReader | null = null;
  scannerVideoElement = viewChild<ElementRef<HTMLVideoElement>>('scannerVideo');
  passwordInput = viewChild<ElementRef<HTMLInputElement>>('passwordInput');
  
  addItemForm: FormGroup;
  passwordForm: FormGroup;

  // --- Filtering ---
  kioskCategoryFilterControl = new FormControl<string | null>(null);
  private kioskSelectedCategory = signal<string | null>(null);
  
  allItems = computed(() => this.dbService.itemsWithAvailableStock());
  
  availableItemsForKiosk = computed(() => {
    const category = this.kioskSelectedCategory();
    let items = this.allItems().filter(i => i.availableStock > 0);
    if (category) {
        items = items.filter(i => i.category === category);
    }
    return items.sort((a,b) => a.name.localeCompare(b.name));
  });

  totalCartItems = computed(() => this.cart().reduce((sum, i) => sum + i.quantity, 0));

  constructor() {
    this.addItemForm = this.fb.group({
      itemName: [null, Validators.required],
      quantity: [1, [Validators.required, Validators.min(1)]]
    });
    
    this.passwordForm = this.fb.group({
      password: ['', Validators.required]
    });

    this.kioskCategoryFilterControl.valueChanges.pipe(
        takeUntil(this.destroy$)
    ).subscribe(category => {
        this.kioskSelectedCategory.set(category || null);
        this.addItemForm.get('itemName')?.setValue(null);
    });

    effect(() => {
      if (this.step() === 'enter_password') {
          setTimeout(() => this.passwordInput()?.nativeElement.focus(), 100);
      }
    });
  }

  ngOnDestroy(): void {
    this.stopScanner();
    this.destroy$.next();
    this.destroy$.complete();
  }

  selectTechnician(tech: Technician) {
    if (!tech.password) {
      this.toastService.addToast(`Técnico "${tech.name}" não tem senha cadastrada.`, 'error');
      return;
    }
    this.selectedTechnician.set(tech);
    this.passwordForm.reset();
    this.step.set('enter_password');
  }

  verifyPassword() {
    const technician = this.selectedTechnician();
    const enteredPassword = this.passwordForm.get('password')?.value;
    if (technician && enteredPassword === technician.password) {
        this.toastService.addToast(`Bem-vindo, ${technician.name}!`, 'success');
        this.step.set('scan_items');
    } else {
        this.toastService.addToast('Senha incorreta.', 'error');
        this.passwordForm.reset();
    }
  }

  backToTechnicianSelection() {
    this.selectedTechnician.set(null);
    this.step.set('select_technician');
  }

  reset() {
    this.selectedTechnician.set(null);
    this.cart.set([]);
    this.isSubmitting.set(false);
    this.step.set('select_technician');
    this.stopScanner();
  }

  addItemToCart() {
    if (this.addItemForm.invalid) return;
    const { itemName, quantity } = this.addItemForm.value;

    const item = this.allItems().find(i => i.name === itemName);
    if (!item) {
      this.toastService.addToast(`Item "${itemName}" não encontrado.`, 'error');
      return;
    }

    const existingCartItem = this.cart().find(ci => ci.item.id === item.id);
    const currentQuantityInCart = existingCartItem?.quantity || 0;
    
    if ((currentQuantityInCart + quantity) > item.availableStock) {
      this.toastService.addToast(`Estoque disponível insuficiente para ${item.name}. Restam ${item.availableStock - currentQuantityInCart}.`, 'error');
      return;
    }

    this.cart.update(currentCart => {
      const itemIndex = currentCart.findIndex(i => i.item.id === item.id);
      if (itemIndex > -1) {
        const newCart = [...currentCart];
        newCart[itemIndex] = { ...newCart[itemIndex], quantity: newCart[itemIndex].quantity + quantity };
        return newCart;
      }
      return [...currentCart, { item, quantity: quantity }];
    });

    this.toastService.addToast(`${item.name} adicionado ao carrinho.`, 'info');
    
    this.addItemForm.reset({ itemName: null, quantity: 1 });
  }

  updateCartQuantity(itemId: string, change: number) {
    this.cart.update(currentCart => {
      const itemIndex = currentCart.findIndex(i => i.item.id === itemId);
      const stockItem = this.allItems().find(i => i.id === itemId);
      if (!stockItem) {
        this.toastService.addToast('Item não encontrado no sistema.', 'error');
        return currentCart;
      }
      
      if (itemIndex > -1) {
        const newCart = [...currentCart];
        const cartItem = newCart[itemIndex];
        const newQuantity = cartItem.quantity + change;

        if (newQuantity <= 0) {
          return newCart.filter(i => i.item.id !== itemId);
        }
        
        if(newQuantity > stockItem.availableStock) {
            this.toastService.addToast(`Estoque disponível insuficiente para ${stockItem.name}. Máx: ${stockItem.availableStock}`, 'error');
            return currentCart;
        }

        newCart[itemIndex] = { ...cartItem, quantity: newQuantity };
        return newCart;
      } else if (change > 0) {
        if(change > stockItem.availableStock) {
            this.toastService.addToast(`Estoque disponível insuficiente para ${stockItem.name}. Máx: ${stockItem.availableStock}`, 'error');
            return currentCart;
        }
        return [...currentCart, { item: stockItem, quantity: change }];
      }

      return currentCart;
    });
  }
  
  goToConfirm() {
      if(this.cart().length > 0) {
          this.step.set('confirm');
      }
  }

  async completeWithdrawal() {
      this.isSubmitting.set(true);
      const technicianId = this.selectedTechnician()?.id;
      if (!technicianId || this.cart().length === 0) {
          this.toastService.addToast('Erro: Técnico ou itens não selecionados.', 'error');
          this.isSubmitting.set(false);
          return;
      }

      const movementPromises = this.cart().map(cartItem => {
          return this.dbService.addMovement({
              itemId: cartItem.item.id,
              type: 'out',
              quantity: cartItem.quantity,
              date: new Date().toISOString(),
              technicianId: technicianId
          });
      });

      try {
          const results = await Promise.all(movementPromises);
          const failures = results.filter(r => !r.success);
          if (failures.length > 0) {
              this.toastService.addToast(`${failures.length} itens falharam ao serem retirados.`, 'error');
          } else {
              this.toastService.addToast('Todos os itens foram retirados com sucesso!', 'success');
              this.reset();
          }
      } catch (error) {
          this.toastService.addToast('Ocorreu um erro ao processar as retiradas.', 'error');
      } finally {
          this.isSubmitting.set(false);
      }
  }

  async startScanner() {
    this.isScannerOpen.set(true);
    this.scannerError.set(null);
    this.scannedItem.set(null);
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
            if (result && !this.scannedItem()) {
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
    this.scannedItem.set(null);
  }

  handleScannedCode(code: string) {
    const item = this.allItems().find(i => i.id === code);
    if (item) {
      this.scannedItem.set(item);
      if ('vibrate' in navigator) {
        navigator.vibrate(100);
      }
    } else {
      this.toastService.addToast(`Item com código "${code}" não encontrado.`, 'error');
       if ('vibrate' in navigator) {
        navigator.vibrate([100, 50, 100]);
      }
    }
  }
  
  confirmAddItemToCart() {
    const item = this.scannedItem();
    if (item) {
      this.updateCartQuantity(item.id, 1);
      this.toastService.addToast(`${item.name} adicionado!`, 'success');
    }
    this.scannedItem.set(null);
  }

  cancelAddItem() {
    this.scannedItem.set(null);
  }
}