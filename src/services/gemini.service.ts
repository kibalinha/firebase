import { Injectable, inject, signal, computed } from '@angular/core';
import { ToastService } from './toast.service';
import { AlmoxarifadoDB, SearchFilter, Supplier, Item, Movement, Forecast, Technician, AnomalyReport, ParsedInvoiceItem } from '../models';
import { GoogleGenAI, GenerateContentResponse, Type } from '@google/genai';

@Injectable({ providedIn: 'root' })
export class GeminiService {
  private toastService = inject(ToastService);
  private ai = signal<GoogleGenAI | null>(null);
  
  apiKeySignal = signal<string | null>(localStorage.getItem('gemini_api_key'));
  isConfigured = computed(() => !!this.apiKeySignal());

  constructor() {
    const key = this.apiKeySignal();
    if (key) {
      this.initializeAi(key);
    }
  }

  private initializeAi(apiKey: string) {
    try {
      const aiInstance = new GoogleGenAI({ apiKey });
      this.ai.set(aiInstance);
      this.apiKeySignal.set(apiKey);
      localStorage.setItem('gemini_api_key', apiKey);
    } catch (e: any) {
      this.toastService.addToast(`Erro ao inicializar IA: ${e.message}`, 'error');
      this.clearApiKey();
    }
  }

  public setApiKey(apiKey: string) {
    if (!apiKey.trim()) {
      this.clearApiKey();
      return;
    }
    this.initializeAi(apiKey);
    this.validateKeyOnLoad();
  }

  public clearApiKey() {
    localStorage.removeItem('gemini_api_key');
    this.ai.set(null);
    this.apiKeySignal.set(null);
  }

  private handleApiError(error: any): never {
    console.error("Gemini API Error:", error);
    const message = error.message || 'Um erro desconhecido ocorreu com a API de IA.';
    this.toastService.addToast(message, 'error');
    throw new Error(message);
  }
  
  public async validateKeyOnLoad(): Promise<void> {
    if (!this.isConfigured() || !this.ai()) return;
    try {
      await this.ai()!.models.generateContent({ model: 'gemini-2.5-flash', contents: 'Olá', config: {maxOutputTokens: 2} });
      this.toastService.addToast('Chave de API do Gemini validada com sucesso!', 'success');
    } catch (error: any) {
      console.error('Gemini API Key validation failed:', error);
      this.toastService.addToast('Chave de API do Gemini inválida ou com problemas.', 'error');
      this.clearApiKey();
    }
  }

  async generateDescription(itemName: string): Promise<string> {
    if (!this.isConfigured()) this.handleApiError(new Error('Chave de API não configurada.'));
    try {
      const prompt = `Crie uma descrição técnica e concisa para o item de almoxarifado: "${itemName}". Máximo 150 caracteres.`;
      const response = await this.ai()!.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
      return response.text.trim();
    } catch (error) { this.handleApiError(error); }
  }

  async suggestCategory(itemName: string, existingCategories: string[]): Promise<string> {
    if (!this.isConfigured()) this.handleApiError(new Error('Chave de API não configurada.'));
    try {
      const prompt = `Sugira a melhor categoria para o item "${itemName}". Se uma das categorias existentes for adequada, use-a. Caso contrário, sugira uma nova categoria apropriada. Categorias existentes: ${existingCategories.join(', ')}. Responda APENAS com o nome da categoria.`;
      const response = await this.ai()!.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
      return response.text.trim().replace('.', '');
    } catch (error) { this.handleApiError(error); }
  }
  
  async parseSearchQuery(query: string, suppliers: Supplier[]): Promise<SearchFilter[] | null> {
    if (!this.isConfigured()) return null;
    const prompt = `Analise a consulta de busca: "${query}". Fornecedores: ${suppliers.map(s => `"${s.name}" (ID: ${s.id})`).join(', ')}. Extraia os filtros em JSON. Se ambíguo, retorne múltiplas interpretações.`;
    try {
      const response = await this.ai()!.models.generateContent({
          model: 'gemini-2.5-flash', contents: prompt,
          config: {
              responseMimeType: "application/json",
              responseSchema: {
                  type: Type.ARRAY,
                  items: {
                      type: Type.OBJECT,
                      properties: {
                          name: { type: Type.STRING }, category: { type: Type.STRING }, supplierId: { type: Type.STRING },
                          minQuantity: { type: Type.INTEGER }, maxQuantity: { type: Type.INTEGER }
                      }
                  }
              }
          }
      });
      return JSON.parse(response.text.trim());
    } catch (error) {
      console.error("Gemini parseSearchQuery Error:", error);
      this.toastService.addToast('IA não conseguiu interpretar a busca.', 'info');
      return null;
    }
  }

