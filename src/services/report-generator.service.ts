import { Injectable, signal, inject } from '@angular/core';
import { AlmoxarifadoDB, ReportType, Movement, Item } from '../models';
import { ToastService } from './toast.service';
import { GeminiService } from './gemini.service';

export interface ReportState {
  status: 'idle' | 'running' | 'success' | 'error';
  reportId: ReportType | null;
  filters: any;
  data: any | null;
  error: string | null;
}

@Injectable({ providedIn: 'root' })
export class ReportGeneratorService {
  private toastService = inject(ToastService);
  private geminiService = inject(GeminiService);
  
  private isReportsComponentActive = signal(false);

  state = signal<ReportState>({
    status: 'idle',
    reportId: null,
    filters: null,
    data: null,
    error: null,
  });

  setReportsComponentActive(isActive: boolean): void {
    this.isReportsComponentActive.set(isActive);
  }

  generateReport(reportId: ReportType, db: AlmoxarifadoDB, filters: any): void {
    if (this.state().status === 'running') {
      this.toastService.addToast('Outro relatório já está em andamento.', 'info');
      return;
    }
    
    const s = this.state();
    if (s.status === 'success' && s.reportId === reportId && JSON.stringify(s.filters) === JSON.stringify(filters)) {
      this.toastService.addToast('Exibindo relatório já gerado.', 'info');
      return;
    }

    this.state.set({
      status: 'running',
      reportId,
      filters,
      data: null,
      error: null,
    });
    
    if (reportId === 'ai_monthly' || reportId === 'anomaly_detection' || reportId === 'predictive_maintenance' || reportId === 'ai_optimization') {
        this.runAiReport(reportId, db, filters);
    }
    else {
      this.runWorkerReport(reportId, db, filters);
    }
  }

  private getDbForAiAnalysis(db: AlmoxarifadoDB): AlmoxarifadoDB {
    const mainItemIds = new Set(db.items.map(i => i.id));
    const mainMovements = db.movements.filter(m => mainItemIds.has(m.itemId));

    // Return a cloned DB state with filtered movements and no red shelf items
    return {
        ...db,
        movements: mainMovements,
        redShelfItems: [],
    };
  }

  private async runAiReport(reportId: ReportType, db: AlmoxarifadoDB, filters: any) {
      try {
        if (!this.geminiService.isConfigured()) {
            throw new Error("Serviço de IA não configurado.");
        }
        
        const analysisDb = this.getDbForAiAnalysis(db);
        let result: any;

        switch(reportId) {
            case 'ai_monthly':
                const { selectedMonth, monthLabel } = filters;
                const monthData = {
                    movements: analysisDb.movements.filter(m => m.date.startsWith(selectedMonth)),
                    items: analysisDb.items,
                    technicians: analysisDb.technicians,
                };
                result = await this.geminiService.generateMonthlyReportSummary(monthData, monthLabel);
                break;
            case 'predictive_maintenance':
                result = await this.geminiService.generatePredictiveMaintenanceReport(analysisDb.movements, analysisDb.items);
                break;
            case 'anomaly_detection':
                const ninetyDaysAgo = new Date();
                ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
                const recentMovements = analysisDb.movements.filter(m => m.type === 'out' && new Date(m.date) >= ninetyDaysAgo);
                if (recentMovements.length === 0) {
                  result = { summary: 'Nenhuma movimentação de saída encontrada nos últimos 90 dias para análise.', anomalies: [] };
                } else {
                  result = await this.geminiService.detectAnomalies(recentMovements, analysisDb.items, analysisDb.technicians);
                }
                break;
            case 'ai_optimization':
                 result = await this.geminiService.getOptimizationSuggestions(analysisDb);
                 break;
        }
        
        this.state.set({
          status: 'success',
          reportId: reportId,
          filters: filters,
          data: result,
          error: null,
        });

        if (!this.isReportsComponentActive()) {
            this.toastService.addToast(`Seu relatório de IA "${filters.monthLabel || ''}" está pronto!`, 'success');
        }

      } catch(e: any) {
          this.state.update(s => ({...s, status: 'error', error: e.message, reportId, filters }));
          this.toastService.addToast(e.message || 'Erro ao gerar relatório de IA.', 'error');
      }
  }

