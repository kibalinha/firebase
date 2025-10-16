import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { DatabaseService } from '../services/database.service';
import { GeminiService } from '../services/gemini.service';
import { ToastService } from '../services/toast.service';
import { AnomalyReport, Item, AlmoxarifadoDB } from '../models';

@Component({
  selector: 'app-smart-alerts',
  standalone: true,
  imports: [CommonModule, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-4 sm:p-6 h-full flex flex-col">
      <h2 class="text-2xl font-bold mb-2">Alertas Inteligentes (IA)</h2>
      <p class="text-slate-500 dark:text-slate-400 mb-6">Auditoria proativa das movimentações de saída dos últimos 90 dias em busca de padrões incomuns.</p>

      <div class="flex-grow overflow-y-auto min-h-0">
        @if (isLoading()) {
          <div class="text-center p-10 bg-white dark:bg-primary rounded-lg flex flex-col items-center justify-center h-full">
            <div class="w-12 h-12 border-4 border-slate-400 border-t-accent rounded-full animate-spin mb-4"></div>
            <p class="text-lg font-semibold">Analisando movimentações...</p>
            <p class="text-slate-500 dark:text-slate-400 mt-2">O auditor de IA está processando os dados. Isso pode levar um momento.</p>
          </div>
        } @else if (reportResult(); as report) {
          <div class="space-y-6">
            <div class="bg-white dark:bg-primary p-6 rounded-lg shadow-md">
              <h3 class="text-xl font-bold mb-3 text-accent">Resumo da Análise</h3>
              <p class="text-slate-600 dark:text-slate-300">{{ report.summary }}</p>
            </div>
            
            <div class="bg-white dark:bg-primary p-6 rounded-lg shadow-md">
              <h3 class="text-xl font-bold mb-4">Anomalias Detectadas</h3>
              @if (report.anomalies.length > 0) {
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
                      @for (anomaly of report.anomalies; track anomaly.movementId) {
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
                <div class="text-center p-10 text-green-600 dark:text-green-400">
                  <p class="font-semibold">Nenhuma anomalia significativa foi encontrada nos dados analisados.</p>
                </div>
              }
            </div>
            <div class="text-center">
               <button (click)="runAnalysis()" class="bg-accent text-white px-6 py-3 rounded-md hover:bg-info transition-colors">
                Executar Análise Novamente
              </button>
            </div>
          </div>
        } @else {
          <div class="text-center p-10 bg-white dark:bg-primary rounded-lg flex flex-col items-center justify-center h-full border-2 border-dashed border-slate-300 dark:border-secondary">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 text-slate-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
              <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
            </svg>
            <p class="text-lg font-semibold">Pronto para iniciar a auditoria?</p>
            <p class="text-slate-500 dark:text-slate-400 mt-2 max-w-md">Clique no botão abaixo para que a Inteligência Artificial analise os dados em busca de atividades que fogem do padrão.</p>
            <button (click)="runAnalysis()" class="mt-6 bg-accent text-white px-6 py-3 rounded-md hover:bg-info transition-colors">
              Iniciar Análise
            </button>
          </div>
        }
      </div>
    </div>
  `
})
export class SmartAlertsComponent {
  private dbService = inject(DatabaseService);
  private geminiService = inject(GeminiService);
  private toastService = inject(ToastService);
  private db = this.dbService.db;
  
  isLoading = signal(false);
  reportResult = signal<AnomalyReport | null>(null);

  constructor() { }

  async runAnalysis() {
    if (!this.geminiService.isConfigured()) {
      this.toastService.addToast('Serviço de IA não configurado. Vá para Configurações.', 'error');
      return;
    }

    this.isLoading.set(true);
    this.reportResult.set(null);

    try {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const recentMovements = this.db().movements.filter(m => 
        m.type === 'out' && new Date(m.date) >= ninetyDaysAgo
      );

      if (recentMovements.length === 0) {
        this.toastService.addToast('Não há movimentações de saída nos últimos 90 dias para analisar.', 'info');
        this.reportResult.set({ summary: 'Nenhuma movimentação de saída encontrada nos últimos 90 dias.', anomalies: [] });
        return;
      }

      const allItems: Item[] = this.db().items;
      const technicians = this.db().technicians;
      
      const result = await this.geminiService.detectAnomalies(recentMovements, allItems, technicians);
      this.reportResult.set(result);

    } catch (e) {
      this.toastService.addToast("Ocorreu um erro ao executar a análise.", "error");
      console.error(e);
    } finally {
      this.isLoading.set(false);
    }
  }
}