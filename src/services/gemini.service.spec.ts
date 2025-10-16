import { TestBed } from '@angular/core/testing';
import { GeminiService } from './gemini.service';
import { ToastService } from './toast.service';
import { GoogleGenAI, GenerateContentResponse } from '@google/genai';
import { Supplier } from '../models';

// FIX: Add ambient declarations for Jasmine types to resolve "Cannot find name" errors
// in an environment where test runner type definitions are not available.
declare var describe: any;
declare var beforeEach: any;
declare var it: any;
declare var expect: any;
declare var spyOn: any;
declare var jasmine: any;
declare var expectAsync: any;
declare var globalThis: any;

// Mock ToastService
const mockToastService = {
  addToast: jasmine.createSpy('addToast'),
};

// Mock GoogleGenAI
class MockGoogleGenAI {
  models = {
    generateContent: jasmine.createSpy('generateContent').and.callFake(async (request: any) => {
        if (request.contents.includes('error')) {
            return Promise.reject(new Error('API error'));
        }
        return Promise.resolve({ text: 'Mocked response' } as GenerateContentResponse);
    }),
  };
}

describe('GeminiService', () => {
  let service: GeminiService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        GeminiService,
        { provide: ToastService, useValue: mockToastService },
      ],
    });
    
    // Reset mocks
    mockToastService.addToast.calls.reset();

    // Spy on GoogleGenAI, allowing it to be re-spied on in individual tests.
    // The default is a successful instantiation.
    spyOn(globalThis, 'GoogleGenAI').and.returnValue(new MockGoogleGenAI() as any);
  });

  it('should be created', () => {
    service = TestBed.inject(GeminiService);
    expect(service).toBeTruthy();
  });

  // FIX: Replaced tests for dynamic API key management (setApiKey, clearApiKey) 
  // with a test that reflects the current implementation where the key is a constant.
  describe('Initialization', () => {
    it('should initialize with AI enabled because a key is provided in the service', () => {
      service = TestBed.inject(GeminiService);
      expect(service.isConfigured()).toBe(true);
      expect(globalThis.GoogleGenAI).toHaveBeenCalled();
    });

    it('should initialize with AI disabled if the GoogleGenAI constructor throws an error', () => {
      // Override the spy for this specific test
      (globalThis.GoogleGenAI as any).and.throwError("Initialization failed");
      service = TestBed.inject(GeminiService);
      expect(service.isConfigured()).toBe(false);
    });
  });

  describe('Content Generation', () => {
    beforeEach(() => {
        service = TestBed.inject(GeminiService);
    });

    it('generateDescription should call generateContent with the correct prompt', async () => {
      const itemName = 'Parafuso';
      await service.generateDescription(itemName);
      const mockGenAIInstance = (globalThis.GoogleGenAI as any).calls.mostRecent().returnValue;
      
      expect(mockGenAIInstance.models.generateContent).toHaveBeenCalled();
      const args = mockGenAIInstance.models.generateContent.calls.mostRecent().args[0];
      expect(args.contents).toContain(`"${itemName}"`);
      expect(args.contents).toContain('descrição curta e concisa');
    });

    it('suggestCategory should call generateContent with the correct prompt', async () => {
      const itemName = 'Resistor';
      const categories = ['Eletrônicos', 'Ferramentas'];
      await service.suggestCategory(itemName, categories);
      const mockGenAIInstance = (globalThis.GoogleGenAI as any).calls.mostRecent().returnValue;

      expect(mockGenAIInstance.models.generateContent).toHaveBeenCalled();
      const args = mockGenAIInstance.models.generateContent.calls.mostRecent().args[0];
      expect(args.contents).toContain(`"${itemName}"`);
      expect(args.contents).toContain(categories.join(', '));
    });

    it('should return the text from the API response', async () => {
      const response = await service.generateDescription('any item');
      expect(response).toBe('Mocked response');
    });
    
    // FIX: Updated test to reflect that the service cannot be configured at runtime.
    // This test now simulates a failed initialization to check error handling.
    it('should throw an error and show a toast if AI is not configured', async () => {
      // Make initialization fail
      (globalThis.GoogleGenAI as any).and.throwError('Initialization failed');
      
      // Re-inject service to trigger constructor with the failing mock
      service = TestBed.inject(GeminiService);
      expect(service.isConfigured()).toBe(false);
      
      await expectAsync(service.generateDescription('any item')).toBeRejectedWithError('Gemini API not configured');
      expect(mockToastService.addToast).toHaveBeenCalledWith('Serviço de IA não configurado. A chave de API pode ser inválida.', 'error');
    });

    it('should handle API errors and show a toast', async () => {
      // The mock is configured to reject if the prompt contains 'error'
      await expectAsync(service.parseSearchQuery('trigger error', [])).toBeNull();
      expect(mockToastService.addToast).toHaveBeenCalledWith('Falha ao processar a busca com IA.', 'error');
    });
  });
});
