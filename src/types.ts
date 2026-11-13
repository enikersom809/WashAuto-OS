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
  levaETrazConfig?: {
    enabled: boolean;
    feeCompleto: number;
    feeBuscar: number;
    feeEntregar: number;
    freeAboveOrderValue?: number;
    estimatedPickupMinutes?: number;
    coverageArea?: string;
    workingHours?: string;
  };
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

export interface PromoBanner {
  id: string;
  tenantId: string;
  tag: string; // Ex: '🔥 Oferta da Semana', '⭐ Lançamento Premium', '⚡ Promoção Relâmpago'
  title: string;
  subtitle: string;
  image: string;
  serviceName?: string;
  discountPrice?: number;
  originalPrice?: number;
  badge?: string; // Ex: '20% OFF', 'R$ 80', 'Grátis'
  active: boolean;
  order?: number;
  createdAt?: string;
  updatedAt?: string;
}

// ================= GESTÃO DE AGENDAMENTOS & NOTIFICAÇÕES 24H =================
export interface CustomerAppointment {
  id: string;
  dateTime: string;
  date?: string; // YYYY-MM-DD
  time?: string; // HH:mm
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;
  vehicle: string;
  plate: string;
  service: string;
  price: number;
  lavadorId?: string;
  lavadorName?: string;
  status: 'Pendente' | 'Aprovado' | 'Cancelado' | 'Concluído' | 'Em Lavagem';
  addressSummary?: string;
  notes?: string;
  createdAt?: string;
  // Notificações e Lembretes 24h
  reminder24hEnabled?: boolean;
  reminder24hScheduledAt?: string; // Data ISO ou formatada do lembrete (24h antes)
  reminder24hSent?: boolean;
  reminder24hSentAt?: string;
  reminderChannel?: 'whatsapp' | 'email' | 'ambos';
  reminderNotes?: string;
  // Sistema de Leva e Traz
  hasLevaETraz?: boolean;
  levaETrazType?: LevaETrazType;
  levaETrazFee?: number;
  levaETrazAddress?: LevaETrazAddress;
  levaETrazStatus?: LevaETrazStatus;
  levaETrazDriverName?: string;
}

// ================= SISTEMA DE LEVA E TRAZ (VALET & DELIVERY) =================
export type LevaETrazType = 'completo' | 'buscar' | 'entregar';

export type LevaETrazStatus = 
  | 'solicitado'           // 1. Solicitação recebida no app
  | 'motorista_a_caminho'  // 2. Motorista a caminho para coletar o carro
  | 'coletado'             // 3. Veículo recolhido / A caminho do Lava-Jato
  | 'no_patio'             // 4. No Pátio / Em Lavagem
  | 'concluido'            // 5. Lavagem Concluída / Pronto para retorno
  | 'em_entrega'           // 6. Motorista a caminho da entrega
  | 'entregue'             // 7. Entregue com sucesso na casa/empresa do cliente
  | 'cancelado';

export interface LevaETrazAddress {
  cep?: string;
  street: string;
  number: string;
  neighborhood: string;
  complement?: string;
  city: string;
  state?: string;
  reference?: string;
}

export interface LevaETrazRequest {
  id: string;
  tenantId: string;
  type: LevaETrazType;
  status: LevaETrazStatus;
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  vehicle: string;
  plate: string;
  service: string;
  servicePrice: number;
  feePrice: number; // Taxa de leva e traz
  totalPrice: number;
  address: LevaETrazAddress;
  appointmentId?: string;
  washItemId?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  driverId?: string;
  driverName?: string;
  driverPhone?: string;
  notes?: string;
  statusHistory?: {
    status: LevaETrazStatus;
    timestamp: string;
    note?: string;
  }[];
  createdAt: string;
  updatedAt?: string;
}

