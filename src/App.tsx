import React, { useState, useEffect, useRef } from 'react';
import { LogOut } from 'lucide-react';
import { 
  INITIAL_TENANTS, 
  INITIAL_PLANS, 
  INITIAL_SUPER_ADMINS, 
  INITIAL_LOGS, 
  INITIAL_INVOICES, 
  INITIAL_SECURITY_SETTINGS 
} from './data/mockData';
import { Tenant, Plan, SuperAdminUser, SystemLog, Invoice, SecuritySetting } from './types';

import { Sidebar, NavTab } from './components/Sidebar';
import { Header } from './components/Header';
import { OverviewSection } from './components/OverviewSection';
import { TenantsSection } from './components/TenantsSection';
import { PlansSection } from './components/PlansSection';
import { LogsSection } from './components/LogsSection';
import { AdminSettingsSection } from './components/AdminSettingsSection';

import { NewTenantModal } from './components/NewTenantModal';
import { EditTenantModal } from './components/EditTenantModal';
import { ImpersonationOverlay } from './components/ImpersonationOverlay';
import { AiAssistantModal } from './components/AiAssistantModal';
import { LoginModal } from './components/LoginModal';
import { ClientPortal } from './components/ClientPortal';
import { TenantWorkspace } from './components/TenantWorkspace';
import { TotemMode } from './components/TotemMode';
import { OfflineIndicator } from './components/OfflineIndicator';
import { SplashScreen } from './components/SplashScreen';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from './lib/firebase';
import { 
  saveTenantToFirestore, 
  deleteTenantFromFirestore, 
  deleteDemoTenantsFromFirestore,
  subscribeToTenantsFirestore,
  saveCompanyEmailMapping,
  saveAppointmentToFirestore,
  getTenantByIdOrSlugFirestore,
  findTenantByCompanyEmailFirestore,
  findTenantIdByClientEmailFirestore
} from './lib/firebaseService';

export type AuthSession = 
  | { role: 'admin'; userEmail: string; userName?: string; uid?: string }
  | { role: 'empresa'; tenant: Tenant; userEmail: string; userName?: string; uid?: string }
  | { role: 'cliente'; tenant: Tenant; clientInfo: { name: string; phone: string; email?: string }; userEmail: string; userName?: string; uid?: string }
  | { role: 'totem'; tenant: Tenant; exitPin?: string; userEmail?: string }
  | null;

export interface AuthBroadcastMessage {
  type: 'TAB_AUTH_LOGIN' | 'TAB_AUTH_LOGOUT' | 'TAB_PING' | 'TAB_HEARTBEAT';
  senderTabId: string;
  role?: 'admin' | 'empresa' | 'cliente' | 'totem';
  userEmail?: string;
  tenantId?: string;
  timestamp: number;
}

