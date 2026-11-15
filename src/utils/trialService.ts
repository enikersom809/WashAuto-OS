import { Tenant } from '../types';

export const DEFAULT_TRIAL_DAYS = 20;

export interface TenantTrialStatusInfo {
  isTrial: boolean;
  isExpired: boolean;
  isBlocked: boolean;
  blockReason: 'trial_expired' | 'suspended' | 'overdue' | null;
  daysRemaining: number;
  hoursRemaining: number;
  trialStartedAtDate: Date | null;
  trialEndsAtDate: Date | null;
  trialEndsAtFormatted: string;
}

/**
 * Gera datas ISO de início e fim para um período de teste (padrão 20 dias).
 */
export function buildTrialDates(days: number = DEFAULT_TRIAL_DAYS): {
  trialStartedAt: string;
  trialEndsAt: string;
  trialDays: number;
} {
  const start = new Date();
  const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
  return {
    trialStartedAt: start.toISOString(),
    trialEndsAt: end.toISOString(),
    trialDays: days
  };
}

/**
 * Converte string DD/MM/AAAA ou ISO em objeto Date válido.
 */
function parseFlexibleDate(value?: string): Date | null {
  if (!value) return null;
  const trimmed = String(value).trim();
  // Formato DD/MM/YYYY
  const brMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (brMatch) {
    const day = Number(brMatch[1]);
    const month = Number(brMatch[2]) - 1;
    const year = Number(brMatch[3]);
    const d = new Date(year, month, day, 23, 59, 59, 999);
    if (!isNaN(d.getTime())) return d;
  }
  const parsed = new Date(trimmed);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Avalia em tempo real se o período de teste de 20 dias está ativo, expirado ou se o tenant deve ser bloqueado.
 * Regra:
 * - Plano Vitalício nunca expira.
 * - Status 'Suspenso' bloqueia acesso.
 * - Status 'Inadimplente' bloqueia acesso.
 * - Plano 'Trial20' ou status 'Trial': libera durante os 20 dias e bloqueia automaticamente após vencer o prazo,
 *   sendo liberado somente após contratação (mudança para plano pago + status 'Ativo').
 */
export function getTenantTrialInfo(tenant: Tenant, now: Date = new Date()): TenantTrialStatusInfo {
  const isLifetime = tenant.plan === 'Vitalicio' || Boolean(tenant.isLifetime);
  const trialDays = Number(tenant.trialDays || DEFAULT_TRIAL_DAYS);
  const isTrialFlag = tenant.plan === 'Trial20' || tenant.status === 'Trial';

  const startDate =
    parseFlexibleDate(tenant.trialStartedAt) ||
    parseFlexibleDate(tenant.createdAt) ||
    now;

  const endDate =
    parseFlexibleDate(tenant.trialEndsAt) ||
    new Date(startDate.getTime() + trialDays * 24 * 60 * 60 * 1000);

  const trialEndsAtFormatted = endDate.toLocaleDateString('pt-BR');

  if (tenant.status === 'Suspenso') {
    const expiredCheck = isTrialFlag && now.getTime() >= endDate.getTime();
    return {
      isTrial: isTrialFlag,
      isExpired: expiredCheck,
      isBlocked: true,
      blockReason: expiredCheck ? 'trial_expired' : 'suspended',
      daysRemaining: 0,
      hoursRemaining: 0,
      trialStartedAtDate: startDate,
      trialEndsAtDate: endDate,
      trialEndsAtFormatted
    };
  }

  if (tenant.status === 'Inadimplente') {
    return {
      isTrial: false,
      isExpired: false,
      isBlocked: true,
      blockReason: 'overdue',
      daysRemaining: 0,
      hoursRemaining: 0,
      trialStartedAtDate: startDate,
      trialEndsAtDate: endDate,
      trialEndsAtFormatted
    };
  }

  // Plano pago contratado e ativo (Basic / Pro / Enterprise / Vitalicio / Custom com status Ativo)
  if ((isLifetime || tenant.plan !== 'Trial20') && tenant.status === 'Ativo') {
    return {
      isTrial: false,
      isExpired: false,
      isBlocked: false,
      blockReason: null,
      daysRemaining: 0,
      hoursRemaining: 0,
      trialStartedAtDate: startDate,
      trialEndsAtDate: endDate,
      trialEndsAtFormatted
    };
  }

  // Avaliação do Teste de 20 Dias
  if (isTrialFlag) {
    const diffMs = endDate.getTime() - now.getTime();
    const isExpired = diffMs <= 0;
    const daysRemaining = isExpired ? 0 : Math.max(1, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
    const hoursRemaining = isExpired ? 0 : Math.max(0, Math.ceil(diffMs / (60 * 60 * 1000)));

    return {
      isTrial: true,
      isExpired,
      isBlocked: isExpired,
      blockReason: isExpired ? 'trial_expired' : null,
      daysRemaining,
      hoursRemaining,
      trialStartedAtDate: startDate,
      trialEndsAtDate: endDate,
      trialEndsAtFormatted
    };
  }

  return {
    isTrial: false,
    isExpired: false,
    isBlocked: false,
    blockReason: null,
    daysRemaining: 0,
    hoursRemaining: 0,
    trialStartedAtDate: startDate,
    trialEndsAtDate: endDate,
    trialEndsAtFormatted
  };
}
