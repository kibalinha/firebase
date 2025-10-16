import { Injectable, inject, signal, computed } from '@angular/core';
import { GoogleGenAI, Type, GenerateContentResponse } from '@google/genai';
import { ToastService } from './toast.service';
// FIX: Added Technician to the import list
import { AlmoxarifadoDB, SearchFilter, Supplier, Item, Movement, Forecast, Technician, AnomalyReport, ParsedInvoiceItem } from '../models';
import { DatabaseService } from './database.service';

@Injectable({ providedIn: 'root' })
export class GeminiService {
  private ai = signal<GoogleGenAI | null>(null);
  private toastService = inject(ToastService);
  private dbService = inject(DatabaseService);

  // FIX: Replaced incorrect '->' with '.' for property access.
  isConfigured = computed(() => this.ai() !== null);

  constructor() {
    this._initializeAi();
  }

  private _initializeAi(): void {
    if (process.env.API_KEY) {
      try {
        this.ai.set(new GoogleGenAI({ apiKey: process.env.API_KEY }));
      } catch (error) {
        console.error('Erro ao inicializar o GoogleGenAI:', error);
        this.ai.set(null);
      }
    } else {
      console.error('Variável de ambiente API_KEY não definida. O serviço Gemini será desativado.');
      this.ai.set(null);
    }
  }

  public async validateKeyOnLoad(): Promise<void> {
    if (this.isConfigured()) {
        const isValid = await this.validateApiKey();
        if (!isValid) {
            this.toastService.addToast('A chave de API configurada na aplicação é inválida.', 'error');
            this.ai.set(null);
        }
    }
  }

  private async validateApiKey(): Promise<boolean> {
    const aiInstance = this.ai();
    if (!aiInstance) return false;
    try {
        // A very simple, fast, and cheap API call to test authentication.
        const result = await aiInstance.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: 'test',
        });
        
        // A real response to a simple prompt will always have text content.
        // This helps catch mocked or silently failing responses.
        if (result && result.text && result.text.trim() !== '') {
            return true;
        }
        
