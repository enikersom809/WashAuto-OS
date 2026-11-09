import React, { useState, useEffect, useMemo } from 'react';
import { 
  Droplet, 
  UserCircle, 
  Star, 
  Gift, 
  CheckCircle, 
  Car, 
  PlusCircle, 
  Calendar as CalendarIcon, 
  Clock, 
  Sparkles, 
  Check, 
  Lock, 
  ChevronRight, 
  ChevronLeft, 
  Trash2, 
  User, 
  MapPin, 
  Phone, 
  Mail,
  Edit3,
  Save,
  Tag,
  ShieldCheck,
  LogOut,
  Sun,
  Sunrise,
  AlertCircle,
  Loader2,
  RefreshCw,
  Activity,
  CalendarCheck,
  Bell,
  BellRing,
  Download,
  ExternalLink,
  MessageSquare,
  Truck,
  Navigation,
  CheckCircle2
} from 'lucide-react';
import { Tenant, PromoBanner, LevaETrazRequest, LevaETrazStatus, LevaETrazType, LevaETrazAddress } from '../types';
import { 
  saveClientEmailMapping, 
  saveClientFullRegistration,
  saveAppointmentToFirestore,
  deleteAppointmentFromFirestore,
  subscribeToTenantAppointments,
  saveFidelityRedemptionToFirestore,
  subscribeToTenantRedemptions,
  subscribeToFidelityPoints,
  subscribeToTenantWashItems,
  sendUserPasswordResetEmail,
  subscribeToTenantPromoBanners,
  saveLevaETrazRequest,
  subscribeToTenantLevaETraz
} from '../lib/firebaseService';
import {
  parseAppointmentDateTime,
  calculateReminder24hTarget,
  formatDateTimeDisplay,
  getAppointmentReminderAnalysis,
  buildReminderWhatsAppText,
  buildReminderWhatsAppUrl,
  buildReminderEmailContent,
  buildGoogleCalendarUrl,
  generateIcsFileContent
} from '../utils/reminderService';
import { PWAInstallButton } from './PWAInstallButton';

interface Vehicle {
  id: string;
  type: 'carro' | 'moto';
  brand: string;
  model: string;
  year: string;
  plate: string;
  color: string;
}

interface ClientPortalProps {
  tenant: Tenant;
  clientInfo?: {
    name: string;
    phone: string;
    email?: string;
  };
  onNewAppointmentCreated: (appointment: {
    id?: string;
    clientName: string;
    clientPhone?: string;
    clientEmail?: string;
    vehicle: string;
    plate: string;
    service: string;
    price: number;
    dateTime: string;
    addressSummary?: string;
  }) => void;
  onLogout?: () => void;
}

// 07:00 até 11:30 (de 30 em 30 minutos)
const MORNING_SLOTS = [
  '07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30'
];

