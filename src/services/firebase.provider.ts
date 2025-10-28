import { Injectable } from '@angular/core';
// Declare the global firebase object provided by the UMD scripts in index.html
declare var firebase: any;

import { DataProvider, CollectionWithId, CreationPayload } from './data.provider';
import { AlmoxarifadoDB, Item, Movement, AuditLog, Technician, Supplier, RedShelfItem, PurchaseOrder, PickingList, Kit, Reservation, User } from '../models';

// Configuração do projeto Firebase fornecida pelo usuário.
const firebaseConfig = {
    apiKey: "AIzaSyBVzX-bERp0wHsry1dBL3hBNXQ3zb9_CbE",
    authDomain: "almoxarifado-v1.firebaseapp.com",
    projectId: "almoxarifado-v1",
    storageBucket: "almoxarifado-v1.firebasestorage.app",
    messagingSenderId: "272979878501",
    appId: "1:272979878501:web:5386948078077d14139c8c"
};

@Injectable()
export class FirebaseProvider extends DataProvider {
  // FIX: Replaced specific Firebase types with 'any' to resolve type resolution errors
  // with the UMD script version of the Firebase SDK.
  private app: any;
  private db: any;

  constructor() {
    super();
    if (!firebase.apps.length) {
      this.app = firebase.initializeApp(firebaseConfig);
    } else {
      this.app = firebase.app();
    }
    this.db = firebase.firestore();
  }

