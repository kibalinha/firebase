import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { DatabaseService } from '../services/database.service';
import { ToastService } from '../services/toast.service';
import { PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatus } from '../models';
import { AuthService } from '../services/auth.service';

declare var jspdf: any;

@Component({
  selector: 'app-purchase-orders',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DatePipe, CurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-4 sm:p-6 h-full flex flex-col">
      <header class="flex justify-between items-start mb-4 gap-2 flex-wrap">
        <div>
          <h2 class="text-2xl font-bold">Ordens de Compra</h2>
          <p class="text-sm text-slate-500 dark:text-slate-400">Crie e gerencie pedidos de compra para seus fornecedores.</p>
        </div>
        <button (click)="openForm()" class="bg-accent text-white px-4 py-2 rounded-md hover:bg-info transition-colors">
          + Nova Ordem de Compra
        </button>
      </header>
      
      <!-- PO List -->
      <div class="flex-grow overflow-auto">
        @if (purchaseOrders().length > 0) {
          <!-- Table for desktop -->
          <table class="w-full text-left hidden md:table">
            <thead class="sticky top-0 bg-slate-50 dark:bg-secondary">
              <tr class="border-b border-slate-200 dark:border-slate-600">
                <th class="p-3">Número OC</th>
                <th class="p-3">Fornecedor</th>
                <th class="p-3">Data</th>
                <th class="p-3">Status</th>
                <th class="p-3">Total de Itens</th>
                <th class="p-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              @for(po of purchaseOrders(); track po.id) {
                <tr class="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-primary">
                  <td class="p-3 font-mono text-sm">{{ po.poNumber }}</td>
                  <td class="p-3">{{ getSupplierName(po.supplierId) }}</td>
                  <td class="p-3">{{ po.createdAt | date:'dd/MM/yyyy' }}</td>
                  <td class="p-3">
                    <span class="px-2 py-1 rounded-full text-xs font-semibold" [class]="statusColor(po.status)">
                      {{ po.status }}
                    </span>
                  </td>
                  <td class="p-3 font-semibold">{{ poTotalQuantity(po) }}</td>
                  <td class="p-3 flex items-center space-x-2">
                    @if (po.status === PurchaseOrderStatus.Rascunho) {
                      <button (click)="sendPO(po)" class="p-1 text-slate-500 dark:text-slate-300 hover:text-accent" title="Enviar OC e Gerar PDF">➤</button>
                      <button (click)="openForm(po)" class="p-1 text-slate-500 dark:text-slate-300 hover:text-accent" title="Editar">✏️</button>
                    } @else {
                       <button (click)="generatePdf(po)" class="p-1 text-slate-500 dark:text-slate-300 hover:text-accent" title="Ver PDF">📄</button>
                    }
                    @if (po.status === PurchaseOrderStatus.Enviado || po.status === PurchaseOrderStatus.RecebidoParcialmente) {
                      <button (click)="openReceiveModal(po)" class="p-1 text-slate-500 dark:text-slate-300 hover:text-accent" title="Receber Itens">📦</button>
                    }
                    <button (click)="openDeleteConfirm(po)" class="p-1 text-slate-500 dark:text-slate-300 hover:text-error" title="Excluir">🗑️</button>
                  </td>
                </tr>
              }
            </tbody>
          </table>

          <!-- Cards for mobile -->
          <div class="md:hidden space-y-3">
            @for(po of purchaseOrders(); track po.id) {
              <div class="bg-white dark:bg-secondary rounded-lg p-4 shadow">
                <div class="flex justify-between items-start">
                  <div>
                    <p class="font-bold text-slate-800 dark:text-slate-100 font-mono">{{ po.poNumber }}</p>
                    <p class="text-sm text-slate-500 dark:text-slate-400">{{ getSupplierName(po.supplierId) }}</p>
                    <p class="text-xs text-slate-400">{{ po.createdAt | date:'dd/MM/yyyy' }}</p>
                  </div>
                  <span class="px-2 py-1 rounded-full text-xs font-semibold" [class]="statusColor(po.status)">
                    {{ po.status }}
                  </span>
                </div>
                <div class="mt-4 pt-4 border-t border-slate-200 dark:border-secondary flex justify-between items-center">
                  <p class="font-semibold text-lg">{{ poTotalQuantity(po) }} itens</p>
                  <div class="flex items-center space-x-2">
                    @if (po.status === PurchaseOrderStatus.Rascunho) {
                      <button (click)="sendPO(po)" class="p-1 text-slate-500 dark:text-slate-300 hover:text-accent" title="Enviar OC e Gerar PDF">➤</button>
                      <button (click)="openForm(po)" class="p-1 text-slate-500 dark:text-slate-300 hover:text-accent" title="Editar">✏️</button>
                    } @else {
                       <button (click)="generatePdf(po)" class="p-1 text-slate-500 dark:text-slate-300 hover:text-accent" title="Ver PDF">📄</button>
                    }
                    @if (po.status === PurchaseOrderStatus.Enviado || po.status === PurchaseOrderStatus.RecebidoParcialmente) {
                      <button (click)="openReceiveModal(po)" class="p-1 text-slate-500 dark:text-slate-300 hover:text-accent" title="Receber Itens">📦</button>
                    }
                    <button (click)="openDeleteConfirm(po)" class="p-1 text-slate-500 dark:text-slate-300 hover:text-error" title="Excluir">🗑️</button>
                  </div>
                </div>
              </div>
            }
          </div>
        } @else {
          <div class="col-span-full text-center p-10 text-slate-500 dark:text-slate-400 bg-white dark:bg-primary rounded-lg flex flex-col items-center justify-center h-full border-2 border-dashed border-slate-300 dark:border-secondary">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 text-slate-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
              </svg>
              <p class="text-lg font-semibold">Nenhuma Ordem de Compra</p>
              <p class="text-slate-500 dark:text-slate-400 mt-2">Crie sua primeira ordem de compra para começar a repor o estoque.</p>
          </div>
        }
      </div>
    </div>

    <!-- Add/Edit Form Modal -->
    @if (isFormOpen()) {
      <div class="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-40">
        <div class="bg-white dark:bg-primary p-6 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
          <h3 class="text-xl font-bold mb-4">{{ poToEdit()?.id ? 'Editar' : 'Nova' }} Ordem de Compra</h3>
          
          <form [formGroup]="form" (ngSubmit)="save()" class="flex-grow overflow-y-auto pr-2">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label class="block text-sm mb-1">Fornecedor</label>
                  <select formControlName="supplierId" class="w-full bg-slate-100 dark:bg-secondary p-2 rounded">
                    @for(s of db().suppliers; track s.id) {
                      <option [value]="s.id">{{s.name}}</option>
                    }
                  </select>
                </div>
                 <div>
                  <label class="block text-sm mb-1">Notas (Opcional)</label>
                  <input type="text" formControlName="notes" class="w-full bg-slate-100 dark:bg-secondary p-2 rounded">
                </div>
            </div>

            <h4 class="text-lg font-semibold mb-2">Itens do Pedido</h4>
            <div formArrayName="items" class="space-y-2">
              @for(itemGroup of itemsArray.controls; track $index) {
                <div [formGroupName]="$index" class="grid grid-cols-12 gap-2 items-center bg-slate-50 dark:bg-secondary p-2 rounded">
                  <div class="col-span-6">
                     <input 
                        type="text"
                        list="available-items-list"
                        formControlName="itemName"
                        autocomplete="off"
                        placeholder="Digite para buscar um item..."
                        class="w-full bg-white dark:bg-primary p-2 rounded"
                      />
                  </div>
                  <div class="col-span-2">
                    <input type="number" formControlName="quantity" min="1" class="w-full bg-white dark:bg-primary p-2 rounded">
                  </div>
                  <div class="col-span-3">
                    <input type="number" formControlName="unitPrice" min="0" step="0.01" class="w-full bg-white dark:bg-primary p-2 rounded">
                  </div>
                  <button type="button" (click)="removeItem($index)" class="col-span-1 p-1 text-slate-400 hover:text-error transition-colors">🗑️</button>
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
              <button type="submit" [disabled]="form.invalid" class="px-4 py-2 bg-accent text-white rounded disabled:opacity-50">Salvar Rascunho</button>
            </div>
          </form>
        </div>
      </div>
    }

    <!-- Receive Items Modal -->
    @if(poToReceive(); as po) {
        <div class="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-40">
            <div class="bg-white dark:bg-primary p-6 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                <h3 class="text-xl font-bold mb-4">Receber Itens da OC: {{ po.poNumber }}</h3>
                <form [formGroup]="receiveForm" (ngSubmit)="receiveItems()" class="flex-grow overflow-auto pr-2">
                    <table class="w-full text-left">
                        <thead>
                            <tr class="border-b dark:border-slate-600">
                                <th class="p-2">Item</th>
                                <th class="p-2">Pedido</th>
                                <th class="p-2">Recebido</th>
                                <th class="p-2">Recebendo Agora</th>
                            </tr>
                        </thead>
                        <tbody formArrayName="receivedItems">
                            @for(itemControl of receiveItemsArray.controls; track $index) {
                                <tr [formGroupName]="$index">
                                    <td class="p-2">{{ getItemName(po.items[$index].itemId) }}</td>
                                    <td class="p-2">{{ po.items[$index].quantity }}</td>
                                    <td class="p-2">{{ po.items[$index].receivedQuantity }}</td>
                                    <td class="p-2">
                                        <input type="number" formControlName="quantityReceived" class="w-full bg-slate-100 dark:bg-secondary p-2 rounded">
                                    </td>
                                </tr>
                            }
                        </tbody>
                    </table>
                    <div class="flex justify-end gap-4 mt-6">
                        <button type="button" (click)="poToReceive.set(null)" class="px-4 py-2 bg-slate-200 dark:bg-secondary rounded">Cancelar</button>
                        <button type="submit" class="px-4 py-2 bg-success text-white rounded">Confirmar Recebimento</button>
                    </div>
                </form>
            </div>
        </div>
    }
    
    <!-- Delete Confirmation Modal -->
    @if (poToDelete()) {
      <div class="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
        <div class="bg-white dark:bg-primary p-6 rounded-lg shadow-xl w-full max-w-md">
          <h3 class="text-xl font-bold mb-4">Confirmar Exclusão</h3>
          <p>Tem certeza que deseja excluir a OC "{{ poToDelete()?.poNumber }}"?</p>
          <div class="flex justify-end gap-4 mt-6">
            <button (click)="poToDelete.set(null)" class="px-4 py-2 bg-slate-200 dark:bg-secondary rounded">Cancelar</button>
            <button (click)="deletePO()" class="px-4 py-2 bg-error text-white rounded">Excluir</button>
          </div>
        </div>
      </div>
    }
  `
})
export class PurchaseOrdersComponent {
  private dbService = inject(DatabaseService);
  private toastService = inject(ToastService);
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  db = this.dbService.db;

  PurchaseOrderStatus = PurchaseOrderStatus;

  isFormOpen = signal(false);
  poToEdit = signal<PurchaseOrder | null>(null);
  poToDelete = signal<PurchaseOrder | null>(null);
  poToReceive = signal<PurchaseOrder | null>(null);
  form!: FormGroup;
  receiveForm!: FormGroup;
  
  purchaseOrders = computed(() => this.db().purchaseOrders.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  availableItems = computed(() => this.dbService.itemsWithAvailableStock());
  
  get itemsArray() { return this.form.get('items') as FormArray; }
  get receiveItemsArray() { return this.receiveForm.get('receivedItems') as FormArray; }

  poTotalQuantity(po: PurchaseOrder) {
    return po.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  getSupplierName(id: string) {
    return this.db().suppliers.find(s => s.id === id)?.name || 'Desconhecido';
  }
  
  getItemName(id: string) {
    return this.availableItems().find(i => i.id === id)?.name || 'Desconhecido';
  }
  
  statusColor(status: PurchaseOrderStatus) {
    switch (status) {
      case PurchaseOrderStatus.Rascunho: return 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200';
      case PurchaseOrderStatus.Enviado: return 'bg-blue-200 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case PurchaseOrderStatus.Recebido: return 'bg-green-200 text-green-800 dark:bg-green-900 dark:text-green-200';
      case PurchaseOrderStatus.RecebidoParcialmente: return 'bg-yellow-200 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case PurchaseOrderStatus.Cancelado: return 'bg-red-200 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return '';
    }
  }

  openForm(po: PurchaseOrder | null = null) {
    this.poToEdit.set(po);
    const itemControls = po?.items.map(i => {
      const itemName = this.getItemName(i.itemId);
      return this.createItemGroup(itemName, i.quantity, i.unitPrice);
    }) || [];

    this.form = this.fb.group({
      supplierId: [po?.supplierId || this.db().suppliers[0]?.id, Validators.required],
      notes: [po?.notes || ''],
      items: this.fb.array(itemControls, Validators.minLength(1))
    });
    if (!po) {
      this.addItem();
    }
    this.isFormOpen.set(true);
  }

  createItemGroup(itemName: string | null, quantity: number | null, unitPrice: number | null): FormGroup {
    return this.fb.group({
      itemName: [itemName, Validators.required],
      quantity: [quantity, [Validators.required, Validators.min(1)]],
      unitPrice: [unitPrice, [Validators.required, Validators.min(0)]]
    });
  }

  addItem() { this.itemsArray.push(this.createItemGroup(null, 1, 0)); }
  removeItem(index: number) { this.itemsArray.removeAt(index); }
  
  async save() {
    if (this.form.invalid) {
      this.toastService.addToast('Formulário inválido.', 'error');
      return;
    }
    const formValue = this.form.value;
    const current = this.poToEdit();
    
    const items: PurchaseOrderItem[] = [];
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
            unitPrice: formItem.unitPrice,
            receivedQuantity: existingItem?.receivedQuantity || 0
        });
    }

    const data = { 
      ...current, ...formValue, items,
      poNumber: current?.poNumber || `PO-${new Date().getFullYear()}-${(this.purchaseOrders().length + 1).toString().padStart(3, '0')}`,
      status: current?.status || PurchaseOrderStatus.Rascunho,
      createdAt: current?.createdAt || new Date().toISOString()
    };
    
    if (current?.id) {
      await this.dbService.updateItem('purchaseOrders', data as PurchaseOrder);
      this.toastService.addToast('Ordem de compra atualizada!', 'success');
    } else {
      // FIX: Explicitly type the return of addItem to ensure newPO has all properties of PurchaseOrder.
      const newPO = await this.dbService.addItem<PurchaseOrder>('purchaseOrders', data);
      this.toastService.addToast('Rascunho da ordem de compra salvo!', 'success');
      await this.dbService.logAction('SAVE_PO_DRAFT', `Rascunho da OC '${newPO.poNumber}' para '${this.getSupplierName(newPO.supplierId)}' foi salvo.`);
    }
    this.isFormOpen.set(false);
  }

  async sendPO(po: PurchaseOrder) {
    const updatedPO = { ...po, status: PurchaseOrderStatus.Enviado };
    await this.dbService.updateItem('purchaseOrders', updatedPO);
    await this.dbService.logAction('SEND_PO', `Ordem de Compra '${po.poNumber}' enviada para '${this.getSupplierName(po.supplierId)}'.`);
    this.toastService.addToast(`OC ${po.poNumber} enviada!`, 'success');
    this.generatePdf(updatedPO);
  }

  openReceiveModal(po: PurchaseOrder) {
    this.poToReceive.set(po);
    const controls = po.items.map(item => this.fb.group({
      quantityReceived: [0, [Validators.required, Validators.min(0), Validators.max(item.quantity - item.receivedQuantity)]]
    }));
    this.receiveForm = this.fb.group({
      receivedItems: this.fb.array(controls)
    });
  }

  async receiveItems() {
    const po = this.poToReceive();
    if (!po) return;
    try {
      await this.dbService.receivePurchaseOrderItems(po.id, this.receiveForm.value.receivedItems);
      this.poToReceive.set(null);
    } catch(e: any) {
      this.toastService.addToast(e.message, 'error');
    }
  }

  openDeleteConfirm(po: PurchaseOrder) { this.poToDelete.set(po); }
  
  async deletePO() {
    const po = this.poToDelete();
    if (po) {
      await this.dbService.deleteItem('purchaseOrders', po.id);
      await this.dbService.logAction('DELETE_PO', `Ordem de Compra '${po.poNumber}' foi excluída.`);
      this.toastService.addToast('Ordem de compra excluída!', 'success');
      this.poToDelete.set(null);
    }
  }
  
  generatePdf(po: PurchaseOrder) {
    const doc = new (jspdf as any).jsPDF();
    const supplier = this.db().suppliers.find(s => s.id === po.supplierId);

    doc.setFontSize(22);
    doc.text('Ordem de Compra', 105, 20, { align: 'center' });
    doc.setFontSize(12);
    doc.text(`Número da OC: ${po.poNumber}`, 14, 30);
    doc.text(`Data: ${new Date(po.createdAt).toLocaleDateString('pt-BR')}`, 14, 36);

    doc.setFontSize(14);
    doc.text('Fornecedor:', 14, 50);
    doc.setFontSize(10);
    doc.text(supplier?.name || '', 14, 56);
    doc.text(supplier?.cnpj || '', 14, 61);
    doc.text(supplier?.address || '', 14, 66);
    doc.text(supplier?.contact || '', 14, 71);
    
    const tableData = po.items.map(item => [
      this.getItemName(item.itemId),
      item.quantity,
      item.unitPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      (item.quantity * item.unitPrice).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    ]);
    
    const total = po.items.reduce((sum, i) => sum + (i.quantity * i.unitPrice), 0);
    
    (doc as any).autoTable({
      startY: 80,
      head: [['Item', 'Quantidade', 'Preço Unit.', 'Subtotal']],
      body: tableData,
      foot: [['Total', '', '', total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })]],
      footStyles: { fontStyle: 'bold' }
    });
    
    doc.save(`OC_${po.poNumber}.pdf`);
  }
}
