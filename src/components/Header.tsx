import React, { useState } from 'react';
import { 
  Search, 
  Bell, 
  Menu, 
  PlusCircle, 
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  LogIn,
  LogOut,
  X,
  Trash2,
  RotateCcw
} from 'lucide-react';
import { NavTab } from './Sidebar';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderProps {
  currentTab: NavTab;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onOpenNewTenantModal: () => void;
  onOpenMobileMenu: () => void;
  onOpenAiAssistant: () => void;
  onOpenLoginModal?: () => void;
  onLogout?: () => void;
  onClearData?: () => void;
  onLoadDemoData?: () => void;
  unreadNotificationsCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  searchQuery,
  onSearchChange,
  onOpenNewTenantModal,
  onOpenMobileMenu,
  onOpenAiAssistant,
  onOpenLoginModal,
  onLogout,
  onClearData,
  onLoadDemoData,
  unreadNotificationsCount = 3
}) => {
  const [showNotifications, setShowNotifications] = useState(false);

  const tabTitles: Record<NavTab, string> = {
    overview: 'Painel do Administrador Geral',
    tenants: 'Gestão de Empresas & Tenants',
    plans: 'Planos, Preços & Faturamento',
    logs: 'Logs do Sistema & Telemetria',
    settings: 'Configurações Administrativas & Troca de Senha'
  };

  const sampleNotifications = [
    {
      id: 1,
      type: 'warning',
      title: 'Cartão recusado - Global Logistics',
      time: 'Há 15 min',
      desc: 'Cobrança do Plano Basic falhou no valor de R$ 199.'
    },
    {
      id: 2,
      type: 'success',
      title: 'Nova Empresa Cadastrada',
      time: 'Há 1 hora',
      desc: 'Initech Software iniciou um trial no Plano Pro.'
    },
    {
      id: 3,
      type: 'info',
      title: 'Backup automático concluído',
      time: 'Há 3 horas',
      desc: 'Snapshots de banco de dados armazenados com sucesso.'
    }
  ];

  return (
    <header className="h-16 flex-none border-b border-[#1e293b] bg-[#020617]/80 backdrop-blur-md px-6 lg:px-8 flex items-center justify-between sticky top-0 z-20">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileMenu}
          className="p-2 text-slate-400 hover:text-slate-200 hover:bg-[#0f172a] rounded-lg md:hidden transition"
          aria-label="Abrir menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold text-slate-100 truncate tracking-tight">
          {tabTitles[currentTab]}
        </h1>
      </div>

      <div className="flex items-center gap-3 md:gap-4">
        {/* Campo de busca rápida */}
        <div className="relative hidden sm:block">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar tenant ou ID..."
            className="bg-[#0f172a] border border-[#1e293b] text-xs text-slate-200 rounded-lg pl-9 pr-8 py-1.5 focus:outline-none focus:border-indigo-500 w-56 lg:w-64 transition placeholder:text-slate-500"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Botão PWA App Install */}
        <PWAInstallButton compact variant="outline" className="hidden sm:inline-flex" />

        {/* Botão Sair / Trocar Perfil */}
        {onLogout ? (
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-sm"
            title="Sair / Voltar para a Tela de Login"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden sm:inline">Sair</span>
          </button>
        ) : onOpenLoginModal ? (
          <button
            onClick={onOpenLoginModal}
            className="flex items-center gap-1.5 bg-[#0f172a] border border-blue-500/40 hover:border-blue-500 text-blue-400 px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-sm"
            title="Trocar Perfil / Entrar"
          >
            <LogIn className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden sm:inline">Entrar / Perfil</span>
          </button>
        ) : null}

        {/* Botão Carregar Demo (Opcional) */}
        {onLoadDemoData && (
          <button
            onClick={onLoadDemoData}
            className="hidden xl:flex items-center gap-1.5 bg-[#0f172a] border border-slate-800 hover:border-blue-500/50 text-slate-400 hover:text-blue-400 px-2.5 py-1.5 rounded-lg text-xs font-medium transition"
            title="Carregar dados de demonstração"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Dados Demo</span>
          </button>
        )}

        {/* Botão Bot / Assistente IA */}
        <button
          onClick={onOpenAiAssistant}
          className="hidden lg:flex items-center gap-1.5 bg-[#0f172a] border border-indigo-500/30 hover:border-indigo-500/60 text-indigo-300 px-3 py-1.5 rounded-lg text-xs font-bold transition"
          title="Abrir Análise IA"
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span>Insights IA</span>
        </button>

        {/* Botão Nova Empresa */}
        <button
          onClick={onOpenNewTenantModal}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-sm shadow-indigo-600/30"
        >
          <PlusCircle className="w-4 h-4" />
          <span className="hidden sm:inline">Nova Empresa</span>
          <span className="sm:hidden">Nova</span>
        </button>

        {/* Notificações */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-[#0f172a] rounded-lg transition relative"
            title="Notificações do sistema"
          >
            <Bell className="w-5 h-5" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></span>
            )}
          </button>

          {/* Popup de Notificações */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 md:w-96 bg-[#020617] border border-[#1e293b] rounded-xl shadow-2xl z-50 p-4 divide-y divide-[#1e293b]">
              <div className="flex items-center justify-between pb-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Alertas do Sistema
                  </h3>
                  <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px] px-1.5 py-0.5 rounded font-bold">
                    {sampleNotifications.length}
                  </span>
                </div>
                <button
                  onClick={() => setShowNotifications(false)}
                  className="text-slate-400 hover:text-slate-200 text-xs"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="py-2 space-y-2 max-h-72 overflow-y-auto">
                {sampleNotifications.map((n) => (
                  <div key={n.id} className="p-3 rounded-lg bg-[#0f172a] border border-[#1e293b]/60 hover:border-indigo-500/30 transition flex gap-3 text-xs">
                    {n.type === 'warning' ? (
                      <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="font-semibold text-slate-200">{n.title}</p>
                      <p className="text-slate-400 text-[11px] mt-0.5 leading-normal">{n.desc}</p>
                      <span className="text-[10px] text-slate-500 mt-1 block font-medium">{n.time}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-3 text-center">
                <button
                  onClick={() => {
                    setShowNotifications(false);
                  }}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 font-bold"
                >
                  Marcar todos como lidos
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