  private getWorkerScript(): string {
    // All worker functions are now defined inside this string as plain JavaScript.
    return `
        // --- HELPER FUNCTIONS ---
        function getStockAtDate(originalItemId, targetDate, db, mainMovements, itemMap) {
            const mainItem = itemMap.get(originalItemId);
            let currentStock = mainItem?.quantity ?? 0;
            const movementsAfterDate = mainMovements
                .filter(m => m.itemId === originalItemId && new Date(m.date) > targetDate)
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            let historicalStock = currentStock;
            for (const movement of movementsAfterDate) {
                historicalStock = movement.type === 'in' ? historicalStock - movement.quantity : historicalStock + movement.quantity;
            }
            return historicalStock;
        }

        // --- REPORT CALCULATION FUNCTIONS ---
        function generateTopConsumedReport(db, filters, itemMap) {
            const movementsForMonth = db.movements.filter(m => m.date.startsWith(filters.selectedMonth));
            const consumptionMap = new Map();
            for (const move of movementsForMonth.filter(m => m.type === 'out')) {
                const item = itemMap.get(move.itemId);
                if (item) {
                    const value = move.quantity * item.price;
                    const existing = consumptionMap.get(item.id) || { totalValue: 0, totalQuantity: 0, itemName: item.name };
                    existing.totalValue += value;
                    existing.totalQuantity += move.quantity;
                    consumptionMap.set(item.id, existing);
                }
            }
            const allConsumedItems = Array.from(consumptionMap.entries()).map(([itemId, data]) => ({ itemId, ...data }));
            const byValue = [...allConsumedItems].sort((a, b) => b.totalValue - a.totalValue).slice(0, 5);
            const byQuantity = [...allConsumedItems].sort((a, b) => b.totalQuantity - a.totalQuantity).slice(0, 5);
            return { byValue, byQuantity };
        }

        function generateTechnicianActivityReport(db, filters, itemMap) {
            const movementsForMonth = db.movements.filter(m => m.date.startsWith(filters.selectedMonth));
            const techMap = new Map();
            for (const move of movementsForMonth.filter(m => m.type === 'out' && m.technicianId)) {
                const item = itemMap.get(move.itemId);
                if (item && move.technicianId) {
                    const value = move.quantity * item.price;
                    const techName = db.technicians.find(t => t.id === move.technicianId)?.name || 'Desconhecido';
                    const existing = techMap.get(move.technicianId) || { totalValue: 0, totalItems: 0, requisitionCount: 0, technicianName: techName };
                    existing.totalValue += value;
                    existing.totalItems += move.quantity;
                    existing.requisitionCount += 1;
                    techMap.set(move.technicianId, existing);
                }
            }
            return Array.from(techMap.entries())
                .map(([technicianId, data]) => ({ technicianId, ...data }))
                .sort((a, b) => b.totalValue - a.totalValue);
        }

        function generateAbcReport(db, filters, itemMap) {
            const movementsForMonth = db.movements.filter(m => m.date.startsWith(filters.selectedMonth));
            const consumptionMap = new Map();
            for (const move of movementsForMonth.filter(m => m.type === 'out')) {
                const item = itemMap.get(move.itemId);
                if (item) {
                    const value = move.quantity * item.price;
                    const existing = consumptionMap.get(item.id) || { totalValue: 0, itemName: item.name };
                    consumptionMap.set(item.id, { ...existing, totalValue: existing.totalValue + value });
                }
            }
            const sortedItems = Array.from(consumptionMap.entries()).map(([itemId, data]) => ({ itemId, ...data })).sort((a, b) => b.totalValue - a.totalValue);
            const totalValue = sortedItems.reduce((sum, item) => sum + item.totalValue, 0);
            if (totalValue === 0) return [];
            let cumulativePercentage = 0;
            return sortedItems.map(item => {
                cumulativePercentage += (item.totalValue / totalValue) * 100;
                let itemClass = cumulativePercentage <= 80 ? 'A' : (cumulativePercentage <= 95 ? 'B' : 'C');
                return { ...item, cumulativePercentage, class: itemClass };
            });
        }

        function generateTurnoverReport(db, filters, itemMap) {
            const movementsForMonth = db.movements.filter(m => m.date.startsWith(filters.selectedMonth));
            const consumptionInMonth = new Map();
            for (const move of movementsForMonth.filter(m => m.type === 'out')) {
                const item = itemMap.get(move.itemId);
                if (item) {
                    const current = consumptionInMonth.get(item.id) || 0;
                    consumptionInMonth.set(item.id, current + (move.quantity * item.price));
                }
            }
            if (consumptionInMonth.size === 0) return [];
            const [year, month] = (filters.selectedMonth || '').split('-').map(Number);
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0, 23, 59, 59);
            const reportData = [];
            for (const [itemId, costOfGoodsSold] of consumptionInMonth.entries()) {
                const item = itemMap.get(itemId);
                if (item) {
                    const stockAtStart = getStockAtDate(itemId, startDate, db, db.movements, itemMap);
                    const stockAtEnd = getStockAtDate(itemId, endDate, db, db.movements, itemMap);
                    const avgStock = (stockAtStart + stockAtEnd) / 2;
                    const avgStockValue = avgStock * item.price;
                    reportData.push({
                        itemName: item.name,
                        costOfGoodsSold: costOfGoodsSold,
                        avgStockValue: avgStockValue,
                        turnover: avgStockValue > 0 ? costOfGoodsSold / avgStockValue : 0
                    });
                }
            }
            return reportData.sort((a, b) => b.turnover - a.turnover);
        }
        
        function generateSupplierReport(db, filters, itemMap) {
            const movementsForMonth = db.movements.filter(m => m.date.startsWith(filters.selectedMonth));
            const supplierStats = new Map();
            for (const move of movementsForMonth.filter(m => m.type === 'out')) {
                const item = itemMap.get(move.itemId);
                if (item && item.preferredSupplierId) {
                    const supplier = db.suppliers.find(s => s.id === item.preferredSupplierId);
                    if(supplier) {
                        const current = supplierStats.get(supplier.id) || { supplierName: supplier.name, totalValue: 0, totalQuantity: 0, items: new Set() };
                        current.totalValue += move.quantity * item.price;
                        current.totalQuantity += move.quantity;
                        current.items.add(item.id);
                        supplierStats.set(supplier.id, current);
                    }
                }
            }
            return Array.from(supplierStats.values()).map(s => ({ ...s, distinctItems: s.items.size })).sort((a,b) => b.totalValue - a.totalValue);
        }
        
        function generateAgingReport(db, filters, itemMap) {
            const today = new Date();
            return Array.from(itemMap.values())
            .map(item => {
                if (item.quantity === 0) return null;
                const lastExit = db.movements
                    .filter(m => m.itemId === item.id && m.type === 'out')
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
                let daysSinceLastExit = -1;
                if (lastExit) {
                    daysSinceLastExit = Math.floor((today.getTime() - new Date(lastExit.date).getTime()) / (1000 * 3600 * 24));
                }
                return { itemName: item.name, quantity: item.quantity, daysSinceLastExit: daysSinceLastExit };
            })
            .filter(item => item !== null)
            .sort((a, b) => b.daysSinceLastExit - a.daysSinceLastExit);
        }
        
        function generateCarryingCostReport(db, filters, itemMap) {
            const movementsForMonth = db.movements.filter(m => m.date.startsWith(filters.selectedMonth));
            const [year, month] = (filters.selectedMonth || '').split('-').map(Number);
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0, 23, 59, 59);
            const itemsInMonth = new Set();
            movementsForMonth.forEach(m => itemsInMonth.add(m.itemId));
            const rate = (filters.carryingCostRate || 0) / 100;
            if (rate < 0) throw new Error('A taxa de custo não pode ser negativa.');
            const reportData = [];
            for (const itemId of itemsInMonth) {
                const item = itemMap.get(itemId);
                if (item) {
                    const stockAtStart = getStockAtDate(itemId, startDate, db, db.movements, itemMap);
                    const stockAtEnd = getStockAtDate(itemId, endDate, db, db.movements, itemMap);
                    const avgStock = (stockAtStart + stockAtEnd) / 2;
                    const avgStockValue = avgStock * item.price;
                    if (avgStockValue > 0) {
                        reportData.push({
                            itemName: item.name,
                            avgStockValue: avgStockValue,
                            monthlyCost: avgStockValue * (rate / 12)
                        });
                    }
                }
            }
            const totalMonthlyCost = reportData.reduce((sum, item) => sum + item.monthlyCost, 0);
            return { reportData: reportData.sort((a,b) => b.monthlyCost - a.monthlyCost), totalMonthlyCost, rate };
        }
        
        function generateStockoutHistoryReport(db, filters, itemMap) {
            const movementsForMonth = db.movements.filter(m => m.date.startsWith(filters.selectedMonth));
            const [year, month] = (filters.selectedMonth || '').split('-').map(Number);
            const startDate = new Date(year, month - 1, 1);
            const itemIdsToCheck = new Set(movementsForMonth.filter(m => m.type === 'out').map(m => m.itemId));
            const stockoutItems = [];
            for (const itemId of itemIdsToCheck) {
                const item = itemMap.get(itemId);
                if (!item) continue;
                let currentStock = getStockAtDate(itemId, startDate, db, db.movements, itemMap);
                const itemMovementsInMonth = movementsForMonth
                    .filter(m => m.itemId === itemId)
                    .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                for (const movement of itemMovementsInMonth) {
                    currentStock += (movement.type === 'in' ? movement.quantity : -movement.quantity);
                    if (currentStock <= 0) {
                        stockoutItems.push({ itemName: item.name, stockoutDate: new Date(movement.date) });
                        break;
                    }
                }
            }
            return stockoutItems.sort((a, b) => a.stockoutDate.getTime() - b.stockoutDate.getTime());
        }

        function generateSeasonalityReport(db, filters, itemMap) {
            const consumptionByMonth = new Map();
            for (const move of db.movements.filter(m => m.type === 'out')) {
                const item = itemMap.get(move.itemId);
                if (item) {
                    const value = move.quantity * item.price;
                    const monthKey = move.date.substring(0, 7);
                    consumptionByMonth.set(monthKey, (consumptionByMonth.get(monthKey) || 0) + value);
                }
            }
            const sortedMonths = Array.from(consumptionByMonth.keys()).sort();
            return sortedMonths.map(monthKey => {
                const [year, month] = monthKey.split('-');
                const date = new Date(Number(year), Number(month) - 1, 1);
                const label = date.toLocaleString('pt-BR', { month: 'short', year: 'numeric' });
                return { name: label.charAt(0).toUpperCase() + label.slice(1), value: consumptionByMonth.get(monthKey) || 0 };
            });
        }

        function generateInventoryAdjustmentsReport(db, filters, itemMap) {
            const movementsForMonth = db.movements.filter(m => m.date.startsWith(filters.selectedMonth));
            const adjustmentMovements = movementsForMonth
                .filter(m => m.notes && (m.notes.toLowerCase().includes('ajuste') || m.notes.toLowerCase().includes('inventário físico')));
            return adjustmentMovements.map(move => {
                const item = itemMap.get(move.itemId);
                return {
                    movementId: move.id,
                    date: move.date,
                    itemName: item?.name || 'Item Desconhecido',
                    type: move.type,
                    quantity: move.quantity,
                    value: (item?.price || 0) * move.quantity,
                    notes: move.notes
                };
            }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        }

        // --- WORKER MESSAGE HANDLER ---
        self.onmessage = (e) => {
          const { reportId, db, filters } = e.data;
          let result = null;
          try {
            const mainItemIds = new Set(db.items.map(i => i.id));
            const mainMovements = db.movements.filter(m => mainItemIds.has(m.itemId));
            const filteredDb = { ...db, movements: mainMovements, redShelfItems: [] };
            const itemMap = new Map(db.items.map(item => [item.id, item]));
            switch (reportId) {
                case 'top_consumed': result = generateTopConsumedReport(filteredDb, filters, itemMap); break;
                case 'technician_activity': result = generateTechnicianActivityReport(filteredDb, filters, itemMap); break;
                case 'abc': result = generateAbcReport(filteredDb, filters, itemMap); break;
                case 'turnover': result = generateTurnoverReport(filteredDb, filters, itemMap); break;
                case 'supplier': result = generateSupplierReport(filteredDb, filters, itemMap); break;
                case 'aging': result = generateAgingReport(filteredDb, filters, itemMap); break;
                case 'carrying_cost': result = generateCarryingCostReport(filteredDb, filters, itemMap); break;
                case 'stockout_history': result = generateStockoutHistoryReport(filteredDb, filters, itemMap); break;
                case 'seasonality': result = generateSeasonalityReport(filteredDb, filters, itemMap); break;
                case 'inventory_adjustments': result = generateInventoryAdjustmentsReport(filteredDb, filters, itemMap); break;
                default: throw new Error(\`Report type "\${reportId}" is not handled by the worker.\`);
            }
            self.postMessage({ success: true, data: result });
          } catch (error) {
            // Make sure to pass error.message, not the whole error object
            self.postMessage({ success: false, error: error.message });
          }
        };
    `;
  }

