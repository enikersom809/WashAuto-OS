/**
 * Utilitários padronizados de formatação e máscaras (Brasil)
 */

/**
 * Remove todos os caracteres não numéricos.
 */
export function cleanDigits(value: string | undefined | null): string {
  if (!value) return '';
  return String(value).replace(/\D/g, '');
}

/**
 * Formata CEP no padrão brasileiro oficial: XXXXX-XXX (8 dígitos)
 * Ex: 01001000 -> 01001-000
 */
export function formatCep(value: string | undefined | null): string {
  if (!value) return '';
  const digits = cleanDigits(value).slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

/**
 * Formata Celular ou Telefone fixo no padrão brasileiro oficial:
 * Celular (11 dígitos): (XX) XXXXX-XXXX
 * Fixo (10 dígitos): (XX) XXXX-XXXX
 */
export function formatCelular(value: string | undefined | null): string {
  if (!value) return '';
  const digits = cleanDigits(value).slice(0, 11);
  if (!digits) return '';

  if (digits.length <= 2) {
    return `(${digits}`;
  }
  if (digits.length <= 6) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }
  if (digits.length <= 10) {
    // Padrão 10 dígitos (Fixo ou Celular incompleto): (XX) XXXX-XXXX
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  // Padrão Celular com 9º dígito (11 dígitos): (XX) XXXXX-XXXX
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/**
 * Validação de CEP (deve conter exatamente 8 dígitos numéricos)
 */
export function isValidCep(value: string | undefined | null): boolean {
  return cleanDigits(value).length === 8;
}

/**
 * Validação de Celular/Telefone (deve conter 10 ou 11 dígitos numéricos com DDD válido)
 */
export function isValidCelular(value: string | undefined | null): boolean {
  const digits = cleanDigits(value);
  return digits.length === 10 || digits.length === 11;
}
