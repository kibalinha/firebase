import { Component, ChangeDetectionStrategy, inject, computed, signal, viewChild, ElementRef, input, effect, OnDestroy, Signal } from '@angular/core';
import { CommonModule, DatePipe, CurrencyPipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DatabaseService } from '../services/database.service';
import { GeminiService } from '../services/gemini.service';
import { ToastService } from '../services/toast.service';
import { ReportGeneratorService } from '../services/report-generator.service';
import { Item, ReportType, AnomalyReport, AlmoxarifadoDB } from '../models';
import { DashboardChartsComponent, DonutChartData } from './dashboard-charts.component';

// Declaração para usar bibliotecas de CDN sem erros de tipo
declare var jspdf: any;
declare var html2canvas: any;

interface ReportCard {
  id: ReportType;
  title: string;
  description: string;
  icon: string; // SVG path
  requiresAi?: boolean;
  requiresMonth: boolean;
  helpText?: {
    whatIsIt: string;
    whyUseIt: string;
  };
}

// --- SUB-COMPONENTS FOR REPORT DISPLAY ---

@Component({
  selector: 'app-top-consumed-report', standalone: true,
  imports: [CommonModule, CurrencyPipe],
  template: `
    <h4 class="text-lg font-bold mb-4">Relatório de Itens Mais Consumidos</h4>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div>
        <h5 class="font-semibold mb-2">Top 5 por Valor (R$)</h5>
        <table class="w-full text-left text-sm">
          <thead><tr class="border-b dark:border-slate-600"><th class="p-2">Item</th><th class="p-2">Valor Total</th></tr></thead>
          <tbody>
            @for(item of data().byValue; track item.itemId) { 
              <tr class="border-b dark:border-slate-700"><td class="p-2">{{item.itemName}}</td><td class="p-2">{{item.totalValue | currency:'BRL'}}</td></tr> 
            }
            @empty { <tr><td colspan="2" class="p-4 text-center">Nenhum consumo no período.</td></tr> }
          </tbody>
        </table>
      </div>
      <div>
        <h5 class="font-semibold mb-2">Top 5 por Quantidade</h5>
        <table class="w-full text-left text-sm">
          <thead><tr class="border-b dark:border-slate-600"><th class="p-2">Item</th><th class="p-2">Qtd. Total</th></tr></thead>
          <tbody>
            @for(item of data().byQuantity; track item.itemId) { 
              <tr class="border-b dark:border-slate-700"><td class="p-2">{{item.itemName}}</td><td class="p-2">{{item.totalQuantity}}</td></tr> 
            }
            @empty { <tr><td colspan="2" class="p-4 text-center">Nenhum consumo no período.</td></tr> }
          </tbody>
        </table>
      </div>
    </div>
  `
})
class TopConsumedReport { data = input.required<{ byValue: any[], byQuantity: any[] }>(); }


@Component({
  selector: 'app-technician-activity-report', standalone: true,
  imports: [CommonModule, CurrencyPipe],
  template: `
    <h4 class="text-lg font-bold mb-4">Relatório de Atividade por Técnico</h4>
    <table class="w-full text-left text-sm">
      <thead><tr class="border-b dark:border-slate-600"><th class="p-2">Técnico</th><th class="p-2">Nº de Requisições</th><th class="p-2">Total de Itens</th><th class="p-2">Valor Total (R$)</th></tr></thead>
      <tbody>
        @for(tech of data(); track tech.technicianId) { 
          <tr class="border-b dark:border-slate-700">
            <td class="p-2">{{tech.technicianName}}</td><td class="p-2">{{tech.requisitionCount}}</td><td class="p-2">{{tech.totalItems}}</td><td class="p-2">{{tech.totalValue | currency:'BRL'}}</td>
          </tr> 
        }
        @empty { <tr><td colspan="4" class="p-4 text-center">Nenhuma atividade no período.</td></tr> }
      </tbody>
    </table>
  `
})
class TechnicianActivityReport { data = input.required<any[]>(); }

@Component({
  selector: 'app-abc-report', standalone: true,
  imports: [CommonModule, CurrencyPipe],
  template: `
    <h4 class="text-lg font-bold mb-4">Relatório de Curva ABC</h4>
    <table class="w-full text-left text-sm">
      <thead><tr class="border-b dark:border-slate-600"><th class="p-2">Item</th><th class="p-2">Valor Consumo</th><th class="p-2">% Acum.</th><th class="p-2">Classe</th></tr></thead>
      <tbody>
        @for(i of data(); track i.itemId) { 
          <tr class="border-b dark:border-slate-700">
            <td class="p-2">{{i.itemName}}</td><td class="p-2">{{i.totalValue | currency:'BRL'}}</td><td class="p-2">{{i.cumulativePercentage.toFixed(2)}}%</td>
            <td class="p-2 font-bold" [class.text-accent]="i.class === 'A'" [class.text-warning]="i.class === 'B'" [class.text-slate-500]="i.class === 'C'">{{i.class}}</td>
          </tr> 
        }
        @empty { <tr><td colspan="4" class="p-4 text-center">Nenhum consumo no período.</td></tr> }
      </tbody>
    </table>
  `
})
class AbcReport { data = input.required<any[]>(); }

@Component({
  selector: 'app-turnover-report', standalone: true,
  imports: [CommonModule, CurrencyPipe],
  template: `
    <h4 class="text-lg font-bold mb-4">Relatório de Giro de Estoque</h4>
    <table class="w-full text-left text-sm">
      <thead><tr class="border-b dark:border-slate-600"><th class="p-2">Item</th><th class="p-2">Estoque Médio (R$)</th><th class="p-2">Custo das Saídas (R$)</th><th class="p-2">Giro</th></tr></thead>
      <tbody>
        @for(i of data(); track i.itemName) {
          <tr class="border-b dark:border-slate-700">
            <td class="p-2">{{i.itemName}}</td>
            <td class="p-2">{{i.avgStockValue | currency:'BRL'}}</td>
            <td class="p-2">{{i.costOfGoodsSold | currency:'BRL'}}</td>
            <td class="p-2 font-bold">{{i.turnover.toFixed(2)}}</td>
          </tr>
        }
        @empty { <tr><td colspan="4" class="p-4 text-center">Nenhum consumo no período.</td></tr> }
      </tbody>
    </table>
  `
})
class TurnoverReport { data = input.required<any[]>(); }

