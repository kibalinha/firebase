import { Component, ChangeDetectionStrategy, inject, computed, signal, effect, Signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { DatabaseService } from '../services/database.service';
import { Item, Forecast, Movement, AlmoxarifadoDB, Supplier } from '../models';
import { GeminiService } from '../services/gemini.service';
import { ToastService } from '../services/toast.service';
import { DashboardChartsComponent, LineChartData } from './dashboard-charts.component';

@Component({
  selector: 'app-demand-estimation',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DatePipe, DashboardChartsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-6 h-full flex flex-col">
      <h2 class="text-2xl font-bold mb-6">Estimativa de Demanda e Compra (IA)</h2>

      <div class="bg-white dark:bg-primary p-4 rounded-lg mb-6 max-w-2xl shadow-md">
        <label for="item-select" class="block text-sm mb-1 font-medium">Selecione um Item para Análise</label>
        <select 
          id="item-select"
          [formControl]="itemSelectionControl"
          class="bg-white dark:bg-secondary p-2 rounded w-full border border-slate-300 dark:border-slate-600 focus:border-accent focus:outline-none disabled:opacity-50"
        >
          <option [ngValue]="null">-- Escolha um item --</option>
          @for (item of allItems(); track item.id) {
            <option [value]="item.id">{{ item.name }}</option>
          }
        </select>
      </div>

      <div class="flex-grow overflow-auto min-h-0">
        @if (isLoading()) {
          <div class="text-center p-10 bg-white dark:bg-primary rounded-lg flex flex-col items-center justify-center h-full">
            <div class="w-12 h-12 border-4 border-slate-400 border-t-accent rounded-full animate-spin mb-4"></div>
            <p class="text-lg font-semibold">Analisando histórico de consumo...</p>
            <p class="text-slate-500 dark:text-slate-400 mt-2">A IA está processando os dados para gerar a previsão mais precisa.</p>
          </div>
        } @else if (selectedItem(); as item) {
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <!-- Left Column: Status & Recommendation -->
            <div class="lg:col-span-1 space-y-6">
              <!-- Current Status -->
              <div class="bg-white dark:bg-primary p-6 rounded-lg shadow-md">
                <h3 class="font-bold text-lg mb-4">Status Atual</h3>
                <ul class="space-y-2 text-sm">
                  <li class="flex justify-between"><span>Estoque Atual:</span> <strong class="text-accent">{{item.quantity}}</strong></li>
                  <li class="flex justify-between"><span>Ponto de Ressuprimento:</span> <strong>{{item.reorderPoint}}</strong></li>
                  <li class="flex justify-between"><span>Fornecedor:</span> <strong>{{ getSupplierName(item.supplierId) }}</strong></li>
                  <li class="flex justify-between"><span>Categoria:</span> <strong>{{item.category}}</strong></li>
                </ul>
              </div>

              <!-- Data Quality -->
              <div class="bg-white dark:bg-primary p-6 rounded-lg shadow-md">
                <h3 class="font-bold text-lg mb-3">Qualidade dos Dados</h3>
                <div class="flex items-center gap-3">
                  <span class="h-4 w-4 rounded-full"
                    [class.bg-green-500]="dataQuality().level === 'good'"
                    [class.bg-yellow-500]="dataQuality().level === 'fair'"
                    [class.bg-red-500]="dataQuality().level === 'low'"
                    [class.bg-slate-400]="dataQuality().level === 'none'"
                  ></span>
                  <p class="text-sm text-slate-600 dark:text-slate-300">{{ dataQuality().text }}</p>
                </div>
              </div>
              
              <!-- Purchase Recommendation -->
              @if (forecastResult(); as forecast) {
                <div class="bg-white dark:bg-primary p-6 rounded-lg shadow-xl border-t-4"
                  [class.border-green-500]="!forecast.purchase_recommendation.should_purchase"
                  [class.border-amber-500]="forecast.purchase_recommendation.should_purchase"
                >
                  <h3 class="font-bold text-lg mb-4">Recomendação de Compra</h3>
                  @if (forecast.purchase_recommendation.should_purchase) {
                    <div class="space-y-3 text-sm">
                      <p class="flex items-center gap-2 text-amber-700 dark:text-amber-300"><span class="text-xl">🛒</span> <strong>Compra recomendada!</strong></p>
                      <p>{{ forecast.purchase_recommendation.reasoning }}</p>
                      <ul class="space-y-1 pt-2">
                        <li class="flex justify-between"><span>Comprar em:</span> <strong class="text-accent">{{ forecast.purchase_recommendation.purchase_date | date:'dd/MM/yyyy' }}</strong></li>
                        <li class="flex justify-between"><span>Qtd. Sugerida:</span> <strong class="text-accent">{{ forecast.purchase_recommendation.quantity_to_purchase }} un.</strong></li>
                      </ul>
                    </div>
                  } @else {
                     <div class="space-y-3 text-sm">
                       <p class="flex items-center gap-2 text-green-700 dark:text-green-300"><span class="text-xl">✅</span> <strong>Nenhuma compra necessária.</strong></p>
                       <p>{{ forecast.purchase_recommendation.reasoning }}</p>
                     </div>
                  }
                </div>
              }
            </div>

            <!-- Right Column: AI Analysis & Chart -->
            <div class="lg:col-span-2 space-y-6">
                @if (forecastResult(); as forecast) {
                  <!-- AI Summary -->
                  <div class="bg-white dark:bg-primary p-6 rounded-lg shadow-md">
                      <h3 class="text-xl font-bold mb-3 text-accent">Análise Preditiva da IA</h3>
                      <p class="text-slate-600 dark:text-slate-300">{{ forecast.summary }}</p>
                  </div>
                  <!-- Chart -->
                  <div class="bg-white dark:bg-primary p-6 rounded-lg shadow-md min-h-[400px] flex flex-col">
                    <h3 class="font-bold mb-4 text-lg">Previsão de Consumo e Estoque (30 dias)</h3>
                    <div class="flex-grow min-h-0">
                      @if (forecastChartData(); as chartData) {
                        <app-dashboard-charts [data]="chartData" type="line" />
                      } @else {
                        <div class="flex items-center justify-center h-full text-slate-500 dark:text-slate-400">
                          <p>Não há dados suficientes para gerar um gráfico de previsão.</p>
                        </div>
                      }
                    </div>
                  </div>
                } @else {
                  <div class="text-center p-10 bg-white dark:bg-primary rounded-lg flex flex-col items-center justify-center h-full">
                    @if(geminiService.isConfigured()) {
                      <p>Aguardando análise da IA...</p>
                    } @else {
                       <p class="text-red-500">Serviço de IA não configurado.</p>
                       <p class="text-slate-500 mt-2">Por favor, adicione uma chave de API nas Configurações.</p>
                    }
                  </div>
                }
            </div>
          </div>
        } @else {
          <div class="text-center p-10 bg-white dark:bg-primary rounded-lg flex flex-col items-center justify-center h-full border-2 border-dashed border-slate-300 dark:border-secondary">
             <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 text-slate-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p class="text-lg font-semibold">Selecione um item acima para começar a análise de demanda.</p>
            <p class="text-slate-500 dark:text-slate-400 mt-2">A ferramenta irá analisar o histórico de consumo para prever quando a próxima compra será necessária.</p>
          </div>
        }
      </div>
    </div>
  `
})
export class DemandEstimationComponent {
  private dbService = inject(DatabaseService);
  geminiService = inject(GeminiService);
  private toastService = inject(ToastService);
  private db = this.dbService.db;

  selectedItemId = signal<string | null>(null);
  itemSelectionControl = new FormControl<string | null>(null);
  isLoading = signal(false);
  forecastResult = signal<Forecast | null>(null);
  
  allItems: Signal<Item[]>;
  selectedItem: Signal<Item | null>;
  dataQuality: Signal<{ level: string; text: string; }>;
  forecastChartData: Signal<LineChartData | null>;

  constructor() {
    this.allItems = computed(() => 
      this.db().items.slice().sort((a, b) => a.name.localeCompare(b.name))
    );

    this.selectedItem = computed(() => {
      const id = this.selectedItemId();
      if (!id) return null;
      return this.allItems().find(i => i.id === id) || null;
    });

    this.dataQuality = computed(() => {
      const item = this.selectedItem();
      if (!item) return { level: 'none', text: '' };
      
      const movements = this.db().movements.filter(m => m.itemId === item.id && m.type === 'out');
      
      if (movements.length > 15) return { level: 'good', text: 'Bom volume de dados históricos.' };
      if (movements.length >= 5) return { level: 'fair', text: 'Dados históricos limitados.' };
      if (movements.length > 0) return { level: 'low', text: 'Pouquíssimos dados históricos. A previsão pode ser imprecisa.' };
      return { level: 'none', text: 'Nenhum histórico de consumo encontrado.' };
    });

    this.forecastChartData = computed((): LineChartData | null => {
      const forecast = this.forecastResult();
      const item = this.selectedItem();
      if (!forecast || !item) return null;
  
      const labels = forecast.forecast.map(f => f.date);
      const predictedConsumption = forecast.forecast.map(f => f.predicted_consumption);
      
      let currentStock = item.quantity;
      const stockProjection = forecast.forecast.map(f => {
          currentStock -= f.predicted_consumption;
          return currentStock < 0 ? 0 : currentStock;
      });
  
      return {
        labels,
        series: [
          { name: 'Estoque Projetado', values: stockProjection, color: '#3b82f6' }, // blue-500
          { name: 'Consumo Previsto', values: predictedConsumption, color: '#f59e0b' }, // amber-500
        ],
        threshold: {
            value: item.reorderPoint,
            label: 'Ponto de Ressuprimento',
            color: '#ef4444' // red-500
        }
      };
    });

    this.itemSelectionControl.valueChanges.subscribe(itemId => {
        this.selectedItemId.set(itemId);
    });

    effect(async () => {
        const itemId = this.selectedItemId();
        if (itemId) {
            this.runForecast(itemId);
        } else {
            this.forecastResult.set(null);
        }
    }, { allowSignalWrites: true });

    effect(() => {
      if (this.isLoading()) {
        this.itemSelectionControl.disable({ emitEvent: false });
      } else {
        this.itemSelectionControl.enable({ emitEvent: false });
      }
    });
  }

  async runForecast(itemId: string) {
    this.isLoading.set(true);
    this.forecastResult.set(null);
    try {
        const item = this.allItems().find(i => i.id === itemId);
        if (item) {
             if (this.geminiService.isConfigured()) {
                const result = await this.geminiService.forecastDemand(item, this.db().movements);
                this.forecastResult.set(result);
            } else {
                this.toastService.addToast('Serviço de IA desativado. Vá para Configurações.', 'error');
            }
        }
    } catch (e) {
        this.toastService.addToast("Erro ao gerar previsão.", "error");
    } finally {
        this.isLoading.set(false);
    }
  }

  getSupplierName(id: string | null): string {
    if (!id) return 'N/A';
    return this.db().suppliers.find(s => s.id === id)?.name || 'Desconhecido';
  }
}