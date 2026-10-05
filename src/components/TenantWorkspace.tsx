import React, { useState, useEffect, useMemo } from 'react';
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
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Menu
} from 'lucide-react';
import { Tenant } from '../types';
import { ClientPortal } from './ClientPortal';
import { TenantConfigSettings } from './TenantConfigSettings';
import { PWAInstallButton } from './PWAInstallButton';
import { saveTenantToFirestore } from '../lib/firebaseService';

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
}

export interface CustomerAppointment {
  id: string;
  dateTime: string;
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;
  vehicle: string;
  plate: string;
  service: string;
  price: number;
  lavadorId?: string;
  lavadorName?: string;
  status: 'Pendente' | 'Aprovado' | 'Cancelado' | 'Concluído';
  addressSummary?: string;
  notes?: string;
  createdAt?: string;
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

interface TenantWorkspaceProps {
  tenant: Tenant;
  onExitImpersonation?: () => void;
  onUpdateTenant?: (updatedTenant: Tenant) => void;
  onReplaySplash?: () => void;
}

export const TenantWorkspace: React.FC<TenantWorkspaceProps> = ({
  tenant: initialTenant,
  onExitImpersonation,
  onUpdateTenant,
  onReplaySplash
}) => {
  const [currentTenant, setCurrentTenant] = useState<Tenant>(() => {
    const saved = localStorage.getItem(`saas_tenant_custom_data_${initialTenant.id}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { ...initialTenant, ...parsed };
      } catch (e) {
        console.error(e);
      }
    }
    return initialTenant;
  });

  const [activeTab, setActiveTab] = useState<'fila' | 'agendamentos' | 'historico-lavagem' | 'produtos' | 'comissoes' | 'configuracoes-empresa' | 'saas-config' | 'portal-cliente'>('fila');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const tenant = currentTenant;

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
          return parsed.filter(w => !w.id.startsWith('w-from-app-init-') && !w.id.startsWith('wh-'));
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
          // Remove qualquer resquício de agendamentos fictícios antigos (app-init-)
          return parsed.filter(a => !a.id.startsWith('app-init-'));
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
          if (!isDemoTenant) {
            return parsed.filter(w => !w.id.startsWith('wh-'));
          }
          return parsed;
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

  // Real-time synchronization listener for incoming appointments & updates
  useEffect(() => {
    const refreshData = () => {
      const savedApps = localStorage.getItem(`saas_tenant_appointments_${tenant.id}`);
      if (savedApps) {
        try {
          const parsed = JSON.parse(savedApps);
          if (Array.isArray(parsed)) {
            if (!isDemoTenant) {
              setAppointments(parsed.filter(a => !a.id.startsWith('app-init-')));
            } else {
              setAppointments(parsed);
            }
          }
        } catch (e) {
          console.error(e);
        }
      }
    };

    window.addEventListener('storage', refreshData);
    window.addEventListener('saas_data_sync', refreshData);
    const interval = setInterval(refreshData, 1500);

    return () => {
      window.removeEventListener('storage', refreshData);
      window.removeEventListener('saas_data_sync', refreshData);
      clearInterval(interval);
    };
  }, [tenant.id]);

  // SaaS Override modules
  const [modules, setModules] = useState([
    { id: 'm1', name: 'Gestão de Fila & Operação de Pátio', enabled: true },
    { id: 'm2', name: 'Agendamentos Online & Portal do Cliente', enabled: true },
    { id: 'm3', name: 'Histórico Completo de Lavagens & Comprovantes', enabled: true },
    { id: 'm4', name: 'Módulo de Comissões Automáticas da Equipe', enabled: true },
    { id: 'm5', name: 'Controle de Estoque & Venda no Balcão', enabled: true },
    { id: 'm6', name: 'Notificações via WhatsApp Bot (Disparo Automático)', enabled: tenant.plan !== 'Basic' },
    { id: 'm7', name: 'Relatórios Financeiros & NF-e Automática', enabled: tenant.plan === 'Enterprise' }
  ]);

  // Toast / Modals state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showNewWashModal, setShowNewWashModal] = useState(false);
  const [showNewProductModal, setShowNewProductModal] = useState(false);
  const [showNewAppointmentModal, setShowNewAppointmentModal] = useState(false);
  const [showAddHistoryModal, setShowAddHistoryModal] = useState(false);
  const [selectedWashReceipt, setSelectedWashReceipt] = useState<CompletedWashRecord | null>(null);

  // Filtros do Histórico de Lavagem
  const [historySearch, setHistorySearch] = useState('');
  const [historyPeriod, setHistoryPeriod] = useState<'todos' | 'hoje' | '7dias' | 'mes'>('todos');
  const [historyLavador, setHistoryLavador] = useState('todos');
  const [historyPayment, setHistoryPayment] = useState('todos');

  // Filtros de Agendamentos
  const [appointmentStatusFilter, setAppointmentStatusFilter] = useState<'todos' | 'Pendente' | 'Aprovado' | 'Cancelado'>('todos');
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

  // Support Message Form
  const [broadcastMessage, setBroadcastMessage] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
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

      // 2. Add to Completed Wash History
      const now = new Date();
      const historyEntry: CompletedWashRecord = {
        id: `wh-${Date.now()}`,
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
        completedAt: `Hoje às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
        date: now.toISOString().split('T')[0],
        paymentMethod: item.price === 0 ? 'Cortesia' : 'PIX',
        durationMinutes: 45
      };
      setWashHistory(prev => [historyEntry, ...prev]);

      // 3. EXCLUSIVELY AUTOMATIC FIDELITY POINT ATTRIBUTION BY LAVA-JATO!
      const keyPts = `saas_fidelity_pts_${tenant.id}`;
      const currentPts = Number(localStorage.getItem(keyPts) || '0');
      const newPts = currentPts + 1;
      localStorage.setItem(keyPts, newPts.toString());

      if (newPts >= 10) {
        showToast(`✨ +1 Ponto concedido para ${item.clientName}! 🎉 CLIENTE ALCANÇOU 10 PONTOS (Liberado para Resgate Grátis no Portal)! Adicionado ao Histórico.`);
      } else {
        showToast(`✨ +1 Ponto creditado para ${item.clientName}! (${newPts}/10 carimbos). Registrado no Histórico de Lavagem.`);
      }
    }

    setWashItems(prev => prev.map(w => w.id === washId ? { ...w, status: nextStatus } : w));
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

    const washFromApp: WashItem = {
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

    const newWashList = [washFromApp, ...washItems];
    // Ao ser selecionado para a fila de lavagem, remove do agendamento para zerar e não deixar agendamento pendente marcado
    const newAppList = appointments.filter(a => a.id !== app.id);

    setWashItems(newWashList);
    setAppointments(newAppList);
    localStorage.setItem(`saas_tenant_washes_${tenant.id}`, JSON.stringify(newWashList));
    localStorage.setItem(`saas_tenant_appointments_${tenant.id}`, JSON.stringify(newAppList));
    window.dispatchEvent(new Event('storage'));
    showToast(`✅ Agendamento de ${app.clientName} enviado para a Fila do Pátio e zerado em Agendamentos!`);
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

    const newWashes: WashItem[] = pendingApps.map((app, idx) => {
      const assignedStaff = staffList.find(s => s.id === app.lavadorId) || defaultStaff;
      const commAmt = (app.price * (assignedStaff.defaultCommission || 15)) / 100;
      return {
        id: `w-from-${app.id}-${idx}`,
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

    const newWashList = [...newWashes, ...washItems];
    // Zera todos os agendamentos pendentes da lista
    const remainingApps = appointments.filter(a => a.status !== 'Pendente');

    setWashItems(newWashList);
    setAppointments(remainingApps);
    localStorage.setItem(`saas_tenant_washes_${tenant.id}`, JSON.stringify(newWashList));
    localStorage.setItem(`saas_tenant_appointments_${tenant.id}`, JSON.stringify(remainingApps));
    window.dispatchEvent(new Event('storage'));
    showToast(`🚀 ${pendingApps.length} agendamentos enviados para a Fila do Pátio e zerados em Agendamentos!`);
  };

  const handleCancelAppointment = (appId: string) => {
    const newAppList = appointments.map(a => a.id === appId ? { ...a, status: 'Cancelado' as const } : a);
    setAppointments(newAppList);
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
    localStorage.setItem(`saas_tenant_appointments_${tenant.id}`, JSON.stringify(newAppList));
    window.dispatchEvent(new Event('storage'));
    showToast(`Agendamento excluído.`);
  };

  const handleCreateAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!appClientName || !appVehicle || !appPlate || !appDate || !appTime) return;

    const assignedStaff = staffList.find(s => s.id === appLavadorId);

    const newApp: CustomerAppointment = {
      id: `app-manual-${Date.now()}`,
      clientName: appClientName,
      clientPhone: appClientPhone,
      vehicle: appVehicle,
      plate: appPlate.toUpperCase(),
      service: appService,
      price: Number(appPrice),
      dateTime: `${appDate} ${appTime}`,
      lavadorId: assignedStaff?.id,
      lavadorName: assignedStaff?.name,
      status: 'Aprovado',
      notes: appNotes || 'Agendado diretamente no balcão da empresa',
      createdAt: new Date().toISOString()
    };

    const updatedApps = [newApp, ...appointments];
    setAppointments(updatedApps);
    localStorage.setItem(`saas_tenant_appointments_${tenant.id}`, JSON.stringify(updatedApps));
    window.dispatchEvent(new Event('storage'));

    setAppClientName('');
    setAppClientPhone('');
    setAppVehicle('');
    setAppPlate('');
    setAppNotes('');
    setShowNewAppointmentModal(false);
    showToast(`📅 Agendamento de ${newApp.clientName} registrado com sucesso!`);
  };

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

    const updatedHistory = [newHistoryEntry, ...washHistory];
    setWashHistory(updatedHistory);
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
    const updated = washHistory.filter(h => h.id !== id);
    setWashHistory(updated);
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
    showToast(`🗑️ Veículo ${item?.plate || ''} removido do pátio.`);
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
  const activePatioCount = washItems.filter(w => w.status !== 'Concluído').length;
  const completedTodayCount = washItems.filter(w => w.status === 'Concluído').length;
  const totalRevenueToday = washItems.reduce((acc, curr) => acc + curr.price, 0);
  const totalCommissionsPending = staffList.reduce((acc, s) => acc + s.accumulatedCommission, 0);
  const pendingAppointmentsCount = appointments.filter(a => a.status === 'Pendente').length;

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
        ? `${pendingAppointmentsCount} pendente`
        : appointments.length > 0 ? `${appointments.length}` : '0',
      badgeColor: pendingAppointmentsCount > 0
        ? 'bg-amber-500 text-slate-950 font-black animate-pulse'
        : 'bg-slate-800 text-slate-400'
    },
    {
      id: 'historico-lavagem' as const,
      label: 'Histórico de Lavagem',
      icon: History,
      badge: washHistory.length > 0 ? `${washHistory.length}` : undefined,
      badgeColor: 'bg-slate-800 text-slate-300'
    },
    {
      id: 'produtos' as const,
      label: 'Produtos & Estoque',
      icon: Package,
      badge: products.filter(p => p.stock <= p.minStock).length > 0 
        ? `${products.filter(p => p.stock <= p.minStock).length} repor`
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
      id: 'saas-config' as const,
      label: 'Módulos SaaS Root',
      icon: Sliders
    },
    {
      id: 'portal-cliente' as const,
      label: 'Portal do Cliente',
      icon: Sparkles,
      badge: 'Público',
      badgeColor: 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
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
              <button
                onClick={() => {
                  setShowNewWashModal(true);
                  setIsMobileMenuOpen(false);
                }}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Novo Veículo no Pátio
              </button>
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

      {/* ================= 2. MENU LATERAL DESKTOP (STICKY LEFT SIDEBAR) ================= */}
      <aside className="hidden md:flex flex-col w-64 lg:w-72 bg-[#020617] border-r border-[#1e293b] h-screen sticky top-0 shrink-0 z-30">
        
        {/* Topo do Menu Lateral: Logo & Identidade do Lava-Jato */}
        <div className="p-5 border-b border-[#1e293b]">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-xl text-white shadow-md shadow-blue-600/30 overflow-hidden shrink-0 border border-blue-500/30">
              {tenant.logoUrl ? (
                <img src={tenant.logoUrl} alt={tenant.name} className="w-full h-full object-cover" />
              ) : (
                <Car className="w-6 h-6" />
              )}
            </div>
            <div className="overflow-hidden flex-1">
              <h1 className="text-sm font-bold text-[#f8fafc] truncate leading-tight" title={tenant.nomeFantasia || tenant.name}>
                {tenant.nomeFantasia || tenant.name}
              </h1>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.2 rounded-full font-bold">
                  {tenant.plan}
                </span>
                <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.2 rounded font-mono truncate max-w-[110px]" title={tenant.domain}>
                  {tenant.domain}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Links de Navegação do Menu Lateral */}
        <div className="p-3 flex-1 overflow-y-auto space-y-1">
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Menu Operacional
          </div>

          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl font-medium text-xs transition text-left group cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/20'
                    : 'text-slate-400 hover:bg-[#0f172a] hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <Icon className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`} />
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
        </div>

        {/* Botão de Ação Rápida no Menu Lateral */}
        <div className="p-4 border-t border-[#1e293b] space-y-2.5 bg-[#020617]/50">
          <button
            onClick={() => setShowNewWashModal(true)}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition shadow-md shadow-blue-600/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Novo Veículo no Pátio
          </button>

          <PWAInstallButton compact variant="outline" className="w-full justify-center" />

          {onExitImpersonation && (
            <button
              onClick={onExitImpersonation}
              className="w-full bg-[#0f172a] hover:bg-rose-500/10 border border-rose-500/30 text-rose-300 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <LogOut className="w-4 h-4 text-rose-400" /> Sair / Trocar Perfil
            </button>
          )}
        </div>
      </aside>

      {/* ================= 3. CONTEÚDO PRINCIPAL (ÁREA DIREITA) ================= */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        
        {/* Header Superior da Área de Conteúdo */}
        <header className="bg-[#0f172a] border-b border-[#1e293b] px-4 sm:px-6 py-3.5 sticky top-0 z-20">
          <div className="flex items-center justify-between gap-4">
            
            {/* Lado Esquerdo: Botão Mobile Hamburguer + Título da Aba Ativa */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="md:hidden text-slate-400 hover:text-white p-2 rounded-lg bg-[#020617] border border-[#1e293b] cursor-pointer"
                title="Abrir Menu Lateral"
              >
                <Menu className="w-5 h-5" />
              </button>

              <div>
                <h2 className="text-base sm:text-lg font-bold text-[#f8fafc] flex items-center gap-2">
                  {activeTab === 'fila' && <><Kanban className="w-5 h-5 text-blue-400" /> Fila de Lavagem & Operação de Pátio</>}
                  {activeTab === 'agendamentos' && <><CalendarCheck className="w-5 h-5 text-blue-400" /> Gestão de Agendamentos</>}
                  {activeTab === 'historico-lavagem' && <><History className="w-5 h-5 text-blue-400" /> Histórico de Lavagem</>}
                  {activeTab === 'produtos' && <><Package className="w-5 h-5 text-blue-400" /> Produtos & Estoque</>}
                  {activeTab === 'comissoes' && <><Percent className="w-5 h-5 text-blue-400" /> % Comissões da Equipe</>}
                  {activeTab === 'configuracoes-empresa' && <><Building2 className="w-5 h-5 text-blue-400" /> Configurações da Empresa</>}
                  {activeTab === 'saas-config' && <><Sliders className="w-5 h-5 text-blue-400" /> Módulos SaaS Root</>}
                  {activeTab === 'portal-cliente' && <><Sparkles className="w-5 h-5 text-amber-400" /> Portal do Cliente (Visão Pública)</>}
                </h2>
                <p className="text-[11px] text-slate-400 hidden sm:block">
                  {tenant.nomeFantasia || tenant.name} · Gerenciamento centralizado
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

              <button
                onClick={() => setShowNewWashModal(true)}
                className="bg-blue-600 hover:bg-blue-500 text-white px-3 sm:px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-sm shadow-blue-600/30 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Novo Veículo</span>
              </button>
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
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span> Concluídos Hoje ({washItems.filter(w => w.status === 'Concluído').length})
                  </span>
                </div>

                {washItems.filter(w => w.status === 'Concluído').length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-xs border border-dashed border-[#1e293b] rounded-lg">
                    Nenhum serviço concluído hoje ainda.
                  </div>
                ) : (
                  washItems.filter(w => w.status === 'Concluído').map(item => (
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
                                completedAt: 'Hoje às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                                date: new Date().toISOString().split('T')[0],
                                paymentMethod: 'PIX'
                              });
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-[#0f172a] border border-[#1e293b] p-3.5 rounded-xl">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-bold uppercase">Total Agendados</span>
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
                  <span className="text-[11px] text-slate-400 font-bold uppercase">Aprovados / Na Fila</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-xl font-black text-emerald-400 mt-1">
                  {appointments.filter(a => a.status === 'Aprovado').length}
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
                {(['todos', 'Pendente', 'Aprovado', 'Cancelado'] as const).map(statusKey => {
                  const label = statusKey === 'todos' ? 'Todos' : statusKey === 'Pendente' ? 'Pendentes' : statusKey === 'Aprovado' ? 'Confirmados' : 'Cancelados';
                  const count = statusKey === 'todos' 
                    ? appointments.length 
                    : appointments.filter(a => a.status === statusKey).length;

                  return (
                    <button
                      key={statusKey}
                      onClick={() => setAppointmentStatusFilter(statusKey)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
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
                      <th className="py-3.5 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1e293b]">
                    {appointments
                      .filter(app => {
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
                      })
                      .map(app => {
                        const cleanPhone = (app.clientPhone || '').replace(/\D/g, '');
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
                                <span className="inline-flex items-center gap-1 text-[10px] px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full font-bold">
                                  <CheckCircle className="w-3 h-3" /> Confirmado / Na Fila
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] px-2.5 py-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-full font-bold">
                                  <X className="w-3 h-3" /> Cancelado
                                </span>
                              )}
                            </td>

                            <td className="py-4 px-4 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                {app.status === 'Pendente' && (
                                  <>
                                    <button
                                      onClick={() => handleCancelAppointment(app.id)}
                                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition"
                                      title="Recusar / Cancelar"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => handleApproveAppointment(app)}
                                      className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition shadow-sm shadow-emerald-600/30 inline-flex items-center gap-1 cursor-pointer"
                                      title="Enviar este agendamento para a fila de lavagem (zera em agendamentos)"
                                    >
                                      <CheckCircle className="w-3.5 h-3.5" /> Enviar para a Fila (Zerar)
                                    </button>
                                  </>
                                )}

                                {app.status === 'Aprovado' && (
                                  <>
                                    <button
                                      onClick={() => setActiveTab('fila')}
                                      className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 text-xs font-bold px-2.5 py-1.5 rounded-lg transition inline-flex items-center gap-1"
                                      title="Ver na Fila do Pátio"
                                    >
                                      <Kanban className="w-3.5 h-3.5" /> Ver no Pátio
                                    </button>
                                    <button
                                      onClick={() => handleCancelAppointment(app.id)}
                                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition"
                                      title="Cancelar agendamento"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </>
                                )}

                                {app.status === 'Cancelado' && (
                                  <>
                                    <button
                                      onClick={() => {
                                        setAppointments(prev => prev.map(a => a.id === app.id ? { ...a, status: 'Pendente' } : a));
                                        showToast('Agendamento restaurado para pendente.');
                                      }}
                                      className="text-xs text-blue-400 hover:underline px-2 py-1"
                                    >
                                      Reativar
                                    </button>
                                    <button
                                      onClick={() => handleDeleteAppointment(app.id)}
                                      className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition"
                                      title="Excluir permanentemente"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </>
                                )}
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
                <div className="text-xl font-black text-slate-100 mt-1">{washHistory.length}</div>
              </div>

              <div className="bg-[#0f172a] border border-[#1e293b] p-3.5 rounded-xl">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-bold uppercase">Faturamento Histórico</span>
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-xl font-black text-emerald-400 mt-1">
                  R$ {washHistory.reduce((acc, c) => acc + c.price, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              </div>

              <div className="bg-[#0f172a] border border-[#1e293b] p-3.5 rounded-xl">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-bold uppercase">Ticket Médio</span>
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                </div>
                <div className="text-xl font-black text-slate-100 mt-1">
                  R$ {washHistory.length > 0 
                    ? (washHistory.reduce((acc, c) => acc + c.price, 0) / washHistory.length).toFixed(2) 
                    : '0.00'}
                </div>
              </div>

              <div className="bg-[#0f172a] border border-[#1e293b] p-3.5 rounded-xl">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-bold uppercase">Comissões Pagas</span>
                  <Percent className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-xl font-black text-amber-400 mt-1">
                  R$ {washHistory.reduce((acc, c) => acc + c.commissionAmount, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
                    {washHistory
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

                    {washHistory.length === 0 && (
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

        {/* ================= ABA 3: PRODUTOS & ESTOQUE ================= */}
        {activeTab === 'produtos' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0f172a] border border-[#1e293b] p-5 rounded-xl">
              <div>
                <h3 className="font-bold text-[#f8fafc] text-base flex items-center gap-2">
                  <Package className="w-5 h-5 text-blue-400" />
                  Controle de Produtos, Insumos de Lavagem & Venda Direta
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Gerencie insumos internos de estética automotiva e produtos expostos para venda ao cliente no balcão.
                </p>
              </div>

              <button
                onClick={() => setShowNewProductModal(true)}
                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition"
              >
                <Plus className="w-4 h-4" /> Cadastrar Produto
              </button>
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

              {/* Painel Produtos de Venda Direta */}
              <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-5 space-y-4">
                <div className="flex justify-between items-center border-b border-[#1e293b] pb-3">
                  <div>
                    <h3 className="font-bold text-slate-100 flex items-center gap-2 text-sm">
                      <ShoppingBag className="w-4 h-4 text-emerald-400" /> Produtos para Venda no Balcão
                    </h3>
                    <p className="text-[11px] text-slate-400">Acessórios e cosméticos vendidos diretamente ao cliente.</p>
                  </div>
                  <span className="text-xs text-slate-400 font-bold">
                    {products.filter(p => p.category === 'venda').length} Itens
                  </span>
                </div>

                <div className="space-y-3">
                  {products.filter(p => p.category === 'venda').map(prod => (
                    <div key={prod.id} className="flex items-center justify-between p-3.5 bg-[#020617] rounded-lg border border-[#1e293b]">
                      <div>
                        <p className="text-xs font-semibold text-slate-200">{prod.name}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Preço: <strong className="text-emerald-400">R$ {prod.unitPrice?.toFixed(2)}</strong> | Estoque: {prod.stock} {prod.unit}
                        </p>
                      </div>

                      <button
                        onClick={() => handleSellProduct(prod)}
                        className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3 py-1.5 rounded transition shadow-sm shadow-blue-600/30 flex items-center gap-1"
                      >
                        <ShoppingBag className="w-3.5 h-3.5" /> Vender
                      </button>
                    </div>
                  ))}
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
              localStorage.setItem(`saas_tenant_custom_data_${updated.id}`, JSON.stringify(updated));
              saveTenantToFirestore(updated).catch(console.error);
              if (onUpdateTenant) {
                onUpdateTenant(updated);
              }
              showToast('Configurações e logotipo da empresa salvos com sucesso!');
            }}
          />
        )}

        {/* ================= ABA 6: MÓDULOS SAAS ROOT ================= */}
        {activeTab === 'saas-config' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Override Toggles */}
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

              <div className="space-y-3">
                {modules.map(mod => (
                  <div key={mod.id} className="p-3 bg-[#020617] border border-[#1e293b] rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs">
                      <CheckCircle className={`w-4 h-4 ${mod.enabled ? 'text-emerald-400' : 'text-slate-600'}`} />
                      <span className="font-semibold text-slate-200">{mod.name}</span>
                    </div>
                    <button
                      onClick={() => setModules(prev => prev.map(m => m.id === mod.id ? { ...m, enabled: !m.enabled } : m))}
                      className={`px-3 py-1 rounded text-xs font-bold transition ${
                        mod.enabled ? 'bg-indigo-600 text-white' : 'bg-[#1e293b] text-slate-400'
                      }`}
                    >
                      {mod.enabled ? 'Ativo' : 'Desativado'}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Support Message */}
            <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-5 space-y-4 flex flex-col justify-between">
              <div>
                <div className="border-b border-[#1e293b] pb-3 mb-4">
                  <h3 className="text-base font-bold text-[#f8fafc] flex items-center gap-2">
                    <Send className="w-4 h-4 text-indigo-400" />
                    Transmitir Notificação para Usuários de {tenant.name}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Exiba um comunicado prioritário no topo do painel operacional deste cliente.
                  </p>
                </div>

                <form onSubmit={(e) => {
                  e.preventDefault();
                  if (!broadcastMessage) return;
                  showToast(`Notificação enviada para os usuários de ${tenant.name}!`);
                  setBroadcastMessage('');
                }} className="space-y-3">
                  <textarea
                    rows={4}
                    value={broadcastMessage}
                    onChange={(e) => setBroadcastMessage(e.target.value)}
                    placeholder="Ex: Atualização programada do sistema de lava-rápido às 22h."
                    className="w-full bg-[#020617] border border-[#1e293b] rounded-lg p-3 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 resize-none"
                  />

                  <button
                    type="submit"
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm shadow-indigo-600/30"
                  >
                    <Send className="w-3.5 h-3.5" /> Enviar Aviso de Suporte
                  </button>
                </form>
              </div>

              <div className="pt-4 border-t border-[#1e293b] text-[11px] text-slate-500">
                Ações gravadas na auditoria de segurança ROOT.
              </div>
            </div>

          </div>
        )}

        {/* ================= ABA 6: PORTAL DO CLIENTE (VISÃO PÚBLICA) ================= */}
        {activeTab === 'portal-cliente' && (
          <ClientPortal
            tenant={tenant}
            onNewAppointmentCreated={(newApp) => {
              const createdAppointment: CustomerAppointment = {
                id: `app-${Date.now()}`,
                dateTime: newApp.dateTime,
                clientName: newApp.clientName,
                vehicle: newApp.vehicle,
                plate: newApp.plate,
                service: newApp.service,
                price: newApp.price,
                status: 'Pendente'
              };
              setAppointments(prev => [createdAppointment, ...prev]);
              showToast(`Agendamento de ${newApp.clientName} recebido no Portal! Aparece na aba Agendamentos.`);
            }}
          />
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
                <span className="font-semibold text-slate-200">{selectedWashReceipt.completedAt}</span>
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
                  const receiptText = `*COMPROVANTE DE ATENDIMENTO - ${tenant.nomeFantasia || tenant.name}*\n` +
                    `📅 Data: ${selectedWashReceipt.completedAt}\n` +
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

    </div>
  );
};
