
import { Component, ChangeDetectionStrategy, inject, computed, signal, input, effect, viewChild, ElementRef, OnDestroy, output, viewChildren, Signal, WritableSignal } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators, FormControl } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged, tap } from 'rxjs/operators';
import { DatabaseService } from './services/database.service';
import { ToastService } from './services/toast.service';
import { GeminiService } from './services/gemini.service';
import { Item, SearchFilter, Supplier, Movement, ParsedInvoiceItem, View, AlmoxarifadoDB } from './models';
import { ImageRecognitionComponent } from './components/image-recognition.component';
import { InvoiceRecognitionComponent } from './components/invoice-recognition.component';

declare var JsBarcode: any;
declare var html2canvas: any;
declare var jspdf: any;

type ItemForm = Omit<Item, 'id' | 'createdAt'> & { id?: string };
interface AiSuggestion {
  description: string;
  category: string;
  reorderPoint: {
    suggestion: number;
    reasoning: string;
  } | null;
}

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [
    CommonModule, 
    ReactiveFormsModule, 
    CurrencyPipe, 
    DatePipe, 
    ImageRecognitionComponent, 
    InvoiceRecognitionComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-4 sm:p-6 h-full flex flex-col">
      <header class="flex justify-between items-start mb-4 gap-2 flex-wrap">
        <div>
            <h2 class="text-2xl font-bold">Inventário</h2>
            <p class="text-sm text-slate-500 dark:text-slate-400">Gerencie e adicione novos tipos de itens ao seu estoque.</p>
        </div>
        <div class="flex gap-2 flex-wrap">
           @if (selectedItemIds().size > 0) {
            <button (click)="openDeleteMultipleConfirm()" class="bg-error text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors">
              Excluir Selecionados ({{ selectedItemIds().size }})
            </button>
          } @else {
            <button (click)="openPrintAllModal()" class="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors">
              Gerar Todas as Etiquetas
            </button>
            <button (click)="openBatchForm()" class="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors">
              Adicionar em Lote
            </button>
             <button (click)="isImageRecognitionOpen.set(true)" class="bg-sky-600 text-white px-4 py-2 rounded-md hover:bg-sky-700 transition-colors flex items-center gap-2">
              Item por Foto 📸
            </button>
            <button (click)="isInvoiceRecognitionOpen.set(true)" class="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 transition-colors flex items-center gap-2">
              Via Nota Fiscal 🧾
            </button>
            <button (click)="openItemForm()" class="bg-accent text-white px-4 py-2 rounded-md hover:bg-info transition-colors">
              + Adicionar Item
            </button>
          }
        </div>
      </header>
      
      <!-- Filters -->
      <div class="bg-slate-50 dark:bg-primary/50 p-3 rounded-lg mb-4 border border-slate-200 dark:border-secondary">
        <div class="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div class="md:col-span-2">
            <label class="block text-sm font-medium mb-1">Busca Rápida ou IA</label>
            <div class="relative w-full">
              <input 
                type="text" 
                placeholder="Busque por nome ou use a IA..." 
                class="bg-white dark:bg-secondary p-2 pr-10 rounded-md border border-slate-300 dark:border-slate-600 focus:border-accent focus:outline-none w-full"
                [formControl]="searchControl"
              />
              @if(isAiSearching()) {
                  <div class="absolute right-3 top-1/2 -translate-y-1/2">
                      <div class="w-5 h-5 border-2 border-slate-400 border-t-accent rounded-full animate-spin"></div>
                  </div>
              }
            </div>
          </div>
          <div [formGroup]="filterForm" class="md:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label class="block text-sm font-medium mb-1">Categoria</label>
              <select formControlName="category" class="w-full bg-white dark:bg-secondary p-2 rounded-md border border-slate-300 dark:border-slate-600">
                <option value="">Todas</option>
                @for (cat of db().categories; track cat) { <option [value]="cat">{{cat}}</option> }
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Fornecedor</label>
              <select formControlName="supplierId" class="w-full bg-white dark:bg-secondary p-2 rounded-md border border-slate-300 dark:border-slate-600">
                <option value="">Todos</option>
                @for (sup of db().suppliers; track sup.id) { <option [value]="sup.id">{{sup.name}}</option> }
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Estoque</label>
              <select formControlName="stockStatus" class="w-full bg-white dark:bg-secondary p-2 rounded-md border border-slate-300 dark:border-slate-600">
                <option value="">Qualquer</option>
                <option value="ok">OK</option>
                <option value="low">Baixo</option>
                <option value="empty">Vazio</option>
              </select>
            </div>
          </div>
        </div>
        @if (aiFilterPills().length > 0) {
          <div class="flex items-center gap-2 mt-2 flex-wrap border-t border-slate-200 dark:border-secondary pt-2">
            <span class="text-sm font-semibold text-slate-600 dark:text-slate-300">Filtros da IA:</span>
            @for (pill of aiFilterPills(); track pill.key) {
              @if(pill.isSeparator) {
                <span class="text-sm font-bold text-slate-500 dark:text-slate-400">{{ pill.label }}</span>
              } @else {
                <span class="bg-sky-100 dark:bg-sky-900 text-sky-800 dark:text-sky-200 text-xs font-medium px-2.5 py-1 rounded-full">
                  {{ pill.label }}
                </span>
              }
            }
            <button (click)="clearAiFilters()" class="text-accent dark:text-sky-400 hover:underline text-sm ml-2">
              Limpar Filtros IA
            </button>
          </div>
        }
      </div>

      <!-- Inventory Content -->
      <div class="flex-grow overflow-auto">
        <!-- Table for Medium and up -->
        <table class="w-full text-left hidden md:table">
          <thead class="sticky top-0 bg-slate-50 dark:bg-secondary">
            <tr class="border-b border-slate-200 dark:border-slate-600">
              <th class="p-3 w-12 text-center">
                <input 
                  type="checkbox" 
                  class="h-4 w-4 rounded text-accent focus:ring-accent"
                  [checked]="isAllOnPageSelected()"
                  (change)="toggleSelectAllOnPage()"
                />
              </th>
              <th class="p-3 cursor-pointer" (click)="handleSort('name')">
                Nome
                @if (sortColumn() === 'name') {
                  <span class="ml-1">{{ sortDirection() === 'asc' ? '▲' : '▼' }}</span>
                }
              </th>
              <th class="p-3 cursor-pointer" (click)="handleSort('category')">
                Categoria
                 @if (sortColumn() === 'category') {
                  <span class="ml-1">{{ sortDirection() === 'asc' ? '▲' : '▼' }}</span>
                }
              </th>
              <th class="p-3 cursor-pointer" (click)="handleSort('quantity')">
                Quantidade
                 @if (sortColumn() === 'quantity') {
                  <span class="ml-1">{{ sortDirection() === 'asc' ? '▲' : '▼' }}</span>
                }
              </th>
              <th class="p-3 cursor-pointer" (click)="handleSort('reorderPoint')">
                Ponto Ressup.
                @if (sortColumn() === 'reorderPoint') {
                  <span class="ml-1">{{ sortDirection() === 'asc' ? '▲' : '▼' }}</span>
                }
              </th>
              <th class="p-3">Fornecedor Pref.</th>
              <th class="p-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            @for(item of paginatedItems(); track item.id) {
              <tr 
                class="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-primary"
                [class.bg-sky-50]="selectedItemIds().has(item.id)" 
                [class.dark:bg-sky-900/20]="selectedItemIds().has(item.id)">
                <td class="p-3 text-center">
                  <input 
                    type="checkbox"
                    class="h-4 w-4 rounded text-accent focus:ring-accent"
                    [checked]="selectedItemIds().has(item.id)"
                    (change)="toggleSelection(item.id)"
                  />
                </td>
                <td class="p-3">{{ item.name }}</td>
                <td class="p-3">{{ item.category }}</td>
                <td class="p-3">
                  <span 
                    [class.text-error]="item.quantity <= item.reorderPoint && item.quantity > 0"
                    [class.text-red-700]="item.quantity === 0">
                    {{ item.quantity }}
                  </span>
                </td>
                <td class="p-3">{{ item.reorderPoint }}</td>
                <td class="p-3">{{ getSupplierName(item.preferredSupplierId) }}</td>
                <td class="p-3 flex items-center space-x-2">
                   <button (click)="viewLifecycle(item)" class="p-1 text-slate-500 dark:text-slate-300 hover:text-accent" title="Ciclo de Vida do Item">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd" /></svg>
                  </button>
                  <button (click)="openAdjustmentModal(item)" class="p-1 text-slate-500 dark:text-slate-300 hover:text-accent" title="Ajustar Estoque">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fill-rule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clip-rule="evenodd" /></svg>
                  </button>
                  <button (click)="openPrintLabelModal(item)" class="p-1 text-slate-500 dark:text-slate-300 hover:text-accent" title="Imprimir Etiqueta">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M1 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1H2a1 1 0 01-1-1V4zM6 3a1 1 0 011 1v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1h1zM11 3a1 1 0 011 1v4a1 1 0 01-2 0V4a1 1 0 011-1zM10 9a1 1 0 011 1v6a1 1 0 01-2 0v-6a1 1 0 011-1zM15 3a1 1 0 011 1v12a1 1 0 01-2 0V4a1 1 0 011-1z"/></svg>
                  </button>
                  <button (click)="openItemForm(item)" class="p-1 text-slate-500 dark:text-slate-300 hover:text-accent" title="Editar Item">✏️</button>
                  <button (click)="openDeleteConfirm(item)" class="p-1 text-slate-500 dark:text-slate-300 hover:text-error" title="Excluir Item">🗑️</button>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="7" class="p-4 text-center text-slate-500 dark:text-slate-400">Nenhum item encontrado.</td>
              </tr>
            }
          </tbody>
        </table>

        <!-- Card List for Mobile -->
        <div class="md:hidden space-y-3">
            @for(item of paginatedItems(); track item.id) {
              <div class="bg-white dark:bg-secondary rounded-lg p-4 shadow flex gap-3 items-start" [class.bg-sky-50]="selectedItemIds().has(item.id)" [class.dark:bg-sky-900/20]="selectedItemIds().has(item.id)">
                 <div>
                    <input 
                      type="checkbox"
                      class="h-5 w-5 rounded text-accent focus:ring-accent mt-1"
                      [checked]="selectedItemIds().has(item.id)"
                      (change)="toggleSelection(item.id)"
                    />
                  </div>
                <div class="flex-grow">
                  <div class="flex justify-between items-start">
                    <div>
                      <p class="font-bold text-slate-800 dark:text-slate-100">{{ item.name }}</p>
                      <p class="text-sm text-slate-500 dark:text-slate-400">{{ item.category }}</p>
                    </div>
                    <div class="flex items-center space-x-2 flex-shrink-0">
                      <button (click)="viewLifecycle(item)" class="p-1 text-slate-500 dark:text-slate-300 hover:text-accent" title="Histórico">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd" /></svg>
                      </button>
                       <button (click)="openPrintLabelModal(item)" class="p-1 text-slate-500 dark:text-slate-300 hover:text-accent" title="Imprimir Etiqueta">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M1 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1H2a1 1 0 01-1-1V4zM6 3a1 1 0 011 1v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1h1zM11 3a1 1 0 011 1v4a1 1 0 01-2 0V4a1 1 0 011-1zM10 9a1 1 0 011 1v6a1 1 0 01-2 0v-6a1 1 0 011-1zM15 3a1 1 0 011 1v12a1 1 0 01-2 0V4a1 1 0 011-1z"/></svg>
                      </button>
                      <button (click)="openItemForm(item)" class="p-1 text-slate-500 dark:text-slate-300 hover:text-accent" title="Editar">✏️</button>
                      <button (click)="openDeleteConfirm(item)" class="p-1 text-slate-500 dark:text-slate-300 hover:text-error" title="Excluir">🗑️</button>
                    </div>
                  </div>
                  <div class="mt-4 grid grid-cols-2 gap-4 items-baseline">
                    <div>
                      <p class="text-sm text-slate-600 dark:text-slate-300">Fornecedor Pref.: <span class="font-medium">{{ getSupplierName(item.preferredSupplierId) }}</span></p>
                      <p class="text-sm text-slate-500 dark:text-slate-400">Ponto Ressup.: <span class="font-medium">{{ item.reorderPoint }}</span></p>
                    </div>
                    <div class="text-right">
                      <p class="text-lg font-bold" [class.text-error]="item.quantity <= item.reorderPoint">
                        {{ item.quantity }} <span class="text-sm font-normal text-slate-500 dark:text-slate-400">un.</span>
                      </p>
                      <button (click)="openAdjustmentModal(item)" class="text-xs text-accent dark:text-sky-400 hover:underline cursor-pointer">Ajustar</button>
                    </div>
                  </div>
                </div>
              </div>
            } @empty {
              <div class="p-4 text-center text-slate-500 dark:text-slate-400 bg-white dark:bg-secondary rounded-lg">Nenhum item encontrado.</div>
            }
        </div>
      </div>

      <!-- Pagination -->
      <div class="flex justify-between items-center pt-4">
        <span class="text-sm text-slate-500 dark:text-slate-400">
          Mostrando {{ paginatedItems().length }} de {{ sortedItems().length }} itens
        </span>
        <div class="flex gap-2">
          <button [disabled]="currentPage() === 1" (click)="prevPage()" class="px-3 py-1 bg-white dark:bg-secondary rounded disabled:opacity-50">Anterior</button>
          <button [disabled]="currentPage() === totalPages()" (click)="nextPage()" class="px-3 py-1 bg-white dark:bg-secondary rounded disabled:opacity-50">Próximo</button>
        </div>
      </div>
    </div>

    <!-- Item Form Modal -->
    @if (isFormOpen()) {
      <div class="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-40">
        <div class="bg-white dark:bg-primary p-6 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
          <h3 class="text-xl font-bold mb-4">{{ currentItem()?.id ? 'Editar' : 'Adicionar' }} Item</h3>
          <form [formGroup]="itemForm" (ngSubmit)="saveItem()" class="flex-grow overflow-y-auto pr-2">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm mb-1">Nome</label>
                  <input type="text" formControlName="name" class="w-full bg-slate-100 dark:bg-secondary p-2 rounded" />
                </div>
                <div>
                    <label class="block text-sm mb-1">Categoria</label>
                    <div class="flex items-start gap-2">
                        <div class="flex-grow">
                          <select formControlName="category" class="w-full bg-slate-100 dark:bg-secondary p-2 rounded">
                              @for (cat of db().categories; track cat) {
                                  <option [value]="cat">{{cat}}</option>
                              }
                          </select>
                           @if(aiSuggestions().category) {
                              <div class="mt-2 text-sm">
                                <button type="button" (click)="applySuggestion('category')" class="bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200 px-2 py-1 rounded-md hover:bg-sky-200 w-full text-left">
                                  Usar sugestão: <span class="font-bold">{{ aiSuggestions().category }}</span>
                                </button>
                              </div>
                            }
                        </div>
                        <button type="button" [disabled]="!geminiService.isConfigured() || !itemForm.value.name || isAiLoading()" (click)="suggestCategory()" class="p-2 bg-accent rounded disabled:opacity-50 shrink-0" title="Sugerir Categoria com IA">
                           @if(isAiLoading()) {
                                <div class="w-5 h-5 border-2 border-slate-400 border-t-white rounded-full animate-spin"></div>
                           } @else { <span>✨</span> }
                        </button>
                    </div>
                </div>
                @if (!currentItem()?.id) {
                    <div class="md:col-span-2">
                      <label class="block text-sm mb-1">Qtd. Inicial (Opcional)</label>
                      <input type="number" formControlName="quantity" class="w-full bg-slate-100 dark:bg-secondary p-2 rounded" />
                    </div>
                }
                <div>
                  <label class="block text-sm mb-1">Preço (R$)</label>
                  <input type="number" formControlName="price" class="w-full bg-slate-100 dark:bg-secondary p-2 rounded" />
                </div>
                <div>
                  <label class="block text-sm mb-1">Fornecedor Preferencial</label>
                  <select formControlName="preferredSupplierId" class="w-full bg-slate-100 dark:bg-secondary p-2 rounded">
                    <option [ngValue]="null">Nenhum</option>
                    @for(supplier of db().suppliers; track supplier.id) {
                      <option [value]="supplier.id">{{ supplier.name }}</option>
                    }
                  </select>
                </div>
                <div class="md:col-span-2">
                  <label class="block text-sm mb-1">Descrição</label>
                   <div class="flex items-start gap-2">
                        <div class="flex-grow">
                           <textarea formControlName="description" rows="3" class="w-full bg-slate-100 dark:bg-secondary p-2 rounded"></textarea>
                            @if(aiSuggestions().description) {
                              <div class="mt-2 text-sm p-2 bg-slate-100 dark:bg-secondary rounded">
                                  <p class="font-semibold mb-1">Sugestão da IA:</p>
                                  <p class="italic text-slate-600 dark:text-slate-300 mb-2">"{{ aiSuggestions().description }}"</p>
                                  <button type="button" (click)="applySuggestion('description')" class="bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200 px-2 py-1 rounded-md hover:bg-sky-200 text-xs">
                                    Usar esta descrição
                                  </button>
                              </div>
                            }
                        </div>
                        <button type="button" [disabled]="!geminiService.isConfigured() || !itemForm.value.name || isAiLoading()" (click)="generateDescription()" class="p-2 bg-accent rounded self-start disabled:opacity-50 shrink-0" title="Gerar Descrição com IA">
                          @if(isAiLoading()) {
                                <div class="w-5 h-5 border-2 border-slate-400 border-t-white rounded-full animate-spin"></div>
                           } @else { <span>✍️</span> }
                        </button>
                   </div>
                </div>
                <div class="md:col-span-2">
                    <label class="block text-sm mb-1">Ponto de Ressuprimento</label>
                    <div class="flex items-start gap-2">
                        <div class="flex-grow">
                           <input type="number" formControlName="reorderPoint" class="w-full bg-slate-100 dark:bg-secondary p-2 rounded" />
                           @if(aiSuggestions().reorderPoint; as rp) {
                                <div class="mt-2 text-sm p-2 bg-slate-100 dark:bg-secondary rounded">
                                    <p class="font-semibold mb-1">Sugestão da IA: <button type="button" (click)="applySuggestion('reorderPoint')" class="font-bold text-accent hover:underline">{{ rp.suggestion }}</button></p>
                                    <p class="text-xs text-slate-500 dark:text-slate-400">{{ rp.reasoning }}</p>
                                </div>
                            }
                        </div>
                        <button type="button" [disabled]="!geminiService.isConfigured() || !currentItem()?.id || isAiLoading()" (click)="suggestReorderPoint()" class="p-2 bg-accent rounded disabled:opacity-50 shrink-0" title="Sugerir Ponto de Ressuprimento com IA">
                           @if(isAiLoading()) {
                                <div class="w-5 h-5 border-2 border-slate-400 border-t-white rounded-full animate-spin"></div>
                           } @else {
                                <span>🧠</span>
                           }
                        </button>
                    </div>
                </div>
            </div>
            
            <div class="flex justify-end gap-4 mt-6 pt-4 border-t border-slate-200 dark:border-secondary">
              <button type="button" (click)="closeItemForm()" class="px-4 py-2 bg-slate-200 dark:bg-secondary rounded">Cancelar</button>
              <button type="submit" [disabled]="itemForm.invalid" class="px-4 py-2 bg-accent text-white rounded disabled:opacity-50">Salvar</button>
            </div>
          </form>
        </div>
      </div>
    }

    <!-- Delete Confirmation Modal -->
    @if (itemToDelete()) {
      <div class="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
        <div class="bg-white dark:bg-primary p-6 rounded-lg shadow-xl w-full max-w-md">
          <h3 class="text-xl font-bold mb-4">Confirmar Exclusão</h3>
          <p>Tem certeza que deseja excluir o item "{{ itemToDelete()?.name }}"? Esta ação não pode ser desfeita.</p>
          <div class="flex justify-end gap-4 mt-6">
            <button (click)="itemToDelete.set(null)" class="px-4 py-2 bg-slate-200 dark:bg-secondary rounded">Cancelar</button>
            <button (click)="deleteItem()" class="px-4 py-2 bg-error text-white rounded">Excluir</button>
          </div>
        </div>
      </div>
    }

    <!-- Multiple Delete Confirmation Modal -->
    @if (isDeleteMultipleConfirmOpen()) {
      <div class="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
        <div class="bg-white dark:bg-primary p-6 rounded-lg shadow-xl w-full max-w-md">
          <h3 class="text-xl font-bold mb-4">Confirmar Exclusão em Massa</h3>
          <p>Tem certeza que deseja excluir os <strong>{{ selectedItemIds().size }}</strong> itens selecionados? Esta ação não pode ser desfeita.</p>
          <div class="flex justify-end gap-4 mt-6">
            <button (click)="isDeleteMultipleConfirmOpen.set(false)" class="px-4 py-2 bg-slate-200 dark:bg-secondary rounded">Cancelar</button>
            <button (click)="deleteSelectedItems()" class="px-4 py-2 bg-error text-white rounded">Excluir {{ selectedItemIds().size }} Itens</button>
          </div>
        </div>
      </div>
    }

    <!-- Batch Add Items Modal -->
    @if (isBatchFormOpen()) {
      <div class="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
        <div class="bg-white dark:bg-primary p-6 rounded-lg shadow-xl w-full max-w-7xl max-h-[90vh] flex flex-col">
          <div class="flex justify-between items-start">
            <div>
              <h3 class="text-xl font-bold mb-4">Adicionar Itens em Lote</h3>
              <p class="text-sm text-slate-500 dark:text-slate-400 mb-4">Preencha os campos. Você pode copiar e colar colunas de uma planilha (ex: Excel) diretamente aqui. Nome e Categoria são obrigatórios. Novas categorias serão criadas automaticamente.</p>
            </div>
             <div class="flex gap-2">
              <button (click)="downloadCsvTemplate()" class="bg-slate-200 text-slate-800 dark:bg-secondary dark:text-white px-4 py-2 rounded-md hover:bg-slate-300 dark:hover:bg-primary transition-colors text-sm">
                Baixar Modelo
              </button>
              <button (click)="csvInput.click()" class="bg-slate-200 text-slate-800 dark:bg-secondary dark:text-white px-4 py-2 rounded-md hover:bg-slate-300 dark:hover:bg-primary transition-colors text-sm">
                Importar CSV
              </button>
              <input type="file" #csvInput hidden accept=".csv" (change)="handleCsvFile($event)" />
            </div>
          </div>
          
          <form [formGroup]="batchForm" class="flex-grow overflow-auto pr-2">
            <table class="w-full text-left text-sm table-fixed">
              <thead class="sticky top-0 bg-slate-100 dark:bg-secondary">
                <tr>
                  <th class="p-2 w-[18%]">Nome*</th>
                  <th class="p-2 w-[12%]">Categoria*</th>
                  <th class="p-2 w-[22%]">Descrição</th>
                  <th class="p-2 w-[8%]">Preço</th>
                  <th class="p-2 w-[12%]">Fornecedor (CNPJ)</th>
                  <th class="p-2 w-[8%]">Ponto Ressup.</th>
                  <th class="p-2 w-[8%]">Quantidade*</th>
                  <th class="p-2 w-[48px]"></th>
                </tr>
              </thead>
              <tbody formArrayName="items">
                @for(itemGroup of batchItemsArray.controls; track $index) {
                  <tr [formGroupName]="$index" class="border-b border-slate-200 dark:border-slate-700 align-top" [class.bg-red-100]="itemGroup.invalid && itemGroup.touched" [class.dark:bg-red-900/20]="itemGroup.invalid && itemGroup.touched">
                    <td class="p-1">
                      <input type="text" formControlName="name" (paste)="onBatchPaste($event, $index, 'name')" class="w-full bg-transparent p-1 rounded focus:outline-none focus:bg-slate-100 dark:focus:bg-secondary">
                      @if(itemGroup.errors?.message) { <small class="text-error px-1">{{itemGroup.errors.message}}</small> }
                    </td>
                    <td class="p-1"><input type="text" formControlName="category" (paste)="onBatchPaste($event, $index, 'category')" list="category-datalist" class="w-full bg-transparent p-1 rounded focus:outline-none focus:bg-slate-100 dark:focus:bg-secondary"></td>
                    <td class="p-1"><input type="text" formControlName="description" (paste)="onBatchPaste($event, $index, 'description')" class="w-full bg-transparent p-1 rounded focus:outline-none focus:bg-slate-100 dark:focus:bg-secondary"></td>
                    <td class="p-1"><input type="number" formControlName="price" (paste)="onBatchPaste($event, $index, 'price')" min="0" step="0.01" class="w-full bg-transparent p-1 rounded focus:outline-none focus:bg-slate-100 dark:focus:bg-secondary"></td>
                    <td class="p-1"><input type="text" formControlName="supplierCnpj" (paste)="onBatchPaste($event, $index, 'supplierCnpj')" class="w-full bg-transparent p-1 rounded focus:outline-none focus:bg-slate-100 dark:focus:bg-secondary"></td>
                    <td class="p-1"><input type="number" formControlName="reorderPoint" (paste)="onBatchPaste($event, $index, 'reorderPoint')" min="0" class="w-full bg-transparent p-1 rounded focus:outline-none focus:bg-slate-100 dark:focus:bg-secondary"></td>
                    <td class="p-1"><input type="number" formControlName="quantity" (paste)="onBatchPaste($event, $index, 'quantity')" min="0" class="w-full bg-transparent p-1 rounded focus:outline-none focus:bg-slate-100 dark:focus:bg-secondary"></td>
                    <td class="p-1 text-center">
                      <button type="button" (click)="removeBatchRow($index)" class="p-1 text-slate-400 hover:text-error transition-colors" title="Remover Linha">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" /></svg>
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </form>
            <datalist id="category-datalist">
              @for (cat of db().categories; track cat) {
                <option [value]="cat"></option>
              }
            </datalist>
          
          <div class="flex justify-between items-center mt-6 pt-4 border-t border-slate-200 dark:border-secondary">
            <button type="button" (click)="addBatchRow()" class="px-4 py-2 bg-slate-200 dark:bg-secondary rounded hover:bg-slate-300 dark:hover:bg-primary transition-colors">+ Adicionar Linha</button>
            <div>
              <button type="button" (click)="isBatchFormOpen.set(false)" class="px-4 py-2 bg-slate-200 dark:bg-secondary rounded">Cancelar</button>
              <button type="button" (click)="saveBatchItems()" class="px-4 py-2 bg-accent text-white rounded ml-2">Salvar Itens</button>
            </div>
          </div>
        </div>
      </div>
    }

    <!-- Stock Adjustment Modal -->
    @if (isAdjustmentModalOpen() && itemForAdjustment(); as item) {
      <div class="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
        <div class="bg-white dark:bg-primary p-6 rounded-lg shadow-xl w-full max-w-md">
            <h3 class="text-xl font-bold">Ajustar Estoque: {{ item.name }}</h3>
            <p class="text-sm text-slate-500 dark:text-slate-400 mb-4">Estoque atual: {{ item.quantity }}</p>
            <form [formGroup]="adjustmentForm" (ngSubmit)="saveAdjustment()">
              <div class="space-y-4">
                  <input type="number" formControlName="newQuantity" placeholder="Nova Quantidade" class="w-full bg-slate-100 dark:bg-secondary p-2 rounded" />
                  <input type="text" formControlName="notes" placeholder="Motivo do Ajuste" class="w-full bg-slate-100 dark:bg-secondary p-2 rounded" />
              </div>
              <div class="flex justify-end gap-4 mt-6 pt-4 border-t border-slate-200 dark:border-secondary">
                  <button type="button" (click)="isAdjustmentModalOpen.set(false)" class="px-4 py-2 bg-slate-200 dark:bg-secondary rounded">Cancelar</button>
                  <button type="submit" [disabled]="adjustmentForm.invalid" class="px-4 py-2 bg-amber-600 text-white p-2 rounded disabled:opacity-50">Salvar Ajuste</button>
              </div>
            </form>
        </div>
      </div>
    }

    <!-- Image Recognition Modal -->
    @if (isImageRecognitionOpen()) {
      <app-image-recognition 
        (itemRecognized)="handleItemRecognized($event)"
        (close)="isImageRecognitionOpen.set(false)"
      />
    }

    <!-- Invoice Recognition Modal -->
    @if (isInvoiceRecognitionOpen()) {
        <app-invoice-recognition
            (invoiceRecognized)="handleInvoiceRecognized($event)"
            (close)="isInvoiceRecognitionOpen.set(false)"
        />
    }

    <!-- Print Label Modal -->
    @if (itemToPrintLabel(); as item) {
      <div class="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
        <div class="bg-white dark:bg-primary p-6 rounded-lg shadow-xl w-full max-w-sm">
          <h3 class="text-xl font-bold mb-4">Etiqueta de Código de Barras</h3>
          
          <div #printArea class="text-center p-4 border border-dashed border-slate-300 dark:border-secondary rounded-lg bg-white text-black">
            <p class="font-bold text-lg mb-2 break-words">{{ item.name }}</p>
            <svg #barcodeElement></svg>
          </div>
          
          <div class="flex justify-end gap-4 mt-6">
            <button (click)="itemToPrintLabel.set(null)" class="px-4 py-2 bg-slate-200 dark:bg-secondary rounded">Cancelar</button>
            <button (click)="printLabel()" class="px-4 py-2 bg-accent text-white rounded">Imprimir</button>
          </div>
        </div>
      </div>
    }

    <!-- Print All Labels Modal -->
    @if (isPrintAllModalOpen()) {
      <div class="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
        <div class="bg-white dark:bg-primary p-6 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
          <div class="flex justify-between items-center mb-4 no-print">
            <h3 class="text-xl font-bold">Imprimir Todas as Etiquetas</h3>
            <div>
              <button (click)="isPrintAllModalOpen.set(false)" class="px-4 py-2 bg-slate-200 dark:bg-secondary rounded">Cancelar</button>
              <button (click)="printAllLabels()" [disabled]="isGeneratingPdf()" class="ml-2 px-4 py-2 bg-accent text-white rounded w-32 flex items-center justify-center">
                  @if(isGeneratingPdf()) {
                      <div class="w-5 h-5 border-2 border-slate-400 border-t-white rounded-full animate-spin"></div>
                  } @else {
                      <span>Gerar PDF</span>
                  }
              </button>
            </div>
          </div>
          <div class="overflow-y-auto printable-area">
            <div class="grid grid-cols-3 gap-4">
              @for(item of items(); track item.id) {
                <div class="text-center p-2 border border-dashed border-slate-300 dark:border-secondary rounded-lg bg-white text-black break-inside-avoid">
                  <p class="font-bold text-sm mb-1 break-words">{{ item.name }}</p>
                  <svg #allBarcodeElements></svg>
                </div>
              }
            </div>
          </div>
        </div>
      </div>
    }
  `,
})
export class InventoryComponent implements OnDestroy {
  navigateTo = output<View>();
  
  private dbService = inject(DatabaseService);
  private toastService = inject(ToastService);
  geminiService = inject(GeminiService);
  private fb = inject(FormBuilder);
  db: Signal<AlmoxarifadoDB> = this.dbService.db;

  searchControl = new FormControl('');
  filterForm: FormGroup;
  
  currentPage = signal(1);
  itemsPerPage = 10;
  sortColumn: WritableSignal<keyof Item | ''> = signal<keyof Item | ''>('');
  sortDirection = signal<'asc' | 'desc'>('asc');

  isFormOpen = signal(false);
  currentItem = signal<Item | null>(null);
  itemToDelete = signal<Item | null>(null);
  selectedItemIds = signal(new Set<string>());
  isDeleteMultipleConfirmOpen = signal(false);
  isPrintAllModalOpen = signal(false);
  isGeneratingPdf = signal(false);

  itemForm!: FormGroup;
  batchForm!: FormGroup;
  adjustmentForm!: FormGroup;

  isBatchFormOpen = signal(false);
  isAdjustmentModalOpen = signal(false);
  itemForAdjustment = signal<Item | null>(null);
  isImageRecognitionOpen = signal(false);
  isInvoiceRecognitionOpen = signal(false);

  itemToPrintLabel = signal<Item | null>(null);
  printArea = viewChild<ElementRef<HTMLDivElement>>('printArea');
  barcodeElement = viewChild<ElementRef<SVGElement>>('barcodeElement');
  allBarcodeElements = viewChildren<ElementRef<SVGElement>>('allBarcodeElements');
  csvInput = viewChild<ElementRef<HTMLInputElement>>('csvInput');

  items = computed(() => this.db().items);

  isAiSearching = signal(false);
  isAiLoading = signal(false);
  aiFilter = signal<SearchFilter[] | null>(null);
  aiSuggestions = signal<AiSuggestion>({ description: '', category: '', reorderPoint: null });

  private destroy$ = new Subject<void>();
  private searchTerm = signal('');
  private advancedFilters = signal({ category: '', supplierId: '', stockStatus: '' });

  constructor() {
    this.filterForm = this.fb.group({
      category: [''],
      supplierId: [''],
      stockStatus: ['']
    });

    // --- Reactive Filtering Setup ---
    const search$ = this.searchControl.valueChanges.pipe(
      takeUntil(this.destroy$),
      distinctUntilChanged()
    );

    search$.subscribe(val => {
      this.searchTerm.set(val?.toLowerCase() ?? '');
      this.currentPage.set(1);
    });

    search$.pipe(
      debounceTime(500),
    ).subscribe(async (term) => {
      const trimmedTerm = term?.trim() ?? '';

      if (!trimmedTerm || trimmedTerm.length < 4 || !trimmedTerm.includes(' ') || !this.geminiService.isConfigured()) {
        if (this.aiFilter() !== null) this.aiFilter.set(null);
        this.isAiSearching.set(false);
        return;
      }

      this.isAiSearching.set(true);
      const filter = await this.geminiService.parseSearchQuery(trimmedTerm, this.db().suppliers);
      
      if ((this.searchControl.value?.trim() ?? '') === trimmedTerm) {
        this.aiFilter.set(filter);
        this.isAiSearching.set(false);
      }
    });
    
    this.filterForm.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(values => {
        this.advancedFilters.set(values as any);
        this.currentPage.set(1);
      });
    // --- End Reactive Filtering Setup ---

    effect(() => {
      this.paginatedItems();
      this.selectedItemIds.set(new Set<string>());
    }, { allowSignalWrites: true });

    effect(() => {
      const item = this.itemToPrintLabel();
      const element = this.barcodeElement();
      if (item && element) {
        setTimeout(() => {
          try {
            JsBarcode(element.nativeElement, item.id, { format: "CODE128", displayValue: true, fontSize: 14, margin: 10, height: 50 });
          } catch (e) { console.error("JsBarcode error:", e); }
        }, 0);
      }
    });

    effect(() => {
      const elements = this.allBarcodeElements();
      const items = this.items();
      if (this.isPrintAllModalOpen() && elements.length > 0) {
        setTimeout(() => {
          elements.forEach((elRef, index) => {
            const item = items[index];
            if (item) {
              try {
                JsBarcode(elRef.nativeElement, item.id, {
                  format: "CODE128",
                  displayValue: false,
                  width: 1.5,
                  height: 40,
                  margin: 2
                });
              } catch (e) {
                console.error(`JsBarcode error for item ${item.id}:`, e);
              }
            }
          });
        }, 50);
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get batchItemsArray(): FormArray {
    return this.batchForm.get('items') as FormArray;
  }

  private createBatchItemGroup(): FormGroup {
    return this.fb.group({
      name: ['', Validators.required],
      category: ['', Validators.required],
      description: [''],
      price: [0, Validators.min(0)],
      supplierCnpj: [''],
      reorderPoint: [10, Validators.min(0)],
      quantity: [0, [Validators.required, Validators.min(0)]]
    });
  }

  addBatchRow() {
    this.batchItemsArray.push(this.createBatchItemGroup());
  }

  removeBatchRow(index: number) {
    this.batchItemsArray.removeAt(index);
  }

  filteredItems = computed(() => {
    let items = [...this.items()];
    const searchTermValue = this.searchTerm();
    const aiFilters = this.aiFilter();
    const advancedFiltersValue = this.advancedFilters();

    if (aiFilters && aiFilters.length > 0) {
        items = items.filter(item => aiFilters.some(filterGroup => {
            const nameMatch = !filterGroup.name || item.name.toLowerCase().includes(filterGroup.name.toLowerCase());
            const categoryMatch = !filterGroup.category || item.category.toLowerCase() === filterGroup.category.toLowerCase();
            const supplierMatch = !filterGroup.supplierId || item.preferredSupplierId === filterGroup.supplierId;
            const minQtyMatch = filterGroup.minQuantity === undefined || item.quantity >= filterGroup.minQuantity;
            const maxQtyMatch = filterGroup.maxQuantity === undefined || item.quantity <= filterGroup.maxQuantity;
            return nameMatch && categoryMatch && supplierMatch && minQtyMatch && maxQtyMatch;
        }));
    } else if (searchTermValue) {
        items = items.filter(item =>
            item.name.toLowerCase().includes(searchTermValue) ||
            item.category.toLowerCase().includes(searchTermValue) ||
            this.getSupplierName(item.preferredSupplierId).toLowerCase().includes(searchTermValue)
        );
    }

    if (advancedFiltersValue.category) {
        items = items.filter(item => item.category === advancedFiltersValue.category);
    }
    if (advancedFiltersValue.supplierId) {
        items = items.filter(item => item.preferredSupplierId === advancedFiltersValue.supplierId);
    }
    if (advancedFiltersValue.stockStatus) {
        switch (advancedFiltersValue.stockStatus) {
            case 'ok': items = items.filter(item => item.quantity > item.reorderPoint); break;
            case 'low': items = items.filter(item => item.quantity <= item.reorderPoint && item.quantity > 0); break;
            case 'empty': items = items.filter(item => item.quantity === 0); break;
        }
    }
    return items;
  });

  aiFilterPills = computed(() => {
    const filters = this.aiFilter();
    if (!filters || filters.length === 0) return [];
    const pills: { key: string; label: string; isSeparator?: boolean }[] = [];
    filters.forEach((group, index) => {
        if (index > 0) pills.push({ key: `or-${index}`, label: 'OU', isSeparator: true });
        if (group.name) pills.push({ key: `group${index}-name`, label: `Nome: "${group.name}"` });
        if (group.category) pills.push({ key: `group${index}-category`, label: `Categoria: ${group.category}` });
        if (group.supplierId) pills.push({ key: `group${index}-supplier`, label: `Fornecedor: ${this.getSupplierName(group.supplierId)}` });
        if (group.minQuantity !== undefined) pills.push({ key: `group${index}-min`, label: `Estoque > ${group.minQuantity}` });
        if (group.maxQuantity !== undefined) pills.push({ key: `group${index}-max`, label: `Estoque < ${group.maxQuantity}` });
    });
    return pills;
  });
  
  clearAiFilters() {
    this.aiFilter.set(null);
    this.searchControl.setValue('');
  }

  sortedItems = computed(() => {
    const items = [...this.filteredItems()];
    const column = this.sortColumn();
    const direction = this.sortDirection();
    if (!column) return items;
    return items.sort((a, b) => {
      const aValue = a[column as keyof Item];
      const bValue = b[column as keyof Item];
      if (typeof aValue === 'number' && typeof bValue === 'number') return direction === 'asc' ? aValue - bValue : bValue - aValue;
      if (typeof aValue === 'string' && typeof bValue === 'string') return direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      return 0;
    });
  });

  totalPages = computed(() => Math.ceil(this.sortedItems().length / this.itemsPerPage));

  paginatedItems = computed(() => {
    const start = (this.currentPage() - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    return this.sortedItems().slice(start, end);
  });
  
  isAllOnPageSelected = computed(() => {
    const paginatedIds = this.paginatedItems().map(i => i.id);
    if (paginatedIds.length === 0) return false;
    return paginatedIds.every(id => this.selectedItemIds().has(id));
  });

  toggleSelection(itemId: string) {
    this.selectedItemIds.update(currentSet => {
      const newSet = new Set(currentSet);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  }

  toggleSelectAllOnPage() {
    const paginatedIds = this.paginatedItems().map(i => i.id);
    const allSelected = this.isAllOnPageSelected();

    this.selectedItemIds.update(currentSet => {
      const newSet = new Set(currentSet);
      if (allSelected) {
        paginatedIds.forEach(id => newSet.delete(id));
      } else {
        paginatedIds.forEach(id => newSet.add(id));
      }
      return newSet;
    });
  }

  getSupplierName(id: string | null): string {
    if (!id) return 'N/A';
    return this.db().suppliers.find(s => s.id === id)?.name || 'Desconhecido';
  }

  getTechnicianName(id?: string | null): string {
    if (!id) return 'N/A';
    return this.db().technicians.find(t => t.id === id)?.name || 'Desconhecido';
  }

  handleSort(column: keyof Item) {
    if (this.sortColumn() === column) {
      this.sortDirection.update(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortColumn.set(column);
      this.sortDirection.set('asc');
    }
  }

  prevPage() { this.currentPage.update(p => Math.max(1, p - 1)); }
  nextPage() { this.currentPage.update(p => Math.min(this.totalPages(), p + 1)); }

  openItemForm(item: Item | null = null, initialData: Partial<ItemForm> = {}) {
    this.currentItem.set(item);
    this.itemForm = this.fb.group({
      name: [item?.name ?? initialData.name ?? '', Validators.required],
      category: [item?.category ?? initialData.category ?? this.db().categories[0] ?? '', Validators.required],
      price: [item?.price ?? initialData.price ?? 0, [Validators.required, Validators.min(0)]],
      description: [item?.description ?? initialData.description ?? ''],
      preferredSupplierId: [item?.preferredSupplierId ?? initialData.preferredSupplierId ?? null],
      reorderPoint: [item?.reorderPoint ?? initialData.reorderPoint ?? 10, [Validators.required, Validators.min(0)]],
      quantity: [item?.quantity ?? initialData.quantity ?? 0, Validators.min(0)],
    });
    this.isFormOpen.set(true);
  }

  closeItemForm() {
    this.isFormOpen.set(false);
    this.aiSuggestions.set({ description: '', category: '', reorderPoint: null });
  }

  openDeleteConfirm(item: Item) { this.itemToDelete.set(item); }
  openDeleteMultipleConfirm() { if (this.selectedItemIds().size > 0) this.isDeleteMultipleConfirmOpen.set(true); }

  async saveItem() {
    if (this.itemForm.invalid) return this.toastService.addToast('Formulário inválido.', 'error');
    const itemData: ItemForm = { id: this.currentItem()?.id, ...this.itemForm.value };
    await this.dbService.saveItem(itemData, false);
    this.toastService.addToast('Item salvo!', 'success');
    this.closeItemForm();
  }

  async deleteItem() {
    const item = this.itemToDelete();
    if (item) {
      await this.dbService.deleteItemById(item.id, false);
      this.toastService.addToast('Item excluído!', 'success');
      this.itemToDelete.set(null);
    }
  }

  async deleteSelectedItems() {
    const ids = Array.from(this.selectedItemIds());
    if (ids.length > 0) {
      await this.dbService.deleteMultipleItemsByIds(ids, false);
      this.toastService.addToast(`${ids.length} itens excluídos!`, 'success');
      this.selectedItemIds.set(new Set<string>());
      this.isDeleteMultipleConfirmOpen.set(false);
    }
  }

  async generateDescription() {
    const name = this.itemForm.get('name')?.value;
    if (!name) return;
    this.isAiLoading.set(true);
    try {
      const description = await this.geminiService.generateDescription(name);
      this.aiSuggestions.update(s => ({ ...s, description }));
    } finally { this.isAiLoading.set(false); }
  }

  async suggestCategory() {
    const name = this.itemForm.get('name')?.value;
    if (!name) return;
    this.isAiLoading.set(true);
    try {
      const category = await this.geminiService.suggestCategory(name, this.db().categories);
      this.aiSuggestions.update(s => ({ ...s, category }));
    } finally { this.isAiLoading.set(false); }
  }

  async suggestReorderPoint() {
    const item = this.currentItem();
    if (!item) return;
    this.isAiLoading.set(true);
    try {
      const reorderPoint = await this.geminiService.suggestReorderPoint(item, this.db().movements);
      this.aiSuggestions.update(s => ({ ...s, reorderPoint }));
    } finally { this.isAiLoading.set(false); }
  }

  applySuggestion(type: keyof AiSuggestion) {
    const suggestion = this.aiSuggestions()[type];
    if (!suggestion) return;

    if (type === 'description' && typeof suggestion === 'string') {
      this.itemForm.get('description')?.setValue(suggestion);
      this.aiSuggestions.update(s => ({ ...s, description: '' }));
    } else if (type === 'category' && typeof suggestion === 'string') {
      this.itemForm.get('category')?.setValue(suggestion);
      this.aiSuggestions.update(s => ({ ...s, category: '' }));
    } else if (type === 'reorderPoint' && suggestion && typeof suggestion === 'object' && 'suggestion' in suggestion && suggestion.suggestion !== null) {
      this.itemForm.get('reorderPoint')?.setValue(suggestion.suggestion);
      this.aiSuggestions.update(s => ({ ...s, reorderPoint: null }));
    }
  }

  downloadCsvTemplate() {
    const headers = ['Nome', 'Categoria', 'Descrição', 'Preço', 'Fornecedor_CNPJ', 'Ponto_Ressuprimento', 'Quantidade'];
    const csvContent = headers.join(',') + '\n';
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'modelo_importacao_itens.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(String(url));
  }

  handleCsvFile(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      this.parseAndValidateCsv(text);
    };
    reader.readAsText(file);
    input.value = '';
  }

  parseAndValidateCsv(csvText: string) {
    const lines = csvText.split('\n').filter(line => line.trim() !== '');
    if (lines.length < 2) {
      this.toastService.addToast('Arquivo CSV vazio ou inválido.', 'error');
      return;
    }
    const headers = lines[0].split(',').map(h => h.trim());
    const expectedHeaders = ['Nome', 'Categoria', 'Descrição', 'Preço', 'Fornecedor_CNPJ', 'Ponto_Ressuprimento', 'Quantidade'];
    
    // Basic header validation
    if (expectedHeaders.some((h, i) => h.toLowerCase() !== headers[i]?.toLowerCase())) {
        this.toastService.addToast('Cabeçalho do CSV inválido. Baixe o modelo para ver o formato correto.', 'error');
        return;
    }
    
    const dataRows = lines.slice(1);
    this.batchItemsArray.clear();
    
    dataRows.forEach(line => {
        const values = line.split(',');
        const rowData: any = {};
        expectedHeaders.forEach((header, index) => {
            const keyMap: any = { 'Nome': 'name', 'Categoria': 'category', 'Descrição': 'description', 'Preço': 'price', 'Fornecedor_CNPJ': 'supplierCnpj', 'Ponto_Ressuprimento': 'reorderPoint', 'Quantidade': 'quantity' };
            rowData[keyMap[header]] = values[index]?.trim() || '';
        });
        this.batchItemsArray.push(this.fb.group({
            name: [rowData.name, Validators.required],
            category: [rowData.category, Validators.required],
            description: [rowData.description],
            price: [parseFloat(rowData.price) || 0],
            supplierCnpj: [rowData.supplierCnpj],
            reorderPoint: [parseInt(rowData.reorderPoint) || 10],
            quantity: [parseInt(rowData.quantity) || 0, [Validators.required, Validators.min(0)]]
        }));
    });

    this.toastService.addToast(`${dataRows.length} itens carregados do CSV.`, 'success');
  }
  
  onBatchPaste(event: ClipboardEvent, startRowIndex: number, startField: string) {
    event.preventDefault();
    const pasteData = event.clipboardData?.getData('text') || '';
    const rows = pasteData.split('\n').filter(r => r.trim()).map(row => row.split('\t'));
    
    const fields: (keyof ReturnType<typeof this.createBatchItemGroup>['value'])[] = ['name', 'category', 'description', 'price', 'supplierCnpj', 'reorderPoint', 'quantity'];
    
    const startFieldIndex = fields.indexOf(startField as any);

    rows.forEach((row, rowIndex) => {
        const targetRowIndex = startRowIndex + rowIndex;

        if (targetRowIndex >= this.batchItemsArray.length) {
            this.addBatchRow();
        }
        
        const formGroup = this.batchItemsArray.at(targetRowIndex) as FormGroup;

        if(formGroup) {
            row.forEach((cellValue, cellIndex) => {
                const targetFieldIndex = startFieldIndex + cellIndex;
                if (targetFieldIndex < fields.length) {
                    const fieldName = fields[targetFieldIndex];
                    formGroup.get(fieldName as string)?.setValue(cellValue.trim());
                }
            });
        }
    });
  }

  async saveBatchItems() {
    this.batchForm.markAllAsTouched();
    if (this.batchForm.invalid) {
      this.toastService.addToast('Existem erros no formulário. Verifique as linhas em vermelho.', 'error');
      return;
    }

    const itemsToCreate: Omit<Item, 'id' | 'createdAt'>[] = [];
    const newCategories = new Set<string>();
    const existingCategories = new Set(this.db().categories.map(c => c.toLowerCase()));
    const suppliers = this.db().suppliers;

    for (const itemGroup of this.batchItemsArray.controls) {
      const itemValue = itemGroup.value;
      const supplier = suppliers.find(s => s.cnpj === itemValue.supplierCnpj);

      if (itemValue.supplierCnpj && !supplier) {
        itemGroup.setErrors({ message: `CNPJ ${itemValue.supplierCnpj} não encontrado.` });
        this.toastService.addToast(`Fornecedor com CNPJ ${itemValue.supplierCnpj} não foi encontrado.`, 'error');
        return;
      }
      
      if (!existingCategories.has(itemValue.category.toLowerCase())) {
        newCategories.add(itemValue.category);
      }

      itemsToCreate.push({
        name: itemValue.name,
        category: itemValue.category,
        description: itemValue.description || '',
        price: Number(itemValue.price) || 0,
        preferredSupplierId: supplier?.id || null,
        reorderPoint: Number(itemValue.reorderPoint) || 0,
        quantity: Number(itemValue.quantity) || 0
      });
    }
    
    try {
      if (newCategories.size > 0) {
        await this.dbService.addCategories(Array.from(newCategories));
      }
      await this.dbService.addMultipleItems(itemsToCreate, false);
      this.toastService.addToast(`${itemsToCreate.length} itens salvos com sucesso!`, 'success');
      this.isBatchFormOpen.set(false);
    } catch(e) {
      this.toastService.addToast('Erro ao salvar itens em lote.', 'error');
    }
  }

  openAdjustmentModal(item: Item) {
    this.itemForAdjustment.set(item);
    this.adjustmentForm = this.fb.group({
      newQuantity: [item.quantity, [Validators.required, Validators.min(0)]],
      notes: ['', [Validators.required, Validators.minLength(3)]],
    });
    this.isAdjustmentModalOpen.set(true);
  }

  async saveAdjustment() {
    if (this.adjustmentForm.invalid) return;
    const { newQuantity, notes } = this.adjustmentForm.value;
    const item = this.itemForAdjustment();
    if (!item) return;
    await this.dbService.adjustItemQuantity(item.id, newQuantity, notes, false);
    this.isAdjustmentModalOpen.set(false);
  }

  viewLifecycle(item: Item) {
    this.dbService.viewItemLifecycle(item, 'inventory');
    this.navigateTo.emit('item_lifecycle');
  }

  handleItemRecognized(data: { name: string; category: string; description: string }) {
    this.isImageRecognitionOpen.set(false);
    this.openItemForm(null, {
      name: data.name,
      category: data.category,
      description: data.description,
    });
    // Suggest category might create a new one if it doesn't exist
    this.aiSuggestions.update(s => ({...s, category: data.category }));
    this.toastService.addToast(`Item "${data.name}" reconhecido! Por favor, complete os detalhes.`, 'success');
  }
  
  handleInvoiceRecognized(parsedItems: ParsedInvoiceItem[]) {
    if (!parsedItems || parsedItems.length === 0) {
        this.toastService.addToast('Nenhum item foi reconhecido na nota fiscal.', 'info');
        this.isInvoiceRecognitionOpen.set(false);
        return;
    }

    this.isInvoiceRecognitionOpen.set(false);
    this.toastService.addToast(`${parsedItems.length} itens foram extraídos da nota fiscal!`, 'success');

    const batchItemControls = parsedItems.map(item => this.fb.group({
        name: [item.name, Validators.required],
        category: ['', Validators.required],
        description: [''],
        price: [item.price, [Validators.required, Validators.min(0)]],
        supplierCnpj: [''],
        reorderPoint: [10, [Validators.required, Validators.min(0)]],
        quantity: [item.quantity, [Validators.required, Validators.min(0)]]
    }));
    
    this.batchForm = this.fb.group({
        items: this.fb.array(batchItemControls, Validators.minLength(1))
    });

    this.isBatchFormOpen.set(true);
  }

  openPrintLabelModal(item: Item) { this.itemToPrintLabel.set(item); }

  async printLabel() {
    const printArea = this.printArea()?.nativeElement;
    if (!printArea) {
      this.toastService.addToast('Erro ao encontrar a área de impressão.', 'error');
      return;
    }
    
    try {
      const canvas = await html2canvas(printArea, { scale: 3 });
      const imgData = canvas.toDataURL('image/png');
      
      // Assuming a standard thermal label size like 2.25" x 1.25" (57mm x 32mm)
      const pdf = new jspdf.jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: [57, 32]
      });
      
      pdf.addImage(imgData, 'PNG', 0, 0, 57, 32);
      pdf.autoPrint();
      window.open(pdf.output('bloburl'), '_blank');

    } catch (e) {
      console.error('Error generating label PDF:', e);
      this.toastService.addToast('Falha ao gerar a etiqueta.', 'error');
    }
  }

  openBatchForm() {
    this.batchForm = this.fb.group({
        items: this.fb.array([], Validators.minLength(1))
    });
    for(let i=0; i < 5; i++) { this.addBatchRow(); }
    this.isBatchFormOpen.set(true);
  }

  openPrintAllModal() {
    this.isPrintAllModalOpen.set(true);
  }

  async printAllLabels() {
    const printAreaContainer = document.querySelector('.printable-area');
    const printGrid = document.querySelector('.printable-area .grid');
    if (!printAreaContainer || !printGrid) {
      this.toastService.addToast('Erro ao encontrar a área de impressão.', 'error');
      return;
    }

    this.isGeneratingPdf.set(true);
    this.toastService.addToast('Gerando PDF... Isso pode levar um momento.', 'info');
    await new Promise(resolve => setTimeout(resolve, 50));

    // Temporarily modify styles for full capture
    const originalOverflow = (printAreaContainer as HTMLElement).style.overflow;
    const originalHeight = (printAreaContainer as HTMLElement).style.height;
    (printAreaContainer as HTMLElement).style.overflow = 'visible';
    (printAreaContainer as HTMLElement).style.height = 'auto';

    try {
      const canvas = await html2canvas(printGrid as HTMLElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      
      // Restore styles immediately after capture
      (printAreaContainer as HTMLElement).style.overflow = originalOverflow;
      (printAreaContainer as HTMLElement).style.height = originalHeight;

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jspdf.jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = imgWidth / imgHeight;
      
      const canvasWidthInPdf = pdfWidth - margin * 2;
      const canvasHeightInPdf = canvasWidthInPdf / ratio;
      
      let heightLeft = canvasHeightInPdf;
      let position = margin;

      pdf.addImage(imgData, 'PNG', margin, position, canvasWidthInPdf, canvasHeightInPdf);
      heightLeft -= (pdfHeight - margin * 2);

      while (heightLeft > 0) {
        position -= (pdfHeight - margin); // Adjust position for subsequent pages
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', margin, position, canvasWidthInPdf, canvasHeightInPdf);
        heightLeft -= (pdfHeight - margin * 2);
      }
      
      const date = new Date().toISOString().split('T')[0];
      pdf.save(`etiquetas_inventario_${date}.pdf`);
      
      this.toastService.addToast('PDF com etiquetas gerado com sucesso!', 'success');
      this.isPrintAllModalOpen.set(false);

    } catch (e) {
      console.error('Error generating PDF:', e);
      this.toastService.addToast('Falha ao gerar o PDF das etiquetas.', 'error');
      // Restore styles on error
      (printAreaContainer as HTMLElement).style.overflow = originalOverflow;
      (printAreaContainer as HTMLElement).style.height = originalHeight;
    } finally {
      this.isGeneratingPdf.set(false);
    }
  }
}
