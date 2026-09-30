import React, { useState } from 'react';
import { 
  ShieldCheck, 
  UserPlus, 
  Lock, 
  Key, 
  Globe, 
  CheckCircle2, 
  X,
  Shield,
  Trash2
} from 'lucide-react';
import { SuperAdminUser, SecuritySetting, AdminRole } from '../types';

interface SecuritySectionProps {
  superAdmins: SuperAdminUser[];
  securitySettings: SecuritySetting[];
  onToggleSecuritySetting: (settingId: string) => void;
  onInviteSuperAdmin: (user: SuperAdminUser) => void;
  onRemoveSuperAdmin: (userId: string) => void;
}

export const SecuritySection: React.FC<SecuritySectionProps> = ({
  superAdmins,
  securitySettings,
  onToggleSecuritySetting,
  onInviteSuperAdmin,
  onRemoveSuperAdmin
}) => {
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<AdminRole>('ADMIN');

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newEmail) return;

    const initials = newName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'SA';

    const invited: SuperAdminUser = {
      id: `sa-${Date.now()}`,
      name: newName,
      email: newEmail,
      role: newRole,
      status: 'Ativo',
      lastLogin: 'Pendente primeiro acesso',
      avatarInitials: initials
    };

    onInviteSuperAdmin(invited);
    setShowInviteModal(false);
    setNewName('');
    setNewEmail('');
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0f172a] border border-[#1e293b] rounded-xl p-5">
        <div>
          <h2 className="text-lg font-bold text-[#f8fafc] flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-400" />
            Permissões de Acesso & Políticas de Segurança
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Gerencie a equipe de administradores globais (ROOT) e defina parâmetros rígidos de conformidade.
          </p>
        </div>

        <button
          onClick={() => setShowInviteModal(true)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition shadow-sm shadow-indigo-600/30"
        >
          <UserPlus className="w-4 h-4" /> Convidar Administrador
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Lista de Administradores do Painel Geral */}
        <div className="lg:col-span-2 bg-[#0f172a] border border-[#1e293b] rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#1e293b] pb-3">
            <div>
              <h3 className="text-base font-semibold text-[#f8fafc]">Equipe de Administração Geral</h3>
              <p className="text-xs text-slate-400">Usuários com autorização ROOT e privilégios elevados</p>
            </div>
            <span className="text-xs bg-indigo-500/10 text-indigo-400 px-2.5 py-1 rounded-full border border-indigo-500/20 font-bold">
              {superAdmins.length} Membros
            </span>
          </div>

          <div className="divide-y divide-[#1e293b]/60">
            {superAdmins.map((admin) => (
              <div key={admin.id} className="py-3.5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#020617] border border-[#1e293b] font-bold text-slate-200 flex items-center justify-center text-xs">
                    {admin.avatarInitials}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-200 text-sm flex items-center gap-2">
                      {admin.name}
                      {admin.role === 'ROOT' && (
                        <span className="text-[10px] bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-1.5 py-0.2 rounded font-bold">
                          ROOT
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">{admin.email}</div>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs">
                  <div className="hidden sm:block text-right">
                    <span className="text-slate-400 font-semibold block">{admin.role}</span>
                    <span className="text-slate-500 text-[11px]">{admin.lastLogin}</span>
                  </div>

                  {admin.role !== 'ROOT' && (
                    <button
                      onClick={() => onRemoveSuperAdmin(admin.id)}
                      className="text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 p-1.5 rounded transition cursor-pointer"
                      title="Revogar Acesso"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Toggles de Políticas de Segurança */}
        <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-5 space-y-4">
          <div className="border-b border-[#1e293b] pb-3">
            <h3 className="text-base font-semibold text-[#f8fafc] flex items-center gap-2">
              <Lock className="w-4 h-4 text-indigo-400" /> Políticas Ativas
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Definições globais de segurança</p>
          </div>

          <div className="space-y-4">
            {securitySettings.map((setting) => (
              <div key={setting.id} className="p-3 bg-[#020617]/60 rounded-xl border border-[#1e293b] space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-200 leading-snug">
                    {setting.title}
                  </span>
                  <button
                    onClick={() => onToggleSecuritySetting(setting.id)}
                    className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                      setting.enabled ? 'bg-indigo-600 justify-end' : 'bg-[#1e293b] justify-start'
                    }`}
                  >
                    <span className="w-4 h-4 rounded-full bg-white shadow-md transform transition-transform" />
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 leading-normal">
                  {setting.description}
                </p>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Modal Convidar Administrador */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleInviteSubmit} className="bg-slate-950 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setShowInviteModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Shield className="w-5 h-5 text-indigo-400" />
              Convidar Novo Administrador Geral
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Nome Completo</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Carlos Andrade"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">E-mail de Acesso</label>
                <input
                  type="email"
                  required
                  placeholder="carlos@saas.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Função / Nível de Acesso</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as AdminRole)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="ADMIN">ADMIN (Acesso Total)</option>
                  <option value="SUPORTE">SUPORTE (Atendimento & Impersonificação)</option>
                  <option value="AUDITOR">AUDITOR (Visualização de Logs)</option>
                </select>
              </div>
            </div>

            <div className="pt-4 flex justify-end gap-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg text-xs font-medium transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" /> Enviar Convite
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};
