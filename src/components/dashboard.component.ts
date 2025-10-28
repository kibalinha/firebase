import { Component, ChangeDetectionStrategy, inject, computed, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { DatabaseService } from '../services/database.service';
import { DashboardChartsComponent, DonutChartData, LineChartData } from './dashboard-charts.component';
import { Movement, Item } from '../models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DatePipe, DashboardChartsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-4 sm:p-6 h-full overflow-y-auto">
      <header class="mb-6">
        <h2 class="text-2xl font-bold text-slate-800 dark:text-slate-100">Dashboard</h2>
      </header>
      
      <!-- Summary Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <div class="bg-white dark:bg-primary p-6 rounded-lg shadow-md transition-shadow hover:shadow-lg">
          <h3 class="text-sm font-medium text-slate-500 dark:text-slate-300">Valor Total do Estoque</h3>
          <p class="text-3xl font-bold text-accent">{{ summaryStats().totalValue | currency:'BRL' }}</p>
        </div>
        <div class="bg-white dark:bg-primary p-6 rounded-lg shadow-md transition-shadow hover:shadow-lg">
          <h3 class="text-sm font-medium text-slate-500 dark:text-slate-300">Unidades em Estoque</h3>
          <p class="text-3xl font-bold text-accent">{{ summaryStats().totalUnits }}</p>
        </div>
        <div class="bg-white dark:bg-primary p-6 rounded-lg shadow-md transition-shadow hover:shadow-lg">
          <h3 class="text-sm font-medium text-slate-500 dark:text-slate-300">Tipos de Itens (SKUs)</h3>
          <p class="text-3xl font-bold text-accent">{{ summaryStats().uniqueItems }}</p>
        </div>
        <div class="bg-white dark:bg-primary p-6 rounded-lg shadow-md transition-shadow hover:shadow-lg">
          <h3 class="text-sm font-medium text-slate-500 dark:text-slate-300">Itens com Estoque Baixo</h3>
          <p class="text-3xl font-bold text-error">{{ lowStockItemsCount() }}</p>
        </div>
      </div>

      <!-- Main Content Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-5 gap-6">

        <!-- Recent Activity -->
        <div class="lg:col-span-2 bg-white dark:bg-primary p-6 rounded-lg shadow-md flex flex-col">
            <h3 class="font-bold text-lg mb-4">Atividade Recente</h3>
            <div class="flex-grow overflow-y-auto pr-2 -mr-2">
                <ul class="space-y-4">
                    @for(move of recentMovements(); track move.id) {
                        <li class="flex items-start gap-3">
                           <div class="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                             [class.bg-green-100]="move.type === 'in'" [class.dark:bg-green-900/50]="move.type === 'in'"
                             [class.bg-red-100]="move.type === 'out'" [class.dark:bg-red-900/50]="move.type === 'out'">
                                @if (move.type === 'in') {
                                    <span class="font-bold text-green-600">E</span>
                                } @else {
                                    <span class="font-bold text-red-600">S</span>
                                }
                           </div>
                           <div class="flex-grow">
                                <p class="text-sm font-medium">
                                   {{ getItemName(move.itemId) }} 
                                   <span class="font-bold" [class.text-green-600]="move.type === 'in'" [class.text-red-600]="move.type === 'out'">
                                     ({{ move.type === 'in' ? '+' : '-' }}{{ move.quantity }})
                                   </span>
                                </p>
                                <p class="text-xs text-slate-500 dark:text-slate-400">
                                    {{ move.date | date:'dd/MM, HH:mm' }}
                                    @if(move.technicianId) {
                                        <span> por {{ getTechnicianName(move.technicianId) }}</span>
                                    }
                                </p>
                           </div>
                        </li>
                    } @empty {
                        <div class="text-center py-8 text-slate-500 dark:text-slate-400">
                           <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 mx-auto mb-2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                           </svg>
                           <p class="text-sm">Nenhuma movimentação registrada ainda.</p>
                        </div>
                    }
                </ul>
            </div>
        </div>
        
        <!-- Consumption Trend Chart -->
        <div class="lg:col-span-3 bg-white dark:bg-primary p-6 rounded-lg shadow-md min-h-[400px] flex flex-col">
          <div class="flex justify-between items-center mb-4">
            <h3 class="font-bold text-lg">Consumo nos Últimos 30 Dias</h3>
            <div class="bg-slate-200 dark:bg-secondary p-1 rounded-md flex">
              <button 
                (click)="trendChartMetric.set('quantity')"
                class="px-3 py-1 rounded text-sm font-medium transition-colors"
                [class.bg-white]="trendChartMetric() === 'quantity'"
                [class.dark:bg-primary]="trendChartMetric() === 'quantity'"
                [class.text-slate-800]="trendChartMetric() === 'quantity'"
                [class.dark:text-slate-100]="trendChartMetric() === 'quantity'"
                [class.text-slate-600]="trendChartMetric() !== 'quantity'"
                [class.dark:text-slate-300]="trendChartMetric() !== 'quantity'">
                  Quantidade
              </button>
              <button 
                (click)="trendChartMetric.set('value')"
                class="px-3 py-1 rounded text-sm font-medium transition-colors"
                [class.bg-white]="trendChartMetric() === 'value'"
                [class.dark:bg-primary]="trendChartMetric() === 'value'"
                [class.text-slate-800]="trendChartMetric() === 'value'"
                [class.dark:text-slate-100]="trendChartMetric() === 'value'"
                [class.text-slate-600]="trendChartMetric() !== 'value'"
                [class.dark:text-slate-300]="trendChartMetric() !== 'value'">
                  Valor (R$)
              </button>
            </div>
          </div>
          @if (consumptionTrendData(); as chartData) {
            <div class="flex-grow min-h-0">
              <app-dashboard-charts 
                [data]="chartData" 
                type="line"
              />
            </div>
          } @else {
            <p class="text-slate-500 dark:text-slate-400 text-center py-10">Sem dados de consumo para exibir.</p>
          }
        </div>

        <!-- Charts -->
        <div class="lg:col-span-2 bg-white dark:bg-primary p-6 rounded-lg shadow-md min-h-[400px] flex flex-col">
          <div class="flex justify-between items-center mb-4">
            <h3 class="font-bold text-lg">Distribuição por Categoria</h3>
            <div class="flex items-center gap-2">
               <!-- Metric Toggle -->
              <div class="bg-slate-200 dark:bg-secondary p-1 rounded-md flex">
                <button 
                  (click)="categoryDisplayMetric.set('value')"
                  class="px-3 py-1 rounded text-sm font-medium transition-colors"
                  [class.bg-white]="categoryDisplayMetric() === 'value'"
                  [class.dark:bg-primary]="categoryDisplayMetric() === 'value'"
                  [class.text-slate-800]="categoryDisplayMetric() === 'value'"
                  [class.dark:text-slate-100]="categoryDisplayMetric() === 'value'"
                  [class.text-slate-600]="categoryDisplayMetric() !== 'value'"
                  [class.dark:text-slate-300]="categoryDisplayMetric() !== 'value'">
                    Valor (R$)
                </button>
                <button 
                  (click)="categoryDisplayMetric.set('quantity')"
                  class="px-3 py-1 rounded text-sm font-medium transition-colors"
                  [class.bg-white]="categoryDisplayMetric() === 'quantity'"
                  [class.dark:bg-primary]="categoryDisplayMetric() === 'quantity'"
                  [class.text-slate-800]="categoryDisplayMetric() === 'quantity'"
                  [class.dark:text-slate-100]="categoryDisplayMetric() === 'quantity'"
                  [class.text-slate-600]="categoryDisplayMetric() !== 'quantity'"
                  [class.dark:text-slate-300]="categoryDisplayMetric() !== 'quantity'">
                    Qtd.
                </button>
              </div>
               <!-- Chart Type Toggle -->
              <div class="bg-slate-200 dark:bg-secondary p-1 rounded-md flex">
                <button 
                  (click)="categoryChartType.set('donut')"
                  class="px-3 py-1 rounded text-sm font-medium transition-colors"
                  [class.bg-white]="categoryChartType() === 'donut'"
                  [class.dark:bg-primary]="categoryChartType() === 'donut'"
                  [class.text-slate-800]="categoryChartType() === 'donut'"
                  [class.dark:text-slate-100]="categoryChartType() === 'donut'"
                  [class.text-slate-600]="categoryChartType() !== 'donut'"
                  [class.dark:text-slate-300]="categoryChartType() !== 'donut'">
                    Donut
                </button>
                <button 
                  (click)="categoryChartType.set('bar')"
                  class="px-3 py-1 rounded text-sm font-medium transition-colors"
                  [class.bg-white]="categoryChartType() === 'bar'"
                  [class.dark:bg-primary]="categoryChartType() === 'bar'"
                  [class.text-slate-800]="categoryChartType() === 'bar'"
                  [class.dark:text-slate-100]="categoryChartType() === 'bar'"
                  [class.text-slate-600]="categoryChartType() !== 'bar'"
                  [class.dark:text-slate-300]="categoryChartType() !== 'bar'">
                    Barras
                </button>
              </div>
            </div>
          </div>
          @if (categoryChartData().length > 0) {
            <div class="flex-grow min-h-0">
              <app-dashboard-charts 
                [data]="categoryChartData()" 
                [type]="categoryChartType()" 
                [valueFormat]="categoryDisplayMetric()"
                (segmentClick)="handleCategorySelection($event)"
              />
            </div>
          } @else {
            <p class="text-slate-500 dark:text-slate-400 text-center py-10">Sem dados para exibir.</p>
          }
        </div>

        <!-- Items List (dynamic) -->
        <div class="lg:col-span-3 bg-white dark:bg-primary p-6 rounded-lg shadow-md">
          <h3 class="font-bold mb-4 text-lg">
            @if (selectedCategory(); as category) {
              <span>Itens na Categoria: <span class="text-accent">{{ category }}</span></span>
            } @else {
              <span>Itens Críticos com Estoque Baixo</span>
            }
          </h3>
          <div class="overflow-y-auto max-h-[320px] pr-2">
            @if (itemsForBottomList().length > 0) {
              <table class="w-full text-left">
                <thead>
                  <tr class="border-b border-slate-200 dark:border-slate-600">
                    <th class="p-2 text-sm">Item</th>
                    <th class="p-2 text-sm text-center">Qtd. Total</th>
                    <th class="p-2 text-sm text-center">Ponto de Ressuprimento</th>
                  </tr>
                </thead>
                <tbody>
                  @for(item of itemsForBottomList(); track item.id) {
                    <tr class="border-b border-slate-200 dark:border-slate-700">
                      <td class="p-2 font-medium">{{ item.name }}</td>
                      <td class="p-2 font-bold text-center"
                        [class.text-error]="item.quantity <= item.reorderPoint && item.reorderPoint > 0 && item.quantity > 0"
                        [class.text-red-700]="item.quantity === 0">
                        {{ item.quantity }} {{ item.unit }}
                      </td>
                      <td class="p-2 text-slate-500 dark:text-slate-400 text-center">{{ item.reorderPoint }} {{ item.unit }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            } @else {
               <p class="p-4 text-center text-slate-500 dark:text-slate-400">
                @if (selectedCategory()) {
                  <span>Nenhum item encontrado nesta categoria.</span>
                } @else {
                  <span>Nenhum item com estoque baixo.</span>
                }
               </p>
            }
          </div>
        </div>
      </div>
    </div>
  `,
})
export class DashboardComponent {
  private dbService = inject(DatabaseService);

  categoryChartType = signal<'donut' | 'bar'>('donut');
  categoryDisplayMetric = signal<'value' | 'quantity'>('value');
  selectedCategory = signal<string | null>(null);
  trendChartMetric = signal<'value' | 'quantity'>('quantity');

  handleCategorySelection(category: string | null) {
    this.selectedCategory.update(current => current === category ? null : category);
  }

  summaryStats = computed(() => {
    const items = this.dbService.db().items; // Only main inventory
    const totalValue = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0);
    const uniqueItems = items.length;
    return { totalValue, totalUnits, uniqueItems };
  });

  lowStockItemsCount = computed(() => {
    return this.dbService.db().items.filter(item => item.quantity <= item.reorderPoint && item.reorderPoint > 0).length;
  });

  itemsForBottomList = computed(() => {
    const category = this.selectedCategory();
    const allItems = this.dbService.db().items;

    if (category) {
      // If a category is selected, show all items from that category
      return allItems
        .filter(item => item.category === category)
        .sort((a, b) => a.name.localeCompare(b.name));
    } else {
      // If no category is selected, show low stock items
      return allItems
        .filter(item => item.quantity <= item.reorderPoint && item.reorderPoint > 0)
        .sort((a, b) => a.quantity - b.quantity);
    }
  });

  categoryChartData = computed((): DonutChartData[] => {
    const items = this.dbService.db().items; // Chart only for main inventory
    const metric = this.categoryDisplayMetric();
    
    if (items.length === 0) return [];
    
    const categoryMap = new Map<string, number>();
    for (const item of items) {
      const value = metric === 'value' ? item.quantity * item.price : item.quantity;
      categoryMap.set(item.category, (categoryMap.get(item.category) || 0) + value);
    }
    
    return Array.from(categoryMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  });

  recentMovements = computed(() => {
    const mainItemIds = new Set(this.dbService.db().items.map(i => i.id));
    return this.dbService.db().movements
        .filter(m => mainItemIds.has(m.itemId))
        .slice(0, 5);
  });
  
  getItemName(id: string): string {
    const item = this.dbService.db().items.find(i => i.id === id);
    if (item) return item.name;
    return 'Item desconhecido';
  }

  getTechnicianName(id?: string | null): string {
    if (!id) return 'N/A';
    return this.dbService.db().technicians.find(t => t.id === id)?.name || 'Desconhecido';
  }

  consumptionTrendData = computed((): LineChartData | null => {
    const metric = this.trendChartMetric();
    const allItems = this.dbService.db().items;
    const movements = this.dbService.db().movements;
    const mainItemIds = new Set(allItems.map(i => i.id));

    if (movements.length === 0 || allItems.length === 0) {
      return null;
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const relevantMovements = movements.filter(m =>
      m.type === 'out' && new Date(m.date) >= thirtyDaysAgo && mainItemIds.has(m.itemId)
    );

    const dailyData = new Map<string, { quantity: number; value: number }>();

    // Initialize map for the last 30 days
    for (let i = 0; i <= 30; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateString = date.toISOString().split('T')[0];
      dailyData.set(dateString, { quantity: 0, value: 0 });
    }

    // Aggregate data from movements
    for (const move of relevantMovements) {
      const dateString = new Date(move.date).toISOString().split('T')[0];
      const day = dailyData.get(dateString);
      if (day) {
        const item = allItems.find(i => i.id === move.itemId);
        day.quantity += move.quantity;
        day.value += move.quantity * (item?.price || 0);
      }
    }

    const sortedEntries = Array.from(dailyData.entries()).sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime());

    const labels = sortedEntries.map(entry => entry[0]);
    const values = sortedEntries.map(entry => metric === 'quantity' ? entry[1].quantity : entry[1].value);

    return {
      labels,
      series: [{
        name: metric === 'quantity' ? 'Quantidade Consumida' : 'Valor Consumido (R$)',
        values: values,
        color: '#c72127' // accent color
      }]
    };
  });
}