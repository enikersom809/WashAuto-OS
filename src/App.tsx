import React, { useState, useEffect } from 'react';
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
import { OfflineIndicator } from './components/OfflineIndicator';
import { SplashScreen } from './components/SplashScreen';
import { 
  saveTenantToFirestore, 
  deleteTenantFromFirestore, 
  subscribeToTenantsFirestore,
  saveCompanyEmailMapping,
  syncAllLocalTenantsToFirestore,
  saveAppointmentToFirestore,
  getTenantByIdOrSlugFirestore
} from './lib/firebaseService';

export type AuthSession = 
  | { role: 'admin'; userEmail: string }
  | { role: 'empresa'; tenant: Tenant; userEmail: string }
  | { role: 'cliente'; tenant: Tenant; clientInfo: { name: string; phone: string; email?: string }; userEmail: string }
  | null;

const DEFAULT_DEMO_TENANT: Tenant = {
  id: 't-autoclean',
  name: 'Auto Clean Spa',
  code: 'AC',
  domain: 'autoclean.saas.com',
  plan: 'Pro',
  status: 'Ativo',
  endUsersCount: 142,
  maxUsers: 500,
  mrrAmount: 399,
  createdAt: '01/02/2026',
  contactEmail: 'gerente@autoclean.com',
  contactPhone: '+55 11 98888-7777',
  ownerName: 'Ricardo Santos',
  notes: 'Centro de Estética Automotiva e Lava-Rápido Premium.',
  lastActive: 'Agora'
};

export default function App() {
  // Persistence with localStorage (Default to empty [] for 100% clean slate testing)
  const [tenants, setTenants] = useState<Tenant[]>(() => {
    const saved = localStorage.getItem('saas_master_tenants');
    return saved ? JSON.parse(saved) : [];
  });

  const [plans, setPlans] = useState<Plan[]>(() => {
    const saved = localStorage.getItem('saas_master_plans');
    return saved ? JSON.parse(saved) : INITIAL_PLANS;
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
    if (params.get('empresa') || params.get('slug') || params.get('cadastro') || params.get('t')) {
      return false;
    }
    const path = window.location.pathname.replace(/^\//, '').split('/')[0];
    if (path && path !== 'index.html' && path !== '') {
      return false;
    }
    return true;
  });

  // Auth Session State: Inicia como null para que, após a Splash Screen de 5s, o usuário veja a tela de Login/Cadastro!
  const [authSession, setAuthSession] = useState<AuthSession | null>(() => {
    // Garante que o fluxo padrão após a apresentação (splash) seja a tela de Login/Cadastro
    localStorage.removeItem('saas_active_session');
    return null;
  });

  useEffect(() => {
    if (authSession) {
      localStorage.setItem('saas_active_session', JSON.stringify(authSession));
    } else {
      localStorage.removeItem('saas_active_session');
    }
  }, [authSession]);

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
      if (remoteTenants && remoteTenants.length > 0) {
        setTenants(prev => {
          // Merge mantendo novos cadastros locais com os remotos
          const merged = [...remoteTenants];
          prev.forEach(localT => {
            if (!merged.some(r => r.id === localT.id)) {
              merged.push(localT);
            }
          });
          return merged;
        });
      }
    });
    return () => unsubscribe();
  }, []);

  // 📱 Detecta imediatamente se o dispositivo (ex: Celular via QR Code ou Link) abriu com tenantId ou empresa na URL
  // e carrega diretamente do Firestore para garantir comunicação instantânea com o computador da empresa
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const urlTenantId = params.get('tenantId') || params.get('t');
    const urlEmpresa = params.get('empresa') || params.get('slug') || params.get('lava');
    const targetKey = urlTenantId || urlEmpresa;

    if (targetKey) {
      getTenantByIdOrSlugFirestore(targetKey).then(found => {
        if (found) {
          setTenants(prev => {
            const exists = prev.some(t => t.id === found.id);
            if (!exists) {
              const updated = [found, ...prev];
              localStorage.setItem('saas_master_tenants', JSON.stringify(updated));
              return updated;
            }
            return prev;
          });
        }
      }).catch(console.error);
    }
  }, []);

  // Sincronização inicial automática: caso o usuário já tenha cadastrado empresas no navegador
  // que ainda não subiram para o Firestore (/tenants)
  useEffect(() => {
    if (tenants.length > 0) {
      syncAllLocalTenantsToFirestore(tenants);
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
    // 🏢 Atualiza no Firestore
    saveTenantToFirestore(updatedTenant);
    if (updatedTenant.contactEmail) {
      saveCompanyEmailMapping(updatedTenant.contactEmail, updatedTenant);
    }
    
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
        
        {/* Barra Superior Oficial: WashAuto OS */}
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
                onClick={() => setAuthSession(null)}
                className="text-[11px] text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 px-2 py-1 rounded transition flex items-center gap-1 cursor-pointer font-medium"
                title="Sair / Trocar de perfil"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sair</span>
              </button>
            )}
          </div>
        </div>
        
        {/* 2.1 MODO LOGIN / SELEÇÃO DE PERFIL */}
        {!authSession && (
          <LoginModal
            isModal={false}
            tenants={tenants.length > 0 ? tenants : [DEFAULT_DEMO_TENANT]}
            onLoginAsClient={(tenant, clientInfo) => {
              setTenants(prev => prev.some(t => t.id === tenant.id) ? prev : [...prev, tenant]);
              setAuthSession({
                role: 'cliente',
                tenant,
                clientInfo: clientInfo || { name: 'Cliente', phone: '(11) 99999-9999', email: 'cliente@exemplo.com' },
                userEmail: clientInfo?.email || 'cliente@exemplo.com'
              });
            }}
            onLoginAsEmpresa={(tenant) => {
              setTenants(prev => prev.some(t => t.id === tenant.id) ? prev : [...prev, tenant]);
              setAuthSession({
                role: 'empresa',
                tenant,
                userEmail: tenant.contactEmail || 'gerente@autoclean.com'
              });
            }}
            onLoginAsSuperAdmin={() => {
              setAuthSession({
                role: 'admin',
                userEmail: localStorage.getItem('saas_admin_email') || 'admin_super@gmail.com'
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
            onLogout={() => setAuthSession(null)}
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
            onExitImpersonation={() => setAuthSession(null)}
            onReplaySplash={() => setShowSplash(true)}
            onUpdateTenant={(updated) => {
              setTenants(prev => prev.map(t => t.id === updated.id ? updated : t));
              setAuthSession(prev => prev ? { ...prev, tenant: updated } : null);
              saveTenantToFirestore(updated).catch(console.error);
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
        onLogout={() => setAuthSession(null)}
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
          onLogout={() => setAuthSession(null)}
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
          setAuthSession({
            role: 'cliente',
            tenant,
            clientInfo: {
              name: 'Cliente Teste',
              phone: '(11) 98765-4321',
              email: 'cliente@exemplo.com'
            },
            userEmail: 'cliente@exemplo.com'
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
          setAuthSession({
            role: 'cliente',
            tenant,
            clientInfo: clientInfo || { name: 'João Silva', phone: '(11) 99999-9999' },
            userEmail: 'cliente@exemplo.com'
          });
          setIsLoginModalOpen(false);
        }}
        onLoginAsEmpresa={(tenant) => {
          setAuthSession({
            role: 'empresa',
            tenant,
            userEmail: 'gerente@autoclean.com'
          });
          setIsLoginModalOpen(false);
        }}
        onLoginAsSuperAdmin={() => {
          setAuthSession({
            role: 'admin',
            userEmail: localStorage.getItem('saas_admin_email') || 'admin_super@gmail.com'
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
