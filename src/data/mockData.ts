import { Tenant, Plan, SuperAdminUser, SystemLog, Invoice, SecuritySetting } from '../types';

export const INITIAL_TENANTS: Tenant[] = [];

export const INITIAL_PLANS: Plan[] = [
  {
    id: 'plan-basic',
    name: 'Basic',
    displayName: 'Plano Básico',
    priceMonthly: 199,
    maxUsers: 50,
    features: [
      'Até 50 Usuários Finais',
      'Suporte via E-mail em horário comercial',
      'Relatórios padrão em PDF',
      '1GB de Armazenamento em Nuvem',
      'SSL Compartilhado'
    ],
    activeTenantsCount: 42
  },
  {
    id: 'plan-pro',
    name: 'Pro',
    displayName: 'Plano Profissional',
    priceMonthly: 499,
    maxUsers: 500,
    isPopular: true,
    features: [
      'Até 500 Usuários Finais',
      'Suporte Prioritário 24/7',
      'Relatórios Customizáveis & Analytics',
      'Subdomínio Próprio & Personalização',
      '50GB de Armazenamento em Nuvem',
      'Acesso à API REST Integrada'
    ],
    activeTenantsCount: 78
  },
  {
    id: 'plan-enterprise',
    name: 'Enterprise',
    displayName: 'Plano Corporativo',
    priceMonthly: 1299,
    maxUsers: 10000,
    features: [
      'Usuários Ilimitados / Personalizados',
      'Gerente de Conta Dedicado',
      'SLA Garantido de 99.99%',
      'Domínio Próprio (CNAME)',
      'Single Sign-On (SSO / SAML)',
      'Auditoria de Logs Avançada & Backup Diário'
    ],
    activeTenantsCount: 22
  },
  {
    id: 'plan-vitalicio',
    name: 'Vitalicio',
    displayName: 'Plano Vitalício (Compra do Aplicativo)',
    priceMonthly: 4000,
    isLifetime: true,
    billingCycle: 'lifetime',
    maxUsers: 99999,
    isPopular: false,
    features: [
      'Compra definitiva do aplicativo (Taxa Única de R$ 4.000,00)',
      'Sem mensalidades para sempre (0% taxa mensal recorrente)',
      'Operadores, lavadores e clientes ilimitados',
      'Fila de lavagem & Pátio com agilidade máxima',
      'Portal do Cliente e agendamento online ilimitado',
      'Disparo automático de WhatsApp Bot',
      'Relatórios financeiros completos, DRE e comissões',
      'Suporte técnico prioritário e atualizações contínuas'
    ],
    activeTenantsCount: 0
  }
];

export const INITIAL_SUPER_ADMINS: SuperAdminUser[] = [
  {
    id: 'sa-1',
    name: 'Admin Geral Root',
    email: 'admin@saas.com',
    role: 'ROOT',
    status: 'Ativo',
    lastLogin: 'Agora mesmo',
    avatarInitials: 'AD'
  },
  {
    id: 'sa-2',
    name: 'Juliana Rossi',
    email: 'juliana.support@saas.com',
    role: 'SUPORTE',
    status: 'Ativo',
    lastLogin: 'Há 2 horas',
    avatarInitials: 'JR'
  },
  {
    id: 'sa-3',
    name: 'Marcio Fonseca',
    email: 'marcio.finance@saas.com',
    role: 'ADMIN',
    status: 'Ativo',
    lastLogin: 'Ontem às 18:30',
    avatarInitials: 'MF'
  },
  {
    id: 'sa-4',
    name: 'Luciana Sec',
    email: 'luciana.audit@saas.com',
    role: 'AUDITOR',
    status: 'Ativo',
    lastLogin: 'Há 3 dias',
    avatarInitials: 'LS'
  }
];

