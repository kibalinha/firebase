import { Component, ChangeDetectionStrategy, inject, computed, signal, viewChild, ElementRef, input, effect, OnDestroy, Signal } from '@angular/core';
import { CommonModule, DatePipe, CurrencyPipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DatabaseService } from '../services/database.service';
import { GeminiService } from '../services/gemini.service';
import { ToastService } from '../services/toast.service';
import { ReportGeneratorService } from '../services/report-generator.service';
import { Item, ReportType, AnomalyReport, AlmoxarifadoDB } from '../models';
import { DashboardChartsComponent, DonutChartData, LineChartData } from './dashboard-charts.component';
import { D3Service } from '../services/d3.service';


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
            <td class="p-2">{{tech.technicianName}}</td>
            <td class="p-2 text-center">{{tech.requisitionCount}}</td>
            <td class="p-2 text-center">{{tech.totalItems}}</td>
            <td class="p-2 text-right">{{tech.totalValue | currency:'BRL'}}</td>
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
      <thead><tr class="border-b dark:border-slate-600"><th class="p-2">Item</th><th class="p-2">Valor Total Consumido</th><th class="p-2">% Acumulada</th><th class="p-2">Classe</th></tr></thead>
      <tbody>
        @for(item of data(); track item.itemId) {
          <tr class="border-b dark:border-slate-700">
            <td class="p-2">{{item.itemName}}</td>
            <td class="p-2">{{item.totalValue | currency:'BRL'}}</td>
            <td class="p-2">{{item.cumulativePercentage.toFixed(2)}}%</td>
            <td class="p-2 font-bold">{{item.class}}</td>
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
      <thead><tr class="border-b dark:border-slate-600"><th class="p-2">Item</th><th class="p-2">Custo Mercadoria Vendida (CMV)</th><th class="p-2">Estoque Médio</th><th class="p-2">Giro</th></tr></thead>
      <tbody>
        @for(item of data(); track item.itemName) {
          <tr class="border-b dark:border-slate-700">
            <td class="p-2">{{item.itemName}}</td>
            <td class="p-2">{{item.costOfGoodsSold | currency:'BRL'}}</td>
            <td class="p-2">{{item.avgStockValue | currency:'BRL'}}</td>
            <td class="p-2 font-bold">{{item.turnover.toFixed(2)}}</td>
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
    <h4 class="text-lg font-bold mb-4">Relatório de Desempenho por Fornecedor</h4>
    <table class="w-full text-left text-sm">
      <thead><tr class="border-b dark:border-slate-600"><th class="p-2">Fornecedor</th><th class="p-2">Valor Total Consumido</th><th class="p-2">Qtd. Total</th><th class="p-2">Itens Distintos</th></tr></thead>
      <tbody>
        @for(s of data(); track s.supplierName) {
          <tr class="border-b dark:border-slate-700">
            <td class="p-2">{{s.supplierName}}</td>
            <td class="p-2">{{s.totalValue | currency:'BRL'}}</td>
            <td class="p-2">{{s.totalQuantity}}</td>
            <td class="p-2">{{s.distinctItems}}</td>
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
    <h4 class="text-lg font-bold mb-4">Relatório de Envelhecimento de Estoque (Aging)</h4>
    <table class="w-full text-left text-sm">
      <thead><tr class="border-b dark:border-slate-600"><th class="p-2">Item</th><th class="p-2">Estoque Atual</th><th class="p-2">Dias desde a Última Saída</th></tr></thead>
      <tbody>
        @for(item of data(); track item.itemName) {
          <tr class="border-b dark:border-slate-700">
            <td class="p-2">{{item.itemName}}</td>
            <td class="p-2">{{item.quantity}}</td>
            <td class="p-2">{{item.daysSinceLastExit < 0 ? 'Nunca saiu' : item.daysSinceLastExit }}</td>
          </tr>
        }
        @empty { <tr><td colspan="3" class="p-4 text-center">Nenhum item com estoque.</td></tr> }
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
    <p class="text-sm mb-4">Custo mensal estimado para manter os itens em estoque, baseado na taxa de {{ data().rate }}% ao ano.</p>
    <p class="font-bold mb-4">Custo Total no Mês: {{ data().totalMonthlyCost | currency:'BRL' }}</p>
    <table class="w-full text-left text-sm">
      <thead><tr class="border-b dark:border-slate-600"><th class="p-2">Item</th><th class="p-2">Valor Médio em Estoque</th><th class="p-2">Custo Mensal Estimado</th></tr></thead>
      <tbody>
        @for(item of data().reportData; track item.itemName) {
          <tr class="border-b dark:border-slate-700">
            <td class="p-2">{{item.itemName}}</td>
            <td class="p-2">{{item.avgStockValue | currency:'BRL'}}</td>
            <td class="p-2">{{item.monthlyCost | currency:'BRL'}}</td>
          </tr>
        }
        @empty { <tr><td colspan="3" class="p-4 text-center">Nenhum item com estoque no período.</td></tr> }
      </tbody>
    </table>
  `
})
class CarryingCostReport { data = input.required<{ reportData: any[], totalMonthlyCost: number, rate: number }>(); }

@Component({
  selector: 'app-stockout-history-report', standalone: true,
  imports: [CommonModule, DatePipe],
  template: `
    <h4 class="text-lg font-bold mb-4">Histórico de Ruptura de Estoque (Stockout)</h4>
    <table class="w-full text-left text-sm">
      <thead><tr class="border-b dark:border-slate-600"><th class="p-2">Item</th><th class="p-2">Data da Ruptura</th></tr></thead>
      <tbody>
        @for(item of data(); track $index) {
          <tr class="border-b dark:border-slate-700">
            <td class="p-2">{{item.itemName}}</td>
            <td class="p-2">{{item.stockoutDate | date:'dd/MM/yyyy'}}</td>
          </tr>
        }
        @empty { <tr><td colspan="2" class="p-4 text-center">Nenhuma ruptura de estoque no período.</td></tr> }
      </tbody>
    </table>
  `
})
class StockoutHistoryReport { data = input.required<any[]>(); }

@Component({
  selector: 'app-seasonality-report', standalone: true,
  imports: [CommonModule, DashboardChartsComponent],
  template: `
    <h4 class="text-lg font-bold mb-4">Análise de Sazonalidade (Consumo por Valor)</h4>
    <div class="h-96">
      <app-dashboard-charts [data]="chartData()" type="bar" valueFormat="value" />
    </div>
  `
})
class SeasonalityReport implements OnDestroy {
  d3Service = inject(D3Service);
  data = input.required<DonutChartData[]>();
  chartData: Signal<LineChartData | null> = computed(() => {
    const reportData = this.data();
    if (!reportData || reportData.length === 0) return null;
    return {
      labels: reportData.map(d => d.name),
      series: [{
        name: 'Consumo (R$)',
        values: reportData.map(d => d.value),
        color: '#c72127'
      }]
    };
  });
  ngOnDestroy(): void {
    this.d3Service.hideTooltip();
  }
}

@Component({
  selector: 'app-inventory-adjustments-report', standalone: true,
  imports: [CommonModule, DatePipe, CurrencyPipe],
  template: `
    <h4 class="text-lg font-bold mb-4">Relatório de Ajustes de Inventário</h4>
    <table class="w-full text-left text-sm">
      <thead><tr class="border-b dark:border-slate-600"><th class="p-2">Data</th><th class="p-2">Item</th><th class="p-2">Tipo</th><th class="p-2">Qtd.</th><th class="p-2">Valor</th><th class="p-2">Notas</th></tr></thead>
      <tbody>
        @for(item of data(); track item.movementId) {
          <tr class="border-b dark:border-slate-700">
            <td class="p-2">{{item.date | date:'dd/MM/yyyy HH:mm'}}</td>
            <td class="p-2">{{item.itemName}}</td>
            <td class="p-2">
              @if(item.type === 'in') { <span class="text-green-600">Entrada</span> } @else { <span class="text-red-600">Saída</span> }
            </td>
            <td class="p-2">{{item.quantity}}</td>
            <td class="p-2">{{item.value | currency:'BRL'}}</td>
            <td class="p-2 italic">{{item.notes}}</td>
          </tr>
        }
        @empty { <tr><td colspan="6" class="p-4 text-center">Nenhum ajuste no período.</td></tr> }
      </tbody>
    </table>
  `
})
class InventoryAdjustmentsReport { data = input.required<any[]>(); }

@Component({
  selector: 'app-ai-report', standalone: true,
  imports: [CommonModule],
  template: `<div class="report-content-wrapper" [innerHTML]="data()"></div>`
})
class AiReport { data = input.required<string>(); }

@Component({
  selector: 'app-anomaly-report', standalone: true,
  imports: [CommonModule, DatePipe],
  template: `
    <div class="space-y-6">
      <div class="bg-white dark:bg-primary p-6 rounded-lg shadow-md">
        <h3 class="text-xl font-bold mb-3 text-accent">Resumo da Análise</h3>
        <p class="text-slate-600 dark:text-slate-300">{{ data().summary }}</p>
      </div>
      <div class="bg-white dark:bg-primary p-6 rounded-lg shadow-md">
        <h3 class="text-xl font-bold mb-4">Anomalias Detectadas</h3>
        @if (data().anomalies.length > 0) {
          <table class="w-full text-left text-sm">
            <thead><tr class="border-b dark:border-slate-600"><th class="p-2">Data</th><th class="p-2">Técnico</th><th class="p-2">Item</th><th class="p-2">Qtd.</th><th class="p-2">Motivo</th><th class="p-2">Severidade</th></tr></thead>
            <tbody>
              @for (anomaly of data().anomalies; track anomaly.movementId) {
                <tr class="border-b dark:border-slate-700">
                  <td class="p-2">{{ anomaly.date | date:'dd/MM/yy' }}</td>
                  <td class="p-2">{{ anomaly.technicianName }}</td>
                  <td class="p-2 font-medium">{{ anomaly.itemName }}</td>
                  <td class="p-2 text-center font-bold">{{ anomaly.quantity }}</td>
                  <td class="p-2 italic">{{ anomaly.reason }}</td>
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
        } @else {
          <p class="text-center p-10 text-green-600 dark:text-green-400">Nenhuma anomalia significativa foi encontrada.</p>
        }
      </div>
    </div>
  `
})
class AnomalyReportDisplay { data = input.required<AnomalyReport>(); }

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, DatePipe, CurrencyPipe,
    TopConsumedReport, TechnicianActivityReport, AbcReport, TurnoverReport, SupplierReport, AgingReport,
    CarryingCostReport, StockoutHistoryReport, SeasonalityReport, InventoryAdjustmentsReport, AiReport, AnomalyReportDisplay
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-4 sm:p-6 h-full flex flex-col">
      <h2 class="text-2xl font-bold mb-6">Relatórios e Análises</h2>
      <div class="flex flex-col lg:flex-row gap-6 h-full min-h-0">

        <!-- Sidebar -->
        <div class="lg:w-1/4 xl:w-1/5 shrink-0 bg-white dark:bg-primary p-4 rounded-lg shadow-md overflow-y-auto">
          <h3 class="font-bold mb-4 text-slate-800 dark:text-slate-100">Selecionar Relatório</h3>
          <ul class="space-y-1">
            @for(report of availableReports; track report.id) {
              <li>
                <button 
                  (click)="selectReport(report)"
                  class="w-full text-left p-2.5 rounded-md text-sm flex items-center gap-3 transition-colors duration-200"
                  [class.bg-accent]="report.id === reportState().reportId"
                  [class.text-white]="report.id === reportState().reportId"
                  [class.hover:bg-slate-100]="report.id !== reportState().reportId"
                  [class.dark:hover:bg-secondary]="report.id !== reportState().reportId"
                  [class.disabled:opacity-50]="report.requiresAi && !geminiService.isConfigured()"
                  [disabled]="report.requiresAi && !geminiService.isConfigured()"
                  [title]="(report.requiresAi && !geminiService.isConfigured()) ? 'Requer configuração da API do Gemini' : ''"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" [attr.d]="report.icon" clip-rule="evenodd" /></svg>
                  <span class="flex-grow">{{ report.title }}</span>
                  @if (report.requiresAi) { 
                    <span class="text-xs font-bold" [class.text-white/70]="report.id === reportState().reportId" [class.text-accent]="report.id !== reportState().reportId">✨</span> 
                  }
                </button>
              </li>
            }
          </ul>
        </div>

        <!-- Main Content -->
        <div class="flex-grow bg-white dark:bg-primary p-6 rounded-lg shadow-md flex flex-col overflow-y-auto min-h-0">
          @if (selectedReport(); as report) {
            <div class="flex-grow flex flex-col">
              <header class="border-b border-slate-200 dark:border-secondary pb-4 mb-4">
                <div class="flex justify-between items-start">
                  <div>
                    <h3 class="text-xl font-bold text-slate-800 dark:text-slate-100">{{ report.title }}</h3>
                    <p class="text-sm text-slate-500 dark:text-slate-400">{{ report.description }}</p>
                  </div>
                   <button (click)="isHelpOpen.set(!isHelpOpen())" class="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-secondary">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" /></svg>
                   </button>
                </div>
                @if (isHelpOpen() && report.helpText) {
                  <div class="mt-4 p-4 bg-slate-50 dark:bg-secondary rounded-md text-sm text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    <p><strong class="font-semibold">O que é?</strong> {{ report.helpText.whatIsIt }}</p>
                    <p class="mt-2"><strong class="font-semibold">Por que usar?</strong> {{ report.helpText.whyUseIt }}</p>
                  </div>
                }
              </header>
              <form [formGroup]="filterForm" (ngSubmit)="generateReport()" class="mb-4">
                <div class="flex gap-4 items-end">
                  @if (report.requiresMonth) {
                     <div>
                       <label class="block text-sm font-medium mb-1">Mês de Análise</label>
                       <input type="month" formControlName="selectedMonth" class="bg-slate-100 dark:bg-secondary p-2 rounded border border-slate-300 dark:border-slate-600">
                     </div>
                  }
                  @if (report.id === 'carrying_cost') {
                    <div>
                      <label class="block text-sm font-medium mb-1">Taxa de Manutenção Anual (%)</label>
                      <input type="number" formControlName="carryingCostRate" class="bg-slate-100 dark:bg-secondary p-2 rounded w-48 border border-slate-300 dark:border-slate-600">
                    </div>
                  }
                  <button type="submit" [disabled]="reportState().status === 'running' || filterForm.invalid" class="bg-accent text-white px-4 py-2 rounded-md h-fit disabled:opacity-50">
                    Gerar Relatório
                  </button>
                </div>
              </form>

              <div class="flex-grow pt-4 border-t border-slate-200 dark:border-secondary overflow-y-auto">
                @switch (reportState().status) {
                  @case ('idle') { 
                    <div class="text-center text-slate-500 py-10">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto text-slate-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1"><path stroke-linecap="round" stroke-linejoin="round" d="M9 17v-4h4v4H9zM3 2a1 1 0 00-1 1v14a1 1 0 001 1h14a1 1 0 001-1V3a1 1 0 00-1-1H3zm3 2h8v2H6V4z" /></svg>
                      Preencha os filtros acima e clique em "Gerar Relatório" para começar.
                    </div>
                   }
                  @case ('running') {
                    <div class="flex flex-col items-center justify-center h-full">
                        <p class="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-4">A IA está analisando os dados...</p>
                        <div class="w-full bg-slate-200 dark:bg-secondary rounded-full h-2 overflow-hidden">
                           <div class="h-full bg-accent animate-progress-bar"></div>
                        </div>
                        <p class="text-sm text-slate-500 dark:text-slate-400 mt-2">Isso pode levar alguns instantes.</p>
                    </div>
                  }
                  @case('success') {
                    @switch(reportState().reportId) {
                      @case('top_consumed') { <app-top-consumed-report [data]="reportState().data"/> }
                      @case('technician_activity') { <app-technician-activity-report [data]="reportState().data"/> }
                      @case('abc') { <app-abc-report [data]="reportState().data"/> }
                      @case('turnover') { <app-turnover-report [data]="reportState().data"/> }
                      @case('supplier') { <app-supplier-report [data]="reportState().data"/> }
                      @case('aging') { <app-aging-report [data]="reportState().data"/> }
                      @case('carrying_cost') { <app-carrying-cost-report [data]="reportState().data"/> }
                      @case('stockout_history') { <app-stockout-history-report [data]="reportState().data"/> }
                      @case('seasonality') { <app-seasonality-report [data]="reportState().data"/> }
                      @case('inventory_adjustments') { <app-inventory-adjustments-report [data]="reportState().data"/> }
                      @case('ai_monthly') { <app-ai-report [data]="reportState().data"/> }
                      @case('ai_optimization') { <app-ai-report [data]="reportState().data"/> }
                      @case('predictive_maintenance') { <app-ai-report [data]="reportState().data"/> }
                      @case('anomaly_detection') { <app-anomaly-report [data]="reportState().data"/> }
                    }
                  }
                  @case('error') {
                     <div class="text-center p-10 text-error">
                        <p class="font-semibold">Ocorreu um erro ao gerar o relatório.</p>
                        <p class="text-sm mt-2">{{ reportState().error }}</p>
                    </div>
                  }
                }
              </div>
            </div>
          } @else {
            <div class="flex flex-col items-center justify-center h-full text-center text-slate-500 dark:text-slate-400">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 text-slate-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                </svg>
                <h3 class="text-lg font-semibold text-slate-700 dark:text-slate-200">Insights Poderosos Esperam por Você</h3>
                <p class="mt-1">Selecione um relatório na lista ao lado para começar a explorar seus dados.</p>
            </div>
          }
        </div>
      </div>
    </div>
  `
})
export class ReportsComponent implements OnDestroy {
  private dbService = inject(DatabaseService);
  geminiService = inject(GeminiService);
  private reportGenerator = inject(ReportGeneratorService);
  private fb = inject(FormBuilder);

  reportState = this.reportGenerator.state;
  selectedReport = signal<ReportCard | null>(null);
  isHelpOpen = signal(false);

  filterForm: FormGroup;

  availableReports: ReportCard[] = [
    { id: 'top_consumed', title: 'Itens Mais Consumidos', description: 'Ranking de itens por valor e quantidade.', icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6', requiresMonth: true,
      helpText: { whatIsIt: 'Mostra os itens que mais saíram do estoque em um período, ordenados por custo total e por unidades.', whyUseIt: 'Ajuda a identificar os itens mais importantes para a operação e a focar os esforços de compra e controle.' }},
    { id: 'technician_activity', title: 'Atividade por Técnico', description: 'Consumo de itens por cada técnico.', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M12 10a4 4 0 110-5.292', requiresMonth: true,
      helpText: { whatIsIt: 'Resume a quantidade e o valor dos itens retirados por cada técnico.', whyUseIt: 'Permite analisar o perfil de consumo e a demanda de cada técnico ou equipe.' }},
    { id: 'abc', title: 'Curva ABC', description: 'Classificação de itens pela sua importância no consumo.', icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2z', requiresMonth: true,
      helpText: { whatIsIt: 'Separa os itens em três classes (A, B, C) com base no seu valor de consumo. Classe A são os 20% de itens que representam 80% do valor.', whyUseIt: 'Essencial para priorizar o gerenciamento de estoque, focando nos itens de maior impacto financeiro.' }},
    { id: 'turnover', title: 'Giro de Estoque', description: 'Mede a velocidade com que o estoque é renovado.', icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m-15.357-2a8.001 8.001 0 0115.357-2m0 0H15', requiresMonth: true,
      helpText: { whatIsIt: 'Calcula quantas vezes o estoque de um item foi vendido e reposto em um período.', whyUseIt: 'Um giro alto indica boas vendas, enquanto um giro baixo pode significar excesso de estoque e capital parado.' }},
    { id: 'supplier', title: 'Desempenho de Fornecedores', description: 'Analisa o volume de compras por fornecedor.', icon: 'M13 10V3L4 14h7v7l9-11h-7z', requiresMonth: true,
      helpText: { whatIsIt: 'Mostra o valor total de itens consumidos que são preferencialmente fornecidos por cada empresa.', whyUseIt: 'Ajuda a entender a dependência de cada fornecedor e a negociar melhores condições.' }},
    { id: 'aging', title: 'Envelhecimento de Estoque', description: 'Identifica itens parados no estoque há muito tempo.', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', requiresMonth: false,
      helpText: { whatIsIt: 'Lista os itens em estoque e há quantos dias eles não têm uma saída registrada.', whyUseIt: 'Fundamental para identificar estoque obsoleto, que ocupa espaço e representa perda de capital.' }},
    { id: 'carrying_cost', title: 'Custo de Manutenção', description: 'Estima o custo de manter os itens em estoque.', icon: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4M4 7s0 0 0 0m16 0s0 0 0 0', requiresMonth: true,
      helpText: { whatIsIt: 'Calcula uma estimativa do custo financeiro para manter cada item em estoque (baseado no valor do item e uma taxa anual).', whyUseIt: 'Mostra o "custo invisível" do estoque parado, incentivando a otimização dos níveis de inventário.' }},
    { id: 'stockout_history', title: 'Histórico de Ruptura', description: 'Mostra quando os itens ficaram sem estoque.', icon: 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636', requiresMonth: true,
      helpText: { whatIsIt: 'Registra as datas em que cada item atingiu um estoque de zero durante o período selecionado.', whyUseIt: 'Ajuda a identificar falhas no ponto de ressuprimento e a evitar perdas de produtividade por falta de material.' }},
    { id: 'seasonality', title: 'Análise de Sazonalidade', description: 'Visualiza o consumo ao longo dos meses.', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', requiresMonth: false,
      helpText: { whatIsIt: 'Gera um gráfico do valor total consumido em cada mês, com base em todo o histórico de dados.', whyUseIt: 'Permite identificar padrões de consumo que se repetem ao longo do ano, ajudando no planejamento de compras.' }},
    { id: 'inventory_adjustments', title: 'Ajustes de Inventário', description: 'Auditoria de todas as correções manuais de estoque.', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z', requiresMonth: true,
      helpText: { whatIsIt: 'Exibe um log detalhado de todas as movimentações de ajuste (entrada ou saída manual) feitas no estoque.', whyUseIt: 'Essencial para auditoria, permitindo rastrear e entender as razões por trás das discrepâncias entre o estoque físico e o do sistema.' }},
    { id: 'ai_monthly', title: 'Resumo Mensal (IA)', description: 'Insights e KPIs do mês gerados por IA.', icon: 'M5 11l7-7 7 7M5 19l7-7 7 7', requiresAi: true, requiresMonth: true,
      helpText: { whatIsIt: 'A Inteligência Artificial analisa os dados do mês e cria um relatório executivo com os principais indicadores (KPIs), tabelas e um resumo escrito.', whyUseIt: 'Economiza tempo e oferece uma visão clara e profissional do desempenho do mês, ideal para apresentações e tomada de decisão rápida.' }},
    { id: 'ai_optimization', title: 'Otimização de Estoque (IA)', description: 'Sugestões de IA para otimizar seu estoque.', icon: 'M13 10V3L4 14h7v7l9-11h-7z', requiresAi: true, requiresMonth: false,
      helpText: { whatIsIt: 'A IA analisa todo o seu inventário e histórico de movimentos para encontrar oportunidades de melhoria.', whyUseIt: 'Identifica problemas como estoque excessivo, pontos de ressuprimento inadequados e sugere ações para reduzir custos e melhorar a eficiência.' }},
    // FIX: Corrected a typo in the SVG path data ('c.1543' to 'c1.543').
    { id: 'predictive_maintenance', title: 'Manutenção Preditiva (IA)', description: 'Previsão de troca de peças com base no consumo.', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM10 13a3 3 0 100-6 3 3 0 000 6z', requiresAi: true, requiresMonth: false,
      helpText: { whatIsIt: 'Analisa o padrão de consumo de peças de reposição (ex: filtros, rolamentos) para prever quando a próxima troca será necessária.', whyUseIt: 'Permite planejar manutenções antes que as falhas ocorram, aumentando a confiabilidade dos equipamentos e otimizando a compra de peças.' }},
    { id: 'anomaly_detection', title: 'Detecção de Anomalias (IA)', description: 'Auditoria de movimentações incomuns.', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z', requiresAi: true, requiresMonth: false,
      helpText: { whatIsIt: 'A IA audita o histórico de retiradas de itens para encontrar padrões atípicos, como quantidades ou frequências anormais para um técnico ou item.', whyUseIt: 'Ajuda a identificar possíveis erros de lançamento, uso indevido de material ou mudanças no padrão de consumo que precisam de atenção.' }}
  ];

  constructor() {
    this.reportGenerator.setReportsComponentActive(true);
    const today = new Date();
    const currentMonth = today.toISOString().substring(0, 7);
    this.filterForm = this.fb.group({
      selectedMonth: [currentMonth, Validators.required],
      carryingCostRate: [20, [Validators.required, Validators.min(0)]]
    });
  }

  ngOnDestroy(): void {
    this.reportGenerator.setReportsComponentActive(false);
  }

  selectReport(report: ReportCard) {
    this.selectedReport.set(report);
    this.isHelpOpen.set(false);
    this.reportGenerator.state.update(s => ({...s, status: 'idle'}));
  }
  
  generateReport() {
    const report = this.selectedReport();
    if (!report) return;

    const filters: any = {};
    if(report.requiresMonth) {
      const selectedMonth = this.filterForm.value.selectedMonth;
      if (!selectedMonth) {
          return;
      }
      filters.selectedMonth = selectedMonth;
      const [year, month] = selectedMonth.split('-');
      const date = new Date(Number(year), Number(month) - 1, 1);
      filters.monthLabel = date.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
    }
    if (report.id === 'carrying_cost') {
        filters.carryingCostRate = this.filterForm.value.carryingCostRate;
    }

    this.reportGenerator.generateReport(report.id, this.dbService.db(), filters);
  }
}