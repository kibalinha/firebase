// This file contains all the data models and type definitions for the application.

export type View =
  | 'dashboard'
  | 'inventory'
  | 'red_shelf'
  | 'entry'
  | 'exit'
  | 'technicians'
  | 'suppliers'
  | 'reports'
  | 'audit_log'
  | 'settings'
  | 'demand_estimation'
  | 'kiosk'
  | 'smart_alerts'
  | 'cycle_count'
  | 'item_lifecycle'
  | 'purchase_orders'
  | 'stocktake'
  | 'purchase_suggestion'
  | 'picking_lists'
  | 'kits'
  | 'reservations'
  | 'users'; // Added users view

// A list of all possible views/features that can have permissions
export type Permission = View | 'manage_users' | 'manage_settings';

export const ALL_PERMISSIONS: { id: Permission, label: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'inventory', label: 'Inventário Geral' },
    { id: 'red_shelf', label: 'Prateleira Vermelha' },
    { id: 'entry', label: 'Entrada de Itens' },
    { id: 'exit', label: 'Saída de Itens' },
    { id: 'technicians', label: 'Gerenciar Técnicos' },
    { id: 'suppliers', label: 'Gerenciar Fornecedores' },
    { id: 'reports', label: 'Relatórios' },
    { id: 'audit_log', label: 'Log de Auditoria' },
    { id: 'settings', label: 'Configurações Gerais' },
    { id: 'demand_estimation', label: 'Estimar Demanda (IA)' },
    { id: 'kiosk', label: 'Modo Kiosk' },
    { id: 'smart_alerts', label: 'Alertas Inteligentes (IA)' },
    { id: 'cycle_count', label: 'Contagem Cíclica' },
    { id: 'item_lifecycle', label: 'Ciclo de Vida do Item' },
    { id: 'purchase_orders', label: 'Ordens de Compra' },
    { id: 'stocktake', label: 'Inventário Físico' },
    { id: 'purchase_suggestion', label: 'Sugestão de Compra' },
    { id: 'picking_lists', label: 'Listas de Coleta' },
    { id: 'kits', label: 'Kits' },
    { id: 'reservations', label: 'Reservas' },
    { id: 'users', label: 'Gerenciar Usuários' },
];


export enum UserRole {
  Admin = 'Admin',
  User = 'User',
}

export interface User {
  id: string;
  username: string;
  passwordHash: string; // Storing as base64 for this example
  role: UserRole;
  permissions: Permission[];
}

export interface Item {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  quantity: number;
  reorderPoint: number;
  preferredSupplierId: string | null;
  createdAt: string;
}

export interface ItemWithAvailableStock extends Item {
  availableStock: number;
}

export enum StrategicSector {
  Bombeiros = 'Bombeiros',
  Civil = 'Civil',
  Hidraulica = 'Hidráulica',
  Eletrica = 'Elétrica',
  Mecanica = 'Mecânica',
}

export interface RedShelfItem {
    id: string;
    name: string;
    description: string;
    sector: StrategicSector;
    quantity: number;
    notes?: string;
    createdAt: string;
}

export interface Movement {
  id: string;
  itemId: string;
  type: 'in' | 'out';
  quantity: number;
  date: string;
  technicianId: string | null;
  notes?: string;
}

export interface Technician {
  id: string;
  name: string;
  matricula: string;
  password?: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact: string;
  cnpj: string;
  address: string;
  responsibleName: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  details: string;
  user: string;
}

export enum PurchaseOrderStatus {
  Rascunho = 'Rascunho',
  Enviado = 'Enviado',
  RecebidoParcialmente = 'Recebido Parcialmente',
  Recebido = 'Recebido',
  Cancelado = 'Cancelado'
}

export interface PurchaseOrderItem {
  itemId: string;
  quantity: number;
  receivedQuantity: number;
  unitPrice: number;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  status: PurchaseOrderStatus;
  items: PurchaseOrderItem[];
  createdAt: string;
  notes?: string;
}

export enum PickingListStatus {
  Pendente = 'Pendente',
  EmColeta = 'Em Coleta',
  Concluida = 'Concluída',
}

export interface PickingListItem {
  itemId: string;
  quantity: number;
  pickedQuantity: number;
}

export interface PickingList {
  id: string;
  name: string;
  technicianId: string;
  status: PickingListStatus;
  items: PickingListItem[];
  createdAt: string;
}

export interface KitComponent {
  itemId: string;
  quantity: number;
}

export interface Kit {
  id: string;
  name: string;
  components: KitComponent[];
  createdAt: string;
}

export enum ReservationStatus {
  Pendente = 'Pendente',
  Atendida = 'Atendida',
  Cancelada = 'Cancelada'
}

export interface ReservationItem {
  itemId: string;
  quantity: number;
}

export interface Reservation {
  id: string;
  name: string;
  technicianId: string;
  dueDate: string;
  status: ReservationStatus;
  items: ReservationItem[];
  createdAt: string;
}

export interface AlmoxarifadoDB {
  items: Item[];
  redShelfItems: RedShelfItem[];
  technicians: Technician[];
  suppliers: Supplier[];
  movements: Movement[];
  categories: string[];
  auditLogs: AuditLog[];
  purchaseOrders: PurchaseOrder[];
  pickingLists: PickingList[];
  kits: Kit[];
  reservations: Reservation[];
  users: User[];
}

export interface SearchFilter {
  name?: string;
  category?: string;
  supplierId?: string;
  minQuantity?: number;
  maxQuantity?: number;
}

export interface Forecast {
  summary: string;
  forecast: { date: string; predicted_consumption: number }[];
  purchase_recommendation: {
    should_purchase: boolean;
    quantity_to_purchase: number;
    purchase_date: string;
    reasoning: string;
  };
}

export interface Anomaly {
    movementId: string;
    technicianName: string;
    itemName: string;
    date: string;
    quantity: number;
    reason: string;
    severity: 'Baixa' | 'Média' | 'Alta';
}

export interface AnomalyReport {
    summary: string;
    anomalies: Anomaly[];
}

export interface ParsedInvoiceItem {
  name: string;
  quantity: number;
  price: number;
}

export interface ChatMessage {
  role: 'user' | 'model';
  parts: { text?: string; functionCall?: any; functionResponse?: any; }[];
  suggestions?: string[];
  toolCalls?: any[];
  toolResponses?: any[];
}

export type ReportType =
  | 'top_consumed'
  | 'technician_activity'
  | 'abc'
  | 'turnover'
  | 'supplier'
  | 'aging'
  | 'carrying_cost'
  | 'stockout_history'
  | 'seasonality'
  | 'inventory_adjustments'
  | 'ai_monthly'
  | 'ai_optimization'
  | 'anomaly_detection'
  | 'predictive_maintenance';