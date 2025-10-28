import { Component, ChangeDetectionStrategy, output, inject, signal, viewChild, ElementRef, OnDestroy, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GeminiService } from '../services/gemini.service';
import { ToastService } from '../services/toast.service';
import { DatabaseService } from '../services/database.service';

interface RecognizedItem {
  name: string;
  unit: string;
  category: string;
  description: string;
}

@Component({
  selector: 'app-image-recognition',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
      <div class="bg-white dark:bg-primary p-6 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-xl font-bold">Adicionar Item com IA</h3>
          <button (click)="closeModal()" class="text-2xl">&times;</button>
        </div>
        <div class="flex-grow overflow-y-auto pr-2 text-center">
          @if (isLoading()) {
            <div class="flex flex-col items-center justify-center h-full">
              <div class="w-12 h-12 border-4 border-slate-400 border-t-accent rounded-full animate-spin mb-4"></div>
              <p class="text-lg font-semibold">Analisando imagem...</p>
              <p class="text-slate-500 dark:text-slate-400 mt-2">A IA está identificando o item.</p>
            </div>
          } @else if (capturedImage()) {
            <div class="flex flex-col items-center">
              <p class="mb-4">Foto capturada. Deseja analisar esta imagem?</p>
              <img [src]="capturedImage()" alt="Captured item" class="rounded-lg max-h-80 mb-4" />
              <div class="flex gap-4">
                <button (click)="retakePhoto()" class="px-4 py-2 bg-slate-200 dark:bg-secondary rounded">Tirar Outra Foto</button>
                <button (click)="analyzeImage()" class="px-4 py-2 bg-accent text-white rounded">Analisar Imagem</button>
              </div>
            </div>
          } @else {
            <div class="flex flex-col items-center">
              <p class="mb-4">Posicione o item em frente à câmera e tire uma foto.</p>
              <div class="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
                <video #videoElement autoplay playsinline class="w-full h-full"></video>
                @if (error()) {
                  <div class="absolute inset-0 flex items-center justify-center bg-black/50">
                    <p class="text-white text-center p-4">{{ error() }}</p>
                  </div>
                }
              </div>
              <canvas #canvasElement class="hidden"></canvas>
              <button (click)="captureImage()" [disabled]="!stream()" class="mt-4 px-6 py-3 bg-accent text-white rounded-lg text-lg font-bold disabled:opacity-50">Tirar Foto</button>
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class ImageRecognitionComponent implements AfterViewInit, OnDestroy {
  itemRecognized = output<RecognizedItem>();
  close = output<void>();

  private geminiService = inject(GeminiService);
  private toastService = inject(ToastService);
  private dbService = inject(DatabaseService);
  
  videoElement = viewChild.required<ElementRef<HTMLVideoElement>>('videoElement');
  canvasElement = viewChild.required<ElementRef<HTMLCanvasElement>>('canvasElement');

  stream = signal<MediaStream | null>(null);
  capturedImage = signal<string | null>(null);
  isLoading = signal(false);
  error = signal<string | null>(null);

  ngAfterViewInit() {
    this.startCamera();
  }

  ngOnDestroy() {
    this.stopCamera();
  }

  async startCamera() {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        this.stream.set(stream);
        this.videoElement().nativeElement.srcObject = stream;
      } else {
        this.error.set('Câmera não suportada neste navegador.');
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      this.error.set('Não foi possível acessar a câmera. Verifique as permissões.');
    }
  }

  stopCamera() {
    this.stream()?.getTracks().forEach(track => track.stop());
    this.stream.set(null);
  }

  captureImage() {
    const video = this.videoElement().nativeElement;
    const canvas = this.canvasElement().nativeElement;
    const context = canvas.getContext('2d');
    if (context) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg');
      this.capturedImage.set(dataUrl);
      this.stopCamera();
    }
  }
  
  retakePhoto() {
    this.capturedImage.set(null);
    this.error.set(null);
    this.startCamera();
  }

  async analyzeImage() {
    const image = this.capturedImage();
    if (!image) return;

    this.isLoading.set(true);
    const base64Data = image.split(',')[1];
    const categories = this.dbService.db().categories;
    
    try {
      const result = await this.geminiService.analyzeItemImage(base64Data, categories);
      if (result) {
        this.itemRecognized.emit(result);
      } else {
        // Error toast is already shown by the service
        this.retakePhoto();
      }
    } finally {
      this.isLoading.set(false);
    }
  }

  closeModal() {
    this.close.emit();
  }
}