  private async getCollectionData<T>(collectionName: string): Promise<T[]> {
    const querySnapshot = await this.db.collection(collectionName).get();
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as T));
  }

  async getInitialData(): Promise<AlmoxarifadoDB> {
    try {
      const [items, redShelfItems, technicians, suppliers, movements, categoriesDoc, auditLogs, purchaseOrders, pickingLists, kits, reservations, users] = await Promise.all([
        this.getCollectionData<Item>('items'),
        this.getCollectionData<RedShelfItem>('redShelfItems'),
        this.getCollectionData<Technician>('technicians'),
        this.getCollectionData<Supplier>('suppliers'),
        this.getCollectionData<Movement>('movements'),
        this.db.collection('single_docs').doc('categories').get(),
        this.getCollectionData<AuditLog>('auditLogs'),
        this.getCollectionData<PurchaseOrder>('purchaseOrders'),
        this.getCollectionData<PickingList>('pickingLists'),
        this.getCollectionData<Kit>('kits'),
        this.getCollectionData<Reservation>('reservations'),
        this.getCollectionData<User>('users'),
      ]);
      
      const categories = categoriesDoc.exists ? (categoriesDoc.data() as any).list : [];

      return { items, redShelfItems, technicians, suppliers, movements, categories, auditLogs, purchaseOrders, pickingLists, kits, reservations, users };
    } catch (error: any) {
      console.error('Firebase: Falha ao carregar dados iniciais. Mensagem:', error.message);
      return { items: [], redShelfItems: [], technicians: [], suppliers: [], movements: [], categories: [], auditLogs: [], purchaseOrders: [], pickingLists: [], kits: [], reservations: [], users: [] };
    }
  }
  
  async addItem<T extends { id: string }>(collectionName: CollectionWithId, item: CreationPayload<T>): Promise<T> {
    const { id, ...payloadData } = item as any;
    
    const payload: any = payloadData;
    if (['items', 'redShelfItems', 'purchaseOrders', 'reservations', 'kits', 'users'].includes(collectionName)) {
        payload.createdAt = new Date().toISOString();
    }
    const docRef = await this.db.collection(collectionName).add(payload);
    return { id: docRef.id, ...payload } as unknown as T;
  }

  async updateItem<T extends { id: string }>(collectionName: CollectionWithId, updatedItem: T): Promise<T> {
    const { id, ...data } = updatedItem;
    const docRef = this.db.collection(collectionName).doc(id);
    await docRef.update(data);
    return updatedItem;
  }
  
  async deleteItem(collectionName: CollectionWithId, id: string): Promise<void> {
    await this.db.collection(collectionName).doc(id).delete();
  }

  async addMovement(movementData: Omit<Movement, 'id'>): Promise<{ success: boolean; message: string; newMovement?: Movement; updatedItem?: Item | RedShelfItem; }> {
    const isMainItemDoc = await this.db.collection('items').doc(movementData.itemId).get();
    const isMainItem = isMainItemDoc.exists;
    const collectionKey = isMainItem ? 'items' : 'redShelfItems';
    const itemRef = this.db.collection(collectionKey).doc(movementData.itemId);
    
    try {
      let updatedItemData: Item | RedShelfItem | null = null;
      let newMovement: Movement | null = null;

      await this.db.runTransaction(async (transaction: any) => {
        const itemDoc = await transaction.get(itemRef);
        if (!itemDoc.exists) {
          throw new Error("Item não encontrado.");
        }

        const currentItem = { id: itemDoc.id, ...itemDoc.data() } as Item | RedShelfItem;
        let newQuantity = currentItem.quantity;

        if (movementData.type === 'out') {
          if (currentItem.quantity < movementData.quantity) {
            throw new Error(`Estoque insuficiente para ${currentItem.name}.`);
          }
          newQuantity -= movementData.quantity;
        } else {
          newQuantity += movementData.quantity;
        }

        transaction.update(itemRef, { quantity: newQuantity });
        
        const newMovementRef = this.db.collection('movements').doc();
        newMovement = { ...movementData, id: newMovementRef.id };
        transaction.set(newMovementRef, newMovement as any);
        
        updatedItemData = { ...currentItem, quantity: newQuantity };
      });

      return { success: true, message: 'Movimentação registrada.', newMovement: newMovement!, updatedItem: updatedItemData! };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }
  
  async logAction(action: string, details: string, user: string): Promise<AuditLog> {
    const newLog = { action, details, user, timestamp: new Date().toISOString() };
    const docRef = await this.db.collection('auditLogs').add(newLog);
    return { id: docRef.id, ...newLog };
  }

  async replaceAllData(db: AlmoxarifadoDB): Promise<void> {
    const collections = Object.keys(db) as (keyof AlmoxarifadoDB)[];
    for (const collectionName of collections) {
      if (collectionName === 'categories') {
        await this.db.collection('single_docs').doc('categories').set({ list: db.categories });
      } else {
        const collectionRef = this.db.collection(collectionName);
        const snapshot = await collectionRef.get();
        
        let deleteBatch = this.db.batch();
        let deleteCount = 0;
        for (const docSnapshot of snapshot.docs) {
          deleteBatch.delete(docSnapshot.ref);
          deleteCount++;
          if (deleteCount === 500) {
            await deleteBatch.commit();
            deleteBatch = this.db.batch();
            deleteCount = 0;
          }
        }
        if (deleteCount > 0) {
          await deleteBatch.commit();
        }

        let addBatch = this.db.batch();
        let addCount = 0;
        for (const item of (db as any)[collectionName]) {
          const { id, ...data } = item;
          addBatch.set(this.db.collection(collectionName).doc(id), data);
          addCount++;
          if (addCount === 500) {
            await addBatch.commit();
            addBatch = this.db.batch();
            addCount = 0;
          }
        }
        if (addCount > 0) {
          await addBatch.commit();
        }
      }
    }
  }

  async updateMultipleItems<T extends { id: string }>(collectionName: CollectionWithId, updatedItems: T[]): Promise<T[]> {
    const batch = this.db.batch();
    updatedItems.forEach(item => {
      const { id, ...data } = item;
      const docRef = this.db.collection(collectionName).doc(id);
      batch.update(docRef, data);
    });
    await batch.commit();
    return updatedItems;
  }

  async deleteMultipleItems(collectionName: CollectionWithId, ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const batch = this.db.batch();
    ids.forEach(id => {
      batch.delete(this.db.collection(collectionName).doc(id));
    });
    await batch.commit();
  }
  
  async addMultipleItems(itemsToAdd: Omit<Item, 'id' | 'createdAt'>[], isRedShelf: boolean): Promise<(Item | RedShelfItem)[]> {
    const collectionName = isRedShelf ? 'redShelfItems' : 'items';
    const batch = this.db.batch();
    const newItems: (Item | RedShelfItem)[] = [];

    itemsToAdd.forEach(item => {
      const docRef = this.db.collection(collectionName).doc();
      const newItem = {
        ...item,
        id: docRef.id,
        createdAt: new Date().toISOString(),
      } as Item | RedShelfItem;
      batch.set(docRef, newItem as any);
      newItems.push(newItem);
    });

    await batch.commit();
    return newItems;
  }
  
  async addCategory(categoryName: string, existingCategories: string[]): Promise<string[]> {
    const docRef = this.db.collection('single_docs').doc('categories');
    const updatedCategories = [...new Set([...existingCategories, categoryName])].sort();
    await docRef.set({ list: updatedCategories });
    return updatedCategories;
  }
  
  async addCategories(categoryNames: string[], existingCategories: string[]): Promise<string[]> {
    const docRef = this.db.collection('single_docs').doc('categories');
    const updatedCategories = [...new Set([...existingCategories, ...categoryNames])].sort();
    await docRef.set({ list: updatedCategories });
    return updatedCategories;
  }
  
  async deleteCategory(categoryToDelete: string, currentDb: AlmoxarifadoDB): Promise<{ updatedItems: Item[]; updatedRedShelfItems: RedShelfItem[]; updatedCategories: string[]; } | null> {
    const q = this.db.collection('items').where('category', '==', categoryToDelete);
    const itemsToUpdateSnapshot = await q.get();

    const batch = this.db.batch();
    itemsToUpdateSnapshot.forEach(docSnapshot => {
        batch.update(docSnapshot.ref, { category: 'Outros' });
    });

    const updatedCategories = currentDb.categories.filter(c => c !== categoryToDelete);
    batch.set(this.db.collection('single_docs').doc('categories'), { list: updatedCategories });
    
    await batch.commit();
    
    const updatedItems = currentDb.items.map(item =>
        item.category === categoryToDelete ? { ...item, category: 'Outros' } : item
    );

    return { updatedItems, updatedRedShelfItems: currentDb.redShelfItems, updatedCategories };
  }
  
  async adjustItemQuantity(itemId: string, newQuantity: number, notes: string, isRedShelf: boolean): Promise<{ updatedItem: Item | RedShelfItem; newMovement: Movement; }> {
    const collectionKey = isRedShelf ? 'redShelfItems' : 'items';
    const itemRef = this.db.collection(collectionKey).doc(itemId);

    let updatedItem: Item | RedShelfItem | null = null;
    let newMovement: Movement | null = null;

    try {
        await this.db.runTransaction(async (transaction: any) => {
            const itemDoc = await transaction.get(itemRef);
            if (!itemDoc.exists) {
                throw new Error("Item não encontrado.");
            }

            const currentItem = { id: itemDoc.id, ...itemDoc.data() } as Item | RedShelfItem;
            const oldQuantity = currentItem.quantity;
            const quantityChange = newQuantity - oldQuantity;

            if (quantityChange === 0) {
              throw new Error("Nenhuma alteração na quantidade."); 
            }

            const movementType = quantityChange > 0 ? 'in' : 'out';
            const movementQuantity = Math.abs(quantityChange);
            
            const movementRef = this.db.collection('movements').doc();
            newMovement = {
                id: movementRef.id,
                itemId: itemId,
                type: movementType,
                quantity: movementQuantity,
                date: new Date().toISOString(),
                technicianId: null,
                notes: notes
            };

            transaction.set(movementRef, newMovement as any);
            transaction.update(itemRef, { quantity: newQuantity });

            updatedItem = { ...currentItem, quantity: newQuantity };
        });
    } catch (e: any) {
        // Rethrow real errors to be caught by the service
        throw e;
    }

    if (updatedItem && newMovement) {
        return { updatedItem, newMovement };
    } else {
        throw new Error("A transação de ajuste de quantidade falhou.");
    }
  }
}