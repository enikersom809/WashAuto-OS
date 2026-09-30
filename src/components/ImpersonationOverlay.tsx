import React from 'react';
import { ArrowLeft, ShieldAlert } from 'lucide-react';
import { Tenant } from '../types';
import { TenantWorkspace } from './TenantWorkspace';

interface ImpersonationOverlayProps {
  tenant: Tenant;
  onExit: () => void;
}

export const ImpersonationOverlay: React.FC<ImpersonationOverlayProps> = ({
  tenant,
  onExit
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-[#020617] text-[#f8fafc] overflow-y-auto flex flex-col font-sans">
      
      {/* Sticky Banner de Impersonificação Super Admin */}
      <div className="bg-indigo-600 text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-50 shadow-xl border-b border-indigo-500">
        <div className="flex items-center gap-3 text-xs md:text-sm font-bold">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <ShieldAlert className="w-4 h-4 text-amber-300" />
          <span>
            Sessão de Impersonificação ROOT: <span className="underline decoration-indigo-300 font-extrabold">{tenant.name}</span> ({tenant.domain})
          </span>
          <span className="hidden lg:inline text-[10px] bg-white/20 px-2 py-0.5 rounded font-mono">
            Plano: {tenant.plan}
          </span>
        </div>

        <button
          onClick={onExit}
          className="bg-[#020617] hover:bg-slate-900 text-slate-100 text-xs px-3 py-1.5 rounded-lg font-bold flex items-center gap-2 transition border border-indigo-400/40 shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Encerrar Impersonificação
        </button>
      </div>

      {/* Render Workspace da Operação do Tenant */}
      <div className="flex-1">
        <TenantWorkspace tenant={tenant} onExitImpersonation={onExit} />
      </div>

    </div>
  );
};

