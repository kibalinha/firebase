import { Component, ChangeDetectionStrategy, input, output, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { View } from '../models';
import { AuthService } from '../services/auth.service';

interface MenuItem {
  label: string;
  icon: string;
  view?: View;
  key?: string;
  subItems?: {
    label: string;
    view: View;
    adminOnly?: boolean;
  }[];
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <aside class="w-full h-full bg-primary text-neutral flex flex-col shadow-lg">
      <div class="border-b border-secondary flex items-center justify-center p-4">
         <!-- SVG Logo -->
         <svg class="w-48 h-auto"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="250 1550 3500 1100">
            <g transform="matrix(1.3333333,0,0,-1.3333333,0,4096)">
              <g transform="matrix(6.5206269,0,0,6.5206269,-8976.3176,116.00273)">
                <g>
                  <g transform="translate(1591.0225,192.4541)">
                    <path d="m 0,0 c 3.948,1.563 5.677,-0.083 6.143,-1.039 0,0 3.058,1.313 3.781,1.671 0.549,0.257 0.965,0.507 0.814,1.562 -0.132,1.048 -0.373,2.402 -0.39,3.832 V 39.697 H 1.904 V 6.333 C 0.499,5.161 -1.546,3.881 -5.627,3.881 c -5.827,0 -6.617,4.505 -6.617,6.659 v 29.157 h -8.469 V 9.301 C -20.713,-0.258 -9.384,-3.715 0,0" style="fill:#434747;fill-opacity:1;fill-rule:nonzero;stroke:none" />
                  </g>
                  <g transform="translate(1780.6216,231.4943)">
                    <path d="m 0,0 c -3.948,-1.571 -5.677,-0.466 -6.151,0.49 0,0 -3.058,-1.305 -3.782,-1.662 -0.531,-0.266 -0.946,-0.524 -0.814,-1.571 0.142,-1.056 0.373,-2.411 0.399,-3.84 v -32.283 h 8.452 v 32.69 c 1.406,1.172 3.442,2.461 7.523,2.461 5.827,0 6.617,-4.505 -6.617,-6.65 v -28.501 h 8.469 v 28.759 C 20.713,-0.548 9.393,3.708 0,0" style="fill:#434747;fill-opacity:1;fill-rule:nonzero;stroke:none" />
                  </g>
                  <g transform="translate(1620.1719,245.5497)">
                    <path d="m 0,0 c 0,0 -7.265,-1.039 -7.988,-1.388 -0.548,-0.258 -0.963,-0.524 -0.815,-1.563 0.142,-1.055 0.342,-2.444 0.375,-3.865 L -8.344,-9.7 V -52.921 H 0 Z" style="fill:#434747;fill-opacity:1;fill-rule:nonzero;stroke:none" />
                  </g>
                  <g transform="translate(1725.5571,245.5497)">
                    <path d="m 0,0 c 0,0 -7.266,-1.039 -7.988,-1.388 -0.54,-0.258 -0.956,-0.524 -0.823,-1.563 0.149,-1.055 0.349,-2.444 0.374,-3.865 L -8.346,-9.7 V -52.921 H 0 Z" style="fill:#434747;fill-opacity:1;fill-rule:nonzero;stroke:none" />
                  </g>
                  <g transform="translate(1656.3862,226.6907)">
                    <path d="m 0,0 h 0.3 c 1.262,0 2.783,-1.139 2.783,-2.586 v -31.476 h 8.536 V 5.909 L 0.532,5.078 Z" style="fill:#434747;fill-opacity:1;fill-rule:nonzero;stroke:none" />
                  </g>
                  <g transform="translate(1650.3096,196.7515)">
                    <path d="m 0,0 c -1.488,-0.483 -2.775,-0.715 -4.77,-0.748 -2.336,-0.059 -4.148,1.786 -4.132,4.139 v 26.548 h 8.37 L 0,35.017 h -8.909 v 10.722 h -2.81 c -1.172,0 -1.911,-1.662 -2.585,-2.917 -2.568,-4.762 -3.441,-7.954 -7.281,-7.954 h -1.662 v -4.929 h 5.552 l 0.017,-27.238 c 0.066,-2.643 1.089,-4.929 2.693,-6.192 4.014,-3.142 10.979,-2.203 14.985,0.39 z" style="fill:#434747;fill-opacity:1;fill-rule:nonzero;stroke:none" />
                  </g>
                  <g transform="translate(1561.7651,192.6286)">
                    <path d="m 0,0 v 49.489 h -11.171 l -11.844,-35.06 -10.83,33.555 c 0,0 -0.531,1.43 -1.713,1.43 H -47.002 V 0 h 4.861 V 40.644 L -28.774,0 h 6.033 c 4.97,13.407 8.794,27.221 13.847,41.06 V 0 Z" style="fill:#434747;fill-opacity:1;fill-rule:nonzero;stroke:none" />
                  </g>
                  <g transform="translate(1669.02,241.244)">
                    <path d="m 0,0 c 0,-1.862 -1.055,-3.532 -2.752,-4.331 -0.722,-0.34 -1.645,-0.473 -2.501,-0.473 -0.865,0 -1.788,0.133 -2.518,0.473 -1.687,0.799 -2.751,2.469 -2.751,4.331 0,1.862 1.064,3.533 2.751,4.33 0.73,0.341 1.653,0.474 2.518,0.474 0.856,0 1.779,-0.133 2.501,-0.474 C -1.055,3.533 0,1.862 0,0" style="fill:#434747;fill-opacity:1;fill-rule:nonzero;stroke:none" />
                  </g>
                  <g transform="translate(1710.0972,216.2753)">
                    <path d="m 0,0 c -0.482,5.511 -2.162,9.875 -5.428,12.593 -5.503,4.579 -13.49,4.721 -19.2,2.451 -3.981,-1.562 -4.239,-0.465 -4.713,0.499 0,0 -2.618,-1.055 -3.35,-1.413 -0.532,-0.257 -0.963,-0.523 -0.822,-1.579 0.149,-1.056 0.382,-2.427 0.407,-3.865 l -0.009,-46.662 c 2.693,0.008 5.611,-0.025 8.229,0.025 V 9.085 c 1.388,1.163 3.3,2.061 5.835,2.061 9.442,0 9.982,-11.503 9.999,-15.135 0.033,-4.829 -0.831,-8.745 -2.801,-11.57 -1.613,-2.311 -4.14,-3.774 -7.721,-4.09 0,0 -1.264,-0.007 -2.727,0.308 v -4.405 c 1.429,-0.474 2.809,-0.657 5.46,-0.483 5.628,0.375 9.542,2.668 12.343,5.993 2.943,3.516 4.63,8.387 4.655,14.762 z" style="fill:#434747;fill-opacity:1;fill-rule:nonzero;stroke:none" />
                  </g>
                  <g transform="translate(1762.2446,195.205)">
                    <path d="M 0,0 C -0.15,1.056 -0.382,2.427 -0.4,3.865 V 25.95 c -0.381,5.119 -4.404,13.008 -17.188,11.412 -3.283,-0.408 -5.702,-1.239 -9.118,-2.627 -0.091,-0.033 1.313,-3.183 1.954,-4.604 1.662,0.365 6.824,3.631 12.716,1.645 2.934,-0.989 3.441,-4.439 3.566,-6.716 0,-1.205 0.025,-3.599 0,-4.787 V 15.859 14.396 14.38 L -8.445,4.156 c -1.405,-1.18 -2.768,-2.128 -6.084,-2.194 -5.86,-0.141 -6.566,4.529 -6.566,6.69 0,4.889 4.637,6.783 10.406,7.141 v 4.438 c -0.516,-0.025 -1.03,-0.066 -2.037,-0.125 -3.99,-0.224 -7.654,-0.781 -10.663,-2.06 -3.142,-1.331 -5.403,-3.417 -6.184,-7.066 -0.241,-1.189 -0.175,-0.798 -0.258,-1.77 l -0.042,-1.796 c 0,-9.617 11.554,-13.091 20.996,-9.35 3.972,1.571 4.239,-0.091 4.713,-1.048 0,0 2.609,1.056 3.349,1.414 C -0.283,-1.313 0.141,-1.055 0,0" style="fill:#434747;fill-opacity:1;fill-rule:nonzero;stroke:none" />
                  </g>
                  <g transform="translate(1478.8467,223.8392)">
                    <path d="m 0,0 c 5.852,1.371 10.208,6.4 10.208,12.427 0,7.064 -6.018,12.807 -13.382,12.807 -6.35,0 -11.67,-4.255 -13.041,-9.924 v -34.868 c 1.371,-5.668 6.691,-9.915 13.041,-9.915 7.364,0 13.382,5.734 13.382,12.8 0,5.984 -4.356,11.054 -10.208,12.426 l -11.86,0.033 V 0 Z m -3.174,21.062 c 4.962,0 9.026,-3.898 9.026,-8.635 0,-3.858 -2.651,-7.116 -6.3,-8.222 h -11.345 l -0.025,10.69 c 1.105,3.557 4.563,6.167 8.644,6.167 m -8.619,-29.515 h 11.345 c 3.649,-1.114 6.3,-4.372 6.3,-8.22 0,-4.755 -4.064,-8.653 -9.026,-8.653 -4.081,0 -7.539,2.618 -8.644,6.176 z m -21.885,33.687 c -7.373,0 -13.39,-5.743 -13.39,-12.807 0,-6.027 4.371,-11.056 10.215,-12.427 h 11.869 v -4.322 l -11.869,0.075 c -5.844,-1.372 -10.215,-6.442 -10.215,-12.426 0,-7.066 6.017,-12.8 13.39,-12.8 6.333,0 11.669,4.247 13.033,9.915 V 15.31 c -1.364,5.669 -6.7,9.924 -13.033,9.924 m 8.619,-21.029 h -11.346 c -3.649,1.106 -6.292,4.364 -6.292,8.222 0,4.737 4.048,8.635 9.019,8.635 4.089,0 7.538,-2.61 8.652,-6.167 z m -8.619,-29.531 c -4.971,0 -9.019,3.898 -9.019,8.653 0,3.848 2.643,7.106 6.292,8.22 h 11.346 l 0.033,-10.697 c -1.114,-3.558 -4.563,-6.176 -8.652,-6.176 m 52.655,37.935 c 0,10.572 -9.144,20.796 -20.116,20.796 -10.613,0 -13.996,-6.691 -14.869,-8.744 -0.166,-0.399 -0.207,-0.69 -0.207,-0.856 v -0.141 c 3.241,3.415 7.904,5.56 13.066,5.56 9.74,0 17.679,-7.58 17.679,-16.898 h -0.009 c 0,-6.209 -3.524,-11.644 -8.744,-14.587 5.22,-2.942 8.744,-8.378 8.744,-14.57 l 0.009,0.008 c 0,-9.301 -7.939,-16.881 -17.679,-16.881 -5.162,0 -9.825,2.136 -13.066,5.544 v -0.133 c 0,-0.167 0.041,-0.457 0.207,-0.856 0.873,-2.044 4.256,-8.744 14.869,-8.744 10.972,0 20.116,10.223 20.116,20.787 0,5.802 -2.477,11.063 -6.451,14.87 3.974,3.799 6.451,9.06 6.451,14.845 m -52.713,-46.313 c -9.725,0 -17.671,7.572 -17.671,16.873 0,6.201 3.524,11.628 8.76,14.57 -5.236,2.943 -8.76,8.378 -8.76,14.587 0,9.318 7.946,16.898 17.671,16.898 5.178,0 9.832,-2.145 13.074,-5.56 v 0.141 c -0.008,0.166 -0.042,0.457 -0.208,0.856 -0.864,2.053 -4.264,8.744 -14.87,8.744 -10.963,0 -20.114,-10.224 -20.114,-20.796 0,-5.785 2.476,-11.046 6.449,-14.845 -3.973,-3.807 -6.449,-9.068 -6.449,-14.87 0,-10.564 9.151,-20.787 20.114,-20.787 10.606,0 14.006,6.7 14.87,8.744 0.166,0.399 0.2,0.689 0.208,0.856 v 0.133 c -3.242,-3.408 -7.896,-5.544 -13.074,-5.544" style="fill:#c72127;fill-opacity:1;fill-rule:nonzero;stroke:none" />
                  </g>
                </g>
              </g>
            </g>
         </svg>
      </div>
      <nav class="flex-grow p-2 space-y-1">
        @for(item of menuItems; track item.label) {
          @if (hasAccessToGroup(item)) {
            <div>
              <!-- Main Item Link or Expander Button -->
              <a 
                (click)="item.view ? navigate.emit(item.view) : (item.key && toggleGroup(item.key))"
                class="group w-full flex items-center justify-between py-2 px-3 rounded-md cursor-pointer transition-colors duration-200"
                [class.bg-secondary/60]="currentView() === item.view || (item.key && isSubItemActive(item))"
                [class.text-white]="currentView() === item.view || (item.key && isSubItemActive(item))"
                [class.hover:bg-secondary/30]="currentView() !== item.view && !(item.key && isSubItemActive(item))"
              >
                <div class="flex items-center space-x-3">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 transition-colors" [class.text-accent]="currentView() === item.view || (item.key && isSubItemActive(item))" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" [attr.d]="item.icon" clip-rule="evenodd" />
                  </svg>
                  <span class="font-medium">{{ item.label }}</span>
                </div>
                <!-- Chevron for expandable items -->
                @if(item.subItems) {
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 transition-transform duration-300" [class.rotate-90]="openGroupKey() === item.key" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
                  </svg>
                }
              </a>
              
              <!-- Sub Items List -->
              @if (item.subItems && item.key) {
                <div 
                  class="overflow-hidden transition-all duration-300 ease-in-out"
                  [class.max-h-96]="openGroupKey() === item.key"
                  [class.max-h-0]="openGroupKey() !== item.key"
                >
                  <ul class="pt-1 pl-6 space-y-1">
                    @for (subItem of item.subItems; track subItem.view) {
                      @if (authService.canAccess(subItem.view)) {
                        <li>
                          <a (click)="navigate.emit(subItem.view)" 
                            class="flex items-center gap-3 py-1.5 px-3 rounded-md cursor-pointer text-sm transition-colors duration-200"
                            [class.bg-secondary/60]="currentView() === subItem.view"
                            [class.text-white]="currentView() === subItem.view"
                            [class.hover:bg-secondary/30]="currentView() !== subItem.view"
                            [class.text-slate-300]="currentView() !== subItem.view"
                            >
                            <span class="w-1.5 h-1.5 rounded-full" [class.bg-accent]="currentView() === subItem.view" [class.bg-slate-500]="currentView() !== subItem.view"></span>
                            <span>{{ subItem.label }}</span>
                          </a>
                        </li>
                      }
                    }
                  </ul>
                </div>
              }
            </div>
          }
        }
      </nav>
      
      <div class="mt-auto p-2 border-t border-secondary">
        <div class="text-sm px-3 py-2 text-slate-300">
            Logado como: <span class="font-bold">{{ authService.currentUser()?.username }}</span>
        </div>
        <button (click)="logout()" class="w-full flex items-center gap-3 py-2 px-3 rounded-md cursor-pointer text-sm transition-colors duration-200 text-slate-300 hover:bg-accent hover:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V5h10a1 1 0 100-2H3zM12 15a1 1 0 001-1v-1h1a1 1 0 100-2h-1V9a1 1 0 10-2 0v1H9a1 1 0 100 2h1v1a1 1 0 001 1zm-5-8a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
            </svg>
            <span>Sair</span>
        </button>
      </div>
    </aside>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarComponent {
  currentView = input.required<View>();
  navigate = output<View>();
  openGroupKey = signal<string | null>(null);
  authService = inject(AuthService);

  menuItems: MenuItem[] = [
     {
      label: 'Dashboard',
      icon: 'M10 2a1 1 0 00-1 1v1a1 1 0 002 0V3a1 1 0 00-1-1zM4 4h3a3 3 0 006 0h3a2 2 0 012 2v9a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zm2.5 7.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z',
      view: 'dashboard'
    },
    {
      label: 'Estoque',
      icon: 'M5 8a1 1 0 00-1 1v10a1 1 0 001 1h10a1 1 0 001-1V9a1 1 0 00-1-1H5zM2 5a2 2 0 012-2h12a2 2 0 012 2v2a1 1 0 11-2 0V5a1 1 0 00-1-1H5a1 1 0 00-1 1v12a1 1 0 001 1h2a1 1 0 110 2H4a2 2 0 01-2-2V5z',
      key: 'estoque',
      subItems: [
        { label: 'Inventário Geral', view: 'inventory' },
        { label: 'Prateleira Vermelha', view: 'red_shelf' },
      ]
    },
    {
      label: 'Operações',
      icon: 'M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z',
      key: 'operacoes',
      subItems: [
        { label: 'Entrada de Itens', view: 'entry' },
        { label: 'Saída de Itens', view: 'exit' },
        { label: 'Listas de Coleta', view: 'picking_lists' },
      ]
    },
    {
      label: 'Modo Kiosk',
      icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
      view: 'kiosk'
    },
    {
      label: 'Compras',
      icon: 'M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z',
      key: 'compras',
      subItems: [
        { label: 'Ordens de Compra', view: 'purchase_orders' },
        { label: 'Sugestão de Compra', view: 'purchase_suggestion' },
        { label: 'Fornecedores', view: 'suppliers' },
      ]
    },
    {
      label: 'Planejamento',
      icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
      key: 'planejamento',
      subItems: [
        { label: 'Contagem Cíclica', view: 'cycle_count' },
        { label: 'Inventário Físico', view: 'stocktake' },
      ]
    },
    {
      label: 'Análise & IA',
      icon: 'M9 17v-4h4v4H9zM3 2a1 1 0 00-1 1v14a1 1 0 001 1h14a1 1 0 001-1V3a1 1 0 00-1-1H3zm3 2h8v2H6V4z',
      key: 'analise',
      subItems: [
        { label: 'Relatórios', view: 'reports' },
        { label: 'Alertas Inteligentes', view: 'smart_alerts' },
        { label: 'Estimar Demanda', view: 'demand_estimation' },
      ]
    },
    {
      label: 'Administração',
      icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066 2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM10 13a3 3 0 100-6 3 3 0 000 6z',
      key: 'admin',
      subItems: [
        { label: 'Técnicos', view: 'technicians' },
        { label: 'Log de Auditoria', view: 'audit_log' },
        { label: 'Usuários', view: 'users', adminOnly: true },
        { label: 'Configurações', view: 'settings', adminOnly: true },
      ]
    }
  ];

  hasAccessToGroup(item: MenuItem): boolean {
    // If it's a direct link, check its permission
    if (item.view) {
      return this.authService.canAccess(item.view);
    }
    // If it's a group, check if the user can access at least one sub-item
    if (item.subItems) {
      return item.subItems.some(subItem => this.authService.canAccess(subItem.view));
    }
    // Default to false if it's a malformed item
    return false;
  }

  toggleGroup(key: string) {
    this.openGroupKey.update(current => (current === key ? null : key));
  }

  isSubItemActive(item: MenuItem): boolean {
    if (!item.subItems) return false;
    return item.subItems.some(sub => sub.view === this.currentView());
  }

  logout() {
    this.authService.logout();
  }
}
