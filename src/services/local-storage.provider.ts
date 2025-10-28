import { Injectable } from '@angular/core';
import { DataProvider, CollectionWithId, CreationPayload } from './data.provider';
import { AlmoxarifadoDB, Item, Movement, AuditLog, Technician, Supplier, RedShelfItem, PurchaseOrderStatus, UserRole, User } from '../models';

const DB_KEY = 'almoxarifadoDB';

// ==========================================================================================
// --- DEFAULT DATA GENERATION ---
// This section generates a standard, lightweight dataset for the application.
// ==========================================================================================

function generateDefaultTestData(): AlmoxarifadoDB {
  const db: AlmoxarifadoDB = {
    categories: ['Ferramentas', 'Componentes Eletrônicos', 'Material de Escritório', 'Limpeza', 'Segurança', 'Redes', 'Outros'],
    suppliers: [],
    technicians: [],
    items: [],
    redShelfItems: [],
    movements: [],
    auditLogs: [],
    purchaseOrders: [],
    pickingLists: [],
    // FIX: Add empty arrays for new models
    kits: [],
    reservations: [],
    users: [],
  };

  // 0. Create Default Admin User
  db.users.push({
    id: 'user-admin-default',
    username: 'admin',
    name: 'Administrador Padrão',
    passwordHash: btoa('admin123'), // Base64 encoding as a simple substitute for hashing
    role: UserRole.Admin,
    permissions: [] // Admin has all permissions implicitly
  });

  // 1. Create Suppliers (5)
  for (let i = 0; i < 5; i++) {
    const supplierLetter = String.fromCharCode(65 + i);
    db.suppliers.push({
      id: `supplier-${i + 1}`,
      name: `Fornecedor ${supplierLetter}`,
      contact: `contato@fornecedor${supplierLetter.toLowerCase()}.com`,
      cnpj: `11.222.333/0001-${10 + i}`,
      address: `Av. Principal, ${100 + i * 10}, Bairro Central, Cidade Exemplo`,
      responsibleName: `Responsável ${supplierLetter}`
    });
  }

  // 2. Create Technicians (5)
  const techFirstNames = ['Ana', 'Bruno', 'Carlos', 'Daniela', 'Eduardo'];
  for (let i = 0; i < 5; i++) {
    db.technicians.push({
      id: `tech-${i + 1}`,
      name: techFirstNames[i],
      matricula: `M${2024001 + i}`,
      password: '123'
    });
  }

  // 3. Create Items (20)
  const itemNames = [
    'Parafuso Sextavado 1/4"', 'Resistor 10k Ohm', 'Cabo de Rede Cat6 5m', 'Luminária LED 20W', 
    'Mouse Óptico USB', 'Detergente Neutro 5L', 'Fita Isolante 20m', 'Capacitor Eletrolítico 100uF',
    'Caneta Esferográfica Azul', 'Luva de Segurança Pigmentada', 'Switch de Rede 8 Portas', 'Monitor LED 24"',
    'Tubo PVC 25mm', 'Disjuntor Monopolar 20A', 'Cimento CP II 50kg', 'Rolamento 6204-ZZ',
    'Martelo de Pena', 'Chave de Fenda Phillips', 'Alicate de Corte', 'Trena 5m'
  ];
  
  const itemUnits = [
    'un.', 'un.', 'm', 'un.', 
    'pç', 'L', 'rolo', 'un.',
    'un.', 'par', 'pç', 'un.',
    'm', 'un.', 'kg', 'un.',
    'pç', 'pç', 'pç', 'm'
  ];

  for (let i = 0; i < itemNames.length; i++) {
    const category = db.categories[i % (db.categories.length -1)]; // Avoid 'Outros'
    const name = itemNames[i];
    const price = parseFloat((Math.random() * 50 + 5).toFixed(2));
    const reorderPoint = Math.floor(Math.random() * 20) + 10;
    
    db.items.push({
      id: `item-${i + 1}`,
      name: name,
      description: `Descrição para ${name}`,
      category: category,
      unit: itemUnits[i] || 'un.',
      price: price,
      preferredSupplierId: `supplier-${(i % db.suppliers.length) + 1}`,
      reorderPoint: reorderPoint,
      quantity: Math.floor(Math.random() * 100) + reorderPoint,
      createdAt: new Date('2023-01-01T00:00:00Z').toISOString()
    });
  }

  // 4. Generate Movements from the last 3 months to today
  const today = new Date();
  const startDate = new Date();
  startDate.setMonth(today.getMonth() - 3);
  startDate.setHours(0,0,0,0);
  const endDate = today;
  
  let currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dayOfWeek = currentDate.getDay();
    // Skip weekends
    if (dayOfWeek === 0 || dayOfWeek === 6) {
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
    }

    const movementsToday = Math.floor(Math.random() * 5) + 1;

    for (let j = 0; j < movementsToday; j++) {
      const isRestock = Math.random() < 0.1; // 10% chance of being a restock
      const randomItem = db.items[Math.floor(Math.random() * db.items.length)];
      
      if (isRestock) {
        const qty = Math.floor(Math.random() * 50) + 20;
        db.movements.push({
          id: crypto.randomUUID(), itemId: randomItem.id, type: 'in', quantity: qty,
          date: new Date(currentDate.getTime() + j * 1000).toISOString(), technicianId: null,
          notes: 'Reposição de estoque.'
        });
        randomItem.quantity += qty;
      } else {
        const randomTech = db.technicians[Math.floor(Math.random() * db.technicians.length)];
        const qty = Math.floor(Math.random() * 5) + 1;
        if (randomItem.quantity >= qty) {
          db.movements.push({
            id: crypto.randomUUID(), itemId: randomItem.id, type: 'out', quantity: qty,
            date: new Date(currentDate.getTime() + j * 1000).toISOString(), technicianId: randomTech.id,
            notes: 'Uso em manutenção.'
          });
          randomItem.quantity -= qty;
        }
      }
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  db.movements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  return db;
}


const DEFAULT_DB = generateDefaultTestData();

@Injectable()
export class LocalStorageProvider extends DataProvider {

  private readDb(): AlmoxarifadoDB {
    const data = localStorage.getItem(DB_KEY);
    return data ? JSON.parse(data) : DEFAULT_DB;
  }

  private writeDb(db: AlmoxarifadoDB): void {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  }

  getInitialData(): Promise<AlmoxarifadoDB> {
    const data = localStorage.getItem(DB_KEY);
    if (data) {
        return Promise.resolve(JSON.parse(data));
    }
    this.writeDb(DEFAULT_DB);
    return Promise.resolve(DEFAULT_DB);
  }

  replaceAllData(db: AlmoxarifadoDB): Promise<void> {
    this.writeDb(db);
    return Promise.resolve();
  }

  addItem<T extends { id: string }>(collection: CollectionWithId, item: CreationPayload<T>): Promise<T> {
    const db = this.readDb();
    const newItem = {
        ...item,
        id: crypto.randomUUID(),
        ...((collection === 'items' || collection === 'redShelfItems' || collection === 'purchaseOrders' || collection === 'reservations' || collection === 'kits' || collection === 'users') && { createdAt: new Date().toISOString() })
    } as unknown as T;
    
    (db[collection] as any[]).push(newItem);
    this.writeDb(db);
    return Promise.resolve(newItem);
  }

  updateItem<T extends { id: string }>(collection: CollectionWithId, updatedItem: T): Promise<T> {
    const db = this.readDb();
    const items = db[collection] as unknown as T[];
    const index = items.findIndex(i => i.id === updatedItem.id);
    if (index > -1) {
        items[index] = updatedItem;
        this.writeDb(db);
        return Promise.resolve(updatedItem);
    }
    return Promise.reject(new Error('Item not found'));
  }
  
  updateMultipleItems<T extends { id: string; }>(collection: CollectionWithId, updatedItems: T[]): Promise<T[]> {
    const db = this.readDb();
    const items = db[collection] as unknown as T[];
    const updatedIds = new Set(updatedItems.map(u => u.id));
    const newItems = items.map(i => updatedItems.find(u => u.id === i.id) || i);
    (db as any)[collection] = newItems;
    this.writeDb(db);
    return Promise.resolve(updatedItems);
  }

  deleteItem(collection: CollectionWithId, id: string): Promise<void> {
    const db = this.readDb();
    const items = (db[collection] as {id: string}[]).filter(i => i.id !== id);
    (db as any)[collection] = items; 
    this.writeDb(db);
    return Promise.resolve();
  }

  deleteMultipleItems(collection: CollectionWithId, ids: string[]): Promise<void> {
    const db = this.readDb();
    const idsToDelete = new Set(ids);
    const items = (db[collection] as {id: string}[]).filter(i => !idsToDelete.has(i.id));
    (db as any)[collection] = items;
    this.writeDb(db);
    return Promise.resolve();
  }
  
  addMovement(movementData: Omit<Movement, "id">): Promise<{ success: boolean; message: string; newMovement?: Movement; updatedItem?: Item | RedShelfItem; }> {
    const db = this.readDb();
    const isMainItem = db.items.some(i => i.id === movementData.itemId);
    const collectionKey: 'items' | 'redShelfItems' = isMainItem ? 'items' : 'redShelfItems';
    let item: Item | RedShelfItem | undefined = db[collectionKey].find(i => i.id === movementData.itemId);
    
    if (!item) {
        return Promise.resolve({ success: false, message: `Item não encontrado.` });
    }

    if (movementData.type === 'out') {
      if (item.quantity < movementData.quantity) {
        let itemName = 'name' in item ? item.name : 'Item desconhecido';
        return Promise.resolve({ success: false, message: `Estoque insuficiente para ${itemName}.` });
      }
      item.quantity -= movementData.quantity;
    } else { // 'in'
      item.quantity += movementData.quantity;
    }
    
    const newMovement: Movement = { ...movementData, id: crypto.randomUUID() };
    db.movements.unshift(newMovement);
    this.writeDb(db);
    return Promise.resolve({ success: true, message: 'Movimentação registrada.', newMovement, updatedItem: item });
  }

  addMultipleItems(itemsToAdd: (Omit<Item, "id" | "createdAt">)[], isRedShelf: boolean): Promise<(Item | RedShelfItem)[]> {
    const db = this.readDb();
    const collection = isRedShelf ? 'redShelfItems' : 'items';
    const newItems: (Item | RedShelfItem)[] = itemsToAdd.map(item => ({
        ...item,
        price: (item as any).price ?? 0,
        reorderPoint: (item as any).reorderPoint ?? 0,
        preferredSupplierId: (item as any).preferredSupplierId ?? null,
        description: item.description ?? '', // Ensure description is not undefined
        id: crypto.randomUUID(),
        quantity: item.quantity ?? 0, // Use provided quantity
        createdAt: new Date().toISOString()
    } as Item)); // Assuming similar structure for now, might need adjustment for RedShelfItem
    (db[collection] as any[]).push(...newItems);
    this.writeDb(db);
    return Promise.resolve(newItems);
  }

  adjustItemQuantity(itemId: string, newQuantity: number, notes: string, isRedShelf: boolean): Promise<{ updatedItem: Item | RedShelfItem; newMovement: Movement; }> {
    const db = this.readDb();
    const collectionKey = isRedShelf ? 'redShelfItems' : 'items';
    const item: Item | RedShelfItem | undefined = db[collectionKey].find(i => i.id === itemId);

    if (!item) {
        return Promise.reject(new Error('Item não encontrado.'));
    }
    
    const oldQuantity = item.quantity;
    const quantityChange = newQuantity - oldQuantity;
    if (quantityChange === 0) {
        return Promise.reject(new Error('Nenhuma alteração na quantidade.'));
    }

    item.quantity = newQuantity;
    
    const movementType = quantityChange > 0 ? 'in' : 'out';
    const movementQuantity = Math.abs(quantityChange);
    
    const newMovement: Movement = {
      id: crypto.randomUUID(),
      itemId: itemId,
      type: movementType,
      quantity: movementQuantity,
      date: new Date().toISOString(),
      technicianId: null,
      notes: notes
    };
    
    db.movements.unshift(newMovement);
    this.writeDb(db);
    return Promise.resolve({ updatedItem: item, newMovement });
  }

  logAction(action: string, details: string, user: string): Promise<AuditLog> {
    const db = this.readDb();
    const newLog: AuditLog = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      action,
      details,
      user
    };
    db.auditLogs.unshift(newLog);
    this.writeDb(db);
    return Promise.resolve(newLog);
  }

  addCategory(categoryName: string, existingCategories: string[]): Promise<string[]> {
      const db = this.readDb();
      if (!db.categories.find(c => c.toLowerCase() === categoryName.toLowerCase())) {
          db.categories.push(categoryName);
          db.categories.sort((a, b) => a.localeCompare(b));
          this.writeDb(db);
      }
      return Promise.resolve(db.categories);
  }

  addCategories(categoryNames: string[], existingCategories: string[]): Promise<string[]> {
      const db = this.readDb();
      const lowerCaseExisting = db.categories.map(c => c.toLowerCase());
      const newCategories = categoryNames.filter(c => !lowerCaseExisting.includes(c.toLowerCase()));
      
      if (newCategories.length > 0) {
        db.categories.push(...newCategories);
        db.categories.sort((a,b) => a.localeCompare(b));
        this.writeDb(db);
      }
      return Promise.resolve(db.categories);
  }

  deleteCategory(categoryToDelete: string, currentDb: AlmoxarifadoDB): Promise<{ updatedItems: Item[]; updatedRedShelfItems: RedShelfItem[]; updatedCategories: string[]; } | null> {
      const db = this.readDb();
      
      const updatedItems = db.items.map(item =>
        item.category === categoryToDelete ? { ...item, category: 'Outros' } : item
      );
      
      // Red shelf does not have categories, so no changes needed
      const updatedRedShelfItems = db.redShelfItems;
      const updatedCategories = db.categories.filter(c => c !== categoryToDelete);

      db.items = updatedItems;
      db.redShelfItems = updatedRedShelfItems;
      db.categories = updatedCategories;

      this.writeDb(db);
      return Promise.resolve({ updatedItems, updatedRedShelfItems, updatedCategories });
  }
}