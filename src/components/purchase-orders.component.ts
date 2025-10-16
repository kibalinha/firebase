import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { DatabaseService } from '../services/database.service';
import { ToastService } from '../services/toast.service';
import { PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatus } from '../models';

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
              <h3 class="text-lg font-semibold text-slate-700 dark:text-slate-200">Nenhuma Ordem de Compra encontrada</h3>
              <p class="text-sm mt-1">Crie uma nova Ordem de Compra para solicitar itens a um fornecedor.</p>
              <button (click)="openForm()" class="mt-4 bg-accent text-white px-4 py-2 rounded-md hover:bg-info transition-colors text-sm">
                + Criar Ordem de Compra
              </button>
          </div>
        }
      </div>
    </div>

    <!-- Form Modal -->
    @if(isFormOpen()) {
      <div class="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-40">
        <div class="bg-white dark:bg-primary p-6 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
          <h3 class="text-xl font-bold mb-4">{{ currentPO()?.id ? 'Editar' : 'Nova' }} Ordem de Compra</h3>
          <form [formGroup]="poForm" (ngSubmit)="savePO()" class="flex-grow overflow-y-auto pr-2">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <select formControlName="supplierId" class="w-full bg-slate-100 dark:bg-secondary p-2 rounded">
                    <option [ngValue]="null">Selecione um fornecedor</option>
                    @for(s of db().suppliers; track s.id) { <option [value]="s.id">{{s.name}}</option> }
                </select>
                <input type="text" formControlName="poNumber" placeholder="Número da OC (ex: PO-2024-001)" class="w-full bg-slate-100 dark:bg-secondary p-2 rounded" />
                <input type="text" formControlName="status" class="w-full bg-slate-100 dark:bg-secondary p-2 rounded" [readOnly]="true" />
            </div>
            <textarea formControlName="notes" placeholder="Notas adicionais..." rows="2" class="w-full bg-slate-100 dark:bg-secondary p-2 rounded mb-4"></textarea>

            <h4 class="font-bold mb-2">Itens do Pedido</h4>
            <div formArrayName="items" class="space-y-2">
              @for(itemGroup of poItemsArray.controls; track $index) {
                <div [formGroupName]="$index" class="grid grid-cols-12 gap-2 p-2 rounded bg-slate-50 dark:bg-secondary">
                  <select formControlName="itemId" class="col-span-6 bg-white dark:bg-primary p-2 rounded">
                    @for(i of db().items; track i.id) { <option [value]="i.id">{{i.name}}</option> }
                  </select>
                  <input type="number" formControlName="quantity" placeholder="Qtd." class="col-span-2 bg-white dark:bg-primary p-2 rounded text-center">
                  <input type="number" formControlName="unitPrice" placeholder="Preço" class="col-span-3 bg-white dark:bg-primary p-2 rounded text-right">
                  <button type="button" (click)="removePoItem($index)" class="col-span-1 text-slate-400 hover:text-error">🗑️</button>
                </div>
              }
            </div>
            <button type="button" (click)="addPoItem()" class="mt-2 text-sm text-accent hover:underline">+ Adicionar Item</button>

            <div class="flex justify-end gap-4 mt-6 pt-4 border-t border-slate-200 dark:border-secondary">
              <button type="button" (click)="isFormOpen.set(false)" class="px-4 py-2 bg-slate-200 dark:bg-secondary rounded">Cancelar</button>
              <button type="submit" [disabled]="poForm.invalid || poItemsArray.length === 0" class="px-4 py-2 bg-accent text-white rounded disabled:opacity-50">Salvar Rascunho</button>
            </div>
          </form>
        </div>
      </div>
    }

    <!-- Receive Modal -->
    @if(isReceiveModalOpen() && currentPO(); as po) {
       <div class="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-40">
        <div class="bg-white dark:bg-primary p-6 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <h3 class="text-xl font-bold mb-4">Receber Itens da OC: {{ po.poNumber }}</h3>
            <form [formGroup]="receiveForm" (ngSubmit)="confirmReception()" class="flex-grow overflow-y-auto pr-2">
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
                                    <input 
                                        type="number" 
                                        formControlName="quantityReceived" 
                                        class="w-full bg-slate-100 dark:bg-secondary p-2 rounded"
                                        [max]="po.items[$index].quantity - po.items[$index].receivedQuantity">
                                </td>
                            </tr>
                       }
                    </tbody>
                </table>
                 <div class="flex justify-end gap-4 mt-6 pt-4 border-t border-slate-200 dark:border-secondary">
                    <button type="button" (click)="isReceiveModalOpen.set(false)" class="px-4 py-2 bg-slate-200 dark:bg-secondary rounded">Cancelar</button>
                    <button type="submit" [disabled]="receiveForm.invalid || isLoading()" class="px-4 py-2 bg-success text-white rounded w-52 flex justify-center disabled:opacity-50">
                        @if(isLoading()) { <div class="w-5 h-5 border-2 border-slate-400 border-t-white rounded-full animate-spin"></div> }
                        @else { <span>Confirmar Recebimento</span> }
                    </button>
                </div>
            </form>
        </div>
       </div>
    }

    <!-- Delete Confirmation Modal -->
    @if(poToDelete()) {
       <div class="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
        <div class="bg-white dark:bg-primary p-6 rounded-lg shadow-xl w-full max-w-md">
          <h3 class="text-xl font-bold mb-4">Confirmar Exclusão</h3>
          <p>Tem certeza que deseja excluir a Ordem de Compra "{{ poToDelete()?.poNumber }}"?</p>
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
  db = this.dbService.db;
  
  PurchaseOrderStatus = PurchaseOrderStatus;

  isFormOpen = signal(false);
  isReceiveModalOpen = signal(false);
  isLoading = signal(false);
  currentPO = signal<PurchaseOrder | null>(null);
  poToDelete = signal<PurchaseOrder | null>(null);
  
  poForm!: FormGroup;
  receiveForm!: FormGroup;

  purchaseOrders = computed(() => 
    this.db().purchaseOrders.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  );
  
  get poItemsArray() { return this.poForm.get('items') as FormArray; }
  get receiveItemsArray() { return this.receiveForm.get('receivedItems') as FormArray; }

  getSupplierName(id: string) { return this.db().suppliers.find(s => s.id === id)?.name || 'N/A'; }
  getItemName(id: string) { return this.db().items.find(i => i.id === id)?.name || 'Desconhecido'; }

  poTotalValue(po: PurchaseOrder): number {
    return po.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  }

  poTotalQuantity(po: PurchaseOrder): number {
    return po.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  statusColor(status: PurchaseOrderStatus): string {
    switch (status) {
      case PurchaseOrderStatus.Rascunho: return 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200';
      case PurchaseOrderStatus.Enviado: return 'bg-blue-200 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case PurchaseOrderStatus.RecebidoParcialmente: return 'bg-amber-200 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
      case PurchaseOrderStatus.Recebido: return 'bg-green-200 text-green-800 dark:bg-green-900 dark:text-green-200';
      case PurchaseOrderStatus.Cancelado: return 'bg-red-200 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200';
    }
  }

  openForm(po: PurchaseOrder | null = null) {
    this.currentPO.set(po);
    const poItems = po?.items || [];
    this.poForm = this.fb.group({
      supplierId: [po?.supplierId || null, Validators.required],
      poNumber: [po?.poNumber || `PO-${new Date().getFullYear()}-${(this.db().purchaseOrders.length + 1).toString().padStart(3, '0')}`, Validators.required],
      status: [po?.status || PurchaseOrderStatus.Rascunho],
      notes: [po?.notes || ''],
      items: this.fb.array(
        poItems.map(item => this.createPoItemGroup(item.itemId, item.quantity, item.unitPrice)),
        Validators.minLength(1)
      )
    });
     if (!po) {
        this.addPoItem();
    }
    this.isFormOpen.set(true);
  }

  createPoItemGroup(itemId: string | null, quantity: number, unitPrice: number): FormGroup {
    return this.fb.group({
      itemId: [itemId, Validators.required],
      quantity: [quantity, [Validators.required, Validators.min(1)]],
      unitPrice: [unitPrice, [Validators.required, Validators.min(0)]]
    });
  }

  addPoItem() {
    this.poItemsArray.push(this.createPoItemGroup(null, 1, 0));
  }

  removePoItem(index: number) {
    this.poItemsArray.removeAt(index);
  }

  async savePO() {
    if (this.poForm.invalid) {
      this.toastService.addToast('Formulário inválido. Verifique o fornecedor, número e itens.', 'error');
      return;
    }
    const formValue = this.poForm.value;
    const current = this.currentPO();
    
    const itemsWithReceivedQty = formValue.items.map((item: any, index: number) => ({
      ...item,
      receivedQuantity: current?.items[index]?.receivedQuantity || 0
    }));

    const poData = { ...current, ...formValue, items: itemsWithReceivedQty };

    if (current?.id) {
      await this.dbService.updateItem('purchaseOrders', poData as PurchaseOrder);
      this.toastService.addToast('Ordem de Compra atualizada!', 'success');
    } else {
      await this.dbService.addItem('purchaseOrders', poData);
      this.toastService.addToast('Rascunho da Ordem de Compra salvo!', 'success');
    }
    this.isFormOpen.set(false);
  }

  async sendPO(po: PurchaseOrder) {
    if (po.status !== PurchaseOrderStatus.Rascunho) return;
    const updatedPO = { ...po, status: PurchaseOrderStatus.Enviado };
    await this.dbService.updateItem('purchaseOrders', updatedPO);
    this.toastService.addToast('Ordem de Compra enviada!', 'success');
    this.generatePdf(updatedPO);
  }

  generatePdf(po: PurchaseOrder) {
    const supplier = this.db().suppliers.find(s => s.id === po.supplierId);
    if (!supplier) {
        this.toastService.addToast('Fornecedor não encontrado para gerar PDF.', 'error');
        return;
    }

    // FIX: Standardize jsPDF instantiation for consistency.
    const doc = new jspdf.jsPDF();
    
    // Header
    doc.setFontSize(22);
    doc.text('Ordem de Compra', 105, 20, { align: 'center' });
    doc.setFontSize(12);
    doc.text(`Número: ${po.poNumber}`, 15, 35);
    doc.text(`Data: ${new Date(po.createdAt).toLocaleDateString('pt-BR')}`, 15, 42);

    // Supplier Info
    doc.setFontSize(14);
    doc.text('Fornecedor', 15, 60);
    doc.setFontSize(10);
    doc.text(supplier.name, 15, 67);
    doc.text(`CNPJ: ${supplier.cnpj}`, 15, 72);
    doc.text(`Contato: ${supplier.contact}`, 15, 77);
    
    // Items Table
    const tableColumn = ["Item", "Qtd.", "Preço Unit.", "Subtotal"];
    const tableRows: any[][] = [];
    let total = 0;

    po.items.forEach((item: PurchaseOrderItem) => {
      const dbItem = this.db().items.find(i => i.id === item.itemId);
      const subtotal = item.quantity * item.unitPrice;
      total += subtotal;
      const itemRow = [
        dbItem?.name || 'Item desconhecido',
        item.quantity,
        item.unitPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
        subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      ];
      tableRows.push(itemRow);
    });

    (doc as any).autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 90,
        theme: 'striped',
        headStyles: { fillColor: [30, 41, 59] } // slate-800
    });

    const finalY = (doc as any).lastAutoTable.finalY;

    // Total
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total: ${total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`, 195, finalY + 15, { align: 'right' });

    // Notes
    if(po.notes) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Notas:', 15, finalY + 30);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(po.notes, 15, finalY + 37, { maxWidth: 180 });
    }

    doc.save(`OC_${po.poNumber}.pdf`);
  }
  
  openReceiveModal(po: PurchaseOrder) {
    this.currentPO.set(po);
    const itemsToReceive = po.items.map(item => {
      const remaining = item.quantity - item.receivedQuantity;
      return this.fb.group({
        quantityReceived: [remaining, [Validators.required, Validators.min(0), Validators.max(remaining)]]
      });
    });
    this.receiveForm = this.fb.group({
      receivedItems: this.fb.array(itemsToReceive)
    });
    this.isReceiveModalOpen.set(true);
  }

  async confirmReception() {
    if (this.receiveForm.invalid) {
      this.toastService.addToast('Verifique as quantidades recebidas.', 'error');
      return;
    }
    const po = this.currentPO();
    if (!po) return;

    this.isLoading.set(true);
    try {
      const receivedItems = this.receiveForm.value.receivedItems.map((val: any, index: number) => ({
        itemId: po.items[index].itemId,
        quantityReceived: Number(val.quantityReceived)
      }));

      await this.dbService.receivePurchaseOrderItems(po.id, receivedItems);
      this.isReceiveModalOpen.set(false);
      this.currentPO.set(null);
    } catch(e: any) {
      this.toastService.addToast(e.message, 'error');
    } finally {
      this.isLoading.set(false);
    }
  }

  openDeleteConfirm(po: PurchaseOrder) {
    this.poToDelete.set(po);
  }
  
  async deletePO() {
    const po = this.poToDelete();
    if (po) {
      if (po.status !== PurchaseOrderStatus.Rascunho) {
        this.toastService.addToast('Apenas Ordens de Compra em rascunho podem ser excluídas.', 'error');
        this.poToDelete.set(null);
        return;
      }
      await this.dbService.deleteItem('purchaseOrders', po.id);
      this.toastService.addToast('Ordem de Compra excluída!', 'success');
      this.poToDelete.set(null);
    }
  }
}