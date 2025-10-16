



import { Injectable, signal, inject, computed } from '@angular/core';
import { 
    AlmoxarifadoDB, Item, Movement, Technician, Supplier, AuditLog, View, 
    RedShelfItem, PurchaseOrder, ItemWithAvailableStock, PickingList,
    PurchaseOrderStatus, PickingListStatus, Kit, Reservation, ReservationStatus
} from '../models';
import { DataProvider, CreationPayload } from './data.provider';
import { ToastService } from './toast.service';

type CollectionWithId = keyof Omit<AlmoxarifadoDB, 'categories' | 'auditLogs'>;
// FIX: Add Kit and Reservation to the union type.
type EntityWithId = Item | Technician | Supplier | Movement | RedShelfItem | PurchaseOrder | PickingList | Kit | Reservation;

// FIX: Exported KitWithDetails interface for use in other components.
export interface KitWithDetails extends Kit {
  availableQuantity: number;
}

@Injectable({ providedIn: 'root' })
export class DatabaseService {
  private provider = inject(DataProvider);
  private toastService = inject(ToastService);

  db = signal<AlmoxarifadoDB>({
      items: [], redShelfItems: [], technicians: [], suppliers: [],
      movements: [], categories: [], auditLogs: [], purchaseOrders: [], pickingLists: [],
      // FIX: Added new models to initial DB state.
      kits: [], reservations: [], users: []
  });

  // State for Item Lifecycle View
  currentItemForLifecycle = signal<Item | null>(null);
  lifecycleReturnView = signal<View>('inventory');

  itemsWithAvailableStock = computed((): ItemWithAvailableStock[] => {
    const allItems = this.db().items;
    const reservedQuantities = new Map<string, number>();

    // Calculate reserved quantities from pending reservations
    this.db().reservations
      .filter(r => r.status === ReservationStatus.Pendente)
      .forEach(r => {
        r.items.forEach(item => {
          reservedQuantities.set(item.itemId, (reservedQuantities.get(item.itemId) || 0) + item.quantity);
        });
      });

    return allItems.map(item => ({
      ...item,
      availableStock: item.quantity - (reservedQuantities.get(item.id) || 0)
    }));
  });
  
  // FIX: Added computed signal for kits with calculated available quantities.
  kitsWithDetails = computed((): KitWithDetails[] => {
    // FIX: Explicitly type the Map to ensure correct type inference for its values.
    const itemsMap: Map<string, ItemWithAvailableStock> = new Map(this.itemsWithAvailableStock().map(i => [i.id, i]));
    const allKits = this.db().kits;

    return allKits.map(kit => {
      let availableQuantity = Infinity;
      for (const component of kit.components) {
        const item = itemsMap.get(component.itemId);
        if (!item || component.quantity <= 0) {
          availableQuantity = 0;
          break;
        }
        const maxKitsForItem = Math.floor(item.availableStock / component.quantity);
        if (maxKitsForItem < availableQuantity) {
          availableQuantity = maxKitsForItem;
        }
      }
      return {
        ...kit,
        availableQuantity: availableQuantity === Infinity ? 0 : availableQuantity
      };
    });
  });

  constructor() {
    this.loadInitialData();
  }

  private async loadInitialData() {
    const data = await this.provider.getInitialData();
    this.db.set(data);
    if (data.auditLogs.length === 0) {
        this.logAction('SYSTEM_INIT', 'Banco de dados inicializado com dados de exemplo.');
    }
  }

  async replaceDbState(newData: AlmoxarifadoDB): Promise<void> {
    await this.provider.replaceAllData(newData); // Persiste os novos dados
    this.db.set(newData); // Atualiza o estado reativo da aplicação
    await this.logAction('SYSTEM_RESTORE', 'Banco de dados restaurado a partir de um arquivo de backup.');
  }

  viewItemLifecycle(item: Item, returnView: View) {
    this.currentItemForLifecycle.set(item);
    this.lifecycleReturnView.set(returnView);
  }

  async logAction(action: string, details: string, user: string = 'Sistema'): Promise<void> {
    const newLog = await this.provider.logAction(action, details, user);
    this.db.update(db => ({
      ...db,
      auditLogs: [newLog, ...db.auditLogs]
    }));
  }

  async addItem<T extends { id: string }>(collection: CollectionWithId, item: CreationPayload<T>): Promise<T> {
    const newItem = await this.provider.addItem<T>(collection, item);
    this.db.update(db => ({
      ...db,
      [collection]: [...(db[collection] as any[]), newItem]
    }));
    return newItem;
  }

  async updateItem<T extends { id: string }>(collection: CollectionWithId, updatedItem: T): Promise<T> {
    const result = await this.provider.updateItem<T>(collection, updatedItem);
    this.db.update(db => ({
      ...db,
      [collection]: (db[collection] as any[]).map(item => item.id === result.id ? result : item)
    }));
    return result;
  }