// 13:00 até 17:30 (de 30 em 30 minutos)
const AFTERNOON_SLOTS = [
  '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30'
];

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const WEEK_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export const ClientPortal: React.FC<ClientPortalProps> = ({
  tenant,
  clientInfo,
  onNewAppointmentCreated,
  onLogout
}) => {
  // Carousel State & Banners Promocionais Dinâmicos do Lava-Jato
  const [activeSlide, setActiveSlide] = useState(0);
  const [promoBanners, setPromoBanners] = useState<PromoBanner[]>([]);

  // Escuta os banners promocionais configurados pela empresa no Firestore
  useEffect(() => {
    const unsub = subscribeToTenantPromoBanners(tenant.id, (banners) => {
      const activeOnly = banners.filter(b => b.active !== false);
      setPromoBanners(activeOnly);
    });
    return () => unsub();
  }, [tenant.id]);

  const defaultSlides = useMemo(() => [
    {
      id: 'default-1',
      tag: '🔥 Oferta da Semana',
      title: 'Combo Vitrificação + Higienização',
      subtitle: 'Ganhe 20% OFF agendando de terça a quinta-feira!',
      image: 'https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?auto=format&fit=crop&w=1200&q=80',
      serviceName: 'Combo Vitrificação + Higienização',
      discountPrice: 480,
      badge: '20% OFF'
    },
    {
      id: 'default-2',
      tag: '⭐ Lançamento Premium',
      title: 'Lavagem Detalhada + Cera Carnaúba',
      subtitle: 'Proteção de pintura com brilho molhado e secagem a ar quente.',
      image: 'https://images.unsplash.com/photo-1607860108855-64acf2078ed9?auto=format&fit=crop&w=1200&q=80',
      serviceName: 'Lavagem Detalhada + Cera Carnaúba',
      discountPrice: 120,
      badge: 'R$ 120'
    },
    {
      id: 'default-3',
      tag: '⚡ Lavagem Express',
      title: 'Ducha Ecológica + Pretinho nas Rodas',
      subtitle: 'Atendimento rápido em até 25 minutos sem agendamento demorado.',
      image: 'https://images.unsplash.com/photo-1507136566006-cfc505b114fc?auto=format&fit=crop&w=1200&q=80',
      serviceName: 'Ducha Ecológica + Pretinho',
      discountPrice: 45,
      badge: 'R$ 45'
    }
  ], []);

  const slides = useMemo(() => {
    if (promoBanners.length > 0) {
      return promoBanners.map(b => ({
        id: b.id,
        tag: b.tag,
        title: b.title,
        subtitle: b.subtitle,
        image: b.image,
        serviceName: b.serviceName || b.title,
        discountPrice: b.discountPrice,
        badge: b.badge
      }));
    }
    return defaultSlides;
  }, [promoBanners, defaultSlides]);

  // Auto-play banner carousel automatically every 4.5 seconds
  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev >= slides.length - 1 ? 0 : prev + 1));
    }, 4500);
    return () => clearInterval(timer);
  }, [slides.length]);

  // Fidelity Points State (Synchronized with Lava-Jato Company Panel in Real-Time)
  const [fidelityPoints, setFidelityPoints] = useState<number>(() => {
    const saved = localStorage.getItem(`saas_fidelity_pts_${tenant.id}`);
    return saved ? Number(saved) : 0;
  });

  const [isRewardRequested, setIsRewardRequested] = useState<boolean>(() => {
    const saved = localStorage.getItem(`saas_fidelity_redemption_${tenant.id}`);
    return !!saved;
  });

  // Fila de lavagem em tempo real (veículos no pátio monitorados pelo cliente)
  const [patioWashes, setPatioWashes] = useState<any[]>([]);
  const [isCloudSynced, setIsCloudSynced] = useState<boolean>(true);

  // Sync points and redemption requests on mount with Firestore in Real-Time
  useEffect(() => {
    const clientKey = clientInfo?.phone || clientInfo?.email || 'global';
    
    // Escuta pontos da empresa no Firestore
    const unsubPoints = subscribeToFidelityPoints(tenant.id, clientKey, (livePts) => {
      setFidelityPoints(livePts);
      localStorage.setItem(`saas_fidelity_pts_${tenant.id}`, String(livePts));
      setIsCloudSynced(true);
    });

    // Escuta resgates de fidelidade no Firestore
    const unsubReds = subscribeToTenantRedemptions(tenant.id, (reds) => {
      const myRed = reds.find(r => 
        (r.clientPhone === clientInfo?.phone || r.clientName === clientInfo?.name) &&
        r.status === 'pending'
      );
      setIsRewardRequested(!!myRed);
    });

    // Escuta fila do pátio para acompanhar status do carro
    const unsubWashes = subscribeToTenantWashItems(tenant.id, (washes) => {
      setPatioWashes(washes);
    });

    return () => {
      unsubPoints();
      unsubReds();
      unsubWashes();
    };
  }, [tenant.id, clientInfo]);

  // ================= 1. DADOS CADASTRAIS DO CLIENTE =================
  // Carrega dados pessoais salvos do cadastro ou das props
  const [clientProfile, setClientProfile] = useState(() => {
    const saved = localStorage.getItem(`saas_client_profile_${tenant.id}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          name: parsed.name || clientInfo?.name || 'Cliente',
          email: parsed.email || clientInfo?.email || 'cliente@exemplo.com',
          phone: parsed.phone || clientInfo?.phone || '(11) 99999-9999'
        };
      } catch (e) {}
    }
    return {
      name: clientInfo?.name || 'Cliente',
      email: clientInfo?.email || 'cliente@exemplo.com',
      phone: clientInfo?.phone || '(11) 99999-9999'
    };
  });

  const [isEditingPersonal, setIsEditingPersonal] = useState(false);
  const [editName, setEditName] = useState(clientProfile.name);
  const [editEmail, setEditEmail] = useState(clientProfile.email);
  const [editPhone, setEditPhone] = useState(clientProfile.phone);

  // Endereço (Dados principais para preenchimento)
  const [cep, setCep] = useState(() => {
    const saved = localStorage.getItem(`saas_client_address_${tenant.id}`);
    if (saved) {
      try { return JSON.parse(saved).cep || ''; } catch (e) {}
    }
    return '';
  });

  const [address, setAddress] = useState(() => {
    const saved = localStorage.getItem(`saas_client_address_${tenant.id}`);
    if (saved) {
      try { return JSON.parse(saved).address || ''; } catch (e) {}
    }
    return '';
  });

  const [neighborhood, setNeighborhood] = useState(() => {
    const saved = localStorage.getItem(`saas_client_address_${tenant.id}`);
    if (saved) {
      try { return JSON.parse(saved).neighborhood || ''; } catch (e) {}
    }
    return '';
  });

  const [city, setCity] = useState(() => {
    const saved = localStorage.getItem(`saas_client_address_${tenant.id}`);
    if (saved) {
      try { return JSON.parse(saved).city || ''; } catch (e) {}
    }
    return '';
  });

  const [stateUf, setStateUf] = useState(() => {
    const saved = localStorage.getItem(`saas_client_address_${tenant.id}`);
    if (saved) {
      try { return JSON.parse(saved).stateUf || ''; } catch (e) {}
    }
    return '';
  });

  // Salva endereço automaticamente no localStorage
  useEffect(() => {
    const addressObj = { cep, address, neighborhood, city, stateUf };
    localStorage.setItem(`saas_client_address_${tenant.id}`, JSON.stringify(addressObj));
  }, [cep, address, neighborhood, city, stateUf, tenant.id]);

  const handleSavePersonalProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = {
      name: editName.trim() || 'Cliente',
      email: editEmail.trim() || 'cliente@exemplo.com',
      phone: editPhone.trim() || '(11) 99999-9999'
    };
    setClientProfile(updated);
    localStorage.setItem(`saas_client_profile_${tenant.id}`, JSON.stringify(updated));
    if (updated.email) {
      const slug = tenant.domain.replace('.saas.com', '').replace(/[^a-z0-9-]/g, '').trim();
      saveClientEmailMapping(updated.email, tenant.id, slug, tenant.name);
    }
    setIsEditingPersonal(false);
    showToast('Dados pessoais atualizados com sucesso!');
  };

  // Redefinição de Senha do Cliente via Firebase Auth
  const [isSendingResetEmail, setIsSendingResetEmail] = useState(false);
  const [resetEmailStatus, setResetEmailStatus] = useState<string | null>(null);

  const handleClientRequestResetEmail = async () => {
    const emailToUse = (clientProfile.email || clientInfo?.email || editEmail || '').trim();
    if (!emailToUse || !emailToUse.includes('@')) {
      showToast('⚠️ Informe um e-mail válido no seu cadastro para receber o link.');
      return;
    }
    setIsSendingResetEmail(true);
    setResetEmailStatus(null);
    try {
      const res = await sendUserPasswordResetEmail(emailToUse);
      setResetEmailStatus(res.message);
      showToast(res.success ? '✉️ Link enviado para seu e-mail!' : res.message);
    } catch (err: any) {
      setResetEmailStatus(err.message || 'Erro ao enviar e-mail de redefinição.');
    } finally {
      setIsSendingResetEmail(false);
    }
  };

  // ================= 2. LISTA DE VEÍCULOS =================
  // Inicia vazia para novos cadastros (sem veículo pré-cadastrado forçado)
  const [vehicles, setVehicles] = useState<Vehicle[]>(() => {
    const saved = localStorage.getItem(`saas_client_vehicles_${tenant.id}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        console.error(e);
      }
    }
    return [];
  });

  // Sync vehicles to localStorage
  useEffect(() => {
    localStorage.setItem(`saas_client_vehicles_${tenant.id}`, JSON.stringify(vehicles));
  }, [vehicles, tenant.id]);

  // New Vehicle Inputs
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [vType, setVType] = useState<'carro' | 'moto'>('carro');
  const [vBrand, setVBrand] = useState('');
  const [vModel, setVModel] = useState('');
  const [vYear, setVYear] = useState('');
  const [vPlate, setVPlate] = useState('');
  const [vColor, setVColor] = useState('');

  // ================= 3. AGENDAMENTO & CALENDÁRIO VISUAL =================
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(() => {
    const saved = localStorage.getItem(`saas_client_vehicles_${tenant.id}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed[0].id;
      } catch (e) {}
    }
    return '';
  });

  const [selectedService, setSelectedService] = useState('Lavagem Detalhada + Cera');
  const [selectedPrice, setSelectedPrice] = useState(120);
  const [clientKmInput, setClientKmInput] = useState('');
  const [clientOilInterval, setClientOilInterval] = useState<8000 | 10000>(10000);

  // Data Selecionada (Formato YYYY-MM-DD)
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [selectedDate, setSelectedDate] = useState(todayStr);

  // Navegação no Calendário (Mês / Ano)
  const [currentCalendarDate, setCurrentCalendarDate] = useState(() => new Date());

  // Horário Selecionado
  const [selectedTimeSlot, setSelectedTimeSlot] = useState('08:00');

  // Configurações do Lembrete 24h
  const [reminder24hEnabled, setReminder24hEnabled] = useState(true);
  const [reminderChannel, setReminderChannel] = useState<'whatsapp' | 'email' | 'ambos'>('ambos');

  const calculatedReminderSchedule = useMemo(() => {
    const serviceDate = parseAppointmentDateTime({ date: selectedDate, time: selectedTimeSlot });
    if (!serviceDate) return null;
    const reminderTarget = calculateReminder24hTarget(serviceDate);
    const diffMs = serviceDate.getTime() - Date.now();
    return {
      serviceDate,
      reminderTarget,
      formatted: formatDateTimeDisplay(reminderTarget),
      isWithin24Hours: diffMs <= 24 * 60 * 60 * 1000 && diffMs > 0
    };
  }, [selectedDate, selectedTimeSlot]);

  // ================= 4. SISTEMA DE LEVA E TRAZ NO PORTAL DO CLIENTE =================
  const [hasLevaETraz, setHasLevaETraz] = useState(false);
  const [levaETrazType, setLevaETrazType] = useState<LevaETrazType>('completo');
  const [levaETrazStreet, setLevaETrazStreet] = useState('');
  const [levaETrazNumber, setLevaETrazNumber] = useState('');
  const [levaETrazNeighborhood, setLevaETrazNeighborhood] = useState('');
  const [levaETrazComplement, setLevaETrazComplement] = useState('');
  const [levaETrazCity, setLevaETrazCity] = useState('');
  const [levaETrazCep, setLevaETrazCep] = useState('');
  const [levaETrazReference, setLevaETrazReference] = useState('');
  const [levaETrazDriverNotes, setLevaETrazDriverNotes] = useState('');

  // Taxa do Leva e Traz: R$ 25 p/ completo (buscar + entregar), R$ 15 p/ apenas buscar ou apenas entregar
  const levaETrazFee = useMemo(() => {
    if (!hasLevaETraz) return 0;
    return levaETrazType === 'completo' ? 25 : 15;
  }, [hasLevaETraz, levaETrazType]);

  const totalBookingPrice = useMemo(() => {
    return selectedPrice + levaETrazFee;
  }, [selectedPrice, levaETrazFee]);

  // Lista de solicitações de Leva e Traz em tempo real (Nuvem)
  const [tenantLevaETraz, setTenantLevaETraz] = useState<LevaETrazRequest[]>(() => {
    const saved = localStorage.getItem(`saas_tenant_leva_e_traz_${tenant.id}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
    }
    return [];
  });

  useEffect(() => {
    const unsubLeva = subscribeToTenantLevaETraz(tenant.id, (remoteItems) => {
      if (remoteItems) {
        setTenantLevaETraz(remoteItems);
        localStorage.setItem(`saas_tenant_leva_e_traz_${tenant.id}`, JSON.stringify(remoteItems));
      }
    });
    return () => unsubLeva();
  }, [tenant.id]);

  // Auto-preenchimento inicial do endereço do Leva e Traz com base no endereço cadastrado
  useEffect(() => {
    if (!levaETrazStreet && address) setLevaETrazStreet(address);
    if (!levaETrazNeighborhood && neighborhood) setLevaETrazNeighborhood(neighborhood);
    if (!levaETrazCity && city) setLevaETrazCity(city);
    if (!levaETrazCep && cep) setLevaETrazCep(cep);
  }, [address, neighborhood, city, cep, levaETrazStreet, levaETrazNeighborhood, levaETrazCity, levaETrazCep]);

  // Monitora agendamentos da empresa para atualizar a Trava Automática
  const [tenantAppointments, setTenantAppointments] = useState<any[]>(() => {
    const saved = localStorage.getItem(`saas_tenant_appointments_${tenant.id}`);
    if (saved) {
      try { 
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed.filter((a: any) => !a.id?.startsWith('app-init-'));
      } catch (e) {}
    }
    return [];
  });

  useEffect(() => {
    // 📡 Sincronização em tempo real via Nuvem (Firestore) entre Computador e Celular
    const unsub = subscribeToTenantAppointments(tenant.id, (remoteApps) => {
      if (remoteApps) {
        setTenantAppointments(remoteApps.filter((a: any) => !a.id?.startsWith('app-init-')));
        localStorage.setItem(`saas_tenant_appointments_${tenant.id}`, JSON.stringify(remoteApps));
      }
    });

    const refreshAppointments = () => {
      const saved = localStorage.getItem(`saas_tenant_appointments_${tenant.id}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) setTenantAppointments(parsed.filter((a: any) => !a.id?.startsWith('app-init-')));
        } catch (e) {}
      }
    };
    window.addEventListener('storage', refreshAppointments);
    window.addEventListener('saas_data_sync', refreshAppointments);
    return () => {
      unsub();
      window.removeEventListener('storage', refreshAppointments);
      window.removeEventListener('saas_data_sync', refreshAppointments);
    };
  }, [tenant.id]);

  // Calcula conjunto de horários travados / ocupados para a data selecionada (apenas agendamentos reais)
  const lockedSlotsSet = useMemo(() => {
    const locked = new Set<string>();

    // Horários de agendamentos reais da empresa para esta data
    tenantAppointments.forEach(app => {
      if (app.dateTime && app.status !== 'Recusado' && app.status !== 'Cancelado') {
        const dateFormattedBR = selectedDate.includes('-')
          ? selectedDate.split('-').reverse().join('/')
          : selectedDate;

        if (
          app.date === selectedDate ||
          app.dateTime.includes(selectedDate) || 
          app.dateTime.includes(dateFormattedBR)
        ) {
          const match = (app.time || app.dateTime).match(/(\d{2}:\d{2})/);
          if (match) locked.add(match[1]);
        }
      }
    });

    return locked;
  }, [selectedDate, tenantAppointments]);

  // Se o slot selecionado estiver travado, seleciona o primeiro slot livre
  useEffect(() => {
    if (lockedSlotsSet.has(selectedTimeSlot)) {
      const all = [...MORNING_SLOTS, ...AFTERNOON_SLOTS];
      const firstFree = all.find(slot => !lockedSlotsSet.has(slot));
      if (firstFree) setSelectedTimeSlot(firstFree);
    }
  }, [selectedDate, lockedSlotsSet, selectedTimeSlot]);

  const servicesList = [
    { name: 'Somente Troca de Óleo', price: 150 },
    { name: 'Combo: Troca de Óleo + Ducha Completa', price: 190 },
    { name: 'Combo: Troca de Óleo + Lavagem Detalhada', price: 250 },
    { name: 'Lavagem Simples', price: 60 },
    { name: 'Lavagem Detalhada + Cera', price: 120 },
    { name: 'Higienização de Bancos & Ar', price: 250 },
    { name: 'Combo Vitrificação + Higienização (20% OFF)', price: 480 },
    { name: 'Polimento & Cristalização 3M', price: 350 },
    { name: 'Ducha Ecológica + Pretinho', price: 45 }
  ];

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Modo de visualização: Agendamento, Ficha de Cadastro (Via QR) ou Status em Tempo Real
  const [portalTab, setPortalTab] = useState<'agendar' | 'cadastro' | 'status'>('agendar');
  const [isSearchingCep, setIsSearchingCep] = useState(false);

  // Busca Automática de Endereço via CEP (ViaCEP)
  const buscarCEP = async (valorCep: string) => {
    const cleanCep = valorCep.replace(/\D/g, '');
    if (cleanCep.length !== 8) return;

    try {
      setIsSearchingCep(true);
      const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await res.json();
      if (!data.erro) {
        if (data.logradouro) setAddress(data.logradouro);
        if (data.bairro) setNeighborhood(data.bairro);
        if (data.localidade) setCity(data.localidade);
        if (data.uf) setStateUf(data.uf);
        setCep(cleanCep.replace(/^(\d{5})(\d{3})/, '$1-$2'));
        showToast('Endereço preenchido automaticamente via CEP!');
      } else {
        showToast('⚠️ CEP não encontrado.');
      }
    } catch (err) {
      console.error('Erro ao buscar CEP:', err);
    } finally {
      setIsSearchingCep(false);
    }
  };

  // Seção de Veículos Dinâmicos para a Ficha de Cadastro
  const [formVehicles, setFormVehicles] = useState<Array<{
    id: string;
    type: 'carro' | 'moto';
    brand: string;
    model: string;
    year: string;
    plate: string;
    color: string;
  }>>(() => {
    const saved = localStorage.getItem(`saas_client_vehicles_${tenant.id}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return [{
      id: `v-${Date.now()}`,
      type: 'carro',
      brand: '',
      model: '',
      year: new Date().getFullYear().toString(),
      plate: '',
      color: ''
    }];
  });

  const handleAddDynamicVehicle = () => {
    setFormVehicles(prev => [
      ...prev,
      {
        id: `v-${Date.now()}-${prev.length}`,
        type: 'carro',
        brand: '',
        model: '',
        year: new Date().getFullYear().toString(),
        plate: '',
        color: ''
      }
    ]);
  };

  const handleRemoveDynamicVehicle = (index: number) => {
    if (formVehicles.length <= 1) return;
    setFormVehicles(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleUpdateDynamicVehicle = (index: number, field: string, val: string) => {
    setFormVehicles(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  const handleFullRegistrationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const finalName = editName.trim() || clientProfile.name.trim();
    if (!finalName) {
      showToast('Por favor, informe seu nome completo.');
      return;
    }

    // Salva perfil pessoal
    const updatedProfile = {
      name: finalName,
      email: editEmail.trim() || clientProfile.email,
      phone: editPhone.trim() || clientProfile.phone
    };
    setClientProfile(updatedProfile);
    localStorage.setItem(`saas_client_profile_${tenant.id}`, JSON.stringify(updatedProfile));

    // Salva endereço
    const addressObj = { cep, address, neighborhood, city, stateUf };
    localStorage.setItem(`saas_client_address_${tenant.id}`, JSON.stringify(addressObj));

    // Salva veículos (filtrando os que têm ao menos marca ou modelo ou placa)
    const validVehicles: Vehicle[] = formVehicles
      .filter(v => v.brand.trim() || v.model.trim() || v.plate.trim())
      .map(v => ({
        id: v.id,
        type: v.type,
        brand: v.brand.trim() || 'Veículo',
        model: v.model.trim() || 'Modelo',
        year: v.year.trim() || new Date().getFullYear().toString(),
        plate: v.plate.trim().toUpperCase() || 'ABC-1234',
        color: v.color.trim() || 'Padrão'
      }));

    if (validVehicles.length > 0) {
      setVehicles(validVehicles);
      setSelectedVehicleId(validVehicles[0].id);
      localStorage.setItem(`saas_client_vehicles_${tenant.id}`, JSON.stringify(validVehicles));
    }

    // Grava no Firebase Firestore
    await saveClientFullRegistration(tenant.id, {
      name: updatedProfile.name,
      email: updatedProfile.email,
      phone: updatedProfile.phone,
      cep,
      address,
      neighborhood,
      city,
      stateUf,
      vehicles: validVehicles
    });

    showToast('🎉 Ficha de cadastro e veículos salvos com sucesso!');
    setPortalTab('agendar');
  };

  const handleAddVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vBrand || !vModel || !vPlate) return;

    const newV: Vehicle = {
      id: `v-${Date.now()}`,
      type: vType,
      brand: vBrand,
      model: vModel,
      year: vYear || new Date().getFullYear().toString(),
      plate: vPlate.toUpperCase(),
      color: vColor || 'Indefinida'
    };

    setVehicles(prev => [...prev, newV]);
    setSelectedVehicleId(newV.id);
    setShowAddVehicle(false);
    setVBrand('');
    setVModel('');
    setVYear('');
    setVPlate('');
    setVColor('');
    showToast('Veículo adicionado com sucesso!');
  };

  const handleRemoveVehicle = (id: string) => {
    setVehicles(prev => {
      const remaining = prev.filter(v => v.id !== id);
      if (selectedVehicleId === id) {
        setSelectedVehicleId(remaining.length > 0 ? remaining[0].id : '');
      }
      return remaining;
    });
    showToast('Veículo removido!');
  };

  const handleRequestFidelityReward = async () => {
    if (fidelityPoints < 10) {
      showToast(`Você possui ${fidelityPoints} de 10 lavagens necessárias.`);
      return;
    }
    setIsRewardRequested(true);
    localStorage.setItem(`saas_fidelity_redemption_${tenant.id}`, 'pending');
    window.dispatchEvent(new Event('storage'));

    const veh = vehicles[0];
    await saveFidelityRedemptionToFirestore(tenant.id, {
      id: `red-${Date.now()}`,
      clientName: clientProfile.name || 'Cliente',
      clientPhone: clientProfile.phone || '',
      vehicle: veh ? `${veh.brand} ${veh.model} (${veh.plate})` : 'Veículo Cadastrado',
      status: 'pending'
    });

    showToast('🎉 Solicitação de Lavagem Grátis enviada em tempo real para o Lava-Jato!');
  };

  const handleSelectPromotion = (promoServiceName: string, promoPrice: number) => {
    setSelectedService(promoServiceName);
    setSelectedPrice(promoPrice);
    showToast(`Promoção "${promoServiceName}" selecionada!`);
    const elem = document.getElementById('agendamento-section');
    if (elem) elem.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSubmitAppointment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (vehicles.length === 0) {
      showToast('⚠️ Por favor, adicione o seu veículo (carro ou moto) antes de agendar!');
      setShowAddVehicle(true);
      const elem = document.getElementById('veiculos-section');
      if (elem) elem.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    if (lockedSlotsSet.has(selectedTimeSlot)) {
      showToast('⚠️ Este horário já está reservado. Por favor, selecione outro horário disponível.');
      return;
    }

    if (hasLevaETraz) {
      if (!levaETrazStreet.trim() && !address.trim()) {
        showToast('⚠️ Por favor, informe a Rua/Avenida para o serviço de Leva e Traz.');
        return;
      }
      if (!levaETrazNumber.trim()) {
        showToast('⚠️ Por favor, informe o número da residência ou estabelecimento para o Leva e Traz.');
        return;
      }
    }

    const veh = vehicles.find(v => v.id === selectedVehicleId) || vehicles[0];

    const formattedDateDisplay = selectedDate.includes('-')
      ? selectedDate.split('-').reverse().join('/')
      : selectedDate;

    const finalStreet = (levaETrazStreet || address || '').trim();
    const finalNumber = (levaETrazNumber || '').trim();
    const finalNeighborhood = (levaETrazNeighborhood || neighborhood || '').trim();
    const finalCity = (levaETrazCity || city || tenant.cidade || '').trim();
    const finalCep = (levaETrazCep || cep || '').trim();

    const levaAddress: LevaETrazAddress = {
      cep: finalCep || undefined,
      street: finalStreet || 'Endereço a confirmar',
      number: finalNumber || 'S/N',
      neighborhood: finalNeighborhood || '',
      complement: levaETrazComplement.trim() || undefined,
      city: finalCity || '',
      state: stateUf.trim() || tenant.estado || undefined,
      reference: levaETrazReference.trim() || undefined
    };

    const addressSummary = hasLevaETraz
      ? `[Leva e Traz: ${levaETrazType === 'completo' ? 'Buscar & Entregar' : levaETrazType === 'buscar' ? 'Apenas Buscar' : 'Apenas Entregar'}] ${finalStreet}, ${finalNumber} - ${finalNeighborhood}`
      : address 
      ? `${address}, ${neighborhood || ''} - ${city || ''}/${stateUf || ''}`.replace(/^,\s*|,\s*$/g, '')
      : 'Atendimento no estabelecimento';

    const cleanKmNum = parseInt(clientKmInput.replace(/\D/g, ''), 10);
    const hasKm = !isNaN(cleanKmNum) && cleanKmNum > 0;
    const finalServiceName = hasKm
      ? `${selectedService} [KM Atual: ${cleanKmNum.toLocaleString('pt-BR')} | Próxima: ${(cleanKmNum + clientOilInterval).toLocaleString('pt-BR')} km]`
      : selectedService;

    const appId = `app-${Date.now()}`;
    const levaRequestId = `leva-${Date.now()}`;

    const newAppPayload = {
      id: appId,
      clientName: clientProfile.name,
      clientPhone: clientProfile.phone,
      clientEmail: clientProfile.email,
      vehicle: `${veh.brand} ${veh.model}`,
      plate: veh.plate,
      service: finalServiceName,
      price: hasLevaETraz ? totalBookingPrice : selectedPrice,
      dateTime: `${formattedDateDisplay} ${selectedTimeSlot}`,
      date: selectedDate,
      time: selectedTimeSlot,
      addressSummary,
      status: 'Pendente',
      createdAt: new Date().toISOString(),
      reminder24hEnabled,
      reminder24hScheduledAt: calculatedReminderSchedule?.reminderTarget ? calculatedReminderSchedule.reminderTarget.toISOString() : undefined,
      reminder24hSent: false,
      reminderChannel,
      hasLevaETraz,
      levaETrazType: hasLevaETraz ? levaETrazType : undefined,
      levaETrazFee: hasLevaETraz ? levaETrazFee : undefined,
      levaETrazAddress: hasLevaETraz ? levaAddress : undefined,
      levaETrazStatus: hasLevaETraz ? ('solicitado' as LevaETrazStatus) : undefined
    };

    // 🚀 Se solicitou Leva e Traz, registra no Firestore
    if (hasLevaETraz) {
      const newLevaPayload: LevaETrazRequest = {
        id: levaRequestId,
        tenantId: tenant.id,
        type: levaETrazType,
        status: 'solicitado',
        clientName: clientProfile.name,
        clientPhone: clientProfile.phone,
        clientEmail: clientProfile.email,
        vehicle: `${veh.brand} ${veh.model}`,
        plate: veh.plate,
        service: finalServiceName,
        servicePrice: selectedPrice,
        feePrice: levaETrazFee,
        totalPrice: totalBookingPrice,
        address: levaAddress,
        appointmentId: appId,
        scheduledDate: selectedDate,
        scheduledTime: selectedTimeSlot,
        notes: levaETrazDriverNotes.trim() || undefined,
        statusHistory: [
          {
            status: 'solicitado',
            timestamp: new Date().toISOString(),
            note: 'Solicitação realizada no Portal do Cliente'
          }
        ],
        createdAt: new Date().toISOString()
      };

      await saveLevaETrazRequest(newLevaPayload);
      setTenantLevaETraz(prev => [newLevaPayload, ...prev]);
    }

    // 🚀 Salva no Firestore instantaneamente para sincronizar com o computador do Lava-Jato
    await saveAppointmentToFirestore(tenant.id, newAppPayload);

    onNewAppointmentCreated(newAppPayload);
    showToast(
      hasLevaETraz
        ? `✅ Solicitação de Leva e Traz confirmada! Horário: ${selectedTimeSlot} dia ${formattedDateDisplay}. Acompanhe em tempo real!`
        : `✅ Agendamento de ${selectedTimeSlot} no dia ${formattedDateDisplay} enviado! Lembrete 24h ativado.`
    );

    // Abre a aba de acompanhamento em tempo real para o cliente visualizar
    setPortalTab('status');
  };

  // ================= CALENDÁRIO DIAS MATRIX =================
  const calendarDays = useMemo(() => {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days = [];

    // Dias do mês anterior para preenchimento visual
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      days.push({
        dayNumber: prevMonthDays - i,
        isCurrentMonth: false,
        dateStr: '',
        isPast: true
      });
    }

    // Dias do mês atual
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(year, month, d);
      dateObj.setHours(0, 0, 0, 0);

      const yyyy = year.toString();
      const mm = String(month + 1).padStart(2, '0');
      const dd = String(d).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;

      const isPast = dateObj.getTime() < today.getTime();
      const isToday = dateStr === todayStr;
      const isSelected = dateStr === selectedDate;

      days.push({
        dayNumber: d,
        isCurrentMonth: true,
        dateStr,
        isPast,
        isToday,
        isSelected
      });
    }

    return days;
  }, [currentCalendarDate, todayStr, selectedDate]);

  const handlePrevMonth = () => {
    setCurrentCalendarDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentCalendarDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleDateChange = (newDateStr: string) => {
    if (!newDateStr) return;
    if (newDateStr < todayStr) {
      showToast('⚠️ Por favor, selecione uma data de hoje em diante.');
      setSelectedDate(todayStr);
      return;
    }
    setSelectedDate(newDateStr);
    const [y, m, d] = newDateStr.split('-').map(Number);
    if (y && m) {
      setCurrentCalendarDate(new Date(y, m - 1, d || 1));
    }
  };

  const setQuickDate = (daysAhead: number, targetDayOfWeek?: number) => {
    const d = new Date();
    if (typeof targetDayOfWeek === 'number') {
      const currentDay = d.getDay();
      let diff = targetDayOfWeek - currentDay;
      if (diff <= 0) diff += 7;
      d.setDate(d.getDate() + diff);
    } else {
      d.setDate(d.getDate() + daysAhead);
    }
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    handleDateChange(dateStr);
  };

  const selectedDateHuman = useMemo(() => {
    if (!selectedDate || !selectedDate.includes('-')) return selectedDate;
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    if (isNaN(dateObj.getTime())) return selectedDate;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(y, m - 1, d);
    const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    const weekDayName = dateObj.toLocaleDateString('pt-BR', { weekday: 'long' });
    const capitalizedWeekDay = weekDayName.charAt(0).toUpperCase() + weekDayName.slice(1);
    const formattedDayMonth = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

    let prefix = '';
    if (diffDays === 0) prefix = 'Hoje • ';
    else if (diffDays === 1) prefix = 'Amanhã • ';
    else if (diffDays === 2) prefix = 'Depois de amanhã • ';
    else if (diffDays > 2) prefix = `Em ${diffDays} dias • `;

    return `${prefix}${capitalizedWeekDay}, ${formattedDayMonth}`;
  }, [selectedDate]);

  const handleSelectDay = (dateStr: string, isPast: boolean) => {
    if (isPast) return;
    handleDateChange(dateStr);
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans pb-16">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-blue-600 border border-blue-400 text-white px-5 py-3.5 rounded-xl shadow-2xl flex items-center gap-3 animate-bounce">
          <Sparkles className="w-5 h-5 text-yellow-300 shrink-0" />
          <span className="text-xs font-bold">{toastMessage}</span>
        </div>
      )}

      {/* Header do Lava-Jato com Identidade Visual */}
      <header className="bg-[#0f172a]/95 backdrop-blur-md border-b border-[#1e293b] sticky top-0 z-40 px-4 lg:px-8 py-3.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700/80 flex items-center justify-center font-black text-white text-base shadow-lg shadow-blue-500/25 overflow-hidden p-0.5 shrink-0">
              {tenant.logoUrl ? (
                <img src={tenant.logoUrl} alt={tenant.nomeFantasia || tenant.name} className="w-full h-full object-contain" />
              ) : (
                <div className="w-full h-full rounded-lg bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center">
                  {tenant.code || 'LJ'}
                </div>
              )}
            </div>
            <div>
              <h1 className="text-base font-bold text-[#f8fafc] flex items-center gap-2">
                {tenant.name}
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold">
                  Online
                </span>
              </h1>
              <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <Tag className="w-3 h-3 text-blue-400" /> Portal do Cliente · {tenant.domain}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* PWA App Install Button */}
            <PWAInstallButton compact variant="outline" className="hidden sm:inline-flex" />

            {/* Status do Cliente Logado */}
            <div className="hidden sm:flex items-center gap-2 bg-[#020617] border border-[#1e293b] px-3 py-1.5 rounded-xl text-xs">
              <UserCircle className="w-4 h-4 text-blue-400" />
              <div className="text-left">
                <span className="block font-bold text-slate-200 leading-tight">{clientProfile.name}</span>
                <span className="block text-[10px] text-slate-400 font-mono">{clientProfile.phone}</span>
              </div>
            </div>

            {onLogout && (
              <button
                onClick={onLogout}
                className="bg-slate-800/80 hover:bg-rose-500/20 hover:text-rose-400 border border-slate-700/80 text-slate-300 px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                title="Sair da Conta"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Sair</span>
              </button>
            )}
          </div>

        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 lg:px-8 pt-6 space-y-8">

        {/* ================= ABAS DO PORTAL DO CLIENTE ================= */}
        <div className="flex flex-col sm:flex-row gap-2.5 p-2 bg-[#111827] border border-[#1F2937] rounded-xl">
          <button
            type="button"
            onClick={() => setPortalTab('agendar')}
            className={`flex-1 py-2.5 px-4 rounded-lg font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 cursor-pointer ${
              portalTab === 'agendar'
                ? 'bg-[#00A3FF] text-white shadow-md shadow-blue-500/20'
                : 'text-slate-400 hover:text-white bg-transparent'
            }`}
          >
            <CalendarIcon className="w-4 h-4" /> 1. Agendamento & Serviços
          </button>

          <button
            type="button"
            onClick={() => setPortalTab('cadastro')}
            className={`flex-1 py-2.5 px-4 rounded-lg font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 cursor-pointer ${
              portalTab === 'cadastro'
                ? 'text-slate-950 shadow-md shadow-cyan-500/20 font-black'
                : 'text-cyan-400 hover:text-cyan-300 bg-transparent'
            }`}
            style={portalTab === 'cadastro' ? { background: 'linear-gradient(90deg, #00A3FF, #00FFCC)' } : undefined}
          >
            <Edit3 className="w-4 h-4" /> 2. Ficha de Cadastro (Via QR)
          </button>

          <button
            type="button"
            onClick={() => setPortalTab('status')}
            className={`flex-1 py-2.5 px-4 rounded-lg font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 cursor-pointer relative ${
              portalTab === 'status'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                : 'text-emerald-400 hover:text-emerald-300 bg-transparent'
            }`}
          >
            <Activity className="w-4 h-4" /> 3. Acompanhar em Tempo Real
            {tenantAppointments.some(a => a.clientPhone === clientProfile.phone || a.clientName === clientProfile.name) && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping absolute top-2 right-2" />
            )}
          </button>
        </div>

        {/* === ABA 2: TELA DO CLIENTE (FICHA DE CADASTRO VIA QR) === */}
        {portalTab === 'cadastro' && (
          <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl animate-fadeIn">
            <div className="border-b border-[#1F2937] pb-4 flex items-center gap-4">
              {tenant.logoUrl && (
                <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-700 p-1 flex items-center justify-center overflow-hidden shrink-0 shadow-md">
                  <img src={tenant.logoUrl} alt={tenant.nomeFantasia || tenant.name} className="w-full h-full object-contain" />
                </div>
              )}
              <div>
                <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-cyan-400" /> Ficha de Cadastro de Cliente
                </h2>
                <p className="text-cyan-400 font-medium text-sm">
                  Seja bem-vindo(a) ao estabelecimento: <strong>{tenant.nomeFantasia || tenant.name}</strong>. Preencha seus dados para agilizar seu atendimento e acumular selos de fidelidade.
                </p>
              </div>
            </div>

            <form onSubmit={handleFullRegistrationSubmit} className="space-y-6">
              {/* Dados Pessoais */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-[#9CA3AF] font-semibold mb-1.5">
                    Nome Completo
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Digite seu nome completo"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full p-3 bg-[#1F2937] border border-[#374151] rounded-lg text-white font-medium focus:outline-none focus:border-[#00A3FF] text-sm"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-[#9CA3AF] font-semibold mb-1.5">
                      WhatsApp / Telefone
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="(11) 98765-4321"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      className="w-full p-3 bg-[#1F2937] border border-[#374151] rounded-lg text-white font-medium focus:outline-none focus:border-[#00A3FF] text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-[#9CA3AF] font-semibold mb-1.5">
                      E-mail (Para Notificações)
                    </label>
                    <input
                      type="email"
                      placeholder="seu@email.com"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      className="w-full p-3 bg-[#1F2937] border border-[#374151] rounded-lg text-white font-medium focus:outline-none focus:border-[#00A3FF] text-sm"
                    />
                  </div>
                </div>

                {/* Dados de Endereço com Busca Automática ViaCEP */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-[#9CA3AF] font-semibold mb-1.5 flex items-center justify-between">
                      <span>CEP (Busca Automática)</span>
                      {isSearchingCep && <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />}
                    </label>
                    <input
                      type="text"
                      maxLength={9}
                      placeholder="00000-000"
                      value={cep}
                      onChange={(e) => {
                        setCep(e.target.value);
                        if (e.target.value.replace(/\D/g, '').length === 8) {
                          buscarCEP(e.target.value);
                        }
                      }}
                      onBlur={(e) => buscarCEP(e.target.value)}
                      className="w-full p-3 bg-[#1F2937] border border-[#374151] rounded-lg text-white font-mono focus:outline-none focus:border-[#00A3FF] text-sm"
                      required
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-sm text-[#9CA3AF] font-semibold mb-1.5">
                      Endereço Completo
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Rua, Número, Apto"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full p-3 bg-[#1F2937] border border-[#374151] rounded-lg text-white font-medium focus:outline-none focus:border-[#00A3FF] text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-[#9CA3AF] font-semibold mb-1.5">
                      Bairro
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Bairro"
                      value={neighborhood}
                      onChange={(e) => setNeighborhood(e.target.value)}
                      className="w-full p-3 bg-[#1F2937] border border-[#374151] rounded-lg text-white font-medium focus:outline-none focus:border-[#00A3FF] text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-[#9CA3AF] font-semibold mb-1.5">
                      Cidade
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Cidade"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full p-3 bg-[#1F2937] border border-[#374151] rounded-lg text-white font-medium focus:outline-none focus:border-[#00A3FF] text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-[#9CA3AF] font-semibold mb-1.5">
                      Estado (UF)
                    </label>
                    <input
                      type="text"
                      maxLength={2}
                      required
                      placeholder="EX: SP"
                      value={stateUf}
                      onChange={(e) => setStateUf(e.target.value.toUpperCase())}
                      className="w-full p-3 bg-[#1F2937] border border-[#374151] rounded-lg text-white font-bold uppercase focus:outline-none focus:border-[#00A3FF] text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Seção de Veículos Dinâmicos */}
              <div className="pt-4 border-t border-[#1F2937]">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Car className="w-5 h-5 text-[#00A3FF]" /> Veículos ({formVehicles.length})
                  </h3>
                  <span className="text-xs text-slate-400">
                    Cadastre um ou mais veículos para lavagens rápidas
                  </span>
                </div>

                <div className="space-y-4">
                  {formVehicles.map((v, idx) => (
                    <div
                      key={v.id || idx}
                      className="bg-[#1F2937] p-4 sm:p-5 rounded-xl border-l-4 border-[#00A3FF] space-y-3 relative"
                    >
                      <div className="flex items-center justify-between text-xs text-slate-400 font-bold border-b border-slate-700/60 pb-2">
                        <span>Veículo #{idx + 1}</span>
                        {formVehicles.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveDynamicVehicle(idx)}
                            className="text-rose-400 hover:text-rose-300 flex items-center gap-1 transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Remover
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div>
                          <label className="block text-[#9CA3AF] mb-1 font-semibold">Tipo</label>
                          <select
                            value={v.type}
                            onChange={(e) => handleUpdateDynamicVehicle(idx, 'type', e.target.value as 'carro' | 'moto')}
                            className="w-full p-2.5 bg-[#111827] border border-[#374151] rounded-lg text-white font-bold cursor-pointer"
                          >
                            <option value="carro">🚗 Carro</option>
                            <option value="moto">🏍️ Moto</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[#9CA3AF] mb-1 font-semibold">Marca</label>
                          <input
                            type="text"
                            required
                            placeholder="Ex: Toyota"
                            value={v.brand}
                            onChange={(e) => handleUpdateDynamicVehicle(idx, 'brand', e.target.value)}
                            className="w-full p-2.5 bg-[#111827] border border-[#374151] rounded-lg text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[#9CA3AF] mb-1 font-semibold">Modelo</label>
                          <input
                            type="text"
                            required
                            placeholder="Ex: Corolla"
                            value={v.model}
                            onChange={(e) => handleUpdateDynamicVehicle(idx, 'model', e.target.value)}
                            className="w-full p-2.5 bg-[#111827] border border-[#374151] rounded-lg text-white"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div>
                          <label className="block text-[#9CA3AF] mb-1 font-semibold">Cor</label>
                          <input
                            type="text"
                            required
                            placeholder="Ex: Prata"
                            value={v.color}
                            onChange={(e) => handleUpdateDynamicVehicle(idx, 'color', e.target.value)}
                            className="w-full p-2.5 bg-[#111827] border border-[#374151] rounded-lg text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[#9CA3AF] mb-1 font-semibold">Ano</label>
                          <input
                            type="number"
                            required
                            placeholder="Ex: 2023"
                            value={v.year}
                            onChange={(e) => handleUpdateDynamicVehicle(idx, 'year', e.target.value)}
                            className="w-full p-2.5 bg-[#111827] border border-[#374151] rounded-lg text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[#9CA3AF] mb-1 font-semibold">Placa</label>
                          <input
                            type="text"
                            required
                            placeholder="Ex: ABC1D23"
                            value={v.plate}
                            onChange={(e) => handleUpdateDynamicVehicle(idx, 'plate', e.target.value.toUpperCase())}
                            className="w-full p-2.5 bg-[#111827] border border-[#374151] rounded-lg text-white font-mono uppercase font-bold"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-3">
                  <button
                    type="button"
                    onClick={handleAddDynamicVehicle}
                    className="w-full py-3 px-4 rounded-lg font-bold text-[#00A3FF] border border-[#00A3FF] bg-transparent hover:bg-[#00A3FF]/10 transition flex items-center justify-center gap-2 cursor-pointer text-sm"
                  >
                    <PlusCircle className="w-4 h-4" /> + Novo Veículo (Carro / Moto)
                  </button>
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  className="w-full py-3.5 px-6 rounded-lg font-black text-slate-950 text-base transition-opacity hover:opacity-90 cursor-pointer shadow-lg shadow-cyan-500/20"
                  style={{ background: 'linear-gradient(90deg, #00A3FF, #00FFCC)' }}
                >
                  Enviar Cadastro
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ================= ABA 3: ACOMPANHAR EM TEMPO REAL (CELULAR ⇄ COMPUTADOR) ================= */}
        {portalTab === 'status' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Banner de Sincronização em Tempo Real */}
            <div className="bg-gradient-to-r from-emerald-950/60 via-slate-900 to-blue-950/60 border border-emerald-500/30 rounded-2xl p-5 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                  <Activity className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white">Comunicação Celular ⇄ Computador Ativa</h3>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Os dados deste celular estão conectados em tempo real com o painel operacional da empresa no computador via Firestore.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPortalTab('agendar')}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition shadow-lg shadow-blue-600/25 shrink-0 flex items-center gap-1.5 cursor-pointer"
              >
                <CalendarIcon className="w-4 h-4" /> Novo Agendamento
              </button>
            </div>

            {/* ================= ACOMPANHAMENTO ONLINE: STATUS DO VEÍCULO & LEVA E TRAZ ================= */}
            {(() => {
              // Procura solicitações ativas ou mais recentes de Leva e Traz
              const relevantLeva = tenantLevaETraz.length > 0 
                ? tenantLevaETraz 
                : tenantAppointments
                    .filter(a => a.hasLevaETraz)
                    .map(a => {
                      const req: LevaETrazRequest = {
                        id: a.id,
                        tenantId: tenant.id,
                        type: a.levaETrazType || 'completo',
                        status: (a.levaETrazStatus || (a.status === 'Concluído' ? 'entregue' : a.status === 'Em Lavagem' ? 'no_patio' : 'solicitado')) as LevaETrazStatus,
                        clientName: a.clientName,
                        clientPhone: a.clientPhone || '',
                        vehicle: a.vehicle,
                        plate: a.plate || '',
                        service: a.service,
                        servicePrice: a.price,
                        feePrice: a.levaETrazFee || 25,
                        totalPrice: a.price,
                        address: a.levaETrazAddress || { street: a.addressSummary || '', number: '', neighborhood: '', city: '' },
                        driverName: a.levaETrazDriverName,
                        createdAt: a.createdAt
                      };
                      return req;
                    });

              const activeLeva = relevantLeva.find(r => r.status !== 'cancelado') || relevantLeva[0];

              const getStageNumber = (status: LevaETrazStatus) => {
                switch (status) {
                  case 'solicitado': return 1;
                  case 'motorista_a_caminho': return 2;
                  case 'coletado': return 3;
                  case 'no_patio': return 4;
                  case 'concluido': return 5;
                  case 'em_entrega': return 6;
                  case 'entregue': return 7;
                  case 'cancelado': return -1;
                  default: return 1;
                }
              };

              const stages = [
                { num: 1, title: 'Solicitação Confirmada', desc: 'Pedido registrado no sistema' },
                { num: 2, title: 'Motorista a Caminho da Coleta', desc: 'Indo retirar seu veículo' },
                { num: 3, title: 'Veículo Coletado', desc: 'Em trânsito para o lava-jato' },
                { num: 4, title: 'No Pátio / Em Lavagem', desc: 'Veículo sendo higienizado' },
                { num: 5, title: 'Lavagem Concluída', desc: 'Pronto e inspecionado' },
                { num: 6, title: 'A Caminho da Entrega', desc: 'Motorista retornando ao seu endereço' },
                { num: 7, title: 'Entregue com Sucesso', desc: 'Finalizado no seu portão' },
              ];

              if (!activeLeva) {
                return (
                  <div className="bg-gradient-to-r from-[#0f172a] via-[#111827] to-cyan-950/30 border border-cyan-500/30 rounded-2xl p-5 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                        <Truck className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-white text-sm">Serviço de Leva e Traz Disponível!</h4>
                          <span className="text-[10px] bg-cyan-500/20 text-cyan-300 font-bold px-2 py-0.5 rounded-full border border-cyan-500/30">
                            Praticidade Total
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Não precisa sair de casa ou do trabalho. Nós buscamos seu veículo, lavamos e entregamos limpo!
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setHasLevaETraz(true);
                        setPortalTab('agendar');
                        const el = document.getElementById('agendamento-section');
                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition shadow-lg shadow-cyan-600/25 shrink-0 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Truck className="w-4 h-4" /> Solicitar Leva e Traz Agora
                    </button>
                  </div>
                );
              }

              const currentStageNum = getStageNumber(activeLeva.status);

              return (
                <div className="bg-[#0f172a] border border-cyan-500/40 rounded-2xl p-5 sm:p-6 shadow-2xl space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1e293b] pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                        <Truck className="w-6 h-6 animate-pulse" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-white">Acompanhamento do Leva e Traz em Tempo Real</h3>
                          <span className="inline-flex items-center gap-1 text-[10px] bg-cyan-500/20 text-cyan-300 font-black px-2 py-0.5 rounded-full border border-cyan-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                            AO VIVO
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 mt-0.5 flex flex-wrap items-center gap-x-2">
                          <span className="font-bold text-white">{activeLeva.vehicle}</span>
                          {activeLeva.plate && <span className="font-mono text-cyan-400">({activeLeva.plate})</span>}
                          <span>·</span>
                          <span className="text-slate-400">{activeLeva.service}</span>
                          <span>·</span>
                          <span className="text-cyan-300 font-bold">
                            {activeLeva.type === 'completo' ? 'Leva e Traz Completo' : activeLeva.type === 'buscar' ? 'Apenas Buscar' : 'Apenas Entregar'}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      {activeLeva.clientPhone && (
                        <a
                          href={`https://wa.me/55${activeLeva.clientPhone.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá! Gostaria de uma informação sobre o meu pedido de Leva e Traz do veículo ${activeLeva.vehicle}.`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-emerald-400" /> Contatar Lava-Jato
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Visual Stepper de 7 Estágios */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-300">Etapa Operacional Atual:</span>
                      <span className="font-bold text-cyan-400 bg-cyan-500/10 px-2.5 py-0.5 rounded-full border border-cyan-500/30">
                        {currentStageNum > 0 ? `Etapa ${currentStageNum} de 7` : 'Cancelado'}
                      </span>
                    </div>

                    {/* Desktop/Tablet Horizontal Stepper */}
                    <div className="hidden md:grid grid-cols-7 gap-2 pt-2">
                      {stages.map((stage) => {
                        const isCompleted = currentStageNum > stage.num;
                        const isCurrent = currentStageNum === stage.num;

                        return (
                          <div key={stage.num} className="flex flex-col items-center text-center space-y-1.5">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-xs transition relative ${
                              isCompleted
                                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                                : isCurrent
                                ? 'bg-cyan-500 text-slate-950 ring-4 ring-cyan-500/30 shadow-lg shadow-cyan-500/50 scale-110 font-black'
                                : 'bg-[#020617] text-slate-600 border border-slate-800'
                            }`}>
                              {isCompleted ? <Check className="w-4 h-4 stroke-[3]" /> : stage.num}
                              {isCurrent && (
                                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
                              )}
                            </div>
                            <span className={`text-[11px] font-bold leading-tight ${
                              isCurrent ? 'text-cyan-300' : isCompleted ? 'text-slate-300' : 'text-slate-600'
                            }`}>
                              {stage.title}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Mobile Stepper (Card do Status Atual + Timeline Vertical Compacta) */}
                    <div className="md:hidden space-y-2">
                      {stages.map((stage) => {
                        const isCompleted = currentStageNum > stage.num;
                        const isCurrent = currentStageNum === stage.num;

                        if (!isCurrent && !isCompleted && stage.num > currentStageNum + 1) return null;

                        return (
                          <div
                            key={stage.num}
                            className={`p-2.5 rounded-xl border flex items-center gap-3 transition ${
                              isCurrent
                                ? 'bg-cyan-500/15 border-cyan-500/50 shadow-md ring-1 ring-cyan-500/40'
                                : isCompleted
                                ? 'bg-[#020617]/80 border-emerald-500/20 text-slate-400'
                                : 'bg-[#020617]/40 border-slate-800/60 opacity-60'
                            }`}
                          >
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                              isCompleted
                                ? 'bg-emerald-600 text-white'
                                : isCurrent
                                ? 'bg-cyan-500 text-slate-950 font-black'
                                : 'bg-slate-800 text-slate-500'
                            }`}>
                              {isCompleted ? <Check className="w-3.5 h-3.5" /> : stage.num}
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className={`text-xs font-bold block ${isCurrent ? 'text-cyan-300' : 'text-slate-200'}`}>
                                {stage.title}
                              </span>
                              <span className="text-[10px] text-slate-400 block">{stage.desc}</span>
                            </div>
                            {isCurrent && (
                              <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/20 px-2 py-0.5 rounded-full animate-pulse font-bold">
                                EM ANDAMENTO
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Informações do Motorista & Endereço */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div className="bg-[#020617] border border-[#1e293b] p-3 rounded-xl space-y-1.5">
                      <span className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1.5">
                        <User className="w-3 h-3 text-cyan-400" /> Motorista Designado
                      </span>
                      {activeLeva.driverName ? (
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-xs font-bold text-white block">{activeLeva.driverName}</span>
                            <span className="text-[10px] text-emerald-400 font-semibold">Motorista Autorizado da Empresa</span>
                          </div>
                          {activeLeva.driverPhone && (
                            <a
                              href={`https://wa.me/55${activeLeva.driverPhone.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá ${activeLeva.driverName}, sobre o leva e traz do veículo ${activeLeva.vehicle}:`)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 rounded-lg text-[11px] font-bold transition flex items-center gap-1"
                            >
                              <Phone className="w-3 h-3 text-emerald-400" /> Chamar
                            </a>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400">
                          Aguardando despacho de motorista pela equipe da recepção.
                        </p>
                      )}
                    </div>

                    <div className="bg-[#020617] border border-[#1e293b] p-3 rounded-xl space-y-1.5">
                      <span className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1.5">
                        <MapPin className="w-3 h-3 text-cyan-400" /> Endereço de Atendimento
                      </span>
                      <p className="text-xs text-slate-200 font-medium">
                        {activeLeva.address?.street} {activeLeva.address?.number ? `, nº ${activeLeva.address.number}` : ''}
                        {activeLeva.address?.neighborhood ? ` - ${activeLeva.address.neighborhood}` : ''}
                        {activeLeva.address?.city ? ` (${activeLeva.address.city})` : ''}
                      </p>
                      {activeLeva.notes && (
                        <p className="text-[10px] text-amber-300/90 italic">
                          Obs: {activeLeva.notes}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Meus Agendamentos Recentes */}
            <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-[#1e293b] pb-3">
                <div className="flex items-center gap-2">
                  <CalendarCheck className="w-5 h-5 text-blue-400" />
                  <h3 className="text-base font-bold text-white">Meus Agendamentos no Lava-Jato</h3>
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  {tenantAppointments.filter(a => !a.id?.startsWith('app-init-')).length} registro(s)
                </span>
              </div>

              {tenantAppointments.filter(a => !a.id?.startsWith('app-init-')).length === 0 ? (
                <div className="py-12 text-center text-slate-500 space-y-3">
                  <CalendarIcon className="w-10 h-10 mx-auto opacity-40 text-slate-400" />
                  <p className="text-xs">Nenhum agendamento realizado ainda neste dispositivo.</p>
                  <button
                    type="button"
                    onClick={() => setPortalTab('agendar')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600/20 border border-blue-500/40 text-blue-400 hover:text-white rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    Agendar agora um horário livre
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {tenantAppointments
                    .filter(a => !a.id?.startsWith('app-init-'))
                    .map((app) => {
                      const isPending = app.status === 'Pendente' || !app.status;
                      const isApproved = app.status === 'Aprovado';
                      const isInWash = app.status === 'Em Lavagem' || app.status === 'Em Execução';
                      const isDone = app.status === 'Concluído';
                      const isCancelled = app.status === 'Cancelado' || app.status === 'Recusado';

                      return (
                        <div
                          key={app.id}
                          className="bg-[#020617] border border-[#1e293b] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-slate-700 transition"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-white">{app.service}</span>
                              <span className="text-xs font-bold text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded">
                                R$ {Number(app.price || 0).toFixed(2)}
                              </span>
                            </div>
                            <div className="text-xs text-slate-400 flex flex-wrap items-center gap-x-3 gap-y-1">
                              <span>🚗 {app.vehicle} {app.plate ? `(${app.plate})` : ''}</span>
                              <span>📅 {app.dateTime}</span>
                              <span>👤 {app.clientName}</span>
                            </div>

                            {/* Status de Notificação 24h & Ações de Calendário */}
                            {(() => {
                              const analysis = getAppointmentReminderAnalysis(app);
                              const gcalUrl = buildGoogleCalendarUrl(tenant.nomeFantasia || tenant.name, app);
                              const waText = buildReminderWhatsAppText(tenant.nomeFantasia || tenant.name, app, address);
                              const waUrl = buildReminderWhatsAppUrl(app.clientPhone || clientProfile.phone, waText);

                              return (
                                <div className="pt-2 mt-1 border-t border-[#1e293b]/70 flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5">
                                    <Bell className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${analysis.badgeClass}`}>
                                      {analysis.label}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1.5">
                                    {gcalUrl && (
                                      <a
                                        href={gcalUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[10px] font-semibold text-slate-300 hover:text-white bg-[#0f172a] hover:bg-slate-800 border border-[#1e293b] px-2 py-1 rounded-lg flex items-center gap-1 transition"
                                        title="Adicionar à Google Agenda com lembrete 24h"
                                      >
                                        <ExternalLink className="w-2.5 h-2.5 text-blue-400" /> Google Agenda
                                      </a>
                                    )}

                                    <button
                                      type="button"
                                      onClick={() => {
                                        const ics = generateIcsFileContent(tenant.nomeFantasia || tenant.name, app);
                                        const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
                                        const link = document.createElement('a');
                                        link.href = window.URL.createObjectURL(blob);
                                        link.setAttribute('download', `agendamento-${app.id}.ics`);
                                        document.body.appendChild(link);
                                        link.click();
                                        document.body.removeChild(link);
                                        showToast('📥 Evento de calendário baixado com alarme 24h!');
                                      }}
                                      className="text-[10px] font-semibold text-slate-300 hover:text-white bg-[#0f172a] hover:bg-slate-800 border border-[#1e293b] px-2 py-1 rounded-lg flex items-center gap-1 transition cursor-pointer"
                                      title="Baixar arquivo de calendário com lembrete 24h"
                                    >
                                      <Download className="w-2.5 h-2.5 text-cyan-400" /> Salvar .ICS
                                    </button>

                                    {app.clientPhone && (
                                      <a
                                        href={waUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[10px] font-semibold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 px-2 py-1 rounded-lg flex items-center gap-1 transition"
                                        title="Enviar / Reenviar lembrete via WhatsApp"
                                      >
                                        <MessageSquare className="w-2.5 h-2.5 text-emerald-400" /> Lembrete no WhatsApp
                                      </a>
                                    )}
                                  </div>
                                </div>
                              );
                            })()}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {isPending && (
                              <span className="px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold text-xs flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 animate-spin" /> Aguardando Confirmação
                              </span>
                            )}
                            {isApproved && (
                              <span className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold text-xs flex items-center gap-1.5">
                                <CheckCircle className="w-3.5 h-3.5" /> Aprovado pela Empresa!
                              </span>
                            )}
                            {isInWash && (
                              <span className="px-3 py-1.5 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-300 font-bold text-xs flex items-center gap-1.5">
                                <Droplet className="w-3.5 h-3.5 animate-pulse" /> Em Lavagem no Pátio
                              </span>
                            )}
                            {isDone && (
                              <>
                                <span className="px-3 py-1.5 rounded-xl bg-emerald-600/30 border border-emerald-500/50 text-emerald-200 font-bold text-xs flex items-center gap-1.5">
                                  <Star className="w-3.5 h-3.5 fill-emerald-300" /> Lavagem Concluída!
                                </span>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const updated = tenantAppointments.filter(a => a.id !== app.id);
                                    setTenantAppointments(updated);
                                    localStorage.setItem(`saas_tenant_appointments_${tenant.id}`, JSON.stringify(updated));
                                    await deleteAppointmentFromFirestore(tenant.id, app.id);
                                    showToast('Agendamento finalizado arquivado e limpo com sucesso.');
                                  }}
                                  className="px-2.5 py-1 text-slate-400 hover:text-white bg-slate-800 hover:bg-rose-950/40 border border-slate-700 hover:border-rose-800/40 rounded-lg text-[11px] font-semibold transition cursor-pointer flex items-center gap-1"
                                  title="Dispensar e arquivar este agendamento já finalizado"
                                >
                                  Dispensar
                                </button>
                              </>
                            )}
                            {isCancelled && (
                              <span className="px-3 py-1.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 font-bold text-xs">
                                Cancelado
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Veículos na Operação de Pátio */}
            <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-[#1e293b] pb-3">
                <div className="flex items-center gap-2">
                  <Car className="w-5 h-5 text-cyan-400" />
                  <h3 className="text-base font-bold text-white">Veículos Atualmente no Pátio da Empresa</h3>
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  {patioWashes.length} no pátio agora
                </span>
              </div>

              {patioWashes.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">
                  Nenhum veículo em lavagem no momento no pátio.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {patioWashes.map(w => (
                    <div key={w.id} className="bg-[#020617] border border-[#1e293b] p-3.5 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-white truncate">{w.vehicle}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-cyan-300 font-bold">
                          {w.plate}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400">{w.service}</div>
                      <div className="pt-2 border-t border-[#1e293b] flex items-center justify-between">
                        <span className="text-[10px] text-slate-500">{w.clientName}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          w.status === 'Concluído' ? 'bg-emerald-500/20 text-emerald-400' :
                          w.status === 'Em Execução' ? 'bg-blue-500/20 text-blue-400 animate-pulse' :
                          'bg-amber-500/20 text-amber-400'
                        }`}>
                          {w.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= ABA 1: AGENDAMENTO & SERVIÇOS ================= */}
        {portalTab === 'agendar' && (
        <>
        <div className="relative rounded-2xl overflow-hidden border border-[#1e293b] shadow-2xl bg-[#0f172a]">
          <div className="relative h-64 sm:h-72 w-full overflow-hidden">
            {slides.map((slide, index) => (
              <div
                key={slide.id}
                className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                  index === activeSlide ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
                }`}
              >
                <img
                  src={slide.image}
                  alt={slide.title}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-[#020617] via-[#020617]/80 to-transparent flex items-center p-6 sm:p-10">
                  <div className="max-w-lg space-y-2">
                    <span className="inline-block bg-blue-600/90 text-white text-[11px] font-black uppercase px-2.5 py-1 rounded-md tracking-wider">
                      {slide.tag}
                    </span>
                    <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                      {slide.title}
                    </h2>
                    <p className="text-xs text-slate-300">
                      {slide.subtitle}
                    </p>
                    <div className="pt-2">
                      <button
                        onClick={() => handleSelectPromotion(slide.serviceName, slide.discountPrice || 60)}
                        className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-blue-600/30 transition cursor-pointer"
                      >
                        <span>
                          {typeof slide.discountPrice === 'number' && slide.discountPrice > 0
                            ? `Aproveitar por R$ ${slide.discountPrice.toFixed(2)}`
                            : (slide.badge ? `Aproveitar (${slide.badge})` : 'Aproveitar Oferta')}
                        </span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Indicadores do Carrossel */}
          <div className="absolute bottom-3 right-4 z-20 flex gap-1.5">
            {slides.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setActiveSlide(idx)}
                className={`h-1.5 rounded-full transition-all cursor-pointer ${
                  idx === activeSlide ? 'w-6 bg-blue-500' : 'w-2 bg-slate-600/60'
                }`}
              />
            ))}
          </div>
        </div>

        {/* ================= CARTÃO DE FIDELIDADE ================= */}
        <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-6 shadow-xl relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1e293b] pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Gift className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-[#f8fafc]">Cartão de Fidelidade Digital</h3>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                A cada lavagem concluída pela empresa, você ganha 1 selo. Complete 10 lavagens e ganhe 1 grátis!
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold px-3 py-1.5 rounded-xl">
                {fidelityPoints} de 10 Selos
              </span>

              {fidelityPoints >= 10 && !isRewardRequested && (
                <button
                  onClick={handleRequestFidelityReward}
                  className="bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black text-xs px-4 py-2 rounded-xl shadow-lg shadow-amber-500/30 hover:scale-105 transition cursor-pointer"
                >
                  Resgatar Lavagem Grátis! 🎉
                </button>
              )}

              {isRewardRequested && (
                <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold text-xs px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4" /> Resgate Pendente na Empresa
                </span>
              )}
            </div>
          </div>

          {/* 10 Círculos de Selos */}
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-2.5 mt-5">
            {Array.from({ length: 10 }).map((_, index) => {
              const isFilled = index < fidelityPoints;
              return (
                <div
                  key={index}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${
                    isFilled
                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-400 shadow-sm shadow-amber-500/10'
                      : 'bg-[#020617] border-[#1e293b] text-slate-600'
                  }`}
                >
                  {isFilled ? (
                    <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                  ) : (
                    <Droplet className="w-5 h-5 opacity-40" />
                  )}
                  <span className="text-[10px] font-bold mt-1">
                    {index + 1}º
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ================= DADOS CADASTRAIS & VEÍCULOS ================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Coluna Esquerda: Dados do Cliente & Endereço (lg:col-span-7) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* 1. Dados Pessoais Salvos */}
            <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-[#1e293b] pb-3">
                <h3 className="text-base font-bold text-[#f8fafc] flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" /> Seus Dados de Cadastro
                </h3>
                <button
                  type="button"
                  onClick={() => setIsEditingPersonal(!isEditingPersonal)}
                  className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition cursor-pointer"
                >
                  {isEditingPersonal ? 'Cancelar' : <><Edit3 className="w-3.5 h-3.5" /> Editar Dados Pessoais</>}
                </button>
              </div>

              {!isEditingPersonal ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-[#020617] border border-[#1e293b] p-3.5 rounded-xl space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
                      <span className="flex items-center gap-1"><User className="w-3.5 h-3.5 text-blue-400" /> Nome</span>
                      <span className="text-[10px] text-emerald-400 font-bold">✓ Salvo</span>
                    </div>
                    <p className="text-xs font-bold text-slate-100 truncate">{clientProfile.name}</p>
                  </div>

                  <div className="bg-[#020617] border border-[#1e293b] p-3.5 rounded-xl space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
                      <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5 text-blue-400" /> E-mail</span>
                      <span className="text-[10px] text-emerald-400 font-bold">✓ Salvo</span>
                    </div>
                    <p className="text-xs font-bold text-slate-100 truncate">{clientProfile.email}</p>
                  </div>

                  <div className="bg-[#020617] border border-[#1e293b] p-3.5 rounded-xl space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
                      <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5 text-blue-400" /> WhatsApp</span>
                      <span className="text-[10px] text-emerald-400 font-bold">✓ Salvo</span>
                    </div>
                    <p className="text-xs font-bold text-slate-100 truncate">{clientProfile.phone}</p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSavePersonalProfile} className="bg-[#020617] border border-blue-500/30 p-4 rounded-xl space-y-3 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-slate-300 font-bold mb-1">Nome Completo</label>
                      <input
                        type="text"
                        required
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full bg-[#0f172a] border border-[#1e293b] rounded-lg p-2 text-slate-100 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-bold mb-1">E-mail</label>
                      <input
                        type="email"
                        required
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        className="w-full bg-[#0f172a] border border-[#1e293b] rounded-lg p-2 text-slate-100 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-bold mb-1">WhatsApp / Telefone</label>
                      <input
                        type="text"
                        required
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        className="w-full bg-[#0f172a] border border-[#1e293b] rounded-lg p-2 text-slate-100 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="submit"
                      className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" /> Salvar Alterações
                    </button>
                  </div>
                </form>
              )}

              {/* 1.1 Redefinição de Senha do Cliente (Firebase Auth) */}
              <div className="bg-[#020617] border border-[#1e293b] rounded-xl p-3.5 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <Lock className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-slate-200 text-xs block">Segurança da Senha</span>
                      <span className="text-[11px] text-slate-400">
                        Receba o link oficial do Firebase para redefinir ou alterar sua senha em <strong>{clientProfile.email || clientInfo?.email || 'seu e-mail'}</strong>.
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={isSendingResetEmail}
                    onClick={handleClientRequestResetEmail}
                    className="bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/30 px-3 py-1.5 rounded-lg font-bold flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50 shrink-0 text-xs"
                    title="Enviar e-mail oficial de redefinição de senha"
                  >
                    {isSendingResetEmail ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Enviando link...</span>
                      </>
                    ) : (
                      <>
                        <Mail className="w-3.5 h-3.5" />
                        <span>Redefinir Senha por E-mail</span>
                      </>
                    )}
                  </button>
                </div>
                {resetEmailStatus && (
                  <div className="p-2.5 rounded-lg bg-blue-950/40 border border-blue-500/30 text-blue-300 text-xs flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{resetEmailStatus}</span>
                  </div>
                )}
              </div>

              {/* 2. Dados Principais do Endereço (Preenchimento do Cliente) */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-blue-400" /> Dados do Seu Endereço (Preencha para seu cadastro)
                  </span>
                  <span className="text-[11px] text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    Salvamento Automático
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-6 gap-3 text-xs">
                  <div className="sm:col-span-2">
                    <label className="block text-slate-400 font-bold mb-1 flex items-center justify-between">
                      <span>CEP (Busca Automática)</span>
                      {isSearchingCep && <Loader2 className="w-3 h-3 animate-spin text-cyan-400" />}
                    </label>
                    <input
                      type="text"
                      placeholder="00000-000"
                      maxLength={9}
                      value={cep}
                      onChange={(e) => {
                        setCep(e.target.value);
                        if (e.target.value.replace(/\D/g, '').length === 8) {
                          buscarCEP(e.target.value);
                        }
                      }}
                      onBlur={(e) => buscarCEP(e.target.value)}
                      className="w-full bg-[#020617] border border-[#1e293b] rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>

                  <div className="sm:col-span-4">
                    <label className="block text-slate-400 font-bold mb-1">Rua / Logradouro & Número</label>
                    <input
                      type="text"
                      placeholder="Ex: Av. Paulista, 1000 - Apto 42"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full bg-[#020617] border border-[#1e293b] rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-slate-400 font-bold mb-1">Bairro</label>
                    <input
                      type="text"
                      placeholder="Ex: Centro"
                      value={neighborhood}
                      onChange={(e) => setNeighborhood(e.target.value)}
                      className="w-full bg-[#020617] border border-[#1e293b] rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-slate-400 font-bold mb-1">Cidade</label>
                    <input
                      type="text"
                      placeholder="Ex: São Paulo"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full bg-[#020617] border border-[#1e293b] rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="sm:col-span-1">
                    <label className="block text-slate-400 font-bold mb-1">UF</label>
                    <input
                      type="text"
                      maxLength={2}
                      placeholder="SP"
                      value={stateUf}
                      onChange={(e) => setStateUf(e.target.value.toUpperCase())}
                      className="w-full bg-[#020617] border border-[#1e293b] rounded-lg px-2 py-2 text-slate-100 focus:outline-none focus:border-blue-500 uppercase text-center font-bold"
                    />
                  </div>
                </div>
              </div>

            </div>

            {/* Veículos Cadastrados */}
            <div id="veiculos-section" className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-[#1e293b] pb-3">
                <h3 className="text-base font-bold text-[#f8fafc] flex items-center gap-2">
                  <Car className="w-5 h-5 text-blue-400" /> Seus Veículos ({vehicles.length})
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAddVehicle(!showAddVehicle)}
                  className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 transition cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" /> {showAddVehicle ? 'Fechar' : '+ Adicionar Veículo / Moto'}
                </button>
              </div>

              {/* Form para Adicionar Novo Veículo */}
              {showAddVehicle && (
                <form onSubmit={handleAddVehicle} className="p-4 bg-[#020617] border border-blue-500/30 rounded-xl space-y-3 text-xs">
                  <h4 className="font-bold text-blue-400">Novo Carro ou Moto</h4>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1 font-bold">Tipo</label>
                      <select
                        value={vType}
                        onChange={(e) => setVType(e.target.value as 'carro' | 'moto')}
                        className="w-full bg-[#0f172a] border border-[#1e293b] rounded-lg px-2.5 py-2 text-slate-200 font-bold cursor-pointer"
                      >
                        <option value="carro">🚗 Carro</option>
                        <option value="moto">🏍️ Moto</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1 font-bold">Marca</label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: Toyota"
                        value={vBrand}
                        onChange={(e) => setVBrand(e.target.value)}
                        className="w-full bg-[#0f172a] border border-[#1e293b] rounded-lg px-2.5 py-2 text-slate-100"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1 font-bold">Modelo</label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: Corolla"
                        value={vModel}
                        onChange={(e) => setVModel(e.target.value)}
                        className="w-full bg-[#0f172a] border border-[#1e293b] rounded-lg px-2.5 py-2 text-slate-100"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1 font-bold">Ano</label>
                      <input
                        type="text"
                        placeholder="2024"
                        value={vYear}
                        onChange={(e) => setVYear(e.target.value)}
                        className="w-full bg-[#0f172a] border border-[#1e293b] rounded-lg px-2.5 py-2 text-slate-100"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1 font-bold">Placa</label>
                      <input
                        type="text"
                        required
                        placeholder="ABC-1234"
                        value={vPlate}
                        onChange={(e) => setVPlate(e.target.value)}
                        className="w-full bg-[#0f172a] border border-[#1e293b] rounded-lg px-2.5 py-2 text-slate-100 uppercase font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1 font-bold">Cor</label>
                      <input
                        type="text"
                        placeholder="Prata"
                        value={vColor}
                        onChange={(e) => setVColor(e.target.value)}
                        className="w-full bg-[#0f172a] border border-[#1e293b] rounded-lg px-2.5 py-2 text-slate-100"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-bold text-xs transition cursor-pointer"
                    >
                      Salvar Veículo
                    </button>
                  </div>
                </form>
              )}

              {/* Cards de Veículos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {vehicles.length === 0 ? (
                  <div className="sm:col-span-2 p-6 text-center bg-[#020617] border border-dashed border-[#1e293b] rounded-xl space-y-2">
                    <Car className="w-8 h-8 text-slate-600 mx-auto" />
                    <p className="text-xs font-bold text-slate-300">Nenhum veículo cadastrado ainda.</p>
                    <p className="text-[11px] text-slate-500">Clique em "+ Adicionar Veículo / Moto" acima para registrar seu carro ou moto.</p>
                  </div>
                ) : (
                  vehicles.map((v, idx) => (
                    <div 
                      key={v.id} 
                      onClick={() => setSelectedVehicleId(v.id)}
                      className={`p-4 rounded-xl relative space-y-2 border transition cursor-pointer ${
                        selectedVehicleId === v.id
                          ? 'bg-blue-600/10 border-blue-500 shadow-md shadow-blue-500/10'
                          : 'bg-[#020617] border-[#1e293b] hover:border-slate-700'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] bg-[#0f172a] text-blue-400 px-2.5 py-0.5 rounded border border-[#1e293b] font-bold">
                          {v.type === 'carro' ? '🚗 Carro' : '🏍️ Moto'} · Veículo {idx + 1}
                        </span>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveVehicle(v.id);
                          }}
                          className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer transition"
                          title="Remover veículo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex justify-between items-baseline">
                        <h4 className="font-bold text-slate-100 text-sm">{v.brand} {v.model} ({v.year})</h4>
                        <span className="text-xs font-mono font-bold bg-[#0f172a] px-2 py-0.5 rounded text-emerald-400 border border-[#1e293b]">
                          {v.plate}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-400">Cor: {v.color}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

          {/* Coluna Direita: Agendamento, Calendário e Horários (lg:col-span-5) */}
          <div className="lg:col-span-5">
            <div id="agendamento-section" className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-6 space-y-6 shadow-2xl sticky top-20">
              
              <div className="border-b border-[#1e293b] pb-3">
                <h3 className="text-base font-bold text-[#f8fafc] flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5 text-blue-400" /> Agendar Atendimento Online
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Escolha o veículo, serviço, dia no calendário e horário disponível.
                </p>
              </div>

              <form onSubmit={handleSubmitAppointment} className="space-y-5 text-xs">
                
                {/* Seleção do Veículo */}
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Selecione o Veículo *</label>
                  <select
                    value={selectedVehicleId}
                    onChange={(e) => setSelectedVehicleId(e.target.value)}
                    className="w-full bg-[#020617] border border-[#1e293b] rounded-xl px-3.5 py-2.5 text-slate-100 font-bold focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    {vehicles.length === 0 ? (
                      <option value="">Nenhum veículo cadastrado (Adicione ao lado)</option>
                    ) : (
                      vehicles.map(v => (
                        <option key={v.id} value={v.id}>
                          {v.type === 'carro' ? '🚗' : '🏍️'} {v.brand} {v.model} - {v.color} ({v.plate})
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {/* Seleção do Serviço */}
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Selecione o Serviço Desejado *</label>
                  <select
                    value={selectedService}
                    onChange={(e) => {
                      const svc = servicesList.find(s => s.name === e.target.value);
                      if (svc) {
                        setSelectedService(svc.name);
                        setSelectedPrice(svc.price);
                      }
                    }}
                    className="w-full bg-[#020617] border border-[#1e293b] rounded-xl px-3.5 py-2.5 text-slate-100 font-bold focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    {servicesList.map(s => (
                      <option key={s.name} value={s.name}>
                        {s.name} - R$ {s.price.toFixed(2)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Bloco Interativo: Quilometragem Atual para Troca de Óleo */}
                {selectedService.includes('Troca de Óleo') && (
                  <div className="p-3.5 bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-950 border border-amber-500/40 rounded-xl space-y-2.5 animate-fade-in">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-400 flex items-center gap-1.5 text-xs">
                        <span>🛢️</span> Informações para Troca de Óleo
                      </span>
                      <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-mono font-bold">
                        Cálculo Automático
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-slate-300 font-bold mb-1 text-[11px]">
                          KM Atual do seu Carro (Opcional)
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="Ex: 85.000"
                            value={clientKmInput}
                            onChange={(e) => setClientKmInput(e.target.value)}
                            className="w-full bg-[#020617] border border-amber-500/40 rounded-lg px-3 py-1.5 text-white font-mono font-bold focus:outline-none focus:border-amber-400 text-xs"
                          />
                          <span className="absolute right-2.5 top-1.5 text-slate-500 font-bold text-[11px]">KM</span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-slate-300 font-bold mb-1 text-[11px]">
                          Intervalo Desejado
                        </label>
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => setClientOilInterval(8000)}
                            className={`py-1.5 px-2 rounded-lg font-bold text-[11px] border cursor-pointer transition ${
                              clientOilInterval === 8000
                                ? 'bg-amber-500 text-slate-950 border-amber-400'
                                : 'bg-[#020617] text-slate-300 border-slate-700'
                            }`}
                          >
                            8.000 km
                          </button>
                          <button
                            type="button"
                            onClick={() => setClientOilInterval(10000)}
                            className={`py-1.5 px-2 rounded-lg font-bold text-[11px] border cursor-pointer transition ${
                              clientOilInterval === 10000
                                ? 'bg-amber-500 text-slate-950 border-amber-400'
                                : 'bg-[#020617] text-slate-300 border-slate-700'
                            }`}
                          >
                            10.000 km
                          </button>
                        </div>
                      </div>
                    </div>

                    {clientKmInput.trim() && !isNaN(parseInt(clientKmInput.replace(/\D/g, ''), 10)) && (
                      <div className="bg-[#020617] p-2 rounded-lg border border-amber-500/20 flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">Próxima troca estimada:</span>
                        <span className="font-mono font-black text-amber-300">
                          {(parseInt(clientKmInput.replace(/\D/g, ''), 10) + clientOilInterval).toLocaleString('pt-BR')} KM
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* ================= 1. SELETOR DE DATA CUSTOMIZÁVEL & CALENDÁRIO ================= */}
                <div className="bg-[#020617] border border-[#1e293b] rounded-xl p-4 space-y-3.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1e293b] pb-3">
                    <div>
                      <label className="text-slate-200 font-bold text-xs flex items-center gap-1.5">
                        <CalendarIcon className="w-4 h-4 text-blue-400" />
                        Escolha a Data do Atendimento *
                      </label>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Selecione qualquer data futura desejada ou clique nos atalhos rápidos:
                      </p>
                    </div>

                    {/* Input de Data Customizável (Permite escolher qualquer dia futuro) */}
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-400 font-medium">Data:</span>
                      <input
                        type="date"
                        min={todayStr}
                        value={selectedDate}
                        onChange={(e) => handleDateChange(e.target.value)}
                        className="bg-[#0f172a] border border-blue-500/50 rounded-xl px-3 py-1.5 text-xs text-white font-bold font-mono focus:outline-none focus:border-blue-400 cursor-pointer shadow-sm shadow-blue-500/20"
                        title="Clique para abrir o calendário e escolher uma data futura"
                      />
                    </div>
                  </div>

                  {/* Atalhos Rápidos para Datas Futuras */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Atalhos rápidos para agendar:</span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleDateChange(todayStr)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition border cursor-pointer ${
                          selectedDate === todayStr
                            ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                            : 'bg-[#0f172a] text-slate-300 border-slate-700 hover:border-slate-500'
                        }`}
                      >
                        Hoje
                      </button>
                      <button
                        type="button"
                        onClick={() => setQuickDate(1)}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-bold transition border bg-[#0f172a] text-slate-300 border-slate-700 hover:border-blue-500 hover:text-blue-300 cursor-pointer"
                      >
                        Amanhã (+1d)
                      </button>
                      <button
                        type="button"
                        onClick={() => setQuickDate(2)}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-bold transition border bg-[#0f172a] text-slate-300 border-slate-700 hover:border-blue-500 hover:text-blue-300 cursor-pointer"
                      >
                        Depois de Amanhã (+2d)
                      </button>
                      <button
                        type="button"
                        onClick={() => setQuickDate(0, 6)}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-bold transition border bg-[#0f172a] text-amber-300 border-amber-500/30 hover:bg-amber-500/10 cursor-pointer"
                      >
                        Próximo Sábado
                      </button>
                      <button
                        type="button"
                        onClick={() => setQuickDate(7)}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-bold transition border bg-[#0f172a] text-slate-300 border-slate-700 hover:border-blue-500 hover:text-blue-300 cursor-pointer"
                      >
                        +1 Semana (+7d)
                      </button>
                    </div>
                  </div>

                  {/* Feedback da Data Selecionada em Destaque */}
                  <div className="p-2.5 bg-blue-950/25 border border-blue-500/30 rounded-xl flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-medium flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      Data Escolhida:
                    </span>
                    <span className="font-bold text-blue-300 font-mono text-right">
                      {selectedDateHuman}
                    </span>
                  </div>

                  {/* Calendário Visual Interativo do Mês */}
                  <div className="pt-2 border-t border-[#1e293b]/70 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                        <CalendarIcon className="w-3.5 h-3.5 text-blue-400" />
                        {MONTH_NAMES[currentCalendarDate.getMonth()]} {currentCalendarDate.getFullYear()}
                      </span>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={handlePrevMonth}
                          className="p-1 rounded-lg bg-[#0f172a] hover:bg-slate-800 text-slate-300 border border-[#1e293b] cursor-pointer"
                          title="Mês Anterior"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCurrentCalendarDate(new Date());
                            setSelectedDate(todayStr);
                          }}
                          className="px-2 py-1 text-[10px] font-bold rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30 cursor-pointer"
                        >
                          Hoje
                        </button>
                        <button
                          type="button"
                          onClick={handleNextMonth}
                          className="p-1 rounded-lg bg-[#0f172a] hover:bg-slate-800 text-slate-300 border border-[#1e293b] cursor-pointer"
                          title="Próximo Mês"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Dias da Semana */}
                    <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-500 uppercase">
                      {WEEK_DAYS.map(w => (
                        <div key={w} className="py-0.5">{w}</div>
                      ))}
                    </div>

                    {/* Grade de Dias */}
                    <div className="grid grid-cols-7 gap-1 text-xs">
                      {calendarDays.map((item, idx) => {
                        if (!item.isCurrentMonth) {
                          return (
                            <div key={idx} className="h-8 flex items-center justify-center text-slate-700 text-[11px]">
                              {item.dayNumber}
                            </div>
                          );
                        }

                        const isSelected = item.isSelected;
                        const isPast = item.isPast;
                        const isToday = item.isToday;

                        if (isPast) {
                          return (
                            <div
                              key={idx}
                              className="h-8 flex items-center justify-center text-slate-600 text-[11px] rounded-lg cursor-not-allowed bg-slate-900/30 line-through"
                              title="Data já ultrapassada"
                            >
                              {item.dayNumber}
                            </div>
                          );
                        }

                        if (isSelected) {
                          return (
                            <button
                              key={idx}
                              type="button"
                              className="h-8 flex items-center justify-center font-bold text-xs rounded-lg bg-blue-600 text-white shadow-lg shadow-blue-600/40 scale-105 transition cursor-pointer"
                            >
                              {item.dayNumber}
                            </button>
                          );
                        }

                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleSelectDay(item.dateStr, item.isPast)}
                            className={`h-8 flex items-center justify-center font-medium text-xs rounded-lg transition hover:bg-blue-500/20 hover:text-blue-300 cursor-pointer ${
                              isToday ? 'border border-blue-500/50 text-blue-400 font-bold bg-blue-500/10' : 'text-slate-300 bg-[#0f172a]/60'
                            }`}
                          >
                            {item.dayNumber}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* ================= 2. SELETOR DE HORÁRIO CUSTOMIZÁVEL & SLOTS COM TRAVA ================= */}
                <div className="bg-[#020617] border border-[#1e293b] rounded-xl p-4 space-y-3.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1e293b] pb-2.5">
                    <div>
                      <label className="text-slate-200 font-bold flex items-center gap-1.5 text-xs">
                        <Clock className="w-4 h-4 text-blue-400" />
                        Horário do Agendamento *
                      </label>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Escolha um intervalo pré-definido ou digite o horário desejado:
                      </p>
                    </div>

                    {/* Input de Horário Customizável */}
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-400 font-medium">Customizar:</span>
                      <input
                        type="time"
                        value={selectedTimeSlot}
                        onChange={(e) => {
                          if (e.target.value) setSelectedTimeSlot(e.target.value);
                        }}
                        className="bg-[#0f172a] border border-blue-500/50 rounded-xl px-3 py-1.5 text-xs text-white font-mono font-bold focus:outline-none focus:border-blue-400 cursor-pointer shadow-sm shadow-blue-500/20"
                        title="Digite ou selecione qualquer horário desejado"
                      />
                    </div>
                  </div>

                  {/* Alerta de Status do Horário Escolhido */}
                  {lockedSlotsSet.has(selectedTimeSlot) ? (
                    <div className="p-2.5 bg-rose-950/30 border border-rose-500/40 rounded-xl text-rose-300 text-xs flex items-center gap-2 animate-pulse">
                      <Lock className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>
                        O horário <strong>{selectedTimeSlot}</strong> já está reservado no dia selecionado. Por favor, escolha outro horário.
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-[11px] text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
                      <span className="flex items-center gap-1.5 font-bold">
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        Horário {selectedTimeSlot} disponível para agendamento!
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {lockedSlotsSet.size === 0 ? 'Todos horários livres' : `${lockedSlotsSet.size} horário(s) ocupado(s)`}
                      </span>
                    </div>
                  )}

                  {/* 1. MANHÃ (07:00 até 11:30) */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold uppercase text-amber-400 flex items-center gap-1">
                      <Sunrise className="w-3.5 h-3.5" /> Manhã (07:00 às 11:30)
                    </span>
                    <div className="grid grid-cols-5 gap-1.5">
                      {MORNING_SLOTS.map((slotTime) => {
                        const isLocked = lockedSlotsSet.has(slotTime);
                        const isSelected = selectedTimeSlot === slotTime && !isLocked;

                        if (isLocked) {
                          return (
                            <button
                              key={slotTime}
                              type="button"
                              disabled
                              className="py-2 rounded-lg border border-rose-500/20 bg-rose-500/5 text-rose-400/50 text-[11px] font-bold line-through cursor-not-allowed text-center flex items-center justify-center gap-0.5"
                              title="Horário ocupado / bloqueado pela empresa"
                            >
                              <Lock className="w-2.5 h-2.5" /> {slotTime}
                            </button>
                          );
                        }

                        if (isSelected) {
                          return (
                            <button
                              key={slotTime}
                              type="button"
                              className="py-2 rounded-lg border-2 border-blue-500 bg-blue-600/30 text-white font-bold text-[11px] shadow-sm shadow-blue-500/30 flex items-center justify-center gap-0.5"
                            >
                              <Check className="w-3 h-3" /> {slotTime}
                            </button>
                          );
                        }

                        return (
                          <button
                            key={slotTime}
                            type="button"
                            onClick={() => setSelectedTimeSlot(slotTime)}
                            className="py-2 rounded-lg border border-[#1e293b] bg-[#020617] hover:border-blue-500 hover:text-blue-400 text-slate-300 text-[11px] font-bold transition text-center cursor-pointer"
                          >
                            {slotTime}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2. TARDE (13:00 até 17:30) */}
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[10px] font-bold uppercase text-orange-400 flex items-center gap-1">
                      <Sun className="w-3.5 h-3.5" /> Tarde (13:00 às 17:30)
                    </span>
                    <div className="grid grid-cols-5 gap-1.5">
                      {AFTERNOON_SLOTS.map((slotTime) => {
                        const isLocked = lockedSlotsSet.has(slotTime);
                        const isSelected = selectedTimeSlot === slotTime && !isLocked;

                        if (isLocked) {
                          return (
                            <button
                              key={slotTime}
                              type="button"
                              disabled
                              className="py-2 rounded-lg border border-rose-500/20 bg-rose-500/5 text-rose-400/50 text-[11px] font-bold line-through cursor-not-allowed text-center flex items-center justify-center gap-0.5"
                              title="Horário ocupado / bloqueado pela empresa"
                            >
                              <Lock className="w-2.5 h-2.5" /> {slotTime}
                            </button>
                          );
                        }

                        if (isSelected) {
                          return (
                            <button
                              key={slotTime}
                              type="button"
                              className="py-2 rounded-lg border-2 border-blue-500 bg-blue-600/30 text-white font-bold text-[11px] shadow-sm shadow-blue-500/30 flex items-center justify-center gap-0.5"
                            >
                              <Check className="w-3 h-3" /> {slotTime}
                            </button>
                          );
                        }

                        return (
                          <button
                            key={slotTime}
                            type="button"
                            onClick={() => setSelectedTimeSlot(slotTime)}
                            className="py-2 rounded-lg border border-[#1e293b] bg-[#020617] hover:border-blue-500 hover:text-blue-400 text-slate-300 text-[11px] font-bold transition text-center cursor-pointer"
                          >
                            {slotTime}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Legenda dos Horários */}
                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-[#1e293b]">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-[#020617] border border-[#1e293b]" /> Livre
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-blue-500" /> Selecionado
                    </span>
                    <span className="flex items-center gap-1 text-rose-400">
                      <Lock className="w-2.5 h-2.5" /> Ocupado
                    </span>
                  </div>
                </div>

                {/* ================= 3. NOTIFICAÇÃO & LEMBRETE 24H ANTES DO SERVIÇO ================= */}
                <div className="bg-[#020617] border border-blue-500/30 rounded-xl p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-blue-500/10 border border-blue-500/30 rounded-lg text-blue-400">
                        <Bell className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                          Lembrete Automático 24h Antes
                          <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded border border-blue-500/30 font-semibold">Gratuito</span>
                        </h4>
                        <p className="text-[11px] text-slate-400">
                          Receba um alerta 24 horas antes do seu horário para não esquecer.
                        </p>
                      </div>
                    </div>
                    
                    <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                      <input
                        type="checkbox"
                        checked={reminder24hEnabled}
                        onChange={(e) => setReminder24hEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  {reminder24hEnabled && (
                    <div className="space-y-2.5 pt-2 border-t border-[#1e293b]">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400 font-medium">Canal de Notificação:</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setReminderChannel('whatsapp')}
                            className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 ${
                              reminderChannel === 'whatsapp'
                                ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400'
                                : 'bg-[#0f172a] border-[#1e293b] text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            <Phone className="w-3 h-3" /> WhatsApp
                          </button>
                          <button
                            type="button"
                            onClick={() => setReminderChannel('email')}
                            className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 ${
                              reminderChannel === 'email'
                                ? 'bg-cyan-600/20 border-cyan-500 text-cyan-400'
                                : 'bg-[#0f172a] border-[#1e293b] text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            <Mail className="w-3 h-3" /> E-mail
                          </button>
                          <button
                            type="button"
                            onClick={() => setReminderChannel('ambos')}
                            className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 ${
                              reminderChannel === 'ambos'
                                ? 'bg-blue-600/20 border-blue-500 text-blue-400'
                                : 'bg-[#0f172a] border-[#1e293b] text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            Ambos
                          </button>
                        </div>
                      </div>

                      {calculatedReminderSchedule && (
                        <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-lg text-[11px] text-blue-300 flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                          <span>
                            {calculatedReminderSchedule.isWithin24Hours ? (
                              <>Seu serviço é nas próximas 24 horas. O lembrete de atendimento já está programado para envio!</>
                            ) : (
                              <>Lembrete programado para <strong>{calculatedReminderSchedule.formatted}</strong> (exatamente 24 horas antes do serviço).</>
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* ================= 4. SERVIÇO DE LEVA E TRAZ (VALET & DELIVERY) ================= */}
                <div className={`border rounded-xl p-4 space-y-3 transition ${
                  hasLevaETraz 
                    ? 'bg-gradient-to-br from-cyan-950/40 via-slate-900 to-blue-950/40 border-cyan-500/50 shadow-lg shadow-cyan-950/50' 
                    : 'bg-[#020617] border-[#1e293b]'
                }`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`p-2 rounded-lg border transition ${
                        hasLevaETraz 
                          ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400' 
                          : 'bg-slate-800 border-slate-700 text-slate-400'
                      }`}>
                        <Truck className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                          Serviço de Leva e Traz
                          <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded border border-cyan-500/30 font-semibold">
                            Buscamos seu Carro
                          </span>
                        </h4>
                        <p className="text-[11px] text-slate-400">
                          Buscamos e/ou entregamos o veículo no seu endereço. Acompanhe em tempo real pelo app!
                        </p>
                      </div>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                      <input
                        type="checkbox"
                        checked={hasLevaETraz}
                        onChange={(e) => setHasLevaETraz(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500"></div>
                    </label>
                  </div>

                  {hasLevaETraz && (
                    <div className="space-y-3.5 pt-3 border-t border-cyan-500/20 animate-fadeIn">
                      {/* Escolha da Modalidade */}
                      <div>
                        <label className="block text-slate-300 font-bold mb-1.5 text-[11px]">
                          Modalidade do Leva e Traz:
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <button
                            type="button"
                            onClick={() => setLevaETrazType('completo')}
                            className={`p-2.5 rounded-xl border text-left cursor-pointer transition ${
                              levaETrazType === 'completo'
                                ? 'bg-cyan-600/30 border-cyan-400 text-white ring-1 ring-cyan-400/50'
                                : 'bg-[#020617] border-[#1e293b] text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            <div className="flex items-center justify-between text-xs font-bold">
                              <span>Completo</span>
                              <span className="text-cyan-400">+ R$ 25</span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-0.5">Buscar & Devolver no local</p>
                          </button>

                          <button
                            type="button"
                            onClick={() => setLevaETrazType('buscar')}
                            className={`p-2.5 rounded-xl border text-left cursor-pointer transition ${
                              levaETrazType === 'buscar'
                                ? 'bg-cyan-600/30 border-cyan-400 text-white ring-1 ring-cyan-400/50'
                                : 'bg-[#020617] border-[#1e293b] text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            <div className="flex items-center justify-between text-xs font-bold">
                              <span>Apenas Buscar</span>
                              <span className="text-cyan-400">+ R$ 15</span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-0.5">Retirada na sua casa/empresa</p>
                          </button>

                          <button
                            type="button"
                            onClick={() => setLevaETrazType('entregar')}
                            className={`p-2.5 rounded-xl border text-left cursor-pointer transition ${
                              levaETrazType === 'entregar'
                                ? 'bg-cyan-600/30 border-cyan-400 text-white ring-1 ring-cyan-400/50'
                                : 'bg-[#020617] border-[#1e293b] text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            <div className="flex items-center justify-between text-xs font-bold">
                              <span>Apenas Entregar</span>
                              <span className="text-cyan-400">+ R$ 15</span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-0.5">Entrega após término do serviço</p>
                          </button>
                        </div>
                      </div>

                      {/* Endereço de Coleta / Entrega */}
                      <div className="bg-[#020617] border border-[#1e293b] p-3 rounded-xl space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-200 flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-cyan-400" /> Endereço de Coleta / Entrega:
                          </span>
                          <span className="text-[10px] text-cyan-400 font-mono">Busca por CEP disponível</span>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <div className="col-span-1">
                            <label className="block text-slate-400 text-[10px] mb-0.5 font-bold">CEP</label>
                            <div className="relative">
                              <input
                                type="text"
                                placeholder="00000-000"
                                value={levaETrazCep}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setLevaETrazCep(val);
                                  if (val.replace(/\D/g, '').length === 8) {
                                    buscarCEP(val);
                                  }
                                }}
                                className="w-full bg-[#0f172a] border border-[#1e293b] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                              />
                              {isSearchingCep && (
                                <Loader2 className="w-3 h-3 text-cyan-400 animate-spin absolute right-2 top-2" />
                              )}
                            </div>
                          </div>

                          <div className="col-span-2">
                            <label className="block text-slate-400 text-[10px] mb-0.5 font-bold">Rua / Avenida *</label>
                            <input
                              type="text"
                              required={hasLevaETraz}
                              placeholder="Ex: Rua das Flores"
                              value={levaETrazStreet}
                              onChange={(e) => setLevaETrazStreet(e.target.value)}
                              className="w-full bg-[#0f172a] border border-[#1e293b] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-slate-400 text-[10px] mb-0.5 font-bold">Número *</label>
                            <input
                              type="text"
                              required={hasLevaETraz}
                              placeholder="123"
                              value={levaETrazNumber}
                              onChange={(e) => setLevaETrazNumber(e.target.value)}
                              className="w-full bg-[#0f172a] border border-[#1e293b] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                            />
                          </div>

                          <div>
                            <label className="block text-slate-400 text-[10px] mb-0.5 font-bold">Bairro</label>
                            <input
                              type="text"
                              placeholder="Centro"
                              value={levaETrazNeighborhood}
                              onChange={(e) => setLevaETrazNeighborhood(e.target.value)}
                              className="w-full bg-[#0f172a] border border-[#1e293b] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                            />
                          </div>

                          <div>
                            <label className="block text-slate-400 text-[10px] mb-0.5 font-bold">Cidade</label>
                            <input
                              type="text"
                              placeholder="Cidade"
                              value={levaETrazCity}
                              onChange={(e) => setLevaETrazCity(e.target.value)}
                              className="w-full bg-[#0f172a] border border-[#1e293b] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-slate-400 text-[10px] mb-0.5 font-bold">Complemento (Apto, Bloco)</label>
                            <input
                              type="text"
                              placeholder="Ex: Apto 42 Bloco B"
                              value={levaETrazComplement}
                              onChange={(e) => setLevaETrazComplement(e.target.value)}
                              className="w-full bg-[#0f172a] border border-[#1e293b] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                            />
                          </div>

                          <div>
                            <label className="block text-slate-400 text-[10px] mb-0.5 font-bold">Ponto de Referência</label>
                            <input
                              type="text"
                              placeholder="Ex: Próximo à padaria"
                              value={levaETrazReference}
                              onChange={(e) => setLevaETrazReference(e.target.value)}
                              className="w-full bg-[#0f172a] border border-[#1e293b] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-slate-400 text-[10px] mb-0.5 font-bold">
                            Instruções / Recado para o Motorista
                          </label>
                          <input
                            type="text"
                            placeholder="Ex: Tocar interfone 42 ou deixar chave na portaria com Seu Carlos"
                            value={levaETrazDriverNotes}
                            onChange={(e) => setLevaETrazDriverNotes(e.target.value)}
                            className="w-full bg-[#0f172a] border border-[#1e293b] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Resumo & Botão Finalizar */}
                <div className="pt-4 border-t border-[#1e293b] space-y-4">
                  <div className="flex justify-between items-baseline">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold">TOTAL DO PEDIDO</span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-xl font-black text-emerald-400">
                          R$ {totalBookingPrice.toFixed(2)}
                        </span>
                        {hasLevaETraz && (
                          <span className="text-[10px] text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20 font-mono font-bold">
                            Serviço R$ {selectedPrice.toFixed(0)} + Leva/Traz R$ {levaETrazFee.toFixed(0)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right text-[11px] text-slate-400">
                      <span className="block font-bold text-slate-200">{selectedService}</span>
                      <span>{selectedTimeSlot} em {selectedDate.split('-').reverse().join('/')}</span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 px-6 rounded-xl transition shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 text-xs cursor-pointer"
                  >
                    <CheckCircle className="w-4 h-4" /> 
                    {hasLevaETraz ? 'Confirmar Agendamento com Leva e Traz' : 'Confirmar e Enviar Agendamento'}
                  </button>

                  <p className="text-[10px] text-center text-slate-500">
                    🔒 Seu pedido é sincronizado instantaneamente com o painel do lava-jato via nuvem e você acompanha as etapas ao vivo.
                  </p>
                </div>

              </form>

            </div>
          </div>

        </div>
        </>
        )}

      </div>

    </div>
  );
};