        console.error('API Key validation failed: The API returned an empty response.');
        return false;
    } catch (error) {
        console.error('API Key validation failed:', error);
        return false;
    }
  }

  private async generateContent(prompt: string, model: string = 'gemini-2.5-flash'): Promise<string> {
    const aiInstance = this.ai();
    if (!aiInstance) {
      this.toastService.addToast('Serviço de IA não configurado. A chave de API pode ser inválida.', 'error');
      throw new Error('Gemini API not configured');
    }
    try {
      const response: GenerateContentResponse = await aiInstance.models.generateContent({
        model,
        contents: prompt,
      });
      return response.text;
    } catch (error) {
      console.error('Error generating content with Gemini:', error);
      this.toastService.addToast('Erro na comunicação com o serviço de IA.', 'error');
      throw error;
    }
  }

  async generateChatResponse(params: { contents: any[], tools?: any[] }): Promise<GenerateContentResponse> {
    const aiInstance = this.ai();
    if (!aiInstance) {
      this.toastService.addToast('Serviço de IA não configurado. A chave de API pode ser inválida.', 'error');
      throw new Error('Gemini API not configured');
    }
    try {
      const response: GenerateContentResponse = await aiInstance.models.generateContent({
        model: 'gemini-2.5-flash',
        ...params,
      });
      return response;
    } catch (error) {
      console.error('Error generating chat response with Gemini:', error);
      this.toastService.addToast('Erro na comunicação com o assistente de IA.', 'error');
      throw error;
    }
  }
  
  async generateDescription(itemName: string): Promise<string> {
    const prompt = `Gere uma descrição curta e concisa para um item de almoxarifado chamado "${itemName}". A descrição deve ter no máximo 150 caracteres.`;
    return this.generateContent(prompt);
  }

  async suggestCategory(itemName: string, existingCategories: string[]): Promise<string> {
    const prompt = `Dado o item de almoxarifado "${itemName}" e a lista de categorias existentes [${existingCategories.join(', ')}], qual é a categoria mais apropriada? Responda apenas com o nome da categoria. Se nenhuma for apropriada, sugira uma nova categoria adequada.`;
    const suggestion = await this.generateContent(prompt);
    return suggestion.trim();
  }

  async parseSearchQuery(query: string, suppliers: Supplier[]): Promise<SearchFilter[] | null> {
    const aiInstance = this.ai();
    if (!aiInstance) {
      this.toastService.addToast('Serviço de IA não configurado. A chave de API pode ser inválida.', 'error');
      return null;
    }
    
    const suppliersForPrompt = suppliers.map(s => `id: ${s.id}, nome: ${s.name}`).join('; ');

    const schema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
            name: { type: Type.STRING, description: 'Parte do nome do item para buscar.' },
            category: { type: Type.STRING, description: 'A categoria exata para filtrar.' },
            supplierId: { type: Type.STRING, description: 'O ID exato do fornecedor para filtrar.' },
            minQuantity: { type: Type.INTEGER, description: 'A quantidade mínima de estoque.' },
            maxQuantity: { type: Type.INTEGER, description: 'A quantidade máxima de estoque.' },
        },
      }
    };
    
    const prompt = `
      Você é um assistente de busca para um sistema de inventário. Sua tarefa é converter uma consulta de busca em linguagem natural em um array de objetos de filtro JSON.
      A consulta do usuário é: "${query}"

      - Crie um array de objetos. Cada objeto no array representa um grupo de condições conectadas por 'OU'.
      - Dentro de cada objeto, as propriedades são conectadas por 'E'.
      - Exemplo 1: "parafusos de estoque baixo" -> [{ "name": "parafuso", "maxQuantity": 10 }]
      - Exemplo 2: "parafusos OU martelos" -> [{ "name": "parafuso" }, { "name": "martelo" }]
      - Exemplo 3: "itens de limpeza com menos de 20 unidades OU ferramentas do fornecedor ForneceTudo" -> [{ "category": "Limpeza", "maxQuantity": 20 }, { "category": "Ferramentas", "supplierId": "supplier-1" }]

      Aqui está a lista de fornecedores disponíveis com seus IDs:
      ${suppliersForPrompt}

      Converta a consulta do usuário em um array de objetos JSON com base no schema fornecido.
      - Se o usuário mencionar um fornecedor pelo nome, use o ID correspondente da lista.
      - Para frases como "estoque baixo" ou "menos de 10", use o campo 'maxQuantity'. Para "estoque crítico", considere um valor baixo como 5.
      - Para frases como "mais de 100", use o campo 'minQuantity'.
      - Se um campo não for mencionado em um grupo de condições, omita-o do objeto JSON.
      - Responda APENAS com o array JSON. Se a consulta for simples e não precisar de filtros (ex: "oi"), retorne um array vazio [].
    `;

    try {
      const response: GenerateContentResponse = await aiInstance.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: schema,
        }
      });
      const jsonText = response.text.trim();
      return JSON.parse(jsonText) as SearchFilter[];
    } catch (error) {
      console.error('Error parsing search query with Gemini:', error);
      this.toastService.addToast('Falha ao processar a busca com IA.', 'error');
      return null;
    }
  }

  async getOptimizationSuggestions(dbState: AlmoxarifadoDB): Promise<string> {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    
    // 1. Filter movements to the last 90 days.
    const recentMovements = dbState.movements.filter(m => new Date(m.date) >= ninetyDaysAgo);
    
    // 2. Filter items to only include those with stock. Items with 0 stock are not relevant for optimization.
    const itemsWithStock = dbState.items.filter(i => i.quantity > 0);
    
    // 3. Extract relevant IDs from movements and items to reduce context size.
    const relevantItemIds = new Set([
        ...recentMovements.map(m => m.itemId),
        ...itemsWithStock.map(i => i.id)
    ]);
    const relevantSupplierIds = new Set(itemsWithStock.map(i => i.preferredSupplierId).filter(Boolean));

    // 4. Create a compact, summarized state for the AI prompt.
    const summarizedDbState = {
        items: dbState.items.filter(i => relevantItemIds.has(i.id)),
        suppliers: dbState.suppliers.filter(s => relevantSupplierIds.has(s.id)),
        movements: recentMovements
        // Technicians are not needed for this report, so we omit them.
    };

    const prompt = `
    Você é um consultor especialista em logística e gerenciamento de inventário. Sua tarefa é analisar os dados de um almoxarifado e fornecer um relatório de otimização.
    **RESPONDA EM PORTUGUÊS E FORMATE A SAÍDA ESTRITAMENTE EM HTML.**

    Use as seguintes tags:
    - \`<h3>\` para os títulos das seções.
    - \`<p>\` para parágrafos de texto.
    - \`<strong>\` para destacar termos importantes.
    - \`<table>\`, \`<thead>\`, \`<tbody>\`, \`<tr>\`, \`<th>\`, \`<td>\` para todos os dados tabulares.
    - \`<ul>\` e \`<li>\` para listas de sugestões.
    - **NÃO** use \`<style>\`, \`<div>\`, \`<script>\` ou qualquer outra tag não listada.

    Baseado nos dados JSON a seguir (com movimentações dos últimos 90 dias), forneça insights sobre:
    1.  **Resumo Executivo:** Um parágrafo resumindo a saúde geral do inventário.
    2.  **Itens de Baixo Giro (Slow-Moving):** Uma tabela com itens que não tiveram saídas nos últimos 90 dias, mas que possuem estoque. Colunas: 'Item', 'Estoque Atual', 'Última Saída'.
    3.  **Pontos de Ressuprimento (Reorder Points):** Uma tabela com itens cujo ponto de ressuprimento parece mal ajustado (muito alto ou baixo) em comparação com o consumo. Colunas: 'Item', 'Ponto Atual', 'Consumo (90 dias)', 'Sugestão'.
    4.  **Oportunidades de Redução de Custo:** Uma tabela com os 5 itens de maior valor total em estoque (preço * quantidade). Colunas: 'Item', 'Valor em Estoque', 'Sugestão'.

    Use os dados atuais como referência. A data de hoje é ${new Date().toLocaleDateString('pt-BR')}.

    Dados do Almoxarifado (Apenas inventário principal):
    ${JSON.stringify(summarizedDbState, null, 2)}
    `;
    return this.generateContent(prompt);
  }

  async generateMonthlyReportSummary(monthData: { movements: Movement[], items: Item[], technicians: Technician[] }, monthName: string): Promise<string> {
    const relevantItemIds = new Set(monthData.movements.map(m => m.itemId));
    const relevantTechnicianIds = new Set(monthData.movements.map(m => m.technicianId).filter((id): id is string => !!id));

    const itemsForContext = monthData.items.filter(i => relevantItemIds.has(i.id));
    const techniciansForContext = monthData.technicians.filter(t => relevantTechnicianIds.has(t.id));
    
    const summarizedMonthData = {
      movements: monthData.movements,
      items: itemsForContext,
      technicians: techniciansForContext
    };
    
    const prompt = `
      Você é um analista de dados sênior e especialista em logística, preparando um dashboard executivo para o mês de ${monthName}.
      **RESPONDA EM PORTUGUÊS E FORMATE A SAÍDA ESTRITAMENTE EM HTML.**

      Use Tailwind CSS classes diretamente no HTML para estilização. A estrutura deve ser:
      - Para a grade de KPIs, use \`<div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">\`.
      - Para cada card de KPI, use \`<div class="bg-slate-100 dark:bg-secondary p-4 rounded-lg shadow">\`.
      - Dentro de um card, use \`<p class="text-sm text-slate-500 dark:text-slate-400 mb-1">\` para o título e \`<p class="text-2xl font-bold text-slate-800 dark:text-slate-100">\` para o valor.
      - Para seções, use \`<div class="mt-6">\`.
      - Use \`<h3>\` para títulos das seções.
      - Use \`<table>\`, \`<thead>\`, \`<tbody>\`, \`<tr>\`, \`<th>\`, \`<td>\` para todos os dados tabulares.
      - Use \`<ul>\` e \`<li>\` para listas de recomendações.
      - Use \`<strong>\` para destaques.
      - **NÃO** use \`<style>\` ou \`<script>\`.

      Analise os dados JSON a seguir, que contêm todas as movimentações do mês, e a lista completa de itens e técnicos para referência.

      **Dados do Mês:**
      ${JSON.stringify(summarizedMonthData)}

      **Estrutura do Dashboard:**
      1.  **Métricas Chave (KPIs):** Crie 4 cards com:
          - Valor Total Consumido (R$)
          - Total de Itens (unidades) Retirados
          - Número de Itens Únicos Movimentados
          - Alertas de Estoque Crítico (Nº de itens que ficaram abaixo do ponto de ressuprimento no mês)
      
      2.  **Análise de Consumo:**
          - Uma seção com uma tabela "Top 5 Itens Mais Consumidos (por Valor)". Colunas: 'Item', 'Valor Total (R$)'.
          - Outra tabela "Top 5 Itens Mais Consumidos (por Quantidade)". Colunas: 'Item', 'Quantidade Total'.

      3.  **Análise de Técnicos:**
          - Uma seção com uma tabela "Atividade dos Técnicos". Colunas: 'Técnico', 'Nº de Requisições', 'Valor Total Retirado (R$)'. Mostre os 3 mais ativos.
          
      4.  **Insights e Recomendações da IA:**
          - Uma seção final com uma lista (\`<ul>\`) contendo 2 a 3 observações acionáveis baseadas nos padrões de consumo do mês. Foque em otimização de estoque, possíveis excessos ou faltas, e padrões de consumo incomuns.
    `;
    return this.generateContent(prompt);
  }

  async suggestReorderPoint(item: Item, movements: Movement[]): Promise<{ suggestion: number; reasoning: string } | null> {
    const aiInstance = this.ai();
    if (!aiInstance) {
        this.toastService.addToast('Serviço de IA não configurado. A chave de API pode ser inválida.', 'error');
        return null;
    }

    const itemMovements = movements
      .filter(m => m.itemId === item.id && m.type === 'out')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 50); // Limit to last 50 movements to keep prompt size reasonable

    const schema = {
      type: Type.OBJECT,
      properties: {
        suggestion: { type: Type.INTEGER, description: 'O ponto de ressuprimento numérico sugerido.' },
        reasoning: { type: Type.STRING, description: 'Uma explicação curta (1-2 frases) para a sugestão.' },
      },
      required: ["suggestion", "reasoning"],
    };

    const prompt = `
      Você é um especialista em cadeia de suprimentos. Analise o histórico de consumo de um item e sugira um ponto de ressuprimento ideal.
      O objetivo é evitar a falta de estoque (stockout) sem manter excesso de inventário.
      
      Item Atual:
      - Nome: ${item.name}
      - Ponto de Ressuprimento Atual: ${item.reorderPoint}
      - Estoque Atual: ${item.quantity}

      Histórico de Saídas Recentes (quantidade e data):
      ${itemMovements.length > 0 ? itemMovements.map(m => `- ${m.quantity} em ${new Date(m.date).toLocaleDateString('pt-BR')}`).join('\n') : 'Nenhum histórico de saída recente.'}
      
      Considerando a frequência e a quantidade das saídas, sugira um novo ponto de ressuprimento. Forneça uma breve justificativa.
      Responda APENAS com o objeto JSON.
    `;

    try {
      const response = await aiInstance.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: schema,
        }
      });
      const jsonText = response.text.trim();
      return JSON.parse(jsonText);
    } catch (error) {
      console.error('Error suggesting reorder point:', error);
      this.toastService.addToast('Falha ao sugerir ponto de ressuprimento.', 'error');
      return null;
    }
  }

  async forecastDemand(item: Item, movements: Movement[]): Promise<Forecast | null> {
    const aiInstance = this.ai();
    if (!aiInstance) {
        this.toastService.addToast('Serviço de IA não configurado. A chave de API pode ser inválida.', 'error');
        return null;
    }

    // --- OPTIMIZATION: Aggregate consumption by day for the last year ---
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const relevantMovements = movements.filter(m => 
      m.itemId === item.id && 
      m.type === 'out' && 
      new Date(m.date) >= oneYearAgo
    );

    const dailyConsumption = new Map<string, number>();
    for (const move of relevantMovements) {
      const dateString = move.date.split('T')[0]; // Get YYYY-MM-DD
      dailyConsumption.set(dateString, (dailyConsumption.get(dateString) || 0) + move.quantity);
    }

    const itemMovements = Array.from(dailyConsumption.entries())
      .map(([date, quantity]) => ({ date, quantity }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    // --- END OPTIMIZATION ---
    
    const allItems = this.dbService.db().items;
    const itemWithStock = allItems.find(i => i.id === item.id);
    const currentStock = itemWithStock?.quantity ?? 0;

    const schema = {
      type: Type.OBJECT,
      properties: {
        summary: {
          type: Type.STRING,
          description: 'Um resumo em parágrafo (3-4 frases) da análise de demanda, mencionando tendências, sazonalidade ou padrões observados. Se houver poucos dados históricos, mencione a baixa confiança da previsão.'
        },
        forecast: {
          type: Type.ARRAY,
          description: 'Uma previsão de consumo para os próximos 30 dias.',
          items: {
            type: Type.OBJECT,
            properties: {
              date: { type: Type.STRING, description: 'A data da previsão no formato AAAA-MM-DD.' },
              predicted_consumption: { type: Type.INTEGER, description: 'A quantidade inteira de consumo prevista para aquele dia.' },
            },
            required: ["date", "predicted_consumption"],
          }
        },
        purchase_recommendation: {
            type: Type.OBJECT,
            description: 'Uma recomendação de compra baseada na previsão e no estoque atual.',
            properties: {
                should_purchase: { type: Type.BOOLEAN, description: 'Indica se uma nova compra é recomendada nos próximos 30 dias.' },
                quantity_to_purchase: { type: Type.INTEGER, description: 'A quantidade sugerida para a compra. Retorne 0 se should_purchase for false.' },
                purchase_date: { type: Type.STRING, description: 'A data sugerida para a compra (AAAA-MM-DD), baseada em quando o estoque atingirá o ponto de ressuprimento. Retorne uma string vazia se should_purchase for false.' },
                reasoning: { type: Type.STRING, description: 'Uma explicação concisa para a recomendação de compra.' }
            },
            required: ["should_purchase", "quantity_to_purchase", "purchase_date", "reasoning"],
        }
      },
      required: ["summary", "forecast", "purchase_recommendation"],
    };

    const prompt = `
      Você é um analista de dados especialista em previsão de demanda de inventário.
      Analise o histórico de consumo para o item "${item.name}" e forneça uma previsão de demanda e uma recomendação de compra para os próximos 30 dias a partir da data de hoje (${new Date().toISOString().split('T')[0]}).

      Dados do Item:
      - Estoque Atual: ${currentStock} unidades
      - Ponto de Ressuprimento: ${item.reorderPoint} unidades

      Dados históricos de consumo (data e quantidade):
      ${JSON.stringify(itemMovements)}

      Sua tarefa:
      1.  Analisar os dados históricos para identificar padrões. Se os dados forem esparsos ou insuficientes (ex: menos de 5 saídas), mencione isso no resumo e prossiga com uma previsão conservadora.
      2.  Gerar uma previsão diária de consumo para os próximos 30 dias. A previsão deve ser realista. Se não houver dados, a previsão deve ser zero.
      3.  Escrever um resumo conciso da sua análise.
      4.  Com base na previsão, no estoque atual e no ponto de ressuprimento, determinar se uma nova compra é necessária. Calcule quando o estoque atingirá o ponto de ressuprimento e sugira uma data e quantidade para a compra. Se a compra não for necessária, indique isso claramente.
      
      Responda APENAS com o objeto JSON.
    `;

     try {
      const response = await aiInstance.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: schema,
        }
      });
      const jsonText = response.text.trim();
      return JSON.parse(jsonText) as Forecast;
    } catch (error)
    {
      console.error('Error forecasting demand:', error);
      this.toastService.addToast('Falha ao gerar previsão de demanda.', 'error');
      return null;
    }
  }

  async analyzeItemImage(imageBase64: string, existingCategories: string[]): Promise<{ name: string; category: string; description:string } | null> {
    const aiInstance = this.ai();
    if (!aiInstance) {
        this.toastService.addToast('Serviço de IA não configurado. A chave de API pode ser inválida.', 'error');
        return null;
    }

    const imagePart = {
        inlineData: {
            mimeType: 'image/jpeg',
            data: imageBase64,
        },
    };

    const textPart = {
        text: `Você é um especialista em catalogação de itens de almoxarifado. Analise a imagem e identifique o item principal.
        
        Categorias existentes: [${existingCategories.join(', ')}]

        Sua tarefa é retornar um objeto JSON com as seguintes propriedades:
        - "name": O nome mais específico e comum para o item (ex: "Chave de Fenda Phillips", "Resistor de 10k Ohm", "Cabo de Rede Cat6 Azul").
        - "category": A categoria mais apropriada da lista de categorias existentes. Se nenhuma for adequada, sugira uma nova categoria concisa.
        - "description": Uma descrição curta e útil para o item, com no máximo 150 caracteres.

        Responda APENAS com o objeto JSON.`
    };

    const schema = {
        type: Type.OBJECT,
        properties: {
            name: { type: Type.STRING, description: 'O nome do item.' },
            category: { type: Type.STRING, description: 'A categoria do item.' },
            description: { type: Type.STRING, description: 'A descrição do item.' },
        },
        required: ["name", "category", "description"]
    };

    try {
        const response: GenerateContentResponse = await aiInstance.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [imagePart, textPart] },
            config: {
                responseMimeType: "application/json",
                responseSchema: schema,
            }
        });
        const jsonText = response.text.trim();
        return JSON.parse(jsonText);
    } catch (error) {
        console.error('Error analyzing image with Gemini:', error);
        this.toastService.addToast('Falha ao analisar a imagem. Tente uma foto mais nítida.', 'error');
        return null;
    }
  }

  async findMatchingItems(itemDescription: string, allItems: Item[]): Promise<string[] | null> {
    const aiInstance = this.ai();
    if (!aiInstance) {
        this.toastService.addToast('Serviço de IA não configurado. A chave de API pode ser inválida.', 'error');
        return null;
    }

    const availableItems = allItems.map(i => ({ id: i.id, name: i.name, description: i.description, category: i.category }));

    const schema = {
        type: Type.OBJECT,
        properties: {
            matchingItemIds: {
                type: Type.ARRAY,
                description: 'Uma lista dos IDs dos itens mais prováveis, ordenados por relevância. Retorne no máximo 3.',
                items: { type: Type.STRING }
            }
        },
        required: ["matchingItemIds"]
    };

    const prompt = `
      Você é um assistente especialista em busca de inventário. Sua tarefa é encontrar os itens mais relevantes em uma lista de estoque com base na descrição de um item fotografado.

      Descrição do item fotografado: "${itemDescription}"

      Lista de itens disponíveis no inventário (com ID, nome, descrição e categoria):
      ${JSON.stringify(availableItems)}

      Analise a descrição do item fotografado e, com base nela, retorne um array com os IDs dos 3 itens mais prováveis da lista de inventário. Ordene os IDs do mais provável para o menos provável.
      Se nenhum item parecer uma boa correspondência, retorne um array vazio.

      Responda APENAS com o objeto JSON.
    `;

    try {
        const response: GenerateContentResponse = await aiInstance.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: schema,
            }
        });
        const jsonText = response.text.trim();
        const result = JSON.parse(jsonText);
        return result.matchingItemIds as string[];
    } catch (error) {
        console.error('Error finding matching items with Gemini:', error);
        this.toastService.addToast('Falha na busca inteligente de itens.', 'error');
        return null;
    }
  }

  async detectAnomalies(movements: Movement[], items: Item[], technicians: Technician[]): Promise<AnomalyReport | null> {
    const aiInstance = this.ai();
    if (!aiInstance) {
      this.toastService.addToast('Serviço de IA não configurado. A chave de API pode ser inválida.', 'error');
      return null;
    }

    // --- OPTIMIZATION: Reduce payload size ---
    const movementsForAnalysis = movements
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 500); // Reduced from 1000 to 500

    const relevantItemIds = new Set(movementsForAnalysis.map(m => m.itemId));
    const relevantTechnicianIds = new Set(movementsForAnalysis.map(m => m.technicianId).filter((id): id is string => !!id));

    const itemsForContext = items
        .filter(i => relevantItemIds.has(i.id))
        .map(i => ({
            id: i.id,
            name: i.name,
            price: i.price,
            reorderPoint: i.reorderPoint
        }));
    
    const techniciansForContext = technicians.filter(t => relevantTechnicianIds.has(t.id));

    // Create a compact version of movements for the prompt
    const compactMovements = movementsForAnalysis.map(m => ({
      id: m.id,
      itemId: m.itemId,
      quantity: m.quantity,
      date: m.date,
      technicianId: m.technicianId
    }));
    // --- END OPTIMIZATION ---

    const anomalySchema = {
      type: Type.OBJECT,
      properties: {
        movementId: { type: Type.STRING, description: 'O ID da movimentação anômala.' },
        technicianName: { type: Type.STRING, description: 'O nome do técnico.' },
        itemName: { type: Type.STRING, description: 'O nome do item.' },
        date: { type: Type.STRING, description: 'A data da movimentação.' },
        quantity: { type: Type.INTEGER, description: 'A quantidade retirada.' },
        reason: { type: Type.STRING, description: 'A explicação concisa do porquê esta movimentação é considerada uma anomalia.' },
        severity: { type: Type.STRING, description: 'O nível de severidade da anomalia.', enum: ['Baixa', 'Média', 'Alta'] },
      },
      required: ["movementId", "technicianName", "itemName", "date", "quantity", "reason", "severity"]
    };

    const reportSchema = {
      type: Type.OBJECT,
      properties: {
        summary: {
          type: Type.STRING,
          description: 'Um resumo executivo de 2 a 3 frases sobre a análise geral, mencionando se foram encontradas anomalias significativas.'
        },
        anomalies: {
          type: Type.ARRAY,
          description: 'Uma lista de todas as movimentações de saída que foram identificadas como anomalias.',
          items: anomalySchema
        }
      },
      required: ["summary", "anomalies"]
    };

    const prompt = `
      Você é um auditor de inventário experiente. Sua tarefa é analisar uma lista de movimentações de saída de um almoxarifado e identificar anomalias.
      
      Dados de Referência:
      - Itens: ${JSON.stringify(itemsForContext)}
      - Técnicos: ${JSON.stringify(techniciansForContext)}

      Dados das Movimentações de Saída para Análise:
      ${JSON.stringify(compactMovements)}

      Procure por padrões incomuns, como:
      1.  **Quantidade Atípica:** Retirada de uma quantidade muito superior à média para um item específico.
      2.  **Frequência Elevada:** Um mesmo técnico retirando o mesmo item repetidamente em um curto período.
      3.  **Valor Incomum:** Retiradas de itens de alto valor em grande quantidade ou com frequência.
      4.  **Padrões de Fim de Semana/Fora de Hora:** (Se houver dados de hora) movimentações em horários não comerciais.

      Sua tarefa:
      - Analise os dados e forneça um resumo geral.
      - Identifique as movimentações que você considera anômalas.
      - Para cada anomalia, forneça o ID da movimentação, o motivo e um nível de severidade (Baixa, Média, Alta).
      - Se nenhuma anomalia for encontrada, retorne um resumo informando isso e uma lista de anomalias vazia.

      Responda APENAS com o objeto JSON.
    `;

    try {
      const response = await aiInstance.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: reportSchema,
        }
      });
      const jsonText = response.text.trim();
      return JSON.parse(jsonText) as AnomalyReport;
    } catch (error) {
      console.error('Error detecting anomalies with Gemini:', error);
      this.toastService.addToast('Falha ao executar a detecção de anomalias.', 'error');
      return null;
    }
  }

  async analyzeInvoiceImage(imageBase64: string): Promise<ParsedInvoiceItem[] | null> {
    const aiInstance = this.ai();
    if (!aiInstance) {
      this.toastService.addToast('Serviço de IA não configurado. A chave de API pode ser inválida.', 'error');
      return null;
    }

    const imagePart = {
      inlineData: {
        mimeType: 'image/jpeg',
        data: imageBase64,
      },
    };

    const textPart = {
      text: `Você é um assistente de OCR (Reconhecimento Óptico de Caracteres) especializado em processar notas fiscais para um sistema de inventário.
      Analise a imagem da nota fiscal e extraia a lista de itens.
      
      Sua tarefa é retornar um array de objetos JSON, onde cada objeto representa um item da nota.
      - Ignore cabeçalhos, rodapés, informações de impostos, totais, e qualquer outra informação que não seja um item da lista de produtos.
      - Extraia o nome do produto, a quantidade e o preço unitário.
      - Para a quantidade, use o valor inteiro.
      - Para o preço, use o valor numérico, usando ponto como separador decimal.
      
      Responda APENAS com o array JSON.`
    };

    const schema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: 'O nome do item.' },
          quantity: { type: Type.INTEGER, description: 'A quantidade do item.' },
          price: { type: Type.NUMBER, description: 'O preço unitário do item.' },
        },
        required: ["name", "quantity", "price"]
      }
    };

    try {
      const response: GenerateContentResponse = await aiInstance.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [imagePart, textPart] },
        config: {
          responseMimeType: "application/json",
          responseSchema: schema,
        }
      });
      const jsonText = response.text.trim();
      return JSON.parse(jsonText) as ParsedInvoiceItem[];
    } catch (error) {
      console.error('Error analyzing invoice image with Gemini:', error);
      this.toastService.addToast('Falha ao ler a nota fiscal. Tente uma imagem mais nítida e sem reflexos.', 'error');
      return null;
    }
  }

  async generatePredictiveMaintenanceReport(movements: Movement[], items: Item[]): Promise<string> {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const recentMovements = movements
        .filter(m => new Date(m.date) >= oneYearAgo && m.type === 'out')
        .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 2000);

    // Otimização: Enviar apenas os itens relevantes para a análise.
    const relevantItemIds = new Set(recentMovements.map(m => m.itemId));
    const itemsForContext = items
        .filter(i => relevantItemIds.has(i.id))
        .map(i => ({id: i.id, name: i.name, category: i.category}));

    const prompt = `
    Você é um engenheiro de manutenção preditiva sênior. Sua tarefa é analisar o histórico de consumo de peças de um almoxarifado (do último ano) e gerar um relatório proativo de manutenção.
    **RESPONDA EM PORTUGUÊS E FORMATE A SAÍDA ESTRITAMENTE EM HTML.**

    Use as seguintes tags:
    - \`<h3>\` para os títulos das seções.
    - \`<p>\` para parágrafos de texto.
    - \`<strong>\` para destacar termos importantes.
    - \`<table>\`, \`<thead>\`, \`<tbody>\`, \`<tr>\`, \`<th>\`, \`<td>\` para todos os dados tabulares.
    - \`<ul>\` e \`<li>\` para listas de sugestões.
    - **NÃO** use \`<style>\`, \`<div>\`, \`<script>\` ou qualquer outra tag não listada.

    Analise os dados de movimentações de saída para identificar padrões de consumo recorrentes que possam indicar a necessidade de manutenção preventiva.

    **Sua Análise deve Incluir:**
    1.  **Resumo da Análise:** Um parágrafo explicando a metodologia (busca por padrões de consumo cíclicos) e um resumo dos insights encontrados.
    2.  **Recomendações de Manutenção Proativa:** Uma tabela com as sugestões mais urgentes. Colunas: 'Item/Peça', 'Padrão de Consumo Detectado', 'Última Troca', 'Ação Recomendada'.

    **Exemplo de Insight:**
    - Se um 'Rolamento 6204' é retirado consistentemente a cada 90-100 dias, isso indica um ciclo de troca. Se a última retirada foi há 85 dias, a próxima manutenção está próxima.
    - Ação recomendada deve ser algo como: "Agendar verificação do equipamento associado e confirmar estoque da peça."

    Foque apenas em itens que pareçam ser peças de reposição (ex: rolamentos, correias, filtros) e que tenham um padrão de consumo claro (pelo menos 3 saídas com intervalos semelhantes). Ignore itens de consumo geral como canetas ou material de limpeza.

    A data de hoje é ${new Date().toLocaleDateString('pt-BR')}.

    **Dados para Análise:**
    - Itens Disponíveis: ${JSON.stringify(itemsForContext)}
    - Histórico de Saídas (último ano): ${JSON.stringify(recentMovements)}
    `;

    return this.generateContent(prompt);
  }

  async suggestCycleCountItems(allItems: Item[]): Promise<{ itemsToCount: {id: string, name: string}[], reasoning: string } | null> {
    const aiInstance = this.ai();
    if (!aiInstance) {
      this.toastService.addToast('Serviço de IA não configurado. A chave de API pode ser inválida.', 'error');
      return null;
    }

    const itemsForPrompt = allItems.map(i => ({ id: i.id, name: i.name, value: i.price * i.quantity, quantity: i.quantity }));

    const schema = {
      type: Type.OBJECT,
      properties: {
        reasoning: { 
          type: Type.STRING, 
          description: 'Uma breve explicação (1-2 frases) sobre por que estes itens foram selecionados para contagem.' 
        },
        itemsToCount: {
          type: Type.ARRAY,
          description: 'Uma lista de objetos, cada um contendo o id e o nome de um item para contar.',
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING, description: 'O ID do item.' },
              name: { type: Type.STRING, description: 'O nome do item.' }
            },
            required: ['id', 'name']
          }
        }
      },
      required: ['reasoning', 'itemsToCount']
    };

    const prompt = `
      Você é um especialista em inventário. Sua tarefa é sugerir de 5 a 10 itens para uma contagem cíclica.
      Priorize itens que sejam importantes para a operação. Critérios de importância incluem:
      1. Alto valor total em estoque (preço * quantidade).
      2. Itens que podem ter maior probabilidade de discrepância (ex: itens pequenos e numerosos).
      
      Aqui está a lista de itens disponíveis no inventário:
      ${JSON.stringify(itemsForPrompt)}

      Analise a lista e retorne um objeto JSON com uma lista de 5 a 10 itens para contar e uma breve justificativa para sua seleção.
      Responda APENAS com o objeto JSON.
    `;

    try {
      const response = await aiInstance.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: schema,
        }
      });
      const jsonText = response.text.trim();
      return JSON.parse(jsonText);
    } catch (error) {
      console.error('Error suggesting cycle count items with Gemini:', error);
      this.toastService.addToast('Falha ao sugerir itens para contagem.', 'error');
      return null;
    }
  }
}