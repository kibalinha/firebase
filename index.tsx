import '@angular/compiler';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { AppComponent } from './src/app.component';
import { provideZonelessChangeDetection, LOCALE_ID } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { provideRouter, withHashLocation, withComponentInputBinding } from '@angular/router';
import { APP_ROUTES } from './src/app.routes';

// --- ARQUITETURA DE DADOS ---
// A aplicação utiliza um provedor de dados abstrato para permitir a troca
// entre o armazenamento local (localStorage) e um backend como o Firebase.
import { DataProvider } from './src/services/data.provider';
// import { LocalStorageProvider } from './src/services/local-storage.provider';
import { FirebaseProvider } from './src/services/firebase.provider';
// Para usar um backend real, importe o HttpProvider.
// import { HttpProvider } from './src/services/http.provider';

// Registra os dados de localização para o português do Brasil.
registerLocaleData(localePt);

bootstrapApplication(AppComponent, {
  providers: [
    provideZonelessChangeDetection(),
    provideHttpClient(),
    provideRouter(APP_ROUTES, withHashLocation(), withComponentInputBinding()),
    // Define o local padrão da aplicação como 'pt-BR'.
    { provide: LOCALE_ID, useValue: 'pt-BR' },
    // --- CONFIGURAÇÃO DO PROVEDOR DE DADOS ---
    // Para usar o localStorage (padrão, para funcionar offline):
    // { provide: DataProvider, useClass: LocalStorageProvider },

    // Para conectar ao Firebase, comente a linha acima e descomente a linha abaixo.
    { provide: DataProvider, useClass: FirebaseProvider },
    
    // Para conectar a um backend ASP.NET, comente a linha acima e descomente a linha abaixo.
    // Lembre-se também de descomentar o conteúdo do arquivo 'src/services/http.provider.ts'.
    // { provide: DataProvider, useClass: HttpProvider },
  ],
}).catch((err) => console.error(err));

// AI Studio always uses an `index.tsx` file for all project types.