@Component({
  selector: 'app-supplier-report', standalone: true,
  imports: [CommonModule, CurrencyPipe],
  template: `
    <h4 class="text-lg font-bold mb-4">Relatório de Análise de Fornecedores</h4>
    <table class="w-full text-left text-sm">
      <thead><tr class="border-b dark:border-slate-600"><th class="p-2">Fornecedor</th><th class="p-2">Itens Únicos</th><th class="p-2">Qtd. Saída</th><th class="p-2">Valor Saída</th></tr></thead>
      <tbody>
        @for(s of data(); track s.supplierName) {
          <tr class="border-b dark:border-slate-700">
            <td class="p-2">{{s.supplierName}}</td><td class="p-2">{{s.distinctItems}}</td><td class="p-2">{{s.totalQuantity}}</td><td class="p-2">{{s.totalValue | currency:'BRL'}}</td>
          </tr>
        }
        @empty { <tr><td colspan="4" class="p-4 text-center">Nenhum consumo no período.</td></tr> }
      </tbody>
    </table>
  `
})
class SupplierReport { data = input.required<any[]>(); }

@Component({
  selector: 'app-aging-report', standalone: true,
  imports: [CommonModule],
  template: `
    <h4 class="text-lg font-bold mb-4">Relatório de Idade do Estoque</h4>
    <table class="w-full text-left text-sm">
      <thead><tr class="border-b dark:border-slate-600"><th class="p-2">Item</th><th class="p-2">Estoque Atual</th><th class="p-2">Dias Desde Última Saída</th></tr></thead>
      <tbody>
        @for(i of data(); track i.itemName) {
          <tr class="border-b dark:border-slate-700">
            <td class="p-2">{{i.itemName}}</td><td class="p-2">{{i.quantity}}</td>
            <td class="p-2 font-semibold" [class.text-error]="i.daysSinceLastExit > 90" [class.text-warning]="i.daysSinceLastExit > 30 && i.daysSinceLastExit <= 90">
              {{ i.daysSinceLastExit === -1 ? 'Nenhuma saída' : i.daysSinceLastExit + ' dias' }}
            </td>
          </tr>
        }
        @empty { <tr><td colspan="3" class="p-4 text-center">Nenhum item em estoque.</td></tr> }
      </tbody>
    </table>
  `
})
class AgingReport { data = input.required<any[]>(); }

@Component({
  selector: 'app-carrying-cost-report', standalone: true,
  imports: [CommonModule, CurrencyPipe],
  template: `
    <h4 class="text-lg font-bold mb-4">Relatório de Custo de Manutenção de Estoque</h4>
    <p class="text-sm text-slate-500 dark:text-slate-400 mb-4">Custo mensal estimado com base em uma taxa anual de {{ data().rate * 100 }}% sobre o valor médio do estoque no período.</p>
    <table class="w-full text-left text-sm">
      <thead><tr class="border-b dark:border-slate-600"><th class="p-2">Item</th><th class="p-2">Estoque Médio (R$)</th><th class="p-2">Custo Mensal Estimado</th></tr></thead>
      <tbody>
        @for(i of data().reportData; track i.itemName) {
          <tr class="border-b dark:border-slate-700">
            <td class="p-2">{{i.itemName}}</td>
            <td class="p-2">{{i.avgStockValue | currency:'BRL'}}</td>
            <td class="p-2 font-bold text-amber-600 dark:text-amber-400">{{i.monthlyCost | currency:'BRL'}}</td>
          </tr>
        }
        @empty { <tr><td colspan="3" class="p-4 text-center">Nenhum dado para calcular.</td></tr> }
      </tbody>
      <tfoot class="font-bold bg-slate-50 dark:bg-primary">
        <tr>
          <td class="p-2" colspan="2">Custo Total Estimado no Mês</td>
          <td class="p-2">{{ data().totalMonthlyCost | currency:'BRL' }}</td>
        </tr>
      </tfoot>
    </table>
  `
})
class CarryingCostReport { data = input.required<{ reportData: any[], totalMonthlyCost: number, rate: number }>(); }

@Component({
  selector: 'app-stockout-history-report', standalone: true,
  imports: [CommonModule, DatePipe],
  template: `
    <h4 class="text-lg font-bold mb-4">Relatório de Histórico de Ruptura de Estoque</h4>
    <p class="text-sm text-slate-500 dark:text-slate-400 mb-4">Lista de itens que atingiram estoque zero ou negativo em algum momento durante o mês selecionado.</p>
    <table class="w-full text-left text-sm">
      <thead><tr class="border-b dark:border-slate-600"><th class="p-2">Item</th><th class="p-2">Data da Primeira Ruptura no Mês</th></tr></thead>
      <tbody>
        @for(item of data(); track item.itemName) { 
          <tr class="border-b dark:border-slate-700">
            <td class="p-2 font-semibold text-error">{{item.itemName}}</td>
            <td class="p-2">{{item.stockoutDate | date:'dd/MM/yyyy'}}</td>
          </tr> 
        }
        @empty { <tr><td colspan="2" class="p-4 text-center">Nenhuma ruptura de estoque detectada no período.</td></tr> }
      </tbody>
    </table>
  `
})
class StockoutHistoryReport { data = input.required<any[]>(); }

