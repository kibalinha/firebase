import { Component, ChangeDetectionStrategy, inject, signal, viewChild, ElementRef, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
// FIX: Add FormGroup to the import list.
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { DatabaseService } from '../services/database.service';
import { ToastService } from '../services/toast.service';
import { GeminiService } from '../services/gemini.service';
import { ThemeService, Theme } from '../services/theme.service';
import { AlmoxarifadoDB } from '../models';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-6 h-full flex flex-col">
      <h2 class="text-2xl font-bold mb-6">Configurações</h2>
      <div class="flex-grow overflow-y-auto pr-4">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          <!-- AI Configuration Section -->
          <div class="bg-white dark:bg-secondary p-6 rounded-lg shadow-md">
            <h3 class="text-xl font-bold mb-2">Configuração da IA (Gemini)</h3>
            <p class="text-sm text-slate-500 dark:text-slate-400 mb-4">
                Insira sua chave de API do Google Gemini para habilitar as funcionalidades de inteligência artificial.
            </p>

            <form [formGroup]="apiKeyForm" (ngSubmit)="saveApiKey()" class="space-y-4">
                <div>
                <label for="api-key" class="block text-sm font-medium">Chave de API</label>
                <input 
                    id="api-key"
                    type="password" 
                    formControlName="key"
                    class="mt-1 block w-full px-3 py-2 bg-slate-100 dark:bg-primary border border-slate-300 dark:border-slate-600 rounded-md shadow-sm"
                >
                </div>
                <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <label class="font-semibold">Status:</label>
                    @if (geminiService.isConfigured()) {
                    <span class="px-2 py-1 bg-green-200 text-green-800 dark:bg-green-900 dark:text-green-300 text-xs font-bold rounded-full">CONFIGURADO</span>
                    } @else {
                    <span class="px-2 py-1 bg-yellow-200 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300 text-xs font-bold rounded-full">NÃO CONFIGURADO</span>
                    }
                </div>
                <div class="flex gap-2">
                    @if(geminiService.isConfigured()) {
                    <button type="button" (click)="clearApiKey()" class="px-4 py-2 bg-slate-200 dark:bg-secondary rounded-md text-sm">Limpar Chave</button>
                    }
                    <button type="submit" class="px-4 py-2 bg-accent text-white rounded-md text-sm">Salvar Chave</button>
                </div>
                </div>
            </form>
          </div>

          <!-- Theme Configuration Section -->
          <div class="bg-white dark:bg-secondary p-6 rounded-lg shadow-md">
            <h3 class="text-xl font-bold mb-2">Aparência</h3>
            <p class="text-sm text-slate-500 dark:text-slate-400 mb-4">
              Escolha como a aplicação deve se parecer. A opção "Sistema" usará a preferência do seu sistema operacional.
            </p>
            <div class="flex mt-8">
              <div class="flex rounded-md bg-slate-100 dark:bg-primary p-1 space-x-1">
                @for(theme of themes; track theme.id) {
                    <button 
                        (click)="setTheme(theme.id)"
                        class="px-4 py-2 text-sm font-medium rounded-md transition-colors w-24"
                        [class.bg-white]="themeService.theme() === theme.id"
                        [class.dark:bg-primary]="themeService.theme() === theme.id"
                        [class.text-slate-900]="themeService.theme() === theme.id"
                        [class.dark:text-slate-100]="themeService.theme() === theme.id"
                        [class.text-slate-600]="themeService.theme() !== theme.id"
                        [class.dark:text-slate-300]="themeService.theme() !== theme.id"
                        >
                        {{ theme.label }}
                    </button>
                }
              </div>
            </div>
          </div>
          
          <!-- Backup and Restore Section -->
          <div class="bg-white dark:bg-secondary p-6 rounded-lg shadow-md">
            <h3 class="text-xl font-bold mb-2">Backup e Restauração de Dados</h3>
            <p class="text-sm text-slate-500 dark:text-slate-400 mb-4">
              Exporte todos os seus dados para um arquivo de backup ou restaure a partir de um arquivo salvo.
              <strong class="text-amber-600 dark:text-amber-400">Atenção:</strong> Restaurar um backup substituirá todos os dados atuais.
            </p>
            <div class="flex gap-4 mt-8">
              <button (click)="exportData()" class="bg-sky-600 text-white px-4 py-2 rounded-md hover:bg-sky-700 transition-colors">
                Exportar Dados (Backup)
              </button>
              <button (click)="triggerImport()" class="bg-amber-600 text-white px-4 py-2 rounded-md hover:bg-amber-700 transition-colors">
                Importar Dados (Restaurar)
              </button>
              <input type="file" #importInput hidden accept=".json" (change)="importData($event)" />
            </div>
          </div>

          <!-- Category Management Section -->
          <div class="bg-white dark:bg-secondary p-6 rounded-lg shadow-md">
            <h3 class="text-xl font-bold mb-4">Gerenciar Categorias</h3>

            <form [formGroup]="categoryForm" (ngSubmit)="addCategory()">
              <div class="flex gap-2 mb-4">
                <input type="text" formControlName="name" placeholder="Nova categoria" class="bg-slate-100 dark:bg-primary p-2 rounded flex-grow border border-slate-300 dark:border-slate-600">
                <button type="submit" class="bg-accent text-white px-4 py-2 rounded">Adicionar</button>
              </div>
            </form>

            <ul class="space-y-2 max-h-48 overflow-y-auto pr-2">
              @for(category of db().categories; track category) {
                <li class="flex justify-between items-center bg-slate-100 dark:bg-primary p-2 rounded">
                  <span>{{ category }}</span>
                  <div>
                    <button [disabled]="category === 'Outros'" (click)="deleteCategory(category)" class="p-1 text-slate-500 dark:text-slate-300 hover:text-error disabled:opacity-30">🗑️</button>
                  </div>
                </li>
              }
            </ul>
          </div>
        </div>
      </div>
    </div>
  `
})
export class SettingsComponent {
  private dbService = inject(DatabaseService);
  private toastService = inject(ToastService);
  geminiService = inject(GeminiService);
  themeService = inject(ThemeService);
  private fb: FormBuilder = inject(FormBuilder);
  db = this.dbService.db;

  categoryForm: FormGroup;
  apiKeyForm: FormGroup;

  importInput = viewChild.required<ElementRef<HTMLInputElement>>('importInput');
  
  themes: { id: Theme; label: string }[] = [
    { id: 'light', label: 'Claro' },
    { id: 'dark', label: 'Escuro' },
    { id: 'system', label: 'Sistema' }
  ];

  constructor() {
    this.categoryForm = this.fb.group({
      name: ['', Validators.required]
    });

    this.apiKeyForm = this.fb.group({
      key: ['']
    });

    effect(() => {
        this.apiKeyForm.get('key')?.setValue(this.geminiService.apiKeySignal(), { emitEvent: false });
    });
  }
  
  saveApiKey() {
    if (this.apiKeyForm.invalid) return;
    const key = this.apiKeyForm.get('key')?.value?.trim() ?? '';
    this.geminiService.setApiKey(key);
  }

  clearApiKey() {
    this.geminiService.clearApiKey();
    this.apiKeyForm.get('key')?.setValue('');
    this.toastService.addToast('Chave de API removida.', 'info');
  }

  setTheme(theme: Theme) {
    this.themeService.setTheme(theme);
  }

  async addCategory() {
    if (this.categoryForm.invalid) {
      this.toastService.addToast('Nome da categoria não pode ser vazio.', 'error');
      return;
    }
    const categoryName = this.categoryForm.value.name!.trim();
    if (!categoryName) {
      return;
    }
    if (this.db().categories.some(c => c.toLowerCase() === categoryName.toLowerCase())) {
      this.toastService.addToast('Categoria já existe.', 'error');
      return;
    }
    
    await this.dbService.addCategory(categoryName);
    this.categoryForm.reset();
  }

  async deleteCategory(categoryToDelete: string) {
    if (categoryToDelete === 'Outros') {
      this.toastService.addToast('Não é possível excluir la categoria "Outros".', 'error');
      return;
    }
    await this.dbService.deleteCategory(categoryToDelete);
  }

  exportData() {
    const dbData = JSON.stringify(this.dbService.db());
    if (!dbData) {
      this.toastService.addToast('Nenhum dado para exportar.', 'info');
      return;
    }

    const blob = new Blob([dbData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const date = new Date().toISOString().split('T')[0];
    link.download = `backup_almoxarifado_${date}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // FIX: Explicitly cast 'url' to a string to prevent type errors.
    URL.revokeObjectURL(String(url));
    this.toastService.addToast('Backup exportado com sucesso!', 'success');
  }
  
  triggerImport() {
    this.importInput().nativeElement.click();
  }
  
  importData(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }

    const file = input.files[0];
    if (file.type !== 'application/json') {
      this.toastService.addToast('Arquivo inválido. Por favor, selecione um arquivo .json.', 'error');
      input.value = '';
      return;
    }

    if (!confirm('Tem certeza que deseja restaurar este backup? Todos os dados atuais serão substituídos.')) {
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const parsedData = JSON.parse(text) as AlmoxarifadoDB;
        // Validação básica para garantir que é um arquivo de backup válido
        if (parsedData && Array.isArray(parsedData.items) && Array.isArray(parsedData.categories) && Array.isArray(parsedData.movements)) {
          await this.dbService.replaceDbState(parsedData);
          this.toastService.addToast('Backup restaurado com sucesso!', 'success');
        } else {
          throw new Error('O arquivo não parece ser um backup válido.');
        }
      } catch (error: any) {
        this.toastService.addToast(`Erro ao processar o backup: ${error.message}`, 'error');
      } finally {
        input.value = '';
      }
    };
    reader.onerror = () => {
      this.toastService.addToast('Erro ao ler o arquivo.', 'error');
      input.value = '';
    };
    reader.readAsText(file);
  }
}