  private async runWorkerReport(reportId: ReportType, db: AlmoxarifadoDB, filters: any) {
    if (typeof Worker === 'undefined') {
        this.state.set({
            status: 'error', reportId, filters, data: null, 
            error: 'Web Workers não são suportados neste navegador.'
        });
        this.toastService.addToast('Web Workers não são suportados neste navegador.', 'error');
      return;
    }

    let worker: Worker | null = null;
    let objectUrl: string | null = null;

    try {
        const scriptText = this.getWorkerScript();
        const blob = new Blob([scriptText], { type: 'application/javascript' });
        objectUrl = URL.createObjectURL(blob);
        worker = new Worker(objectUrl);

        worker.onmessage = ({ data }) => {
          if (data.success) {
            this.state.set({
              status: 'success',
              reportId,
              filters,
              data: data.data,
              error: null,
            });
            if (!this.isReportsComponentActive()) {
              this.toastService.addToast(`Relatório "${filters.monthLabel}" está pronto!`, 'success');
            }
          } else {
            const errorMsg = data.error || 'Ocorreu um erro desconhecido ao gerar o relatório.';
            this.state.update(s => ({...s, status: 'error', error: errorMsg }));
            this.toastService.addToast(errorMsg, 'error');
          }
          worker?.terminate();
          if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    
        worker.onerror = (error: ErrorEvent) => {
          console.error('Report worker error event:', error);
          let errorMsg = 'O processo em segundo plano encontrou um erro desconhecido.';
          if (error.message) {
            errorMsg = error.message;
          }
    
          this.state.update(s => ({ ...s, status: 'error', error: errorMsg }));
          this.toastService.addToast(`Falha na geração do relatório: ${errorMsg}`, 'error');
          worker?.terminate();
          if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
        
        worker.postMessage({ reportId, db, filters });
    } catch (e: any) {
        console.error("Falha ao criar ou executar o worker:", e);
        this.state.update(s => ({ ...s, status: 'error', error: e.message, reportId, filters }));
        this.toastService.addToast(`Falha ao iniciar o gerador de relatórios: ${e.message}`, 'error');
        if (worker) worker.terminate();
        if (objectUrl) URL.revokeObjectURL(objectUrl);
    }
  }
}
