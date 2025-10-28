import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard';

export const APP_ROUTES: Routes = [
  { 
    path: 'login', 
    title: 'Login', 
    loadComponent: () => import('./components/login.component').then(c => c.LoginComponent) 
  },
  {
    path: '',
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { 
        path: 'dashboard', 
        title: 'Dashboard', 
        loadComponent: () => import('./components/dashboard.component').then(c => c.DashboardComponent) 
      },
      { 
        path: 'inventory', 
        title: 'Inventário', 
        loadComponent: () => import('./components/inventory.component').then(c => c.InventoryComponent) 
      },
      { 
        path: 'red_shelf', 
        title: 'Prateleira Vermelha', 
        loadComponent: () => import('./components/red-shelf.component').then(c => c.RedShelfComponent) 
      },
      { 
        path: 'entry', 
        title: 'Entrada de Itens', 
        data: { movementType: 'in' },
        loadComponent: () => import('./components/movements.component').then(c => c.MovementsComponent) 
      },
      { 
        path: 'exit', 
        title: 'Saída de Itens', 
        data: { movementType: 'out' },
        loadComponent: () => import('./components/movements.component').then(c => c.MovementsComponent) 
      },
      { 
        path: 'purchase_orders', 
        title: 'Ordens de Compra', 
        loadComponent: () => import('./components/purchase-orders.component').then(c => c.PurchaseOrdersComponent) 
      },
      { 
        path: 'picking_lists', 
        title: 'Listas de Coleta', 
        loadComponent: () => import('./components/picking-lists.component').then(c => c.PickingListsComponent) 
      },
       { 
        path: 'kits', 
        title: 'Kits', 
        loadComponent: () => import('./components/kits.component').then(c => c.KitsComponent) 
      },
      { 
        path: 'reservations', 
        title: 'Reservas', 
        loadComponent: () => import('./components/reservations.component').then(c => c.ReservationsComponent) 
      },
      { 
        path: 'cycle_count', 
        title: 'Contagem Cíclica', 
        loadComponent: () => import('./components/cycle-count.component').then(c => c.CycleCountComponent) 
      },
      { 
        path: 'stocktake', 
        title: 'Inventário Físico', 
        loadComponent: () => import('./components/stocktake.component').then(c => c.StocktakeComponent) 
      },
      { 
        path: 'purchase_suggestion', 
        title: 'Sugestão de Compra', 
        loadComponent: () => import('./components/purchase-suggestion.component').then(c => c.PurchaseSuggestionComponent) 
      },
      { 
        path: 'technicians', 
        title: 'Técnicos', 
        data: { type: 'technicians' },
        loadComponent: () => import('./components/management.component').then(c => c.ManagementComponent)
      },
      { 
        path: 'suppliers', 
        title: 'Fornecedores', 
        data: { type: 'suppliers' },
        loadComponent: () => import('./components/management.component').then(c => c.ManagementComponent)
      },
      {
        path: 'reports',
        title: 'Relatórios',
        loadComponent: () => import('./components/reports.component').then(c => c.ReportsComponent)
      },
      {
        path: 'anomaly_detection',
        title: 'Detecção de Anomalias',
        loadComponent: () => import('./components/anomaly-detection.component').then(c => c.AnomalyDetectionComponent)
      },
      {
        path: 'demand_estimation',
        title: 'Estimar Demanda',
        loadComponent: () => import('./components/demand-estimation.component').then(c => c.DemandEstimationComponent)
      },
      {
        path: 'audit_log',
        title: 'Log de Auditoria',
        loadComponent: () => import('./components/audit-log.component').then(c => c.AuditLogComponent)
      },
      {
        path: 'item_lifecycle',
        title: 'Ciclo de Vida do Item',
        loadComponent: () => import('./components/item-lifecycle.component').then(c => c.ItemLifecycleComponent)
      },
      {
        path: 'kiosk',
        title: 'Modo Kiosk',
        loadComponent: () => import('./components/kiosk.component').then(c => c.KioskComponent)
      },
      {
        path: 'users',
        title: 'Gerenciar Usuários',
        canActivate: [adminGuard],
        loadComponent: () => import('./components/users.component').then(c => c.UsersComponent)
      },
      {
        path: 'settings',
        title: 'Configurações',
        canActivate: [adminGuard],
        loadComponent: () => import('./components/settings.component').then(c => c.SettingsComponent)
      },
    ]
  },
  // Rota de fallback para qualquer URL não correspondida
  { path: '**', redirectTo: 'dashboard' }
];
