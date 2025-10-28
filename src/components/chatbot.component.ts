import { Component, ChangeDetectionStrategy, inject, signal, viewChild, ElementRef, effect, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatbotService } from '../services/chatbot.service';
import { ChatMessage, View } from '../models';

@Component({
  selector: 'app-chatbot',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    @keyframes fadeIn {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
    }
    @keyframes fadeOut {
      from { opacity: 1; transform: scale(1); }
      to { opacity: 0; transform: scale(0.95); }
    }
    .chat-window-enter {
      animation: fadeIn 0.2s ease-out forwards;
    }
    .chat-window-leave {
      animation: fadeOut 0.2s ease-in forwards;
    }
    
    /* Styles for AI-generated HTML content */
    :host ::ng-deep .chatbot-message-content table {
      width: 100%;
      margin: 8px 0;
      border-collapse: collapse;
      font-size: 0.875rem; /* text-sm */
    }
    :host ::ng-deep .chatbot-message-content th,
    :host ::ng-deep .chatbot-message-content td {
      border: 1px solid #e2e8f0; /* slate-200 */
      padding: 6px 8px;
      text-align: left;
    }
    :host ::ng-deep .chatbot-message-content th {
      background-color: #f1f5f9; /* slate-100 */
      font-weight: 600;
    }
    :host ::ng-deep .chatbot-message-content ul {
        list-style: disc;
        padding-left: 20px;
    }
    :host ::ng-deep .chatbot-message-content li {
        margin-bottom: 4px;
    }

    /* Dark mode styles for AI-generated HTML */
    :host-context(.dark) ::ng-deep .chatbot-message-content th,
    :host-context(.dark) ::ng-deep .chatbot-message-content td {
      border-color: #475569; /* slate-600 */
    }
    :host-context(.dark) ::ng-deep .chatbot-message-content th {
      background-color: #334155; /* slate-700 */
    }
  `],
  template: `
    <div class="fixed top-4 right-4 z-50">
      <!-- FAB -->
      <button 
        (click)="toggleChat()" 
        class="bg-accent text-white w-14 h-14 rounded-full shadow-lg flex items-center justify-center hover:bg-info transition-transform duration-200 hover:scale-110">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-7 w-7" viewBox="0 0 20 20" fill="currentColor">
          <path d="M10 2a6 6 0 00-6 6v3.586l-1.707 1.707A1 1 0 003 15h14a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
        </svg>
      </button>

      <!-- Chat Window -->
      @if (isChatOpen()) {
        <div 
          class="absolute top-16 right-0 w-80 sm:w-96 h-[32rem] bg-white dark:bg-primary rounded-xl shadow-2xl flex flex-col origin-top-right"
          [class.chat-window-enter]="animationState() === 'entering'"
          [class.chat-window-leave]="animationState() === 'leaving'"
        >
          <!-- Header -->
          <header class="flex items-center justify-between p-3 border-b border-slate-200 dark:border-secondary">
            <h3 class="font-bold text-lg">Assistente Almox</h3>
            <button (click)="toggleChat()" class="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">&times;</button>
          </header>

          <!-- Messages -->
          <main #scrollContainer class="flex-grow p-3 overflow-y-auto space-y-4">
            @for (message of messages(); track $index) {
              <div class="flex" [class.justify-end]="message.role === 'user'">
                <div 
                  class="max-w-[85%] p-3 rounded-lg"
                  [class.bg-sky-100]="message.role === 'user'"
                  [class.dark:bg-sky-900]="message.role === 'user'"
                  [class.bg-slate-100]="message.role === 'model'"
                  [class.dark:bg-secondary]="message.role === 'model'"
                >
                  <div class="text-sm chatbot-message-content" [innerHTML]="message.parts[0].text"></div>
                  @if(message.suggestions && message.suggestions.length > 0) {
                    <div class="mt-3 flex flex-wrap gap-2">
                      @for(suggestion of message.suggestions; track suggestion) {
                        <button 
                          (click)="sendSuggestion(suggestion)"
                          class="text-sm text-accent dark:text-sky-400 bg-accent/10 hover:bg-accent/20 px-3 py-1 rounded-full transition-colors">
                          {{ suggestion }}
                        </button>
                      }
                    </div>
                  }
                </div>
              </div>
            }
            @if(isLoading()) {
              <div class="flex">
                <div class="p-3 rounded-lg bg-slate-100 dark:bg-secondary">
                  <div class="flex items-center gap-2">
                    <div class="w-2 h-2 bg-slate-400 rounded-full animate-pulse [animation-delay:-0.3s]"></div>
                    <div class="w-2 h-2 bg-slate-400 rounded-full animate-pulse [animation-delay:-0.15s]"></div>
                    <div class="w-2 h-2 bg-slate-400 rounded-full animate-pulse"></div>
                  </div>
                </div>
              </div>
            }
          </main>

          <!-- Input -->
          <footer class="p-3 border-t border-slate-200 dark:border-secondary">
            <form (ngSubmit)="sendMessage()" class="flex gap-2">
              <input 
                type="text"
                [(ngModel)]="userInput"
                name="userInput"
                placeholder="Digite sua mensagem..."
                class="flex-grow bg-slate-100 dark:bg-secondary p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-accent"
                [disabled]="isLoading()"
              >
              <button 
                type="submit" 
                class="bg-accent text-white px-4 rounded-md hover:bg-info disabled:opacity-50"
                [disabled]="isLoading() || !userInput.trim()">
                Enviar
              </button>
            </form>
          </footer>
        </div>
      }
    </div>
  `
})
export class ChatbotComponent {
  // This component will emit an event if the AI suggests navigating to another view.
  // The AppComponent will listen for this event.
  navigateTo = output<View>();
  
  private chatbotService = inject(ChatbotService);

  isChatOpen = signal(false);
  animationState = signal<'entering' | 'leaving' | 'closed'>('closed');
  messages = signal<ChatMessage[]>([
    { 
      role: 'model', 
      parts: [{ text: "Olá! Eu sou o Almox, seu assistente de inventário. Como posso ajudar? Aqui estão algumas ideias:" }],
      suggestions: [
          "Listar itens com estoque baixo",
          "Qual o contato da ForneceTudo?",
          "Me leve para a tela de Relatórios"
      ]
    }
  ]);
  userInput = '';
  isLoading = signal(false);

  scrollContainer = viewChild<ElementRef<HTMLElement>>('scrollContainer');

  constructor() {
    effect(() => {
      if (this.scrollContainer()) {
        this.scrollToBottom();
      }
    });
  }

  toggleChat() {
    if (this.isChatOpen()) {
      this.animationState.set('leaving');
      setTimeout(() => {
        this.isChatOpen.set(false);
        this.animationState.set('closed');
      }, 200);
    } else {
      this.isChatOpen.set(true);
      this.animationState.set('entering');
    }
  }

  async sendSuggestion(suggestion: string) {
    if (this.isLoading()) return;
    this.userInput = suggestion;
    await this.sendMessage();
  }

  async sendMessage() {
    const messageText = this.userInput.trim();
    if (!messageText || this.isLoading()) return;

    // Add user message to history
    const userMessage: ChatMessage = { role: 'user', parts: [{ text: messageText }] };
    this.messages.update(m => [...m, userMessage]);
    this.userInput = '';
    this.isLoading.set(true);
    this.scrollToBottom();

    try {
      // Get AI response
      const response = await this.chatbotService.sendMessage(this.messages(), messageText);
      
      // Check if the response contains a navigation command
      this.handlePotentialNavigation(response);

      this.messages.update(m => [...m, response]);

    } catch (e) {
      const errorMessage: ChatMessage = { role: 'model', parts: [{ text: "Ocorreu um erro. Por favor, tente novamente." }] };
      this.messages.update(m => [...m, errorMessage]);
    } finally {
      this.isLoading.set(false);
      this.scrollToBottom();
    }
  }

  private handlePotentialNavigation(response: ChatMessage) {
    // This is a simple way to check if the tool execution resulted in a navigation request.
    const toolResponses = response.toolResponses;
    if(toolResponses && toolResponses.length > 0) {
        const navResponse = toolResponses[0].functionResponse?.response?.content;
        if(navResponse && navResponse.navigateTo) {
            this.navigateTo.emit(navResponse.navigateTo);
            this.toggleChat(); // Close chat on navigation
        }
    }
  }

  private scrollToBottom() {
    setTimeout(() => {
      const el = this.scrollContainer()?.nativeElement;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    }, 0);
  }
}