@Component({
  selector: 'app-seasonality-report', standalone: true,
  imports: [CommonModule, DashboardChartsComponent],
  template: `
    <h4 class="text-lg font-bold mb-4">Relatório de Análise de Sazonalidade</h4>
    <p class="text-sm text-slate-500 dark:text-slate-400 mb-4">Consumo total (R$) por mês, mostrando tendências de longo prazo.</p>
    <div class="h-[450px]">
       @if(data() && data().length > 0) {
        <app-dashboard-charts [data]="data()" type="bar" valueFormat="value" />
      } @else {
        <div class="flex items-center justify-center h-full text-slate-500 dark:text-slate-400">
          <p>Nenhum dado de consumo encontrado para gerar o gráfico.</p>
        </div>
      }
    </div>
  `
})
class SeasonalityReport { data = input.required<DonutChartData[]>(); }

@Component({
  selector: 'app-inventory-adjustments-report', standalone: true,
  imports: [CommonModule, CurrencyPipe, DatePipe],
  template: `
    <h4 class="text-lg font-bold mb-4">Relatório de Ajustes de Inventário</h4>
    <p class="text-sm text-slate-500 dark:text-slate-400 mb-4">Movimentações de ajuste manual registradas no mês.</p>
    <table class="w-full text-left text-sm">
      <thead><tr class="border-b dark:border-slate-600"><th class="p-2">Data</th><th class="p-2">Item</th><th class="p-2">Tipo</th><th class="p-2">Quantidade</th><th class="p-2">Valor (R$)</th><th class="p-2">Motivo</th></tr></thead>
      <tbody>
        @for(adj of data(); track adj.movementId) {
          <tr class="border-b dark:border-slate-700">
            <td class="p-2">{{adj.date | date:'dd/MM/yyyy'}}</td>
            <td class="p-2">{{adj.itemName}}</td>
            <td class="p-2">
              <span class="font-bold" [class.text-green-500]="adj.type === 'in'" [class.text-red-500]="adj.type === 'out'">
                {{ adj.type === 'in' ? 'Ganho' : 'Perda' }}
              </span>
            </td>
            <td class="p-2">{{adj.quantity}}</td>
            <td class="p-2">{{adj.value | currency:'BRL'}}</td>
            <td class="p-2 italic text-slate-500 dark:text-slate-400">{{adj.notes}}</td>
          </tr> 
        }
        @empty { <tr><td colspan="6" class="p-4 text-center">Nenhum ajuste de inventário no período.</td></tr> }
      </tbody>
    </table>
  `
})
class InventoryAdjustmentsReport { data = input.required<any[]>(); }

@Component({
  selector: 'app-anomaly-detection-report', standalone: true,
  imports: [CommonModule, DatePipe],
  template: `
    <h4 class="text-lg font-bold mb-4">Relatório de Detecção de Anomalias</h4>
    <div class="space-y-6">
      <div class="bg-slate-100 dark:bg-primary p-4 rounded-lg">
        <h5 class="font-semibold mb-2 text-accent">Resumo da Análise da IA</h5>
        <p class="text-sm text-slate-600 dark:text-slate-300">{{ data().summary }}</p>
      </div>
      <div>
        <h5 class="font-semibold mb-2">Anomalias Detectadas</h5>
        @if (data().anomalies.length > 0) {
          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm">
              <thead class="bg-slate-50 dark:bg-secondary">
                <tr>
                  <th class="p-2">Data</th>
                  <th class="p-2">Técnico</th>
                  <th class="p-2">Item</th>
                  <th class="p-2">Qtd.</th>
                  <th class="p-2">Motivo da Anomalia</th>
                  <th class="p-2">Severidade</th>
                </tr>
              </thead>
              <tbody>
                @for (anomaly of data().anomalies; track anomaly.movementId) {
                  <tr class="border-b border-slate-200 dark:border-slate-700">
                    <td class="p-2 whitespace-nowrap">{{ anomaly.date | date:'dd/MM/yy' }}</td>
                    <td class="p-2">{{ anomaly.technicianName }}</td>
                    <td class="p-2 font-medium">{{ anomaly.itemName }}</td>
                    <td class="p-2 text-center font-bold">{{ anomaly.quantity }}</td>
                    <td class="p-2 text-slate-600 dark:text-slate-300 italic">{{ anomaly.reason }}</td>
                    <td class="p-2">
                      <span class="px-2 py-1 rounded-full text-xs font-semibold"
                        [class.bg-yellow-100]="anomaly.severity === 'Baixa'" [class.text-yellow-800]="anomaly.severity === 'Baixa'"
                        [class.dark:bg-yellow-900]="anomaly.severity === 'Baixa'" [class.dark:text-yellow-200]="anomaly.severity === 'Baixa'"
                        [class.bg-orange-100]="anomaly.severity === 'Média'" [class.text-orange-800]="anomaly.severity === 'Média'"
                        [class.dark:bg-orange-900]="anomaly.severity === 'Média'" [class.dark:text-orange-200]="anomaly.severity === 'Média'"
                        [class.bg-red-100]="anomaly.severity === 'Alta'" [class.text-red-800]="anomaly.severity === 'Alta'"
                        [class.dark:bg-red-900]="anomaly.severity === 'Alta'" [class.dark:text-red-200]="anomaly.severity === 'Alta'">
                        {{ anomaly.severity }}
                      </span>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else {
          <div class="text-center p-6 text-green-600 dark:text-green-400 bg-slate-50 dark:bg-secondary/30 rounded-md">
            <p class="font-semibold">Nenhuma anomalia significativa foi encontrada nos dados analisados.</p>
          </div>
        }
      </div>
    </div>
  `
})
class AnomalyDetectionReport { data = input.required<AnomalyReport>(); }


