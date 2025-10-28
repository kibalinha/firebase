import { Component, ChangeDetectionStrategy, inject, computed, output, Signal } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { DatabaseService } from '../services/database.service';
import { ToastService } from '../services/toast.service';
// FIX: Added PurchaseOrderStatus to imports to use the enum.
import { Item, Supplier, View, PurchaseOrder, PurchaseOrderStatus, AlmoxarifadoDB } from '../models';

interface SuggestionGroup {
  // FIX: Updated interface to allow for items with no associated supplier.
  supplier: Supplier | { id: null; name: string };
  items: Item[];
}

@Component({
  selector: 'app-purchase-suggestion',
  standalone: true,
  imports: [CommonModule, CurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-4 sm:p-6 h-full flex flex-col">
      <header class="mb-6">
        <h2 class="text-2xl font-bold">Sugestão de Compra</h2>
        <p class="text-sm text-slate-500 dark:text-slate-400">Itens que atingiram ou estão abaixo do ponto de ressuprimento, agrupados por fornecedor.</p>
      </header>

      <div class="flex-grow overflow-auto">
        @if (suggestions().length > 0) {
          <div class="space-y-8">
            @for (group of suggestions(); track group.supplier.id) {
              <div class="bg-white dark:bg-primary p-6 rounded-lg shadow-md">
                <div class="flex justify-between items-center mb-4">
                  <h3 class="text-xl font-bold">{{ group.supplier.name }}</h3>
                  <button 
                    (click)="generatePurchaseOrder(group)"
                    [disabled]="!group.supplier.id"
                    class="bg-accent text-white px-4 py-2 rounded-md hover:bg-info transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    Gerar Rascunho de OC
                  </button>
                </div>
                <!-- Table for Desktop -->
                <table class="w-full text-left text-sm hidden md:table">
                  <thead>
                    <tr class="border-b dark:border-slate-600">
                      <th class="p-2">Item</th>
                      <th class="p-2 text-center">Estoque Atual</th>
                      <th class="p-2 text-center">Ponto de Ressupr.</th>
                      <th class="p-2 text-right">Preço Unit.</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (item of group.items; track item.id) {
                      <tr class="border-b dark:border-slate-700">
                        <td class="p-2 font-medium">{{ item.name }}</td>
                        <td class="p-2 text-center font-bold text-error">{{ item.quantity }} {{ item.unit }}</td>
                        <td class="p-2 text-center">{{ item.reorderPoint }} {{ item.unit }}</td>
                        <td class="p-2 text-right">{{ item.price | currency:'BRL' }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
                <!-- Cards for Mobile -->
                <div class="md:hidden space-y-2 mt-2">
                    @for (item of group.items; track item.id) {
                      <div class="p-3 rounded-md bg-slate-50 dark:bg-secondary">
                        <p class="font-medium text-slate-800 dark:text-slate-100">{{ item.name }}</p>
                        <div class="flex justify-between items-end text-sm mt-1">
                          <p class="text-slate-600 dark:text-slate-300">Estoque: <span class="font-bold text-error">{{ item.quantity }} {{ item.unit }}</span> / {{ item.reorderPoint }} {{ item.unit }}</p>
                          <p class="text-slate-500 dark:text-slate-400">{{ item.price | currency:'BRL' }}</p>
                        </div>
                      </div>
                    }
                </div>
              </div>
            }
          </div>
        } @else {
          <div class="text-center p-10 bg-white dark:bg-primary rounded-lg flex flex-col items-center justify-center h-full border-2 border-dashed border-slate-300 dark:border-secondary">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 text-green-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p class="text-lg font-semibold">Tudo em ordem!</p>
            <p class="text-slate-500 dark:text-slate-400 mt-2">Nenhum item está abaixo do ponto de ressuprimento no momento.</p>
          </div>
        }
      </div>
    </div>
  `
})
export class PurchaseSuggestionComponent {
  private dbService = inject(DatabaseService);
  private toastService = inject(ToastService);
  db = this.dbService.db;
  navigateTo = output<View>();

  suggestions: Signal<SuggestionGroup[]> = computed((): SuggestionGroup[] => {
    const itemsToReorder = this.db().items.filter(item => item.quantity <= item.reorderPoint && item.reorderPoint > 0);
    if (itemsToReorder.length === 0) {
      return [];
    }
    
    const suppliers = this.db().suppliers;
    const grouped = itemsToReorder.reduce((acc, item) => {
      const supplierId = item.preferredSupplierId || 'none';
      if (!acc[supplierId]) {
        acc[supplierId] = [];
      }
      acc[supplierId].push(item);
      return acc;
    }, {} as Record<string, Item[]>);

    return Object.keys(grouped).map(supplierId => {
      const foundSupplier = suppliers.find(s => s.id === supplierId);
      // FIX: Explicitly define the supplier object to match the SuggestionGroup union type, resolving a type inference mismatch.
      const supplierForGroup: Supplier | { id: null; name: string } = foundSupplier
        ? foundSupplier
        : { id: null, name: 'Sem Fornecedor' };
        
      return {
        supplier: supplierForGroup,
        items: grouped[supplierId],
      };
    }).sort((a,b) => a.supplier.name.localeCompare(b.supplier.name));
  });

  async generatePurchaseOrder(group: SuggestionGroup) {
    if (!group.supplier.id) {
      this.toastService.addToast('Não é possível gerar OC para itens sem fornecedor.', 'error');
      return;
    }

    const newPO: Omit<PurchaseOrder, 'id' | 'createdAt'> = {
      poNumber: `PO-${new Date().getFullYear()}-${(this.db().purchaseOrders.length + 1).toString().padStart(3, '0')}`,
      supplierId: group.supplier.id,
      // FIX: Used PurchaseOrderStatus enum instead of a magic string to fix type error.
      status: PurchaseOrderStatus.Rascunho,
      items: group.items.map(item => ({
        itemId: item.id,
        quantity: item.reorderPoint * 2 - item.quantity, // Simple logic: buy enough to reach 2x reorder point
        receivedQuantity: 0,
        unitPrice: item.price
      })),
      notes: 'Gerado automaticamente pela Sugestão de Compra.'
    };
    
    try {
      await this.dbService.addItem('purchaseOrders', newPO);
      this.toastService.addToast(`Rascunho de OC para ${group.supplier.name} gerado!`, 'success');
      this.navigateTo.emit('purchase_orders');
    } catch (e) {
      this.toastService.addToast('Falha ao gerar la Ordem de Compra.', 'error');
    }
  }
}