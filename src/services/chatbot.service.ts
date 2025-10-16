import { Injectable, inject } from '@angular/core';
import { signal } from '@angular/core';
import { GeminiService } from './gemini.service';
import { DatabaseService } from './database.service';
import { ChatMessage, View } from '../models';
import { GenerateContentResponse } from '@google/genai';
import { Type } from '@google/genai';

@Injectable({ providedIn: 'root' })
export class ChatbotService {
  private geminiService = inject(GeminiService);
  private dbService = inject(DatabaseService);

  private systemInstruction = {
    role: 'model',
    parts: [{ text: `Você é 'Almox', um assistente IA especialista em gerenciamento de inventário. Sua função é ajudar o almoxarife a encontrar informações e registrar movimentações. Seja conciso e direto. Sempre que uma ação criar um registro (como uma saída de item), peça confirmação ao usuário antes de executar a ação final. A data de hoje é ${new Date().toLocaleDateString('pt-BR')}.
    **REGRAS DE FORMATAÇÃO:**
    - Para listas, use uma tabela HTML simples (\`<table>\`, \`<th>\`, \`<tr>\`, \`<td>\`).
    - **NUNCA** adicione títulos redundantes.
    **REGRAS DE AÇÃO:**
    - Para registrar uma saída, use a ferramenta 'performStockExit'. Esta ferramenta requer um processo de duas etapas: primeiro, chame-a com 'confirmed: false' para validar e apresentar um resumo para o usuário. Se o usuário confirmar, chame a mesma ferramenta novamente com 'confirmed: true' para executar a transação.`
    }]
  };

