import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { GeminiService } from './gemini.service';
import { ToastService } from './toast.service';
import { GoogleGenAI, GenerateContentResponse } from '@google/genai';

// Mock declarations for jasmine and globals
declare var describe: any;
declare var beforeEach: any;
declare var it: any;
declare var expect: any;
declare var spyOn: any;
// FIX: Add missing Jasmine type declarations for 'jasmine' and 'expectAsync'.
declare var jasmine: any;
declare var afterEach: any;
declare var fail: any;
declare var expectAsync: any;

// --- Mocks ---
const mockToastService = {
  addToast: jasmine.createSpy('addToast'),
};

// This spy will be used on the mocked instance of the AI model
const mockGenerateContent = jasmine.createSpy('generateContent').and.returnValue(
  Promise.resolve({ text: 'mock response' } as GenerateContentResponse)
);

describe('GeminiService', () => {
  let service: GeminiService;
  
  // This function sets up the test bed with a given initial API key for localStorage
  const setupTestBed = (initialApiKey: string | null) => {
    spyOn(localStorage, 'getItem').and.callFake((key: string) => 
      key === 'gemini_api_key' ? initialApiKey : null
    );
    spyOn(localStorage, 'setItem').and.callFake(() => {});
    spyOn(localStorage, 'removeItem').and.callFake(() => {});

    TestBed.configureTestingModule({
      providers: [
        GeminiService,
        { provide: ToastService, useValue: mockToastService },
      ],
    });

    service = TestBed.inject(GeminiService);

    // If an AI instance was created, spy on its methods
    // FIX: Access private property 'ai' for testing purposes by casting service to 'any'.
    if ((service as any).ai()) {
      spyOn((service as any).ai()!.models, 'generateContent').and.callFake(mockGenerateContent);
    }
  };

  afterEach(() => {
    mockToastService.addToast.calls.reset();
    mockGenerateContent.calls.reset();
  });

  describe('with API key in localStorage', () => {
    beforeEach(() => {
      setupTestBed('test-api-key');
    });

    it('should initialize with API key and be configured', () => {
      expect(localStorage.getItem).toHaveBeenCalledWith('gemini_api_key');
      expect(service.isConfigured()).toBe(true);
      expect(service.apiKeySignal()).toBe('test-api-key');
      // FIX: Access private property 'ai' for testing purposes by casting service to 'any'.
      expect((service as any).ai()).not.toBeNull();
    });

    it('validateKeyOnLoad should call generateContent and show success toast', async () => {
      await service.validateKeyOnLoad();
      // FIX: Access private property 'ai' for testing purposes by casting service to 'any'.
      expect((service as any).ai()!.models.generateContent).toHaveBeenCalledWith({ model: 'gemini-2.5-flash', contents: 'Olá', config: {maxOutputTokens: 2} });
      expect(mockToastService.addToast).toHaveBeenCalledWith('Chave de API do Gemini validada com sucesso!', 'success');
    });
    
    it('validateKeyOnLoad should show error toast on failure and clear key', async () => {
      mockGenerateContent.and.returnValue(Promise.reject('API Error'));
      await service.validateKeyOnLoad();
      expect(mockToastService.addToast).toHaveBeenCalledWith('Chave de API do Gemini inválida ou com problemas.', 'error');
      expect(service.isConfigured()).toBe(false);
    });

    it('generateDescription should call generateContent with the correct prompt', async () => {
      const response = await service.generateDescription('Test Item');
      // FIX: Access private property 'ai' for testing purposes by casting service to 'any'.
      const aiInstance = (service as any).ai();
      expect(aiInstance!.models.generateContent).toHaveBeenCalled();
      // FIX: Cast spy to 'any' to access 'calls' property without full jasmine types.
      const args = (aiInstance!.models.generateContent as any).calls.mostRecent().args[0];
      expect(args.contents).toContain('Crie uma descrição técnica e concisa para o item de almoxarifado: "Test Item"');
      expect(response).toBe('mock response');
    });

    it('clearApiKey should remove the key and de-initialize AI', () => {
      service.clearApiKey();
      expect(localStorage.removeItem).toHaveBeenCalledWith('gemini_api_key');
      expect(service.isConfigured()).toBe(false);
      // FIX: Access private property 'ai' for testing purposes by casting service to 'any'.
      expect((service as any).ai()).toBeNull();
    });
  });

  describe('without API key in localStorage', () => {
    beforeEach(() => {
      setupTestBed(null);
    });

    it('should initialize as not configured', () => {
      expect(service.isConfigured()).toBe(false);
      // FIX: Access private property 'ai' for testing purposes by casting service to 'any'.
      expect((service as any).ai()).toBeNull();
    });

    it('setApiKey should store the key and initialize AI', () => {
      service.setApiKey('new-key');
      expect(localStorage.setItem).toHaveBeenCalledWith('gemini_api_key', 'new-key');
      expect(service.isConfigured()).toBe(true);
      // FIX: Access private property 'ai' for testing purposes by casting service to 'any'.
      expect((service as any).ai()).not.toBeNull();
    });

    it('should throw and show toast when calling a method without being configured', async () => {
       // FIX: Use expectAsync for asynchronous rejection testing.
       await expectAsync(service.generateDescription('Test')).toBeRejectedWithError('Chave de API não configurada.');
       expect(mockToastService.addToast).toHaveBeenCalledWith('Chave de API não configurada.', 'error');
    });
  });
});