// Gerenciador do Logotipo Oficial da Plataforma WashAuto OS

export const DEFAULT_LOGO_FALLBACK = '/logo.png';

export function getPlatformLogo(): string {
  if (typeof window === 'undefined') return DEFAULT_LOGO_FALLBACK;
  const saved = localStorage.getItem('washauto_custom_logo');
  if (saved && (saved.includes('SUA-LOGO') || saved.includes('logo.svg') || saved === '/logo.svg')) {
    localStorage.removeItem('washauto_custom_logo');
    return DEFAULT_LOGO_FALLBACK;
  }
  return saved || DEFAULT_LOGO_FALLBACK;
}

export function setPlatformLogo(logoDataUrl: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('washauto_custom_logo', logoDataUrl);
  window.dispatchEvent(new CustomEvent('washauto_logo_changed', { detail: logoDataUrl }));
}

export function resetPlatformLogo(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('washauto_custom_logo');
  window.dispatchEvent(new CustomEvent('washauto_logo_changed', { detail: DEFAULT_LOGO_FALLBACK }));
}

