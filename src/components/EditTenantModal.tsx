import React, { useState, useEffect } from 'react';
import { X, Pencil, Save, Trash2 } from 'lucide-react';
import { Tenant, PlanType, TenantStatus } from '../types';

interface EditTenantModalProps {
  tenant: Tenant | null;
  isOpen: boolean;
  onClose: () => void;
  onSaveTenant: (updatedTenant: Tenant) => void;
  onDeleteTenant?: (tenantId: string) => void;
}

export const EditTenantModal: React.FC<EditTenantModalProps> = ({
  tenant,
  isOpen,
  onClose,
  onSaveTenant,
  onDeleteTenant
}) => {
  const [formData, setFormData] = useState<Tenant | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<boolean>(false);

  useEffect(() => {
    setFormData(tenant);
    setConfirmDelete(false);
  }, [tenant]);

  if (!isOpen || !formData) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData) {
      onSaveTenant(formData);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-950 border border-slate-800 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-200"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <Pencil className="w-5 h-5 text-indigo-400" />
          <h2 className="text-lg font-bold text-slate-100">Editar Empresa: {formData.name}</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Nome da Empresa</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">Domínio / Subdomínio</label>
              <input
                type="text"
                required
                value={formData.domain}
                onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Plano</label>
              <select
                value={formData.plan}
                onChange={(e) => setFormData({ ...formData, plan: e.target.value as PlanType })}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="Basic">Basic</option>
                <option value="Pro">Pro</option>
                <option value="Enterprise">Enterprise</option>
                <option value="Custom">Custom</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">Status da Conta</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as TenantStatus })}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="Ativo">Ativo</option>
                <option value="Inadimplente">Inadimplente</option>
                <option value="Trial">Trial</option>
                <option value="Suspenso">Suspenso</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">E-mail de Contato</label>
              <input
                type="email"
                required
                value={formData.contactEmail}
                onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">Responsável Legal</label>
              <input
                type="text"
                value={formData.ownerName}
                onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Valor MRR (R$)</label>
              <input
                type="number"
                value={formData.mrrAmount}
                onChange={(e) => setFormData({ ...formData, mrrAmount: Number(e.target.value) })}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">Limite de Usuários</label>
              <input
                type="number"
                value={formData.maxUsers}
                onChange={(e) => setFormData({ ...formData, maxUsers: Number(e.target.value) })}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-medium">Observações Internas</label>
            <textarea
              rows={2}
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-indigo-500 resize-none"
              placeholder="Anotações para a equipe Root..."
            />
          </div>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-800">
            {onDeleteTenant && (
              confirmDelete ? (
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <span className="text-rose-400 font-bold text-xs">Excluir mesmo?</span>
                  <button
                    type="button"
                    onClick={() => {
                      onDeleteTenant(formData.id);
                      onClose();
                    }}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Sim, Excluir
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="px-2.5 py-1.5 bg-slate-900 text-slate-400 hover:text-slate-200 rounded-lg text-xs font-medium cursor-pointer"
                  >
                    Não
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer w-full sm:w-auto justify-center"
                >
                  <Trash2 className="w-4 h-4" /> Excluir Empresa
                </button>
              )
            )}

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg font-medium transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-indigo-600/30"
              >
                <Save className="w-4 h-4" /> Salvar Alterações
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
