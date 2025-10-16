import { Injectable } from '@angular/core';
import { initializeApp, FirebaseApp } from 'firebase/app';
import { 
  getFirestore, Firestore, collection, getDocs, doc, addDoc, updateDoc, 
  deleteDoc, runTransaction, writeBatch, documentId, where, query, getDoc, setDoc
} from 'firebase/firestore';

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
  private app: FirebaseApp;
  private db: Firestore;

  constructor() {
    super();
    this.app = initializeApp(firebaseConfig);
    this.db = getFirestore(this.app);
  }

  private async getCollectionData<T>(collectionName: string): Promise<T[]> {
    const querySnapshot = await getDocs(collection(this.db, collectionName));
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
        getDoc(doc(this.db, 'single_docs', 'categories')),
        this.getCollectionData<AuditLog>('auditLogs'),
        this.getCollectionData<PurchaseOrder>('purchaseOrders'),
        this.getCollectionData<PickingList>('pickingLists'),
        this.getCollectionData<Kit>('kits'),
        this.getCollectionData<Reservation>('reservations'),
        this.getCollectionData<User>('users'),
      ]);
      
      const categories = categoriesDoc.exists() ? categoriesDoc.data().list : [];

      return { items, redShelfItems, technicians, suppliers, movements, categories, auditLogs, purchaseOrders, pickingLists, kits, reservations, users };
    } catch (error) {
      console.error('Firebase: Falha ao carregar dados iniciais.', error);
      return { items: [], redShelfItems: [], technicians: [], suppliers: [], movements: [], categories: [], auditLogs: [], purchaseOrders: [], pickingLists: [], kits: [], reservations: [], users: [] };
    }
  }
  
  async addItem<T extends { id: string }>(collectionName: CollectionWithId, item: CreationPayload<T>): Promise<T> {
    // Destructure to explicitly remove the 'id' property, which might be undefined and cause Firestore errors.
    const { id, ...payloadData } = item as any;
    
    const payload: any = payloadData;
    if (['items', 'redShelfItems', 'purchaseOrders', 'reservations', 'kits'].includes(collectionName)) {
        payload.createdAt = new Date().toISOString();
    }
    const docRef = await addDoc(collection(this.db, collectionName), payload);
    return { id: docRef.id, ...payload } as unknown as T;
  }

  async updateItem<T extends { id: string }>(collectionName: CollectionWithId, updatedItem: T): Promise<T> {
    const { id, ...data } = updatedItem;
    const docRef = doc(this.db, collectionName, id);
    await updateDoc(docRef, data);
    return updatedItem;
  }
  
  async deleteItem(collectionName: CollectionWithId, id: string): Promise<void> {
    await deleteDoc(doc(this.db, collectionName, id));
  }

  async addMovement(movementData: Omit<Movement, 'id'>): Promise<{ success: boolean; message: string; newMovement?: Movement; updatedItem?: Item | RedShelfItem; }> {
    const isMainItemDoc = await getDoc(doc(this.db, 'items', movementData.itemId));
    const isMainItem = isMainItemDoc.exists();
    const collectionKey = isMainItem ? 'items' : 'redShelfItems';
    const itemRef = doc(this.db, collectionKey, movementData.itemId);
    
    try {
      let updatedItemData: Item | RedShelfItem | null = null;
      let newMovement: Movement | null = null;

      await runTransaction(this.db, async (transaction) => {
        const itemDoc = await transaction.get(itemRef);
        if (!itemDoc.exists()) {
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
        
        const newMovementRef = doc(collection(this.db, 'movements'));
        newMovement = { ...movementData, id: newMovementRef.id };
        transaction.set(newMovementRef, newMovement);
        
        updatedItemData = { ...currentItem, quantity: newQuantity };
      });

      return { success: true, message: 'Movimentação registrada.', newMovement: newMovement!, updatedItem: updatedItemData! };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }
  
  async logAction(action: string, details: string, user: string): Promise<AuditLog> {
    const newLog = { action, details, user, timestamp: new Date().toISOString() };
    const docRef = await addDoc(collection(this.db, 'auditLogs'), newLog);
    return { id: docRef.id, ...newLog };
  }

  async replaceAllData(db: AlmoxarifadoDB): Promise<void> {
    const collections = Object.keys(db) as (keyof AlmoxarifadoDB)[];
    for (const collectionName of collections) {
      if (collectionName === 'categories') {
        await setDoc(doc(this.db, 'single_docs', 'categories'), { list: db.categories });
      } else {
        const collectionRef = collection(this.db, collectionName);
        const snapshot = await getDocs(collectionRef);
        
        // Delete all existing documents in batches
        let deleteBatch = writeBatch(this.db);
        let deleteCount = 0;
        for (const docSnapshot of snapshot.docs) {
          deleteBatch.delete(docSnapshot.ref);
          deleteCount++;
          if (deleteCount === 500) {
            await deleteBatch.commit();
            deleteBatch = writeBatch(this.db);
            deleteCount = 0;
          }
        }
        if (deleteCount > 0) {
          await deleteBatch.commit();
        }

        // Add all new documents in batches
        let addBatch = writeBatch(this.db);
        let addCount = 0;
        for (const item of (db as any)[collectionName]) {
          const { id, ...data } = item;
          // Use the original ID for restoration
          addBatch.set(doc(this.db, collectionName, id), data);
          addCount++;
          if (addCount === 500) {
            await addBatch.commit();
            addBatch = writeBatch(this.db);
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
    const batch = writeBatch(this.db);
    updatedItems.forEach(item => {
      const { id, ...data } = item;
      const docRef = doc(this.db, collectionName, id);
      batch.update(docRef, data);
    });
    await batch.commit();
    return updatedItems;
  }

  async deleteMultipleItems(collectionName: CollectionWithId, ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const batch = writeBatch(this.db);
    ids.forEach(id => {
      batch.delete(doc(this.db, collectionName, id));
    });
    await batch.commit();
  }
  
  async addMultipleItems(itemsToAdd: Omit<Item, 'id' | 'createdAt'>[], isRedShelf: boolean): Promise<(Item | RedShelfItem)[]> {
    const collectionName = isRedShelf ? 'redShelfItems' : 'items';
    const batch = writeBatch(this.db);
    const newItems: (Item | RedShelfItem)[] = [];

    itemsToAdd.forEach(item => {
      const docRef = doc(collection(this.db, collectionName));
      const newItem = {
        ...item,
        id: docRef.id,
        createdAt: new Date().toISOString(),
      } as Item | RedShelfItem;
      batch.set(docRef, newItem);
      newItems.push(newItem);
    });

    await batch.commit();
    return newItems;
  }
  
  async addCategory(categoryName: string, existingCategories: string[]): Promise<string[]> {
    const docRef = doc(this.db, 'single_docs', 'categories');
    const updatedCategories = [...new Set([...existingCategories, categoryName])].sort();
    await setDoc(docRef, { list: updatedCategories });
    return updatedCategories;
  }
  
  async addCategories(categoryNames: string[], existingCategories: string[]): Promise<string[]> {
    const docRef = doc(this.db, 'single_docs', 'categories');
    const updatedCategories = [...new Set([...existingCategories, ...categoryNames])].sort();
    await setDoc(docRef, { list: updatedCategories });
    return updatedCategories;
  }
  
  async deleteCategory(categoryToDelete: string, currentDb: AlmoxarifadoDB): Promise<{ updatedItems: Item[]; updatedRedShelfItems: RedShelfItem[]; updatedCategories: string[]; } | null> {
    const q = query(collection(this.db, 'items'), where('category', '==', categoryToDelete));
    const itemsToUpdateSnapshot = await getDocs(q);

    const batch = writeBatch(this.db);
    itemsToUpdateSnapshot.forEach(docSnapshot => {
        batch.update(docSnapshot.ref, { category: 'Outros' });
    });

    const updatedCategories = currentDb.categories.filter(c => c !== categoryToDelete);
    batch.set(doc(this.db, 'single_docs', 'categories'), { list: updatedCategories });
    
    await batch.commit();
    
    const updatedItems = currentDb.items.map(item =>
        item.category === categoryToDelete ? { ...item, category: 'Outros' } : item
    );

    return { updatedItems, updatedRedShelfItems: currentDb.redShelfItems, updatedCategories };
  }
  
  async adjustItemQuantity(itemId: string, newQuantity: number, notes: string, isRedShelf: boolean): Promise<{ updatedItem: Item | RedShelfItem; newMovement: Movement; }> {
    const collectionKey = isRedShelf ? 'redShelfItems' : 'items';
    const itemRef = doc(this.db, collectionKey, itemId);

    let updatedItem: Item | RedShelfItem | null = null;
    let newMovement: Movement | null = null;

    await runTransaction(this.db, async (transaction) => {
        const itemDoc = await transaction.get(itemRef);
        if (!itemDoc.exists()) {
            throw new Error("Item não encontrado.");
        }

        const currentItem = { id: itemDoc.id, ...itemDoc.data() } as Item | RedShelfItem;
        const oldQuantity = currentItem.quantity;
        const quantityChange = newQuantity - oldQuantity;

        if (quantityChange === 0) {
          // Lançar um erro específico para que o serviço possa ignorá-lo silenciosamente se necessário
          throw new Error("NO_CHANGE"); 
        }

        const movementType = quantityChange > 0 ? 'in' : 'out';
        const movementQuantity = Math.abs(quantityChange);
        
        const movementRef = doc(collection(this.db, 'movements'));
        newMovement = {
            id: movementRef.id,
            itemId: itemId,
            type: movementType,
            quantity: movementQuantity,
            date: new Date().toISOString(),
            technicianId: null, // Ajustes não são associados a técnicos
            notes: notes
        };

        transaction.set(movementRef, newMovement);
        transaction.update(itemRef, { quantity: newQuantity });

        updatedItem = { ...currentItem, quantity: newQuantity };
    });

    if (updatedItem && newMovement) {
        return { updatedItem, newMovement };
    } else {
        throw new Error("A transação de ajuste de quantidade falhou.");
    }
  }
}