  private tools = [{
    functionDeclarations: [
      {
        name: 'findItems',
        description: 'Busca por itens no inventário com base em vários critérios.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: 'Parte do nome do item.' },
            category: { type: Type.STRING, description: 'Categoria exata do item.' },
            lowStockOnly: { type: Type.BOOLEAN, description: 'Retorna apenas itens com estoque baixo.' },
          },
        },
      },
      {
        name: 'getTechnicianInfo',
        description: 'Obtém informações sobre um técnico pelo nome.',
        parameters: { type: Type.OBJECT, properties: { name: { type: Type.STRING } }, required: ['name'] },
      },
      {
        name: 'getSupplierInfo',
        description: 'Obtém informações sobre um fornecedor pelo nome.',
        parameters: { type: Type.OBJECT, properties: { name: { type: Type.STRING } }, required: ['name'] },
      },
       {
        name: 'navigateTo',
        description: 'Navega o usuário para uma tela específica da aplicação.',
        parameters: {
          type: Type.OBJECT, properties: { view: { type: Type.STRING, enum: ['dashboard', 'inventory', 'red_shelf', 'entry', 'exit', 'technicians', 'suppliers', 'reports', 'audit_log', 'settings', 'demand_estimation', 'kiosk', 'smart_alerts', 'cycle_count', 'item_lifecycle', 'purchase_orders', 'stocktake', 'purchase_suggestion', 'picking_lists'] } },
          required: ['view'],
        },
      },
      {
        name: 'performStockExit',
        description: 'Prepara e executa uma saída de itens do estoque para um técnico. Requer duas etapas: chamar com confirmed=false para validar, e depois com confirmed=true para executar.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                itemsToExit: {
                    type: Type.ARRAY, description: 'Lista de itens a serem retirados.',
                    items: {
                        type: Type.OBJECT, properties: { itemName: { type: Type.STRING }, quantity: { type: Type.INTEGER } },
                        required: ['itemName', 'quantity']
                    }
                },
                technicianName: { type: Type.STRING, description: 'Nome do técnico.' },
                confirmed: { type: Type.BOOLEAN, description: '`false` para verificação, `true` para execução.' }
            },
            required: ['itemsToExit', 'technicianName', 'confirmed']
        }
      }
    ]
  }];
  
  async sendMessage(history: ChatMessage[], userMessage: string): Promise<ChatMessage> {
    if (!this.geminiService.isConfigured()) {
      return { role: 'model', parts: [{ text: 'Serviço de IA não configurado. Adicione uma chave de API nas Configurações.' }] };
    }
    const dbState = this.dbService.db();

    const contextItems = this.dbService.db().items.map(item => ({
        id: item.id,
        name: item.name,
        category: item.category,
        totalQuantity: item.quantity,
        reorderPoint: item.reorderPoint
    }));

    const dbContext = `CONTEXTO DO BANCO DE DADOS: ${JSON.stringify({items: contextItems, technicians: dbState.technicians, suppliers: dbState.suppliers })}`;
    const contents = [this.systemInstruction, ...history, { role: 'user', parts: [{text: `${dbContext}\n\nMENSAGEM: ${userMessage}`}] }];
    const response = await this.geminiService.generateChatResponse({ contents, tools: this.tools });
    const part = response.candidates?.[0]?.content?.parts?.[0];

    if (part?.functionCall) {
      const functionCall = part.functionCall;
      const toolResult = await this.executeTool(functionCall.name, functionCall.args);
      const toolResponseHistory: ChatMessage = { role: 'user', parts: [{ functionResponse: { name: functionCall.name, response: { content: toolResult } } }], toolCalls: [functionCall] };
      const finalApiResponse = await this.geminiService.generateChatResponse({ contents: [...contents, toolResponseHistory] });
      return { role: 'model', parts: finalApiResponse.candidates![0].content.parts, toolResponses: [{...toolResponseHistory.parts[0]}] } as ChatMessage;
    } else if (part?.text) {
      return { role: 'model', parts: [{ text: part.text }] };
    }
    return { role: 'model', parts: [{ text: "Não consegui processar sua solicitação." }] };
  }

  private async executeTool(name: string, args: any): Promise<any> {
    switch (name) {
      case 'findItems': return this.toolFindItems(args.name, args.category, args.lowStockOnly);
      case 'getTechnicianInfo': return this.dbService.db().technicians.find(t => t.name.toLowerCase().includes(args.name.toLowerCase()));
      case 'getSupplierInfo': return this.dbService.db().suppliers.find(s => s.name.toLowerCase().includes(args.name.toLowerCase()));
      case 'navigateTo': return { success: true, navigateTo: args.view };
      case 'performStockExit': return this.toolPerformStockExit(args.itemsToExit, args.technicianName, args.confirmed);
      default: return { error: `Ferramenta "${name}" desconhecida.` };
    }
  }

  private toolFindItems(name?: string, category?: string, lowStockOnly?: boolean): any {
    let items = this.dbService.db().items;
    if (name) items = items.filter(i => i.name.toLowerCase().includes(name.toLowerCase()));
    if (category) items = items.filter(i => i.category.toLowerCase() === category.toLowerCase());
    if (lowStockOnly) items = items.filter(i => i.quantity <= i.reorderPoint);
    if (items.length === 0) return "Nenhum item encontrado.";
    return items.map(i => ({ nome: i.name, quantidade: i.quantity, categoria: i.category }));
  }

  private async toolPerformStockExit(itemsToExit: { itemName: string; quantity: number }[], technicianName: string, confirmed: boolean): Promise<any> {
    const allItems = this.dbService.db().items;
    const technician = this.dbService.db().technicians.find(t => t.name.toLowerCase().includes(technicianName.toLowerCase()));

    if (!technician) return { error: `Técnico "${technicianName}" não encontrado.` };

    let allValid = true;
    const validationResults = itemsToExit.map(req => {
        const item = allItems.find(i => i.name.toLowerCase().includes(req.itemName.toLowerCase()));
        if (!item) { allValid = false; return { name: req.itemName, status: 'error', message: 'Item não encontrado.' }; }
        if (item.quantity < req.quantity) { allValid = false; return { name: item.name, status: 'error', message: `Estoque insuficiente. Disponível: ${item.quantity}.` }; }
        return { name: item.name, status: 'ok', message: 'Estoque OK.', itemId: item.id, quantity: req.quantity };
    });

    if (!allValid) return { error: 'Validação falhou.', details: validationResults };

    if (!confirmed) {
        return { status: 'validation_success', summary: { technician: technician.name, items: validationResults.map(vr => ({ name: vr.name, quantity: vr.quantity })), message: 'Posso confirmar a retirada?' } };
    }

    try {
        const movementPromises = validationResults.map(vr => this.dbService.addMovement({
            itemId: vr.itemId!, type: 'out', quantity: vr.quantity!, date: new Date().toISOString(),
            technicianId: technician.id, notes: 'Retirada via assistente Almox'
        }));
        const results = await Promise.all(movementPromises);
        const failures = results.filter(r => !r.success).map(f => f.message);
        if (failures.length > 0) return { error: 'Alguns itens falharam na retirada.', details: failures.join('; ') };
        return { success: true, message: 'Retirada concluída com sucesso!' };
    } catch (error: any) {
        return { error: 'Ocorreu um erro inesperado.', details: error.message };
    }
  }
}