export const INITIAL_LOGS: SystemLog[] = [
  {
    id: 'log-1001',
    timestamp: '31/07/2026 11:18:22',
    level: 'INFO',
    tenantName: 'Acme Corp',
    event: 'Autenticação via SSO realizada com sucesso',
    ipAddress: '177.12.89.201',
    user: 'carla.m@acme.com'
  },
  {
    id: 'log-1002',
    timestamp: '31/07/2026 11:15:04',
    level: 'WARN',
    tenantName: 'Global Logistics',
    event: 'Tentativa de faturamento automático falhou (Cartão Recusado)',
    ipAddress: '54.233.12.9',
    user: 'Sistema Gateway'
  },
  {
    id: 'log-1003',
    timestamp: '31/07/2026 10:55:10',
    level: 'SECURITY',
    tenantName: 'Cyberdyne Systems',
    event: 'Novo IP de administração adicionado ao Whitelist',
    ipAddress: '200.180.44.11',
    user: 'miles@cyberdyne.com'
  },
  {
    id: 'log-1004',
    timestamp: '31/07/2026 09:40:18',
    level: 'ERROR',
    tenantName: 'Initech Software',
    event: 'Limite de requisições por minuto excedido (Rate Limit 429)',
    ipAddress: '189.40.112.50',
    user: 'api_key_sandbox'
  },
  {
    id: 'log-1005',
    timestamp: '31/07/2026 08:30:00',
    level: 'INFO',
    tenantName: 'Stark Tech',
    event: 'Backup diário do banco de dados concluído com sucesso',
    ipAddress: '10.0.0.12',
    user: 'CronJob Backup'
  }
];

export const INITIAL_INVOICES: Invoice[] = [
  {
    id: 'INV-2026-089',
    tenantId: 't-101',
    tenantName: 'Acme Corp',
    amount: 1299,
    date: '01/07/2026',
    dueDate: '05/07/2026',
    status: 'Pago',
    planName: 'Enterprise'
  },
  {
    id: 'INV-2026-090',
    tenantId: 't-102',
    tenantName: 'Stark Tech',
    amount: 499,
    date: '03/07/2026',
    dueDate: '08/07/2026',
    status: 'Pago',
    planName: 'Pro'
  },
  {
    id: 'INV-2026-091',
    tenantId: 't-103',
    tenantName: 'Global Logistics',
    amount: 199,
    date: '18/07/2026',
    dueDate: '23/07/2026',
    status: 'Vencido',
    planName: 'Basic'
  },
  {
    id: 'INV-2026-092',
    tenantId: 't-104',
    tenantName: 'Cyberdyne Systems',
    amount: 2500,
    date: '02/07/2026',
    dueDate: '07/07/2026',
    status: 'Pago',
    planName: 'Enterprise'
  },
  {
    id: 'INV-2026-093',
    tenantId: 't-106',
    tenantName: 'Umbrella Health',
    amount: 1299,
    date: '10/07/2026',
    dueDate: '15/07/2026',
    status: 'Pago',
    planName: 'Enterprise'
  }
];

export const INITIAL_SECURITY_SETTINGS: SecuritySetting[] = [
  {
    id: 'sec-2fa',
    title: 'Autenticação em Dois Fatores (2FA) Obrigatória',
    description: 'Exigir 2FA para todos os administradores gerais e gestores de tenants.',
    enabled: true,
    category: 'auth'
  },
  {
    id: 'sec-ip',
    title: 'Restrição de Acesso por Faixa de IP',
    description: 'Bloquear login no painel ROOT fora das faixas de IP corporativo configuradas.',
    enabled: false,
    category: 'network'
  },
  {
    id: 'sec-timeout',
    title: 'Encerrar Sessão por Inatividade (15 min)',
    description: 'Desconectar automaticamente usuários inativos após 15 minutos.',
    enabled: true,
    category: 'auth'
  },
  {
    id: 'sec-rate-limit',
    title: 'Proteção Antiforça Bruta & Rate Limiting',
    description: 'Limitar tentativas de login e requisições à API pública do SaaS.',
    enabled: true,
    category: 'api'
  },
  {
    id: 'sec-audit-export',
    title: 'Exportação Automática de Logs de Auditoria',
    description: 'Enviar registros de auditoria em tempo real para o SIEM / S3 secundário.',
    enabled: true,
    category: 'audit'
  }
];
