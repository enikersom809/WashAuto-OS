export type PlanType = 'Basic' | 'Pro' | 'Enterprise' | 'Vitalicio' | 'Custom';
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
  slug?: string;
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
  isLifetime?: boolean;
  purchaseAmount?: number;
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
  isLifetime?: boolean;
  billingCycle?: 'monthly' | 'yearly' | 'lifetime';
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

// ================= TROCA DE ÓLEO & LUBRIFICAÇÃO =================
export type OilProductCategory = 
  | 'oleo_motor' 
  | 'filtro_oleo' 
  | 'filtro_ar' 
  | 'filtro_combustivel' 
  | 'filtro_cabine' 
  | 'correia_dentada' 
  | 'fluido_freio' 
  | 'aditivo_radiador' 
  | 'outros';

export interface OilProductItem {
  id: string;
  tenantId: string;
  name: string;
  category: OilProductCategory;
  brand?: string;
  viscosity?: string; // Ex: 5W30, 10W40, 15W40, 0W20
  code?: string; // Código de referência
  stock: number;
  minStock: number;
  unit: 'litros' | 'unidades';
  purchasePrice: number; // Preço de custo
  markupPercent: number; // Padrão 30% (+30% automático)
  salePrice: number; // Preço de venda sugerido / calculado: purchasePrice * (1 + markupPercent/100)
  updatedAt: string;
}

export interface OilChangeItemUsed {
  productId: string;
  name: string;
  category?: OilProductCategory;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface OilChangeRecord {
  id: string;
  tenantId: string;
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;
  vehiclePlate: string;
  vehicleModel: string;
  vehicleYear?: string;
  currentKm: number; // Quilometragem atual digitada
  intervalKm: 8000 | 10000 | number; // 8.000 km ou 10.000 km
  nextChangeKm: number; // Calculado automaticamente: currentKm + intervalKm
  changeDate: string; // Data da troca: YYYY-MM-DD ou DD/MM/AAAA
  nextChangeDate: string; // Previsão por data (ex: 6 meses a partir da troca)
  oilType?: string; // Ex: 5W30 Sintético
  litersUsed?: number;
  itemsUsed: OilChangeItemUsed[];
  laborPrice: number; // Valor da mão de obra
  totalPrice: number; // Total = soma de produtos + mão de obra
  paymentMethod?: 'PIX' | 'Cartão de Débito' | 'Cartão de Crédito' | 'Dinheiro' | 'Cortesia';
  status: 'Aguardando' | 'Em Andamento' | 'Concluído';
  responsibleTechnician?: string;
  notes?: string;
  createdAt: string;
}

// ================= CONTROLE DE CAIXA & FLUXO DE CAIXA =================
export type CashTransactionType = 'entrada' | 'saida';

export type CashTransactionCategory = 
  | 'venda_lavagem'
  | 'venda_oleo'
  | 'venda_balcao'
  | 'suprimento_troco'
  | 'outra_entrada'
  | 'comissao_equipe'
  | 'sangria_retirada'
  | 'compra_insumos'
  | 'despesa_operacional'
  | 'alimentacao'
  | 'manutencao'
  | 'outra_saida';

export type CashPaymentMethod = 
  | 'PIX'
  | 'Dinheiro'
  | 'Cartão de Débito'
  | 'Cartão de Crédito'
  | 'Boleto'
  | 'Transferência'
  | 'Outro';

export interface CashTransaction {
  id: string;
  tenantId: string;
  type: CashTransactionType;
  category: CashTransactionCategory;
  categoryLabel?: string;
  description: string;
  amount: number;
  paymentMethod: CashPaymentMethod;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  operator?: string;
  referenceId?: string;
  recipientOrClient?: string;
  notes?: string;
  createdAt: string;
}

export interface CashRegisterSession {
  id: string;
  tenantId: string;
  date: string; // YYYY-MM-DD
  status: 'aberto' | 'fechado';
  openedAt: string;
  openedBy?: string;
  initialBalance: number; // Fundo de troco inicial
  closedAt?: string;
  closedBy?: string;
  finalPhysicalCash?: number; // Dinheiro físico apurado na gaveta
  differenceCash?: number; // Diferença (falta ou sobra)
  notes?: string;
}

// ================= VENDAS & LOJA DE BALCÃO (PDV) =================
export type SaleProductCategory = 
  | 'aromatizantes'
  | 'estetica_automotiva'
  | 'conveniencia_bebidas'
  | 'acessorios'
  | 'palhetas_limpador'
  | 'outros_produtos';

export interface SaleProductItem {
  id: string;
  tenantId: string;
  name: string;
  category: SaleProductCategory;
  categoryLabel?: string;
  barcode?: string;
  costPrice: number; // Preço de custo
  salePrice: number; // Preço de venda
  stock: number; // Estoque atual
  minStock: number; // Estoque mínimo de alerta
  unit: string; // Ex: 'unidades', 'frascos', 'latas'
  notes?: string;
  updatedAt: string;
}

export interface SaleCartItem {
  productId: string;
  name: string;
  unitPrice: number;
  costPrice?: number;
  quantity: number;
  totalPrice: number;
}

export interface CounterSaleRecord {
  id: string;
  tenantId: string;
  saleNumber?: number;
  items: SaleCartItem[];
  subtotal: number;
  discount: number;
  totalCost?: number;
  grossProfit?: number;
  profitMarginPercent?: number;
  totalAmount: number;
  paymentMethod: CashPaymentMethod;
  clientName?: string;
  clientPhone?: string;
  cashGiven?: number;
  changeGiven?: number;
  operator: string;
  integrateWithOperationalCash?: boolean;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  notes?: string;
  createdAt: string;
}
