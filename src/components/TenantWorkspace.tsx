import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  Kanban, 
  CalendarCheck, 
  Calendar,
  History,
  Package, 
  Percent, 
  Users, 
  Plus, 
  CheckCircle, 
  CheckCircle2,
  Clock, 
  AlertTriangle, 
  User, 
  DollarSign, 
  Car, 
  Search, 
  Download, 
  Settings, 
  Send, 
  Check, 
  Trash2, 
  PlusCircle, 
  Sparkles,
  ShoppingBag,
  Droplet,
  ArrowRight,
  ShieldCheck,
  Building2,
  X,
  CreditCard,
  LogOut,
  Gift,
  Sliders,
  Printer,
  Filter,
  Phone,
  PhoneCall,
  MessageSquare,
  Mail,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Menu,
  QrCode,
  Loader2,
  Fuel,
  Smartphone,
  Bell,
  BellRing,
  Volume2,
  Radio,
  Wallet,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Tablet,
  Copy,
  Truck,
  MapPin,
  Navigation,
  Lock
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Tenant, LevaETrazRequest, LevaETrazStatus, LevaETrazType, LevaETrazAddress, CashTransaction } from '../types';
import { TenantConfigSettings } from './TenantConfigSettings';
import { PWAInstallButton } from './PWAInstallButton';
import { ClientesWorkspace } from './ClientesWorkspace';
import { TrocaOleoWorkspace } from './TrocaOleoWorkspace';
import { FluxoCaixaWorkspace } from './FluxoCaixaWorkspace';
import { VendasBalcaoWorkspace } from './VendasBalcaoWorkspace';
import { PromoBannersWorkspace } from './PromoBannersWorkspace';
import {
  isPushNotificationSupported,
  getPushNotificationPermission,
  requestPushPermissionAndSubscribe,
  disablePushNotifications,
  sendTestPushNotification,
  sendClientVehicleStatusPushNotification
} from '../lib/pushNotificationService';

import { 
  saveTenantToFirestore,
  saveAppointmentToFirestore,
  updateAppointmentStatusInFirestore,
  updateAppointmentReminderInFirestore,
  deleteAppointmentFromFirestore,
  subscribeToTenantAppointments,
  syncAllLocalAppointmentsToFirestore,
  saveWashItemToFirestore,
  updateWashItemStatusInFirestore,
  deleteWashItemFromFirestore,
  subscribeToTenantWashItems,
  syncAllLocalWashesToFirestore,
  saveWashHistoryToFirestore,
  deleteWashHistoryFromFirestore,
  subscribeToTenantWashHistory,
  saveFidelityRedemptionToFirestore,
  updateFidelityRedemptionInFirestore,
  subscribeToTenantRedemptions,
  saveFidelityPointsToFirestore,
  subscribeToTenantClients,
  sendBroadcastNotificationFirestore,
  subscribeToTenantBroadcastNotification,
  dismissBroadcastNotificationFirestore,
  BroadcastNotification,
  saveLevaETrazRequest,
  updateLevaETrazStatusInFirestore,
  deleteLevaETrazRequestFromFirestore,
  subscribeToTenantLevaETraz,
  saveCashTransactionToFirestore
} from '../lib/firebaseService';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  parseAppointmentDateTime,
  calculateReminder24hTarget,
  formatDateTimeDisplay,
  getAppointmentReminderAnalysis,
  buildReminderWhatsAppText,
  buildReminderWhatsAppUrl,
  buildReminderEmailContent,
  buildGoogleCalendarUrl,
  generateIcsFileContent,
  ReminderAnalysis
} from '../utils/reminderService';


interface WashItem {
  id: string;
  plate: string;
  vehicle: string;
  service: string;
  price: number;
  clientName: string;
  clientPhone?: string;
  status: 'Aguardando' | 'Em Execução' | 'Concluído';
  lavadorId?: string;
  lavadorName?: string;
  commissionRate: number; // percentage, e.g. 10 = 10%
  commissionAmount: number; // R$
  createdAt: string;
  completedAt?: string;
  completedDate?: string;
}

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
  // Lembretes & Notificações 24h
  reminder24hEnabled?: boolean;
  reminder24hScheduledAt?: string;
  reminder24hSent?: boolean;
  reminder24hSentAt?: string;
  reminderChannel?: 'whatsapp' | 'email' | 'ambos';
  reminderNotes?: string;
  // Leva e Traz
  hasLevaETraz?: boolean;
  levaETrazType?: LevaETrazType;
  levaETrazFee?: number;
  levaETrazAddress?: LevaETrazAddress;
  levaETrazStatus?: LevaETrazStatus;
  levaETrazDriverName?: string;
}

export interface CompletedWashRecord {
  id: string;
  plate: string;
  vehicle: string;
  service: string;
  price: number;
  clientName: string;
  clientPhone?: string;
  lavadorId?: string;
  lavadorName?: string;
  commissionRate: number; // %
  commissionAmount: number; // R$
  completedAt: string; // Ex: 'Hoje às 14:30' ou '22/09/2026 14:30'
  date: string; // YYYY-MM-DD
  paymentMethod: 'PIX' | 'Cartão de Débito' | 'Cartão de Crédito' | 'Dinheiro' | 'Cortesia';
  durationMinutes?: number;
  notes?: string;
}

interface ProductItem {
  id: string;
  name: string;
  category: 'insumo' | 'venda';
  stock: number;
  minStock: number;
  unitPrice?: number; // for sale items
  unit: string;
}

interface StaffMember {
  id: string;
  name: string;
  initials: string;
  role: string;
  defaultCommission: number; // %
  completedWashes: number;
  accumulatedCommission: number; // R$
}

/**
 * Deduplica washItems garantindo que não haja registros duplicados por ID ou por placa+status
 */
function deduplicateWashItems(items: WashItem[]): WashItem[] {
  if (!Array.isArray(items)) return [];
  const seenIds = new Set<string>();
  const seenPlateStatus = new Set<string>();
  const result: WashItem[] = [];

  for (const item of items) {
    if (!item || !item.id) continue;
    const cleanPlate = (item.plate || '').toUpperCase().trim();
    const plateKey = cleanPlate ? `${cleanPlate}_${item.status}` : null;

    if (seenIds.has(item.id)) continue;
    if (plateKey && seenPlateStatus.has(plateKey)) continue;

    seenIds.add(item.id);
    if (plateKey) seenPlateStatus.add(plateKey);
    result.push(item);
  }
  return result;
}

/**
 * Deduplica histórico de lavagens evitando registros duplicados
 */
function deduplicateWashHistory(history: CompletedWashRecord[]): CompletedWashRecord[] {
  if (!Array.isArray(history)) return [];
  const seenIds = new Set<string>();
  const seenSignatures = new Set<string>();
  const result: CompletedWashRecord[] = [];

  for (const item of history) {
    if (!item || !item.id) continue;
    const cleanPlate = (item.plate || '').toUpperCase().trim();
    const signature = `${cleanPlate}_${item.date || ''}_${item.service || ''}_${item.price || 0}`;

    if (seenIds.has(item.id)) continue;
    if (cleanPlate && seenSignatures.has(signature)) continue;

    seenIds.add(item.id);
    if (cleanPlate) seenSignatures.add(signature);
    result.push(item);
  }
  return result;
}

/**
 * Deduplica agendamentos por ID ou combinação de placa e data
 */
function deduplicateAppointments(apps: CustomerAppointment[]): CustomerAppointment[] {
  if (!Array.isArray(apps)) return [];
  const seenIds = new Set<string>();
  const seenSignatures = new Set<string>();
  const result: CustomerAppointment[] = [];

  for (const app of apps) {
    if (!app || !app.id) continue;
    const cleanPlate = (app.plate || '').toUpperCase().trim();
    const cleanDate = (app.dateTime || '').trim();
    const signature = `${cleanPlate}_${cleanDate}`;

    if (seenIds.has(app.id)) continue;
    if (cleanPlate && cleanDate && seenSignatures.has(signature)) continue;

    seenIds.add(app.id);
    if (cleanPlate && cleanDate) seenSignatures.add(signature);
    result.push(app);
  }
  return result;
}

/**
 * Formata a data/horário real de conclusão do recibo, garantindo que registros
 * realizados no passado exibam a data real (ex: '02/11/2026 às 14:30') e não fiquem
 * travados com 'Hoje' ou com a data atual.
 */