// 🏷️ Identificador Único desta Aba do Navegador (armazenado em sessionStorage para isolamento total)
const CURRENT_TAB_ID = (() => {
  if (typeof window === 'undefined') return 'server_tab';
  let id = sessionStorage.getItem('saas_browser_tab_id');
  if (!id) {
    id = `tab_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;
    sessionStorage.setItem('saas_browser_tab_id', id);
  }
  return id;
})();

// 🌐 Helper para identificar se a URL atual foi aberta com link específico de um lava-jato ou totem
export const isCarWashOrClientUrl = () => {
  if (typeof window === 'undefined') return false;
  const p = new URLSearchParams(window.location.search);
  return Boolean(
    p.get('empresa') || 
    p.get('slug') || 
    p.get('lava') || 
    p.get('cadastro') || 
    p.get('totem') === 'true' || 
    p.get('mode') === 'totem' || 
    p.get('t') || 
    p.get('tenantId')
  );
};

export default function App() {
  // Persistence with localStorage (Filtra permanentemente empresas deletadas e demo)
  const [tenants, setTenants] = useState<Tenant[]>(() => {
    const rawDeleted = typeof window !== 'undefined' ? localStorage.getItem('saas_deleted_tenant_ids') : null;
    const deletedList: string[] = rawDeleted ? JSON.parse(rawDeleted) : [];

    const saved = localStorage.getItem('saas_master_tenants');
    if (saved) {
      try {
        const parsed: Tenant[] = JSON.parse(saved);
        const cleaned = parsed.filter(t => !t.id.startsWith('t-10') && t.id !== 't-autoclean' && !deletedList.includes(t.id));
        if (cleaned.length !== parsed.length) {
          localStorage.setItem('saas_master_tenants', JSON.stringify(cleaned));
        }
        return cleaned;
      } catch {
        return [];
      }
    }
    return [];
  });

  const [plans, setPlans] = useState<Plan[]>(() => {
    const saved = localStorage.getItem('saas_master_plans');
    if (saved) {
      try {
        const parsed: Plan[] = JSON.parse(saved);
        const hasVitalicio = parsed.some(p => p.id === 'plan-vitalicio' || p.name === 'Vitalicio');
        if (!hasVitalicio) {
          const vitalicio = INITIAL_PLANS.find(p => p.id === 'plan-vitalicio');
          if (vitalicio) {
            const updated = [...parsed, vitalicio];
            localStorage.setItem('saas_master_plans', JSON.stringify(updated));
            return updated;
          }
        }
        return parsed;
      } catch (e) {
        console.error('Erro ao ler saas_master_plans:', e);
      }
    }
    return INITIAL_PLANS;
  });

  const [superAdmins, setSuperAdmins] = useState<SuperAdminUser[]>(() => {
    const saved = localStorage.getItem('saas_master_admins');
    return saved ? JSON.parse(saved) : INITIAL_SUPER_ADMINS;
  });

  const [logs, setLogs] = useState<SystemLog[]>(() => {
    const saved = localStorage.getItem('saas_master_logs');
    return saved ? JSON.parse(saved) : [];
  });

  const [invoices, setInvoices] = useState<Invoice[]>(() => {
    const saved = localStorage.getItem('saas_master_invoices');
    return saved ? JSON.parse(saved) : [];
  });

  const [securitySettings, setSecuritySettings] = useState<SecuritySetting[]>(() => {
    const saved = localStorage.getItem('saas_master_security');
    return saved ? JSON.parse(saved) : INITIAL_SECURITY_SETTINGS;
  });

  // Navigation & Search State
  const [currentTab, setCurrentTab] = useState<NavTab>('overview');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Splash Screen 5-second initial state (pula splash se o cliente estiver acessando via link/QR Code de um lava-jato)
  const [showSplash, setShowSplash] = useState(() => {
    if (typeof window === 'undefined') return true;
    const params = new URLSearchParams(window.location.search);
    if (params.get('empresa') || params.get('slug') || params.get('cadastro') || params.get('t') || params.get('totem') === 'true' || params.get('mode') === 'totem') {
      return false;
    }
    const path = window.location.pathname.replace(/^\//, '').split('/')[0];
    if (path && path !== 'index.html' && path !== '') {
      return false;
    }
    return true;
  });

  // Auth Session State: Inicializado a partir de sessionStorage com proteção de links direcionados
  const [authSession, setAuthSession] = useState<AuthSession | null>(() => {
    if (typeof window === 'undefined') return null;
    const isTargetedLink = isCarWashOrClientUrl();
    if (isTargetedLink) {
      const params = new URLSearchParams(window.location.search);
      const isTotem = params.get('totem') === 'true' || params.get('mode') === 'totem';
      if (isTotem) {
        try {
          const rawTenants = localStorage.getItem('saas_master_tenants');
          const localList: Tenant[] = rawTenants ? JSON.parse(rawTenants) : [];
          const targetKey = params.get('empresa') || params.get('slug') || params.get('tenantId') || params.get('t');
          if (localList.length > 0) {
            const cleanTarget = (targetKey || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            const match = localList.find(t => 
              t.id.toLowerCase() === cleanTarget || 
              (t.slug && t.slug.toLowerCase() === cleanTarget) ||
              (t.nomeFantasia && t.nomeFantasia.toLowerCase().replace(/[^a-z0-9]/g, '').includes(cleanTarget)) ||
              (t.name && t.name.toLowerCase().replace(/[^a-z0-9]/g, '').includes(cleanTarget))
            ) || localList.filter(t => t.id !== 't-autoclean')[0] || localList[0];
            if (match) {
              return { role: 'totem', tenant: match };
            }
          }
        } catch {}
      }
      // Se for link de cadastro ou lava-jato específico, NUNCA restaura sessão de super admin!
      return null;
    }
    try {
      const saved = sessionStorage.getItem('saas_active_auth_session');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Referência do canal de comunicação entre abas
  const authChannelRef = useRef<BroadcastChannel | null>(null);

  // 📡 Transmite eventos de autenticação via BroadcastChannel para outras abas
  const broadcastAuthEvent = (data: Omit<AuthBroadcastMessage, 'senderTabId' | 'timestamp'>) => {
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        if (!authChannelRef.current) {
          authChannelRef.current = new BroadcastChannel('washauto_auth_channel');
        }
        authChannelRef.current.postMessage({
          ...data,
          senderTabId: CURRENT_TAB_ID,
          timestamp: Date.now()
        } as AuthBroadcastMessage);
      }
    } catch (e) {
      console.warn('[BroadcastChannel] Erro ao transmitir mensagem:', e);
    }
  };

  // Mantém a sessão sincronizada em sessionStorage para evitar qualquer logout acidental
  useEffect(() => {
    if (authSession) {
      sessionStorage.setItem('saas_active_auth_session', JSON.stringify(authSession));
      broadcastAuthEvent({
        type: 'TAB_AUTH_LOGIN',
        role: authSession.role,
        userEmail: authSession.userEmail,
        tenantId: authSession.role !== 'admin' ? authSession.tenant?.id : undefined
      });
    } else {
      sessionStorage.removeItem('saas_active_auth_session');
    }
  }, [authSession]);

  // 📡 Configuração da API BroadcastChannel para coordenação e isolamento estrito entre abas
  useEffect(() => {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;

    const channel = new BroadcastChannel('washauto_auth_channel');
    authChannelRef.current = channel;

    channel.onmessage = (event: MessageEvent<AuthBroadcastMessage>) => {
      const data = event.data;
      if (!data || data.senderTabId === CURRENT_TAB_ID) {
        // Ignora eventos gerados pela própria aba
        return;
      }

      console.log(`[BroadcastChannel] Mensagem recebida de outra aba (${data.senderTabId}):`, data.type, data.role || '');

      switch (data.type) {
        case 'TAB_AUTH_LOGIN':
          // 🛡️ ISOLAMENTO TOTAL: Outra aba acabou de fazer login (ex: Super Admin em uma aba e Dono do Lava-Jato em outra).
          // Esta aba preserva integralmente sua própria sessão em sessionStorage e NUNCA é deslogada!
          console.log(`[BroadcastChannel] Sessão remota iniciada como ${data.role} (${data.userEmail}). Mantendo a sessão desta aba isolada.`);
          break;

        case 'TAB_AUTH_LOGOUT':
          // 🛡️ ISOLAMENTO TOTAL: Outra aba clicou em sair.
          // Esta aba NÃO deve sofrer logout! Cada aba gerencia seu próprio ciclo de vida de forma autônoma.
          console.log(`[BroadcastChannel] Logout em aba remota (${data.senderTabId}). Esta aba continua logada e operacional.`);
          break;

        case 'TAB_PING':
          try {
            channel.postMessage({
              type: 'TAB_HEARTBEAT',
              senderTabId: CURRENT_TAB_ID,
              role: authSession?.role,
              userEmail: authSession?.userEmail,
              timestamp: Date.now()
            });
          } catch {}
          break;

        default:
          break;
      }
    };

    try {
      channel.postMessage({
        type: 'TAB_PING',
        senderTabId: CURRENT_TAB_ID,
        role: authSession?.role,
        userEmail: authSession?.userEmail,
        timestamp: Date.now()
      });
    } catch {}

    return () => {
      try {
        channel.close();
      } catch {}
      authChannelRef.current = null;
    };
  }, [authSession?.role, authSession?.userEmail]);

  // Logout oficial: Força signOut no Firebase Auth para esta aba e notifica o canal sem afetar outras abas
  const handleLogout = async () => {
    broadcastAuthEvent({
      type: 'TAB_AUTH_LOGOUT',
      role: authSession?.role,
      userEmail: authSession?.userEmail
    });

    try {
      await signOut(auth);
    } catch (e) {
      console.warn('Erro ao deslogar do Firebase Auth:', e);
    }
    sessionStorage.removeItem('saas_active_auth_session');
    setAuthSession(null);
  };


  // Modals & Overlay state
  const [isNewTenantModalOpen, setIsNewTenantModalOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [impersonatedTenant, setImpersonatedTenant] = useState<Tenant | null>(null);
  const [isAiAssistantOpen, setIsAiAssistantOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('saas_master_tenants', JSON.stringify(tenants));
  }, [tenants]);

  // Sincronização em tempo real com o Firestore (/tenants)
  useEffect(() => {
    const unsubscribe = subscribeToTenantsFirestore((remoteTenants) => {
      // O Firestore é a autoridade central em tempo real: reflete exatamente as empresas cadastradas e deletadas
      setTenants(remoteTenants);
      localStorage.setItem('saas_master_tenants', JSON.stringify(remoteTenants));
    });
    return () => unsubscribe();
  }, []);

  // 🔐 Verificação Resiliente de Sessão
  // - Auto-cura de perfil: Se o usuário estiver no Firebase Auth mas o documento /usuarios/{uid} ainda não existir,
  //   vincula automaticamente à sua empresa/cliente sem forçar signOut.
  // - Mantém a sessão ativa de empresas logadas e nunca desloga o usuário repentinamente em menos de 2 segundos.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      const currentTabSessionRaw = typeof window !== 'undefined' ? sessionStorage.getItem('saas_active_auth_session') : null;
      let currentTabSession: AuthSession | null = null;
      if (currentTabSessionRaw) {
        try {
          currentTabSession = JSON.parse(currentTabSessionRaw);
        } catch {}
      }

      if (user) {
        try {
          const userEmail = (user.email || '').trim().toLowerCase();

          // 🛡️ Proteção Crítica de Link de Lava-Jato / Totem:
          // Se o usuário abriu um link específico de um lava-jato (?empresa=..., ?cadastro=..., ?totem=true),
          // o Firebase Auth NUNCA deve forçar a sessão de Super Admin Master nesta aba!
          if (isCarWashOrClientUrl()) {
            if (userEmail === 'admin_super@gmail.com' || userEmail === 'admin@gmail.com') {
              console.log('[Sessão] URL de lava-jato/totem detectada. Bloqueando auto-login de Super Admin nesta aba.');
              return;
            }
          }

          // 🛡️ Isolamento Estrito entre Abas:
          // Se esta aba já possui uma sessão ativa de Empresa e o evento recebido for Super Admin,
          // ou se esta aba é Super Admin e o evento recebido for de uma Empresa diferente,
          // mantém a sessão atual desta aba intacta sem permitir que uma aba feche ou altere a outra!
          if (currentTabSession) {
            if (currentTabSession.role === 'empresa' && (userEmail === 'admin_super@gmail.com' || userEmail === 'admin@gmail.com')) {
              console.log('[Sessão Guia] Preservando sessão do Dono do Lava-Jato nesta guia.');
              return;
            }
            if (currentTabSession.role === 'admin' && userEmail !== 'admin_super@gmail.com' && userEmail !== 'admin@gmail.com' && currentTabSession.userEmail !== userEmail) {
              console.log('[Sessão Guia] Preservando sessão do Super Admin Master nesta guia.');
              return;
            }
          }

          const userDocRef = doc(db, 'usuarios', user.uid);
          let userDocSnap = await getDoc(userDocRef);

          // Tolerância suave para novos cadastros
          if (!userDocSnap.exists()) {
            await new Promise(r => setTimeout(r, 800));
            userDocSnap = await getDoc(userDocRef);
          }

          // Auto-Cura de Sessão: Se o documento /usuarios/{uid} não existe ainda,
          // localiza a empresa por e-mail e auto-cadastra em /usuarios para estabilizar a sessão
          if (!userDocSnap.exists()) {
            const isFreshRegistration = typeof window !== 'undefined' && sessionStorage.getItem('saas_active_registration_in_progress');
            if (isFreshRegistration) {
              console.log('[Sessão] Registro ativo em andamento, aguardando gravação...');
              return;
            }

            let autoHealedTenant: Tenant | null = null;
            if (userEmail) {
              autoHealedTenant = tenants.find(t => t.contactEmail?.trim().toLowerCase() === userEmail) || null;
              if (!autoHealedTenant) {
                try {
                  autoHealedTenant = await findTenantByCompanyEmailFirestore(userEmail);
                } catch (_) {}
              }
            }

            if (autoHealedTenant) {
              console.log(`[Sessão] Auto-recuperando perfil da empresa para ${user.uid} (${autoHealedTenant.name})`);
              const healedData = {
                uid: user.uid,
                nome: autoHealedTenant.ownerName || autoHealedTenant.name,
                email: userEmail,
                role: 'empresa',
                tenantId: autoHealedTenant.id,
                empresaId: autoHealedTenant.id,
                empresaNome: autoHealedTenant.name,
                empresa: autoHealedTenant,
                updatedAt: new Date().toISOString()
              };
              try {
                await setDoc(userDocRef, healedData, { merge: true });
              } catch (healErr) {
                console.warn('[Sessão] Erro ao gravar auto-cura em /usuarios:', healErr);
              }
              setAuthSession({
                role: 'empresa',
                tenant: autoHealedTenant,
                userEmail: userEmail,
                userName: autoHealedTenant.ownerName || autoHealedTenant.name,
                uid: user.uid
              });
              return;
            }

            // Verifica se é cliente
            if (userEmail) {
              try {
                const clientMatch = await findTenantIdByClientEmailFirestore(userEmail);
                if (clientMatch && clientMatch.tenantId) {
                  const clientTenant = tenants.find(t => t.id === clientMatch.tenantId) || await getTenantByIdOrSlugFirestore(clientMatch.tenantId);
                  if (clientTenant) {
                    await setDoc(userDocRef, {
                      uid: user.uid,
                      nome: clientMatch.clientName || user.displayName || 'Cliente',
                      email: userEmail,
                      role: 'cliente',
                      tenantId: clientTenant.id,
                      empresaId: clientTenant.id,
                      updatedAt: new Date().toISOString()
                    }, { merge: true });

                    setAuthSession({
                      role: 'cliente',
                      tenant: clientTenant,
                      clientInfo: { name: clientMatch.clientName || 'Cliente', phone: '', email: userEmail },
                      userEmail: userEmail,
                      userName: clientMatch.clientName || 'Cliente',
                      uid: user.uid
                    });
                    return;
                  }
                }
              } catch (_) {}
            }

            // Verifica se é super admin
            if (userEmail === 'admin_super@gmail.com' || userEmail === 'admin@gmail.com') {
              if (isCarWashOrClientUrl()) {
                console.log('[Sessão] URL de lava-jato/totem detectada. Ignorando login de Super Admin.');
                return;
              }
              setAuthSession({
                role: 'admin',
                userEmail: userEmail,
                userName: 'Super Admin',
                uid: user.uid
              });
              return;
            }

            // Se há uma sessão ativa em sessionStorage, preserva
            const currentSaved = sessionStorage.getItem('saas_active_auth_session');
            if (currentSaved) {
              try {
                const parsed = JSON.parse(currentSaved);
                if (parsed && parsed.tenant) {
                  setAuthSession(parsed);
                  return;
                }
              } catch {}
            }

            console.warn(`[Sessão] Conta ${user.uid} (${userEmail}) sem vínculo direto em /usuarios.`);
            return;
          }

          // Carrega dados da empresa e perfil direto do Firestore
          const userData = userDocSnap.data();
          const userRole = userData.role || 'empresa';
          const tenantId = userData.tenantId || userData.empresaId;

          let resolvedTenant: Tenant | null = userData.empresa && userData.empresa.id !== 't-autoclean' ? userData.empresa : null;
          if (tenantId) {
            try {
              const tenantSnap = await getDoc(doc(db, 'tenants', tenantId));
              if (tenantSnap.exists()) {
                resolvedTenant = { id: tenantSnap.id, ...tenantSnap.data() } as Tenant;
              } else {
                resolvedTenant = tenants.find(t => t.id === tenantId) || await getTenantByIdOrSlugFirestore(tenantId) || (userData.empresa ? userData.empresa : null);
              }
            } catch (tErr) {
              console.warn('[Sessão] Erro ao carregar tenant da nuvem:', tErr);
              resolvedTenant = userData.empresa || tenants.find(t => t.id === tenantId) || null;
            }
          }

          // Se ainda não encontrou, busca pelo e-mail da empresa
          if (!resolvedTenant && (userData.email || user.email)) {
            const emailSearch = (userData.email || user.email || '').trim().toLowerCase();
            resolvedTenant = tenants.find(t => t.contactEmail?.trim().toLowerCase() === emailSearch) || await findTenantByCompanyEmailFirestore(emailSearch);
          }

          // Verifica se a empresa foi explicitamente excluída pelo Super Admin
          const rawDeleted = typeof window !== 'undefined' ? localStorage.getItem('saas_deleted_tenant_ids') : null;
          const deletedList: string[] = rawDeleted ? JSON.parse(rawDeleted) : [];
          const isExplicitlyDeleted = tenantId && deletedList.includes(tenantId);

          if (userRole === 'empresa' && (!resolvedTenant || isExplicitlyDeleted)) {
            if (isExplicitlyDeleted) {
              console.warn(`[Sessão] A empresa (${tenantId}) foi excluída do sistema. Deslogando.`);
              await signOut(auth);
              sessionStorage.clear();
              setAuthSession(null);
              return;
            }
            // Não desloga prematuramente enquanto o Firestore resolve em segundo plano
            return;
          }

          if (userRole === 'admin') {
            if (isCarWashOrClientUrl()) {
              console.log('[Sessão] URL de lava-jato/totem detectada. Ignorando role admin.');
              return;
            }
            setAuthSession({
              role: 'admin',
              userEmail: userData.email || user.email || '',
              userName: userData.nome || 'Super Admin',
              uid: user.uid
            });
          } else if (userRole === 'cliente') {
            if (!resolvedTenant) {
              return;
            }
            setAuthSession({
              role: 'cliente',
              tenant: resolvedTenant,
              clientInfo: userData.clientInfo || {
                name: userData.nome || user.displayName || 'Cliente',
                phone: userData.telefone || userData.phone || '',
                email: userData.email || user.email || ''
              },
              userEmail: userData.email || user.email || '',
              userName: userData.nome || user.displayName || 'Cliente',
              uid: user.uid
            });
          } else {
            setAuthSession({
              role: 'empresa',
              tenant: resolvedTenant!,
              userEmail: userData.email || user.email || '',
              userName: userData.nome || resolvedTenant?.ownerName || 'Responsável',
              uid: user.uid
            });
          }
        } catch (err) {
          console.error('[Sessão] Erro ao validar usuário no Firestore:', err);
        }
      } else {
        // Se o Firebase Auth reporta user === null, mas temos uma sessão ativa em sessionStorage:
        // Mantém a sessão da empresa / cliente sem deslogar!
        const existingSession = typeof window !== 'undefined' ? sessionStorage.getItem('saas_active_auth_session') : null;
        if (!existingSession) {
          setAuthSession(null);
        } else {
          try {
            const parsed = JSON.parse(existingSession);
            if (parsed && parsed.role) {
              setAuthSession(parsed);
            }
          } catch {
            setAuthSession(null);
          }
        }
      }
    });

    return () => unsubscribe();
  }, [tenants]);


  // 📱 Detecta imediatamente se o dispositivo (ex: Celular via QR Code ou Link) abriu com tenantId ou empresa na URL
  // e carrega diretamente do Firestore para garantir comunicação instantânea com o computador da empresa
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const urlEmpresa = params.get('empresa') || params.get('slug') || params.get('lava');
    const urlTenantId = params.get('tenantId') || params.get('t');
    const isTotemMode = params.get('totem') === 'true' || params.get('mode') === 'totem';
    const isClientSignup = params.get('cadastro') === 'cliente' || params.get('cadastro') === 'true' || params.get('cadastro') === 'sucesso';
    const targetKey = urlEmpresa || urlTenantId;

    if (targetKey || isTotemMode || isClientSignup) {
      // Se for URL de cadastro de cliente ou totem, garante que qualquer sessão residual de admin seja removida desta aba
      if (!isTotemMode && (isClientSignup || urlEmpresa)) {
        const cur = sessionStorage.getItem('saas_active_auth_session');
        if (cur) {
          try {
            const p = JSON.parse(cur);
            if (p.role === 'admin') {
              sessionStorage.removeItem('saas_active_auth_session');
              setAuthSession(null);
            }
          } catch {}
        }
      }

      const resolveTenant = async () => {
        let found: Tenant | null = null;
        if (targetKey) {
          const cleanKey = targetKey.toLowerCase().replace(/[^a-z0-9]/g, '');
          found = tenants.find(t => {
            if (t.id === 't-autoclean') return false;
            const tSlug = (t.slug || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            const tName = (t.nomeFantasia || t.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
            return t.id.toLowerCase() === cleanKey || tSlug === cleanKey || tName === cleanKey || tName.includes(cleanKey) || cleanKey.includes(tName);
          }) || null;

          if (!found) {
            try {
              found = await getTenantByIdOrSlugFirestore(targetKey);
            } catch (err) {
              console.warn('Erro ao buscar tenant no Firestore:', err);
            }
          }
        }

        if (!found) {
          const active = tenants.filter(t => t.id !== 't-autoclean' && !t.id.startsWith('t-10'));
          if (active.length > 0) found = active[0];
        }

        if (found) {
          setTenants(prev => {
            const exists = prev.some(t => t.id === found!.id);
            if (!exists) {
              const updated = [found!, ...prev];
              localStorage.setItem('saas_master_tenants', JSON.stringify(updated));
              return updated;
            }
            return prev;
          });

          if (isTotemMode) {
            setAuthSession({
              role: 'totem',
              tenant: found
            });
          }
        }
      };

      resolveTenant();
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('saas_master_tenants', JSON.stringify(tenants));
    tenants.forEach(t => {
      if (t.contactEmail) {
        saveCompanyEmailMapping(t.contactEmail, t);
      }
    });
  }, [tenants]);

  useEffect(() => {
    localStorage.setItem('saas_master_plans', JSON.stringify(plans));
  }, [plans]);

  useEffect(() => {
    localStorage.setItem('saas_master_admins', JSON.stringify(superAdmins));
  }, [superAdmins]);

  useEffect(() => {
    localStorage.setItem('saas_master_logs', JSON.stringify(logs));
  }, [logs]);

  useEffect(() => {
    localStorage.setItem('saas_master_invoices', JSON.stringify(invoices));
  }, [invoices]);

  useEffect(() => {
    localStorage.setItem('saas_master_security', JSON.stringify(securitySettings));
  }, [securitySettings]);

  // Handlers
  const handleAddTenant = (newTenant: Tenant) => {
    setTenants(prev => [newTenant, ...prev]);
    // 🏢 Persiste no Firestore
    saveTenantToFirestore(newTenant);
    if (newTenant.contactEmail) {
      saveCompanyEmailMapping(newTenant.contactEmail, newTenant);
    }
    
    // Add audit log
    const log: SystemLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toLocaleString('pt-BR'),
      level: 'INFO',
      tenantName: newTenant.name,
      event: `Empresa cadastrada e sincronizada no Firestore (Plano ${newTenant.plan})`,
      ipAddress: '177.12.89.201',
      user: 'Admin Geral'
    };
    setLogs(prev => [log, ...prev]);
  };

  const handleSaveTenant = (updatedTenant: Tenant) => {
    setTenants(prev => prev.map(t => t.id === updatedTenant.id ? updatedTenant : t));
    // Salva senha temporária personalizada no armazenamento local
    if (updatedTenant.tempPassword) {
      localStorage.setItem(`saas_tenant_custom_password_${updatedTenant.id}`, updatedTenant.tempPassword);
    }
    // 🏢 Atualiza no Firestore
    saveTenantToFirestore(updatedTenant);
    if (updatedTenant.contactEmail) {
      saveCompanyEmailMapping(updatedTenant.contactEmail, updatedTenant);
    }

    // Mantém a sessão ativa sincronizada se for a empresa logada
    setAuthSession(prev => {
      if (prev && prev.role === 'empresa' && prev.tenant.id === updatedTenant.id) {
        const nextSession: AuthSession = {
          ...prev,
          tenant: updatedTenant,
          userName: updatedTenant.ownerName || updatedTenant.name,
          userEmail: updatedTenant.contactEmail || prev.userEmail
        };
        sessionStorage.setItem('saas_active_auth_session', JSON.stringify(nextSession));
        return nextSession;
      }
      return prev;
    });
    
    const log: SystemLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toLocaleString('pt-BR'),
      level: 'INFO',
      tenantName: updatedTenant.name,
      event: `Dados atualizados e sincronizados no Firestore`,
      ipAddress: '177.12.89.201',
      user: 'Admin Geral'
    };
    setLogs(prev => [log, ...prev]);
  };

  const handleDeleteTenant = (tenantId: string) => {
    const tenantToDelete = tenants.find(t => t.id === tenantId);
    setTenants(prev => prev.filter(t => t.id !== tenantId));
    // 🗑️ Remove do Firestore
    deleteTenantFromFirestore(tenantId);

    if (tenantToDelete) {
      const log: SystemLog = {
        id: `log-${Date.now()}`,
        timestamp: new Date().toLocaleString('pt-BR'),
        level: 'WARN',
        tenantName: tenantToDelete.name,
        event: `Empresa removida do banco de dados Firestore`,
        ipAddress: '177.12.89.201',
        user: 'Admin Geral'
      };
      setLogs(prev => [log, ...prev]);
    }
  };

  const handleDeleteDemoTenants = async () => {
    await deleteDemoTenantsFromFirestore();
    setTenants(prev => {
      const filtered = prev.filter(t => !t.id.startsWith('t-10') && t.id !== 't-autoclean');
      localStorage.setItem('saas_master_tenants', JSON.stringify(filtered));
      return filtered;
    });

    const log: SystemLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toLocaleString('pt-BR'),
      level: 'WARN',
      tenantName: 'Sistema SaaS',
      event: `Empresas de demonstração excluídas em massa do Firestore e cache limpo`,
      ipAddress: '177.12.89.201',
      user: 'Admin Geral'
    };
    setLogs(prev => [log, ...prev]);
  };

  const handleUpdatePlan = (updatedPlan: Plan) => {
    setPlans(prev => prev.map(p => p.id === updatedPlan.id ? updatedPlan : p));
  };

  const handleAddPlan = (newPlan: Plan) => {
    setPlans(prev => [...prev, newPlan]);
  };

  const handleDeletePlan = (planId: string) => {
    const planToRemove = plans.find(p => p.id === planId);
    setPlans(prev => prev.filter(p => p.id !== planId));

    if (planToRemove) {
      const log: SystemLog = {
        id: `log-${Date.now()}`,
        timestamp: new Date().toLocaleString('pt-BR'),
        level: 'WARN',
        tenantName: 'Catálogo de Planos',
        event: `Plano "${planToRemove.displayName}" (R$ ${planToRemove.priceMonthly}/mês) excluído do sistema`,
        ipAddress: '177.12.89.201',
        user: 'Admin Geral'
      };
      setLogs(prev => [log, ...prev]);
    }
  };

  const handleToggleSecuritySetting = (id: string) => {
    setSecuritySettings(prev =>
      prev.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s)
    );
  };

  const handleInviteSuperAdmin = (newAdmin: SuperAdminUser) => {
    setSuperAdmins(prev => [...prev, newAdmin]);
  };

  const handleRemoveSuperAdmin = (id: string) => {
    setSuperAdmins(prev => prev.filter(a => a.id !== id));
  };

  const handleAddLog = (newLog: SystemLog) => {
    setLogs(prev => [newLog, ...prev]);
  };

  const handleClearLogs = () => {
    setLogs([]);
  };

  const handleClearAllData = () => {
    localStorage.removeItem('saas_master_tenants');
    localStorage.removeItem('saas_master_logs');
    localStorage.removeItem('saas_master_invoices');
    setTenants([]);
    setLogs([]);
    setInvoices([]);
  };

  const handleLoadDemoData = () => {
    setTenants(INITIAL_TENANTS);
    setLogs(INITIAL_LOGS);
    setInvoices(INITIAL_INVOICES);
  };

  // ================= RENDERIZAÇÃO DA APLICAÇÃO COM TRANSIÇÃO SUAVE =================
  return (
    <>
      {/* 1. TELA DE ENTRADA: SPLASH SCREEN (Duração de 5 segundos com fade-out suave de 0.5s) */}
      {showSplash && (
        <SplashScreen 
          onFinish={() => setShowSplash(false)} 
          durationMs={5000} 
        />
      )}

      {/* Indicador de Status PWA / Offline */}
      <OfflineIndicator />

      {/* 2. TELA PRINCIPAL (DASHBOARD): Fade-in suave de entrada */}
      <div className={`w-full min-h-screen transition-opacity duration-700 ${showSplash ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        
        {/* Barra Superior Oficial: WashAuto OS (oculta em Modo Totem Kiosk para imersão total no tablet) */}
        {authSession?.role !== 'totem' && (
          <div className="bg-[#0B0F19] border-b border-[#1F2937] px-4 py-2.5 flex items-center justify-between sticky top-0 z-50">
            <div className="flex items-center gap-2.5">
              <img 
                src="/logo.png" 
                alt="WashAuto OS" 
                onError={(e) => {
                  const target = e.currentTarget as HTMLImageElement;
                  if (target.src !== window.location.origin + '/logo.png') {
                    target.src = '/logo.png';
                  }
                }}
                className="w-6 h-6 rounded-lg object-contain bg-slate-900 border border-cyan-500/30 p-0.5"
              />
              <span className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
                WashAuto OS
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              {authSession?.role === 'cliente' && authSession.tenant && (
                <span className="text-[11px] text-cyan-400 font-medium bg-cyan-500/10 px-2.5 py-0.5 rounded-full border border-cyan-500/20">
                  {authSession.tenant.name}
                </span>
              )}
              {authSession?.role === 'empresa' && authSession.tenant && (
                <span className="text-[11px] text-blue-400 font-medium bg-blue-500/10 px-2.5 py-0.5 rounded-full border border-blue-500/20">
                  {authSession.tenant.nomeFantasia || authSession.tenant.name}
                </span>
              )}
              {authSession && (
                <button
                  onClick={handleLogout}
                  className="text-[11px] text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 px-2 py-1 rounded transition flex items-center gap-1 cursor-pointer font-medium"
                  title="Sair / Trocar de perfil"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sair</span>
                </button>
              )}

            </div>
          </div>
        )}
        
        {/* 2.1 MODO LOGIN / SELEÇÃO DE PERFIL */}
        {!authSession && (
          <LoginModal
            isModal={false}
            tenants={tenants}
            onLoginAsClient={(tenant, clientInfo) => {
              setTenants(prev => prev.some(t => t.id === tenant.id) ? prev : [...prev, tenant]);
              const newSession: AuthSession = {
                role: 'cliente',
                tenant,
                clientInfo: clientInfo || { name: 'Cliente', phone: '(11) 99999-9999', email: 'cliente@exemplo.com' },
                userEmail: clientInfo?.email || 'cliente@exemplo.com',
                userName: clientInfo?.name || 'Cliente',
                uid: `client-${Date.now()}`
              };
              sessionStorage.setItem('saas_active_auth_session', JSON.stringify(newSession));
              setAuthSession(newSession);
              broadcastAuthEvent({
                type: 'TAB_AUTH_LOGIN',
                role: 'cliente',
                userEmail: newSession.userEmail,
                tenantId: tenant.id
              });
            }}
            onLoginAsEmpresa={(tenant) => {
              if (tenant.id === 't-autoclean' || tenant.id.startsWith('t-10')) return;
              setTenants(prev => prev.some(t => t.id === tenant.id) ? prev : [...prev, tenant]);
              const newSession: AuthSession = {
                role: 'empresa',
                tenant,
                userEmail: tenant.contactEmail || 'empresa@lavajato.com',
                userName: tenant.ownerName || tenant.name,
                uid: `emp-${tenant.id}`
              };
              sessionStorage.setItem('saas_active_auth_session', JSON.stringify(newSession));
              setAuthSession(newSession);
              broadcastAuthEvent({
                type: 'TAB_AUTH_LOGIN',
                role: 'empresa',
                userEmail: newSession.userEmail,
                tenantId: tenant.id
              });
            }}
            onLoginAsSuperAdmin={() => {
              const newSession: AuthSession = {
                role: 'admin',
                userEmail: localStorage.getItem('saas_admin_email') || 'admin_super@gmail.com',
                userName: 'Super Admin',
                uid: 'super-admin'
              };
              sessionStorage.setItem('saas_active_auth_session', JSON.stringify(newSession));
              setAuthSession(newSession);
              broadcastAuthEvent({
                type: 'TAB_AUTH_LOGIN',
                role: 'admin',
                userEmail: newSession.userEmail
              });
            }}
            onReplaySplash={() => setShowSplash(true)}
          />
        )}

        {/* 2.2 MODO PORTAL DO CLIENTE */}
        {authSession?.role === 'cliente' && (
          <ClientPortal
            tenant={authSession.tenant}
            clientInfo={authSession.clientInfo}
            onLogout={handleLogout}
            onNewAppointmentCreated={(newApp) => {

              const tenantId = authSession.tenant.id;
              const appointmentItem = {
                id: (newApp as any).id || `app-${Date.now()}`,
                dateTime: newApp.dateTime,
                clientName: newApp.clientName,
                clientPhone: (newApp as any).clientPhone || '',
                clientEmail: (newApp as any).clientEmail || '',
                vehicle: newApp.vehicle,
                plate: newApp.plate,
                service: newApp.service,
                price: newApp.price,
                status: 'Pendente',
                addressSummary: (newApp as any).addressSummary || ''
              };

              // 🚀 Comunicação em tempo real Celular -> Computador via Firestore
              saveAppointmentToFirestore(tenantId, appointmentItem).catch(console.error);

              try {
                const existing = JSON.parse(localStorage.getItem(`saas_tenant_appointments_${tenantId}`) || '[]');
                const updated = [appointmentItem, ...existing.filter((a: any) => a.id !== appointmentItem.id)];
                localStorage.setItem(`saas_tenant_appointments_${tenantId}`, JSON.stringify(updated));
                window.dispatchEvent(new Event('storage'));
                window.dispatchEvent(new CustomEvent('saas_data_sync', { detail: { tenantId } }));
              } catch (e) {
                console.error('Failed to sync appointment in App.tsx:', e);
              }

              const log: SystemLog = {
                id: `log-${Date.now()}`,
                timestamp: new Date().toLocaleString('pt-BR'),
                level: 'INFO',
                tenantName: authSession.tenant.name,
                event: `Novo agendamento recebido via Portal do Cliente (${newApp.clientName} - ${newApp.service})`,
                ipAddress: '177.12.89.201',
                user: newApp.clientName
              };
              setLogs(prev => [log, ...prev]);
            }}
          />
        )}

        {/* 2.3 MODO DONO DO LAVA-JATO (TENANT WORKSPACE - DASHBOARD OPERACIONAL) */}
        {authSession?.role === 'empresa' && (
          <TenantWorkspace
            tenant={authSession.tenant}
            onExitImpersonation={handleLogout}
            onReplaySplash={() => setShowSplash(true)}
            onOpenTotemMode={() => {
              setAuthSession({
                role: 'totem',
                tenant: authSession.tenant
              });
            }}
            onUpdateTenant={(updated) => {
              setTenants(prev => prev.map(t => t.id === updated.id ? updated : t));
              setAuthSession(prev => prev ? { ...prev, tenant: updated } : null);
              saveTenantToFirestore(updated).catch(console.error);
            }}
          />
        )}

        {/* 2.5 MODO TOTEM DE AUTOATENDIMENTO (TABLET) */}
        {authSession?.role === 'totem' && (
          <TotemMode
            tenant={authSession.tenant}
            customExitPin={authSession.tenant.tempPassword || '1234'}
            onExitTotem={() => {
              const prevTenant = authSession.tenant;
              setAuthSession({
                role: 'empresa',
                tenant: prevTenant,
                userEmail: prevTenant.contactEmail || 'empresa@lavajato.com',
                userName: prevTenant.ownerName || prevTenant.name,
                uid: `emp-${prevTenant.id}`
              });
            }}
          />
        )}

        {/* 2.4 MODO SUPER ADMIN (ROOT SAAS DASHBOARD) */}
        {authSession?.role === 'admin' && (
          <div className="bg-[#020617] text-[#f8fafc] font-sans flex h-screen overflow-hidden selection:bg-indigo-500 selection:text-white">

      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setCurrentTab(tab);
          setSearchQuery('');
        }}
        tenantsCount={tenants.length}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        onOpenAiAssistant={() => setIsAiAssistantOpen(true)}
        onLogout={handleLogout}
      />

      {/* Main Content Workspace */}
      <main className="flex-1 flex flex-col overflow-y-auto">
        
        {/* Top Header Bar */}
        <Header
          currentTab={currentTab}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onOpenNewTenantModal={() => setIsNewTenantModalOpen(true)}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          onOpenAiAssistant={() => setIsAiAssistantOpen(true)}
          onOpenLoginModal={() => setIsLoginModalOpen(true)}
          onLogout={handleLogout}
          onClearData={handleClearAllData}
          onLoadDemoData={handleLoadDemoData}
        />

        {/* Dynamic Section Area */}
        <div className="p-4 md:p-6 space-y-6 max-w-7xl w-full mx-auto">
          {currentTab === 'overview' && (
            <OverviewSection
              tenants={tenants}
              plans={plans}
              onOpenNewTenantModal={() => setIsNewTenantModalOpen(true)}
              onEditTenant={(t) => setEditingTenant(t)}
              onImpersonateTenant={(t) => setImpersonatedTenant(t)}
              onNavigateToTenants={() => setCurrentTab('tenants')}
              onNavigateToPlans={() => setCurrentTab('plans')}
            />
          )}

          {currentTab === 'tenants' && (
            <TenantsSection
              tenants={tenants}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onOpenNewTenantModal={() => setIsNewTenantModalOpen(true)}
              onEditTenant={(t) => setEditingTenant(t)}
              onDeleteTenant={handleDeleteTenant}
              onImpersonateTenant={(t) => setImpersonatedTenant(t)}
              onDeleteDemoTenants={handleDeleteDemoTenants}
            />
          )}

          {currentTab === 'plans' && (
            <PlansSection
              plans={plans}
              invoices={invoices}
              tenants={tenants}
              onUpdatePlan={handleUpdatePlan}
              onAddPlan={handleAddPlan}
              onDeletePlan={handleDeletePlan}
            />
          )}

          {currentTab === 'logs' && (
            <LogsSection
              logs={logs}
              onAddLog={handleAddLog}
              onClearLogs={handleClearLogs}
            />
          )}

          {currentTab === 'settings' && (
            <AdminSettingsSection
              onNotify={(msg) => handleAddLog({
                id: `log-${Date.now()}`,
                timestamp: new Date().toLocaleString('pt-BR'),
                level: 'INFO',
                tenantName: 'SaaS Master',
                event: msg,
                ipAddress: '127.0.0.1',
                user: 'Super Admin'
              })}
            />
          )}
        </div>
      </main>

      {/* Modal Nova Empresa */}
      <NewTenantModal
        isOpen={isNewTenantModalOpen}
        onClose={() => setIsNewTenantModalOpen(false)}
        onAddTenant={handleAddTenant}
        onTestClientPortal={(tenant) => {
          setTenants(prev => prev.some(t => t.id === tenant.id) ? prev : [tenant, ...prev]);
          const newSession: AuthSession = {
            role: 'cliente',
            tenant,
            clientInfo: {
              name: 'Cliente Teste',
              phone: '(11) 98765-4321',
              email: 'cliente@exemplo.com'
            },
            userEmail: 'cliente@exemplo.com'
          };
          sessionStorage.setItem('saas_active_auth_session', JSON.stringify(newSession));
          setAuthSession(newSession);
          broadcastAuthEvent({
            type: 'TAB_AUTH_LOGIN',
            role: 'cliente',
            userEmail: newSession.userEmail,
            tenantId: tenant.id
          });
        }}
      />

      {/* Modal Editar Empresa */}
      <EditTenantModal
        isOpen={!!editingTenant}
        tenant={editingTenant}
        onClose={() => setEditingTenant(null)}
        onSaveTenant={handleSaveTenant}
        onDeleteTenant={handleDeleteTenant}
      />

      {/* Overlay de Impersonificação do Super Admin */}
      {impersonatedTenant && (
        <ImpersonationOverlay
          tenant={impersonatedTenant}
          onExit={() => setImpersonatedTenant(null)}
        />
      )}

      {/* Modal Assistente IA */}
      <AiAssistantModal
        isOpen={isAiAssistantOpen}
        onClose={() => setIsAiAssistantOpen(false)}
        tenants={tenants}
      />

      {/* Modal de Login Multi-Perfil (para alternar dentro do painel) */}
      <LoginModal
        isOpen={isLoginModalOpen}
        isModal={true}
        onClose={() => setIsLoginModalOpen(false)}
        tenants={tenants}
        onLoginAsClient={(tenant, clientInfo) => {
          const newSession: AuthSession = {
            role: 'cliente',
            tenant,
            clientInfo: clientInfo || { name: 'João Silva', phone: '(11) 99999-9999' },
            userEmail: 'cliente@exemplo.com'
          };
          sessionStorage.setItem('saas_active_auth_session', JSON.stringify(newSession));
          setAuthSession(newSession);
          broadcastAuthEvent({
            type: 'TAB_AUTH_LOGIN',
            role: 'cliente',
            userEmail: newSession.userEmail,
            tenantId: tenant.id
          });
          setIsLoginModalOpen(false);
        }}
        onLoginAsEmpresa={(tenant) => {
          if (tenant.id === 't-autoclean' || tenant.id.startsWith('t-10')) return;
          const newSession: AuthSession = {
            role: 'empresa',
            tenant,
            userEmail: tenant.contactEmail || 'empresa@lavajato.com'
          };
          sessionStorage.setItem('saas_active_auth_session', JSON.stringify(newSession));
          setAuthSession(newSession);
          broadcastAuthEvent({
            type: 'TAB_AUTH_LOGIN',
            role: 'empresa',
            userEmail: newSession.userEmail,
            tenantId: tenant.id
          });
          setIsLoginModalOpen(false);
        }}
        onLoginAsSuperAdmin={() => {
          const newSession: AuthSession = {
            role: 'admin',
            userEmail: localStorage.getItem('saas_admin_email') || 'admin_super@gmail.com'
          };
          sessionStorage.setItem('saas_active_auth_session', JSON.stringify(newSession));
          setAuthSession(newSession);
          broadcastAuthEvent({
            type: 'TAB_AUTH_LOGIN',
            role: 'admin',
            userEmail: newSession.userEmail
          });
          setIsLoginModalOpen(false);
        }}
      />

          </div>
        )}

      </div>
    </>
  );
}