@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [
    CommonModule, 
    ReactiveFormsModule, 
    DatePipe, 
    CurrencyPipe,
    TopConsumedReport,
    TechnicianActivityReport,
    AbcReport, 
    TurnoverReport, 
    SupplierReport, 
    AgingReport,
    CarryingCostReport,
    StockoutHistoryReport,
    SeasonalityReport,
    InventoryAdjustmentsReport,
    AnomalyDetectionReport,
    DashboardChartsComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-4 sm:p-6 h-full flex flex-col">
      <h2 class="text-2xl font-bold mb-6">Centro de Relatórios</h2>

      @if (!selectedReportCard()) {
        <!-- Report Selection View -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          @for (card of reportCards; track card.id) {
            <div class="bg-white dark:bg-primary p-6 rounded-lg shadow-md hover:shadow-xl transition-shadow flex flex-col">
              <div class="flex items-center mb-3">
                <div class="bg-accent/10 p-2 rounded-lg mr-4">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" [attr.d]="card.icon" />
                  </svg>
                </div>
                <h3 class="text-lg font-bold">{{ card.title }}</h3>
              </div>
              <p class="text-sm text-slate-500 dark:text-slate-400 flex-grow">{{ card.description }}</p>
              <button 
                (click)="selectReport(card)" 
                [disabled]="card.requiresAi && !geminiService.isConfigured()"
                class="mt-4 w-full bg-accent text-white px-4 py-2 rounded-md hover:bg-info transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                @if (card.requiresAi && !geminiService.isConfigured()) {
                  <span>Requer IA</span>
                } @else {
                  <span>Selecionar</span>
                }
              </button>
            </div>
          }
        </div>
      } @else {
        <!-- Report Generation View -->
        <div class="flex flex-col h-full">
          <!-- Filters Header -->
          <div class="bg-white dark:bg-primary p-4 rounded-lg mb-6 shadow-md">
            <div class="flex justify-between items-start">
                <div>
                  <div class="flex items-center gap-2">
                     <h3 class="text-xl font-bold">{{ selectedReportCard()?.title }}</h3>
                     @if(selectedReportCard()?.helpText) {
                        <button (click)="openHelpModal(selectedReportCard()!)" class="bg-slate-200 dark:bg-secondary text-accent w-6 h-6 rounded-full flex items-center justify-center font-bold text-sm hover:bg-slate-300 dark:hover:bg-primary transition-colors" title="Ajuda sobre este relatório">?</button>
                     }
                  </div>
                  <p class="text-sm text-slate-500 dark:text-slate-400">{{ selectedReportCard()?.description }}</p>
                </div>
                <button (click)="goBackToSelection()" class="text-sm text-accent hover:underline">Voltar</button>
            </div>
            <form [formGroup]="filtersForm">
              <div class="grid grid-cols-1 md:grid-cols-4 gap-4 items-end mt-4 pt-4 border-t border-slate-200 dark:border-secondary">
                @if (selectedReportCard()?.requiresMonth) {
                  <div>
                    <label class="block text-sm mb-1">Mês do Relatório</label>
                    <select formControlName="selectedMonth" class="bg-slate-100 dark:bg-secondary p-2 rounded w-full">
                      @for (month of availableMonths(); track month.value) {
                        <option [value]="month.value">{{ month.label }}</option>
                      }
                    </select>
                  </div>
                }
                 @if (selectedReportCard()?.id === 'carrying_cost') {
                  <div>
                      <label class="block text-sm mb-1">Taxa Anual de Custo (%)</label>
                      <input type="number" formControlName="carryingCostRate" min="0" class="bg-slate-100 dark:bg-secondary p-2 rounded w-full" />
                  </div>
                }
                <div class="flex items-center gap-2 md:col-start-4">
                  <button (click)="generateReport()" [disabled]="reportState().status === 'running'" class="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors w-full flex items-center justify-center gap-2 disabled:opacity-70">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" /><path fill-rule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h2a1 1 0 100-2H9z" clip-rule="evenodd" /></svg>
                    <span>Gerar Relatório</span>
                  </button>
                </div>
              </div>
            </form>
          </div>

          <!-- Report Content -->
          <div class="flex-grow overflow-auto bg-white dark:bg-secondary rounded-lg p-1 min-h-0">
            @if (isLoading()) {
              <div class="p-4 sm:p-6 h-full flex flex-col justify-center items-center">
                <div class="w-full max-w-lg text-center">
                  <h4 class="text-lg font-bold mb-4">Processando seu relatório...</h4>
                  <div class="relative w-full bg-slate-200 dark:bg-slate-600 rounded-full h-2.5 overflow-hidden">
                    <div class="absolute top-0 left-0 h-full w-full bg-accent animate-progress-bar"></div>
                  </div>
                  <p class="text-sm text-slate-500 dark:text-slate-400 mt-4">
                    Este processo está rodando em segundo plano. Você pode continuar navegando e será notificado quando estiver pronto.
                  </p>
                </div>
              </div>
            } @else if (generatedReportData(); as reportData) {
              <div class="p-4 sm:p-6">
                <div class="flex justify-end gap-2 mb-4">
                  <button (click)="exportToCsv()" class="bg-sky-600 text-white px-4 py-2 rounded-md hover:bg-sky-700 transition-colors text-sm">Exportar CSV</button>
                  @if(selectedReportCard()?.id === 'ai_monthly' || selectedReportCard()?.id === 'anomaly_detection' || selectedReportCard()?.id === 'predictive_maintenance' || selectedReportCard()?.id === 'ai_optimization') {
                    <button (click)="exportToPdf()" [disabled]="isExportingPdf()" class="bg-accent text-white px-4 py-2 rounded-md hover:bg-info transition-colors text-sm w-32 text-center">
                      @if(isExportingPdf()) {
                        <div class="w-5 h-5 border-2 border-slate-400 border-t-white rounded-full animate-spin mx-auto"></div>
                      } @else {
                        <span>Exportar PDF</span>
                      }
                    </button>
                  }
                </div>
                <div #reportContent>
                  @switch (selectedReportCard()?.id) {
                    @case ('ai_monthly') {
                      <div class="report-content-wrapper" [innerHTML]="reportData"></div>
                    }
                    @case ('ai_optimization') {
                      <div class="report-content-wrapper" [innerHTML]="reportData"></div>
                    }
                    @case ('top_consumed') { @defer { <app-top-consumed-report [data]="reportData" /> } }
                    @case ('technician_activity') { @defer { <app-technician-activity-report [data]="reportData" /> } }
                    @case ('abc') { @defer { <app-abc-report [data]="reportData" /> } }
                    @case ('turnover') { @defer { <app-turnover-report [data]="reportData" /> } }
                    @case ('supplier') { @defer { <app-supplier-report [data]="reportData" /> } }
                    @case ('aging') { @defer { <app-aging-report [data]="reportData" /> } }
                    @case ('carrying_cost') { @defer { <app-carrying-cost-report [data]="reportData" /> } }
                    @case ('stockout_history') { @defer { <app-stockout-history-report [data]="reportData" /> } }
                    @case ('seasonality') { @defer { <app-seasonality-report [data]="reportData" /> } }
                    @case ('inventory_adjustments') { @defer { <app-inventory-adjustments-report [data]="reportData" /> } }
                    @case ('anomaly_detection') { @defer { <app-anomaly-detection-report [data]="reportData" /> } }
                    @case ('predictive_maintenance') {
                      <div class="report-content-wrapper" [innerHTML]="reportData"></div>
                    }
                  }
                </div>
              </div>
            } @else {
              <div class="text-center p-10 text-slate-500 dark:text-slate-400">
                <p>Selecione os filtros e clique em "Gerar Relatório" para ver os dados.</p>
                 @if(reportState().status === 'error') {
                   <p class="mt-4 text-error font-semibold">Ocorreu um erro:</p>
                   <p class="text-sm text-red-400">{{ reportState().error }}</p>
                 }
              </div>
            }
          </div>
        </div>
      }
    </div>

    <!-- Help Modal -->
    @if(isHelpModalOpen() && helpModalContent()) {
      <div class="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
        <div class="bg-white dark:bg-primary p-6 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-xl font-bold text-accent">{{ helpModalContent()!.title }}</h3>
            <button (click)="closeHelpModal()" class="text-2xl">&times;</button>
          </div>
          <div class="flex-grow overflow-y-auto pr-4 space-y-4 text-slate-700 dark:text-slate-300">
            <div>
              <h4 class="font-bold text-lg mb-2">O que é?</h4>
              <p class="text-sm">{{ helpModalContent()!.helpText.whatIsIt }}</p>
            </div>
            <div>
              <h4 class="font-bold text-lg mb-2">Por que usar?</h4>
              <p class="text-sm">{{ helpModalContent()!.helpText.whyUseIt }}</p>
            </div>
          </div>
          <div class="flex justify-end mt-6 pt-4 border-t border-slate-200 dark:border-secondary">
            <button (click)="closeHelpModal()" class="px-4 py-2 bg-accent text-white rounded">Entendi</button>
          </div>
        </div>
      </div>
    }
  `
})
export class ReportsComponent implements OnDestroy {
  private dbService = inject(DatabaseService);
  geminiService = inject(GeminiService);
  private toastService = inject(ToastService);
  private reportGeneratorService = inject(ReportGeneratorService);
  private fb = inject(FormBuilder);
  db = this.dbService.db;
  
  reportContent = viewChild<ElementRef<HTMLDivElement>>('reportContent');

  // --- STATE ---
  selectedReportCard = signal<ReportCard | null>(null);
  reportState: Signal<import('../services/report-generator.service').ReportState>;
  
  isLoading: Signal<boolean>;
  generatedReportData: Signal<any>;
  
  isHelpModalOpen = signal(false);
  isExportingPdf = signal(false);
  helpModalContent = signal<{ title: string; helpText: { whatIsIt: string; whyUseIt: string; } } | null>(null);

  // --- FILTERS ---
  availableMonths = signal<{value: string, label: string}[]>([]);
  filtersForm: FormGroup;
  
  // --- UI DEFINITION ---
  reportCards: ReportCard[] = [
    { 
      id: 'ai_monthly', title: 'Resumo Mensal (IA)', 
      description: 'Um dashboard executivo gerado por IA com as principais métricas, insights e recomendações do mês.', 
      icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z', 
      requiresAi: true, 
      requiresMonth: true,
      helpText: {
        whatIsIt: 'Um dashboard executivo gerado por Inteligência Artificial que consolida as principais métricas de desempenho do almoxarifado para o mês selecionado. Ele inclui KPIs, análise de consumo, atividade dos técnicos e alertas.',
        whyUseIt: 'Para ter uma visão gerencial rápida e completa da operação mensal, identificando rapidamente os pontos mais importantes, gargalos e oportunidades de otimização sem precisar cruzar múltiplos relatórios manualmente.'
      }
    },
    { 
      id: 'ai_optimization', title: 'Otimização de Estoque (IA)', 
      description: 'Análise de IA sobre a saúde do inventário com sugestões para reduzir custos e evitar rupturas.', 
      icon: 'M13 17h8m0 0V9m0 8l-8-8-4 4-6-6',
      requiresAi: true, 
      requiresMonth: false,
      helpText: {
        whatIsIt: 'Um consultor de IA que analisa todo o seu inventário para identificar itens de baixo giro, pontos de ressuprimento mal ajustados e oportunidades de redução de custo em itens de alto valor.',
        whyUseIt: 'Para transformar dados brutos em ações claras. Este relatório ajuda a reduzir custos com estoque parado, evitar a falta de itens críticos e otimizar o capital de giro da empresa.'
      }
    },
    { 
      id: 'anomaly_detection', title: 'Detecção de Anomalias', 
      description: 'Auditoria com IA que analisa as saídas recentes em busca de padrões de consumo incomuns ou suspeitos.', 
      icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7', 
      requiresAi: true, 
      requiresMonth: false,
      helpText: {
        whatIsIt: 'Uma auditoria proativa realizada por Inteligência Artificial que examina as movimentações de saída dos últimos 90 dias. Ela procura por padrões que fogem do normal, como retiradas de quantidades atípicas, frequência elevada por um mesmo técnico, ou qualquer outro comportamento suspeito.',
        whyUseIt: 'Para identificar rapidamente possíveis desperdícios, uso indevido de material ou até mesmo fraudes. É uma ferramenta de segurança que ajuda a garantir a integridade do seu inventário e a encontrar problemas que passariam despercebidos em uma análise manual.'
      }
    },
    { 
      id: 'predictive_maintenance', title: 'Manutenção Preditiva', 
      description: 'Análise de IA sobre o consumo de peças para prever falhas e sugerir manutenções proativas.', 
      icon: 'M9 19V6.873a2 2 0 01.586-1.414l2.293-2.293a1 1 0 011.414 0l2.293 2.293A2 2 0 0116 6.873V19m-7-9v9m7-9v9m-7-9h7.5l-3.75-5.25L9 10z', 
      requiresAi: true, 
      requiresMonth: false,
      helpText: {
        whatIsIt: 'Uma análise de Inteligência Artificial que examina o histórico de consumo de peças para identificar ciclos de troca e padrões que antecedem falhas de equipamentos.',
        whyUseIt: 'Para sair da manutenção reativa ("quebrou-consertou") e ir para a proativa. Este relatório ajuda a agendar trocas de componentes antes que eles falhem, aumentando a confiabilidade dos equipamentos e reduzindo paradas não programadas.'
      }
    },
    { 
      id: 'top_consumed', title: 'Itens Mais Consumidos', 
      description: 'Ranking dos itens com maior saída em quantidade e em valor financeiro no período.', 
      icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6', 
      requiresMonth: true,
      helpText: {
        whatIsIt: 'Um ranking que lista os itens com maior volume de saída durante o mês, tanto em quantidade de unidades quanto em valor financeiro (R$).',
        whyUseIt: 'Essencial para focar a atenção nos itens que têm maior impacto no estoque. Itens de alto consumo (especialmente em valor) exigem um controle mais rigoroso de estoque e negociações melhores com fornecedores.'
      }
    },
    { 
      id: 'technician_activity', title: 'Atividade por Técnico', 
      description: 'Sumário de retiradas por técnico, mostrando o volume e o valor total dos itens consumidos.', 
      icon: 'M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z', 
      requiresMonth: true,
      helpText: {
        whatIsIt: 'Um sumário que mostra quantos itens e qual o valor total que cada técnico retirou do almoxarifado durante o período.',
        whyUseIt: 'Ajuda a entender a demanda por material de diferentes equipes ou técnicos. Pode ser usado para planejamento de materiais para projetos específicos ou para identificar padrões de consumo fora do comum.'
      }
    },
    { 
      id: 'abc', title: 'Curva ABC', 
      description: 'Classifica os itens por relevância (valor de consumo), ajudando a priorizar a gestão de estoque.', 
      icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2z', 
      requiresMonth: true,
      helpText: {
        whatIsIt: 'Uma ferramenta de gestão que classifica os itens em três categorias (A, B e C) com base no seu valor de consumo. Classe A: poucos itens, mas de altíssimo valor. Classe B: valor intermediário. Classe C: muitos itens, mas de baixo valor.',
        whyUseIt: 'Para priorizar os esforços de gestão. Itens da Classe A merecem atenção máxima (contagens cíclicas frequentes, negociação de preço), enquanto itens da Classe C podem ter um controle mais simplificado.'
      }
    },
    { 
      id: 'turnover', title: 'Giro de Estoque', 
      description: 'Mede a eficiência do estoque. Um giro alto indica boa gestão. (Cálculo aprimorado)', 
      icon: 'M13 10V3L4 14h7v7l9-11h-7z', 
      requiresMonth: true,
      helpText: {
        whatIsIt: 'Um indicador que mede quantas vezes o estoque de um item foi completamente renovado (consumido e reposto) durante um período.',
        whyUseIt: 'É um termômetro da saúde do seu estoque. Um giro alto é geralmente bom, indicando que os produtos não ficam parados. Um giro baixo pode sinalizar excesso de estoque, obsolescência ou baixa demanda.'
      }
    },
    { 
      id: 'supplier', title: 'Análise de Fornecedores', 
      description: 'Avalia os fornecedores com base no volume e valor dos itens fornecidos que foram consumidos.', 
      icon: 'M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM18 8a1 1 0 01-1 1H4.41l1.42 1.42a1 1 0 11-1.41 1.41L1.71 9.12a1 1 0 010-1.41L4.41 5.17a1 1 0 011.41 1.41L4.41 8H17a1 1 0 011 1z', 
      requiresMonth: true,
      helpText: {
        whatIsIt: 'Um relatório que agrupa o consumo de itens por fornecedor, mostrando quais fornecedores são mais críticos para a sua operação com base no volume e valor dos itens fornecidos.',
        whyUseIt: 'Fundamental para a gestão de compras e relacionamento com fornecedores. Ajuda a identificar dependências, a preparar negociações e a avaliar o desempenho de cada parceiro.'
      }
    },
    { 
      id: 'aging', title: 'Idade do Estoque', 
      description: 'Identifica itens parados no estoque por longos períodos, com risco de obsolescência.', 
      icon: 'M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z', 
      requiresMonth: false,
      helpText: {
        whatIsIt: 'Um relatório que lista os itens em estoque e há quantos dias eles não têm uma movimentação de saída.',
        whyUseIt: 'É a principal ferramenta para combater a obsolescência. Itens parados há muito tempo representam capital empatado e risco de perda. Este relatório ajuda a identificar quais produtos precisam de uma ação (promoção, devolução, descarte).'
      }
    },
    { 
      id: 'carrying_cost', title: 'Custo de Manutenção', 
      description: 'Estima o custo financeiro de manter os itens em estoque (seguro, armazenamento, obsolescência).', 
      icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z', 
      requiresMonth: true,
      helpText: {
        whatIsIt: 'Uma estimativa financeira de quanto custa para manter o seu estoque (inclui custos de armazenamento, seguro, perdas, etc.). É calculado como uma porcentagem do valor do estoque médio.',
        whyUseIt: 'Transforma o conceito de "estoque parado" em um número financeiro claro (R$). Ajuda a justificar investimentos em otimização e a conscientizar a equipe sobre o impacto financeiro de manter excesso de material.'
      }
    },
    { 
      id: 'stockout_history', title: 'Histórico de Ruptura', 
      description: 'Identifica itens que atingiram estoque zero, destacando falhas no ponto de ressuprimento.', 
      icon: 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636', 
      requiresMonth: true,
      helpText: {
        whatIsIt: 'Um registro de todos os itens que atingiram estoque zero (ou negativo) durante o mês, indicando que uma necessidade não pôde ser atendida.',
        whyUseIt: 'É um dos KPIs mais importantes. Mede a eficácia do seu ponto de ressuprimento e do seu planejamento. Analisar as rupturas passadas é crucial para ajustar os parâmetros de estoque e evitar que faltem materiais críticos no futuro.'
      }
    },
    { 
      id: 'seasonality', title: 'Análise de Sazonalidade', 
      description: 'Mostra o consumo total mês a mês para identificar tendências e padrões sazonais de longo prazo.', 
      icon: 'M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z', 
      requiresMonth: false,
      helpText: {
        whatIsIt: 'Um gráfico que exibe o valor total de consumo mês a mês ao longo do tempo, permitindo visualizar picos e vales de demanda.',
        whyUseIt: 'Essencial para o planejamento de longo prazo. Ajuda a antecipar aumentos de demanda sazonais (ex: mais peças de ar condicionado no verão) e a identificar tendências de crescimento ou queda no consumo geral.'
      }
    },
    { 
      id: 'inventory_adjustments', title: 'Relatório de Ajustes', 
      description: 'Audita todos os ajustes manuais de inventário, quantificando perdas e ganhos.', 
      icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', 
      requiresMonth: true,
      helpText: {
        whatIsIt: 'Um log de auditoria focado apenas nas movimentações de ajuste manual de estoque, mostrando as perdas (ajustes negativos) e ganhos (ajustes positivos).',
        whyUseIt: 'Divergências entre o estoque físico e o sistema são um problema sério. Este relatório ajuda a identificar quais itens sofrem mais ajustes e os motivos, apontando para possíveis falhas de processo, furtos ou problemas de registro que precisam ser corrigidos.'
      }
    }
  ];

  constructor() {
    this.reportState = this.reportGeneratorService.state;

    this.isLoading = computed(() => {
      const state = this.reportState();
      // Only show loading if the currently selected report is running
      return state.status === 'running' && state.reportId === this.selectedReportCard()?.id;
    });
  
    this.generatedReportData = computed(() => {
      const state = this.reportState();
      const card = this.selectedReportCard();
      if (!card) return null;
      
      const currentFilters = this.getCurrentFilters();
      if (state.status === 'success' && state.reportId === card.id && JSON.stringify(state.filters) === JSON.stringify(currentFilters)) {
        return state.data;
      }
      return null;
    });

    this.calculateAvailableMonths();
    this.reportGeneratorService.setReportsComponentActive(true);

    this.filtersForm = this.fb.group({
        selectedMonth: [this.availableMonths()[0]?.value || ''],
        carryingCostRate: [25, [Validators.required, Validators.min(0)]]
    });

    effect(() => {
        const months = this.availableMonths();
        if (months.length > 0 && this.filtersForm) {
            this.filtersForm.get('selectedMonth')?.setValue(months[0].value, { emitEvent: false });
        }
    });
  }

  ngOnDestroy(): void {
    this.reportGeneratorService.setReportsComponentActive(false);
  }

  // --- UI ACTIONS ---
  selectReport(card: ReportCard) {
    this.selectedReportCard.set(card);
  }

  goBackToSelection() {
    this.selectedReportCard.set(null);
  }
  
  private getCurrentFilters() {
    const selectedMonth = this.filtersForm.get('selectedMonth')?.value;
    return {
        selectedMonth: selectedMonth,
        carryingCostRate: this.filtersForm.get('carryingCostRate')?.value,
        monthLabel: this.availableMonths().find(m => m.value === selectedMonth)?.label || '',
    };
  }

  generateReport() {
    const reportId = this.selectedReportCard()?.id;
    if (!reportId) return;
    this.reportGeneratorService.generateReport(reportId, this.db(), this.getCurrentFilters());
  }

  async exportToPdf() {
    const content = this.reportContent()?.nativeElement;
    if (!content) {
      this.toastService.addToast('Conteúdo do relatório não encontrado.', 'error');
      return;
    }
    try {
      this.isExportingPdf.set(true);
      this.toastService.addToast('Preparando PDF... Isso pode levar alguns segundos.', 'info');
      
      const isDarkMode = document.documentElement.classList.contains('dark');
      
      await new Promise(resolve => setTimeout(resolve, 100));

      const canvas = await html2canvas(content, {
        scale: 2,
        backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
        useCORS: true,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jspdf.jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = position - pageHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      
      const card = this.selectedReportCard();
      const monthValue = this.filtersForm.get('selectedMonth')?.value;
      const datePart = card?.requiresMonth ? `_${monthValue}` : `_${new Date().toISOString().split('T')[0]}`;
      pdf.save(`relatorio_${card?.id}${datePart}.pdf`);

      this.toastService.addToast('PDF exportado com sucesso!', 'success');

    } catch(e) {
      console.error('PDF export error:', e);
      this.toastService.addToast('Falha ao exportar para PDF.', 'error');
    } finally {
      this.isExportingPdf.set(false);
    }
  }

  exportToCsv() {
    const reportId = this.selectedReportCard()?.id;
    if (!reportId || !this.generatedReportData()) {
        this.toastService.addToast('Não há dados para exportar.', 'info');
        return;
    }
    let headers: string[] = [];
    let rows: (string|number)[][] = [];
    const data = this.generatedReportData();

    switch(reportId) {
      case 'top_consumed':
        headers = ['Ranking', 'Item (por Valor)', 'Valor Total (R$)', 'Item (por Quantidade)', 'Quantidade Total'];
        rows = data.byValue.map((item: any, index: number) => [
          index + 1,
          item.itemName,
          item.totalValue,
          data.byQuantity[index]?.itemName || '',
          data.byQuantity[index]?.totalQuantity || '',
        ]);
        break;
      case 'technician_activity':
        headers = ['Técnico', 'Nº de Requisições', 'Total de Itens', 'Valor Total (R$)'];
        rows = data.map((tech: any) => [tech.technicianName, tech.requisitionCount, tech.totalItems, tech.totalValue]);
        break;
      case 'abc':
        headers = ['Item', 'Valor de Consumo (R$)', '% Acumulado', 'Classe'];
        rows = data.map((item: any) => [item.itemName, item.totalValue.toFixed(2), item.cumulativePercentage.toFixed(2), item.class]);
        break;
      case 'turnover':
        headers = ['Item', 'Estoque Médio (R$)', 'Custo das Saídas (R$)', 'Giro de Estoque'];
        rows = data.map((item: any) => [item.itemName, item.avgStockValue.toFixed(2), item.costOfGoodsSold.toFixed(2), item.turnover.toFixed(2)]);
        break;
      case 'supplier':
        headers = ['Fornecedor', 'Itens Únicos Fornecidos', 'Valor de Saída', 'Quantidade de Saída'];
        rows = data.map((s: any) => [s.supplierName, s.distinctItems, s.totalValue, s.totalQuantity]);
        break;
      case 'aging':
        headers = ['Item', 'Estoque Atual', 'Dias Desde a Última Saída'];
        rows = data.map((item: any) => [item.itemName, item.quantity, item.daysSinceLastExit]);
        break;
      case 'carrying_cost':
        headers = ['Item', 'Estoque Médio (R$)', 'Custo Mensal Estimado (R$)'];
        rows = data.reportData.map((item: any) => [item.itemName, item.avgStockValue, item.monthlyCost]);
        rows.push(['TOTAL', '', data.totalMonthlyCost]);
        break;
      case 'stockout_history':
        headers = ['Item', 'Data da Primeira Ruptura'];
        rows = data.map((item: any) => [item.itemName, new Date(item.stockoutDate).toLocaleDateString('pt-BR')]);
        break;
      case 'seasonality':
        headers = ['Mês', 'Valor Consumido (R$)'];
        rows = data.map((item: any) => [item.name, item.value]);
        break;
      case 'inventory_adjustments':
        headers = ['Data', 'Item', 'Tipo', 'Quantidade', 'Valor (R$)', 'Motivo'];
        rows = data.map((adj: any) => [
            new Date(adj.date).toLocaleDateString('pt-BR'),
            adj.itemName,
            adj.type === 'in' ? 'Ganho' : 'Perda',
            adj.quantity,
            adj.value,
            `"${(adj.notes || '').replace(/"/g, '""')}"` // Escape quotes for CSV
        ]);
        break;
      case 'anomaly_detection':
        headers = ['Data', 'Técnico', 'Item', 'Quantidade', 'Motivo da Anomalia', 'Severidade'];
        rows = data.anomalies.map((a: any) => [
            new Date(a.date).toLocaleDateString('pt-BR'),
            a.technicianName,
            a.itemName,
            a.quantity,
            `"${(a.reason || '').replace(/"/g, '""')}"`,
            a.severity
        ]);
        break;
      default:
        this.toastService.addToast('Exportação CSV não disponível para este relatório.', 'info');
        return;
    }
    const card = this.selectedReportCard();
    const monthValue = this.filtersForm.get('selectedMonth')?.value;
    const datePart = card?.requiresMonth ? `_${monthValue}` : `_${new Date().toISOString().split('T')[0]}`;
    this.downloadCsv(`relatorio_${reportId}${datePart}`, [headers, ...rows]);
  }
  
  // --- HELPERS ---
  openHelpModal(card: ReportCard) {
    if (card.helpText) {
      this.helpModalContent.set({ title: card.title, helpText: card.helpText });
      this.isHelpModalOpen.set(true);
    }
  }

  closeHelpModal() {
    this.isHelpModalOpen.set(false);
  }

  private calculateAvailableMonths() {
    const movements = this.db().movements;
    
    if (movements.length === 0) {
        const date = new Date();
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const value = `${year}-${month}`;
        const label = date.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
        const currentMonth = { value, label: label.charAt(0).toUpperCase() + label.slice(1) };
        this.availableMonths.set([currentMonth]);
        return;
    }

    const dates = movements.map(m => new Date(m.date));
    const minDate = dates.reduce((min, d) => d < min ? d : min, dates[0]);
    const maxDate = dates.reduce((max, d) => d > max ? d : max, dates[0]);
    
    const monthSet = new Set<string>();
    let currentDate = new Date(minDate.getFullYear(), minDate.getMonth(), 1);

    while (currentDate <= maxDate) {
      const year = currentDate.getFullYear();
      const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
      monthSet.add(`${year}-${month}`);
      currentDate.setMonth(currentDate.getMonth() + 1);
    }
    
    const sortedMonths = Array.from(monthSet).sort().reverse();
    const monthLabels = sortedMonths.map(m => {
      const [year, month] = m.split('-');
      const date = new Date(Number(year), Number(month) - 1, 1);
      const label = date.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
      return { value: m, label: label.charAt(0).toUpperCase() + label.slice(1) };
    });
    
    this.availableMonths.set(monthLabels);
  }

  private downloadCsv(filename: string, rows: (string|number)[][]) {
    const csvContent = rows.map(e => e.join(',')).join('\n');
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(String(url));
    this.toastService.addToast('Relatório CSV baixado!', 'success');
  }
}