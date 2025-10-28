import { Component, ChangeDetectionStrategy, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import { View } from './models';
import { SidebarComponent } from './components/sidebar.component';
import { ToastContainerComponent } from './components/toast-container.component';
import { ChatbotComponent } from './components/chatbot.component';
import { CommandPaletteComponent, Command } from './components/command-palette.component';
import { GeminiService } from './services/gemini.service';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    SidebarComponent,
    ToastContainerComponent,
    ChatbotComponent,
    CommandPaletteComponent,
  ],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.control.k)': 'toggleCommandPalette($event)',
    '(document:keydown.meta.k)': 'toggleCommandPalette($event)',
  }
})
export class AppComponent implements OnInit {
  // FIX: Explicitly type the router property to assist TypeScript's type inference.
  private router: Router = inject(Router);
  private geminiService = inject(GeminiService);
  private authService = inject(AuthService);

  currentView = signal<View>('dashboard');
  isCommandPaletteOpen = signal(false);
  isSidebarOpen = signal(false);

  isAuthenticated = computed(() => this.authService.isAuthenticated());

  // Mapeia o ID da view para um rótulo amigável
  private viewLabels: Record<View, string> = {
    dashboard: 'Dashboard',
    inventory: 'Inventário',
    red_shelf: 'Prateleira Vermelha',
    entry: 'Entrada de Itens',
    exit: 'Saída de Itens',
    technicians: 'Técnicos',
    suppliers: 'Fornecedores',
    reports: 'Relatórios',
    audit_log: 'Log de Auditoria',
    settings: 'Configurações',
    demand_estimation: 'Estimar Demanda',
    kiosk: 'Modo Kiosk',
    anomaly_detection: 'Detecção de Anomalias',
    cycle_count: 'Contagem Cíclica',
    item_lifecycle: 'Ciclo de Vida do Item',
    purchase_orders: 'Ordens de Compra',
    stocktake: 'Inventário Físico',
    purchase_suggestion: 'Sugestão de Compra',
    picking_lists: 'Listas de Coleta',
    kits: 'Kits',
    reservations: 'Reservas',
    users: 'Gerenciar Usuários'
  };

  currentViewLabel = computed(() => this.viewLabels[this.currentView()] || 'Dashboard');

  constructor() {
    // Constructor is now empty of injections
  }

  ngOnInit() {
    this.geminiService.validateKeyOnLoad();
    
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      // Extrai o nome da view da URL, removendo a barra inicial
      const view = event.urlAfterRedirects.split('/')[1] as View;
      if (this.viewLabels[view]) {
        this.currentView.set(view);
      } else if (event.urlAfterRedirects !== '/login') {
        this.currentView.set('dashboard'); // Fallback para dashboard
      }
    });
  }

  changeView(view: View) {
    this.router.navigate([view]);
    this.closeSidebar();
  }
  
  toggleSidebar() {
    this.isSidebarOpen.update(v => !v);
  }

  closeSidebar() {
    this.isSidebarOpen.set(false);
  }

  toggleCommandPalette(event: KeyboardEvent) {
    event.preventDefault();
    this.isCommandPaletteOpen.update(v => !v);
  }
  
  closeCommandPalette() {
    this.isCommandPaletteOpen.set(false);
  }

  handleCommand(command: Command) {
    if (command.view) {
      this.changeView(command.view);
      this.closeCommandPalette();
    }
  }
}
