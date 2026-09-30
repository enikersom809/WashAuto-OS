import React from 'react';
import { 
  LayoutGrid, 
  Building2, 
  CreditCard, 
  Activity, 
  Settings,
  LogOut, 
  Sparkles,
  X
} from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';

export type NavTab = 'overview' | 'tenants' | 'plans' | 'logs' | 'settings';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  tenantsCount: number;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  onOpenAiAssistant: () => void;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  tenantsCount,
  isOpenMobile,
  onCloseMobile,
  onOpenAiAssistant,
  onLogout
}) => {
  const navItems = [
    { id: 'overview' as NavTab, label: 'Visão Geral', icon: LayoutGrid },
    { id: 'tenants' as NavTab, label: 'Empresas (Tenants)', icon: Building2, badge: tenantsCount },
    { id: 'plans' as NavTab, label: 'Planos e Faturamento', icon: CreditCard },
    { id: 'logs' as NavTab, label: 'Logs & Sistema', icon: Activity },
    { id: 'settings' as NavTab, label: 'Configurações', icon: Settings },
  ];

  const content = (
    <div className="flex flex-col justify-between h-full p-6 bg-[#020617] border-r border-[#1e293b] text-[#f8fafc]">
      <div>
        {/* Logo da Plataforma */}
        <div className="flex items-center gap-3 pb-6 mb-6 border-b border-[#1e293b]">
          <div className="relative group flex-shrink-0">
            <img 
              src="/logo.png" 
              alt="WashAuto OS" 
              onError={(e) => {
                const target = e.currentTarget as HTMLImageElement;
                if (target.src !== window.location.origin + '/logo.png') {
                  target.src = '/logo.png';
                }
              }}
              className="w-10 h-10 rounded-xl object-contain bg-slate-900 shadow-lg border border-cyan-500/30 p-0.5"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-base tracking-tight text-slate-100 leading-none">WashAuto OS</span>
            <span className="text-[10px] text-cyan-400 font-medium mt-1">Super Admin Root</span>
          </div>
          <span className="text-[10px] bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 font-bold px-1.5 py-0.5 rounded ml-auto">
            ROOT
          </span>
          {isOpenMobile && (
            <button 
              onClick={onCloseMobile} 
              className="md:hidden text-slate-400 hover:text-slate-200 p-1"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Links de Navegação */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  if (isOpenMobile) onCloseMobile();
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-sm transition text-left group ${
                  isActive
                    ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 shadow-sm'
                    : 'text-slate-400 hover:bg-[#0f172a] hover:text-slate-200 border border-transparent'
                }`}
              >
                <Icon className={`w-5 h-5 transition-transform group-hover:scale-105 ${isActive ? 'text-indigo-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
                <span className="flex-1 truncate">{item.label}</span>
                {item.badge !== undefined && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                    isActive ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-900 text-slate-400 border border-slate-800'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* AI Insight Assistant CTA */}
        <div className="mt-6 p-4 bg-[#0f172a] border border-[#1e293b] rounded-xl relative overflow-hidden group">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-md bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            </div>
            <span className="text-xs font-bold text-slate-200">IA Advisor SaaS</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
            Análise preditiva de MRR, diagnóstico de Churn e recomendações automáticas.
          </p>
          <button
            onClick={() => {
              onOpenAiAssistant();
              if (isOpenMobile) onCloseMobile();
            }}
            className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/20"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Consultar IA
          </button>
        </div>

        {/* PWA Install Button */}
        <div className="mt-4 pt-3 border-t border-slate-800/80">
          <PWAInstallButton compact variant="outline" className="w-full justify-center" />
        </div>
      </div>

      {/* Perfil do Administrador */}
      <div className="border-t border-[#1e293b] pt-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center font-bold text-slate-200 border border-slate-700">
          AD
        </div>
        <div className="overflow-hidden flex-1">
          <p className="text-sm font-semibold text-slate-200 truncate">{localStorage.getItem('saas_admin_name') || 'Super Admin'}</p>
          <p className="text-[11px] text-indigo-400 truncate font-mono">{localStorage.getItem('saas_admin_email') || 'admin_super@gmail.com'}</p>
        </div>
        <button 
          onClick={onLogout ? onLogout : undefined} 
          className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-slate-900 transition" 
          title="Sair / Trocar Perfil"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="w-64 flex-shrink-0 hidden md:block h-screen">
        {content}
      </aside>

      {/* Mobile Drawer */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div 
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" 
            onClick={onCloseMobile} 
          />
          <div className="relative w-72 max-w-full h-full z-10">
            {content}
          </div>
        </div>
      )}
    </>
  );
};