function formatReceiptCompletedAt(completedAt?: string, dateStr?: string): string {
  const now = new Date();
  const todayIso = now.toISOString().split('T')[0];
  const yesterdayIso = new Date(now.getTime() - 86400000).toISOString().split('T')[0];

  // Extrai o horário (HH:mm)
  let timePart = '';
  if (completedAt) {
    const timeMatch = completedAt.match(/(\d{2}:\d{2})/);
    if (timeMatch) timePart = timeMatch[1];
  }

  // Se temos a data no formato ISO YYYY-MM-DD
  if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split('-');
    const formattedDateBR = `${d}/${m}/${y}`;

    if (dateStr === todayIso) {
      return timePart ? `Hoje às ${timePart}` : `Hoje (${formattedDateBR})`;
    }
    if (dateStr === yesterdayIso) {
      return timePart ? `Ontem às ${timePart}` : `Ontem (${formattedDateBR})`;
    }
    return timePart ? `${formattedDateBR} às ${timePart}` : formattedDateBR;
  }

  // Se já contém data completa no formato DD/MM/AAAA
  if (completedAt && /\d{2}\/\d{2}\/\d{4}/.test(completedAt)) {
    return completedAt;
  }

  // Se tem dateStr mas não é hoje
  if (dateStr && dateStr !== todayIso) {
    const dObj = new Date(dateStr);
    if (!isNaN(dObj.getTime())) {
      const formattedDateBR = dObj.toLocaleDateString('pt-BR');
      return timePart ? `${formattedDateBR} às ${timePart}` : formattedDateBR;
    }
  }

  return completedAt || `${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

interface TenantWorkspaceProps {
  tenant: Tenant;
  onExitImpersonation?: () => void;
  onUpdateTenant?: (updatedTenant: Tenant) => void;
  onReplaySplash?: () => void;
  onOpenTotemMode?: () => void;
}

export const TenantWorkspace: React.FC<TenantWorkspaceProps> = ({
  tenant: initialTenant,
  onExitImpersonation,
  onUpdateTenant,
  onReplaySplash,
  onOpenTotemMode
}) => {
  // Carrega informações da empresa diretamente dos dados da nuvem (eliminando isolamento por localStorage)
  const [currentTenant, setCurrentTenant] = useState<Tenant>(initialTenant);

  // Sincronização em tempo real das informações da empresa direto do Firestore
  useEffect(() => {
    if (!initialTenant?.id) return;
    const unsub = onSnapshot(doc(db, 'tenants', initialTenant.id), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setCurrentTenant(prev => ({ ...prev, ...data, id: docSnap.id }));
      }
    }, (err) => {
      console.warn('Aviso: Sincronização de empresa:', err);
    });
    return () => unsub();
  }, [initialTenant?.id]);


  const levaConfig = useMemo(() => ({
    enabled: currentTenant.levaETrazConfig?.enabled !== false,
    feeCompleto: Number(currentTenant.levaETrazConfig?.feeCompleto ?? 25),
    feeBuscar: Number(currentTenant.levaETrazConfig?.feeBuscar ?? 15),
    feeEntregar: Number(currentTenant.levaETrazConfig?.feeEntregar ?? 15),
    freeAboveOrderValue: Number(currentTenant.levaETrazConfig?.freeAboveOrderValue ?? 0),
    estimatedPickupMinutes: Number(currentTenant.levaETrazConfig?.estimatedPickupMinutes ?? 30),
    coverageArea: currentTenant.levaETrazConfig?.coverageArea || '',
    workingHours: currentTenant.levaETrazConfig?.workingHours || ''
  }), [currentTenant.levaETrazConfig]);

  const [activeTab, setActiveTab] = useState<'fila' | 'agendamentos' | 'lembretes-24h' | 'leva-e-traz' | 'caixa' | 'vendas' | 'clientes' | 'troca-oleo' | 'historico-lavagem' | 'produtos' | 'comissoes' | 'configuracoes-empresa' | 'saas-config' | 'comprar-vitalicio' | 'totem' | 'banners-app'>('fila');
  const [configInitialSubTab, setConfigInitialSubTab] = useState<'empresa' | 'qrcode' | 'funcionarios' | 'produtos' | 'comissoes' | 'senha' | 'logo' | 'leva-e-traz'>('empresa');

  // Notificação Toast Visual para Novo Cadastro no Totem
  const [totemToast, setTotemToast] = useState<{
    id: string;
    clientName: string;
    phone?: string;
    vehicle?: string;
    plate?: string;
    time: string;
  } | null>(null);

  // Som de notificação/chime suave com Web Audio API
  const playTotemChime = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12); // A5

      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.46);
    } catch (_) {}
  }, []);

  const triggerTotemNotification = useCallback((detail: { name?: string; phone?: string; vehicle?: string; plate?: string }) => {
    playTotemChime();
    setTotemToast({
      id: `totem-toast-${Date.now()}`,
      clientName: detail.name || 'Novo Cliente',
      phone: detail.phone,
      vehicle: detail.vehicle,
      plate: detail.plate,
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    });
  }, [playTotemChime]);

  // Estado do Totem de Autoatendimento
  const [copiedTotemUrl, setCopiedTotemUrl] = useState(false);
  const [totemClientsList, setTotemClientsList] = useState<any[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(`saas_totem_clients_${initialTenant.id}`);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // Atualiza lista de clientes do totem em tempo de execução
  useEffect(() => {
    const handleStorage = () => {
      try {
        const raw = localStorage.getItem(`saas_totem_clients_${initialTenant.id}`);
        if (raw) setTotemClientsList(JSON.parse(raw));
      } catch {}
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [initialTenant.id]);

  // Selo de Sincronização Celular ⇄ Computador: Oculto por padrão per solicitação ("pode ocultar celular e computador sincronizados")
  const [showSyncBadge, setShowSyncBadge] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(`saas_show_sync_badge_${initialTenant?.id}`) === 'true';
  });

  // 🔔 Gerenciador de Notificações Push no Navegador (Web Push / FCM em Segundo Plano)
  const [pushPermission, setPushPermission] = useState<NotificationPermission>(() => getPushNotificationPermission());
  const [isPushSubscribed, setIsPushSubscribed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(`saas_push_enabled_${initialTenant?.id}`) === 'true' && Notification.permission === 'granted';
  });
  const [isRequestingPush, setIsRequestingPush] = useState(false);
  const [isTestingPush, setIsTestingPush] = useState(false);

  // Sincroniza inscrição de push se a permissão já estiver concedida
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPushPermission(Notification.permission);
      if (Notification.permission === 'granted' && initialTenant?.id) {
        requestPushPermissionAndSubscribe(initialTenant.id, initialTenant.nomeFantasia || initialTenant.name).then(res => {
          if (res.success) {
            setIsPushSubscribed(true);
          }
        }).catch(() => {});
      }
    }
  }, [initialTenant?.id, initialTenant?.nomeFantasia, initialTenant?.name]);

  // Escuta cliques de notificações push via Service Worker para focar na aba de clientes
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    const handleSWMessage = (event: MessageEvent) => {
      if (event.data && (event.data.type === 'NAVIGATE_TO_TAB' || event.data.type === 'NAVIGATE_TAB')) {
        if (event.data.tab === 'clientes') {
          setActiveTab('clientes');
          showToast('🔔 Redirecionado para Gestão de Clientes & Balcão via Notificação Push!');
        }
      }
    };
    navigator.serviceWorker.addEventListener('message', handleSWMessage);
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleSWMessage);
    };
  }, []);

  // Suporte a abertura direta do navegador após clique na notificação push (ex: /?aba=clientes)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('aba');
    if (tabParam === 'clientes') {
      setActiveTab('clientes');
    } else if (tabParam === 'totem') {
      setActiveTab('totem');
    }
  }, []);

  const handleTogglePushNotifications = async () => {
    if (isPushSubscribed) {
      const disabled = await disablePushNotifications(initialTenant.id);
      if (disabled) {
        setIsPushSubscribed(false);
        showToast('Alertas Push no navegador pausados com sucesso.');
      }
    } else {
      setIsRequestingPush(true);
      try {
        const res = await requestPushPermissionAndSubscribe(initialTenant.id, initialTenant.nomeFantasia || initialTenant.name);
        setPushPermission(res.permission);
        if (res.success) {
          setIsPushSubscribed(true);
          showToast('✅ Alertas Push ativados! Você receberá notificações sonoras mesmo com a aba fechada.');
        } else {
          showToast(res.errorMessage || 'Não foi possível ativar as notificações push.');
        }
      } catch {
        showToast('Erro ao configurar permissões no navegador.');
      } finally {
        setIsRequestingPush(false);
      }
    }
  };

  const handleTestPushNotification = async () => {
    setIsTestingPush(true);
    try {
      const res = await sendTestPushNotification(initialTenant.id, initialTenant.nomeFantasia || initialTenant.name);
      showToast(res.message);
    } catch {
      showToast('Falha ao enviar notificação push de teste.');
    } finally {
      setIsTestingPush(false);
    }
  };

  // Notificação transmitida em tempo real via SaaS Root
  const [activeBroadcast, setActiveBroadcast] = useState<BroadcastNotification | null>(null);

  // Escuta Notificações Transmitidas pelo SaaS Root em Tempo Real (ex: para Box 1000)
  useEffect(() => {
    if (!initialTenant?.id) return;
    const unsub = subscribeToTenantBroadcastNotification(initialTenant.id, (notif) => {
      setActiveBroadcast(notif);
    });
    return () => unsub();
  }, [initialTenant?.id]);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Controle de Menu Lateral Recolhível (Desktop Collapsible Sidebar) com persistência local
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('tenant_sidebar_collapsed') === 'true';
  });

  const toggleSidebar = () => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('tenant_sidebar_collapsed', String(next));
      return next;
    });
  };

  const tenant = currentTenant;

  // URL e slug limpo para o link do Totem de Autoatendimento
  const totemCleanSlug = useMemo(() => {
    const raw = (tenant.slug && !tenant.slug.toLowerCase().startsWith('t-'))
      ? tenant.slug
      : (tenant.nomeFantasia || tenant.name || 'lavajato');
    
    return raw
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '')
      .trim() || 'empresa';
  }, [tenant.slug, tenant.nomeFantasia, tenant.name]);

  // 🌐 Domínio oficial de produção na Netlify (nunca aponta para ais-dev)
  const OFFICIAL_NETLIFY_URL = 'https://washautoos.netlify.app';
  const totemTargetUrl = `${OFFICIAL_NETLIFY_URL}/?empresa=${encodeURIComponent(totemCleanSlug)}&totem=true`;

  const handleCopyTotemUrl = async () => {
    try {
      await navigator.clipboard.writeText(totemTargetUrl);
      setCopiedTotemUrl(true);
      setTimeout(() => setCopiedTotemUrl(false), 2500);
      showToast('Link do Totem copiado com sucesso!');
    } catch {
      showToast('Erro ao copiar link do Totem.');
    }
  };

  const defaultStaff: StaffMember[] = [
    { id: 'st-1', name: 'Carlos Silva', initials: 'CS', role: 'Lavador Master', defaultCommission: 15, completedWashes: 0, accumulatedCommission: 0 },
    { id: 'st-2', name: 'Lucas Santos', initials: 'LS', role: 'Especialista em Cera & Polimento', defaultCommission: 20, completedWashes: 0, accumulatedCommission: 0 },
    { id: 'st-3', name: 'Marcos Rocha', initials: 'MR', role: 'Lavagem Rápida & Aspiração', defaultCommission: 10, completedWashes: 0, accumulatedCommission: 0 }
  ];

  const defaultProducts: ProductItem[] = [
    { id: 'p-1', name: 'Shampoo Neutro Automotivo 5L (Insumo)', category: 'insumo', stock: 8, minStock: 3, unit: 'galões' },
    { id: 'p-2', name: 'Cera Carnaúba Paste Wax (Insumo)', category: 'insumo', stock: 12, minStock: 4, unit: 'latas' },
    { id: 'p-3', name: 'Pretinho Silicone Pneus 500ml', category: 'venda', stock: 15, minStock: 5, unitPrice: 25, unit: 'frascos' },
    { id: 'p-4', name: 'Aromatizante Veicular Premium', category: 'venda', stock: 30, minStock: 10, unitPrice: 15, unit: 'unidades' }
  ];

  const defaultWashHistory: CompletedWashRecord[] = [
    {
      id: 'wh-1',
      plate: 'BRA2E19',
      vehicle: 'Toyota Corolla 2023',
      service: 'Lavagem Completa + Cera Pro',
      price: 110,
      clientName: 'Fernando Alencar',
      clientPhone: '(11) 98765-4321',
      lavadorId: 'st-1',
      lavadorName: 'Carlos Silva',
      commissionRate: 15,
      commissionAmount: 16.5,
      completedAt: 'Hoje às 11:20',
      date: new Date().toISOString().split('T')[0],
      paymentMethod: 'PIX',
      durationMinutes: 45,
      notes: 'Cliente elogiou acabamento nas rodas.'
    },
    {
      id: 'wh-2',
      plate: 'RLM4C90',
      vehicle: 'Jeep Compass Limited',
      service: 'Lavagem Técnica com Cera Paste Wax',
      price: 150,
      clientName: 'Mariana Duarte',
      clientPhone: '(11) 97654-3210',
      lavadorId: 'st-2',
      lavadorName: 'Lucas Santos',
      commissionRate: 20,
      commissionAmount: 30.0,
      completedAt: 'Hoje às 09:45',
      date: new Date().toISOString().split('T')[0],
      paymentMethod: 'Cartão de Crédito',
      durationMinutes: 60,
      notes: 'Pretinho de alta durabilidade aplicado.'
    },
    {
      id: 'wh-3',
      plate: 'KZX9A12',
      vehicle: 'Honda Civic Touring',
      service: 'Lavagem Simples & Aspiração',
      price: 60,
      clientName: 'Rodrigo Vianna',
      clientPhone: '(11) 96543-2109',
      lavadorId: 'st-3',
      lavadorName: 'Marcos Rocha',
      commissionRate: 10,
      commissionAmount: 6.0,
      completedAt: 'Ontem às 16:30',
      date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
      paymentMethod: 'Dinheiro',
      durationMinutes: 35
    },
    {
      id: 'wh-4',
      plate: 'FGT8821',
      vehicle: 'BMW 320i M Sport',
      service: 'Polimento Técnico & Cera Carnaúba',
      price: 280,
      clientName: 'Eduardo Guimarães',
      clientPhone: '(11) 95432-1098',
      lavadorId: 'st-2',
      lavadorName: 'Lucas Santos',
      commissionRate: 20,
      commissionAmount: 56.0,
      completedAt: 'Ontem às 14:15',
      date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
      paymentMethod: 'PIX',
      durationMinutes: 90,
      notes: 'Descontaminação de pintura realizada.'
    }
  ];

  const defaultAppointments: CustomerAppointment[] = [];

  // Persistent States per Lava-Jato Company (Tenant)
  const isDemoTenant = tenant.id === 't-autoclean';

  const [washItems, setWashItems] = useState<WashItem[]>(() => {
    const saved = localStorage.getItem(`saas_tenant_washes_${tenant.id}`);
    if (saved) {
      try { 
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return deduplicateWashItems(parsed.filter(w => !w.id.startsWith('w-from-app-init-') && !w.id.startsWith('wh-')));
        }
      } catch (e) { console.error(e); }
    }
    return [];
  });

  const [staffList, setStaffList] = useState<StaffMember[]>(() => {
    const saved = localStorage.getItem(`saas_tenant_staff_${tenant.id}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) { console.error(e); }
    }
    return defaultStaff;
  });

  const [appointments, setAppointments] = useState<CustomerAppointment[]>(() => {
    const saved = localStorage.getItem(`saas_tenant_appointments_${tenant.id}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Remove qualquer resquício de agendamentos fictícios antigos e deduplica
          return deduplicateAppointments(parsed.filter(a => !a.id.startsWith('app-init-')));
        }
      } catch (e) { console.error(e); }
    }
    return [];
  });

  const [washHistory, setWashHistory] = useState<CompletedWashRecord[]>(() => {
    const saved = localStorage.getItem(`saas_tenant_wash_history_${tenant.id}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return deduplicateWashHistory(parsed);
        }
      } catch (e) { console.error(e); }
    }
    return isDemoTenant ? defaultWashHistory : [];
  });

  const [products, setProducts] = useState<ProductItem[]>(() => {
    const saved = localStorage.getItem(`saas_tenant_products_${tenant.id}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) { console.error(e); }
    }
    return defaultProducts;
  });

  // Save changes to localStorage
  useEffect(() => {
    localStorage.setItem(`saas_tenant_washes_${tenant.id}`, JSON.stringify(washItems));
  }, [washItems, tenant.id]);

  useEffect(() => {
    localStorage.setItem(`saas_tenant_staff_${tenant.id}`, JSON.stringify(staffList));
  }, [staffList, tenant.id]);

  useEffect(() => {
    localStorage.setItem(`saas_tenant_appointments_${tenant.id}`, JSON.stringify(appointments));
  }, [appointments, tenant.id]);

  useEffect(() => {
    localStorage.setItem(`saas_tenant_wash_history_${tenant.id}`, JSON.stringify(washHistory));
  }, [washHistory, tenant.id]);

  useEffect(() => {
    localStorage.setItem(`saas_tenant_products_${tenant.id}`, JSON.stringify(products));
  }, [products, tenant.id]);

  // ================= 1.1 SISTEMA DE LEVA E TRAZ (VALET & DELIVERY) =================
  const [levaETrazRequests, setLevaETrazRequests] = useState<LevaETrazRequest[]>(() => {
    const saved = localStorage.getItem(`saas_tenant_leva_e_traz_${tenant.id}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) { console.error(e); }
    }
    return [];
  });

  const [levaFilter, setLevaFilter] = useState<'todos' | 'solicitado' | 'coleta' | 'patio' | 'entrega' | 'entregue' | 'cancelado'>('todos');
  const [levaSearch, setLevaSearch] = useState('');
  const [showAddLevaModal, setShowAddLevaModal] = useState(false);
  const [selectedLevaDriver, setSelectedLevaDriver] = useState<Record<string, string>>({});
  const [tenantClients, setTenantClients] = useState<any[]>([]);
  const [isSearchingLTCep, setIsSearchingLTCep] = useState(false);

  // Formulário Manual de Leva e Traz
  const [newLTClientName, setNewLTClientName] = useState('');
  const [newLTClientPhone, setNewLTClientPhone] = useState('');
  const [newLTVehicle, setNewLTVehicle] = useState('');
  const [newLTPlate, setNewLTPlate] = useState('');
  const [newLTService, setNewLTService] = useState('Lavagem Completa');
  const [newLTServicePrice, setNewLTServicePrice] = useState(70);
  const [newLTType, setNewLTType] = useState<LevaETrazType>('completo');
  const [newLTStreet, setNewLTStreet] = useState('');
  const [newLTNumber, setNewLTNumber] = useState('');
  const [newLTNeighborhood, setNewLTNeighborhood] = useState('');
  const [newLTCity, setNewLTCity] = useState(tenant.cidade || '');
  const [newLTCep, setNewLTCep] = useState('');
  const [newLTNotes, setNewLTNotes] = useState('');
  const [newLTDriver, setNewLTDriver] = useState('');

  const buscarCepManualLT = async (valorCep: string) => {
    const cleanCep = valorCep.replace(/\D/g, '');
    if (cleanCep.length !== 8) return;
    try {
      setIsSearchingLTCep(true);
      const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await res.json();
      if (!data.erro) {
        if (data.logradouro) setNewLTStreet(data.logradouro);
        if (data.bairro) setNewLTNeighborhood(data.bairro);
        if (data.localidade) setNewLTCity(data.localidade);
        setNewLTCep(cleanCep.replace(/^(\d{5})(\d{3})/, '$1-$2'));
        showToast('📍 Endereço preenchido automaticamente via CEP!');
      } else {
        showToast('⚠️ CEP não encontrado.');
      }
    } catch (err) {
      console.error('Erro ao buscar CEP Leva e Traz:', err);
    } finally {
      setIsSearchingLTCep(false);
    }
  };

  const calculateManualLTFee = useCallback((type: LevaETrazType, servicePrice: number) => {
    if (!levaConfig.enabled) return 0;
    const baseFee = type === 'completo'
      ? levaConfig.feeCompleto
      : type === 'buscar'
      ? levaConfig.feeBuscar
      : levaConfig.feeEntregar;
    if (levaConfig.freeAboveOrderValue > 0 && servicePrice >= levaConfig.freeAboveOrderValue) {
      return 0;
    }
    return baseFee;
  }, [levaConfig]);

  const handleCreateManualLevaRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLTClientName || !newLTVehicle || !newLTPlate || !newLTStreet) {
      showToast('⚠️ Preencha nome, veículo, placa e endereço de coleta.');
      return;
    }

    const numericServicePrice = Number(newLTServicePrice) || 0;
    const fee = calculateManualLTFee(newLTType, numericServicePrice);
    const total = numericServicePrice + fee;

    const newReq: LevaETrazRequest = {
      id: `leva-manual-${Date.now()}`,
      tenantId: tenant.id,
      type: newLTType,
      status: 'solicitado',
      clientName: newLTClientName,
      clientPhone: newLTClientPhone,
      vehicle: newLTVehicle,
      plate: newLTPlate.toUpperCase(),
      service: newLTService,
      servicePrice: numericServicePrice,
      feePrice: fee,
      totalPrice: total,
      address: {
        cep: newLTCep || undefined,
        street: newLTStreet,
        number: newLTNumber || 'S/N',
        neighborhood: newLTNeighborhood || '',
        city: newLTCity || tenant.cidade || '',
        state: tenant.estado || undefined
      },
      driverName: newLTDriver || undefined,
      notes: newLTNotes || undefined,
      statusHistory: [
        {
          status: 'solicitado',
          timestamp: new Date().toISOString(),
          note: !levaConfig.enabled
            ? 'Solicitação lançada manualmente pelo balcão (taxa travada em R$ 0,00 - serviço pausado)'
            : 'Solicitação lançada manualmente pelo balcão'
        }
      ],
      createdAt: new Date().toISOString()
    };

    const updated = [newReq, ...levaETrazRequests];
    setLevaETrazRequests(updated);
    localStorage.setItem(`saas_tenant_leva_e_traz_${tenant.id}`, JSON.stringify(updated));
    await saveLevaETrazRequest(newReq);

    setShowAddLevaModal(false);
    setNewLTClientName('');
    setNewLTClientPhone('');
    setNewLTVehicle('');
    setNewLTPlate('');
    setNewLTCep('');
    setNewLTStreet('');
    setNewLTNumber('');
    setNewLTNeighborhood('');
    setNewLTNotes('');
    setNewLTDriver('');
    showToast(
      !levaConfig.enabled
        ? '🚗 Solicitação criada com cobrança de taxa travada em R$ 0,00 (Pausado).'
        : '🚗 Solicitação de Leva e Traz criada com sucesso!'
    );
  };

  useEffect(() => {
    localStorage.setItem(`saas_tenant_leva_e_traz_${tenant.id}`, JSON.stringify(levaETrazRequests));
  }, [levaETrazRequests, tenant.id]);

  useEffect(() => {
    const unsubLeva = subscribeToTenantLevaETraz(tenant.id, (remoteLeva) => {
      if (remoteLeva) {
        setLevaETrazRequests(prev => {
          const newRequest = remoteLeva.find(r => !prev.some(p => p.id === r.id));
          if (newRequest) {
            showToast(`🚗 Nova solicitação de Leva e Traz: ${newRequest.clientName} (${newRequest.vehicle})`);
            playTotemChime();
          }
          return remoteLeva;
        });
        localStorage.setItem(`saas_tenant_leva_e_traz_${tenant.id}`, JSON.stringify(remoteLeva));
      }
    });
    return () => unsubLeva();
  }, [tenant.id, playTotemChime]);

  const activeLevaETrazCount = useMemo(() => {
    return levaETrazRequests.filter(r => r.status !== 'entregue' && r.status !== 'cancelado').length;
  }, [levaETrazRequests]);

  // ================= 1. SINCRONIZAÇÃO EM TEMPO REAL CELULAR ⇄ COMPUTADOR (FIRESTORE) =================
  useEffect(() => {
    // 1. Sincroniza dados locais pré-existentes para o Firestore na inicialização
    if (appointments.length > 0) {
      syncAllLocalAppointmentsToFirestore(tenant.id, appointments).catch(console.error);
    }
    if (washItems.length > 0) {
      syncAllLocalWashesToFirestore(tenant.id, washItems).catch(console.error);
    }

    // 2. Escuta Agendamentos em Tempo Real do Firestore
    const unsubApps = subscribeToTenantAppointments(tenant.id, (remoteApps) => {
      if (remoteApps) {
        const cleanApps = deduplicateAppointments(remoteApps);
        setAppointments(prev => {
          // Detecta se chegou um novo agendamento vindo do celular
          const newFromPhone = cleanApps.find(ra => !prev.some(p => p.id === ra.id));
          if (newFromPhone && !newFromPhone.id?.startsWith('app-manual-')) {
            showToast(`🔔 Novo agendamento recebido do celular! (${newFromPhone.clientName} - ${newFromPhone.service})`);
          }
          return cleanApps;
        });
        localStorage.setItem(`saas_tenant_appointments_${tenant.id}`, JSON.stringify(cleanApps));

        // Purga duplicatas de agendamentos se existirem no Firestore
        if (cleanApps.length < remoteApps.length) {
          const cleanIds = new Set(cleanApps.map(a => a.id));
          remoteApps.forEach(a => {
            if (!cleanIds.has(a.id)) {
              deleteAppointmentFromFirestore(tenant.id, a.id).catch(console.error);
            }
          });
        }
      }
    });

    // 3. Escuta Fila do Pátio (Wash Items) em Tempo Real
    const unsubWashes = subscribeToTenantWashItems(tenant.id, (remoteWashes) => {
      if (remoteWashes) {
        const cleanWashes = deduplicateWashItems(remoteWashes);
        setWashItems(cleanWashes);
        localStorage.setItem(`saas_tenant_washes_${tenant.id}`, JSON.stringify(cleanWashes));

        // Purga duplicatas de lavagens no pátio se existirem no Firestore
        if (cleanWashes.length < remoteWashes.length) {
          const cleanIds = new Set(cleanWashes.map(w => w.id));
          remoteWashes.forEach(w => {
            if (!cleanIds.has(w.id)) {
              deleteWashItemFromFirestore(tenant.id, w.id).catch(console.error);
            }
          });
        }
      }
    });

    // 4. Escuta Histórico de Lavagens em Tempo Real
    const unsubHistory = subscribeToTenantWashHistory(tenant.id, (remoteHistory) => {
      if (remoteHistory) {
        const cleanHistory = deduplicateWashHistory(remoteHistory);
        setWashHistory(cleanHistory);
        localStorage.setItem(`saas_tenant_wash_history_${tenant.id}`, JSON.stringify(cleanHistory));

        // Purga duplicatas de histórico no Firestore se existirem
        if (cleanHistory.length < remoteHistory.length) {
          const cleanIds = new Set(cleanHistory.map(h => h.id));
          remoteHistory.forEach(h => {
            if (!cleanIds.has(h.id)) {
              deleteWashHistoryFromFirestore(tenant.id, h.id).catch(console.error);
            }
          });
        }
      }
    });

    // 5. Escuta Resgates de Fidelidade em Tempo Real do celular
    const unsubReds = subscribeToTenantRedemptions(tenant.id, (remoteReds) => {
      const pending = remoteReds.find(r => r.status === 'pending');
      if (pending) {
        setRedemptionData({
          clientName: pending.clientName,
          clientPhone: pending.clientPhone,
          vehicle: pending.vehicle
        });
        showToast(`🎁 Solicitação de Resgate de Lavagem Grátis recebida de ${pending.clientName}!`);
      }
    });

    // 6. Escuta Novos Clientes Cadastrados no Totem em Tempo Real
    const knownClientIds = new Set<string>();
    let isInitialClientLoad = true;

    const unsubTotemClients = subscribeToTenantClients(tenant.id, (remoteClients) => {
      setTenantClients(remoteClients || []);
      if (isInitialClientLoad) {
        remoteClients.forEach(c => {
          const id = c.id || c.uid;
          if (id) knownClientIds.add(id);
        });
        isInitialClientLoad = false;
        return;
      }

      for (const client of remoteClients) {
        const cId = client.id || client.uid;
        if (cId && !knownClientIds.has(cId)) {
          knownClientIds.add(cId);
          const isTotem = (client.origem || '').toLowerCase().includes('totem');
          if (isTotem) {
            triggerTotemNotification({
              name: client.name || client.nomeCompleto || 'Novo Cliente',
              phone: client.phone || client.telefone,
              vehicle: client.vehicle ? `${client.vehicle.modelo || client.vehicle} (${client.vehicle.placa || ''})` : undefined,
              plate: client.vehicle?.placa
            });
            break;
          }
        }
      }
    });

    // Escuta evento customizado de novo cliente do totem no mesmo navegador
    const handleTotemCustomEvent = (e: any) => {
      if (e?.detail) {
        triggerTotemNotification(e.detail);
      }
    };
    window.addEventListener('saas_totem_new_client', handleTotemCustomEvent);

    // Fallback de sincronização para eventos de storage local
    const refreshData = () => {
      const savedApps = localStorage.getItem(`saas_tenant_appointments_${tenant.id}`);
      if (savedApps) {
        try {
          const parsed = JSON.parse(savedApps);
          if (Array.isArray(parsed)) {
            setAppointments(parsed);
          }
        } catch (e) {}
      }
    };

    window.addEventListener('storage', refreshData);
    window.addEventListener('saas_data_sync', refreshData);

    return () => {
      unsubApps();
      unsubWashes();
      unsubHistory();
      unsubReds();
      unsubTotemClients();
      window.removeEventListener('saas_totem_new_client', handleTotemCustomEvent);
      window.removeEventListener('storage', refreshData);
      window.removeEventListener('saas_data_sync', refreshData);
    };
  }, [tenant.id, triggerTotemNotification]);

  // SaaS Override modules
  const [modules, setModules] = useState([
    { id: 'm1', name: 'Gestão de Fila & Operação de Pátio', enabled: true },
    { id: 'm2', name: 'Agendamentos Online & Portal do Cliente', enabled: true },
    { id: 'm3', name: 'Histórico Completo de Lavagens & Comprovantes', enabled: true },
    { id: 'm4', name: 'Módulo de Comissões Automáticas da Equipe', enabled: true },
    { id: 'm5', name: 'Controle de Estoque & Venda no Balcão', enabled: true },
    { id: 'm6', name: 'Notificações via WhatsApp Bot (Disparo Automático)', enabled: tenant.plan !== 'Basic' },
    { id: 'm7', name: 'Relatórios Financeiros & NF-e Automática', enabled: tenant.plan === 'Enterprise' || tenant.plan === 'Vitalicio' }
  ]);

  // Toast / Modals state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showNewWashModal, setShowNewWashModal] = useState(false);
  const [showNewProductModal, setShowNewProductModal] = useState(false);
  const [showNewAppointmentModal, setShowNewAppointmentModal] = useState(false);
  const [showAddHistoryModal, setShowAddHistoryModal] = useState(false);
  const [selectedWashReceipt, setSelectedWashReceipt] = useState<CompletedWashRecord | null>(null);
  const [selectedReminderApp, setSelectedReminderApp] = useState<CustomerAppointment | null>(null);
  const [autoRemindersEnabled, setAutoRemindersEnabled] = useState<boolean>(() => {
    return localStorage.getItem(`saas_auto_reminders_${tenant.id}`) !== 'false';
  });
  const [reminderFilter, setReminderFilter] = useState<'todos' | 'due' | 'sent' | 'scheduled'>('todos');
  const [historySearch, setHistorySearch] = useState('');
  const [historyPeriod, setHistoryPeriod] = useState<'todos' | 'hoje' | '7dias' | 'mes'>('todos');
  const [historyLavador, setHistoryLavador] = useState('todos');
  const [historyPayment, setHistoryPayment] = useState('todos');

  // Filtros de Agendamentos (Inicia em 'Pendente' para não exibir agendamentos já finalizados por padrão)
  const [appointmentStatusFilter, setAppointmentStatusFilter] = useState<'todos' | 'Pendente' | 'Aprovado' | 'Em Lavagem' | 'Concluído' | 'Cancelado'>('Pendente');
  const [appointmentSearch, setAppointmentSearch] = useState('');
  
  // New Wash Form (Fila)
  const [newPlate, setNewPlate] = useState('');
  const [newVehicle, setNewVehicle] = useState('');
  const [newService, setNewService] = useState('Lavagem Simples');
  const [newPrice, setNewPrice] = useState(60);
  const [newClientName, setNewClientName] = useState('');
  const [newLavadorId, setNewLavadorId] = useState('');

  // New Appointment Form (Agendamento Manual no Painel)
  const [appClientName, setAppClientName] = useState('');
  const [appClientPhone, setAppClientPhone] = useState('');
  const [appVehicle, setAppVehicle] = useState('');
  const [appPlate, setAppPlate] = useState('');
  const [appDate, setAppDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [appTime, setAppTime] = useState('10:00');
  const [appService, setAppService] = useState('Lavagem Simples');
  const [appPrice, setAppPrice] = useState(60);
  const [appLavadorId, setAppLavadorId] = useState('');
  const [appNotes, setAppNotes] = useState('');

  // New History Item Form (Lançamento manual no Histórico)
  const [histPlate, setHistPlate] = useState('');
  const [histVehicle, setHistVehicle] = useState('');
  const [histService, setHistService] = useState('Lavagem Completa');
  const [histPrice, setHistPrice] = useState(80);
  const [histClientName, setHistClientName] = useState('');
  const [histClientPhone, setHistClientPhone] = useState('');
  const [histLavadorId, setHistLavadorId] = useState('');
  const [histPaymentMethod, setHistPaymentMethod] = useState<'PIX' | 'Cartão de Débito' | 'Cartão de Crédito' | 'Dinheiro' | 'Cortesia'>('PIX');
  const [histNotes, setHistNotes] = useState('');

  // New Product Form
  const [newProdName, setNewProdName] = useState('');
  const [newProdCategory, setNewProdCategory] = useState<'insumo' | 'venda'>('insumo');
  const [newProdStock, setNewProdStock] = useState(10);
  const [newProdPrice, setNewProdPrice] = useState(20);

  // Support Message Form / Transmissão Root
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastTargetMode, setBroadcastTargetMode] = useState<'box1000' | 'current'>('box1000');
  const [broadcastUrgency, setBroadcastUrgency] = useState<'info' | 'alerta' | 'urgente'>('info');
  const [isSendingBroadcast, setIsSendingBroadcast] = useState(false);
  const [sentBroadcasts, setSentBroadcasts] = useState<BroadcastNotification[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem('saas_sent_broadcasts');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Localiza ou prepara os dados do Box 1000 para alvo prioritário da notificação
  const box1000Tenant = useMemo(() => {
    try {
      const raw = localStorage.getItem('saas_master_tenants');
      if (raw) {
        const list: Tenant[] = JSON.parse(raw);
        const match = list.find(t => 
          (t.name && t.name.toLowerCase().includes('box 1000')) || 
          (t.id && t.id.toLowerCase().includes('box1000')) || 
          (t.domain && t.domain.toLowerCase().includes('box1000'))
        );
        if (match) return match;
      }
    } catch (_) {}
    if (tenant.name.toLowerCase().includes('box 1000') || tenant.id.toLowerCase().includes('box1000')) {
      return tenant;
    }
    return {
      id: 't-box1000',
      name: 'Box 1000 Lava Jato e Lubrificação',
      code: 'B1',
      domain: 'box1000lavajatoelubrificacao.saas.com',
      plan: 'Pro' as const,
      status: 'Ativo' as const,
      endUsersCount: 1,
      maxUsers: 500,
      mrrAmount: 299,
      createdAt: new Date().toLocaleDateString('pt-BR'),
      contactEmail: 'box1000@lavajato.com',
      contactPhone: '(11) 99999-1000',
      ownerName: 'Gerência Box 1000',
      lastActive: 'Agora mesmo'
    };
  }, [tenant]);

  // Estados para Compra do Aplicativo (Plano Vitalício)
  const [isUpgradingLifetime, setIsUpgradingLifetime] = useState(false);
  const [paymentMethodSelected, setPaymentMethodSelected] = useState<'pix' | 'cartao'>('pix');
  const [copiedPixKey, setCopiedPixKey] = useState(false);
  const [showPurchaseSuccessBanner, setShowPurchaseSuccessBanner] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleConfirmPurchaseLifetime = async () => {
    setIsUpgradingLifetime(true);
    try {
      const updated: Tenant = {
        ...tenant,
        plan: 'Vitalicio',
        status: 'Ativo',
        isLifetime: true,
        purchaseAmount: 4000,
        mrrAmount: 0,
        maxUsers: 99999
      };
      setCurrentTenant(updated);
      await saveTenantToFirestore(updated);
      if (onUpdateTenant) onUpdateTenant(updated);

      try {
        const savedInvoices = localStorage.getItem('saas_master_invoices');
        const currentInvoices = savedInvoices ? JSON.parse(savedInvoices) : [];
        const newInvoice = {
          id: `INV-${Date.now().toString().slice(-6)}`,
          tenantId: tenant.id,
          tenantName: tenant.nomeFantasia || tenant.name,
          amount: 4000,
          date: new Date().toLocaleDateString('pt-BR'),
          dueDate: new Date().toLocaleDateString('pt-BR'),
          status: 'Pago',
          planName: 'Vitalicio'
        };
        localStorage.setItem('saas_master_invoices', JSON.stringify([newInvoice, ...currentInvoices]));
      } catch (e) {
        console.warn('Erro ao salvar fatura vitalícia:', e);
      }

      setShowPurchaseSuccessBanner(true);
      showToast('🎉 Parabéns! Compra da Licença Vitalícia confirmada com sucesso!');
    } catch (err) {
      console.error('Erro ao ativar plano vitalício:', err);
      showToast('Erro ao processar ativação vitalícia.');
    } finally {
      setIsUpgradingLifetime(false);
    }
  };

  // Manager Alert for Client Free Wash Redemption Requests
  interface RedemptionData {
    requested: boolean;
    clientName: string;
    clientPhone?: string;
    vehicle?: string;
    date: string;
  }

  const [redemptionData, setRedemptionData] = useState<RedemptionData | null>(() => {
    const saved = localStorage.getItem(`saas_fidelity_redemption_${tenant.id}`);
    return saved ? JSON.parse(saved) : null;
  });

  // Check periodically for incoming client reward redemption notifications
  useEffect(() => {
    const checkRedemption = () => {
      const saved = localStorage.getItem(`saas_fidelity_redemption_${tenant.id}`);
      if (saved) {
        try {
          setRedemptionData(JSON.parse(saved));
        } catch (e) {
          console.error(e);
        }
      } else {
        setRedemptionData(null);
      }
    };

    checkRedemption();
    const interval = setInterval(checkRedemption, 2000);
    return () => clearInterval(interval);
  }, [tenant.id]);

  const handleApproveRewardRedemption = () => {
    if (!redemptionData) return;

    // 1. Add free wash item to patio wash queue (R$ 0.00 Cortesia)
    const freeWash: WashItem = {
      id: `w-cortesia-${Date.now()}`,
      plate: 'GRÁTIS',
      vehicle: redemptionData.vehicle || 'Veículo do Cliente',
      service: '🎁 Lavagem Cortesia (Resgate Fidelidade 10 Pontos)',
      price: 0,
      clientName: redemptionData.clientName || 'Cliente Fidelidade',
      status: 'Aguardando',
      commissionRate: 0,
      commissionAmount: 0,
      createdAt: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };

    setWashItems(prev => [freeWash, ...prev]);
    saveWashItemToFirestore(tenant.id, freeWash).catch(console.error);
    updateFidelityRedemptionInFirestore(tenant.id, (redemptionData as any).id || '', 'approved').catch(console.error);
    saveFidelityPointsToFirestore(tenant.id, redemptionData.clientPhone || redemptionData.clientName || 'global', 0).catch(console.error);

    // 2. Reset points and remove redemption request
    localStorage.setItem(`saas_fidelity_pts_${tenant.id}`, '0');
    localStorage.removeItem(`saas_fidelity_redemption_${tenant.id}`);
    setRedemptionData(null);

    showToast(`🎉 Resgate Aprovado pelo Gerente! Lavagem Cortesia (R$ 0,00) adicionada à Fila do Pátio e Cartão Fidelidade zerado.`);
  };

  // Actions
  const handleAssignLavador = (washId: string, staffId: string) => {
    const staff = staffList.find(s => s.id === staffId);
    if (!staff) return;

    setWashItems(prev => prev.map(item => {
      if (item.id === washId) {
        const calcCommission = (item.price * staff.defaultCommission) / 100;
        return {
          ...item,
          lavadorId: staff.id,
          lavadorName: staff.name,
          commissionRate: staff.defaultCommission,
          commissionAmount: calcCommission
        };
      }
      return item;
    }));
    showToast(`Lavador ${staff.name} atribuído ao veículo!`);
  };

  const handleMoveStatus = (washId: string, nextStatus: 'Aguardando' | 'Em Execução' | 'Concluído') => {
    const item = washItems.find(w => w.id === washId);
    if (!item) return;

    if (nextStatus === 'Concluído' && item.status !== 'Concluído') {
      // 1. Credit commission to lavador
      if (item.lavadorId) {
        setStaffList(prev => prev.map(staff => {
          if (staff.id === item.lavadorId) {
            return {
              ...staff,
              completedWashes: staff.completedWashes + 1,
              accumulatedCommission: staff.accumulatedCommission + item.commissionAmount
            };
          }
          return staff;
        }));
      }

      // 2. Add to Completed Wash History with deterministic ID to prevent duplicates
      const now = new Date();
      const safeId = item.id.replace(/[^a-zA-Z0-9_-]/g, '_');
      const historyId = `wh-${safeId}`;
      const dateIso = now.toISOString().split('T')[0];
      const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const completedAtFormatted = `${now.toLocaleDateString('pt-BR')} às ${timeStr}`;

      const historyEntry: CompletedWashRecord = {
        id: historyId,
        plate: item.plate,
        vehicle: item.vehicle,
        service: item.service,
        price: item.price,
        clientName: item.clientName,
        clientPhone: item.clientPhone,
        lavadorId: item.lavadorId,
        lavadorName: item.lavadorName || 'Equipe do Pátio',
        commissionRate: item.commissionRate,
        commissionAmount: item.commissionAmount,
        completedAt: completedAtFormatted,
        date: dateIso,
        paymentMethod: item.price === 0 ? 'Cortesia' : 'PIX',
        durationMinutes: 45
      };
      setWashHistory(prev => deduplicateWashHistory([historyEntry, ...prev.filter(h => h.id !== historyId)]));
      saveWashHistoryToFirestore(tenant.id, historyEntry).catch(console.error);

      // 3. EXCLUSIVELY AUTOMATIC FIDELITY POINT ATTRIBUTION BY LAVA-JATO!
      const keyPts = `saas_fidelity_pts_${tenant.id}`;
      const currentPts = Number(localStorage.getItem(keyPts) || '0');
      const newPts = currentPts + 1;
      localStorage.setItem(keyPts, newPts.toString());
      saveFidelityPointsToFirestore(tenant.id, item.clientPhone || item.clientName || 'global', newPts).catch(console.error);

      if (newPts >= 10) {
        showToast(`✨ +1 Ponto concedido para ${item.clientName}! 🎉 CLIENTE ALCANÇOU 10 PONTOS (Liberado para Resgate Grátis no Portal)! Adicionado ao Histórico.`);
      } else {
        showToast(`✨ +1 Ponto creditado para ${item.clientName}! (${newPts}/10 carimbos). Registrado no Histórico de Lavagem.`);
      }

      // Sincroniza o agendamento de origem para 'Concluído' se veio de um agendamento
      const rawAppId = item.id.startsWith('w-from-') ? item.id.replace('w-from-', '').split('-')[0] : null;
      const matchingApp = appointments.find(a => (rawAppId && a.id === rawAppId) || (a.plate && a.plate.toUpperCase() === item.plate.toUpperCase()));
      if (matchingApp) {
        updateAppointmentStatusInFirestore(tenant.id, matchingApp.id, 'Concluído').catch(console.error);
        setAppointments(prev => prev.map(a => a.id === matchingApp.id ? { ...a, status: 'Concluído' } : a));
      }

      // Sincroniza pedido de Leva & Traz vinculado ao pátio para 'concluido' (pronto para entrega)
      const cleanWashPlate = (item.plate || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const matchingLeva = levaETrazRequests.find(r =>
        r.status !== 'entregue' &&
        r.status !== 'cancelado' &&
        r.status !== 'concluido' &&
        r.status !== 'em_entrega' &&
        (r.washItemId === washId || (cleanWashPlate && (r.plate || '').toUpperCase().replace(/[^A-Z0-9]/g, '') === cleanWashPlate))
      );
      if (matchingLeva) {
        const autoNote = 'Lavagem finalizada no pátio automaticamente';
        const nowIso = new Date().toISOString();
        setLevaETrazRequests(prev => prev.map(r => r.id === matchingLeva.id ? {
          ...r,
          status: 'concluido',
          washItemId: washId,
          statusHistory: [...(r.statusHistory || []), { status: 'concluido', timestamp: nowIso, note: autoNote }]
        } : r));
        updateLevaETrazStatusInFirestore(tenant.id, matchingLeva.id, 'concluido', {
          washItemId: washId,
          notes: autoNote
        }).catch(console.error);
        if (matchingLeva.appointmentId && (!matchingApp || matchingApp.id !== matchingLeva.appointmentId)) {
          updateAppointmentStatusInFirestore(tenant.id, matchingLeva.appointmentId, 'Concluído').catch(console.error);
        }
        showToast(`🚚 Leva & Traz de ${matchingLeva.clientName} atualizado para: Lavagem Pronta / Entrega!`);
      }
    }

    const currentIso = new Date().toISOString().split('T')[0];
    const currentTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const fallbackCompleted = `${new Date().toLocaleDateString('pt-BR')} às ${currentTime}`;

    setWashItems(prev => deduplicateWashItems(prev.map(w => {
      if (w.id === washId) {
        return {
          ...w,
          status: nextStatus,
          completedAt: nextStatus === 'Concluído' ? (w.completedAt || fallbackCompleted) : w.completedAt,
          completedDate: nextStatus === 'Concluído' ? (w.completedDate || currentIso) : w.completedDate
        };
      }
      return w;
    })));
    updateWashItemStatusInFirestore(tenant.id, washId, nextStatus).catch(console.error);

    if (item.status !== nextStatus) {
      sendClientVehicleStatusPushNotification({
        tenantId: tenant.id,
        tenantName: tenant.nomeFantasia || tenant.name,
        clientName: item.clientName,
        clientPhone: item.clientPhone,
        vehicle: item.vehicle,
        plate: item.plate,
        service: item.service,
        newStatus: nextStatus,
        source: 'patio'
      }).catch(console.error);
    }
  };

  const handleAddWash = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlate || !newVehicle || !newClientName) return;

    const assignedStaff = staffList.find(s => s.id === newLavadorId);
    const commRate = assignedStaff ? assignedStaff.defaultCommission : 10;
    const commAmt = (newPrice * commRate) / 100;

    const newWash: WashItem = {
      id: `w-${Date.now()}`,
      plate: newPlate.toUpperCase(),
      vehicle: newVehicle,
      service: newService,
      price: Number(newPrice),
      clientName: newClientName,
      status: 'Aguardando',
      lavadorId: assignedStaff?.id,
      lavadorName: assignedStaff?.name,
      commissionRate: commRate,
      commissionAmount: commAmt,
      createdAt: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };

    setWashItems(prev => [newWash, ...prev]);
    saveWashItemToFirestore(tenant.id, newWash).catch(console.error);
    sendClientVehicleStatusPushNotification({
      tenantId: tenant.id,
      tenantName: tenant.nomeFantasia || tenant.name,
      clientName: newWash.clientName,
      vehicle: newWash.vehicle,
      plate: newWash.plate,
      service: newWash.service,
      newStatus: 'Aguardando',
      source: 'patio'
    }).catch(console.error);
    setShowNewWashModal(false);
    setNewPlate('');
    setNewVehicle('');
    setNewClientName('');
    showToast(`Veículo ${newWash.plate} adicionado à fila do pátio!`);
  };

  const handleApproveAppointment = (app: CustomerAppointment) => {
    const assignedStaff = staffList.find(s => s.id === app.lavadorId) || staffList[0] || {
      id: 'st-1',
      name: 'Equipe do Pátio',
      defaultCommission: 15
    };
    const commAmt = (app.price * (assignedStaff.defaultCommission || 15)) / 100;

    const washId = `w-from-${app.id}`;
    const washFromApp: WashItem = {
      id: washId,
      plate: app.plate,
      vehicle: app.vehicle,
      service: app.service,
      price: app.price,
      clientName: app.clientName,
      clientPhone: app.clientPhone,
      status: 'Aguardando',
      lavadorId: assignedStaff.id,
      lavadorName: assignedStaff.name,
      commissionRate: assignedStaff.defaultCommission || 15,
      commissionAmount: commAmt,
      createdAt: `Agendado (${app.dateTime.split(' ')[1] || 'Horário'})`
    };

    // Remove qualquer wash anterior com mesmo ID ou mesma placa ativa antes de adicionar
    const cleanWashItems = washItems.filter(w => w.id !== washId && (!w.plate || w.plate.toUpperCase() !== app.plate.toUpperCase() || w.status === 'Concluído'));
    const newWashList = deduplicateWashItems([washFromApp, ...cleanWashItems]);

    // O status do agendamento passa para 'Em Lavagem' (saindo de 'Pendente' para zerar o contador de pendências)
    const newAppList = appointments.map(a => a.id === app.id ? { ...a, status: 'Em Lavagem' as const } : a);

    setWashItems(newWashList);
    setAppointments(newAppList);
    saveWashItemToFirestore(tenant.id, washFromApp).catch(console.error);
    updateAppointmentStatusInFirestore(tenant.id, app.id, 'Em Lavagem').catch(console.error);
    sendClientVehicleStatusPushNotification({
      tenantId: tenant.id,
      tenantName: tenant.nomeFantasia || tenant.name,
      clientName: app.clientName,
      clientPhone: app.clientPhone,
      clientEmail: (app as any).clientEmail,
      vehicle: app.vehicle,
      plate: app.plate,
      service: app.service,
      newStatus: 'Em Lavagem',
      source: 'agendamento'
    }).catch(console.error);
    localStorage.setItem(`saas_tenant_washes_${tenant.id}`, JSON.stringify(newWashList));
    localStorage.setItem(`saas_tenant_appointments_${tenant.id}`, JSON.stringify(newAppList));
    window.dispatchEvent(new Event('storage'));
    showToast(`✅ Agendamento de ${app.clientName} enviado para a Fila do Pátio e sincronizado!`);
  };

  const handleApproveAllAppointments = () => {
    const pendingApps = appointments.filter(a => a.status === 'Pendente');
    if (pendingApps.length === 0) {
      showToast('Nenhum agendamento pendente para enviar à fila.');
      return;
    }

    const defaultStaff = staffList[0] || {
      id: 'st-1',
      name: 'Equipe do Pátio',
      defaultCommission: 15
    };

    const newWashes: WashItem[] = pendingApps.map((app) => {
      const assignedStaff = staffList.find(s => s.id === app.lavadorId) || defaultStaff;
      const commAmt = (app.price * (assignedStaff.defaultCommission || 15)) / 100;
      return {
        id: `w-from-${app.id}`,
        plate: app.plate,
        vehicle: app.vehicle,
        service: app.service,
        price: app.price,
        clientName: app.clientName,
        clientPhone: app.clientPhone,
        status: 'Aguardando',
        lavadorId: assignedStaff.id,
        lavadorName: assignedStaff.name,
        commissionRate: assignedStaff.defaultCommission || 15,
        commissionAmount: commAmt,
        createdAt: `Agendado (${app.dateTime.split(' ')[1] || 'Horário'})`
      };
    });

    const pendingIds = new Set(pendingApps.map(a => a.id));
    const pendingPlates = new Set(pendingApps.map(a => (a.plate || '').toUpperCase()));

    const cleanWashes = washItems.filter(w => !newWashes.some(nw => nw.id === w.id) && !pendingPlates.has((w.plate || '').toUpperCase()));
    const newWashList = deduplicateWashItems([...newWashes, ...cleanWashes]);

    // Atualiza todos os agendamentos pendentes para 'Em Lavagem'
    const updatedApps = appointments.map(a => pendingIds.has(a.id) ? { ...a, status: 'Em Lavagem' as const } : a);

    setWashItems(newWashList);
    setAppointments(updatedApps);
    for (const w of newWashes) {
      saveWashItemToFirestore(tenant.id, w).catch(console.error);
    }
    for (const a of pendingApps) {
      updateAppointmentStatusInFirestore(tenant.id, a.id, 'Em Lavagem').catch(console.error);
      sendClientVehicleStatusPushNotification({
        tenantId: tenant.id,
        tenantName: tenant.nomeFantasia || tenant.name,
        clientName: a.clientName,
        clientPhone: a.clientPhone,
        clientEmail: (a as any).clientEmail,
        vehicle: a.vehicle,
        plate: a.plate,
        service: a.service,
        newStatus: 'Em Lavagem',
        source: 'agendamento'
      }).catch(console.error);
    }
    localStorage.setItem(`saas_tenant_washes_${tenant.id}`, JSON.stringify(newWashList));
    localStorage.setItem(`saas_tenant_appointments_${tenant.id}`, JSON.stringify(updatedApps));
    window.dispatchEvent(new Event('storage'));
    showToast(`🚀 ${pendingApps.length} agendamentos enviados para a Fila do Pátio e sincronizados!`);
  };

  const handleCancelAppointment = (appId: string) => {
    const targetApp = appointments.find(a => a.id === appId);
    const newAppList = appointments.map(a => a.id === appId ? { ...a, status: 'Cancelado' as const } : a);
    setAppointments(newAppList);
    updateAppointmentStatusInFirestore(tenant.id, appId, 'Cancelado').catch(console.error);

    // Cancela também eventual solicitação de Leva & Traz vinculada a este agendamento
    const linkedLeva = levaETrazRequests.find(
      r => r.appointmentId === appId && r.status !== 'entregue' && r.status !== 'cancelado'
    );
    if (linkedLeva) {
      const cancelNote = 'Cancelado junto ao agendamento';
      setLevaETrazRequests(prev => prev.map(r => r.id === linkedLeva.id ? {
        ...r,
        status: 'cancelado',
        statusHistory: [...(r.statusHistory || []), { status: 'cancelado', timestamp: new Date().toISOString(), note: cancelNote }]
      } : r));
      updateLevaETrazStatusInFirestore(tenant.id, linkedLeva.id, 'cancelado', { notes: cancelNote }).catch(console.error);
    }

    if (targetApp) {
      sendClientVehicleStatusPushNotification({
        tenantId: tenant.id,
        tenantName: tenant.nomeFantasia || tenant.name,
        clientName: targetApp.clientName,
        clientPhone: targetApp.clientPhone,
        clientEmail: (targetApp as any).clientEmail,
        vehicle: targetApp.vehicle,
        plate: targetApp.plate,
        service: targetApp.service,
        newStatus: 'Cancelado',
        source: 'agendamento'
      }).catch(console.error);
    }
    localStorage.setItem(`saas_tenant_appointments_${tenant.id}`, JSON.stringify(newAppList));
    window.dispatchEvent(new Event('storage'));
    showToast(`Agendamento marcado como cancelado.`);
  };

  const handleRejectAppointment = (appId: string) => {
    handleCancelAppointment(appId);
  };

  const handleDeleteAppointment = (appId: string) => {
    const newAppList = appointments.filter(a => a.id !== appId);
    setAppointments(newAppList);
    deleteAppointmentFromFirestore(tenant.id, appId).catch(console.error);
    localStorage.setItem(`saas_tenant_appointments_${tenant.id}`, JSON.stringify(newAppList));
    window.dispatchEvent(new Event('storage'));
    showToast(`Agendamento excluído.`);
  };

  const handleClearFinishedAppointments = () => {
    const toRemove = appointments.filter(a => a.status === 'Concluído' || a.status === 'Cancelado');
    if (toRemove.length === 0) {
      showToast('Nenhum agendamento finalizado ou cancelado para limpar.');
      return;
    }
    const remaining = appointments.filter(a => a.status !== 'Concluído' && a.status !== 'Cancelado');
    setAppointments(remaining);
    toRemove.forEach(a => deleteAppointmentFromFirestore(tenant.id, a.id).catch(console.error));
    localStorage.setItem(`saas_tenant_appointments_${tenant.id}`, JSON.stringify(remaining));
    window.dispatchEvent(new Event('storage'));
    showToast(`🧹 ${toRemove.length} agendamento(s) finalizado(s) removido(s) do banco de dados!`);
  };

  const handleCreateAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!appClientName || !appVehicle || !appPlate || !appDate || !appTime) return;

    const assignedStaff = staffList.find(s => s.id === appLavadorId);
    const serviceDateObj = parseAppointmentDateTime({ date: appDate, time: appTime });
    const reminderTarget = serviceDateObj ? calculateReminder24hTarget(serviceDateObj) : null;
    const formattedDateDisplay = appDate.includes('-') ? appDate.split('-').reverse().join('/') : appDate;

    const newApp: CustomerAppointment = {
      id: `app-manual-${Date.now()}`,
      clientName: appClientName,
      clientPhone: appClientPhone,
      vehicle: appVehicle,
      plate: appPlate.toUpperCase(),
      service: appService,
      price: Number(appPrice),
      dateTime: `${formattedDateDisplay} ${appTime}`,
      date: appDate,
      time: appTime,
      lavadorId: assignedStaff?.id,
      lavadorName: assignedStaff?.name,
      status: 'Aprovado',
      notes: appNotes || 'Agendado diretamente no balcão da empresa',
      createdAt: new Date().toISOString(),
      reminder24hEnabled: true,
      reminder24hScheduledAt: reminderTarget ? reminderTarget.toISOString() : undefined,
      reminder24hSent: false,
      reminderChannel: appClientPhone ? 'whatsapp' : 'email'
    };

    const updatedApps = [newApp, ...appointments];
    setAppointments(updatedApps);
    saveAppointmentToFirestore(tenant.id, newApp).catch(console.error);
    localStorage.setItem(`saas_tenant_appointments_${tenant.id}`, JSON.stringify(updatedApps));
    window.dispatchEvent(new Event('storage'));

    setAppClientName('');
    setAppClientPhone('');
    setAppVehicle('');
    setAppPlate('');
    setAppNotes('');
    setShowNewAppointmentModal(false);
    showToast(`📅 Agendamento de ${newApp.clientName} registrado com lembrete 24h ativo!`);
  };

  // ⏰ Disparo individual de lembrete (WhatsApp ou E-mail)
  const handleSendReminder = async (app: CustomerAppointment, channel: 'whatsapp' | 'email') => {
    const sentAt = new Date().toISOString();
    const updatedApps = appointments.map(a => a.id === app.id ? {
      ...a,
      reminder24hSent: true,
      reminder24hSentAt: sentAt,
      reminderChannel: channel
    } : a);
    setAppointments(updatedApps);
    localStorage.setItem(`saas_tenant_appointments_${tenant.id}`, JSON.stringify(updatedApps));

    await updateAppointmentReminderInFirestore(tenant.id, app.id, {
      reminder24hSent: true,
      reminder24hSentAt: sentAt,
      reminderChannel: channel
    });

    if (channel === 'whatsapp') {
      const text = buildReminderWhatsAppText(tenant.nomeFantasia || tenant.name, app, tenant.address?.street);
      const url = buildReminderWhatsAppUrl(app.clientPhone, text);
      window.open(url, '_blank');
      showToast(`🔔 Lembrete 24h preparado no WhatsApp para ${app.clientName}!`);
    } else {
      const { mailtoUrl } = buildReminderEmailContent(tenant.nomeFantasia || tenant.name, app, tenant.address?.street);
      window.location.href = mailtoUrl;
      showToast(`✉️ Lembrete 24h preparado no E-mail para ${app.clientName}!`);
    }
  };

  const handleToggleReminderSent = async (appId: string, sent: boolean) => {
    const sentAt = sent ? new Date().toISOString() : undefined;
    const updated = appointments.map(a => a.id === appId ? {
      ...a,
      reminder24hSent: sent,
      reminder24hSentAt: sentAt
    } : a);
    setAppointments(updated);
    localStorage.setItem(`saas_tenant_appointments_${tenant.id}`, JSON.stringify(updated));
    await updateAppointmentReminderInFirestore(tenant.id, appId, {
      reminder24hSent: sent,
      reminder24hSentAt: sentAt
    });
    showToast(sent ? 'Lembrete marcado como enviado!' : 'Lembrete desmarcado.');
  };

  // ⏰ Disparo em lote de todos os lembretes prontos (janela <= 24h)
  const handleBatchSendReminders = async () => {
    const now = new Date();
    const dueApps = appointments.filter(a => {
      if (a.status === 'Cancelado' || a.status === 'Concluído') return false;
      if (a.reminder24hSent) return false;
      const analysis = getAppointmentReminderAnalysis(a, now);
      return analysis.canSendNow;
    });

    if (dueApps.length === 0) {
      showToast('ℹ️ Não há agendamentos com lembrete pendente nas próximas 24h no momento.');
      return;
    }

    const sentAt = new Date().toISOString();
    const dueIds = new Set(dueApps.map(a => a.id));

    const updatedApps = appointments.map(a => dueIds.has(a.id) ? {
      ...a,
      reminder24hSent: true,
      reminder24hSentAt: sentAt,
      reminderChannel: (a.clientPhone ? 'whatsapp' : 'email') as 'whatsapp' | 'email'
    } : a);

    setAppointments(updatedApps);
    localStorage.setItem(`saas_tenant_appointments_${tenant.id}`, JSON.stringify(updatedApps));

    for (const app of dueApps) {
      await updateAppointmentReminderInFirestore(tenant.id, app.id, {
        reminder24hSent: true,
        reminder24hSentAt: sentAt,
        reminderChannel: app.clientPhone ? 'whatsapp' : 'email'
      });
    }

    // Abre o WhatsApp do primeiro para envio imediato
    if (dueApps[0].clientPhone) {
      const text = buildReminderWhatsAppText(tenant.nomeFantasia || tenant.name, dueApps[0], tenant.address?.street);
      const url = buildReminderWhatsAppUrl(dueApps[0].clientPhone, text);
      window.open(url, '_blank');
    }

    showToast(`🚀 ${dueApps.length} lembrete(s) 24h disparado(s) com sucesso para os clientes de amanhã!`);
  };

  // ⏰ Monitoramento de Lembretes 24h em Segundo Plano
  useEffect(() => {
    if (!autoRemindersEnabled) return;

    const checkReminders = () => {
      const now = new Date();
      let dueCount = 0;

      appointments.forEach((app) => {
        if (app.status === 'Cancelado' || app.status === 'Concluído') return;
        if (app.reminder24hSent) return;

        const analysis = getAppointmentReminderAnalysis(app, now);
        if (analysis.canSendNow && !app.reminder24hSent) {
          dueCount++;
        }
      });

      if (dueCount > 0) {
        console.log(`⏰ [Auto Reminders 24h] ${dueCount} agendamento(s) com serviço nas próximas 24h prontos para lembrete.`);
      }
    };

    checkReminders();
    const timer = setInterval(checkReminders, 60000);
    return () => clearInterval(timer);
  }, [appointments, autoRemindersEnabled]);


  const handleAddManualHistory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!histPlate || !histVehicle || !histClientName) return;

    const assignedStaff = staffList.find(s => s.id === histLavadorId);
    const commRate = assignedStaff ? assignedStaff.defaultCommission : 15;
    const commAmt = (Number(histPrice) * commRate) / 100;
    const now = new Date();

    const newHistoryEntry: CompletedWashRecord = {
      id: `wh-man-${Date.now()}`,
      plate: histPlate.toUpperCase(),
      vehicle: histVehicle,
      service: histService,
      price: Number(histPrice),
      clientName: histClientName,
      clientPhone: histClientPhone,
      lavadorId: assignedStaff?.id,
      lavadorName: assignedStaff?.name || 'Equipe Geral',
      commissionRate: commRate,
      commissionAmount: commAmt,
      completedAt: `Hoje às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
      date: now.toISOString().split('T')[0],
      paymentMethod: histPaymentMethod,
      durationMinutes: 45,
      notes: histNotes
    };

    const updatedHistory = deduplicateWashHistory([newHistoryEntry, ...washHistory]);
    setWashHistory(updatedHistory);
    saveWashHistoryToFirestore(tenant.id, newHistoryEntry).catch(console.error);
    localStorage.setItem(`saas_tenant_wash_history_${tenant.id}`, JSON.stringify(updatedHistory));

    setHistPlate('');
    setHistVehicle('');
    setHistClientName('');
    setHistClientPhone('');
    setHistNotes('');
    setShowAddHistoryModal(false);
    showToast(`✅ Lavagem de ${newHistoryEntry.plate} registrada no Histórico com sucesso!`);
  };

  const handleDeleteHistoryItem = (id: string) => {
    const updated = deduplicateWashHistory(washHistory.filter(h => h.id !== id));
    setWashHistory(updated);
    deleteWashHistoryFromFirestore(tenant.id, id).catch(console.error);
    localStorage.setItem(`saas_tenant_wash_history_${tenant.id}`, JSON.stringify(updated));
    showToast('Registro removido do histórico.');
  };

  const handleExportHistoryCSV = () => {
    if (washHistory.length === 0) {
      showToast('Nenhum registro para exportar.');
      return;
    }

    const headers = ['ID', 'Data/Hora', 'Placa', 'Veiculo', 'Cliente', 'Telefone', 'Servico', 'Valor (R$)', 'Lavador', 'Comissao (R$)', 'Pagamento', 'Observacoes'];
    const rows = washHistory.map(item => [
      item.id,
      `"${item.completedAt}"`,
      `"${item.plate}"`,
      `"${item.vehicle}"`,
      `"${item.clientName}"`,
      `"${item.clientPhone || ''}"`,
      `"${item.service}"`,
      item.price.toFixed(2),
      `"${item.lavadorName || ''}"`,
      item.commissionAmount.toFixed(2),
      `"${item.paymentMethod}"`,
      `"${item.notes || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `historico_lavagens_${tenant.id}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('📁 Relatório CSV exportado com sucesso!');
  };

  const handleDeleteWashItem = (washId: string) => {
    const item = washItems.find(w => w.id === washId);
    setWashItems(prev => prev.filter(w => w.id !== washId));
    deleteWashItemFromFirestore(tenant.id, washId).catch(console.error);
    showToast(`🗑️ Veículo ${item?.plate || ''} removido do pátio.`);
  };

  // ================= FUNÇÕES DE OPERAÇÃO DO LEVA E TRAZ =================
  const handleAdvanceLevaStatus = async (
    req: LevaETrazRequest, 
    nextStatus: LevaETrazStatus,
    customNote?: string
  ) => {
    try {
      let linkedWashId = req.washItemId;
      const cleanReqPlate = (req.plate || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

      // Se o status for 'no_patio', envia automaticamente para a Fila de Lavagem se ainda não estiver
      if (nextStatus === 'no_patio') {
        const existingYard = washItems.find(
          w => (w.plate || '').toUpperCase().replace(/[^A-Z0-9]/g, '') === cleanReqPlate && w.status !== 'Concluído'
        );
        if (existingYard) {
          linkedWashId = existingYard.id;
        } else {
          const washId = `wash-leva-${req.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
          linkedWashId = washId;
          const assignedStaff = staffList.find(s => s.id === req.driverId || s.name === req.driverName) || staffList[0];
          const commRate = assignedStaff ? assignedStaff.defaultCommission : 10;
          const newWash: WashItem = {
            id: washId,
            plate: req.plate,
            vehicle: req.vehicle,
            service: `${req.service} (Leva e Traz)`,
            price: req.servicePrice,
            clientName: req.clientName,
            clientPhone: req.clientPhone,
            status: 'Aguardando',
            lavadorId: assignedStaff?.id,
            lavadorName: assignedStaff?.name,
            commissionRate: commRate,
            commissionAmount: Number(((req.servicePrice * commRate) / 100).toFixed(2)),
            createdAt: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
          };
          const newYard = deduplicateWashItems([newWash, ...washItems]);
          setWashItems(newYard);
          localStorage.setItem(`saas_tenant_washes_${tenant.id}`, JSON.stringify(newYard));
          await saveWashItemToFirestore(tenant.id, newWash);
          showToast(`🚗 Veículo ${req.vehicle} (${req.plate}) inserido automaticamente na Fila do Pátio!`);
        }
      }

      // Se avançar para 'concluido' no painel Leva & Traz, atualiza também o item no pátio caso ainda esteja aberto
      if (nextStatus === 'concluido') {
        const yardMatch = washItems.find(
          w => w.status !== 'Concluído' && (w.id === req.washItemId || (cleanReqPlate && (w.plate || '').toUpperCase().replace(/[^A-Z0-9]/g, '') === cleanReqPlate))
        );
        if (yardMatch) {
          linkedWashId = yardMatch.id;
          const now = new Date();
          const dateIso = now.toISOString().split('T')[0];
          const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
          const completedFormatted = `${now.toLocaleDateString('pt-BR')} às ${timeStr}`;
          setWashItems(prev => prev.map(w => w.id === yardMatch.id ? {
            ...w,
            status: 'Concluído',
            completedAt: w.completedAt || completedFormatted,
            completedDate: w.completedDate || dateIso
          } : w));
          updateWashItemStatusInFirestore(tenant.id, yardMatch.id, 'Concluído').catch(console.error);
        }
      }

      // Se entregue, registra automaticamente a entrada no Fluxo de Caixa (ID determinístico para evitar duplicidade)
      if (nextStatus === 'entregue') {
        const totalVal = Number(req.totalPrice || (Number(req.servicePrice || 0) + Number(req.feePrice || 0)));
        if (totalVal > 0) {
          const now = new Date();
          const cashEntry: CashTransaction = {
            id: `cash-leva-${req.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
            tenantId: tenant.id,
            type: 'entrada',
            category: 'venda_lavagem',
            categoryLabel: 'Leva & Traz + Lavagem',
            description: `Leva & Traz (${req.type === 'completo' ? 'Completo' : req.type === 'buscar' ? 'Coleta' : 'Entrega'}) - ${req.vehicle} (${req.plate})`,
            amount: totalVal,
            paymentMethod: 'PIX',
            date: now.toISOString().split('T')[0],
            time: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            operator: req.driverName || currentTenant.ownerName || 'Operação Leva & Traz',
            referenceId: req.id,
            recipientOrClient: req.clientName,
            createdAt: now.toISOString()
          };
          saveCashTransactionToFirestore(tenant.id, cashEntry).catch(console.error);
        }
      }

      const updatedList = levaETrazRequests.map(r => {
        if (r.id === req.id) {
          const hist = r.statusHistory || [];
          return {
            ...r,
            status: nextStatus,
            washItemId: linkedWashId || r.washItemId,
            statusHistory: [
              ...hist,
              { status: nextStatus, timestamp: new Date().toISOString(), note: customNote }
            ]
          };
        }
        return r;
      });

      setLevaETrazRequests(updatedList);
      localStorage.setItem(`saas_tenant_leva_e_traz_${tenant.id}`, JSON.stringify(updatedList));

      await updateLevaETrazStatusInFirestore(tenant.id, req.id, nextStatus, {
        washItemId: linkedWashId,
        notes: customNote
      });

      // Sincroniza agendamento correspondente se existir
      if (req.appointmentId) {
        const appStatus = nextStatus === 'no_patio' 
          ? 'Em Lavagem' 
          : nextStatus === 'entregue' || nextStatus === 'concluido'
          ? 'Concluído' 
          : nextStatus === 'cancelado'
          ? 'Cancelado'
          : 'Aprovado';
        
        await updateAppointmentStatusInFirestore(tenant.id, req.appointmentId, appStatus as any);
        setAppointments(prev => prev.map(a => a.id === req.appointmentId ? {
          ...a,
          status: appStatus as any,
          levaETrazStatus: nextStatus
        } : a));
      }

      const statusLabels: Record<LevaETrazStatus, string> = {
        solicitado: 'Solicitado',
        motorista_a_caminho: 'Motorista a Caminho da Coleta',
        coletado: 'Veículo Coletado',
        no_patio: 'No Pátio / Em Lavagem',
        concluido: 'Lavagem Concluída',
        em_entrega: 'Motorista a Caminho da Entrega',
        entregue: 'Entregue com Sucesso',
        cancelado: 'Cancelado'
      };

      showToast(
        nextStatus === 'entregue'
          ? `✅ Leva e Traz entregue e lançado no Fluxo de Caixa!`
          : `✅ Leva e Traz atualizado para: "${statusLabels[nextStatus]}"`
      );

      sendClientVehicleStatusPushNotification({
        tenantId: tenant.id,
        tenantName: tenant.nomeFantasia || tenant.name,
        clientName: req.clientName,
        clientPhone: req.clientPhone,
        clientEmail: req.clientEmail,
        vehicle: req.vehicle,
        plate: req.plate,
        service: req.service,
        newStatus: nextStatus,
        source: 'leva_e_traz'
      }).catch(console.error);
    } catch (err) {
      console.error('handleAdvanceLevaStatus error:', err);
      showToast('⚠️ Erro ao atualizar status do Leva e Traz.');
    }
  };

  const handleAssignLevaDriver = async (requestId: string, driverName: string) => {
    try {
      const staff = staffList.find(s => s.name === driverName);
      const updatedList = levaETrazRequests.map(r => {
        if (r.id === requestId) {
          return {
            ...r,
            driverName,
            driverId: staff?.id
          };
        }
        return r;
      });

      setLevaETrazRequests(updatedList);
      localStorage.setItem(`saas_tenant_leva_e_traz_${tenant.id}`, JSON.stringify(updatedList));

      await updateLevaETrazStatusInFirestore(tenant.id, requestId, levaETrazRequests.find(r => r.id === requestId)?.status || 'solicitado', {
        driverName,
        driverId: staff?.id
      });

      showToast(`👤 Motorista "${driverName}" designado para o serviço!`);
    } catch (err) {
      console.error('handleAssignLevaDriver error:', err);
    }
  };

  const handleOpenGoogleMapsRoute = (addr: LevaETrazAddress) => {
    const query = [
      addr.street,
      addr.number,
      addr.neighborhood,
      addr.city,
      addr.state
    ].filter(Boolean).join(', ');

    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    window.open(url, '_blank');
  };

  const handleSendLevaStatusWhatsApp = (req: LevaETrazRequest) => {
    if (!req.clientPhone) {
      showToast('⚠️ Cliente sem telefone cadastrado.');
      return;
    }

    const companyName = tenant.nomeFantasia || tenant.name;
    const cleanPhone = req.clientPhone.replace(/\D/g, '');

    let msg = '';
    switch (req.status) {
      case 'solicitado':
        msg = `Olá ${req.clientName}! 👋 Recebemos sua solicitação de Leva e Traz para o veículo ${req.vehicle} (${req.plate}) aqui no ${companyName}. Já estamos organizando a rota de coleta.`;
        break;
      case 'motorista_a_caminho':
        msg = `Olá ${req.clientName}! 🚗 Nosso motorista ${req.driverName ? `(${req.driverName}) ` : ''}do ${companyName} acabou de sair e está a caminho do seu endereço para buscar seu ${req.vehicle}.`;
        break;
      case 'coletado':
        msg = `Olá ${req.clientName}! 🛣️ Seu veículo ${req.vehicle} foi coletado com segurança e já está a caminho do nosso lava-jato ${companyName}.`;
        break;
      case 'no_patio':
        msg = `Olá ${req.clientName}! 🧼 Seu veículo ${req.vehicle} acabou de chegar no pátio do ${companyName} e já está em processo de lavagem e higienização!`;
        break;
      case 'concluido':
        msg = `Olá ${req.clientName}! ✨ A lavagem do seu ${req.vehicle} foi CONCLUÍDA com sucesso e está impecável! Estamos preparando a saída para entrega.`;
        break;
      case 'em_entrega':
        msg = `Olá ${req.clientName}! 🚚 O motorista ${req.driverName ? `(${req.driverName}) ` : ''}do ${companyName} está a caminho do seu endereço para entregar seu ${req.vehicle} limpinho e brilhando!`;
        break;
      case 'entregue':
        msg = `Olá ${req.clientName}! 🏡 Seu veículo ${req.vehicle} foi entregue com sucesso pelo ${companyName}! Muito obrigado pela confiança e preferência.`;
        break;
      default:
        msg = `Olá ${req.clientName}! Aqui é do lava-jato ${companyName} sobre o serviço de Leva e Traz do seu ${req.vehicle}.`;
    }

    const waUrl = `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
  };


  const handleSellProduct = (prod: ProductItem) => {
    if (prod.stock <= 0) {
      showToast(`Sem estoque disponível para ${prod.name}!`);
      return;
    }

    setProducts(prev => prev.map(p => {
      if (p.id === prod.id) {
        return { ...p, stock: p.stock - 1 };
      }
      return p;
    }));
    showToast(`Venda registrada! 1x ${prod.name} (R$ ${prod.unitPrice?.toFixed(2)})`);
  };

  const handleAddProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName) return;

    const item: ProductItem = {
      id: `p-${Date.now()}`,
      name: newProdName,
      category: newProdCategory,
      stock: Number(newProdStock),
      minStock: 3,
      unitPrice: newProdCategory === 'venda' ? Number(newProdPrice) : undefined,
      unit: newProdCategory === 'venda' ? 'unidades' : 'frascos'
    };

    setProducts(prev => [...prev, item]);
    setShowNewProductModal(false);
    setNewProdName('');
    showToast(`Produto ${item.name} cadastrado no estoque!`);
  };

  const handleSettleCommissions = () => {
    setStaffList(prev => prev.map(s => ({ ...s, accumulatedCommission: 0 })));
    showToast(`Fechamento financeiro realizado! Todas as comissões pendentes foram pagas.`);
  };

  // Metrics
  const activePatioCount = deduplicateWashItems(washItems.filter(w => w.status !== 'Concluído')).length;
  const completedTodayCount = deduplicateWashItems(washItems.filter(w => w.status === 'Concluído')).length;
  const totalRevenueToday = deduplicateWashItems(washItems).reduce((acc, curr) => acc + curr.price, 0);
  const totalCommissionsPending = staffList.reduce((acc, s) => acc + s.accumulatedCommission, 0);
  const pendingAppointmentsCount = deduplicateAppointments(appointments).filter(a => a.status === 'Pendente').length;

  // Métricas de Lembretes 24h
  const reminderMetrics = useMemo(() => {
    const now = new Date();
    let dueCount = 0;
    let sentCount = 0;
    let scheduledCount = 0;

    deduplicateAppointments(appointments).forEach(app => {
      if (app.status === 'Cancelado' || app.status === 'Concluído') return;
      if (app.reminder24hSent) {
        sentCount++;
        return;
      }
      const analysis = getAppointmentReminderAnalysis(app, now);
      if (analysis.status === 'due') dueCount++;
      else if (analysis.status === 'scheduled') scheduledCount++;
    });

    return { dueCount, sentCount, scheduledCount };
  }, [appointments]);

  const menuItems = [
    {
      id: 'fila' as const,
      label: 'Fila de Lavagem',
      icon: Kanban,
      badge: activePatioCount > 0 ? `${activePatioCount}` : undefined,
      badgeColor: 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
    },
    {
      id: 'agendamentos' as const,
      label: 'Agendamentos',
      icon: CalendarCheck,
      badge: pendingAppointmentsCount > 0 
        ? `${pendingAppointmentsCount}`
        : '0',
      badgeColor: pendingAppointmentsCount > 0
        ? 'bg-amber-500 text-slate-950 font-black animate-pulse'
        : 'bg-slate-800 text-slate-400'
    },
    {
      id: 'lembretes-24h' as const,
      label: 'Lembretes 24h & Notificações',
      icon: BellRing,
      badge: reminderMetrics.dueCount > 0 ? `${reminderMetrics.dueCount} disparo` : undefined,
      badgeColor: 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
    },
    {
      id: 'leva-e-traz' as const,
      label: 'Leva e Traz',
      icon: Truck,
      badge: activeLevaETrazCount > 0 ? `${activeLevaETrazCount}` : undefined,
      badgeColor: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
    },
    {
      id: 'caixa' as const,
      label: 'Controle de Caixa',
      icon: Wallet,
      badge: 'Fluxo',
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
    },
    {
      id: 'vendas' as const,
      label: 'Vendas & Balcão (PDV)',
      icon: ShoppingBag,
      badge: 'Loja',
      badgeColor: 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
    },
    {
      id: 'clientes' as const,
      label: 'Clientes & Balcão',
      icon: Users,
      badgeColor: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
    },
    {
      id: 'totem' as const,
      label: 'Totem de Autoatendimento',
      icon: Tablet,
      badge: 'Tablet',
      badgeColor: 'bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold'
    },
    {
      id: 'banners-app' as const,
      label: 'Banners & Ofertas do App',
      icon: Sparkles,
      badge: 'App',
      badgeColor: 'bg-pink-500/20 text-pink-300 border border-pink-500/30 font-bold'
    },
    {
      id: 'troca-oleo' as const,
      label: 'Troca de Óleo',
      icon: Fuel,
    },
    {
      id: 'historico-lavagem' as const,
      label: 'Histórico de Lavagem',
      icon: History,
      badge: deduplicateWashHistory(washHistory).length > 0 ? `${deduplicateWashHistory(washHistory).length}` : undefined,
      badgeColor: 'bg-slate-800 text-slate-300'
    },
    {
      id: 'produtos' as const,
      label: 'Insumos & Estoque Interno',
      icon: Package,
      badge: products.filter(p => p.category === 'insumo' && p.stock <= p.minStock).length > 0 
        ? `${products.filter(p => p.category === 'insumo' && p.stock <= p.minStock).length} repor`
        : undefined,
      badgeColor: 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
    },
    {
      id: 'comissoes' as const,
      label: '% Comissões da Equipe',
      icon: Percent,
      badge: totalCommissionsPending > 0 ? `R$ ${totalCommissionsPending.toFixed(0)}` : undefined,
      badgeColor: 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
    },
    {
      id: 'configuracoes-empresa' as const,
      label: 'Configurações da Empresa',
      icon: Building2
    },
    {
      id: 'comprar-vitalicio' as const,
      label: tenant.plan === 'Vitalicio' ? 'Licença Vitalícia' : 'Comprar o Aplicativo',
      icon: Sparkles,
      badge: tenant.plan === 'Vitalicio' ? 'VITALÍCIO' : 'R$ 4.000',
      badgeColor: tenant.plan === 'Vitalicio' 
        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-black' 
        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-black'
    }
  ];

  return (
    <div className="bg-[#020617] text-[#f8fafc] min-h-screen flex font-sans">
      
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-bounce">
          <CheckCircle className="w-5 h-5 text-white" />
          <span className="text-xs font-bold">{toastMessage}</span>
        </div>
      )}

      {/* Toast Notificação Visual de Novo Cliente no Totem com Som e Atalho Direto */}
      {totemToast && (
        <div className="fixed top-4 right-4 z-50 max-w-sm w-full bg-gradient-to-r from-purple-950/95 via-[#0f172a]/95 to-indigo-950/95 border-2 border-purple-500/80 rounded-2xl p-4 shadow-2xl backdrop-blur-md animate-bounce flex items-start gap-3.5 shadow-purple-600/30">
          <div className="w-10 h-10 rounded-xl bg-purple-600/30 text-purple-400 border border-purple-500/40 flex items-center justify-center shrink-0 shadow-lg shadow-purple-600/30">
            <Tablet className="w-5 h-5 text-purple-300" />
          </div>
          
          <div className="flex-1 overflow-hidden">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded-full border border-purple-500/30 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-purple-300" />
                Novo Cliente no Totem
              </span>
              <button 
                onClick={() => setTotemToast(null)}
                className="text-slate-400 hover:text-white p-0.5 rounded transition cursor-pointer"
                title="Fechar notificação"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <h4 className="text-sm font-bold text-white mt-1.5 truncate">
              {totemToast.clientName}
            </h4>
            
            {(totemToast.vehicle || totemToast.phone) && (
              <p className="text-xs text-slate-300 mt-0.5 truncate">
                {totemToast.vehicle ? `🚗 ${totemToast.vehicle}` : ''} {totemToast.phone ? `• ${totemToast.phone}` : ''}
              </p>
            )}

            <div className="mt-2.5">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('clientes');
                  setTotemToast(null);
                }}
                className="w-full py-1.5 px-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md shadow-purple-600/30 cursor-pointer active:scale-98"
              >
                <span>Ver em Clientes & Balcão</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= 1. GAVETA MOBILE (MENU LATERAL NO CELULAR) ================= */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div 
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="relative flex flex-col w-72 max-w-[85vw] bg-[#020617] border-r border-[#1e293b] p-5 z-10 h-full overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-[#1e293b] mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-lg text-white shadow-md shadow-blue-600/30 overflow-hidden shrink-0 border border-blue-500/30">
                  {tenant.logoUrl ? (
                    <img src={tenant.logoUrl} alt={tenant.name} className="w-full h-full object-cover" />
                  ) : (
                    <Car className="w-5 h-5" />
                  )}
                </div>
                <div className="overflow-hidden">
                  <h2 className="text-sm font-bold text-[#f8fafc] truncate">{tenant.nomeFantasia || tenant.name}</h2>
                  <span className="text-[10px] text-blue-400 font-mono block truncate">{tenant.domain}</span>
                </div>
              </div>
              <button 
                onClick={() => setIsMobileMenuOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Menu Items Mobile */}
            <nav className="space-y-1 flex-1">
              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Menu de Gestão
              </div>
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl font-medium text-xs transition text-left ${
                      isActive
                        ? 'bg-blue-600 text-white font-bold shadow-sm'
                        : 'text-slate-400 hover:bg-[#0f172a] hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                      <span className="truncate">{item.label}</span>
                    </div>
                    {item.badge !== undefined && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${isActive ? 'bg-white/20 text-white' : item.badgeColor}`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            <div className="pt-4 border-t border-[#1e293b] space-y-2 mt-4">
              {(activeTab === 'fila' || activeTab === 'agendamentos') && (
                <button
                  onClick={() => {
                    setShowNewWashModal(true);
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Novo Veículo no Pátio
                </button>
              )}
              {onExitImpersonation && (
                <button
                  onClick={onExitImpersonation}
                  className="w-full bg-[#0f172a] hover:bg-rose-500/10 border border-rose-500/30 text-rose-300 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition"
                >
                  <LogOut className="w-4 h-4 text-rose-400" /> Sair / Trocar Perfil
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= 2. MENU LATERAL DESKTOP (STICKY LEFT SIDEBAR RECOLHÍVEL) ================= */}
      <aside 
        className={`hidden md:flex flex-col bg-[#020617] border-r border-[#1e293b] h-screen sticky top-0 shrink-0 z-30 transition-all duration-300 ease-in-out ${
          isSidebarCollapsed ? 'w-20' : 'w-64 lg:w-72'
        }`}
      >
        
        {/* Topo do Menu Lateral: Logo & Identidade do Lava-Jato com Botão de Recolher/Expandir */}
        <div className={`border-b border-[#1e293b] transition-all duration-300 ${isSidebarCollapsed ? 'p-3 flex flex-col items-center gap-2' : 'p-4 sm:p-5'}`}>
          <div className={`flex items-center w-full ${isSidebarCollapsed ? 'flex-col gap-2 justify-center' : 'justify-between gap-2.5'}`}>
            <div className="flex items-center gap-3 overflow-hidden min-w-0">
              <div 
                onClick={isSidebarCollapsed ? toggleSidebar : undefined}
                className={`w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-white shadow-md shadow-blue-600/30 overflow-hidden shrink-0 border border-blue-500/30 ${
                  isSidebarCollapsed ? 'cursor-pointer hover:scale-105 transition' : ''
                }`}
                title={tenant.nomeFantasia || tenant.name}
              >
                {tenant.logoUrl ? (
                  <img src={tenant.logoUrl} alt={tenant.name} className="w-full h-full object-cover" />
                ) : (
                  <Car className="w-5 h-5" />
                )}
              </div>

              {!isSidebarCollapsed && (
                <div className="overflow-hidden flex-1 animate-fade-in min-w-0">
                  <h1 className="text-sm font-bold text-[#f8fafc] truncate leading-tight" title={tenant.nomeFantasia || tenant.name}>
                    {tenant.nomeFantasia || tenant.name}
                  </h1>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                      tenant.plan === 'Vitalicio'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-black'
                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    }`}>
                      {tenant.plan === 'Vitalicio' ? '👑 Vitalício' : tenant.plan}
                    </span>
                    <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.2 rounded font-mono truncate max-w-[100px]" title={tenant.domain}>
                      {tenant.domain}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Botão de Recolher/Expandir no Topo do Menu Lateral */}
            <button
              onClick={toggleSidebar}
              className={`p-1.5 rounded-lg bg-[#0f172a] hover:bg-slate-800 text-slate-400 hover:text-white border border-[#1e293b] transition cursor-pointer shrink-0 ${
                isSidebarCollapsed ? 'w-8 h-8 flex items-center justify-center mt-1' : ''
              }`}
              title={isSidebarCollapsed ? "Expandir Menu Lateral (Mais espaço de visualização)" : "Recolher Menu Lateral (Mais espaço de tela)"}
            >
              {isSidebarCollapsed ? (
                <ChevronRight className="w-4 h-4 text-blue-400" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Banner de Aquisição do App / Licença Vitalícia */}
        {tenant.plan !== 'Vitalicio' && (
          isSidebarCollapsed ? (
            <div className="px-2 pt-2 flex justify-center">
              <button
                onClick={() => setActiveTab('comprar-vitalicio')}
                className="w-10 h-10 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 flex items-center justify-center shadow-md hover:scale-105 transition cursor-pointer"
                title="Comprar o Aplicativo Definitivo (Plano Vitalício R$ 4.000)"
              >
                <Sparkles className="w-4 h-4 text-slate-950 animate-pulse" />
              </button>
            </div>
          ) : (
            <div className="mx-3 mt-3 mb-1 p-3 bg-gradient-to-br from-amber-950/30 via-slate-900 to-amber-950/20 border border-amber-500/40 rounded-xl relative overflow-hidden group">
              <div className="flex items-center gap-1.5 text-amber-300 font-bold text-xs mb-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                <span>Comprar o Aplicativo</span>
              </div>
              <p className="text-[10px] text-slate-300 leading-tight mb-2.5">
                Livre-se de mensalidades por <strong>R$ 4.000,00</strong> em pagamento único definitivo.
              </p>
              <button
                onClick={() => setActiveTab('comprar-vitalicio')}
                className="w-full bg-gradient-to-r from-amber-500 to-yellow-400 hover:brightness-105 text-slate-950 font-black text-[11px] py-2 px-2 rounded-lg shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-slate-950" />
                Comprar por R$ 4.000
              </button>
            </div>
          )
        )}

        {/* Links de Navegação do Menu Lateral */}
        <div className={`flex-1 overflow-y-auto space-y-1 ${isSidebarCollapsed ? 'p-2' : 'p-3'}`}>
          {!isSidebarCollapsed && (
            <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Menu Operacional
            </div>
          )}

          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                title={isSidebarCollapsed ? item.label : undefined}
                className={`w-full flex items-center rounded-xl font-medium text-xs transition group cursor-pointer relative ${
                  isSidebarCollapsed 
                    ? 'justify-center p-3' 
                    : 'justify-between gap-3 px-3 py-2.5 text-left'
                } ${
                  isActive
                    ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/20'
                    : 'text-slate-400 hover:bg-[#0f172a] hover:text-slate-200'
                }`}
              >
                <div className={`flex items-center gap-2.5 ${isSidebarCollapsed ? 'justify-center' : 'truncate'}`}>
                  <Icon className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`} />
                  {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
                </div>
                {item.badge !== undefined && (
                  isSidebarCollapsed ? (
                    <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-[#020617]" title={`${item.badge} pendente(s)`} />
                  ) : (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${isActive ? 'bg-white/20 text-white' : item.badgeColor}`}>
                      {item.badge}
                    </span>
                  )
                )}
              </button>
            );
          })}
        </div>

        {/* Botão de Ação Rápida no Menu Lateral */}
        <div className={`border-t border-[#1e293b] bg-[#020617]/50 ${isSidebarCollapsed ? 'p-2 space-y-2' : 'p-4 space-y-2.5'}`}>
          {(activeTab === 'fila' || activeTab === 'agendamentos') && (
            <button
              onClick={() => setShowNewWashModal(true)}
              title="Novo Veículo no Pátio"
              className={`w-full bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center justify-center transition shadow-md shadow-blue-600/20 cursor-pointer ${
                isSidebarCollapsed ? 'p-2.5' : 'py-2.5 px-3 gap-2'
              }`}
            >
              <Plus className="w-4 h-4 shrink-0" />
              {!isSidebarCollapsed && <span>Novo Veículo no Pátio</span>}
            </button>
          )}

          {!isSidebarCollapsed && (
            <PWAInstallButton compact variant="outline" className="w-full justify-center" />
          )}

          {onExitImpersonation && (
            <button
              onClick={onExitImpersonation}
              title="Sair / Trocar Perfil"
              className={`w-full bg-[#0f172a] hover:bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl text-xs font-bold flex items-center justify-center transition cursor-pointer ${
                isSidebarCollapsed ? 'p-2.5' : 'py-2 px-3 gap-2'
              }`}
            >
              <LogOut className="w-4 h-4 text-rose-400 shrink-0" />
              {!isSidebarCollapsed && <span>Sair / Trocar Perfil</span>}
            </button>
          )}
        </div>
      </aside>

      {/* ================= 3. CONTEÚDO PRINCIPAL (ÁREA DIREITA) ================= */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        
        {/* Header Superior da Área de Conteúdo */}
        <header className="bg-[#0f172a] border-b border-[#1e293b] px-4 sm:px-6 py-3.5 sticky top-0 z-20">
          <div className="flex items-center justify-between gap-4">
            
            {/* Lado Esquerdo: Botão Mobile Hamburguer + Botão Desktop Recolher/Expandir + Título da Aba Ativa */}
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="md:hidden text-slate-400 hover:text-white p-2 rounded-lg bg-[#020617] border border-[#1e293b] cursor-pointer"
                title="Abrir Menu Lateral"
              >
                <Menu className="w-5 h-5" />
              </button>

              <button
                onClick={toggleSidebar}
                className="hidden md:flex text-slate-400 hover:text-white p-2 rounded-lg bg-[#020617] border border-[#1e293b] hover:border-slate-700 transition cursor-pointer"
                title={isSidebarCollapsed ? "Expandir Menu Lateral (Mais espaço)" : "Recolher Menu Lateral"}
                aria-label={isSidebarCollapsed ? "Expandir Menu Lateral" : "Recolher Menu Lateral"}
              >
                {isSidebarCollapsed ? (
                  <PanelLeftOpen className="w-4 h-4 text-blue-400" />
                ) : (
                  <PanelLeftClose className="w-4 h-4 text-slate-400 hover:text-white" />
                )}
              </button>

              <div>
                <h2 className="text-base sm:text-lg font-bold text-[#f8fafc] flex items-center gap-2">
                  {activeTab === 'fila' && <><Kanban className="w-5 h-5 text-blue-400" /> Fila de Lavagem & Operação de Pátio</>}
                  {activeTab === 'agendamentos' && <><CalendarCheck className="w-5 h-5 text-blue-400" /> Gestão de Agendamentos</>}
                  {activeTab === 'lembretes-24h' && <><BellRing className="w-5 h-5 text-amber-400" /> Central de Notificações & Lembretes 24h</>}
                  {activeTab === 'leva-e-traz' && <><Truck className="w-5 h-5 text-cyan-400" /> Gestão Operacional de Leva e Traz (Valet & Delivery)</>}
                  {activeTab === 'caixa' && <><Wallet className="w-5 h-5 text-emerald-400" /> Controle de Caixa & Fluxo Financeiro</>}
                  {activeTab === 'vendas' && <><ShoppingBag className="w-5 h-5 text-amber-400" /> Loja do Balcão & Vendas (PDV)</>}
                  {activeTab === 'clientes' && <><Users className="w-5 h-5 text-cyan-400" /> Clientes & Balcão</>}
                  {activeTab === 'totem' && <><Tablet className="w-5 h-5 text-purple-400" /> Totem de Autoatendimento (Tablet)</>}
                  {activeTab === 'historico-lavagem' && <><History className="w-5 h-5 text-blue-400" /> Histórico de Lavagem</>}
                  {activeTab === 'produtos' && <><Package className="w-5 h-5 text-blue-400" /> Insumos & Estoque de Uso Interno</>}
                  {activeTab === 'comissoes' && <><Percent className="w-5 h-5 text-blue-400" /> % Comissões da Equipe</>}
                  {activeTab === 'configuracoes-empresa' && <><Building2 className="w-5 h-5 text-blue-400" /> Configurações da Empresa</>}
                  {activeTab === 'saas-config' && <><Sliders className="w-5 h-5 text-blue-400" /> Módulos SaaS Root</>}
                  {activeTab === 'portal-cliente' && <><Sparkles className="w-5 h-5 text-amber-400" /> Portal do Cliente (Visão Pública)</>}
                  {activeTab === 'comprar-vitalicio' && <><Sparkles className="w-5 h-5 text-amber-400" /> {tenant.plan === 'Vitalicio' ? 'Certificado de Licença Vitalícia' : 'Comprar o Aplicativo Definitivo (Plano Vitalício)'}</>}
                </h2>
                <p className="text-[11px] text-slate-400 hidden sm:flex items-center gap-2">
                  <span>{tenant.nomeFantasia || tenant.name}</span>
                  {showSyncBadge && (
                    <>
                      <span className="text-slate-600">·</span>
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold text-[10px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Celular ⇄ Computador Sincronizados (Nuvem)
                      </span>
                    </>
                  )}
                </p>
              </div>
            </div>

            {/* Lado Direito: KPIs rápidos no Topo e Botão Novo Veículo */}
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden lg:flex items-center gap-3 bg-[#020617] px-3 py-1.5 rounded-xl border border-[#1e293b] text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                  <span className="text-slate-400">Pátio:</span>
                  <strong className="text-blue-300">{activePatioCount}</strong>
                </div>
                <span className="text-slate-700">|</span>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span className="text-slate-400">Hoje:</span>
                  <strong className="text-emerald-300">{completedTodayCount}</strong>
                </div>
                <span className="text-slate-700">|</span>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
                  <span className="text-slate-400">Faturamento:</span>
                  <strong className="text-slate-100">R$ {totalRevenueToday.toLocaleString('pt-BR')}</strong>
                </div>
              </div>

              {/* Botão de Controle Rápido de Notificações Push (Mesmo com Aba Fechada) */}
              <button
                onClick={handleTogglePushNotifications}
                disabled={isRequestingPush}
                title={
                  isPushSubscribed
                    ? 'Alertas Push Ativos no Navegador (Clique para pausar)'
                    : 'Ativar Alertas Push no Navegador (Mesmo com Painel Fechado)'
                }
                className={`px-2.5 sm:px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border ${
                  isPushSubscribed
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                    : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                {isPushSubscribed ? (
                  <>
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <BellRing className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="hidden md:inline">Push Ativo</span>
                  </>
                ) : (
                  <>
                    <Bell className="w-3.5 h-3.5 text-slate-400" />
                    <span className="hidden md:inline">{isRequestingPush ? 'Ativando...' : 'Ativar Push'}</span>
                  </>
                )}
              </button>

              {(activeTab === 'fila' || activeTab === 'agendamentos') && (
                <button
                  onClick={() => setShowNewWashModal(true)}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-3 sm:px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-sm shadow-blue-600/30 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">Novo Veículo</span>
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Quick Operational KPI Bar */}
        <div className="px-4 sm:px-6 pt-4 max-w-7xl w-full mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#0f172a] p-3 rounded-xl border border-[#1e293b] flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Pátio Ativo</span>
                <span className="text-base sm:text-lg font-bold text-blue-400">{activePatioCount} Veículos</span>
              </div>
              <Car className="w-5 h-5 text-blue-400 opacity-60" />
            </div>

            <div className="bg-[#0f172a] p-3 rounded-xl border border-[#1e293b] flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Concluídos Hoje</span>
                <span className="text-base sm:text-lg font-bold text-emerald-400">{completedTodayCount} Serviços</span>
              </div>
              <CheckCircle className="w-5 h-5 text-emerald-400 opacity-60" />
            </div>

            <div className="bg-[#0f172a] p-3 rounded-xl border border-[#1e293b] flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Faturamento Estimado</span>
                <span className="text-base sm:text-lg font-bold text-slate-100">R$ {totalRevenueToday.toLocaleString('pt-BR')}</span>
              </div>
              <DollarSign className="w-5 h-5 text-emerald-400 opacity-60" />
            </div>

            <div className="bg-[#0f172a] p-3 rounded-xl border border-[#1e293b] flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Comissões a Pagar</span>
                <span className="text-base sm:text-lg font-bold text-indigo-400">R$ {totalCommissionsPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
              <Percent className="w-5 h-5 text-indigo-400 opacity-60" />
            </div>
          </div>
        </div>

        {/* Main Area Body */}
        <main className="p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-6 flex-1">

        {/* ================= ALERTA AO GERENTE DA EMPRESA: SOLICITAÇÃO DE RESGATE ================= */}
        {redemptionData?.requested && (
          <div className="bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-transparent border border-amber-500/40 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-2xl animate-bounce">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-amber-500 text-slate-950 rounded-xl font-black shrink-0 shadow-lg">
                <Gift className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider bg-amber-500 text-slate-950 px-2 py-0.5 rounded">
                    🚨 Notificação ao Gerente da Empresa
                  </span>
                  <span className="text-xs text-amber-300/80 font-mono font-bold">{redemptionData.date}</span>
                </div>
                <h3 className="font-bold text-slate-100 text-base mt-1">
                  O cliente <strong className="text-amber-400">{redemptionData.clientName}</strong> completou 10 carimbos e solicitou o RESGATE DE 1 LAVAGEM GRÁTIS!
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Veículo: <strong className="text-slate-100">{redemptionData.vehicle}</strong> · Contato: <strong className="text-slate-100">{redemptionData.clientPhone}</strong>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0 self-end md:self-auto">
              <button
                type="button"
                onClick={handleApproveRewardRedemption}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-5 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 shadow-xl shadow-amber-500/20 transition cursor-pointer"
              >
                <CheckCircle className="w-4 h-4 fill-slate-950 text-amber-500" />
                <span>Aprovar & Enviar Lavagem Cortesia R$ 0,00 ao Pátio</span>
              </button>
            </div>
          </div>
        )}
        
        {/* ================= ABA 1: FILA DE LAVAGEM (KANBAN) ================= */}
        {activeTab === 'fila' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0f172a] border border-[#1e293b] p-4 rounded-xl">
              <div>
                <h2 className="text-base font-bold text-[#f8fafc] flex items-center gap-2">
                  <Kanban className="w-5 h-5 text-blue-400" />
                  Fila de Lavagem & Serviços em Andamento
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Arraste ou troque os status dos veículos para lançar a comissão do colaborador automaticamente ao concluir.
                </p>
              </div>

              <button
                onClick={() => setShowNewWashModal(true)}
                className="bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition self-start sm:self-auto"
              >
                <PlusCircle className="w-4 h-4" /> Adicionar Veículo
              </button>
            </div>

            {/* Kanban 3 Columns */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* COLUNA 1: Aguardando */}
              <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-4 flex flex-col gap-3">
                <div className="flex justify-between items-center pb-2 border-b border-[#1e293b]">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span> Aguardando na Fila ({washItems.filter(w => w.status === 'Aguardando').length})
                  </span>
                </div>

                {washItems.filter(w => w.status === 'Aguardando').length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-xs border border-dashed border-[#1e293b] rounded-lg">
                    Nenhum veículo aguardando no momento.
                  </div>
                ) : (
                  washItems.filter(w => w.status === 'Aguardando').map(item => (
                    <div key={item.id} className="bg-[#020617] border border-[#1e293b] rounded-lg p-4 space-y-3 hover:border-slate-700 transition">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-xs font-bold bg-[#0f172a] text-slate-200 px-2 py-0.5 rounded border border-[#1e293b] font-mono">
                            {item.plate}
                          </span>
                          <h4 className="font-semibold text-slate-100 mt-1.5 text-sm">{item.vehicle}</h4>
                          <p className="text-xs text-blue-400 font-medium">{item.service}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded">
                            R$ {item.price.toFixed(2)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteWashItem(item.id)}
                            className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition cursor-pointer"
                            title="Remover veículo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="text-xs text-slate-400 flex items-center justify-between">
                        <span className="flex items-center gap-1"><User className="w-3.5 h-3.5 text-slate-500" /> {item.clientName}</span>
                        <span className="text-[10px] text-slate-500">{item.createdAt}</span>
                      </div>

                      {/* Lavador Selector */}
                      <div className="pt-2 border-t border-[#1e293b] flex items-center justify-between text-xs gap-2">
                        <label className="text-[11px] text-slate-400 font-medium">Lavador:</label>
                        <select
                          value={item.lavadorId || ''}
                          onChange={(e) => handleAssignLavador(item.id, e.target.value)}
                          className="bg-[#0f172a] border border-[#1e293b] text-xs text-slate-200 rounded px-2 py-1 focus:outline-none focus:border-blue-500 cursor-pointer font-medium"
                        >
                          <option value="">Selecionar Lavador...</option>
                          {staffList.map(s => (
                            <option key={s.id} value={s.id}>{s.name} ({s.defaultCommission}%)</option>
                          ))}
                        </select>
                      </div>

                      <button
                        onClick={() => handleMoveStatus(item.id, 'Em Execução')}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-1.5 rounded transition flex items-center justify-center gap-1 mt-2"
                      >
                        Iniciar Lavagem <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* COLUNA 2: Em Execução */}
              <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-4 flex flex-col gap-3">
                <div className="flex justify-between items-center pb-2 border-b border-[#1e293b]">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse"></span> Em Execução ({washItems.filter(w => w.status === 'Em Execução').length})
                  </span>
                </div>

                {washItems.filter(w => w.status === 'Em Execução').length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-xs border border-dashed border-[#1e293b] rounded-lg">
                    Nenhum serviço em lavagem ativamente.
                  </div>
                ) : (
                  washItems.filter(w => w.status === 'Em Execução').map(item => (
                    <div key={item.id} className="bg-[#020617] border border-[#1e293b] border-l-4 border-l-blue-500 rounded-lg p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-xs font-bold bg-[#0f172a] text-slate-200 px-2 py-0.5 rounded border border-[#1e293b] font-mono">
                            {item.plate}
                          </span>
                          <h4 className="font-semibold text-slate-100 mt-1.5 text-sm">{item.vehicle}</h4>
                          <p className="text-xs text-blue-400 font-medium">{item.service}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded">
                            R$ {item.price.toFixed(2)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteWashItem(item.id)}
                            className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition cursor-pointer"
                            title="Remover veículo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <p className="text-xs text-slate-400"><User className="w-3.5 h-3.5 inline mr-1 text-slate-500" /> Cliente: {item.clientName}</p>

                      <div className="pt-2 border-t border-[#1e293b] flex items-center justify-between text-xs">
                        <span className="text-slate-400">
                          Lavador: <strong className="text-slate-200">{item.lavadorName || 'Não designado'}</strong>
                        </span>
                        <span className="text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded">
                          Comissão: R$ {item.commissionAmount.toFixed(2)}
                        </span>
                      </div>

                      <button
                        onClick={() => handleMoveStatus(item.id, 'Concluído')}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2 rounded transition flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-600/30"
                      >
                        <CheckCircle className="w-4 h-4" /> Finalizar & Creditar Comissão
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* COLUNA 3: Concluídos Hoje */}
              <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-4 flex flex-col gap-3">
                <div className="flex justify-between items-center pb-2 border-b border-[#1e293b]">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span> Concluídos Hoje ({deduplicateWashItems(washItems.filter(w => w.status === 'Concluído')).length})
                  </span>
                </div>

                {deduplicateWashItems(washItems.filter(w => w.status === 'Concluído')).length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-xs border border-dashed border-[#1e293b] rounded-lg">
                    Nenhum serviço concluído hoje ainda.
                  </div>
                ) : (
                  deduplicateWashItems(washItems.filter(w => w.status === 'Concluído')).map(item => (
                    <div key={item.id} className="bg-[#020617]/70 border border-[#1e293b] rounded-lg p-4 space-y-2 opacity-90">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-xs font-bold bg-[#0f172a] text-slate-400 px-2 py-0.5 rounded font-mono">
                            {item.plate}
                          </span>
                          <h4 className="font-semibold text-slate-300 mt-1">{item.vehicle}</h4>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-slate-400">R$ {item.price.toFixed(2)}</span>
                          <button
                            type="button"
                            onClick={() => {
                              // 🔍 Busca no histórico se já existe o registro de conclusão com a data e horário reais
                              const histMatch = deduplicateWashHistory(washHistory).find(h => 
                                h.id === item.id || 
                                h.id === `wh-${item.id.replace(/[^a-zA-Z0-9_-]/g, '_')}` || 
                                (h.plate && item.plate && h.plate.toUpperCase() === item.plate.toUpperCase() && h.service === item.service)
                              );

                              if (histMatch) {
                                setSelectedWashReceipt(histMatch);
                              } else {
                                const realDate = item.completedDate || (item as any).date || (item.createdAt?.includes('/') ? item.createdAt.split(' ')[0] : new Date().toISOString().split('T')[0]);
                                const realCompletedAt = formatReceiptCompletedAt(item.completedAt || item.createdAt, realDate);

                                setSelectedWashReceipt({
                                  id: item.id,
                                  plate: item.plate,
                                  vehicle: item.vehicle,
                                  service: item.service,
                                  price: item.price,
                                  clientName: item.clientName,
                                  clientPhone: item.clientPhone,
                                  lavadorName: item.lavadorName,
                                  commissionRate: item.commissionRate,
                                  commissionAmount: item.commissionAmount,
                                  completedAt: realCompletedAt,
                                  date: realDate,
                                  paymentMethod: item.price === 0 ? 'Cortesia' : 'PIX'
                                });
                              }
                            }}
                            className="p-1 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded transition cursor-pointer"
                            title="Visualizar e Imprimir Recibo"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteWashItem(item.id)}
                            className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition cursor-pointer"
                            title="Remover histórico"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="text-xs text-emerald-400 flex justify-between pt-2 border-t border-[#1e293b]/60">
                        <span>Lavador: {item.lavadorName || 'Geral'}</span>
                        <span className="font-bold flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Comissão Paga!</span>
                      </div>
                    </div>
                  ))
                )}
              </div>

            </div>
          </div>
        )}

        {/* ================= ABA 2: GESTÃO COMPLETA DE AGENDAMENTOS ================= */}
        {activeTab === 'agendamentos' && (
          <div className="space-y-5">
            {/* Header & Ação Rápida */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0f172a] border border-[#1e293b] p-5 rounded-xl">
              <div>
                <h3 className="font-bold text-[#f8fafc] text-base flex items-center gap-2">
                  <CalendarCheck className="w-5 h-5 text-blue-400" />
                  Gestão de Agendamentos da Empresa
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Agendamentos realizados online pelo Portal do Cliente e agendamentos manuais (telefone/WhatsApp/balcão).
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {appointments.filter(a => a.status === 'Concluído' || a.status === 'Cancelado').length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearFinishedAppointments}
                    className="bg-slate-800 hover:bg-rose-950/40 text-slate-300 hover:text-rose-400 border border-slate-700 hover:border-rose-800/50 px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition cursor-pointer"
                    title="Excluir permanentemente do banco de dados todos os agendamentos já finalizados ou cancelados"
                  >
                    <Trash2 className="w-4 h-4 text-rose-400" /> Limpar Finalizados ({appointments.filter(a => a.status === 'Concluído' || a.status === 'Cancelado').length})
                  </button>
                )}
                {appointments.filter(a => a.status === 'Pendente').length > 0 && (
                  <button
                    type="button"
                    onClick={handleApproveAllAppointments}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition shadow-sm shadow-emerald-600/30 cursor-pointer"
                    title="Aprovar todos os agendamentos pendentes para a fila e zerar a lista"
                  >
                    <CheckCircle className="w-4 h-4" /> Enviar Todos para a Fila (Zerar)
                  </button>
                )}
                <button
                  onClick={() => setShowNewAppointmentModal(true)}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition shadow-sm shadow-blue-600/30 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Novo Agendamento
                </button>
              </div>
            </div>

            {/* KPIs de Agendamento */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="bg-[#0f172a] border border-[#1e293b] p-3.5 rounded-xl">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-bold uppercase">Total Geral</span>
                  <Calendar className="w-4 h-4 text-blue-400" />
                </div>
                <div className="text-xl font-black text-slate-100 mt-1">{appointments.length}</div>
              </div>

              <div className="bg-[#0f172a] border border-[#1e293b] p-3.5 rounded-xl">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-bold uppercase">Pendentes</span>
                  <Clock className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-xl font-black text-amber-400 mt-1">
                  {appointments.filter(a => a.status === 'Pendente').length}
                </div>
              </div>

              <div className="bg-[#0f172a] border border-[#1e293b] p-3.5 rounded-xl">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-bold uppercase">No Pátio</span>
                  <Droplet className="w-4 h-4 text-blue-400" />
                </div>
                <div className="text-xl font-black text-blue-400 mt-1">
                  {appointments.filter(a => a.status === 'Aprovado' || a.status === 'Em Lavagem').length}
                </div>
              </div>

              <div className="bg-[#0f172a] border border-[#1e293b] p-3.5 rounded-xl">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-bold uppercase">Finalizados</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-xl font-black text-emerald-400 mt-1">
                  {appointments.filter(a => a.status === 'Concluído').length}
                </div>
              </div>

              <div className="bg-[#0f172a] border border-[#1e293b] p-3.5 rounded-xl">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-bold uppercase">Cancelados</span>
                  <X className="w-4 h-4 text-rose-400" />
                </div>
                <div className="text-xl font-black text-slate-400 mt-1">
                  {appointments.filter(a => a.status === 'Cancelado').length}
                </div>
              </div>
            </div>

            {/* Barra de Filtros e Busca */}
            <div className="bg-[#0f172a] border border-[#1e293b] p-4 rounded-xl flex flex-col md:flex-row gap-3 items-center justify-between">
              {/* Filtro de Status */}
              <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
                {(['todos', 'Pendente', 'Em Lavagem', 'Concluído', 'Cancelado'] as const).map(statusKey => {
                  const label = statusKey === 'todos' 
                    ? 'Todos' 
                    : statusKey === 'Pendente' 
                    ? 'Pendentes' 
                    : statusKey === 'Em Lavagem' 
                    ? 'No Pátio' 
                    : statusKey === 'Concluído' 
                    ? 'Finalizados' 
                    : 'Cancelados';

                  const count = statusKey === 'todos' 
                    ? appointments.length 
                    : statusKey === 'Em Lavagem'
                    ? appointments.filter(a => a.status === 'Em Lavagem' || a.status === 'Aprovado').length
                    : appointments.filter(a => a.status === statusKey).length;

                  return (
                    <button
                      key={statusKey}
                      onClick={() => setAppointmentStatusFilter(statusKey)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                        appointmentStatusFilter === statusKey
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-[#020617] text-slate-400 hover:text-slate-200 border border-[#1e293b]'
                      }`}
                    >
                      {label}
                      <span className="text-[10px] opacity-75">({count})</span>
                    </button>
                  );
                })}

                {reminderFilter !== 'todos' && (
                  <button
                    type="button"
                    onClick={() => setReminderFilter('todos')}
                    className="px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <X className="w-3 h-3" /> Limpar Filtro ({reminderFilter})
                  </button>
                )}
              </div>

              {/* Busca */}
              <div className="relative w-full md:w-72">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar por cliente, placa ou veículo..."
                  value={appointmentSearch}
                  onChange={(e) => setAppointmentSearch(e.target.value)}
                  className="w-full bg-[#020617] border border-[#1e293b] rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Tabela de Agendamentos */}
            <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-[#020617] text-xs uppercase text-slate-400 font-bold border-b border-[#1e293b]">
                    <tr>
                      <th className="py-3.5 px-4">Horário & Data</th>
                      <th className="py-3.5 px-4">Cliente & Contato</th>
                      <th className="py-3.5 px-4">Veículo & Placa</th>
                      <th className="py-3.5 px-4">Serviço & Valor</th>
                      <th className="py-3.5 px-4">Lavador Designado</th>
                      <th className="py-3.5 px-4 text-center">Status</th>
                      <th className="py-3.5 px-4 text-center">Lembrete 24h</th>
                      <th className="py-3.5 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1e293b]">
                    {appointments
                      .filter(app => {
                        if (appointmentStatusFilter !== 'todos') {
                          if (appointmentStatusFilter === 'Em Lavagem') {
                            if (app.status !== 'Em Lavagem' && app.status !== 'Aprovado') return false;
                          } else if (app.status !== appointmentStatusFilter) {
                            return false;
                          }
                        }
                        if (reminderFilter !== 'todos') {
                          const analysis = getAppointmentReminderAnalysis(app);
                          if (reminderFilter === 'due' && analysis.status !== 'due') return false;
                          if (reminderFilter === 'scheduled' && analysis.status !== 'scheduled') return false;
                          if (reminderFilter === 'sent' && !app.reminder24hSent) return false;
                        }
                        if (appointmentSearch.trim()) {
                          const q = appointmentSearch.toLowerCase();
                          const matchClient = (app.clientName || '').toLowerCase().includes(q);
                          const matchPlate = (app.plate || '').toLowerCase().includes(q);
                          const matchVehicle = (app.vehicle || '').toLowerCase().includes(q);
                          const matchService = (app.service || '').toLowerCase().includes(q);
                          if (!matchClient && !matchPlate && !matchVehicle && !matchService) return false;
                        }
                        return true;
                      })
                      .map(app => {
                        const cleanPhone = (app.clientPhone || '').replace(/\D/g, '');
                        const reminderAnalysis = getAppointmentReminderAnalysis(app);
                        const waText = encodeURIComponent(
                          `Olá ${app.clientName}! Confirmamos o seu agendamento no ${tenant.name} para o veículo ${app.vehicle} (${app.plate}) no dia ${app.dateTime}. Serviço: ${app.service}. Qualquer dúvida estamos à disposição!`
                        );

                        return (
                          <tr key={app.id} className="hover:bg-slate-800/20 transition">
                            <td className="py-4 px-4 whitespace-nowrap">
                              <div className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-blue-400" />
                                {app.dateTime}
                              </div>
                              {app.notes && (
                                <div className="text-[10px] text-slate-500 max-w-xs truncate mt-0.5" title={app.notes}>
                                  Obs: {app.notes}
                                </div>
                              )}
                            </td>

                            <td className="py-4 px-4">
                              <div className="font-semibold text-slate-200 text-xs">{app.clientName}</div>
                              {app.clientPhone ? (
                                <a
                                  href={`https://wa.me/55${cleanPhone}?text=${waText}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 font-mono mt-0.5"
                                  title="Enviar mensagem no WhatsApp"
                                >
                                  <MessageSquare className="w-3 h-3" />
                                  {app.clientPhone}
                                </a>
                              ) : (
                                <span className="text-[11px] text-slate-500">Sem telefone</span>
                              )}
                            </td>

                            <td className="py-4 px-4">
                              <div className="font-semibold text-slate-200 text-xs">{app.vehicle}</div>
                              <span className="inline-block mt-0.5 text-[10px] font-mono px-1.5 py-0.5 bg-[#020617] text-slate-300 border border-slate-700 rounded font-bold">
                                {app.plate}
                              </span>
                            </td>

                            <td className="py-4 px-4 text-xs">
                              <div className="font-medium text-slate-200">{app.service}</div>
                              <div className="text-emerald-400 font-bold">R$ {app.price.toFixed(2)}</div>
                              {app.hasLevaETraz && (
                                <span
                                  className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-cyan-500/15 text-cyan-300 border border-cyan-500/30"
                                  title={app.addressSummary || 'Coleta / Entrega Leva & Traz'}
                                >
                                  <Truck className="w-3 h-3" />
                                  Leva & Traz ({app.levaETrazType === 'completo' ? 'Completo' : app.levaETrazType === 'buscar' ? 'Buscar' : 'Entregar'})
                                </span>
                              )}
                            </td>

                            <td className="py-4 px-4">
                              <select
                                value={app.lavadorId || ''}
                                onChange={(e) => {
                                  const selectedId = e.target.value;
                                  const staff = staffList.find(s => s.id === selectedId);
                                  setAppointments(prev => prev.map(a => a.id === app.id ? { 
                                    ...a, 
                                    lavadorId: selectedId,
                                    lavadorName: staff?.name 
                                  } : a));
                                }}
                                className="bg-[#020617] border border-[#1e293b] text-xs text-slate-200 rounded px-2.5 py-1 focus:outline-none cursor-pointer font-medium"
                              >
                                <option value="">Automático (Pátio)</option>
                                {staffList.map(s => (
                                  <option key={s.id} value={s.id}>{s.name} ({s.defaultCommission}%)</option>
                                ))}
                              </select>
                            </td>

                            <td className="py-4 px-4 text-center">
                              {app.status === 'Pendente' ? (
                                <span className="inline-flex items-center gap-1 text-[10px] px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full font-bold">
                                  <Clock className="w-3 h-3" /> Pendente
                                </span>
                              ) : app.status === 'Aprovado' ? (
                                <span className="inline-flex items-center gap-1 text-[10px] px-2.5 py-1 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-full font-bold">
                                  <CheckCircle className="w-3 h-3" /> Confirmado
                                </span>
                              ) : app.status === 'Em Lavagem' ? (
                                <span className="inline-flex items-center gap-1 text-[10px] px-2.5 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full font-bold">
                                  <Droplet className="w-3 h-3 animate-pulse" /> No Pátio
                                </span>
                              ) : app.status === 'Concluído' ? (
                                <span className="inline-flex items-center gap-1 text-[10px] px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full font-bold">
                                  <CheckCircle2 className="w-3 h-3" /> Finalizado
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] px-2.5 py-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-full font-bold">
                                  <X className="w-3 h-3" /> Cancelado
                                </span>
                              )}
                            </td>

                            {/* Coluna Lembrete 24h Antes */}
                            <td className="py-4 px-4 text-center whitespace-nowrap">
                              <div className="flex flex-col items-center gap-1.5">
                                <span className={`inline-flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full font-bold border ${reminderAnalysis.badgeClass}`}>
                                  {reminderAnalysis.label}
                                </span>
                                <div className="flex items-center gap-1">
                                  {app.clientPhone && (
                                    <button
                                      type="button"
                                      onClick={() => handleSendReminder(app, 'whatsapp')}
                                      className="px-2 py-0.5 rounded bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 transition text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                                      title="Disparar Lembrete via WhatsApp"
                                    >
                                      <MessageSquare className="w-3 h-3" /> WhatsApp
                                    </button>
                                  )}
                                  {app.clientEmail && (
                                    <button
                                      type="button"
                                      onClick={() => handleSendReminder(app, 'email')}
                                      className="px-2 py-0.5 rounded bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-400 border border-cyan-500/30 transition text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                                      title="Disparar Lembrete via E-mail"
                                    >
                                      <Mail className="w-3 h-3" /> E-mail
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => setSelectedReminderApp(app)}
                                    className="p-1 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 transition text-[10px] font-semibold flex items-center gap-1 cursor-pointer"
                                    title="Ver opções de notificação e calendário"
                                  >
                                    <Bell className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            </td>

                            <td className="py-4 px-4 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                {app.status === 'Pendente' && (
                                  <>
                                    <button
                                      onClick={() => handleCancelAppointment(app.id)}
                                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition cursor-pointer"
                                      title="Recusar / Cancelar"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => handleApproveAppointment(app)}
                                      className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition shadow-sm shadow-emerald-600/30 inline-flex items-center gap-1 cursor-pointer"
                                      title="Enviar este agendamento para a fila de lavagem"
                                    >
                                      <CheckCircle className="w-3.5 h-3.5" /> Enviar para Fila
                                    </button>
                                  </>
                                )}

                                {(app.status === 'Aprovado' || app.status === 'Em Lavagem') && (
                                  <>
                                    <button
                                      onClick={() => setActiveTab('fila')}
                                      className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 text-xs font-bold px-2.5 py-1.5 rounded-lg transition inline-flex items-center gap-1 cursor-pointer"
                                      title="Ver na Fila do Pátio"
                                    >
                                      <Kanban className="w-3.5 h-3.5" /> Ver no Pátio
                                    </button>
                                    <button
                                      onClick={() => {
                                        updateAppointmentStatusInFirestore(tenant.id, app.id, 'Concluído').catch(console.error);
                                        setAppointments(prev => prev.map(a => a.id === app.id ? { ...a, status: 'Concluído' } : a));
                                        sendClientVehicleStatusPushNotification({
                                          tenantId: tenant.id,
                                          tenantName: tenant.nomeFantasia || tenant.name,
                                          clientName: app.clientName,
                                          clientPhone: app.clientPhone,
                                          clientEmail: (app as any).clientEmail,
                                          vehicle: app.vehicle,
                                          plate: app.plate,
                                          service: app.service,
                                          newStatus: 'Concluído',
                                          source: 'agendamento'
                                        }).catch(console.error);
                                        showToast(`✅ Agendamento de ${app.clientName} marcado como Concluído!`);
                                      }}
                                      className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-xs font-bold px-2.5 py-1.5 rounded-lg transition inline-flex items-center gap-1 cursor-pointer"
                                      title="Marcar como Concluído / Finalizado"
                                    >
                                      <CheckCircle2 className="w-3.5 h-3.5" /> Concluir
                                    </button>
                                    <button
                                      onClick={() => handleCancelAppointment(app.id)}
                                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition cursor-pointer"
                                      title="Cancelar agendamento"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </>
                                )}

                                {app.status === 'Concluído' && (
                                  <>
                                    <button
                                      onClick={() => handleDeleteAppointment(app.id)}
                                      className="bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 border border-rose-800/40 text-xs font-semibold px-2.5 py-1 rounded-lg transition inline-flex items-center gap-1 cursor-pointer"
                                      title="Remover permanentemente do banco de dados"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" /> Limpar do Banco
                                    </button>
                                    <button
                                      onClick={() => {
                                        updateAppointmentStatusInFirestore(tenant.id, app.id, 'Pendente').catch(console.error);
                                        setAppointments(prev => prev.map(a => a.id === app.id ? { ...a, status: 'Pendente' } : a));
                                        showToast('Agendamento reativado para Pendente.');
                                      }}
                                      className="text-xs text-blue-400 hover:underline px-2 py-1 cursor-pointer"
                                      title="Reativar agendamento"
                                    >
                                      Reativar
                                    </button>
                                  </>
                                )}

                                {app.status === 'Cancelado' && (
                                  <button
                                    onClick={() => {
                                      updateAppointmentStatusInFirestore(tenant.id, app.id, 'Pendente').catch(console.error);
                                      setAppointments(prev => prev.map(a => a.id === app.id ? { ...a, status: 'Pendente' } : a));
                                      showToast('Agendamento restaurado para pendente.');
                                    }}
                                    className="text-xs text-blue-400 hover:underline px-2 py-1 cursor-pointer"
                                  >
                                    Reativar
                                  </button>
                                )}

                                {/* Botão Excluir permanente em todos os status */}
                                <button
                                  onClick={() => handleDeleteAppointment(app.id)}
                                  className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition cursor-pointer"
                                  title="Excluir permanentemente do banco"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}

                    {appointments.filter(app => {
                      if (appointmentStatusFilter !== 'todos' && app.status !== appointmentStatusFilter) return false;
                      if (appointmentSearch.trim()) {
                        const q = appointmentSearch.toLowerCase();
                        const matchClient = app.clientName.toLowerCase().includes(q);
                        const matchPlate = app.plate.toLowerCase().includes(q);
                        const matchVehicle = app.vehicle.toLowerCase().includes(q);
                        const matchService = app.service.toLowerCase().includes(q);
                        if (!matchClient && !matchPlate && !matchVehicle && !matchService) return false;
                      }
                      return true;
                    }).length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-500 text-xs">
                          Nenhum agendamento encontrado para o filtro selecionado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================= ABA: CENTRAL DE NOTIFICAÇÕES & LEMBRETES 24H ================= */}
        {activeTab === 'lembretes-24h' && (
          <div className="space-y-5 animate-fadeIn">
            {/* Header & Ações */}
            <div className="bg-gradient-to-r from-blue-950/40 via-[#0f172a] to-indigo-950/40 border border-blue-500/30 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1e293b] pb-4">
                <div className="flex items-center gap-3.5">
                  <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-2xl text-blue-400 shrink-0">
                    <BellRing className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-white text-base">Central de Notificações & Lembretes 24h Antes</h3>
                      <span className="text-[10px] bg-blue-500/20 text-blue-300 font-bold px-2 py-0.5 rounded-full border border-blue-500/30">
                        Anti-No-Show
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Dispare lembretes com antecedência para clientes agendados via WhatsApp e E-mail, reduzindo faltas e otimizando a fila do pátio.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Toggle Auto Reminders */}
                  <div className="flex items-center gap-2 bg-[#020617] border border-[#1e293b] px-3.5 py-2 rounded-xl text-xs">
                    <span className="text-slate-400 text-xs font-medium">Disparo Automático:</span>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={autoRemindersEnabled}
                        onChange={(e) => {
                          const val = e.target.checked;
                          setAutoRemindersEnabled(val);
                          localStorage.setItem(`saas_auto_reminders_${tenant.id}`, String(val));
                          showToast(val ? '🔔 Disparo automático de lembretes ativado!' : 'Lembretes automáticos pausados.');
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  {/* Disparar Lote */}
                  <button
                    type="button"
                    onClick={handleBatchSendReminders}
                    className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-md ${
                      reminderMetrics.dueCount > 0
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30 animate-pulse'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                    title="Dispara automaticamente os lembretes para todos os clientes de amanhã"
                  >
                    <Send className="w-4 h-4" />
                    Disparar Lembretes de Amanhã ({reminderMetrics.dueCount})
                  </button>
                </div>
              </div>

              {/* 3 Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div 
                  onClick={() => setReminderFilter(reminderFilter === 'due' ? 'todos' : 'due')}
                  className={`p-4 rounded-xl border transition cursor-pointer ${
                    reminderFilter === 'due' 
                      ? 'bg-amber-500/20 border-amber-500/60 shadow-md ring-2 ring-amber-500/50' 
                      : 'bg-[#020617]/70 border-[#1e293b] hover:border-amber-500/30'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-amber-300 flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-amber-400" /> Prontos p/ Disparo (&le; 24h)
                    </span>
                    <span className="text-base font-black text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded">
                      {reminderMetrics.dueCount}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1.5">Serviços marcados para as próximas 24 horas aguardando envio do lembrete.</p>
                </div>

                <div 
                  onClick={() => setReminderFilter(reminderFilter === 'scheduled' ? 'todos' : 'scheduled')}
                  className={`p-4 rounded-xl border transition cursor-pointer ${
                    reminderFilter === 'scheduled' 
                      ? 'bg-blue-500/20 border-blue-500/60 shadow-md ring-2 ring-blue-500/50' 
                      : 'bg-[#020617]/70 border-[#1e293b] hover:border-blue-500/30'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-blue-300 flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-blue-400" /> Agendados Futuros (&gt; 24h)
                    </span>
                    <span className="text-base font-black text-blue-400 bg-blue-500/10 px-2.5 py-0.5 rounded">
                      {reminderMetrics.scheduledCount}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1.5">Aguardando a data correta para envio do lembrete com antecedência exata.</p>
                </div>

                <div 
                  onClick={() => setReminderFilter(reminderFilter === 'sent' ? 'todos' : 'sent')}
                  className={`p-4 rounded-xl border transition cursor-pointer ${
                    reminderFilter === 'sent' 
                      ? 'bg-emerald-500/20 border-emerald-500/60 shadow-md ring-2 ring-emerald-500/50' 
                      : 'bg-[#020617]/70 border-[#1e293b] hover:border-emerald-500/30'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-emerald-300 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Lembretes Já Enviados
                    </span>
                    <span className="text-base font-black text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded">
                      {reminderMetrics.sentCount}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1.5">Clientes já notificados por WhatsApp ou E-mail com registro auditado.</p>
                </div>
              </div>
            </div>

            {/* Barra de Filtros e Busca de Lembretes */}
            <div className="bg-[#0f172a] border border-[#1e293b] p-4 rounded-xl flex flex-col md:flex-row gap-3 items-center justify-between">
              <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
                {(['todos', 'due', 'scheduled', 'sent'] as const).map(filterKey => {
                  const label = filterKey === 'todos' 
                    ? 'Todos os Agendamentos' 
                    : filterKey === 'due' 
                    ? 'Prontos para Disparo (≤ 24h)' 
                    : filterKey === 'scheduled' 
                    ? 'Futuros (> 24h)' 
                    : 'Já Enviados';

                  const count = filterKey === 'todos' 
                    ? appointments.filter(a => a.status !== 'Cancelado' && a.status !== 'Concluído').length 
                    : filterKey === 'due' 
                    ? reminderMetrics.dueCount 
                    : filterKey === 'scheduled' 
                    ? reminderMetrics.scheduledCount 
                    : reminderMetrics.sentCount;

                  return (
                    <button
                      key={filterKey}
                      onClick={() => setReminderFilter(filterKey)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                        reminderFilter === filterKey
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-[#020617] text-slate-400 hover:text-slate-200 border border-[#1e293b]'
                      }`}
                    >
                      {label}
                      <span className="text-[10px] opacity-80">({count})</span>
                    </button>
                  );
                })}
              </div>

              <div className="relative w-full md:w-64">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar por cliente, carro, placa..."
                  value={appointmentSearch}
                  onChange={(e) => setAppointmentSearch(e.target.value)}
                  className="w-full bg-[#020617] border border-[#1e293b] rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Tabela de Auditoria de Lembretes */}
            <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#1e293b] bg-[#020617] text-slate-400 uppercase font-bold text-[10px] tracking-wider">
                      <th className="py-3 px-4">Horário do Atendimento</th>
                      <th className="py-3 px-4">Cliente & Contato</th>
                      <th className="py-3 px-4">Veículo & Placa</th>
                      <th className="py-3 px-4">Serviço & Preço</th>
                      <th className="py-3 px-4">Status do Lembrete 24h</th>
                      <th className="py-3 px-4 text-right">Ações de Notificação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1e293b]/50">
                    {appointments
                      .filter(app => {
                        if (app.status === 'Cancelado' || app.status === 'Concluído') return false;
                        const analysis = getAppointmentReminderAnalysis(app, new Date());
                        if (reminderFilter === 'due' && analysis.status !== 'due') return false;
                        if (reminderFilter === 'scheduled' && analysis.status !== 'scheduled') return false;
                        if (reminderFilter === 'sent' && !app.reminder24hSent) return false;

                        if (appointmentSearch.trim()) {
                          const q = appointmentSearch.toLowerCase();
                          const matchClient = app.clientName.toLowerCase().includes(q);
                          const matchPlate = app.plate?.toLowerCase().includes(q);
                          const matchVehicle = app.vehicle?.toLowerCase().includes(q);
                          const matchService = app.service?.toLowerCase().includes(q);
                          if (!matchClient && !matchPlate && !matchVehicle && !matchService) return false;
                        }
                        return true;
                      })
                      .map((app) => {
                        const analysis = getAppointmentReminderAnalysis(app, new Date());
                        const waText = buildReminderWhatsAppText(tenant.nomeFantasia || tenant.name, app, tenant.address?.street);
                        const waUrl = buildReminderWhatsAppUrl(app.clientPhone, waText);
                        const gcalUrl = buildGoogleCalendarUrl(tenant.nomeFantasia || tenant.name, app);

                        return (
                          <tr key={app.id} className="hover:bg-slate-900/40 transition">
                            <td className="py-3.5 px-4">
                              <span className="font-bold text-slate-100 block">{app.time || app.dateTime?.split(' ')[1] || '08:00'}</span>
                              <span className="text-[11px] text-slate-400 block">{app.date ? app.date.split('-').reverse().join('/') : app.dateTime?.split(' ')[0]}</span>
                              <span className="text-[10px] text-blue-400 font-mono mt-0.5 block">
                                {analysis.hoursUntilService > 0 ? `Em ~${Math.round(analysis.hoursUntilService)}h` : 'Hoje'}
                              </span>
                            </td>

                            <td className="py-3.5 px-4">
                              <span className="font-bold text-white block">{app.clientName}</span>
                              <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                                {app.clientPhone && (
                                  <span className="flex items-center gap-1 font-mono">
                                    <Phone className="w-3 h-3 text-emerald-400" /> {app.clientPhone}
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="py-3.5 px-4">
                              <span className="font-bold text-slate-200 block">{app.vehicle}</span>
                              <span className="font-mono text-blue-400 font-bold text-[11px] bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20 inline-block mt-0.5">
                                {app.plate || 'S/ PLACA'}
                              </span>
                            </td>

                            <td className="py-3.5 px-4">
                              <span className="font-bold text-slate-200 block">{app.service}</span>
                              <span className="text-emerald-400 font-bold font-mono text-[11px]">
                                R$ {Number(app.price || 0).toFixed(2)}
                              </span>
                            </td>

                            <td className="py-3.5 px-4">
                              <div className="flex flex-col gap-1">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border w-fit ${analysis.badgeClass}`}>
                                  <Bell className="w-3 h-3" /> {analysis.label}
                                </span>
                                {app.reminder24hSent && (
                                  <span className="text-[10px] text-emerald-400/80">
                                    Disparado em {app.reminder24hSentAt ? new Date(app.reminder24hSentAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'Sim'}
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {app.clientPhone && (
                                  <a
                                    href={waUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={async () => {
                                      await handleToggleReminderSent(app.id, true);
                                    }}
                                    className="p-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 rounded-lg text-xs font-bold transition flex items-center gap-1"
                                    title="Disparar lembrete personalizado no WhatsApp"
                                  >
                                    <MessageSquare className="w-3.5 h-3.5 text-emerald-400" /> WhatsApp
                                  </a>
                                )}

                                {app.clientEmail && (
                                  <button
                                    type="button"
                                    onClick={() => handleSendReminder(app, 'email')}
                                    className="p-1.5 bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 text-cyan-300 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                                    title="Enviar lembrete por E-mail"
                                  >
                                    <Mail className="w-3.5 h-3.5 text-cyan-400" /> E-mail
                                  </button>
                                )}

                                {gcalUrl && (
                                  <a
                                    href={gcalUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition border border-slate-700 flex items-center gap-1"
                                    title="Adicionar à Google Agenda"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5 text-blue-400" />
                                  </a>
                                )}

                                <button
                                  type="button"
                                  onClick={() => handleToggleReminderSent(app.id, !app.reminder24hSent)}
                                  className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition cursor-pointer ${
                                    app.reminder24hSent
                                      ? 'bg-slate-800 text-slate-400 border-slate-700'
                                      : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30'
                                  }`}
                                  title="Marcar manualmente se o lembrete já foi enviado"
                                >
                                  {app.reminder24hSent ? 'Desmarcar' : 'Marcar Enviado'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}

                    {appointments.filter(app => {
                      if (app.status === 'Cancelado' || app.status === 'Concluído') return false;
                      const analysis = getAppointmentReminderAnalysis(app, new Date());
                      if (reminderFilter === 'due' && analysis.status !== 'due') return false;
                      if (reminderFilter === 'scheduled' && analysis.status !== 'scheduled') return false;
                      if (reminderFilter === 'sent' && !app.reminder24hSent) return false;
                      return true;
                    }).length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-500 text-xs">
                          Nenhum agendamento encontrado para o filtro de lembrete selecionado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================= ABA: GESTÃO OPERACIONAL DE LEVA E TRAZ ================= */}
        {activeTab === 'leva-e-traz' && (
          <div className="space-y-5 animate-fadeIn">
            {/* Header & Ação de Novo Pedido */}
            <div className="bg-gradient-to-r from-cyan-950/40 via-[#0f172a] to-blue-950/40 border border-cyan-500/30 rounded-2xl p-5 sm:p-6 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="p-3 bg-cyan-500/15 border border-cyan-500/30 rounded-2xl text-cyan-400 shrink-0">
                  <Truck className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-white text-base">Gestão Operacional de Leva e Traz (Valet & Delivery)</h3>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      levaConfig.enabled
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                        : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                    }`}>
                      {levaConfig.enabled ? 'Serviço Ativo no App' : 'Pausado no App'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Despache motoristas, trace rotas no Google Maps, atualize o cliente via WhatsApp/Push e transfira veículos com 1-clique para o pátio.
                  </p>
                  {levaConfig.enabled ? (
                    <p className="text-[11px] text-cyan-300/90 mt-1 font-medium">
                      Taxas atuais: Completo <strong>R$ {levaConfig.feeCompleto.toFixed(2)}</strong> · Buscar <strong>R$ {levaConfig.feeBuscar.toFixed(2)}</strong> · Entregar <strong>R$ {levaConfig.feeEntregar.toFixed(2)}</strong>
                      {levaConfig.freeAboveOrderValue > 0 ? ` · Grátis acima de R$ ${levaConfig.freeAboveOrderValue.toFixed(2)}` : ''}
                      {levaConfig.coverageArea ? ` · Área: ${levaConfig.coverageArea}` : ''}
                    </p>
                  ) : (
                    <p className="text-[11px] text-rose-300 mt-1 font-bold flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 shrink-0" />
                      Cobranças de taxa travadas em R$ 0,00 (Serviço Pausado nas Configurações)
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setConfigInitialSubTab('leva-e-traz');
                    setActiveTab('configuracoes-empresa');
                  }}
                  className="bg-[#020617] hover:bg-slate-800 border border-[#1e293b] text-slate-200 font-bold px-3.5 py-2.5 rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Settings className="w-4 h-4 text-cyan-400" /> Configurar Taxas
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddLevaModal(true)}
                  className="bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-black px-4 py-2.5 rounded-xl text-xs transition shadow-lg shadow-cyan-600/30 flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Nova Solicitação Leva e Traz
                </button>
              </div>
            </div>

            {/* KPIs Rápidos Operacionais */}
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
              <div className="bg-[#0f172a] border border-[#1e293b] p-3.5 rounded-xl">
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Total Pedidos</span>
                <span className="text-xl font-black text-cyan-400">{levaETrazRequests.length}</span>
              </div>

              <div className="bg-[#0f172a] border border-[#1e293b] p-3.5 rounded-xl">
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Aguardando Coleta</span>
                <span className="text-xl font-black text-amber-400">
                  {levaETrazRequests.filter(r => r.status === 'solicitado' || r.status === 'motorista_a_caminho').length}
                </span>
              </div>

              <div className="bg-[#0f172a] border border-[#1e293b] p-3.5 rounded-xl">
                <span className="text-[10px] text-slate-500 block uppercase font-bold">No Pátio / Lavando</span>
                <span className="text-xl font-black text-blue-400">
                  {levaETrazRequests.filter(r => r.status === 'coletado' || r.status === 'no_patio').length}
                </span>
              </div>

              <div className="bg-[#0f172a] border border-[#1e293b] p-3.5 rounded-xl">
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Em Entrega</span>
                <span className="text-xl font-black text-indigo-400">
                  {levaETrazRequests.filter(r => r.status === 'concluido' || r.status === 'em_entrega').length}
                </span>
              </div>

              <div className="bg-[#0f172a] border border-[#1e293b] p-3.5 rounded-xl">
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Entregues</span>
                <span className="text-xl font-black text-emerald-400">
                  {levaETrazRequests.filter(r => r.status === 'entregue').length}
                </span>
              </div>

              <div className="bg-[#0f172a] border border-[#1e293b] p-3.5 rounded-xl">
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Receita Entregue</span>
                <span className="text-lg font-black text-emerald-400 font-mono">
                  R$ {levaETrazRequests
                    .filter(r => r.status === 'entregue')
                    .reduce((acc, r) => acc + Number(r.totalPrice || (r.servicePrice + r.feePrice) || 0), 0)
                    .toFixed(0)}
                </span>
              </div>
            </div>

            {/* Filtros e Barra de Busca */}
            <div className="bg-[#0f172a] border border-[#1e293b] p-4 rounded-xl flex flex-col md:flex-row gap-3 items-center justify-between">
              <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
                {(['todos', 'solicitado', 'coleta', 'patio', 'entrega', 'entregue', 'cancelado'] as const).map(filterKey => {
                  const label = filterKey === 'todos' 
                    ? 'Todos' 
                    : filterKey === 'solicitado' 
                    ? 'Solicitações' 
                    : filterKey === 'coleta' 
                    ? 'Em Coleta' 
                    : filterKey === 'patio' 
                    ? 'No Pátio' 
                    : filterKey === 'entrega' 
                    ? 'Entrega' 
                    : filterKey === 'entregue'
                    ? 'Entregues'
                    : 'Cancelados';

                  const count = filterKey === 'todos' 
                    ? levaETrazRequests.length 
                    : filterKey === 'solicitado'
                    ? levaETrazRequests.filter(r => r.status === 'solicitado').length
                    : filterKey === 'coleta'
                    ? levaETrazRequests.filter(r => r.status === 'motorista_a_caminho' || r.status === 'coletado').length
                    : filterKey === 'patio'
                    ? levaETrazRequests.filter(r => r.status === 'no_patio').length
                    : filterKey === 'entrega'
                    ? levaETrazRequests.filter(r => r.status === 'concluido' || r.status === 'em_entrega').length
                    : filterKey === 'entregue'
                    ? levaETrazRequests.filter(r => r.status === 'entregue').length
                    : levaETrazRequests.filter(r => r.status === 'cancelado').length;

                  return (
                    <button
                      key={filterKey}
                      onClick={() => setLevaFilter(filterKey)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                        levaFilter === filterKey
                          ? 'bg-cyan-600 text-slate-950 font-black shadow-sm'
                          : 'bg-[#020617] text-slate-400 hover:text-slate-200 border border-[#1e293b]'
                      }`}
                    >
                      {label}
                      <span className="text-[10px] opacity-80">({count})</span>
                    </button>
                  );
                })}
              </div>

              <div className="relative w-full md:w-64">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar por cliente, carro, placa ou rua..."
                  value={levaSearch}
                  onChange={(e) => setLevaSearch(e.target.value)}
                  className="w-full bg-[#020617] border border-[#1e293b] rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            {/* Lista de Solicitações de Leva e Traz */}
            {(() => {
              const filteredLevaRequests = levaETrazRequests.filter(req => {
                if (levaFilter === 'solicitado' && req.status !== 'solicitado') return false;
                if (levaFilter === 'coleta' && req.status !== 'motorista_a_caminho' && req.status !== 'coletado') return false;
                if (levaFilter === 'patio' && req.status !== 'no_patio') return false;
                if (levaFilter === 'entrega' && req.status !== 'concluido' && req.status !== 'em_entrega') return false;
                if (levaFilter === 'entregue' && req.status !== 'entregue') return false;
                if (levaFilter === 'cancelado' && req.status !== 'cancelado') return false;

                if (levaSearch.trim()) {
                  const q = levaSearch.toLowerCase();
                  const matchClient = req.clientName.toLowerCase().includes(q);
                  const matchPhone = req.clientPhone?.toLowerCase().includes(q);
                  const matchVehicle = req.vehicle.toLowerCase().includes(q);
                  const matchPlate = req.plate.toLowerCase().includes(q);
                  const matchAddress = req.address?.street?.toLowerCase().includes(q) || req.address?.neighborhood?.toLowerCase().includes(q);
                  if (!matchClient && !matchPhone && !matchVehicle && !matchPlate && !matchAddress) return false;
                }
                return true;
              });

              if (filteredLevaRequests.length === 0) {
                return (
                  <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-12 text-center text-slate-500 space-y-3">
                    <Truck className="w-12 h-12 mx-auto opacity-30 text-cyan-400" />
                    <p className="text-sm font-bold text-slate-300">Nenhuma solicitação de Leva e Traz encontrada.</p>
                    <p className="text-xs text-slate-500">
                      Quando os clientes solicitarem pelo aplicativo ou totem, ou quando você lançar manualmente, os pedidos aparecerão aqui com status em tempo real.
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowAddLevaModal(true)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 rounded-xl text-xs font-black transition cursor-pointer"
                    >
                      <Plus className="w-4 h-4" /> Criar Solicitação Manual
                    </button>
                  </div>
                );
              }

              return (
                <div className="space-y-4">
                  {filteredLevaRequests.map((req) => {
                      const statusBadges: Record<LevaETrazStatus, { text: string; bg: string }> = {
                        solicitado: { text: '1. Solicitação Recebida', bg: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
                        motorista_a_caminho: { text: '2. Motorista a Caminho da Coleta', bg: 'bg-blue-500/20 text-blue-300 border-blue-500/40 animate-pulse' },
                        coletado: { text: '3. Veículo Coletado (Em trânsito)', bg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' },
                        no_patio: { text: '4. No Pátio / Em Lavagem', bg: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' },
                        concluido: { text: '5. Lavagem Concluída / Inspecionado', bg: 'bg-purple-500/20 text-purple-300 border-purple-500/40' },
                        em_entrega: { text: '6. Motorista a Caminho da Entrega', bg: 'bg-teal-500/20 text-teal-300 border-teal-500/40 animate-pulse' },
                        entregue: { text: '7. Entregue com Sucesso', bg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold' },
                        cancelado: { text: 'Cancelado', bg: 'bg-rose-500/20 text-rose-300 border-rose-500/40' }
                      };

                      const currentBadge = statusBadges[req.status] || { text: req.status, bg: 'bg-slate-800 text-slate-400 border-slate-700' };

                      return (
                        <div
                          key={req.id}
                          className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-5 shadow-xl hover:border-slate-700 transition space-y-4"
                        >
                          {/* Top Row: Cliente, Veículo, Modalidade e Preço */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1e293b] pb-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-base text-white">{req.clientName}</span>
                                {req.clientPhone && (
                                  <a
                                    href={`https://wa.me/55${req.clientPhone.replace(/\D/g, '')}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-emerald-400 font-mono flex items-center gap-1 hover:underline"
                                  >
                                    <Phone className="w-3 h-3" /> {req.clientPhone}
                                  </a>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-x-2 text-xs text-slate-400">
                                <span className="font-bold text-slate-200">🚗 {req.vehicle}</span>
                                <span className="font-mono text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20">
                                  {req.plate}
                                </span>
                                <span>·</span>
                                <span>{req.service}</span>
                                <span>·</span>
                                <span className="text-cyan-300 font-semibold">
                                  {req.type === 'completo' ? 'Leva e Traz Completo' : req.type === 'buscar' ? 'Apenas Buscar' : 'Apenas Entregar'}
                                </span>
                              </div>
                            </div>

                            <div className="flex flex-col sm:items-end gap-1">
                              <span className={`text-xs font-bold px-3 py-1 rounded-full border ${currentBadge.bg}`}>
                                {currentBadge.text}
                              </span>
                              <div className="flex items-baseline gap-2">
                                <span className="text-xs text-slate-400">Total:</span>
                                <span className="text-base font-black text-emerald-400">
                                  R$ {Number(req.totalPrice || req.servicePrice + req.feePrice).toFixed(2)}
                                </span>
                                <span className="text-[10px] text-slate-500">
                                  (Serviço R$ {req.servicePrice} + {req.feePrice === 0 ? 'Taxa Grátis' : `Taxa R$ ${req.feePrice}`})
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Middle: Endereço, Motorista Designado e Observações */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                            {/* Card de Endereço */}
                            <div className="bg-[#020617] border border-[#1e293b] p-3.5 rounded-xl space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1.5">
                                  <MapPin className="w-3.5 h-3.5 text-cyan-400" /> Endereço de Coleta / Entrega
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleOpenGoogleMapsRoute(req.address)}
                                  className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 px-2.5 py-1 rounded-lg border border-cyan-500/30 transition flex items-center gap-1 cursor-pointer"
                                  title="Abrir rota no Google Maps"
                                >
                                  <Navigation className="w-3 h-3 text-cyan-400" /> Traçar Rota no Maps
                                </button>
                              </div>

                              <p className="text-xs text-slate-200 font-medium">
                                {req.address?.street} {req.address?.number ? `, nº ${req.address.number}` : ''}
                                {req.address?.neighborhood ? ` - ${req.address.neighborhood}` : ''}
                                {req.address?.city ? ` (${req.address.city})` : ''}
                                {req.address?.cep ? ` · CEP ${req.address.cep}` : ''}
                              </p>
                              {req.address?.complement && (
                                <p className="text-[11px] text-slate-400">
                                  Compl: {req.address.complement}
                                </p>
                              )}
                              {req.address?.reference && (
                                <p className="text-[11px] text-slate-400">
                                  Ref: {req.address.reference}
                                </p>
                              )}
                              {req.notes && (
                                <p className="text-[11px] text-amber-300/90 italic bg-amber-500/5 p-1.5 rounded border border-amber-500/20">
                                  Instruções: {req.notes}
                                </p>
                              )}
                            </div>

                            {/* Card de Motorista */}
                            <div className="bg-[#020617] border border-[#1e293b] p-3.5 rounded-xl space-y-2 flex flex-col justify-between">
                              <div>
                                <span className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1.5">
                                  <User className="w-3.5 h-3.5 text-cyan-400" /> Motorista Designado
                                </span>
                                <div className="mt-2 flex items-center gap-2">
                                  <select
                                    value={req.driverName || selectedLevaDriver[req.id] || ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setSelectedLevaDriver(prev => ({ ...prev, [req.id]: val }));
                                      if (val) {
                                        handleAssignLevaDriver(req.id, val);
                                      }
                                    }}
                                    className="bg-[#0f172a] border border-[#1e293b] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 flex-1 cursor-pointer"
                                  >
                                    <option value="">Selecione o motorista...</option>
                                    {staffList.map(s => (
                                      <option key={s.id} value={s.name}>
                                        {s.name} ({s.role})
                                      </option>
                                    ))}
                                    <option value="Motorista Terceirizado">Motorista Terceirizado</option>
                                  </select>
                                </div>
                              </div>

                              <div className="pt-2 border-t border-[#1e293b] flex items-center justify-between text-[11px] text-slate-400">
                                <span>Criado em: {new Date(req.createdAt).toLocaleDateString('pt-BR')} às {new Date(req.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                {req.scheduledTime && (
                                  <span className="font-bold text-cyan-400 font-mono">
                                    Agendado: {req.scheduledDate ? `${req.scheduledDate.split('-').reverse().join('/')} ` : ''}{req.scheduledTime}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Linha do Tempo Compacta das Etapas Concluídas */}
                          {Array.isArray(req.statusHistory) && req.statusHistory.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[10px]">
                              <span className="text-slate-500 font-bold uppercase mr-1">Histórico:</span>
                              {req.statusHistory.slice(-5).map((h, hIdx) => (
                                <span
                                  key={`${req.id}-hist-${hIdx}`}
                                  className="px-2 py-0.5 rounded bg-[#020617] border border-[#1e293b] text-slate-300 font-mono"
                                  title={h.note || h.status}
                                >
                                  {h.status.replace(/_/g, ' ')} ({new Date(h.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })})
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Action Buttons: Avançar Etapa + WhatsApp + Cancelar */}
                          <div className="pt-2 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              {req.clientPhone && (
                                <button
                                  type="button"
                                  onClick={() => handleSendLevaStatusWhatsApp(req)}
                                  className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                                  title="Enviar mensagem atualizada sobre o status do carro no WhatsApp do cliente"
                                >
                                  <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                                  Notificar Cliente no WhatsApp
                                </button>
                              )}

                              {req.status !== 'entregue' && req.status !== 'cancelado' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (confirm(`Cancelar o serviço Leva & Traz de ${req.clientName} (${req.vehicle})?`)) {
                                      handleAdvanceLevaStatus(req, 'cancelado', 'Cancelado pelo painel operacional');
                                    }
                                  }}
                                  className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                                >
                                  <X className="w-3.5 h-3.5" /> Cancelar
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={async () => {
                                  if (confirm('Deseja realmente excluir este registro de Leva e Traz?')) {
                                    setLevaETrazRequests(prev => prev.filter(r => r.id !== req.id));
                                    await deleteLevaETrazRequestFromFirestore(tenant.id, req.id);
                                    showToast('Registro de Leva e Traz excluído.');
                                  }
                                }}
                                className="px-2.5 py-1.5 text-slate-500 hover:text-rose-400 rounded-lg text-xs transition cursor-pointer"
                                title="Excluir registro"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Botão de Avanço Rápido de Etapa */}
                            <div className="flex items-center gap-2">
                              {req.status === 'solicitado' && (
                                <button
                                  type="button"
                                  onClick={() => handleAdvanceLevaStatus(req, 'motorista_a_caminho')}
                                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-blue-600/30 cursor-pointer"
                                >
                                  <Truck className="w-3.5 h-3.5" /> Despachar Motorista p/ Coleta &rarr;
                                </button>
                              )}

                              {req.status === 'motorista_a_caminho' && (
                                <button
                                  type="button"
                                  onClick={() => handleAdvanceLevaStatus(req, 'coletado')}
                                  className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-md shadow-cyan-600/30 cursor-pointer"
                                >
                                  <Check className="w-3.5 h-3.5" /> Confirmar Veículo Coletado &rarr;
                                </button>
                              )}

                              {req.status === 'coletado' && (
                                <button
                                  type="button"
                                  onClick={() => handleAdvanceLevaStatus(req, 'no_patio')}
                                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-indigo-600/30 cursor-pointer animate-pulse"
                                >
                                  <Droplet className="w-3.5 h-3.5" /> Chegou no Pátio (Colocar na Fila) &rarr;
                                </button>
                              )}

                              {req.status === 'no_patio' && (
                                <button
                                  type="button"
                                  onClick={() => handleAdvanceLevaStatus(req, 'concluido')}
                                  className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-purple-600/30 cursor-pointer"
                                >
                                  <Sparkles className="w-3.5 h-3.5" /> Lavagem Pronta (Avançar p/ Entrega) &rarr;
                                </button>
                              )}

                              {req.status === 'concluido' && (
                                <button
                                  type="button"
                                  onClick={() => handleAdvanceLevaStatus(req, 'em_entrega')}
                                  className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-teal-600/30 cursor-pointer"
                                >
                                  <Truck className="w-3.5 h-3.5" /> Despachar Motorista p/ Entrega &rarr;
                                </button>
                              )}

                              {req.status === 'em_entrega' && (
                                <button
                                  type="button"
                                  onClick={() => handleAdvanceLevaStatus(req, 'entregue')}
                                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-emerald-600/30 cursor-pointer"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Confirmar Entrega Realizada &rarr;
                                </button>
                              )}

                              {req.status === 'entregue' && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Entrega Concluída com Sucesso!
                                </span>
                              )}

                              {req.status === 'cancelado' && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/15 text-rose-300 border border-rose-500/30 text-xs font-bold">
                                  <X className="w-3.5 h-3.5" /> Pedido Cancelado
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                  })}
                </div>
              );
            })()}

            {/* Modal: Nova Solicitação Leva e Traz */}
            {showAddLevaModal && (
              <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
                <div className="bg-[#0f172a] border border-cyan-500/50 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl overflow-y-auto max-h-[90vh]">
                  <div className="flex items-center justify-between border-b border-[#1e293b] pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-cyan-500/20 text-cyan-400 rounded-xl">
                        <Truck className="w-5 h-5" />
                      </div>
                      <h3 className="font-bold text-white text-base">Nova Solicitação de Leva e Traz</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAddLevaModal(false)}
                      className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <form onSubmit={handleCreateManualLevaRequest} className="space-y-4 text-xs">
                    {/* Preenchimento rápido com cliente já cadastrado */}
                    {tenantClients.length > 0 && (
                      <div className="bg-[#020617] border border-cyan-500/20 rounded-xl p-3">
                        <label className="block text-[10px] font-bold text-cyan-400 uppercase mb-1">
                          Preencher com Cliente Cadastrado (Opcional)
                        </label>
                        <select
                          defaultValue=""
                          onChange={(e) => {
                            const selected = tenantClients.find(c => (c.id || c.uid) === e.target.value);
                            if (!selected) return;
                            setNewLTClientName(selected.nomeCompleto || selected.name || '');
                            setNewLTClientPhone(selected.telefone || selected.phone || '');
                            const vList = selected.veiculos || selected.vehicles || (selected.vehicle ? [selected.vehicle] : []);
                            if (Array.isArray(vList) && vList.length > 0) {
                              const firstV = vList[0];
                              setNewLTVehicle(`${firstV.marca || firstV.brand || ''} ${firstV.modelo || firstV.model || ''}`.trim());
                              setNewLTPlate((firstV.placa || firstV.plate || '').toUpperCase());
                            }
                            if (selected.endereco || selected.address) {
                              const addr = selected.endereco || selected.address;
                              if (typeof addr === 'object') {
                                if (addr.cep) setNewLTCep(addr.cep);
                                if (addr.rua || addr.street) setNewLTStreet(addr.rua || addr.street);
                                if (addr.numero || addr.number) setNewLTNumber(addr.numero || addr.number);
                                if (addr.bairro || addr.neighborhood) setNewLTNeighborhood(addr.bairro || addr.neighborhood);
                                if (addr.cidade || addr.city) setNewLTCity(addr.cidade || addr.city);
                              }
                            }
                          }}
                          className="w-full bg-[#0f172a] border border-[#1e293b] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                        >
                          <option value="">-- Selecionar cliente da base --</option>
                          {tenantClients.map(c => {
                            const cName = c.nomeCompleto || c.name || 'Cliente';
                            const cPhone = c.telefone || c.phone || '';
                            return (
                              <option key={c.id || c.uid || cName} value={c.id || c.uid}>
                                {cName} {cPhone ? `(${cPhone})` : ''}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-300 font-bold mb-1">Nome do Cliente *</label>
                        <input
                          type="text"
                          required
                          placeholder="Ex: Carlos Oliveira"
                          value={newLTClientName}
                          onChange={(e) => setNewLTClientName(e.target.value)}
                          className="w-full bg-[#020617] border border-[#1e293b] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-300 font-bold mb-1">Telefone / WhatsApp *</label>
                        <input
                          type="text"
                          required
                          placeholder="(11) 99999-9999"
                          value={newLTClientPhone}
                          onChange={(e) => setNewLTClientPhone(e.target.value)}
                          className="w-full bg-[#020617] border border-[#1e293b] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-300 font-bold mb-1">Veículo (Marca/Modelo) *</label>
                        <input
                          type="text"
                          required
                          placeholder="Ex: Honda Civic"
                          value={newLTVehicle}
                          onChange={(e) => setNewLTVehicle(e.target.value)}
                          className="w-full bg-[#020617] border border-[#1e293b] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-300 font-bold mb-1">Placa *</label>
                        <input
                          type="text"
                          required
                          placeholder="ABC1D23"
                          value={newLTPlate}
                          onChange={(e) => setNewLTPlate(e.target.value.toUpperCase())}
                          className="w-full bg-[#020617] border border-[#1e293b] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500 font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="col-span-1 sm:col-span-2">
                        <label className="block text-slate-300 font-bold mb-1">Serviço de Lavagem</label>
                        <input
                          type="text"
                          placeholder="Ex: Lavagem Detalhada + Cera"
                          value={newLTService}
                          onChange={(e) => setNewLTService(e.target.value)}
                          className="w-full bg-[#020617] border border-[#1e293b] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-300 font-bold mb-1">Valor do Serviço (R$)</label>
                        <input
                          type="number"
                          placeholder="70"
                          value={newLTServicePrice}
                          onChange={(e) => setNewLTServicePrice(Number(e.target.value))}
                          className="w-full bg-[#020617] border border-[#1e293b] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                    </div>

                    {/* Modalidade */}
                    <div>
                      <label className="block text-slate-300 font-bold mb-1">Modalidade do Leva e Traz</label>
                      {!levaConfig.enabled && (
                        <div className="mb-2 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2 text-[11px] text-rose-300 font-semibold flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5 shrink-0" />
                          Taxa pausada nas configurações: cobrança de frete/deslocamento travada em R$ 0,00.
                        </div>
                      )}
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setNewLTType('completo')}
                          className={`p-2 rounded-lg border text-xs font-bold transition cursor-pointer ${
                            newLTType === 'completo'
                              ? 'bg-cyan-600/30 border-cyan-400 text-white'
                              : 'bg-[#020617] border-[#1e293b] text-slate-400'
                          }`}
                        >
                          Completo ({!levaConfig.enabled ? 'Travado R$ 0' : calculateManualLTFee('completo', Number(newLTServicePrice) || 0) === 0 ? 'Grátis' : `+ R$ ${levaConfig.feeCompleto}`})
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewLTType('buscar')}
                          className={`p-2 rounded-lg border text-xs font-bold transition cursor-pointer ${
                            newLTType === 'buscar'
                              ? 'bg-cyan-600/30 border-cyan-400 text-white'
                              : 'bg-[#020617] border-[#1e293b] text-slate-400'
                          }`}
                        >
                          Apenas Buscar ({!levaConfig.enabled ? 'Travado R$ 0' : calculateManualLTFee('buscar', Number(newLTServicePrice) || 0) === 0 ? 'Grátis' : `+ R$ ${levaConfig.feeBuscar}`})
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewLTType('entregar')}
                          className={`p-2 rounded-lg border text-xs font-bold transition cursor-pointer ${
                            newLTType === 'entregar'
                              ? 'bg-cyan-600/30 border-cyan-400 text-white'
                              : 'bg-[#020617] border-[#1e293b] text-slate-400'
                          }`}
                        >
                          Apenas Entregar ({!levaConfig.enabled ? 'Travado R$ 0' : calculateManualLTFee('entregar', Number(newLTServicePrice) || 0) === 0 ? 'Grátis' : `+ R$ ${levaConfig.feeEntregar}`})
                        </button>
                      </div>
                    </div>

                    {/* Endereço */}
                    <div className="bg-[#020617] p-3 rounded-xl border border-[#1e293b] space-y-2.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Endereço de Coleta / Retirada</span>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-slate-400 text-[10px] mb-0.5">CEP</label>
                          <div className="relative">
                            <input
                              type="text"
                              placeholder="00000-000"
                              value={newLTCep}
                              onChange={(e) => {
                                const val = e.target.value;
                                setNewLTCep(val);
                                if (val.replace(/\D/g, '').length === 8) {
                                  buscarCepManualLT(val);
                                }
                              }}
                              className="w-full bg-[#0f172a] border border-[#1e293b] rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                            />
                            {isSearchingLTCep && (
                              <Loader2 className="w-3 h-3 text-cyan-400 animate-spin absolute right-2 top-2" />
                            )}
                          </div>
                        </div>
                        <div>
                          <label className="block text-slate-400 text-[10px] mb-0.5">Rua / Avenida *</label>
                          <input
                            type="text"
                            required
                            placeholder="Ex: Rua Central"
                            value={newLTStreet}
                            onChange={(e) => setNewLTStreet(e.target.value)}
                            className="w-full bg-[#0f172a] border border-[#1e293b] rounded-lg px-2.5 py-1.5 text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 text-[10px] mb-0.5">Número</label>
                          <input
                            type="text"
                            placeholder="100"
                            value={newLTNumber}
                            onChange={(e) => setNewLTNumber(e.target.value)}
                            className="w-full bg-[#0f172a] border border-[#1e293b] rounded-lg px-2.5 py-1.5 text-xs text-white"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-slate-400 text-[10px] mb-0.5">Bairro</label>
                          <input
                            type="text"
                            placeholder="Centro"
                            value={newLTNeighborhood}
                            onChange={(e) => setNewLTNeighborhood(e.target.value)}
                            className="w-full bg-[#0f172a] border border-[#1e293b] rounded-lg px-2.5 py-1.5 text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 text-[10px] mb-0.5">Cidade</label>
                          <input
                            type="text"
                            placeholder="Cidade"
                            value={newLTCity}
                            onChange={(e) => setNewLTCity(e.target.value)}
                            className="w-full bg-[#0f172a] border border-[#1e293b] rounded-lg px-2.5 py-1.5 text-xs text-white"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-300 font-bold mb-1">Designar Motorista</label>
                        <select
                          value={newLTDriver}
                          onChange={(e) => setNewLTDriver(e.target.value)}
                          className="w-full bg-[#020617] border border-[#1e293b] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                        >
                          <option value="">Selecione...</option>
                          {staffList.map(s => (
                            <option key={s.id} value={s.name}>{s.name} ({s.role})</option>
                          ))}
                          <option value="Motorista Terceirizado">Motorista Terceirizado</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-300 font-bold mb-1">Instruções / Portaria</label>
                        <input
                          type="text"
                          placeholder="Ex: Interfone 101"
                          value={newLTNotes}
                          onChange={(e) => setNewLTNotes(e.target.value)}
                          className="w-full bg-[#020617] border border-[#1e293b] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                    </div>

                    <div className="pt-2 border-t border-[#1e293b] flex items-center justify-between">
                      <span className="text-xs text-slate-400">
                        Total Estimado: <strong className="text-emerald-400 font-mono text-sm">
                          R$ {(Number(newLTServicePrice || 0) + calculateManualLTFee(newLTType, Number(newLTServicePrice || 0))).toFixed(2)}
                        </strong>
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowAddLevaModal(false)}
                          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 rounded-xl text-xs font-black transition cursor-pointer shadow-lg shadow-cyan-600/30"
                        >
                          Salvar e Iniciar Coleta
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= NOVA ABA: HISTÓRICO DE LAVAGEM ================= */}
        {activeTab === 'historico-lavagem' && (
          <div className="space-y-5">
            {/* Header & Ações */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0f172a] border border-[#1e293b] p-5 rounded-xl">
              <div>
                <h3 className="font-bold text-[#f8fafc] text-base flex items-center gap-2">
                  <History className="w-5 h-5 text-blue-400" />
                  Histórico de Lavagens & Atendimentos Concluídos
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Consulte todos os veículos finalizados, emissão de comprovantes, faturamento realizado e comissões da equipe.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportHistoryCSV}
                  className="bg-[#020617] hover:bg-slate-900 text-slate-200 border border-[#1e293b] px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition"
                >
                  <Download className="w-4 h-4 text-emerald-400" /> Exportar CSV
                </button>
                <button
                  onClick={() => setShowAddHistoryModal(true)}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition shadow-sm shadow-blue-600/30"
                >
                  <Plus className="w-4 h-4" /> Lançar Lavagem
                </button>
              </div>
            </div>

            {/* KPIs de Histórico */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-[#0f172a] border border-[#1e293b] p-3.5 rounded-xl">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-bold uppercase">Lavagens Concluídas</span>
                  <CheckCircle className="w-4 h-4 text-blue-400" />
                </div>
                <div className="text-xl font-black text-slate-100 mt-1">{deduplicateWashHistory(washHistory).length}</div>
              </div>

              <div className="bg-[#0f172a] border border-[#1e293b] p-3.5 rounded-xl">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-bold uppercase">Faturamento Histórico</span>
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-xl font-black text-emerald-400 mt-1">
                  R$ {deduplicateWashHistory(washHistory).reduce((acc, c) => acc + c.price, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              </div>

              <div className="bg-[#0f172a] border border-[#1e293b] p-3.5 rounded-xl">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-bold uppercase">Ticket Médio</span>
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                </div>
                <div className="text-xl font-black text-slate-100 mt-1">
                  R$ {deduplicateWashHistory(washHistory).length > 0 
                    ? (deduplicateWashHistory(washHistory).reduce((acc, c) => acc + c.price, 0) / deduplicateWashHistory(washHistory).length).toFixed(2) 
                    : '0.00'}
                </div>
              </div>

              <div className="bg-[#0f172a] border border-[#1e293b] p-3.5 rounded-xl">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-bold uppercase">Comissões Pagas</span>
                  <Percent className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-xl font-black text-amber-400 mt-1">
                  R$ {deduplicateWashHistory(washHistory).reduce((acc, c) => acc + c.commissionAmount, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            {/* Toolbar de Filtros Avançados */}
            <div className="bg-[#0f172a] border border-[#1e293b] p-4 rounded-xl flex flex-col md:flex-row gap-3 items-center justify-between">
              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                {/* Período */}
                <select
                  value={historyPeriod}
                  onChange={(e) => setHistoryPeriod(e.target.value as any)}
                  className="bg-[#020617] border border-[#1e293b] text-xs text-slate-200 rounded-lg px-3 py-1.5 focus:outline-none cursor-pointer font-medium"
                >
                  <option value="todos">Todos os Períodos</option>
                  <option value="hoje">Concluídos Hoje</option>
                  <option value="7dias">Últimos 7 dias</option>
                  <option value="mes">Este Mês</option>
                </select>

                {/* Lavador */}
                <select
                  value={historyLavador}
                  onChange={(e) => setHistoryLavador(e.target.value)}
                  className="bg-[#020617] border border-[#1e293b] text-xs text-slate-200 rounded-lg px-3 py-1.5 focus:outline-none cursor-pointer font-medium"
                >
                  <option value="todos">Todos os Lavadores</option>
                  {staffList.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>

                {/* Forma de Pagamento */}
                <select
                  value={historyPayment}
                  onChange={(e) => setHistoryPayment(e.target.value)}
                  className="bg-[#020617] border border-[#1e293b] text-xs text-slate-200 rounded-lg px-3 py-1.5 focus:outline-none cursor-pointer font-medium"
                >
                  <option value="todos">Todas as Formas de Pagamento</option>
                  <option value="PIX">PIX</option>
                  <option value="Cartão de Crédito">Cartão de Crédito</option>
                  <option value="Cartão de Débito">Cartão de Débito</option>
                  <option value="Dinheiro">Dinheiro</option>
                  <option value="Cortesia">Cortesia (Fidelidade)</option>
                </select>
              </div>

              {/* Busca */}
              <div className="relative w-full md:w-72">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar placa, veículo ou cliente..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="w-full bg-[#020617] border border-[#1e293b] rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Tabela do Histórico */}
            <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-[#020617] text-xs uppercase text-slate-400 font-bold border-b border-[#1e293b]">
                    <tr>
                      <th className="py-3.5 px-4">Conclusão</th>
                      <th className="py-3.5 px-4">Veículo & Placa</th>
                      <th className="py-3.5 px-4">Cliente</th>
                      <th className="py-3.5 px-4">Serviço Realizado</th>
                      <th className="py-3.5 px-4">Valor & Pagamento</th>
                      <th className="py-3.5 px-4">Lavador & Comissão</th>
                      <th className="py-3.5 px-4 text-right">Comprovante</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1e293b]">
                    {deduplicateWashHistory(washHistory)
                      .filter(item => {
                        const todayStr = new Date().toISOString().split('T')[0];
                        const now = new Date();
                        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                        const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

                        if (historyPeriod === 'hoje') {
                          if (item.date !== todayStr && !item.completedAt.toLowerCase().includes('hoje')) return false;
                        } else if (historyPeriod === '7dias') {
                          if (item.date && new Date(item.date) < sevenDaysAgo) return false;
                        } else if (historyPeriod === 'mes') {
                          if (item.date && !item.date.startsWith(currentMonthStr)) return false;
                        }

                        if (historyLavador !== 'todos' && item.lavadorId !== historyLavador) return false;
                        if (historyPayment !== 'todos' && item.paymentMethod !== historyPayment) return false;

                        if (historySearch.trim()) {
                          const q = historySearch.toLowerCase();
                          const matchPlate = item.plate.toLowerCase().includes(q);
                          const matchVeh = item.vehicle.toLowerCase().includes(q);
                          const matchClient = item.clientName.toLowerCase().includes(q);
                          const matchService = item.service.toLowerCase().includes(q);
                          if (!matchPlate && !matchVeh && !matchClient && !matchService) return false;
                        }
                        return true;
                      })
                      .map(item => (
                        <tr key={item.id} className="hover:bg-slate-800/20 transition">
                          <td className="py-4 px-4 whitespace-nowrap">
                            <div className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                              {item.completedAt}
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              Duração: {item.durationMinutes || 40} min
                            </div>
                          </td>

                          <td className="py-4 px-4">
                            <div className="font-semibold text-slate-200 text-xs">{item.vehicle}</div>
                            <span className="inline-block mt-0.5 text-[10px] font-mono px-1.5 py-0.5 bg-[#020617] text-blue-400 border border-blue-500/30 rounded font-bold">
                              {item.plate}
                            </span>
                          </td>

                          <td className="py-4 px-4">
                            <div className="font-medium text-slate-200 text-xs">{item.clientName}</div>
                            {item.clientPhone && (
                              <div className="text-[11px] text-slate-500 font-mono mt-0.5">{item.clientPhone}</div>
                            )}
                          </td>

                          <td className="py-4 px-4">
                            <div className="text-xs text-slate-200 font-medium">{item.service}</div>
                            {item.notes && (
                              <div className="text-[10px] text-slate-500 truncate max-w-xs" title={item.notes}>
                                {item.notes}
                              </div>
                            )}
                          </td>

                          <td className="py-4 px-4">
                            <div className="text-xs font-bold text-emerald-400">
                              R$ {item.price.toFixed(2)}
                            </div>
                            <span className="inline-block mt-0.5 text-[10px] px-2 py-0.5 bg-slate-800 text-slate-300 rounded font-medium">
                              {item.paymentMethod}
                            </span>
                          </td>

                          <td className="py-4 px-4">
                            <div className="text-xs text-slate-200">{item.lavadorName || 'Geral'}</div>
                            <div className="text-[11px] text-indigo-400 font-medium">
                              Comissão: R$ {item.commissionAmount.toFixed(2)} ({item.commissionRate}%)
                            </div>
                          </td>

                          <td className="py-4 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setSelectedWashReceipt(item)}
                                className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 text-xs font-bold px-2.5 py-1.5 rounded-lg transition inline-flex items-center gap-1"
                                title="Visualizar e Imprimir Comprovante"
                              >
                                <FileText className="w-3.5 h-3.5" /> Recibo
                              </button>
                              <button
                                onClick={() => handleDeleteHistoryItem(item.id)}
                                className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition"
                                title="Excluir do Histórico"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}

                    {deduplicateWashHistory(washHistory).length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-500 text-xs">
                          Nenhum registro no histórico de lavagens até o momento.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================= ABA 3: INSUMOS & ESTOQUE INTERNO ================= */}
        {activeTab === 'produtos' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0f172a] border border-[#1e293b] p-5 rounded-xl">
              <div>
                <h3 className="font-bold text-[#f8fafc] text-base flex items-center gap-2">
                  <Package className="w-5 h-5 text-blue-400" />
                  Insumos & Estoque de Uso Interno (Lavagem & Pátio)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Gerencie produtos consumidos internamente na lavagem e estética automotiva. Para produtos vendidos ao cliente, use a dashboard de Vendas.
                </p>
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setActiveTab('vendas')}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-3.5 py-2 rounded-lg text-xs font-black flex items-center gap-1.5 transition shadow-md shadow-amber-500/20 cursor-pointer"
                >
                  <ShoppingBag className="w-4 h-4" /> Ir para Vendas & Balcão (PDV)
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewProductModal(true)}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Cadastrar Insumo
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Painel Insumos de Uso Interno */}
              <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-5 space-y-4">
                <div className="flex justify-between items-center border-b border-[#1e293b] pb-3">
                  <div>
                    <h3 className="font-bold text-slate-100 flex items-center gap-2 text-sm">
                      <Droplet className="w-4 h-4 text-blue-400" /> Produtos de Uso Interno (Insumos)
                    </h3>
                    <p className="text-[11px] text-slate-400">Produtos consumidos na lavagem e detalhamento.</p>
                  </div>
                  <span className="text-xs text-slate-400 font-bold">
                    {products.filter(p => p.category === 'insumo').length} Itens
                  </span>
                </div>

                <div className="space-y-3">
                  {products.filter(p => p.category === 'insumo').map(prod => (
                    <div key={prod.id} className="flex items-center justify-between p-3.5 bg-[#020617] rounded-lg border border-[#1e293b]">
                      <div>
                        <p className="text-xs font-semibold text-slate-200">{prod.name}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">Estoque: {prod.stock} {prod.unit} restantes</p>
                      </div>
                      {prod.stock <= prod.minStock ? (
                        <span className="text-[10px] px-2.5 py-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-full font-bold flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Estoque Baixo
                        </span>
                      ) : (
                        <span className="text-[10px] px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full font-bold">
                          Estoque OK
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Painel de Transição: Loja & Vendas de Balcão */}
              <div className="bg-gradient-to-br from-amber-950/20 via-[#0f172a] to-[#0f172a] border border-amber-500/40 rounded-xl p-5 space-y-4 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center border-b border-[#1e293b] pb-3">
                    <div>
                      <h3 className="font-bold text-amber-300 flex items-center gap-2 text-sm">
                        <ShoppingBag className="w-4 h-4 text-amber-400" /> Loja & Vendas de Balcão (PDV)
                      </h3>
                      <p className="text-[11px] text-slate-400">Produtos comerciais vendidos diretamente aos clientes.</p>
                    </div>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold">
                      Dashboard Exclusiva
                    </span>
                  </div>
                  
                  <div className="space-y-3 pt-3">
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Conforme solicitado, os produtos para venda no balcão agora contam com uma <strong>dashboard exclusiva de vendas</strong> com:
                    </p>
                    <ul className="text-xs text-slate-400 space-y-1.5 list-disc list-inside">
                      <li>Catálogo dedicado para produtos de venda (preço de custo, margem de lucro e preço final).</li>
                      <li>Frente de Caixa (PDV) com carrinho de compras rápido e cálculo de troco.</li>
                      <li>Baixa automática no estoque ao finalizar a venda.</li>
                      <li>Lançamento automático da receita no <strong>Controle de Caixa</strong>.</li>
                      <li>Emissão de comprovante e recibo para WhatsApp.</li>
                    </ul>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#1e293b]">
                  <button
                    type="button"
                    onClick={() => setActiveTab('vendas')}
                    className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-amber-500/20"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    <span>Acessar Dashboard de Vendas & Balcão (PDV)</span>
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ================= ABA 4: COMISSÕES DA EQUIPE ================= */}
        {activeTab === 'comissoes' && (
          <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-5 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1e293b] pb-4">
              <div>
                <h3 className="font-bold text-[#f8fafc] text-base flex items-center gap-2">
                  <Percent className="w-5 h-5 text-indigo-400" />
                  Relatório de Comissões Acumuladas da Equipe
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Calculado automaticamente com base na conclusão dos serviços de lavagem/estética atribuídos.
                </p>
              </div>

              <button
                onClick={handleSettleCommissions}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition shadow-sm shadow-emerald-600/30"
              >
                <Download className="w-4 h-4" /> Pagar / Fechar Quinzena
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {staffList.map(staff => (
                <div key={staff.id} className="bg-[#020617] p-4 rounded-xl border border-[#1e293b] flex flex-col justify-between space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs">
                        {staff.initials}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-200 text-sm">{staff.name}</h4>
                        <p className="text-[11px] text-slate-500">{staff.role} · {staff.defaultCommission}% comissão</p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#1e293b] flex justify-between items-baseline">
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase">Lavagens no Mês</span>
                      <span className="text-sm font-bold text-slate-200">{staff.completedWashes} concluídas</span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 block uppercase">Comissão Acumulada</span>
                      <span className="text-lg font-bold text-emerald-400">
                        R$ {staff.accumulatedCommission.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================= ABA 5: CONFIGURAÇÕES DA EMPRESA ================= */}
        {activeTab === 'configuracoes-empresa' && (
          <TenantConfigSettings
            tenant={currentTenant}
            initialSubTab={configInitialSubTab}
            staffList={staffList}
            onUpdateStaffList={(newStaff) => {
              setStaffList(newStaff);
              localStorage.setItem(`saas_tenant_staff_${currentTenant.id}`, JSON.stringify(newStaff));
              showToast('Equipe de funcionários atualizada!');
            }}
            products={products}
            onUpdateProducts={(newProds) => {
              setProducts(newProds);
              localStorage.setItem(`saas_tenant_products_${currentTenant.id}`, JSON.stringify(newProds));
              showToast('Estoque de produtos atualizado!');
            }}
            onUpdateTenantDetails={(updated) => {
              setCurrentTenant(updated);
              saveTenantToFirestore(updated).catch(console.error);
              if (onUpdateTenant) {
                onUpdateTenant(updated);
              }
              showToast('Configurações da empresa salvas na Nuvem (Firestore)!');
            }}

          />
        )}

        {/* ================= ABA: CONTROLE DE CAIXA & FLUXO FINANCEIRO ================= */}
        {activeTab === 'caixa' && (
          <FluxoCaixaWorkspace
            tenant={tenant}
            washHistory={washHistory}
            onToast={showToast}
          />
        )}

        {/* ================= ABA: LOJA DO BALCÃO & VENDAS (PDV) ================= */}
        {activeTab === 'vendas' && (
          <VendasBalcaoWorkspace
            tenant={tenant}
            onToast={showToast}
          />
        )}

        {/* ================= ABA: GESTÃO DE CLIENTES & BALCÃO ================= */}
        {activeTab === 'clientes' && (
          <ClientesWorkspace 
            tenantId={tenant.id}
            tenantNome={tenant.nomeFantasia || tenant.name}
            tenantSlug={totemCleanSlug}
            tenant={tenant}
            appointments={appointments}
          />
        )}

        {/* ================= ABA: TOTEM DE AUTOATENDIMENTO (TABLET) ================= */}
        {activeTab === 'totem' && (
          <div className="space-y-6">
            
            {/* Header Hero Banner */}
            <div className="bg-gradient-to-r from-purple-950/40 via-slate-900 to-indigo-950/30 border border-purple-500/30 rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-purple-600/20 text-purple-400 border border-purple-500/30 flex items-center justify-center shrink-0 shadow-lg shadow-purple-600/20">
                    <Tablet className="w-8 h-8" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl sm:text-2xl font-black text-white">
                        Totem de Autoatendimento (Tablet)
                      </h2>
                      <span className="bg-purple-500/20 text-purple-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-purple-500/30">
                        NOVO RECURSO
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
                      Transforme qualquer tablet em um terminal de cadastro para seus clientes na recepção do seu lava-jato. O próprio cliente cadastra seu nome, WhatsApp, veículo e cria sua senha, recebendo na hora o QR Code para baixar o app no celular!
                    </p>
                  </div>
                </div>

                <div className="shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  {onOpenTotemMode && (
                    <button
                      onClick={onOpenTotemMode}
                      className="px-5 py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition shadow-lg shadow-purple-600/30 cursor-pointer active:scale-[0.98]"
                    >
                      <Tablet className="w-4 h-4" />
                      <span>Iniciar Totem neste Aparelho</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Painel de Controle de Notificações Push (Mesmo com Painel Fechado) */}
            <div className="bg-[#0f172a] border border-blue-500/30 rounded-2xl p-6 sm:p-7 shadow-xl relative overflow-hidden">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="space-y-3 max-w-2xl">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/30">
                      <BellRing className="w-5 h-5" />
                    </div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      Alertas Push no Navegador (Mesmo com Aba Fechada)
                    </h3>
                    {isPushSubscribed ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        Push Ativo & Monitorando em Segundo Plano
                      </span>
                    ) : pushPermission === 'denied' ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Bloqueado no Navegador
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                        <Clock className="w-3.5 h-3.5" />
                        Aguardando Ativação
                      </span>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    Com o sistema integrado ao <strong className="text-white">Firebase Cloud Messaging (FCM)</strong> e à <strong className="text-white">Web Push API</strong>, você recebe uma notificação sonora e visual na área de trabalho do computador ou no celular <span className="text-amber-300 font-semibold">sempre que um novo cliente se cadastrar no Totem</span>, mesmo se o navegador estiver minimizado ou com o painel fechado! Ao clicar no alerta, o sistema abre diretamente a aba <span className="text-cyan-300 font-semibold">"Gestão de Clientes & Balcão"</span>.
                  </p>
                </div>

                <div className="shrink-0 flex flex-wrap sm:flex-nowrap items-center gap-3">
                  <button
                    onClick={handleTogglePushNotifications}
                    disabled={isRequestingPush}
                    className={`px-5 py-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-lg active:scale-[0.98] ${
                      isPushSubscribed
                        ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                        : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-600/30'
                    }`}
                  >
                    {isRequestingPush ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Configurando...</span>
                      </>
                    ) : isPushSubscribed ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span>Pausar Alertas Push</span>
                      </>
                    ) : (
                      <>
                        <BellRing className="w-4 h-4" />
                        <span>Ativar Alertas no Navegador</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleTestPushNotification}
                    disabled={isTestingPush}
                    className="px-4 py-3 bg-[#020617] hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer active:scale-[0.98]"
                    title="Dispara uma notificação de teste para verificar se seu navegador e áudio estão recebendo"
                  >
                    {isTestingPush ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                        <span>Disparando...</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-4 h-4 text-blue-400" />
                        <span>Testar Notificação</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {pushPermission === 'denied' && (
                <div className="mt-4 p-3.5 bg-rose-950/30 border border-rose-500/30 rounded-xl flex items-start gap-3 text-xs text-rose-300">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Notificações estão bloqueadas pelo seu navegador:</span>
                    <p className="text-[11px] text-rose-200/80 mt-0.5">
                      Para receber alertas com a aba fechada, clique no ícone de cadeado ou controles de site ao lado do link no topo do navegador (ao lado de washautoos.netlify.app) e altere a opção "Notificações" para "Permitir".
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Cards de Acesso Rápido ao Totem */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              
              {/* Card 1: Abrir no Tablet via Link */}
              <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-5 space-y-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-100 mb-1">
                    <Smartphone className="w-4 h-4 text-purple-400" />
                    <span>Link Direto para o Tablet</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Abra este link no navegador (Chrome/Safari) do seu tablet e fixe na tela inicial para usar como Totem.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="p-3 bg-[#020617] border border-slate-800 rounded-xl font-mono text-[11px] text-purple-300 truncate select-all">
                    {totemTargetUrl}
                  </div>
                  <button
                    onClick={handleCopyTotemUrl}
                    className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                      copiedTotemUrl
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                    }`}
                  >
                    {copiedTotemUrl ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Link Copiado com Sucesso!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copiar Link do Totem</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Card 2: QR Code para Configurar o Tablet */}
              <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-5 space-y-3 flex flex-col items-center justify-between text-center">
                <div>
                  <div className="flex items-center justify-center gap-2 text-sm font-bold text-slate-100 mb-1">
                    <QrCode className="w-4 h-4 text-cyan-400" />
                    <span>Escanear com o Tablet</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Aponte a câmera do tablet para este QR Code para abrir o Totem instantaneamente.
                  </p>
                </div>

                <div className="bg-white p-3 rounded-xl shadow-lg border-2 border-slate-800">
                  <QRCodeSVG
                    value={totemTargetUrl}
                    size={130}
                    level="H"
                    marginSize={1}
                  />
                </div>

                <span className="text-[11px] text-slate-500 font-mono">
                  {tenant.slug || tenant.id}
                </span>
              </div>

              {/* Card 3: Configuração & Segurança (PIN de Saída) */}
              <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-5 space-y-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-100 mb-1">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>PIN de Saída do Totem</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Código de segurança necessário para fechar a tela de autoatendimento e voltar ao painel administrativo.
                  </p>
                </div>

                <div className="p-4 bg-[#020617] border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">PIN Ativo de Fábrica:</span>
                    <span className="font-mono font-black text-emerald-400 text-lg bg-emerald-500/10 px-3 py-0.5 rounded-lg border border-emerald-500/20">
                      {tenant.tempPassword || '1234'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Você pode digitar este código a qualquer momento no botão de cadeado superior do Totem.
                  </p>
                </div>

                <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>Proteção ativa contra toques indevidos de clientes</span>
                </div>
              </div>

            </div>

            {/* Como Funciona o Totem (Passo a Passo Ilustrado) */}
            <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-6 space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                Como Funciona na Prática no seu Lava-Jato
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 bg-[#020617] border border-slate-800/80 rounded-xl space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 font-bold flex items-center justify-center text-sm">
                    1
                  </div>
                  <h4 className="font-bold text-xs text-slate-200">Cliente Chega no Lava-Jato</h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Na recepção ou pátio, o cliente toca na tela do tablet com a logo do seu lava-jato.
                  </p>
                </div>

                <div className="p-4 bg-[#020617] border border-slate-800/80 rounded-xl space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-cyan-600/20 text-cyan-400 font-bold flex items-center justify-center text-sm">
                    2
                  </div>
                  <h4 className="font-bold text-xs text-slate-200">Cadastro de Veículo & Dados</h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    O próprio cliente digita nome, WhatsApp, modelo do carro e placa em botões grandes e acessíveis.
                  </p>
                </div>

                <div className="p-4 bg-[#020617] border border-slate-800/80 rounded-xl space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 font-bold flex items-center justify-center text-sm">
                    3
                  </div>
                  <h4 className="font-bold text-xs text-slate-200">Criação da Senha de Acesso</h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Ele cria a senha dele ali mesmo no tablet, garantindo acesso privativo ao portal e histórico de lavagens.
                  </p>
                </div>

                <div className="p-4 bg-[#020617] border border-slate-800/80 rounded-xl space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-600/20 text-emerald-400 font-bold flex items-center justify-center text-sm">
                    4
                  </div>
                  <h4 className="font-bold text-xs text-slate-200">Escaneia o QR Code & Baixa o App</h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    O totem exibe o QR Code dinâmico. O cliente aponta a câmera, instala o app no celular e entra com a senha que acabou de criar!
                  </p>
                </div>
              </div>
            </div>

            {/* Lista de Cadastros Recentes Realizados pelo Totem */}
            <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-400" />
                  <h3 className="text-base font-bold text-white">Cadastros Realizados no Totem</h3>
                </div>
                <span className="text-xs bg-purple-500/10 text-purple-300 border border-purple-500/20 px-2.5 py-1 rounded-full font-bold">
                  {totemClientsList.length} clientes cadastrados
                </span>
              </div>

              {totemClientsList.length === 0 ? (
                <div className="py-12 text-center space-y-3">
                  <Tablet className="w-10 h-10 text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-400">
                    Nenhum cadastro realizado via Totem ainda. Inicie o modo Totem no seu tablet para começar a receber cadastros automáticos!
                  </p>
                  {onOpenTotemMode && (
                    <button
                      onClick={onOpenTotemMode}
                      className="px-4 py-2 bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 border border-purple-500/40 rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      Testar Modo Totem Agora
                    </button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#020617] text-slate-400 uppercase font-bold text-[10px] border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-4">Cliente</th>
                        <th className="py-3 px-4">WhatsApp</th>
                        <th className="py-3 px-4">Veículo & Placa</th>
                        <th className="py-3 px-4">Data do Cadastro</th>
                        <th className="py-3 px-4 text-right">Origem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {totemClientsList.map((c: any) => (
                        <tr key={c.id || c.email} className="hover:bg-slate-800/20 transition">
                          <td className="py-3 px-4 font-bold text-slate-200">
                            <div>{c.name || 'Cliente'}</div>
                            <div className="text-[10px] text-slate-400 font-mono font-normal">{c.email}</div>
                          </td>
                          <td className="py-3 px-4 text-emerald-400 font-mono">
                            {c.phone || '-'}
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-semibold text-slate-300">{c.vehicle?.modelo || 'Veículo'}</span>
                            <span className="ml-2 px-1.5 py-0.5 bg-slate-900 text-slate-300 font-mono font-bold text-[10px] rounded border border-slate-700">
                              {c.vehicle?.placa || '-'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-400 font-mono">
                            {c.createdAt ? new Date(c.createdAt).toLocaleDateString('pt-BR') : 'Hoje'}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-[10px] font-bold">
                              Totem Tablet
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        )}

        {/* ================= ABA: BANNERS PROMOCIONAIS DO APLICATIVO ================= */}
        {activeTab === 'banners-app' && (
          <PromoBannersWorkspace 
            tenant={tenant}
            onToast={showToast}
          />
        )}

        {/* ================= ABA: TROCA DE ÓLEO & LUBRIFICAÇÃO ================= */}
        {activeTab === 'troca-oleo' && (
          <TrocaOleoWorkspace
            tenant={tenant}
            onToast={showToast}
          />
        )}


        {/* ================= ABA 6: MÓDULOS SAAS ROOT ================= */}
        {activeTab === 'saas-config' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Override Toggles & Visibilidade de Selos */}
            <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-5 space-y-4">
              <div className="border-b border-[#1e293b] pb-3">
                <h3 className="text-base font-bold text-[#f8fafc] flex items-center gap-2">
                  <Settings className="w-4 h-4 text-indigo-400" />
                  Módulos Ativos no Ambiente da Empresa (Tenant)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Como Super Admin, você pode habilitar ou desabilitar recursos em tempo real para este cliente.
                </p>
              </div>

              {/* Visibilidade do Selo "Celular ⇄ Computador Sincronizados" */}
              <div className="p-3.5 bg-[#020617] border border-cyan-500/30 rounded-xl space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-100">
                      <Smartphone className="w-4 h-4 text-cyan-400" />
                      <span>Selo "Celular ⇄ Computador Sincronizados"</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      {showSyncBadge 
                        ? 'Atualmente visível no cabeçalho do painel operacional.' 
                        : 'Atualmente oculto (interface limpa sem indicador de dispositivos).'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !showSyncBadge;
                      setShowSyncBadge(next);
                      localStorage.setItem(`saas_show_sync_badge_${tenant.id}`, next ? 'true' : 'false');
                      showToast(next ? 'Selo de sincronização ativado no topo!' : 'Selo de sincronização ocultado do cabeçalho!');
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 ${
                      showSyncBadge 
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm shadow-emerald-600/30' 
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                    }`}
                  >
                    {showSyncBadge ? 'Visível (Exibindo)' : 'Oculto (Padrão)'}
                  </button>
                </div>
                <div className="text-[10px] text-slate-500 flex items-center gap-1.5 pt-1 border-t border-slate-900">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  <span>Configuração solicitada: o selo pode permanecer oculto para não sobrecarregar o visual do operador.</span>
                </div>
              </div>

              <div className="space-y-2.5">
                {modules.map(mod => (
                  <div key={mod.id} className="p-3 bg-[#020617] border border-[#1e293b] rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs">
                      <CheckCircle className={`w-4 h-4 ${mod.enabled ? 'text-emerald-400' : 'text-slate-600'}`} />
                      <span className="font-semibold text-slate-200">{mod.name}</span>
                    </div>
                    <button
                      onClick={() => setModules(prev => prev.map(m => m.id === mod.id ? { ...m, enabled: !m.enabled } : m))}
                      className={`px-3 py-1 rounded text-xs font-bold transition cursor-pointer ${
                        mod.enabled ? 'bg-indigo-600 text-white shadow-sm' : 'bg-[#1e293b] text-slate-400'
                      }`}
                    >
                      {mod.enabled ? 'Ativo' : 'Desativado'}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Transmissão de Notificações em Tempo Real (Box 1000 & Tenants) */}
            <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-5 space-y-4 flex flex-col justify-between">
              <div>
                <div className="border-b border-[#1e293b] pb-3 mb-4">
                  <h3 className="text-base font-bold text-[#f8fafc] flex items-center gap-2">
                    <Radio className="w-4 h-4 text-indigo-400 animate-pulse" />
                    Transmitir Notificação em Tempo Real (SaaS Root)
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Exiba comunicados operacionais ou avisos prioritários diretamente no topo do painel dos operadores.
                  </p>
                </div>

                {/* Seleção de Destinatário */}
                <div className="space-y-2 mb-3">
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Destino da Notificação
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setBroadcastTargetMode('box1000')}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        broadcastTargetMode === 'box1000'
                          ? 'bg-indigo-600/25 border-indigo-500 text-indigo-200 shadow-md shadow-indigo-600/20'
                          : 'bg-[#020617] border-[#1e293b] text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span>🎯 Box 1000</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/40 text-indigo-200 font-mono font-black">
                        Alvo Principal
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setBroadcastTargetMode('current')}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        broadcastTargetMode === 'current'
                          ? 'bg-indigo-600/25 border-indigo-500 text-indigo-200 shadow-md shadow-indigo-600/20'
                          : 'bg-[#020617] border-[#1e293b] text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Building2 className="w-3.5 h-3.5" />
                      <span className="truncate">{tenant.name || 'Esta Empresa'}</span>
                    </button>
                  </div>

                  <div className="text-[11px] text-slate-300 bg-[#020617] p-2.5 rounded-lg border border-[#1e293b] flex items-center justify-between">
                    <span className="text-slate-400">Destinatário:</span>
                    <strong className="text-indigo-400 font-semibold truncate ml-2">
                      {broadcastTargetMode === 'box1000'
                        ? (box1000Tenant.nomeFantasia || box1000Tenant.name)
                        : (tenant.nomeFantasia || tenant.name)}
                    </strong>
                  </div>
                </div>

                {/* Nível de Urgência */}
                <div className="space-y-1.5 mb-3">
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Nível de Urgência
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'info' as const, label: 'Informativo', color: 'border-indigo-500 text-indigo-300 bg-indigo-500/20' },
                      { id: 'alerta' as const, label: 'Alerta Operacional', color: 'border-amber-500 text-amber-300 bg-amber-500/20' },
                      { id: 'urgente' as const, label: 'Crítico / Urgente', color: 'border-rose-500 text-rose-300 bg-rose-500/20' }
                    ].map(u => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => setBroadcastUrgency(u.id)}
                        className={`py-1.5 px-2 rounded-lg text-[10px] font-bold border transition text-center cursor-pointer ${
                          broadcastUrgency === u.id ? u.color : 'border-[#1e293b] bg-[#020617] text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        {u.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Modelos Rápidos de Mensagem */}
                <div className="space-y-1.5 mb-3">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Modelos Rápidos para Box 1000
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      'Aviso aos operadores do Box 1000: Manutenção programada às 22h.',
                      'Novo módulo de Troca de Óleo e Lubrificação ativado no Box 1000.',
                      'Comunicado Root: Sincronização em nuvem Firestore 100% ativa.',
                      'Lembrete: realizar fechamento das comissões do dia.'
                    ].map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setBroadcastMessage(preset)}
                        className="text-[10px] bg-[#020617] hover:bg-slate-900 border border-[#1e293b] text-slate-400 hover:text-indigo-300 px-2 py-1 rounded-md transition cursor-pointer"
                      >
                        + {preset.slice(0, 32)}...
                      </button>
                    ))}
                  </div>
                </div>

                <form onSubmit={async (e) => {
                  e.preventDefault();
                  if (!broadcastMessage.trim()) return;
                  setIsSendingBroadcast(true);

                  const targetObj = broadcastTargetMode === 'box1000' ? box1000Tenant : tenant;
                  try {
                    const sent = await sendBroadcastNotificationFirestore({
                      tenantId: targetObj.id,
                      tenantName: targetObj.nomeFantasia || targetObj.name,
                      message: broadcastMessage,
                      urgency: broadcastUrgency,
                      sender: 'Administrador SaaS Root'
                    });

                    setSentBroadcasts(prev => {
                      const updated = [sent, ...prev.filter(b => b.id !== sent.id)];
                      localStorage.setItem('saas_sent_broadcasts', JSON.stringify(updated.slice(0, 10)));
                      return updated;
                    });

                    // Se enviou para o tenant atual, atualiza de imediato na tela
                    if (targetObj.id === tenant.id) {
                      setActiveBroadcast(sent);
                    }

                    showToast(`Notificação transmitida com sucesso para os usuários de ${targetObj.nomeFantasia || targetObj.name}!`);
                    setBroadcastMessage('');
                  } catch (err: any) {
                    showToast('Erro ao transmitir: ' + (err.message || 'Falha de envio'));
                  } finally {
                    setIsSendingBroadcast(false);
                  }
                }} className="space-y-3">
                  <textarea
                    rows={3}
                    value={broadcastMessage}
                    onChange={(e) => setBroadcastMessage(e.target.value)}
                    placeholder="Digite o comunicado oficial para os operadores e gerência do lava-jato..."
                    className="w-full bg-[#020617] border border-[#1e293b] rounded-lg p-3 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 resize-none placeholder:text-slate-600"
                  />

                  <button
                    type="submit"
                    disabled={isSendingBroadcast || !broadcastMessage.trim()}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm shadow-indigo-600/30 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>
                      {isSendingBroadcast
                        ? 'Transmitindo via Firestore...'
                        : `Transmitir Notificação para ${broadcastTargetMode === 'box1000' ? 'Box 1000' : tenant.name}`}
                    </span>
                  </button>
                </form>

                {/* Lista de Notificações Transmitidas */}
                {sentBroadcasts.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-[#1e293b] space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      <span>Últimas Transmissões Ativas</span>
                      <button
                        type="button"
                        onClick={() => {
                          setSentBroadcasts([]);
                          localStorage.removeItem('saas_sent_broadcasts');
                        }}
                        className="text-slate-500 hover:text-slate-300 transition cursor-pointer"
                      >
                        Limpar Histórico
                      </button>
                    </div>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {sentBroadcasts.slice(0, 3).map((b) => (
                        <div key={b.id} className="p-2 bg-[#020617] border border-[#1e293b] rounded-lg text-xs flex items-center justify-between gap-2">
                          <div className="truncate">
                            <span className="font-bold text-indigo-300 mr-1.5">[{b.tenantName}]:</span>
                            <span className="text-slate-300">{b.message}</span>
                          </div>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20 shrink-0">
                            Entregue
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-[#1e293b] text-[11px] text-slate-500 flex items-center justify-between">
                <span>Auditoria Root SaaS ativa</span>
                <span className="text-emerald-400 font-mono">Firestore RealTime Sync</span>
              </div>
            </div>

          </div>
        )}

        {/* ================= ABA 7: COMPRA DO APLICATIVO (PLANO VITALÍCIO R$ 4.000) ================= */}
        {activeTab === 'comprar-vitalicio' && (
          <div className="space-y-6">

            {/* Sucesso imediato caso tenha acabado de comprar */}
            {showPurchaseSuccessBanner && (
              <div className="p-4 bg-emerald-500/20 border border-emerald-500/40 rounded-2xl text-emerald-200 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-emerald-300">Licença Vitalícia Ativada com Sucesso!</h4>
                    <p className="text-xs text-emerald-200/90">
                      O aplicativo agora é de sua posse definitiva. Não haverá mais cobranças de mensalidades.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPurchaseSuccessBanner(false)}
                  className="text-emerald-400 hover:text-white p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {tenant.plan === 'Vitalicio' ? (
              /* ================= VISÃO DO CLIENTE QUE JÁ COMPROU (CERTIFICADO VITALÍCIO) ================= */
              <div className="bg-gradient-to-br from-amber-950/30 via-slate-950 to-yellow-950/20 border border-amber-500/50 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-amber-500/20 pb-6 mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-yellow-400 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/30 shrink-0">
                      <Sparkles className="w-8 h-8" />
                    </div>
                    <div>
                      <span className="text-[11px] font-black tracking-widest uppercase bg-amber-500/20 text-amber-300 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                        Certificado Oficial de Licença
                      </span>
                      <h2 className="text-xl sm:text-2xl font-black text-slate-100 mt-1">
                        Licença Vitalícia Permanente Ativa
                      </h2>
                      <p className="text-xs text-slate-400">
                        Aplicativo próprio de uso definitivo para o lava-jato
                      </p>
                    </div>
                  </div>

                  <div className="text-left sm:text-right">
                    <span className="text-xs text-slate-400 block">Status da Mensalidade</span>
                    <span className="text-sm font-black text-emerald-400 flex items-center sm:justify-end gap-1.5 mt-0.5">
                      <Check className="w-4 h-4" /> 0% Mensalidade (Isento para sempre)
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
                    <span className="text-[11px] text-slate-400 block mb-1">Empresa Licenciada</span>
                    <span className="text-sm font-bold text-slate-100">{tenant.nomeFantasia || tenant.name}</span>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">{tenant.domain}</p>
                  </div>

                  <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
                    <span className="text-[11px] text-slate-400 block mb-1">Valor da Aquisição</span>
                    <span className="text-sm font-bold text-amber-300 font-mono">R$ 4.000,00</span>
                    <p className="text-[10px] text-emerald-400 font-semibold mt-0.5">Pagamento Único Quitado</p>
                  </div>

                  <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
                    <span className="text-[11px] text-slate-400 block mb-1">Código de Registro</span>
                    <span className="text-xs font-mono font-bold text-slate-200">
                      LIC-{tenant.id.toUpperCase()}-LIFETIME
                    </span>
                    <p className="text-[10px] text-slate-500 mt-0.5">Assinatura digital validada</p>
                  </div>

                  <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
                    <span className="text-[11px] text-slate-400 block mb-1">Suporte & Atualizações</span>
                    <span className="text-sm font-bold text-emerald-400">Inclusos Vitalícios</span>
                    <p className="text-[10px] text-slate-500 mt-0.5">Garantia contínua de funcionamento</p>
                  </div>
                </div>

                <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-3">
                  <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-2">
                    <Check className="w-4 h-4 text-amber-400" />
                    Benefícios e Recursos Inclusos na sua Licença Vitalícia:
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs text-slate-300">
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Usuários e lavadores ilimitados</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Fila de lavagem e controle de pátio</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Agendamentos online em tempo real</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Disparo de WhatsApp Bot automático</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Relatórios financeiros e DRE completo</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Portal do Cliente via Totem QR Code</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-5 border-t border-amber-500/20 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
                  <span>
                    ✓ Esta licença concede posse definitiva de uso para <strong>{tenant.name}</strong> sem expiração.
                  </span>
                  <button
                    onClick={() => window.print()}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-lg font-semibold transition flex items-center gap-2 cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-amber-400" /> Imprimir Certificado de Aquisição
                  </button>
                </div>
              </div>
            ) : (
              /* ================= VISÃO DE COMPRA DO APLICATIVO (R$ 4.000,00) ================= */
              <div className="space-y-6">

                {/* Hero Banner de Compra Definitiva */}
                <div className="bg-gradient-to-br from-amber-950/40 via-slate-950 to-indigo-950/30 border border-amber-500/40 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="max-w-2xl">
                      <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 px-3 py-1 rounded-full shadow-md mb-3">
                        <Sparkles className="w-3.5 h-3.5" /> Compra Definitiva do Aplicativo
                      </span>
                      <h2 className="text-2xl sm:text-3xl font-black text-slate-100 leading-tight">
                        Adquira a Licença Vitalícia por R$ 4.000,00
                      </h2>
                      <p className="text-sm text-slate-300 mt-2 leading-relaxed">
                        Livre seu lava-jato de mensalidades recorrentes para sempre. Comprando a licença do aplicativo por uma taxa única de R$ 4.000,00, o sistema é seu em definitivo, com todos os recursos liberados e suporte incluso.
                      </p>
                    </div>

                    <div className="bg-slate-900/90 border border-amber-500/30 rounded-2xl p-5 text-center shrink-0 min-w-[260px] shadow-xl">
                      <span className="text-[11px] text-slate-400 uppercase font-bold tracking-wider block">
                        Valor de Venda do Aplicativo
                      </span>
                      <div className="text-3xl sm:text-4xl font-black text-amber-300 mt-1">
                        R$ 4.000<span className="text-lg font-bold text-amber-400">,00</span>
                      </div>
                      <span className="text-xs text-emerald-400 font-semibold block mt-1">
                        Pagamento Único • Sem Mensalidades
                      </span>
                      <p className="text-[11px] text-slate-500 mt-2 border-t border-slate-800 pt-2">
                        Equivale a menos de 8 meses do plano tradicional!
                      </p>
                    </div>
                  </div>
                </div>

                {/* Comparativo: Assinatura Mensal vs Compra Vitalícia */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-sm text-slate-300">Modelo Mensal Tradicional</h3>
                      <span className="text-xs text-slate-500 font-mono">R$ 499 /mês</span>
                    </div>
                    <ul className="text-xs text-slate-400 space-y-2">
                      <li className="flex items-center gap-2">
                        <span className="text-rose-400">✕</span> Custo no 1º ano: <strong>R$ 5.988,00</strong>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-rose-400">✕</span> Custo em 2 anos: <strong>R$ 11.976,00</strong>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-rose-400">✕</span> Cobrança contínua todos os meses
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-rose-400">✕</span> Bloqueio imediato em caso de atraso
                      </li>
                    </ul>
                  </div>

                  <div className="bg-gradient-to-br from-amber-950/20 to-slate-950 border border-amber-500/40 rounded-xl p-5 space-y-3 shadow-lg">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-sm text-amber-300 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-amber-400" /> Compra Vitalícia (Definitiva)
                      </h3>
                      <span className="text-xs text-amber-300 font-bold font-mono">R$ 4.000 (Único)</span>
                    </div>
                    <ul className="text-xs text-slate-200 space-y-2">
                      <li className="flex items-center gap-2">
                        <span className="text-emerald-400 font-bold">✓</span> Economia de <strong>R$ 1.988,00</strong> logo no 1º ano
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-emerald-400 font-bold">✓</span> Economia de <strong>R$ 7.976,00</strong> no 2º ano
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-emerald-400 font-bold">✓</span> O aplicativo é seu para sempre
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-emerald-400 font-bold">✓</span> Nunca mais se preocupe com faturas mensais
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Grid com 6 Recursos Inclusos na Compra */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-6">
                  <h3 className="text-base font-bold text-slate-100 mb-4 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    O que está incluso na compra do aplicativo por R$ 4.000,00?
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-1.5">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold text-sm">
                        1
                      </div>
                      <h4 className="font-bold text-sm text-slate-200">Zero Mensalidades</h4>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        0% de cobrança mensal ou taxa escondida. Você nunca mais receberá faturas de assinatura.
                      </p>
                    </div>

                    <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-1.5">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold text-sm">
                        2
                      </div>
                      <h4 className="font-bold text-sm text-slate-200">Veículos & Pátio Ilimitados</h4>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Sem limite de carros na fila, cadastro de clientes, balcão, produtos e controle de estoque.
                      </p>
                    </div>

                    <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-1.5">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-sm">
                        3
                      </div>
                      <h4 className="font-bold text-sm text-slate-200">WhatsApp Bot Integrado</h4>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Avisos automáticos de veículo pronto e link do comprovante direto no WhatsApp do cliente.
                      </p>
                    </div>

                    <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-1.5">
                      <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center font-bold text-sm">
                        4
                      </div>
                      <h4 className="font-bold text-sm text-slate-200">Relatórios & Comissões</h4>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Cálculo automático de comissão dos lavadores, DRE financeiro e fechamento de caixa do dia.
                      </p>
                    </div>

                    <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-1.5">
                      <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center font-bold text-sm">
                        5
                      </div>
                      <h4 className="font-bold text-sm text-slate-200">Portal do Cliente & Totem</h4>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Totem com QR Code exclusivo para seus clientes agendarem e acompanharem o status do carro.
                      </p>
                    </div>

                    <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-1.5">
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-sm">
                        6
                      </div>
                      <h4 className="font-bold text-sm text-slate-200">Sincronização em Nuvem</h4>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Acesse ao mesmo tempo no celular, tablet e computador com banco de dados em tempo real.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Caixa de Checkout / Pagamento da Licença */}
                <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-6 space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                    <div>
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-indigo-400" />
                        Finalizar Compra da Licença Vitalícia
                      </h3>
                      <p className="text-xs text-slate-400">
                        Escolha o método de pagamento para concluir a compra definitiva
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-xs text-slate-400 block">Total a Pagar</span>
                      <span className="text-2xl font-black text-amber-300 font-mono">R$ 4.000,00</span>
                    </div>
                  </div>

                  {/* Seleção do Método */}
                  <div className="grid grid-cols-2 gap-3 max-w-md">
                    <button
                      type="button"
                      onClick={() => setPaymentMethodSelected('pix')}
                      className={`p-3 rounded-xl border text-xs font-bold text-center transition cursor-pointer flex items-center justify-center gap-2 ${
                        paymentMethodSelected === 'pix'
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-md shadow-emerald-500/10'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span>⚡ PIX (À Vista com Liberação Imediata)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethodSelected('cartao')}
                      className={`p-3 rounded-xl border text-xs font-bold text-center transition cursor-pointer flex items-center justify-center gap-2 ${
                        paymentMethodSelected === 'cartao'
                          ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300 shadow-md shadow-indigo-500/10'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span>💳 Cartão de Crédito (Até 12x)</span>
                    </button>
                  </div>

                  {/* Detalhes do Pagamento */}
                  {paymentMethodSelected === 'pix' ? (
                    <div className="bg-[#020617] border border-slate-800 rounded-xl p-4 sm:p-5 space-y-3">
                      <div className="flex flex-col sm:flex-row items-center gap-4">
                        <div className="w-24 h-24 bg-white p-2 rounded-xl flex items-center justify-center shrink-0">
                          <QrCode className="w-20 h-20 text-slate-950" />
                        </div>
                        <div className="space-y-1.5 flex-1">
                          <span className="text-xs font-bold text-slate-200">Chave PIX Oficial de Faturamento:</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              readOnly
                              value="financeiro@saaslavajato.com.br"
                              className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-emerald-400 w-full"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText('financeiro@saaslavajato.com.br');
                                setCopiedPixKey(true);
                                setTimeout(() => setCopiedPixKey(false), 2000);
                              }}
                              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer"
                            >
                              {copiedPixKey ? '✓ Copiado!' : 'Copiar'}
                            </button>
                          </div>
                          <p className="text-[11px] text-slate-400">
                            Banco Digital • Destinatário: Plataforma SaaS Lava-Jato • Valor: R$ 4.000,00
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-[#020617] border border-slate-800 rounded-xl p-4 space-y-2 text-xs text-slate-300">
                      <p className="font-semibold text-slate-200">Parcelamento no Cartão de Crédito:</p>
                      <p className="text-[11px] text-slate-400">
                        12x de R$ 385,00 ou 6x de R$ 720,00 sem burocracia via link seguro de pagamento.
                      </p>
                    </div>
                  )}

                  {/* Botão de Confirmação e Ativação Instantânea */}
                  <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-slate-800">
                    <p className="text-[11px] text-slate-400 max-w-md leading-relaxed">
                      Ao confirmar, seu lava-jato é atualizado instantaneamente no banco de dados Firestore para o <strong>Plano Vitalício</strong> com emissão da fatura quitada.
                    </p>

                    <button
                      type="button"
                      onClick={handleConfirmPurchaseLifetime}
                      disabled={isUpgradingLifetime}
                      className="py-3 px-6 bg-gradient-to-r from-amber-500 to-yellow-400 hover:brightness-105 text-slate-950 rounded-xl font-black text-sm shadow-xl shadow-amber-500/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                    >
                      {isUpgradingLifetime ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" /> Ativando Licença no Firestore...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-5 h-5" /> Confirmar Pagamento & Ativar Licença Vitalícia
                        </>
                      )}
                    </button>
                  </div>
                </div>

              </div>
            )}

          </div>
        )}

      </main>
      </div>

      {/* MODAL 1: NOVO SERVIÇO / VEÍCULO NO PÁTIO */}
      {showNewWashModal && (
        <div className="fixed inset-0 z-50 bg-[#020617]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl relative">
            <button
              onClick={() => setShowNewWashModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 border-b border-[#1e293b] pb-3">
              <Car className="w-5 h-5 text-blue-400" />
              <h3 className="text-base font-bold text-[#f8fafc]">Adicionar Veículo na Fila de Lavagem</h3>
            </div>

            <form onSubmit={handleAddWash} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Placa do Veículo</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: ABC-1234"
                    value={newPlate}
                    onChange={(e) => setNewPlate(e.target.value)}
                    className="w-full bg-[#020617] border border-[#1e293b] rounded-lg p-2.5 text-slate-200 uppercase font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Modelo do Veículo</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Civic Preto"
                    value={newVehicle}
                    onChange={(e) => setNewVehicle(e.target.value)}
                    className="w-full bg-[#020617] border border-[#1e293b] rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-bold">Cliente</label>
                <input
                  type="text"
                  required
                  placeholder="Nome do Cliente"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  className="w-full bg-[#020617] border border-[#1e293b] rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Serviço</label>
                  <select
                    value={newService}
                    onChange={(e) => setNewService(e.target.value)}
                    className="w-full bg-[#020617] border border-[#1e293b] rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="Lavagem Simples">Lavagem Simples</option>
                    <option value="Lavagem Detalhada + Cera">Lavagem Detalhada + Cera</option>
                    <option value="Higienização de Bancos & Ar">Higienização de Bancos & Ar</option>
                    <option value="Polimento & Vitrificação">Polimento & Vitrificação</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Valor (R$)</label>
                  <input
                    type="number"
                    required
                    value={newPrice}
                    onChange={(e) => setNewPrice(Number(e.target.value))}
                    className="w-full bg-[#020617] border border-[#1e293b] rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-bold">Lavador Atribuído</label>
                <select
                  value={newLavadorId}
                  onChange={(e) => setNewLavadorId(e.target.value)}
                  className="w-full bg-[#020617] border border-[#1e293b] rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="">Selecionar depois...</option>
                  {staffList.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.defaultCommission}%)</option>
                  ))}
                </select>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-[#1e293b]">
                <button
                  type="button"
                  onClick={() => setShowNewWashModal(false)}
                  className="px-4 py-2 bg-[#020617] hover:bg-slate-900 text-slate-300 rounded-lg font-medium transition border border-[#1e293b]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold transition shadow-sm shadow-blue-600/30"
                >
                  Entrar na Fila
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: NOVO PRODUTO */}
      {showNewProductModal && (
        <div className="fixed inset-0 z-50 bg-[#020617]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl relative">
            <button
              onClick={() => setShowNewProductModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 border-b border-[#1e293b] pb-3">
              <Package className="w-5 h-5 text-blue-400" />
              <h3 className="text-base font-bold text-[#f8fafc]">Cadastrar Novo Produto / Insumo</h3>
            </div>

            <form onSubmit={handleAddProduct} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-bold">Nome do Produto</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Pretinho Brilho Pneus 500ml"
                  value={newProdName}
                  onChange={(e) => setNewProdName(e.target.value)}
                  className="w-full bg-[#020617] border border-[#1e293b] rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Categoria</label>
                  <select
                    value={newProdCategory}
                    onChange={(e) => setNewProdCategory(e.target.value as 'insumo' | 'venda')}
                    className="w-full bg-[#020617] border border-[#1e293b] rounded-lg p-2.5 text-slate-200 focus:outline-none cursor-pointer"
                  >
                    <option value="insumo">Insumo Interno</option>
                    <option value="venda">Venda no Balcão</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Estoque Inicial</label>
                  <input
                    type="number"
                    required
                    value={newProdStock}
                    onChange={(e) => setNewProdStock(Number(e.target.value))}
                    className="w-full bg-[#020617] border border-[#1e293b] rounded-lg p-2.5 text-slate-200 focus:outline-none font-mono"
                  />
                </div>
              </div>

              {newProdCategory === 'venda' && (
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Preço de Venda (R$)</label>
                  <input
                    type="number"
                    required
                    value={newProdPrice}
                    onChange={(e) => setNewProdPrice(Number(e.target.value))}
                    className="w-full bg-[#020617] border border-[#1e293b] rounded-lg p-2.5 text-slate-200 focus:outline-none font-mono"
                  />
                </div>
              )}

              <div className="pt-3 flex justify-end gap-2 border-t border-[#1e293b]">
                <button
                  type="button"
                  onClick={() => setShowNewProductModal(false)}
                  className="px-4 py-2 bg-[#020617] hover:bg-slate-900 text-slate-300 rounded-lg font-medium transition border border-[#1e293b]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold transition shadow-sm shadow-blue-600/30"
                >
                  Salvar no Estoque
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: NOVO AGENDAMENTO */}
      {showNewAppointmentModal && (
        <div className="fixed inset-0 z-50 bg-[#020617]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative">
            <button
              onClick={() => setShowNewAppointmentModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 border-b border-[#1e293b] pb-3">
              <Calendar className="w-5 h-5 text-blue-400" />
              <h3 className="text-base font-bold text-[#f8fafc]">Registrar Novo Agendamento</h3>
            </div>

            <form onSubmit={handleCreateAppointment} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Nome do Cliente *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Carlos Mendes"
                    value={appClientName}
                    onChange={(e) => setAppClientName(e.target.value)}
                    className="w-full bg-[#020617] border border-[#1e293b] rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">WhatsApp / Telefone</label>
                  <input
                    type="tel"
                    placeholder="(11) 98765-4321"
                    value={appClientPhone}
                    onChange={(e) => setAppClientPhone(e.target.value)}
                    className="w-full bg-[#020617] border border-[#1e293b] rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Veículo / Modelo *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Toyota Corolla"
                    value={appVehicle}
                    onChange={(e) => setAppVehicle(e.target.value)}
                    className="w-full bg-[#020617] border border-[#1e293b] rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Placa do Veículo *</label>
                  <input
                    type="text"
                    required
                    placeholder="ABC1D23"
                    value={appPlate}
                    onChange={(e) => setAppPlate(e.target.value.toUpperCase())}
                    className="w-full bg-[#020617] border border-[#1e293b] rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-blue-500 font-mono uppercase font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Data *</label>
                  <input
                    type="date"
                    required
                    value={appDate}
                    onChange={(e) => setAppDate(e.target.value)}
                    className="w-full bg-[#020617] border border-[#1e293b] rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Horário *</label>
                  <select
                    value={appTime}
                    onChange={(e) => setAppTime(e.target.value)}
                    className="w-full bg-[#020617] border border-[#1e293b] rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    {['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00'].map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Serviço Desejado</label>
                  <select
                    value={appService}
                    onChange={(e) => {
                      const s = e.target.value;
                      setAppService(s);
                      if (s.includes('Simples')) setAppPrice(60);
                      else if (s.includes('Cera')) setAppPrice(120);
                      else if (s.includes('Higienização')) setAppPrice(180);
                      else if (s.includes('Polimento')) setAppPrice(350);
                    }}
                    className="w-full bg-[#020617] border border-[#1e293b] rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="Lavagem Simples">Lavagem Simples (R$ 60)</option>
                    <option value="Lavagem Detalhada + Cera">Lavagem Detalhada + Cera (R$ 120)</option>
                    <option value="Higienização de Bancos & Ar">Higienização de Bancos & Ar (R$ 180)</option>
                    <option value="Polimento & Vitrificação">Polimento & Vitrificação (R$ 350)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Valor Acordado (R$)</label>
                  <input
                    type="number"
                    required
                    value={appPrice}
                    onChange={(e) => setAppPrice(Number(e.target.value))}
                    className="w-full bg-[#020617] border border-[#1e293b] rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-bold">Lavador Preferencial (Opcional)</label>
                <select
                  value={appLavadorId}
                  onChange={(e) => setAppLavadorId(e.target.value)}
                  className="w-full bg-[#020617] border border-[#1e293b] rounded-lg p-2.5 text-slate-200 focus:outline-none cursor-pointer"
                >
                  <option value="">Equipe Geral do Pátio</option>
                  {staffList.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.defaultCommission}%)</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-bold">Observações / Detalhes</label>
                <input
                  type="text"
                  placeholder="Ex: Cuidado com insulfilm novo, cliente aguardará no local"
                  value={appNotes}
                  onChange={(e) => setAppNotes(e.target.value)}
                  className="w-full bg-[#020617] border border-[#1e293b] rounded-lg p-2.5 text-slate-200 focus:outline-none"
                />
              </div>

              {/* Notificação 24h Antes */}
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-[11px] text-blue-300 flex items-center gap-2">
                <BellRing className="w-4 h-4 text-blue-400 shrink-0" />
                <span>
                  ⏰ Este agendamento terá um lembrete automático programado para <strong>24 horas antes</strong> do horário selecionado para disparo via WhatsApp / E-mail.
                </span>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-[#1e293b]">
                <button
                  type="button"
                  onClick={() => setShowNewAppointmentModal(false)}
                  className="px-4 py-2 bg-[#020617] hover:bg-slate-900 text-slate-300 rounded-lg font-medium transition border border-[#1e293b]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold transition shadow-sm shadow-blue-600/30"
                >
                  Confirmar Agendamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: LANÇAR NO HISTÓRICO */}
      {showAddHistoryModal && (
        <div className="fixed inset-0 z-50 bg-[#020617]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative">
            <button
              onClick={() => setShowAddHistoryModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 border-b border-[#1e293b] pb-3">
              <History className="w-5 h-5 text-blue-400" />
              <h3 className="text-base font-bold text-[#f8fafc]">Lançar Lavagem no Histórico</h3>
            </div>

            <form onSubmit={handleAddManualHistory} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Placa *</label>
                  <input
                    type="text"
                    required
                    placeholder="ABC1D23"
                    value={histPlate}
                    onChange={(e) => setHistPlate(e.target.value.toUpperCase())}
                    className="w-full bg-[#020617] border border-[#1e293b] rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-blue-500 font-mono uppercase font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Veículo / Modelo *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Jeep Renegade"
                    value={histVehicle}
                    onChange={(e) => setHistVehicle(e.target.value)}
                    className="w-full bg-[#020617] border border-[#1e293b] rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Nome do Cliente *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Mariana Lima"
                    value={histClientName}
                    onChange={(e) => setHistClientName(e.target.value)}
                    className="w-full bg-[#020617] border border-[#1e293b] rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">WhatsApp / Telefone</label>
                  <input
                    type="tel"
                    placeholder="(11) 98888-7777"
                    value={histClientPhone}
                    onChange={(e) => setHistClientPhone(e.target.value)}
                    className="w-full bg-[#020617] border border-[#1e293b] rounded-lg p-2.5 text-slate-200 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Serviço</label>
                  <select
                    value={histService}
                    onChange={(e) => {
                      const s = e.target.value;
                      setHistService(s);
                      if (s.includes('Simples')) setHistPrice(60);
                      else if (s.includes('Cera')) setHistPrice(120);
                      else if (s.includes('Higienização')) setHistPrice(180);
                      else if (s.includes('Polimento')) setHistPrice(350);
                    }}
                    className="w-full bg-[#020617] border border-[#1e293b] rounded-lg p-2.5 text-slate-200 focus:outline-none cursor-pointer"
                  >
                    <option value="Lavagem Simples">Lavagem Simples</option>
                    <option value="Lavagem Detalhada + Cera">Lavagem Detalhada + Cera</option>
                    <option value="Higienização de Bancos & Ar">Higienização de Bancos & Ar</option>
                    <option value="Polimento & Vitrificação">Polimento & Vitrificação</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Valor (R$)</label>
                  <input
                    type="number"
                    required
                    value={histPrice}
                    onChange={(e) => setHistPrice(Number(e.target.value))}
                    className="w-full bg-[#020617] border border-[#1e293b] rounded-lg p-2.5 text-slate-200 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Lavador Responsável</label>
                  <select
                    value={histLavadorId}
                    onChange={(e) => setHistLavadorId(e.target.value)}
                    className="w-full bg-[#020617] border border-[#1e293b] rounded-lg p-2.5 text-slate-200 focus:outline-none cursor-pointer"
                  >
                    <option value="">Equipe Geral</option>
                    {staffList.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.defaultCommission}%)</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Forma de Pagamento</label>
                  <select
                    value={histPaymentMethod}
                    onChange={(e) => setHistPaymentMethod(e.target.value as any)}
                    className="w-full bg-[#020617] border border-[#1e293b] rounded-lg p-2.5 text-slate-200 focus:outline-none cursor-pointer"
                  >
                    <option value="PIX">PIX</option>
                    <option value="Cartão de Crédito">Cartão de Crédito</option>
                    <option value="Cartão de Débito">Cartão de Débito</option>
                    <option value="Dinheiro">Dinheiro</option>
                    <option value="Cortesia">Cortesia</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-bold">Observações do Serviço</label>
                <input
                  type="text"
                  placeholder="Ex: Veículo entregue limpo e aromatizado"
                  value={histNotes}
                  onChange={(e) => setHistNotes(e.target.value)}
                  className="w-full bg-[#020617] border border-[#1e293b] rounded-lg p-2.5 text-slate-200 focus:outline-none"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-[#1e293b]">
                <button
                  type="button"
                  onClick={() => setShowAddHistoryModal(false)}
                  className="px-4 py-2 bg-[#020617] hover:bg-slate-900 text-slate-300 rounded-lg font-medium transition border border-[#1e293b]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold transition shadow-sm shadow-blue-600/30"
                >
                  Salvar no Histórico
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: COMPROVANTE / RECIBO DE LAVAGEM COM LOGO DA EMPRESA */}
      {selectedWashReceipt && (
        <div className="fixed inset-0 z-50 bg-[#020617]/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          {/* Estilos dedicados para impressão limpa do recibo */}
          <style>{`
            @media print {
              body * {
                visibility: hidden !important;
              }
              #wash-receipt-print-modal, #wash-receipt-print-modal * {
                visibility: visible !important;
              }
              #wash-receipt-print-modal {
                position: fixed !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                max-width: 480px !important;
                margin: 0 auto !important;
                background: white !important;
                color: black !important;
                padding: 24px !important;
                box-shadow: none !important;
                border: 1px solid #ccc !important;
              }
              #wash-receipt-print-modal .receipt-print-hide {
                display: none !important;
              }
              #wash-receipt-print-modal .text-white,
              #wash-receipt-print-modal .text-slate-100,
              #wash-receipt-print-modal .text-slate-200,
              #wash-receipt-print-modal .text-slate-300 {
                color: #0f172a !important;
              }
              #wash-receipt-print-modal .text-slate-400,
              #wash-receipt-print-modal .text-slate-500 {
                color: #475569 !important;
              }
              #wash-receipt-print-modal .bg-\\[\\#0f172a\\],
              #wash-receipt-print-modal .bg-\\[\\#020617\\],
              #wash-receipt-print-modal .bg-slate-900 {
                background: #f8fafc !important;
                border-color: #cbd5e1 !important;
              }
            }
          `}</style>

          <div 
            id="wash-receipt-print-modal"
            className="bg-[#0f172a] border border-[#1e293b] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl relative my-auto"
          >
            <button
              onClick={() => setSelectedWashReceipt(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white receipt-print-hide p-1 cursor-pointer"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Cabeçalho do Recibo com a LOGO DA EMPRESA */}
            <div className="text-center border-b border-[#1e293b] pb-4 flex flex-col items-center">
              {tenant.logoUrl ? (
                <div className="w-20 h-20 rounded-2xl bg-white/5 border border-slate-700/80 p-1.5 flex items-center justify-center overflow-hidden mb-2.5 shadow-lg">
                  <img
                    src={tenant.logoUrl}
                    alt={tenant.nomeFantasia || tenant.name}
                    className="w-full h-full object-contain"
                  />
                </div>
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center font-black text-white text-xl shadow-lg mb-2.5">
                  {tenant.code || (tenant.name ? tenant.name.slice(0, 2).toUpperCase() : 'LJ')}
                </div>
              )}

              <h3 className="text-base font-extrabold text-[#f8fafc] leading-tight tracking-tight">
                {tenant.nomeFantasia || tenant.name}
              </h3>
              {tenant.razaoSocial && (
                <p className="text-[11px] text-slate-400 mt-0.5">{tenant.razaoSocial}</p>
              )}
              {tenant.cnpj && (
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">CNPJ: {tenant.cnpj}</p>
              )}
              {(tenant.address?.street || tenant.contactPhone) && (
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {tenant.address?.street ? `${tenant.address.street}${tenant.address.number ? `, ${tenant.address.number}` : ''} • ` : ''}
                  {tenant.contactPhone ? `Tel: ${tenant.contactPhone}` : ''}
                </p>
              )}

              <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold uppercase tracking-wider">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                Comprovante Oficial de Atendimento
              </div>
              <p className="text-[10px] text-slate-500 mt-1 font-mono">Controle: #{selectedWashReceipt.id}</p>
            </div>

            {/* Detalhes do Recibo */}
            <div className="space-y-2.5 text-xs bg-[#020617] p-4 rounded-xl border border-[#1e293b]">
              <div className="flex justify-between items-center py-1 border-b border-[#1e293b]">
                <span className="text-slate-400">Data / Horário:</span>
                <span className="font-semibold text-slate-200">
                  {formatReceiptCompletedAt(selectedWashReceipt.completedAt, selectedWashReceipt.date)}
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-[#1e293b]">
                <span className="text-slate-400">Cliente:</span>
                <span className="font-semibold text-slate-200">{selectedWashReceipt.clientName}</span>
              </div>

              {selectedWashReceipt.clientPhone && (
                <div className="flex justify-between items-center py-1 border-b border-[#1e293b]">
                  <span className="text-slate-400">Contato:</span>
                  <span className="font-mono text-slate-200">{selectedWashReceipt.clientPhone}</span>
                </div>
              )}

              <div className="flex justify-between items-center py-1 border-b border-[#1e293b]">
                <span className="text-slate-400">Veículo:</span>
                <span className="font-semibold text-slate-200">{selectedWashReceipt.vehicle}</span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-[#1e293b]">
                <span className="text-slate-400">Placa:</span>
                <span className="font-mono font-bold text-blue-400 px-2 py-0.5 bg-slate-900 border border-slate-700 rounded">
                  {selectedWashReceipt.plate}
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-[#1e293b]">
                <span className="text-slate-400">Serviço Realizado:</span>
                <span className="font-medium text-slate-200">{selectedWashReceipt.service}</span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-[#1e293b]">
                <span className="text-slate-400">Lavador Responsável:</span>
                <span className="text-slate-200">{selectedWashReceipt.lavadorName || 'Equipe do Pátio'}</span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-[#1e293b]">
                <span className="text-slate-400">Forma de Pagamento:</span>
                <span className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded font-medium">
                  {selectedWashReceipt.paymentMethod}
                </span>
              </div>

              <div className="flex justify-between items-center pt-2 text-sm font-bold border-t border-[#1e293b]">
                <span className="text-slate-200">Total Pago:</span>
                <span className="text-emerald-400 font-mono text-base font-extrabold">
                  R$ {selectedWashReceipt.price.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Mensagem de Rodapé */}
            <p className="text-center text-[10px] text-slate-500 italic">
              Agradecemos a sua preferência! Volte sempre ao {tenant.nomeFantasia || tenant.name}.
            </p>

            {/* Ações do Comprovante */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#1e293b] receipt-print-hide">
              <button
                type="button"
                onClick={() => setSelectedWashReceipt(null)}
                className="px-3.5 py-2 bg-[#020617] hover:bg-slate-900 text-slate-300 text-xs rounded-lg font-medium transition border border-[#1e293b] cursor-pointer"
              >
                Fechar
              </button>

              <div className="flex items-center gap-2">
                {/* Enviar no WhatsApp */}
                {(() => {
                  const phoneDigits = (selectedWashReceipt.clientPhone || '').replace(/\D/g, '');
                  const formattedDateTime = formatReceiptCompletedAt(selectedWashReceipt.completedAt, selectedWashReceipt.date);
                  const receiptText = `*COMPROVANTE DE ATENDIMENTO - ${tenant.nomeFantasia || tenant.name}*\n` +
                    `📅 Data: ${formattedDateTime}\n` +
                    `👤 Cliente: ${selectedWashReceipt.clientName}\n` +
                    `🚗 Veículo: ${selectedWashReceipt.vehicle} (${selectedWashReceipt.plate})\n` +
                    `🧼 Serviço: ${selectedWashReceipt.service}\n` +
                    `💳 Pagamento: ${selectedWashReceipt.paymentMethod}\n` +
                    `💰 *Total Pago: R$ ${selectedWashReceipt.price.toFixed(2)}*\n\n` +
                    `Agradecemos a sua preferência! Volte sempre ao ${tenant.nomeFantasia || tenant.name}.`;
                  const waUrl = phoneDigits 
                    ? `https://wa.me/55${phoneDigits}?text=${encodeURIComponent(receiptText)}` 
                    : `https://api.whatsapp.com/send?text=${encodeURIComponent(receiptText)}`;

                  return (
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs rounded-lg font-bold transition flex items-center gap-1.5 shadow-sm shadow-emerald-600/30"
                      title="Enviar recibo para o WhatsApp do cliente"
                    >
                      <Phone className="w-3.5 h-3.5" /> WhatsApp
                    </a>
                  );
                })()}

                {/* Imprimir Recibo */}
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-lg font-bold transition flex items-center gap-1.5 shadow-sm shadow-blue-600/30 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" /> Imprimir Recibo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DETALHES E DISPARO DE LEMBRETE 24H */}
      {selectedReminderApp && (() => {
        const analysis = getAppointmentReminderAnalysis(selectedReminderApp);
        const waText = buildReminderWhatsAppText(tenant.nomeFantasia || tenant.name, selectedReminderApp, tenant.address?.street);
        const { subject: emailSubject, body: emailBody, mailtoUrl } = buildReminderEmailContent(tenant.nomeFantasia || tenant.name, selectedReminderApp, tenant.address?.street);
        const gcalUrl = buildGoogleCalendarUrl(tenant.nomeFantasia || tenant.name, selectedReminderApp);

        return (
          <div className="fixed inset-0 z-50 bg-[#020617]/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-[#0f172a] border border-blue-500/40 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative my-auto">
              <button
                type="button"
                onClick={() => setSelectedReminderApp(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 border-b border-[#1e293b] pb-3">
                <div className="p-2.5 bg-blue-500/10 border border-blue-500/30 rounded-xl text-blue-400">
                  <BellRing className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    Lembrete de Agendamento 24h
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${analysis.badgeClass}`}>
                      {analysis.label}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Notificação programada com antecedência para evitar no-show do cliente.
                  </p>
                </div>
              </div>

              {/* Informações do Agendamento */}
              <div className="bg-[#020617] p-3.5 rounded-xl border border-[#1e293b] text-xs space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold block uppercase">Cliente</span>
                    <span className="font-semibold text-slate-200">{selectedReminderApp.clientName}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold block uppercase">Horário Marcado</span>
                    <span className="font-semibold text-blue-400">{selectedReminderApp.dateTime}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#1e293b]">
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold block uppercase">Veículo / Placa</span>
                    <span className="text-slate-300">{selectedReminderApp.vehicle} ({selectedReminderApp.plate})</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold block uppercase">Serviço / Valor</span>
                    <span className="text-emerald-400 font-semibold">{selectedReminderApp.service} - R$ {selectedReminderApp.price.toFixed(2)}</span>
                  </div>
                </div>
                {analysis.reminderTargetDate && (
                  <div className="pt-1.5 border-t border-[#1e293b] flex items-center gap-1.5 text-[11px] text-blue-300">
                    <Clock className="w-3.5 h-3.5 text-blue-400" />
                    <span>Disparo calculado: <strong>{formatDateTimeDisplay(analysis.reminderTargetDate)}</strong> (exatamente 24h antes).</span>
                  </div>
                )}
              </div>

              {/* Pré-visualização da Mensagem */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300">Mensagem Personalizada de Lembrete:</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(waText);
                      showToast('📋 Mensagem de lembrete copiada para a área de transferência!');
                    }}
                    className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3 h-3" /> Copiar Texto
                  </button>
                </div>
                <div className="p-3 bg-[#020617] rounded-xl border border-slate-800 text-[11px] text-slate-300 whitespace-pre-line font-mono max-h-44 overflow-y-auto">
                  {waText}
                </div>
              </div>

              {/* Ações de Disparo */}
              <div className="space-y-2 pt-2 border-t border-[#1e293b]">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      handleSendReminder(selectedReminderApp, 'whatsapp');
                      setSelectedReminderApp(null);
                    }}
                    className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm shadow-emerald-600/30"
                  >
                    <MessageSquare className="w-3.5 h-3.5" /> Enviar WhatsApp
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      handleSendReminder(selectedReminderApp, 'email');
                      setSelectedReminderApp(null);
                    }}
                    className="w-full py-2.5 px-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm shadow-cyan-600/30"
                  >
                    <Mail className="w-3.5 h-3.5" /> Enviar E-mail
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  {gcalUrl && (
                    <a
                      href={gcalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 transition"
                    >
                      <ExternalLink className="w-3 h-3" /> Adicionar à Google Agenda
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      const icsData = generateIcsFileContent(tenant.nomeFantasia || tenant.name, selectedReminderApp);
                      const blob = new Blob([icsData], { type: 'text/calendar;charset=utf-8' });
                      const link = document.createElement('a');
                      link.href = window.URL.createObjectURL(blob);
                      link.setAttribute('download', `lembrete-${selectedReminderApp.id}.ics`);
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      showToast('📥 Arquivo .ics de calendário baixado com alarme 24h!');
                    }}
                    className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 transition cursor-pointer"
                  >
                    <Download className="w-3 h-3" /> Baixar .ICS (iCal)
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
};