  async getOptimizationSuggestions(dbState: AlmoxarifadoDB): Promise<string> {
    if (!this.isConfigured()) this.handleApiError(new Error('Chave de API não configurada.'));

    // Prune the data to only what's necessary for the prompt to avoid token limits
    const relevantData = {
        items: dbState.items.map(({ id, name, quantity, reorderPoint, price, category }) => ({ id, name, quantity, reorderPoint, price, category })),
        movements: dbState.movements
            .filter(m => m.type === 'out') // Only 'out' movements are relevant for turnover
            .map(({ itemId, quantity, date }) => ({ itemId, quantity, date }))
    };

    const prompt = `
      Analise os seguintes dados de inventário e gere um relatório de otimização em HTML.
      Utilize as classes de CSS do Tailwind para estilização.
      O relatório deve focar em:
      1.  **Itens com Estoque Excessivo (Baixo Giro):** Itens com quantidade alta e poucas saídas recentes.
      2.  **Pontos de Ressuprimento Inadequados:** Itens que ficam sem estoque frequentemente ou cujo ponto de ressuprimento é muito alto/baixo.
      3.  **Sugestões Gerais de Otimização:** Outras oportunidades de melhoria.

      **Estrutura HTML e Classes Tailwind:**
      - Container principal: \`<div class="space-y-6">\`
      - Títulos de seção: \`<h3 class="text-xl font-bold mb-3 text-slate-800 dark:text-slate-100">Título</h3>\`
      - Parágrafos: \`<p class="mb-2 text-slate-600 dark:text-slate-300">Texto.</p>\`
      - Tabelas: use a estrutura \`<table class="w-full text-left text-sm">...\` com \`<thead>\`, \`<tbody>\`, \`<th>\` e \`<td>\`.
        - Header da tabela: \`<thead class="bg-slate-50 dark:bg-secondary"><tr class="border-b dark:border-slate-600">...\`
        - Linhas da tabela: \`<tr class="border-b dark:border-slate-700">...\`
        - Células de header e dados: \`<th class="p-3">...\` e \`<td class="p-3">...\`
      - Para valores numéricos importantes, use \`<span class="font-bold">...\`. Para valores negativos ou de alerta, use \`<span class="font-bold text-error">...\`.

      **Dados para Análise:** ${JSON.stringify(relevantData)}
    `;
    try {
      const response = await this.ai()!.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
      return response.text;
    } catch (error) { this.handleApiError(error); }
  }

  async generateMonthlyReportSummary(monthData: { movements: Movement[], items: Item[], technicians: Technician[] }, monthName: string): Promise<string> {
    if (!this.isConfigured()) this.handleApiError(new Error('Chave de API não configurada.'));
    const prompt = `
      Crie um resumo executivo em HTML para o mês de ${monthName}, formatado com classes do Tailwind CSS.
      O relatório deve conter:
      1.  **KPIs Principais:** Cards com o total de saídas, valor total consumido, e técnico mais ativo.
      2.  **Tabela de Itens Mais Consumidos:** Top 5 por valor.
      3.  **Análise Geral:** Um parágrafo com insights sobre o desempenho do mês.

      **Estrutura HTML e Classes Tailwind:**
      - Container principal: \`<div class="space-y-6">\`
      - Grid de KPIs: \`<div class="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">\`
      - Card de KPI: \`<div class="bg-slate-100 dark:bg-secondary p-4 rounded-lg shadow"><p class="text-sm text-slate-500 dark:text-slate-400">Label</p><p class="text-3xl font-bold text-accent">Value</p></div>\`
      - Títulos de seção: \`<h3 class="text-xl font-bold mb-3 text-slate-800 dark:text-slate-100">Título</h3>\`
      - Tabelas: use a estrutura \`<table class="w-full text-left text-sm">...\` com \`<thead>\`, \`<tbody>\`, etc.
        - Header da tabela: \`<thead class="bg-slate-50 dark:bg-secondary"><tr class="border-b dark:border-slate-600"><th>...</th></tr></thead>\`
        - Linhas da tabela: \`<tr class="border-b dark:border-slate-700"><td>...</td></tr>\`

      **Dados para Análise:** ${JSON.stringify(monthData)}
    `;
    try {
      const response = await this.ai()!.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
      return response.text;
    } catch (error) { this.handleApiError(error); }
  }

