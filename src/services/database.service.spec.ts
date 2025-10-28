import { TestBed } from '@angular/core/testing';
import { DatabaseService } from './database.service';
import { DataProvider } from './data.provider';
import { ToastService } from './toast.service';
import { AlmoxarifadoDB, Item, Movement, RedShelfItem, StrategicSector, Supplier, User, UserRole } from '../models';

// FIX: Add ambient declarations for Jasmine types to resolve "Cannot find name" errors
// in an environment where test runner type definitions are not available.
declare var describe: any;
declare var beforeEach: any;
declare var it: any;
declare var expect: any;
declare var jasmine: any;

// --- MOCKS ---

// A mock implementation of DataProvider to simulate backend/localStorage interactions.
const mockDataProvider = {
  getInitialData: jasmine.createSpy('getInitialData').and.callFake(async () => {
    // FIX: Added 'users' property to match AlmoxarifadoDB interface
    return { items: [], redShelfItems: [], technicians: [], suppliers: [], movements: [], categories: [], auditLogs: [], purchaseOrders: [], pickingLists: [], kits: [], reservations: [], users: [] };
  }),
  addItem: jasmine.createSpy('addItem').and.callFake(async (collection, item) => {
    return { ...item, id: 'new-id', createdAt: new Date().toISOString(), quantity: 0 };
  }),
  updateItem: jasmine.createSpy('updateItem').and.callFake(async (collection, item) => {
    return { ...item };
  }),
  deleteItem: jasmine.createSpy('deleteItem').and.returnValue(Promise.resolve()),
  deleteMultipleItems: jasmine.createSpy('deleteMultipleItems').and.returnValue(Promise.resolve()),
  addMovement: jasmine.createSpy('addMovement'),
  adjustItemQuantity: jasmine.createSpy('adjustItemQuantity'),
  logAction: jasmine.createSpy('logAction').and.callFake(async (action, details) => {
    return { id: 'log-id', action, details, user: 'Sistema', timestamp: new Date().toISOString() };
  }),
  addCategory: jasmine.createSpy('addCategory').and.callFake(async (name, existing) => {
    return [...existing, name];
  }),
  deleteCategory: jasmine.createSpy('deleteCategory'),
  addMultipleItems: jasmine.createSpy('addMultipleItems'),
  updateMultipleItems: jasmine.createSpy('updateMultipleItems'),
  addCategories: jasmine.createSpy('addCategories'),
};

const mockToastService = {
  addToast: jasmine.createSpy('addToast'),
};


