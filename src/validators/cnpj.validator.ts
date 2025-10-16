import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export const cnpjValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const cnpj = control.value;
  if (!cnpj) {
    return null; // Don't validate empty values, let 'required' handle it
  }

  const cleaned = cnpj.replace(/[^\d]+/g, '');

  if (cleaned.length !== 14) {
    return { cnpjInvalid: 'O CNPJ deve ter 14 dígitos.' };
  }

  // Elimina CNPJs invalidos conhecidos
  if (/^(\d)\1+$/.test(cleaned)) {
    return { cnpjInvalid: 'CNPJ inválido.' };
  }

  // Valida DVs
  let tamanho = cleaned.length - 2;
  let numeros = cleaned.substring(0, tamanho);
  let digitos = cleaned.substring(tamanho);
  let soma = 0;
  let pos = tamanho - 7;
  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i), 10) * pos--;
    if (pos < 2) {
      pos = 9;
    }
  }
  let resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (resultado !== parseInt(digitos.charAt(0), 10)) {
    return { cnpjInvalid: 'CNPJ inválido.' };
  }

  tamanho = tamanho + 1;
  numeros = cleaned.substring(0, tamanho);
  soma = 0;
  pos = tamanho - 7;
  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i), 10) * pos--;
    if (pos < 2) {
      pos = 9;
    }
  }
  resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (resultado !== parseInt(digitos.charAt(1), 10)) {
    return { cnpjInvalid: 'CNPJ inválido.' };
  }

  return null;
};