  async suggestReorderPoint(item: Item, movements: Movement[]): Promise<{ suggestion: number; reasoning: string } | null> {
    if (!this.isConfigured()) return null;
    const itemMovements = movements.filter(m => m.itemId === item.id && m.type === 'out');
    if (itemMovements.length < 3) return null;
    const prompt = `Sugira um ponto de ressuprimento para o item ${JSON.stringify(item)} com base em seu histórico de consumo: ${JSON.stringify(itemMovements)}. Forneça a sugestão e uma breve justificativa.`;
    try {
      const response = await this.ai()!.models.generateContent({
        model: 'gemini-2.5-flash', contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: { suggestion: { type: Type.INTEGER }, reasoning: { type: Type.STRING } }
            }
        }
      });
      return JSON.parse(response.text.trim());
    } catch (error) {
      console.error("Gemini suggestReorderPoint Error:", error);
      return null;
    }
  }
  
  async forecastDemand(item: Item, movements: Movement[]): Promise<Forecast | null> {
    if (!this.isConfigured()) return null;
    const prompt = `Analise o histórico de consumo do item ${JSON.stringify(item)} (movimentos: ${JSON.stringify(movements)}) e gere uma previsão de demanda para os próximos 30 dias, junto com uma recomendação de compra.`;
    try {
        const response = await this.ai()!.models.generateContent({
            model: 'gemini-2.5-flash', contents: prompt,
            config: { responseMimeType: "application/json" }
        });
        return JSON.parse(response.text.trim());
    } catch (error) {
      console.error("Gemini forecastDemand Error:", error);
      return null;
    }
  }

  async analyzeItemImage(imageBase64: string, existingCategories: string[]): Promise<{ name: string; unit: string; category: string; description:string } | null> {
    if (!this.isConfigured()) return null;
    const imagePart = { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } };
    const textPart = { text: `Identifique este item de almoxarifado. Forneça nome, uma unidade de medida (como 'un.', 'pç', 'kg', 'm', 'L', 'rolo', 'par'), uma categoria (escolha de: ${existingCategories.join(', ')} ou sugira uma nova) e uma breve descrição técnica.` };
    try {
        const response = await this.ai()!.models.generateContent({
            model: 'gemini-2.5-flash', contents: { parts: [imagePart, textPart] },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: { name: { type: Type.STRING }, unit: { type: Type.STRING }, category: { type: Type.STRING }, description: { type: Type.STRING } }
                }
            }
        });
        return JSON.parse(response.text.trim());
    } catch (error) {
        console.error("Gemini analyzeItemImage Error:", error);
        return null;
    }
  }

  async findMatchingItems(itemDescription: string, allItems: Item[]): Promise<string[] | null> {
     if (!this.isConfigured()) return null;
     const prompt = `Dada a descrição "${itemDescription}", encontre os IDs dos 3 itens mais prováveis na lista a seguir. Retorne apenas um array de IDs. Lista de Itens: ${JSON.stringify(allItems.map(i => ({id: i.id, name: i.name, description: i.description})))}`;
     try {
        const response = await this.ai()!.models.generateContent({
            model: 'gemini-2.5-flash', contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } }
            }
        });
        return JSON.parse(response.text.trim());
     } catch (error) {
        console.error("Gemini findMatchingItems Error:", error);
        return null;
     }
  }

  async detectAnomalies(movements: Movement[], items: Item[], technicians: Technician[]): Promise<AnomalyReport | null> {
    if (!this.isConfigured()) return null;
    const prompt = `Analise os movimentos de estoque e detecte anomalias (quantidades, frequências, horários atípicos). Dados: ${JSON.stringify({ movements, items, technicians })}.`;
    try {
        const response = await this.ai()!.models.generateContent({
            model: 'gemini-2.5-flash', contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        summary: { type: Type.STRING },
                        anomalies: { type: Type.ARRAY, items: {
                            type: Type.OBJECT,
                            properties: {
                                movementId: { type: Type.STRING }, technicianName: { type: Type.STRING }, itemName: { type: Type.STRING },
                                date: { type: Type.STRING }, quantity: { type: Type.INTEGER }, reason: { type: Type.STRING },
                                severity: { type: Type.STRING, enum: ['Baixa', 'Média', 'Alta'] }
                            }
                        }}
                    }
                }
            }
        });
        return JSON.parse(response.text.trim());
    } catch (error) {
        console.error("Gemini detectAnomalies Error:", error);
        return null;
    }
  }

  async analyzeInvoiceImage(imageBase64: string): Promise<ParsedInvoiceItem[] | null> {
    if (!this.isConfigured()) return null;
    const imagePart = { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } };
    const textPart = { text: "Extraia os itens, quantidades e preços unitários desta nota fiscal." };
    try {
        const response = await this.ai()!.models.generateContent({
            model: 'gemini-2.5-flash', contents: { parts: [imagePart, textPart] },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: { name: { type: Type.STRING }, quantity: { type: Type.NUMBER }, price: { type: Type.NUMBER } }
                    }
                }
            }
        });
        return JSON.parse(response.text.trim());
    } catch (error) {
        console.error("Gemini analyzeInvoiceImage Error:", error);
        return null;
    }
  }

  async generatePredictiveMaintenanceReport(movements: Movement[], items: Item[]): Promise<string> {
    if (!this.isConfigured()) this.handleApiError(new Error('Chave de API não configurada.'));

    // Prune data to the minimum required fields to avoid token limits.
    const relevantData = {
        items: items.map(({ id, name, category }) => ({ id, name, category })),
        movements: movements
            .filter(m => m.type === 'out') // Only consumption is relevant
            .map(({ itemId, date }) => ({ itemId, date }))
    };

    const prompt = `
      Analise o consumo de peças de reposição (como rolamentos, filtros, correias, etc.) e sugira um relatório de manutenção preditiva em HTML, formatado com classes do Tailwind CSS.
      O relatório deve:
      1.  Identificar peças com padrão de consumo cíclico.
      2.  Prever a próxima data provável de necessidade para essas peças.
      3.  Apresentar uma tabela com as peças, seu ciclo de consumo médio (em dias) e a próxima data de troca sugerida.

      **Estrutura HTML e Classes Tailwind:**
      - Container principal: \`<div class="space-y-6">\`
      - Títulos de seção: \`<h3 class="text-xl font-bold mb-3 text-slate-800 dark:text-slate-100">Peças com Padrão de Consumo Identificado</h3>\`
      - Parágrafos: \`<p class="mb-2 text-slate-600 dark:text-slate-300">Texto explicativo.</p>\`
      - Tabelas: use a estrutura \`<table class="w-full text-left text-sm">...\` com \`<thead>\`, \`<tbody>\`, etc.
      - Para datas futuras ou importantes, use \`<span class="font-bold text-accent">...\`.

      **Dados para Análise:** ${JSON.stringify(relevantData)}
    `;
    try {
      const response = await this.ai()!.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
      return response.text;
    } catch (error) { this.handleApiError(error); }
  }
  
  async suggestCycleCountItems(allItems: Item[]): Promise<{ itemsToCount: {id: string, name: string}[], reasoning: string } | null> {
    if (!this.isConfigured()) return null;
    const prompt = `Com base na lista de itens, sugira 10 itens para contagem cíclica, priorizando itens de alto valor, alto giro ou com estoque baixo. Forneça o motivo da sua sugestão. Itens: ${JSON.stringify(allItems.map(i => ({id: i.id, name: i.name, quantity: i.quantity, price: i.price, reorderPoint: i.reorderPoint})))}`;
    try {
        const response = await this.ai()!.models.generateContent({
            model: 'gemini-2.5-flash', contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        reasoning: { type: Type.STRING },
                        itemsToCount: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: { id: { type: Type.STRING }, name: { type: Type.STRING } }
                            }
                        }
                    }
                }
            }
        });
        return JSON.parse(response.text.trim());
    } catch (error) {
        console.error("Gemini suggestCycleCountItems Error:", error);
        return null;
    }
  }
  
  async generateChatResponse(params: { contents: any[], tools?: any[] }): Promise<GenerateContentResponse> {
    if (!this.isConfigured() || !this.ai()) this.handleApiError(new Error('Chave de API não configurada.'));
    try {
      const response = await this.ai()!.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: params.contents,
        config: { 
          tools: params.tools,
          thinkingConfig: { thinkingBudget: 0 } 
        } // Low latency for chat
      });
      return response;
    } catch (error) {
      console.error("Gemini Chat Error:", error);
      return {
        candidates: [{ content: { parts: [{ text: "Desculpe, ocorreu um erro ao se comunicar com o assistente." }], role: 'model' }, finishReason: 'ERROR' }],
        text: "Desculpe, ocorreu um erro ao se comunicar com o assistente."
      } as unknown as GenerateContentResponse;
    }
  }
}