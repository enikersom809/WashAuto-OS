import React from 'react';
import { 
  DollarSign, 
  Building2, 
  Users, 
  TrendingUp, 
  TrendingDown, 
  Filter, 
  PlusCircle, 
  LogIn, 
  Pencil,
  ArrowRight,
  ShieldAlert,
  Activity
} from 'lucide-react';
import { Tenant, Plan } from '../types';

interface OverviewSectionProps {
  tenants: Tenant[];
  plans: Plan[];
  onOpenNewTenantModal: () => void;
  onEditTenant: (tenant: Tenant) => void;
  onImpersonateTenant: (tenant: Tenant) => void;
  onNavigateToTenants: () => void;
  onNavigateToPlans: () => void;
}

export const OverviewSection: React.FC<OverviewSectionProps> = ({
  tenants,
  plans,
  onOpenNewTenantModal,
  onEditTenant,
  onImpersonateTenant,
  onNavigateToTenants,
  onNavigateToPlans
}) => {
  // Calculate dynamic metrics from state
  const totalMrr = tenants.reduce((acc, t) => t.status === 'Ativo' ? acc + t.mrrAmount : acc, 0);
  const activeTenantsCount = tenants.filter(t => t.status === 'Ativo').length;
  const totalEndUsers = tenants.reduce((acc, t) => acc + t.endUsersCount, 0);
  const overdueTenantsCount = tenants.filter(t => t.status === 'Inadimplente').length;

  const formattedMrr = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    totalMrr
  );

  return (
    <div className="space-y-6">

      {/* ================= CARDS DE MÉTRICAS ================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* MRR */}
        <div className="bg-[#0f172a] p-5 rounded-xl border border-[#1e293b] hover:border-slate-700/80 transition">
          <p className="text-[10px] uppercase font-bold text-slate-500 mb-1 tracking-wider">MRR Atual</p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold text-[#f8fafc]">{formattedMrr}</p>
            <p className="text-[11px] text-slate-400 font-bold flex items-center gap-0.5">
              0%
            </p>
          </div>
          <p className="text-[11px] text-slate-500 mt-1 font-medium">vs. R$ 0,00 no mês anterior</p>
        </div>

        {/* Total de Tenants */}
        <div className="bg-[#0f172a] p-5 rounded-xl border border-[#1e293b] hover:border-slate-700/80 transition">
          <p className="text-[10px] uppercase font-bold text-slate-500 mb-1 tracking-wider">Empresas Ativas</p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold text-[#f8fafc]">{tenants.length}</p>
          </div>
          <p className="text-[11px] text-slate-500 mt-1 font-medium">{activeTenantsCount} ativas · {overdueTenantsCount} pendentes</p>
        </div>

        {/* Clientes Finais */}
        <div className="bg-[#0f172a] p-5 rounded-xl border border-[#1e293b] hover:border-slate-700/80 transition">
          <p className="text-[10px] uppercase font-bold text-slate-500 mb-1 tracking-wider">Usuários Finais</p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold text-[#f8fafc]">{totalEndUsers.toLocaleString('pt-BR')}</p>
          </div>
          <p className="text-[11px] text-slate-500 mt-1 font-medium">Em todas as empresas cadastradas</p>
        </div>

        {/* Churn Rate */}
        <div className="bg-[#0f172a] p-5 rounded-xl border border-[#1e293b] hover:border-slate-700/80 transition">
          <p className="text-[10px] uppercase font-bold text-slate-500 mb-1 tracking-wider">Churn Rate</p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold text-[#f8fafc]">0.0%</p>
            <p className="text-[11px] text-slate-400 font-bold flex items-center gap-0.5">
              0%
            </p>
          </div>
          <p className="text-[11px] text-slate-500 mt-1 font-medium">Sem cancelamentos no período</p>
        </div>

      </div>

      {/* ================= GRÁFICOS E DISTRIBUIÇÃO ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Desempenho de Receita MRR */}
        <div className="lg:col-span-2 bg-[#0f172a] border border-[#1e293b] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-[#f8fafc]">Crescimento de MRR & Projeção</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Evolução mensal dos contratos SaaS em 2026</p>
            </div>
            <span className="text-[10px] font-bold text-slate-400 bg-slate-800 border border-slate-700 px-2.5 py-0.5 rounded-full">
              Início Zerado
            </span>
          </div>

          {/* Mini Chart SVG area */}
          <div className="h-52 w-full flex flex-col justify-end pt-4 pb-2">
            <div className="flex-1 w-full relative flex items-end justify-between gap-2 px-2">
              {/* Grid Lines */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
                <div className="border-b border-[#1e293b] w-full" />
                <div className="border-b border-[#1e293b] w-full" />
                <div className="border-b border-[#1e293b] w-full" />
              </div>

              {[
                { month: 'Jan', value: 0, height: '4%' },
                { month: 'Fev', value: 0, height: '4%' },
                { month: 'Mar', value: 0, height: '4%' },
                { month: 'Abr', value: 0, height: '4%' },
                { month: 'Mai', value: 0, height: '4%' },
                { month: 'Jun', value: 0, height: '4%' },
                { month: 'Jul', value: totalMrr, height: totalMrr > 0 ? '50%' : '4%', active: true }
              ].map((item, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2 group relative z-10">
                  {/* Tooltip on hover */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-9 bg-[#020617] text-slate-200 text-[10px] font-bold py-1 px-2 rounded shadow-xl border border-[#1e293b] pointer-events-none whitespace-nowrap z-20">
                    R$ {item.value.toLocaleString('pt-BR')}
                  </div>

                  {/* Bar */}
                  <div className="w-full max-w-[36px] bg-[#020617] rounded-t-md h-full flex items-end overflow-hidden">
                    <div 
                      className={`w-full rounded-t-md transition-all duration-500 ${
                        item.active 
                          ? 'bg-indigo-600 shadow-lg shadow-indigo-600/30' 
                          : 'bg-slate-800 group-hover:bg-indigo-600/60'
                      }`} 
                      style={{ height: item.height }}
                    />
                  </div>
                  <span className={`text-[11px] font-bold ${item.active ? 'text-indigo-400' : 'text-slate-500'}`}>
                    {item.month}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Distribuição de Planos */}
        <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-[#f8fafc]">Distribuição por Plano</h3>
              <button onClick={onNavigateToPlans} className="text-[11px] font-bold text-indigo-400 hover:underline flex items-center gap-1">
                Ver Planos <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-4">
              {plans.map((p) => {
                const count = tenants.filter(t => t.plan === p.name).length;
                const percent = Math.round((count / (tenants.length || 1)) * 100);
                return (
                  <div key={p.id} className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-slate-200">{p.displayName}</span>
                      <span className="text-slate-400 font-medium">{count} empresas ({percent}%)</span>
                    </div>
                    <div className="w-full bg-[#020617] h-2 rounded-full overflow-hidden border border-[#1e293b]/50">
                      <div 
                        className={`h-full rounded-full ${
                          p.name === 'Enterprise' ? 'bg-purple-500' :
                          p.name === 'Pro' ? 'bg-indigo-500' : 'bg-slate-500'
                        }`}
                        style={{ width: `${Math.max(percent, 8)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-[#1e293b] flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5 text-amber-400 font-semibold text-[11px]">
              <ShieldAlert className="w-4 h-4" /> 1 Tenant Inadimplente
            </span>
            <button onClick={onNavigateToTenants} className="text-indigo-400 hover:text-indigo-300 font-bold text-[11px]">
              Gerenciar
            </button>
          </div>
        </div>

      </div>

      {/* ================= TABELA DE TENANTS ================= */}
      <div className="bg-[#0f172a] rounded-xl border border-[#1e293b] overflow-hidden">
        
        {/* Cabeçalho da Tabela */}
        <div className="p-5 border-b border-[#1e293b] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="font-bold text-[#f8fafc]">Empresas Cadastradas (Tenants)</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">Visão consolidada do banco de clientes SaaS</p>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={onNavigateToTenants} 
              className="bg-[#020617] border border-[#1e293b] hover:bg-slate-900 text-slate-300 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition"
            >
              <Filter className="w-3.5 h-3.5" /> Filtrar Lista
            </button>
            <button 
              onClick={onOpenNewTenantModal} 
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-sm shadow-indigo-600/30"
            >
              <PlusCircle className="w-4 h-4" /> Nova Empresa
            </button>
          </div>
        </div>

        {/* Tabela */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#020617]/40 text-[11px] uppercase text-slate-500 font-bold">
              <tr>
                <th className="text-left px-6 py-4">Tenant</th>
                <th className="text-left px-4 py-4">Plano</th>
                <th className="text-left px-4 py-4">Status</th>
                <th className="text-left px-4 py-4">Usuários</th>
                <th className="text-right px-6 py-4">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e293b]/50 text-slate-200">
              {tenants.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-400">
                    <Building2 className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-300">Nenhuma empresa cadastrada no SaaS ainda.</p>
                    <p className="text-[11px] text-slate-500 mt-1">Clique no botão "<strong>+ Nova Empresa</strong>" para cadastrar e testar do zero.</p>
                  </td>
                </tr>
              ) : (
                tenants.slice(0, 5).map((tenant) => {
                const isEnterprise = tenant.plan === 'Enterprise';
                const isPro = tenant.plan === 'Pro';

                return (
                  <tr key={tenant.id} className="hover:bg-slate-800/20 transition">
                    <td className="px-6 py-4 flex items-center gap-3">
                      <div className={`w-9 h-9 rounded flex items-center justify-center font-bold text-xs ${
                        tenant.status === 'Inadimplente' ? 'bg-rose-500/10 border border-rose-500/20 text-rose-400' :
                        tenant.status === 'Suspenso' ? 'bg-slate-500/10 border border-slate-500/20 text-slate-400' :
                        tenant.status === 'Trial' ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400' :
                        'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                      }`}>
                        {tenant.code}
                      </div>
                      <div>
                        <p className="font-semibold text-[#f8fafc]">{tenant.name}</p>
                        <p className="text-[11px] text-slate-500">{tenant.domain}</p>
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        isEnterprise ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                        isPro ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                        'bg-slate-500/10 text-slate-400 border-slate-500/20'
                      }`}>
                        {tenant.plan}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      {tenant.status === 'Ativo' && (
                        <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Ativo
                        </span>
                      )}
                      {tenant.status === 'Inadimplente' && (
                        <span className="flex items-center gap-1.5 text-xs font-medium text-rose-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span> Inadimplente
                        </span>
                      )}
                      {tenant.status === 'Trial' && (
                        <span className="flex items-center gap-1.5 text-xs font-medium text-amber-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span> Trial
                        </span>
                      )}
                      {tenant.status === 'Suspenso' && (
                        <span className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span> Suspenso
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-4 text-slate-400 font-medium">
                      {tenant.endUsersCount.toLocaleString('pt-BR')}
                    </td>

                    <td className="px-6 py-4 text-right space-x-3">
                      <button 
                        onClick={() => onImpersonateTenant(tenant)} 
                        className="text-slate-500 hover:text-indigo-400 text-xs font-medium transition" 
                        title="Acessar como admin"
                      >
                        Acessar
                      </button>
                      <button 
                        onClick={() => onEditTenant(tenant)} 
                        className="text-slate-500 hover:text-white text-xs font-medium transition" 
                        title="Editar Empresa"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                );
              }))}
            </tbody>
          </table>
        </div>

        {/* Rodapé da Tabela */}
        <div className="p-4 border-t border-[#1e293b] flex items-center justify-between text-[11px] text-slate-500 font-bold">
          <p>Mostrando {Math.min(5, tenants.length)} de {tenants.length} tenants</p>
          <button 
            onClick={onNavigateToTenants}
            className="text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1"
          >
            Ver todas as empresas <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>

    </div>
  );
};