  async deleteItem(collection: CollectionWithId, id: string): Promise<void> {
    await this.provider.deleteItem(collection, id);
    this.db.update(db => {
      const newDb = { ...db };
      (newDb as any)[collection] = (db[collection] as unknown as EntityWithId[]).filter(item => item.id !== id);
      return newDb;
    });
  }
  
  async saveItem(itemData: Omit<Item, 'id' | 'createdAt' | 'quantity'> & { id?: string; quantity?: number }, isRedShelf: boolean) {
    const collection = isRedShelf ? 'redShelfItems' : 'items';

    if (itemData.id) {
        const allItems = isRedShelf ? this.db().redShelfItems : this.db().items;
        const existingItem = allItems.find(i => i.id === itemData.id);
        if (!existingItem) throw new Error('Item a ser atualizado não encontrado');
        const updatedItemData = { ...existingItem, ...itemData };
        const updatedItem = await this.provider.updateItem(collection, updatedItemData);

        this.db.update(db => {
            const currentCollection = (db[collection] as (Item | RedShelfItem)[]).map(i => i.id === updatedItem.id ? updatedItem : i);
            return { ...db, [collection]: currentCollection };
        });
        
        if (isRedShelf) {
            await this.logAction('UPDATE_ITEM', `Item na Prateleira Vermelha atualizado: ${(updatedItem as RedShelfItem).name}`);
        } else {
            await this.logAction('UPDATE_ITEM', `Item atualizado: ${(updatedItem as Item).name}`);
        }
    } else {
        const newItemPayload: any = { ...itemData };
        if (collection === 'items' && typeof newItemPayload.quantity === 'undefined') {
            newItemPayload.quantity = 0;
        }
        const newItem = await this.provider.addItem<Item | RedShelfItem>(collection, newItemPayload);
        this.db.update(db => ({ ...db, [collection]: [...db[collection], newItem] }));
        
        if (isRedShelf) {
            await this.logAction('CREATE_ITEM', `Item na Prateleira Vermelha criado: ${(newItem as RedShelfItem).name}`);
        } else {
            await this.logAction('CREATE_ITEM', `Item criado: ${(newItem as Item).name}`);
        }
    }
  }

  async deleteItemById(id: string, isRedShelf: boolean) {
    const collection = isRedShelf ? 'redShelfItems' : 'items';
    const allItems: (Item | RedShelfItem)[] = isRedShelf ? this.db().redShelfItems : this.db().items;
    const item = allItems.find(i => i.id === id);
    if (item) {
        await this.deleteItem(collection, id);
        // FIX: Simplified expression to avoid type narrowing issues with 'never' type.
        const itemName = item.name;
        await this.logAction('DELETE_ITEM', `Item removido: ${itemName}`);
    }
  }

  async deleteMultipleItemsByIds(ids: string[], isRedShelf: boolean) {
    const collection = isRedShelf ? 'redShelfItems' : 'items';
    const idsToDelete = new Set(ids);
    const allItems: (Item | RedShelfItem)[] = isRedShelf ? this.db().redShelfItems : this.db().items;
    const itemsToDelete = allItems.filter(i => idsToDelete.has(i.id));
    
    if (itemsToDelete.length > 0) {
      await this.provider.deleteMultipleItems(collection, ids);
      this.db.update(db => ({
        ...db,
        [collection]: (db[collection] as (Item|RedShelfItem)[]).filter(item => !idsToDelete.has(item.id))
      }));
      // FIX: Simplified expression to avoid type narrowing issues with 'never' type.
      const itemNames = itemsToDelete.map(i => i.name).join(', ');
      await this.logAction('DELETE_MULTIPLE_ITEMS', `${itemsToDelete.length} itens removidos: ${itemNames}`);
    }
  }
  
  async addMultipleItems(itemsToAdd: (Omit<Item, 'id' | 'createdAt'>)[], isRedShelf: boolean): Promise<void> {
    const newItems = await this.provider.addMultipleItems(itemsToAdd, isRedShelf);
    const collection = isRedShelf ? 'redShelfItems' : 'items';
    this.db.update(db => ({
        ...db,
        [collection]: [...db[collection], ...newItems] as any
    }));
    await this.logAction('IMPORT_CSV', `${newItems.length} itens importados via CSV para ${isRedShelf ? 'Prateleira Vermelha' : 'Inventário'}.`);
  }

