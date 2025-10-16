

import { AlmoxarifadoDB, Item, Movement, AuditLog, Technician, Supplier, PurchaseOrder, PickingList, RedShelfItem, Kit, Reservation, User } from '../models';

// Define um tipo para as chaves de coleção que contêm entidades com um 'id'.
export type CollectionWithId = keyof Omit<AlmoxarifadoDB, 'categories' | 'auditLogs'>;

// FIX: Add Kit and Reservation to the union type.
type EntityWithId = Item | Technician | Supplier | Movement | PurchaseOrder | PickingList | RedShelfItem | Kit | Reservation | User;


// Define um tipo para a carga útil de criação, omitindo o 'id' e opcionalmente 'createdAt'.
export type CreationPayload<T> = T extends { createdAt: string }
  ? Omit<T, 'id' | 'createdAt'>
  : T extends { receivedAt: string }
  ? Omit<T, 'id' | 'receivedAt'>
  : Omit<T, 'id'>;

/**
 * DataProvider é um contrato abstrato para serviços de persistência de dados.
 * Ele desacopla a lógica de negócios da fonte de dados real (localStorage, HTTP, etc.).
 * Qualquer provedor de dados (ex: LocalStorageProvider, HttpProvider) deve implementar esta classe.
 */
export abstract class DataProvider {
  /**
   * Carrega o estado inicial completo do banco de dados.
   */
  abstract getInitialData(): Promise<AlmoxarifadoDB>;

  /**
   * Substitui todo o banco de dados por um novo estado.
   */
  abstract replaceAllData(db: AlmoxarifadoDB): Promise<void>;
  
  /**
   * Adiciona um novo item a uma coleção especificada.
   */
  abstract addItem<T extends { id: string }>(collection: CollectionWithId, item: CreationPayload<T>): Promise<T>;
  
  /**
   * Atualiza um item existente em uma coleção.
   */
  abstract updateItem<T extends { id: string }>(collection: CollectionWithId, updatedItem: T): Promise<T>;

  /**
   * Atualiza múltiplos itens em uma coleção.
   */
  abstract updateMultipleItems<T extends { id: string }>(collection: CollectionWithId, updatedItems: T[]): Promise<T[]>;
  
  /**
   * Deleta um item de uma coleção pelo seu ID.
   */
  abstract deleteItem(collection: CollectionWithId, id: string): Promise<void>;

  /**
   * Deleta múltiplos itens de uma coleção por seus IDs.
   */
  abstract deleteMultipleItems(collection: CollectionWithId, ids: string[]): Promise<void>;
  
  /**
   * Adiciona múltiplos itens de uma vez (ex: importação CSV).
   */
  abstract addMultipleItems(itemsToAdd: (Omit<Item, 'id' | 'createdAt'>)[], isRedShelf: boolean): Promise<(Item | RedShelfItem)[]>;

  /**
   * Registra uma nova entrada no log de auditoria.
   */
  abstract logAction(action: string, details: string, user: string): Promise<AuditLog>;

  /**
   * Adiciona uma nova categoria à lista de categorias.
   */
  abstract addCategory(categoryName: string, existingCategories: string[]): Promise<string[]>;

  /**
   * Adiciona múltiplas novas categorias à lista.
   */
  abstract addCategories(categoryNames: string[], existingCategories: string[]): Promise<string[]>;

  /**
   * Deleta uma categoria e move os itens associados para 'Outros'.
   */
  abstract deleteCategory(categoryToDelete: string, currentDb: AlmoxarifadoDB): Promise<{
      updatedItems: Item[];
      updatedRedShelfItems: RedShelfItem[];
      updatedCategories: string[];
  } | null>;

  /**
   * Adiciona uma movimentação de estoque.
   */
  abstract addMovement(movementData: Omit<Movement, 'id'>): Promise<{
    success: boolean;
    message: string;
    newMovement?: Movement;
    updatedItem?: Item | RedShelfItem;
  }>;

  /**
   * Ajusta a quantidade de um item no estoque.
   */
  abstract adjustItemQuantity(itemId: string, newQuantity: number, notes: string, isRedShelf: boolean): Promise<{
    updatedItem: Item | RedShelfItem;
    newMovement: Movement;
  }>;
}