import React, { useState } from 'react';
import { 
  CreditCard, 
  Check, 
  Plus, 
  Pencil, 
  Trash2,
  Download, 
  DollarSign, 
  TrendingUp, 
  Receipt, 
  X,
  Building2,
  AlertTriangle
} from 'lucide-react';
import { Plan, Invoice, Tenant } from '../types';

interface PlansSectionProps {
  plans: Plan[];
  invoices: Invoice[];
  tenants: Tenant[];
  onUpdatePlan: (updatedPlan: Plan) => void;
  onAddPlan: (newPlan: Plan) => void;
  onDeletePlan?: (planId: string) => void;
}

export const PlansSection: React.FC<PlansSectionProps> = ({
  plans,
  invoices,
  tenants,
  onUpdatePlan,
  onAddPlan,
  onDeletePlan
}) => {
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [showAddPlanModal, setShowAddPlanModal] = useState<boolean>(false);
  const [planToDelete, setPlanToDelete] = useState<Plan | null>(null);

  // New Plan form state
  const [newPlanName, setNewPlanName] = useState<string>('');
  const [newPlanPrice, setNewPlanPrice] = useState<number>(299);
  const [newPlanMaxUsers, setNewPlanMaxUsers] = useState<number>(200);
  const [newPlanFeatures, setNewPlanFeatures] = useState<string>('Suporte 24/7, Analytics, API Access');

  // Revenue Metrics
  const totalBilled = invoices.reduce((acc, inv) => inv.status === 'Pago' ? acc + inv.amount : acc, 0);
  const activeTenantsCount = tenants.filter(t => t.status === 'Ativo').length || 1;
  const arpu = Math.round(totalBilled / activeTenantsCount);

  const handleSavePlanEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingPlan) {
      onUpdatePlan(editingPlan);
      setEditingPlan(null);
    }
  };

  const handleCreatePlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlanName) return;

    const created: Plan = {
      id: `plan-${Date.now()}`,
      name: 'Custom',
      displayName: newPlanName,
      priceMonthly: newPlanPrice,
      maxUsers: newPlanMaxUsers,
      features: newPlanFeatures.split(',').map(f => f.trim()).filter(Boolean),
      activeTenantsCount: 0
    };

    onAddPlan(created);
    setShowAddPlanModal(false);
    setNewPlanName('');
  };

  return (
    <div className="space-y-6">

      {/* Header Finanças */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0f172a] border border-[#1e293b] rounded-xl p-5">
        <div>
          <h2 className="text-lg font-bold text-[#f8fafc] flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-indigo-400" />
            Planos de Assinatura & Faturamento
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Configure os preços, recursos inclusos e acompanhe o histórico de faturas geradas.
          </p>
        </div>

        <button
          onClick={() => setShowAddPlanModal(true)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition shadow-sm shadow-indigo-600/30"
        >
          <Plus className="w-4 h-4" /> Criar Novo Plano
        </button>
      </div>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-5">
          <div className="flex justify-between items-center text-slate-400 mb-1 text-[11px]">
            <span>Receita Processada (Mês Atual)</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="text-2xl font-bold text-[#f8fafc]">
            R$ {totalBilled.toLocaleString('pt-BR')}
          </span>
          <p className="text-[11px] text-slate-500 mt-1">Faturas pagas via Gateway</p>
        </div>

        <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-5">
          <div className="flex justify-between items-center text-slate-400 mb-1 text-[11px]">
            <span>ARPU (Ticket Médio por Tenant)</span>
            <TrendingUp className="w-4 h-4 text-indigo-400" />
          </div>
          <span className="text-2xl font-bold text-[#f8fafc]">
            R$ {arpu.toLocaleString('pt-BR')}
          </span>
          <p className="text-[11px] text-slate-500 mt-1">Em contas ativas no momento</p>
        </div>

        <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-5">
          <div className="flex justify-between items-center text-slate-400 mb-1 text-[11px]">
            <span>Taxa de Sucesso em Cobranças</span>
            <Receipt className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="text-2xl font-bold text-slate-200">
            {invoices.length > 0 ? '100%' : '0.0%'}
          </span>
          <p className="text-[11px] text-slate-500 mt-1">
            {invoices.length > 0 ? 'Processamento automatizado' : 'Nenhuma cobrança registrada ainda'}
          </p>
        </div>
      </div>

      {/* Plan Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.length === 0 ? (
          <div className="col-span-full bg-slate-950 border border-dashed border-slate-800 rounded-2xl p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto mb-4 border border-indigo-500/20">
              <CreditCard className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-200 mb-1">Nenhum plano cadastrado</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mb-6">
              Não há planos de assinatura disponíveis no momento. Você pode criar um novo plano personalizado agora.
            </p>
            <button
              onClick={() => setShowAddPlanModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition shadow-lg shadow-indigo-600/30 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Criar Primeiro Plano
            </button>
          </div>
        ) : (
          plans.map((plan) => {
            const tenantsOnPlan = tenants.filter(t => t.plan === plan.name).length;

            return (
              <div
                key={plan.id}
                className={`bg-slate-950 border rounded-xl p-6 flex flex-col justify-between relative transition hover:border-slate-700 ${
                  plan.isPopular ? 'border-indigo-500 shadow-xl shadow-indigo-500/10' : 'border-slate-800'
                }`}
              >
                {plan.isPopular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[10px] uppercase font-bold tracking-wider px-3 py-0.5 rounded-full shadow">
                    Mais Popular
                  </span>
                )}

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-bold text-slate-100">{plan.displayName}</h3>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setEditingPlan(plan)}
                        className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-900 rounded-lg transition cursor-pointer"
                        title="Editar Plano"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setPlanToDelete(plan)}
                        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition cursor-pointer"
                        title="Excluir Plano"
                        aria-label={`Excluir ${plan.displayName}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mb-4">
                    <span className="text-3xl font-extrabold text-slate-100">
                      R$ {plan.priceMonthly}
                    </span>
                    <span className="text-xs text-slate-500"> /mês</span>
                  </div>

                  <div className="bg-slate-900/60 rounded-lg p-2.5 mb-5 flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                      {tenantsOnPlan} Empresas assinantes
                    </span>
                    <span className="font-semibold text-slate-300">
                      Até {plan.maxUsers} usuários
                    </span>
                  </div>

                  {/* Features list */}
                  <div className="space-y-2.5 mb-6">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Recursos Inclusos:
                    </p>
                    {plan.features.map((feat, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs text-slate-300">
                        <Check className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-slate-900 mt-2">
                  <button
                    onClick={() => setEditingPlan(plan)}
                    className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 hover:border-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer text-center"
                  >
                    Editar Valores & Limites
                  </button>
                  <button
                    onClick={() => setPlanToDelete(plan)}
                    className="p-2 bg-slate-900 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-500/30 rounded-lg text-xs font-medium transition cursor-pointer flex items-center justify-center"
                    title="Excluir Plano"
                    aria-label={`Excluir ${plan.displayName}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Histórico de Faturas Geradas */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-100">Histórico de Faturas SaaS</h3>
            <p className="text-xs text-slate-400 mt-0.5">Cobranças geradas automaticamente no gateway</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/60 text-xs uppercase text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-6">ID Fatura</th>
                <th className="py-3.5 px-4">Empresa</th>
                <th className="py-3.5 px-4">Plano</th>
                <th className="py-3.5 px-4">Valor</th>
                <th className="py-3.5 px-4">Vencimento</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-6 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-900/40 transition">
                  <td className="py-3.5 px-6 font-mono text-xs text-indigo-400 font-semibold">
                    {inv.id}
                  </td>
                  <td className="py-3.5 px-4 font-medium text-slate-200">
                    {inv.tenantName}
                  </td>
                  <td className="py-3.5 px-4 text-xs text-slate-400">
                    {inv.planName}
                  </td>
                  <td className="py-3.5 px-4 font-mono font-semibold text-slate-200">
                    R$ {inv.amount.toLocaleString('pt-BR')}
                  </td>
                  <td className="py-3.5 px-4 text-xs text-slate-400">
                    {inv.dueDate}
                  </td>
                  <td className="py-3.5 px-4">
                    {inv.status === 'Pago' && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Pago
                      </span>
                    )}
                    {inv.status === 'Vencido' && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        Vencido
                      </span>
                    )}
                    {inv.status === 'Pendente' && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        Pendente
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-6 text-right">
                    <button
                      onClick={() => console.log(`Recibo ${inv.id} baixado em formato PDF.`)}
                      className="text-slate-400 hover:text-indigo-400 p-1.5 transition"
                      title="Baixar Comprovante"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Editar Plano */}
      {editingPlan && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleSavePlanEdit} className="bg-slate-950 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setEditingPlan(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-slate-100">
              Editar {editingPlan.displayName}
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Nome de Exibição</label>
                <input
                  type="text"
                  value={editingPlan.displayName}
                  onChange={(e) => setEditingPlan({ ...editingPlan, displayName: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Preço Mensal (R$)</label>
                <input
                  type="number"
                  value={editingPlan.priceMonthly}
                  onChange={(e) => setEditingPlan({ ...editingPlan, priceMonthly: Number(e.target.value) })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Limite Máximo de Usuários</label>
                <input
                  type="number"
                  value={editingPlan.maxUsers}
                  onChange={(e) => setEditingPlan({ ...editingPlan, maxUsers: Number(e.target.value) })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
            </div>

            <div className="pt-4 flex items-center justify-between border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  const targetPlan = editingPlan;
                  setEditingPlan(null);
                  setPlanToDelete(targetPlan);
                }}
                className="px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" /> Excluir Plano
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingPlan(null)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg text-xs font-medium transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
                >
                  Salvar Alterações
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Modal de Confirmação para Excluir Plano */}
      {planToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-rose-500/40 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl relative animate-in fade-in zoom-in-95">
            <button
              onClick={() => setPlanToDelete(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-rose-500/20 pb-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Excluir Plano</h3>
                <p className="text-[11px] text-rose-400 font-medium">Esta ação removerá o plano do catálogo</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <p>Tem certeza que deseja excluir permanentemente o seguinte plano?</p>

              <div className="bg-[#020617] border border-slate-800 rounded-xl p-3.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-100 text-sm">{planToDelete.displayName}</span>
                  <span className="text-xs font-mono font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                    R$ {planToDelete.priceMonthly}/mês
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-900">
                  <span>Limite de usuários: <strong>{planToDelete.maxUsers}</strong></span>
                  <span>Recursos: <strong>{planToDelete.features.length}</strong></span>
                </div>
              </div>

              {tenants.filter(t => t.plan === planToDelete.name).length > 0 ? (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-[11px] leading-relaxed flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong>Atenção:</strong> Existem <strong>{tenants.filter(t => t.plan === planToDelete.name).length} empresa(s)</strong> vinculadas a este plano. Elas permanecerão operando normalmente, mas este plano deixará de existir para novas contratações.
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 text-[11px] leading-relaxed">
                  ℹ️ Nenhuma empresa ativa está utilizando este plano no momento. O plano será excluído com segurança.
                </div>
              )}
            </div>

            <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setPlanToDelete(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeletePlan) {
                    onDeletePlan(planToDelete.id);
                  }
                  setPlanToDelete(null);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-rose-600/30 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" /> Sim, Excluir Plano
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Criar Novo Plano */}
      {showAddPlanModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleCreatePlan} className="bg-slate-950 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setShowAddPlanModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-slate-100">Criar Novo Plano Customizado</h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Nome do Plano</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Plano Growth"
                  value={newPlanName}
                  onChange={(e) => setNewPlanName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Preço Mensal (R$)</label>
                <input
                  type="number"
                  required
                  value={newPlanPrice}
                  onChange={(e) => setNewPlanPrice(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Limite de Usuários</label>
                <input
                  type="number"
                  required
                  value={newPlanMaxUsers}
                  onChange={(e) => setNewPlanMaxUsers(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Recursos (separados por vírgula)</label>
                <textarea
                  rows={3}
                  value={newPlanFeatures}
                  onChange={(e) => setNewPlanFeatures(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>
            </div>

            <div className="pt-4 flex justify-end gap-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowAddPlanModal(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg text-xs font-medium transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition"
              >
                Criar Plano
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};
