export type PlanType = 'Basic' | 'Pro' | 'Enterprise' | 'Custom';
export type TenantStatus = 'Ativo' | 'Inadimplente' | 'Suspenso' | 'Trial';

export interface Tenant {
  id: string;
  name: string;
  code: string;
  domain: string;
  plan: PlanType;
  status: TenantStatus;
  endUsersCount: number;
  maxUsers: number;
  mrrAmount: number; // in BRL (R$)
  createdAt: string;
  contactEmail: string;
  contactPhone?: string;
  ownerName: string;
  notes?: string;
  lastActive: string;
  // Extended Company / Fiscal Data & Temporary Access
  tempPassword?: string;
  razaoSocial?: string;
  nomeFantasia?: string;
  cnpj?: string;
  inscricaoEstadual?: string;
  address?: {
    cep?: string;
    street?: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
  };
  logoUrl?: string;
}

export interface Plan {
  id: string;
  name: PlanType;
  displayName: string;
  priceMonthly: number;
  maxUsers: number;
  features: string[];
  activeTenantsCount: number;
  isPopular?: boolean;
}

export type AdminRole = 'ROOT' | 'ADMIN' | 'SUPORTE' | 'AUDITOR';

export interface SuperAdminUser {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  status: 'Ativo' | 'Inativo';
  lastLogin: string;
  avatarInitials: string;
}

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'SECURITY';

export interface SystemLog {
  id: string;
  timestamp: string;
  level: LogLevel;
  tenantName: string;
  event: string;
  ipAddress: string;
  user: string;
}

export interface Invoice {
  id: string;
  tenantId: string;
  tenantName: string;
  amount: number;
  date: string;
  dueDate: string;
  status: 'Pago' | 'Pendente' | 'Vencido' | 'Cancelado';
  planName: PlanType;
}

export interface SecuritySetting {
  id: string;
  title: string;
  description: string;
  enabled: boolean;
  category: 'auth' | 'network' | 'audit' | 'api';
}