  async addMovement(movementData: Omit<Movement, 'id'>): Promise<{ success: boolean; message: string; }> {
    const result = await this.provider.addMovement(movementData);
    if (result.success && result.newMovement && result.updatedItem) {
        const { newMovement, updatedItem } = result;
        this.db.update(db => {
             const collectionKey: 'items' | 'redShelfItems' = 'category' in updatedItem ? 'items' : 'redShelfItems';
            return {
              ...db,
              [collectionKey]: (db[collectionKey] as (Item|RedShelfItem)[]).map(i => i.id === updatedItem.id ? updatedItem : i),
              movements: [newMovement, ...db.movements].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            };
        });
        const allItems = [...this.db().items, ...this.db().redShelfItems];
        const item = allItems.find(i => i.id === movementData.itemId);
        let itemName = item?.name || 'Item desconhecido';

        const technician = movementData.technicianId ? this.db().technicians.find(t => t.id === movementData.technicianId) : null;
        const details = movementData.type === 'in'
            ? `Entrada de ${movementData.quantity}x ${itemName}`
            : `Saída de ${movementData.quantity}x ${itemName} | Técnico: ${technician?.name || 'N/A'}`;
        await this.logAction(movementData.type === 'in' ? 'ENTRADA_ITEM' : 'SAIDA_ITEM', details);
    }
    return { success: result.success, message: result.message };
  }

  async adjustItemQuantity(itemId: string, newQuantity: number, notes: string, isRedShelf: boolean): Promise<void> {
    const collection = isRedShelf ? 'redShelfItems' : 'items';
    const allItems: (Item | RedShelfItem)[] = this.db()[collection];
    const item = allItems.find(i => i.id === itemId);
    const oldQuantity = item?.quantity ?? 0;
    
    if (!item) {
        this.toastService.addToast('Item não encontrado.', 'error');
        return;
    }

    try {
      const { updatedItem, newMovement } = await this.provider.adjustItemQuantity(itemId, newQuantity, notes, isRedShelf);
      this.db.update(db => ({
        ...db,
        [collection]: (db[collection] as (Item|RedShelfItem)[]).map(i => i.id === updatedItem.id ? updatedItem : i),
        movements: [newMovement, ...db.movements].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      }));

      // FIX: Simplified expression to avoid type narrowing issues with 'never' type.
      const itemName = item.name;
      await this.logAction('ADJUST_ITEM', `Ajuste de estoque para ${itemName}: de ${oldQuantity} para ${newQuantity}. Motivo: ${notes}`);
      this.toastService.addToast('Estoque ajustado com sucesso!', 'success');

    } catch (error: any) {
      this.toastService.addToast(`Falha no ajuste: ${error.message}`, 'error');
    }
  }

  async addCategory(categoryName: string): Promise<void> {
      const updatedCategories = await this.provider.addCategory(categoryName, this.db().categories);
      this.db.update(db => ({ ...db, categories: updatedCategories }));
      await this.logAction('CREATE_CATEGORY', `Categoria criada: ${categoryName}`);
      this.toastService.addToast('Categoria adicionada!', 'success');
  }

  async addCategories(categoryNames: string[]): Promise<void> {
    if (categoryNames.length === 0) return;
    const updatedCategories = await this.provider.addCategories(categoryNames, this.db().categories);
    this.db.update(db => ({ ...db, categories: updatedCategories }));
    await this.logAction('CREATE_CATEGORIES', `Categorias criadas via CSV: ${categoryNames.join(', ')}`);
    this.toastService.addToast(`${categoryNames.length} novas categorias foram criadas!`, 'success');
  }

  async deleteCategory(categoryToDelete: string): Promise<void> {
      const result = await this.provider.deleteCategory(categoryToDelete, this.db());
      if (result) {
          const { updatedItems, updatedRedShelfItems, updatedCategories } = result;
          this.db.update(db => ({
              ...db,
              items: updatedItems,
              redShelfItems: updatedRedShelfItems,
              categories: updatedCategories
          }));
          await this.logAction('DELETE_CATEGORY', `Categoria removida: ${categoryToDelete}. Itens movidos para "Outros".`);
          this.toastService.addToast('Categoria removida!', 'success');
      }
  }

