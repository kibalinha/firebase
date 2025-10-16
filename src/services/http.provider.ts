/*
// ==========================================================================================
// --- HttpProvider - Provedor de Dados para Backend ASP.NET Core ---
// ==========================================================================================
//
// PARA ATIVAR ESTE PROVEDOR:
//
// 1. DESCOMENTE todo o conteúdo deste arquivo (Ctrl+A, Ctrl+/).
//
// 2. No arquivo `index.tsx`, comente a linha do `LocalStorageProvider` e
//    descomente a linha que importa e fornece o `HttpProvider`.
//
// 3. Certifique-se de que seu backend ASP.NET Core está rodando e configurado
//    para aceitar requisições do seu frontend (CORS).
//
// 4. Ajuste a constante `API_BASE_URL` abaixo para a URL correta do seu backend
//    (ex: 'https://localhost:7001/api').
//
// ==========================================================================================

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { DataProvider, CollectionWithId, CreationPayload } from './data.provider';
import { AlmoxarifadoDB, Item, Movement, AuditLog, Technician, Supplier, PickingList, PurchaseOrder, RedShelfItem } from '../models';

const API_BASE_URL = 'http://localhost:5001/api'; // <-- AJUSTE A URL DA SUA API AQUI

@Injectable()
export class HttpProvider extends DataProvider {
  private http = inject(HttpClient);

  // No modo HTTP, os dados iniciais são uma combinação de várias chamadas de API.
  async getInitialData(): Promise<AlmoxarifadoDB> {
    try {
      // Um endpoint "bootstrap" no backend pode otimizar isso para uma única chamada.
      const [items, redShelfItems, technicians, suppliers, movements, categories, auditLogs, purchaseOrders, pickingLists] = await Promise.all([
        firstValueFrom(this.http.get<Item[]>(`${API_BASE_URL}/items`)),
        firstValueFrom(this.http.get<RedShelfItem[]>(`${API_BASE_URL}/redshelfitems`)),
        firstValueFrom(this.http.get<Technician[]>(`${API_BASE_URL}/technicians`)),
        firstValueFrom(this.http.get<Supplier[]>(`${API_BASE_URL}/suppliers`)),
        firstValueFrom(this.http.get<Movement[]>(`${API_BASE_URL}/movements`)),
        firstValueFrom(this.http.get<string[]>(`${API_BASE_URL}/categories`)),
        firstValueFrom(this.http.get<AuditLog[]>(`${API_BASE_URL}/auditlogs`)),
        firstValueFrom(this.http.get<PurchaseOrder[]>(`${API_BASE_URL}/purchaseorders`)),
        firstValueFrom(this.http.get<PickingList[]>(`${API_BASE_URL}/pickinglists`)),
      ]);
      return { items, redShelfItems, technicians, suppliers, movements, categories, auditLogs, purchaseOrders, pickingLists };
    } catch (error) {
      console.error('Failed to load initial data from backend', error);
      // Retorna um estado vazio para não quebrar a UI.
      return { items: [], redShelfItems: [], technicians: [], suppliers: [], movements: [], categories: [], auditLogs: [], purchaseOrders: [], pickingLists: [] };
    }
  }

  replaceAllData(db: AlmoxarifadoDB): Promise<void> {
    // A implementação real dependeria de um endpoint de API específico para restauração.
    // Ex: return firstValueFrom(this.http.post<void>(`${API_BASE_URL}/database/restore`, db));
    console.warn('HttpProvider.replaceAllData is not implemented.');
    return Promise.resolve();
  }

  addItem<T extends { id: string }>(collection: CollectionWithId, item: CreationPayload<T>): Promise<T> {
    return firstValueFrom(this.http.post<T>(`${API_BASE_URL}/${collection}`, item));
  }

  updateItem<T extends { id: string }>(collection: CollectionWithId, updatedItem: T): Promise<T> {
    return firstValueFrom(this.http.put<T>(`${API_BASE_URL}/${collection}/${updatedItem.id}`, updatedItem));
  }

  updateMultipleItems<T extends { id: string }>(collection: CollectionWithId, updatedItems: T[]): Promise<T[]> {
      // O backend deve ter um endpoint para atualizações em lote.
      return firstValueFrom(this.http.put<T[]>(`${API_BASE_URL}/${collection}/bulk`, updatedItems));
  }

  deleteItem(collection: CollectionWithId, id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${API_BASE_URL}/${collection}/${id}`));
  }

  deleteMultipleItems(collection: CollectionWithId, ids: string[]): Promise<void> {
    // O backend deve ser configurado para aceitar um array de IDs no corpo da requisição DELETE.
    return firstValueFrom(this.http.delete<void>(`${API_BASE_URL}/${collection}`, { body: ids }));
  }
  
  addMultipleItems(itemsToAdd: (Omit<Item, "id" | "createdAt">)[], isRedShelf: boolean): Promise<Item[]> {
      const endpoint = isRedShelf ? 'redshelfitems/bulk' : 'items/bulk';
      return firstValueFrom(this.http.post<Item[]>(`${API_BASE_URL}/${endpoint}`, itemsToAdd));
  }

  logAction(action: string, details: string, user: string): Promise<AuditLog> {
    return firstValueFrom(this.http.post<AuditLog>(`${API_BASE_URL}/auditlogs`, { action, details, user }));
  }

  addCategory(categoryName: string, existingCategories: string[]): Promise<string[]> {
      return firstValueFrom(this.http.post<string[]>(`${API_BASE_URL}/categories`, { name: categoryName }));
  }

  addCategories(categoryNames: string[], existingCategories: string[]): Promise<string[]> {
    // O backend receberá uma lista de nomes e deve retornar a lista completa e atualizada de categorias.
    return firstValueFrom(this.http.post<string[]>(`${API_BASE_URL}/categories/bulk`, { names: categoryNames }));
  }

  deleteCategory(categoryToDelete: string, currentDb: AlmoxarifadoDB): Promise<{ updatedItems: Item[]; updatedRedShelfItems: RedShelfItem[]; updatedCategories: string[]; } | null> {
      // A lógica de mover itens para "Outros" é uma responsabilidade do backend.
      return firstValueFrom(this.http.delete<{ updatedItems: Item[]; updatedRedShelfItems: RedShelfItem[], updatedCategories: string[]; }>(`${API_BASE_URL}/categories/${encodeURIComponent(categoryToDelete)}`));
  }

  addMovement(movementData: Omit<Movement, 'id'>): Promise<{ success: boolean; message: string; newMovement?: Movement; updatedItem?: Item | RedShelfItem; }> {
    return firstValueFrom(this.http.post<{ success: boolean; message: string; newMovement?: Movement; updatedItem?: Item | RedShelfItem; }>(`${API_BASE_URL}/movements`, movementData))
      .catch((err: HttpErrorResponse) => ({ success: false, message: err.error?.message || 'Erro ao registrar movimento.' }));
  }

  adjustItemQuantity(itemId: string, newQuantity: number, notes: string, isRedShelf: boolean): Promise<{ updatedItem: Item | RedShelfItem; newMovement: Movement; }> {
    const payload = { newQuantity, notes, isRedShelf };
    return firstValueFrom(this.http.post<{ updatedItem: Item | RedShelfItem; newMovement: Movement; }>(`${API_BASE_URL}/items/${itemId}/adjust`, payload));
  }
}
*/