describe('DatabaseService', () => {
  let service: DatabaseService;
  let provider: DataProvider;

  // Helper to get a clean initial state for tests
  const getInitialDbState = (): AlmoxarifadoDB => ({
    items: [
      { id: 'item-1', name: 'Parafuso', description: 'Um parafuso', category: 'Ferramentas', price: 1, preferredSupplierId: 's1', reorderPoint: 20, quantity: 100, createdAt: '2023-01-01' } as Item
    ],
    redShelfItems: [
        { id: 'ss-1', name: 'Máscara de Solda', description: 'EPI', sector: StrategicSector.Mecanica, quantity: 5, createdAt: '2023-01-01' } as RedShelfItem
    ],
    technicians: [{ id: 'tech-1', name: 'Ana', matricula: '123' }],
    suppliers: [{ id: 's1', name: 'Fornecedor A', contact: 'contato@a.com', cnpj: '11.222.333/0001-10', address: 'Rua Teste, 123', responsibleName: 'Sr. Teste' }],
    movements: [],
    categories: ['Ferramentas', 'Sinalização'],
    auditLogs: [],
    purchaseOrders: [],
    pickingLists: [],
    kits: [],
    reservations: [],
    // FIX: Added 'users' property to satisfy the AlmoxarifadoDB interface.
    users: [],
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        DatabaseService,
        { provide: DataProvider, useValue: mockDataProvider },
        { provide: ToastService, useValue: mockToastService },
      ],
    });

    // Reset spies before each test
    Object.values(mockDataProvider).forEach(spy => spy.calls.reset());
    mockToastService.addToast.calls.reset();

    // Set up the initial data that the provider will return
    mockDataProvider.getInitialData.and.returnValue(Promise.resolve(getInitialDbState()));
    
    service = TestBed.inject(DatabaseService);
    provider = TestBed.inject(DataProvider);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should load initial data on construction', (done) => {
    // The constructor is async, so we need to wait for the promise to resolve.
    setTimeout(() => {
      expect(provider.getInitialData).toHaveBeenCalled();
      expect(service.db().items.length).toBe(1);
      expect(service.db().items[0].name).toBe('Parafuso');
      done();
    }, 0);
  });

  describe('CRUD Operations', () => {
    it('addItem should call provider and update db signal', async () => {
      const newItemData = { name: 'Martelo', matricula: '456' };
      
      await service.addItem('technicians', newItemData);
      
      expect(provider.addItem).toHaveBeenCalledWith('technicians', newItemData);
      expect(service.db().technicians.length).toBe(2);
      expect(service.db().technicians[1].name).toBe('Martelo');
    });

    it('updateItem should call provider and update db signal', async () => {
      const updatedItem = { ...getInitialDbState().items[0], name: 'Parafuso Allen' };

      await service.updateItem('items', updatedItem);

      expect(provider.updateItem).toHaveBeenCalledWith('items', updatedItem);
      expect(service.db().items[0].name).toBe('Parafuso Allen');
    });

    it('deleteItem should call provider and update db signal', async () => {
      const itemIdToDelete = 'item-1';
      
      await service.deleteItem('items', itemIdToDelete);

      expect(provider.deleteItem).toHaveBeenCalledWith('items', itemIdToDelete);
      expect(service.db().items.length).toBe(0);
    });
  });

  describe('Business Logic', () => {

    it('addMovement (out) should fail if stock is insufficient', async () => {
      const movement: Omit<Movement, 'id'> = {
        itemId: 'item-1',
        type: 'out',
        quantity: 101, // More than available (100)
        date: new Date().toISOString(),
        technicianId: 'tech-1'
      };
      
      // Mock the provider to simulate failure
      mockDataProvider.addMovement.and.returnValue(Promise.resolve({ success: false, message: 'Estoque insuficiente' }));

      const result = await service.addMovement(movement);
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Estoque insuficiente');
      expect(provider.addMovement).toHaveBeenCalled();
      // Ensure state was not changed in the service (provider is source of truth)
      expect(service.db().items.find(i => i.id === 'item-1')?.quantity).toBe(100);
      expect(service.db().movements.length).toBe(0);
    });

    it('addMovement (out) should succeed if stock is sufficient', async () => {
        const movementData: Omit<Movement, 'id'> = {
            itemId: 'item-1', type: 'out', quantity: 10,
            date: new Date().toISOString(),
            technicianId: 'tech-1'
        };

        const updatedItem = { ...getInitialDbState().items[0], quantity: 90 };
        const providerResponse = {
            success: true, message: 'OK',
            newMovement: { ...movementData, id: 'move-1' },
            updatedItem: updatedItem
        };
        mockDataProvider.addMovement.and.returnValue(Promise.resolve(providerResponse));

        const result = await service.addMovement(movementData);

        expect(result.success).toBe(true);
        expect(provider.addMovement).toHaveBeenCalledWith(movementData);
        // Test signal update
        expect(service.db().items.find(i => i.id === 'item-1')!.quantity).toBe(90);
        expect(service.db().movements.length).toBe(1);
        expect(service.db().movements[0].id).toBe('move-1');
        expect(provider.logAction).toHaveBeenCalledWith('SAIDA_ITEM', jasmine.any(String));
    });

    it('addMovement (in) should always succeed', async () => {
        // FIX: Added missing 'technicianId' property. For 'in' movements, this should be null.
        const movementData: Omit<Movement, 'id'> = {
            itemId: 'ss-1', type: 'in', quantity: 25,
            date: new Date().toISOString(),
            technicianId: null
        };
        const updatedItem = { ...getInitialDbState().redShelfItems[0], quantity: 30 };
        const providerResponse = {
            success: true, message: 'OK',
            newMovement: { ...movementData, id: 'move-2' },
            updatedItem: updatedItem
        };
        mockDataProvider.addMovement.and.returnValue(Promise.resolve(providerResponse));

        const result = await service.addMovement(movementData);

        expect(result.success).toBe(true);
        expect(provider.addMovement).toHaveBeenCalledWith(movementData);
        expect(service.db().redShelfItems.find(i => i.id === 'ss-1')!.quantity).toBe(30);
        expect(service.db().movements.length).toBe(1);
        expect(provider.logAction).toHaveBeenCalledWith('ENTRADA_ITEM', jasmine.any(String));
    });

    it('adjustItemQuantity should call provider and update state', async () => {
        const updatedItem = { ...getInitialDbState().items[0], quantity: 95 };
        const providerResponse = {
            updatedItem: updatedItem,
            newMovement: { id: 'move-adj', itemId: 'item-1', type: 'out', quantity: 5, date: 'date' } as Movement
        };
        mockDataProvider.adjustItemQuantity.and.returnValue(Promise.resolve(providerResponse));

        await service.adjustItemQuantity('item-1', 95, 'Contagem física', false);

        expect(provider.adjustItemQuantity).toHaveBeenCalledWith('item-1', 95, 'Contagem física', false);
        expect(service.db().items.find(i => i.id === 'item-1')!.quantity).toBe(95);
        expect(service.db().movements[0].id).toBe('move-adj');
        expect(mockToastService.addToast).toHaveBeenCalledWith('Estoque ajustado com sucesso!', 'success');
        expect(provider.logAction).toHaveBeenCalledWith('ADJUST_ITEM', jasmine.stringMatching(/de 100 para 95/));
    });
  });
});