  async receivePurchaseOrderItems(poId: string, receivedItems: { itemId: string, quantityReceived: number }[]): Promise<void> {
    const po = this.db().purchaseOrders.find(p => p.id === poId);
    if (!po) throw new Error('Ordem de Compra não encontrada.');

    const movementPromises = receivedItems
        .filter(ri => ri.quantityReceived > 0)
        .map(ri => this.addMovement({
            itemId: ri.itemId,
            type: 'in',
            quantity: ri.quantityReceived,
            date: new Date().toISOString(),
            notes: `Recebimento da Ordem de Compra ${po.poNumber}`,
            // FIX: Added missing 'technicianId' property. For 'in' movements from a PO, this should be null.
            technicianId: null,
        }));
    
    const movementResults = await Promise.all(movementPromises);
    const failures = movementResults.filter(r => !r.success);
    if (failures.length > 0) {
        const failedItemsStr = failures.map(f => f.message).join(', ');
        throw new Error(`Falha ao registrar entrada para alguns itens: ${failedItemsStr}`);
    }

    let allItemsFullyReceived = true;
    const updatedPoItems = po.items.map(item => {
        const received = receivedItems.find(ri => ri.itemId === item.itemId);
        let newReceivedQuantity = item.receivedQuantity;
        if (received) {
            newReceivedQuantity += received.quantityReceived;
        }
        if (newReceivedQuantity < item.quantity) {
            allItemsFullyReceived = false;
        }
        return { ...item, receivedQuantity: newReceivedQuantity };
    });

    const newStatus = allItemsFullyReceived ? PurchaseOrderStatus.Recebido : PurchaseOrderStatus.RecebidoParcialmente;

    const updatedPO: PurchaseOrder = {
        ...po,
        items: updatedPoItems,
        status: newStatus
    };

    await this.updateItem('purchaseOrders', updatedPO);

    await this.logAction('RECEIVE_PO', `Itens recebidos para a OC ${po.poNumber}. Novo status: ${newStatus}.`);
    this.toastService.addToast('Itens recebidos e estoque atualizado!', 'success');
  }

  async processPickingList(listId: string, pickedItems: { itemId: string, pickedQuantity: number }[]): Promise<void> {
    const list = this.db().pickingLists.find(l => l.id === listId);
    if (!list) throw new Error('Lista de coleta não encontrada.');
    if (list.status === PickingListStatus.Concluida) throw new Error('Esta lista já foi concluída.');

    // Check stock for all items first
    for (const pickedItem of pickedItems) {
        if (pickedItem.pickedQuantity > 0) {
            const item = this.itemsWithAvailableStock().find(i => i.id === pickedItem.itemId);
            if (!item || item.availableStock < pickedItem.pickedQuantity) {
                throw new Error(`Estoque insuficiente para "${item?.name || pickedItem.itemId}". Necessário: ${pickedItem.pickedQuantity}, Disponível: ${item?.availableStock || 0}.`);
            }
        }
    }

    // Process movements
    for (const pickedItem of pickedItems) {
        if (pickedItem.pickedQuantity > 0) {
            await this.addMovement({
                itemId: pickedItem.itemId,
                type: 'out',
                quantity: pickedItem.pickedQuantity,
                date: new Date().toISOString(),
                technicianId: list.technicianId,
                notes: `Coleta da lista: ${list.name}`
            });
        }
    }

    let allItemsFullyPicked = true;
    const updatedListItems = list.items.map(item => {
        const picked = pickedItems.find(p => p.itemId === item.itemId);
        const pickedQuantity = picked ? picked.pickedQuantity : item.pickedQuantity;
        if (pickedQuantity < item.quantity) {
            allItemsFullyPicked = false;
        }
        return { ...item, pickedQuantity };
    });
    
    const newStatus = allItemsFullyPicked ? PickingListStatus.Concluida : PickingListStatus.EmColeta;

    // Update list status and picked quantities
    const updatedList: PickingList = { ...list, items: updatedListItems, status: newStatus };
    await this.updateItem('pickingLists', updatedList);
    await this.logAction('PROCESS_PICKING_LIST', `Lista de coleta "${list.name}" processada. Novo status: ${newStatus}.`);
  }
  
  // FIX: Added method to fulfill item reservations.
  async fulfillReservation(reservationId: string): Promise<void> {
    const reservation = this.db().reservations.find(r => r.id === reservationId);
    if (!reservation) throw new Error('Reserva não encontrada.');
    if (reservation.status !== ReservationStatus.Pendente) throw new Error('Apenas reservas pendentes podem ser atendidas.');

    // Check stock for all items first
    for (const resItem of reservation.items) {
      const item = this.itemsWithAvailableStock().find(i => i.id === resItem.itemId);
      if (!item || item.availableStock < resItem.quantity) {
        throw new Error(`Estoque insuficiente para "${item?.name || resItem.itemId}". Necessário: ${resItem.quantity}, Disponível: ${item?.availableStock || 0}.`);
      }
    }

    // Process movements
    for (const resItem of reservation.items) {
      await this.addMovement({
        itemId: resItem.itemId,
        type: 'out',
        quantity: resItem.quantity,
        date: new Date().toISOString(),
        technicianId: reservation.technicianId,
        notes: `Atendimento da reserva: ${reservation.name}`
      });
    }

    // Update reservation status
    const updatedReservation: Reservation = { ...reservation, status: ReservationStatus.Atendida };
    await this.updateItem('reservations', updatedReservation);
    await this.logAction('FULFILL_RESERVATION', `Reserva "${reservation.name}" atendida.`);
  }
}