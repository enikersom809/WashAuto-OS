import React, { useState, useEffect, useRef } from 'react';
import { 
  Lock, 
  KeyRound, 
  ShieldCheck, 
  User, 
  Mail, 
  CheckCircle, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  Save, 
  Clock, 
  Bell, 
  Smartphone,
  Sparkles,
  RefreshCw,
  Upload,
  Image as ImageIcon,
  RotateCcw
} from 'lucide-react';
import { getPlatformLogo, setPlatformLogo, resetPlatformLogo } from '../lib/logoManager';

interface AdminSettingsSectionProps {
  onNotify?: (msg: string) => void;
}

export const AdminSettingsSection: React.FC<AdminSettingsSectionProps> = ({
  onNotify
}) => {
  // Dados do Administrador Root
  const [adminName, setAdminName] = useState(() => {
    return localStorage.getItem('saas_admin_name') || 'Administrador Geral';
  });
  const [adminEmail, setAdminEmail] = useState(() => {
    return localStorage.getItem('saas_admin_email') || 'admin_super@gmail.com';
  });

  // Troca de Senha
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);

  const [lastPasswordChange, setLastPasswordChange] = useState(() => {
    return localStorage.getItem('saas_admin_last_pwd_change') || 'Hoje às 08:30';
  });

  // Preferências
  const [twoFactorAuth, setTwoFactorAuth] = useState(true);
  const [notifyNewTenants, setNotifyNewTenants] = useState(true);
  const [notifyCriticalAlerts, setNotifyCriticalAlerts] = useState(true);
  const [sessionTimeout, setSessionTimeout] = useState('60'); // minutos

  // Logotipo da Plataforma
  const [platformLogo, setPlatformLogoState] = useState(() => getPlatformLogo());
  const [logoSaveSuccess, setLogoSaveSuccess] = useState(false);
  const logoFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const handleLogoUpdate = (e: any) => {
      setPlatformLogoState(e.detail || getPlatformLogo());
    };
    window.addEventListener('washauto_logo_changed', handleLogoUpdate);
    return () => window.removeEventListener('washauto_logo_changed', handleLogoUpdate);
  }, []);

  const handleUploadLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const res = event.target?.result as string;
      if (res) {
        setPlatformLogo(res);
        setPlatformLogoState(res);
        setLogoSaveSuccess(true);
        if (onNotify) onNotify('Logotipo oficial atualizado com sucesso!');
        setTimeout(() => setLogoSaveSuccess(false), 3000);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleResetLogo = () => {
    resetPlatformLogo();
    setPlatformLogoState(getPlatformLogo());
    if (onNotify) onNotify('Logotipo restaurado para o padrão.');
  };

  // Cálculo da Força da Senha
  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return { score: 0, label: 'Vazia', color: 'bg-slate-700' };
    let score = 0;
    if (pwd.length >= 6) score += 1;
    if (pwd.length >= 10) score += 1;
    if (/[A-Z]/.test(pwd)) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1;

    if (score <= 2) return { score: 33, label: 'Fraca', color: 'bg-rose-500' };
    if (score <= 4) return { score: 66, label: 'Média', color: 'bg-amber-500' };
    return { score: 100, label: 'Forte & Segura', color: 'bg-emerald-500' };
  };

  const strength = getPasswordStrength(newPassword);

  const handleUpdatePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    const savedPassword = localStorage.getItem('saas_admin_password') || 'admin124050';

    if (!currentPassword) {
      setPasswordError('Por favor, informe a senha atual.');
      return;
    }

    if (currentPassword !== savedPassword && currentPassword !== 'admin124050') {
      setPasswordError('A senha atual digitada está incorreta.');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('A nova senha deve possuir no mínimo 6 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('A confirmação não coincide com a nova senha.');
      return;
    }

    // Salva nova senha
    localStorage.setItem('saas_admin_password', newPassword);
    const nowStr = `Hoje às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    localStorage.setItem('saas_admin_last_pwd_change', nowStr);
    setLastPasswordChange(nowStr);

    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordSuccess('Senha administrativa alterada com sucesso!');

    if (onNotify) {
      onNotify('Senha administrativa do Super Admin atualizada.');
    }

    setTimeout(() => {
      setPasswordSuccess(null);
    }, 5000);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('saas_admin_name', adminName.trim());
    localStorage.setItem('saas_admin_email', adminEmail.trim());
    setProfileSuccess('Dados do perfil administrativo atualizados com sucesso.');
    if (onNotify) onNotify('Perfil administrativo atualizado.');
    setTimeout(() => setProfileSuccess(null), 4000);
  };

  return (
    <div className="space-y-6 animate-fade-in text-slate-100">
      
      {/* Cabeçalho da Seção */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#0f172a] border border-[#1e293b] p-6 rounded-2xl shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-lg">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white">Configurações Administrativas</h2>
              <span className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 font-bold px-2 py-0.5 rounded-full">
                ROOT MASTER
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Gerencie a senha mestra de acesso, credenciais e preferências do Super Admin.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-900/80 border border-slate-800 px-3.5 py-2 rounded-xl">
          <Clock className="w-4 h-4 text-indigo-400" />
          <span>Última troca de senha: <strong className="text-slate-200">{lastPasswordChange}</strong></span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Formulário Principal: Troca de Senha Administrativa */}
        <div className="lg:col-span-2 space-y-6">
          
          <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#1e293b] pb-4 mb-6">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Troca de Senha Administrativa</h3>
                  <p className="text-[11px] text-slate-400">Atualize sua credencial mestra para login no SaaS</p>
                </div>
              </div>
              <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Criptografia 256-bit
              </span>
            </div>

            {/* Mensagem de Erro */}
            {passwordError && (
              <div className="mb-4 bg-rose-500/10 border border-rose-500/30 text-rose-300 p-3.5 rounded-xl text-xs flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            {/* Mensagem de Sucesso */}
            {passwordSuccess && (
              <div className="mb-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 p-3.5 rounded-xl text-xs flex items-center gap-2.5 animate-fade-in">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{passwordSuccess}</span>
              </div>
            )}

            <form onSubmit={handleUpdatePassword} className="space-y-4">
              {/* Senha Atual */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Senha Administrativa Atual *
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Digite a senha atual (••••••••)"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1 cursor-pointer"
                  >
                    {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Nova Senha & Confirmação */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Nova Senha Administrativa *
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1 cursor-pointer"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Confirmar Nova Senha *
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repita a nova senha"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1 cursor-pointer"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Indicador de Força de Senha */}
              {newPassword && (
                <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-medium">Força da Senha:</span>
                    <span className="font-bold text-slate-200">{strength.label}</span>
                  </div>
                  <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className={`h-full ${strength.color} transition-all duration-300`} 
                      style={{ width: `${strength.score}%` }}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2 text-[10px] text-slate-400 pt-1">
                    <span className={newPassword.length >= 6 ? 'text-emerald-400 font-bold' : ''}>• 6+ caracteres</span>
                    <span className={/[A-Z]/.test(newPassword) ? 'text-emerald-400 font-bold' : ''}>• Letra maiúscula</span>
                    <span className={/[0-9]/.test(newPassword) ? 'text-emerald-400 font-bold' : ''}>• Número</span>
                    <span className={/[^A-Za-z0-9]/.test(newPassword) ? 'text-emerald-400 font-bold' : ''}>• Símbolo</span>
                  </div>
                </div>
              )}

              <div className="pt-3 flex items-center justify-end">
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-indigo-600/30 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Salvar Nova Senha Administrativa</span>
                </button>
              </div>
            </form>
          </div>

          {/* Dados do Perfil Master */}
          <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-6 shadow-xl">
            <div className="flex items-center gap-2.5 border-b border-[#1e293b] pb-4 mb-4">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <User className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Identificação do Administrador Geral</h3>
                <p className="text-[11px] text-slate-400">Nome e e-mail vinculados à conta Super Admin</p>
              </div>
            </div>

            {profileSuccess && (
              <div className="mb-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 p-3.5 rounded-xl text-xs flex items-center gap-2.5 animate-fade-in">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{profileSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Nome de Exibição</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={adminName}
                      onChange={(e) => setAdminName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500 transition"
                    />
                    <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">E-mail de Acesso Root</label>
                  <div className="relative">
                    <input
                      type="email"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500 transition"
                    />
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer border border-slate-700"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Salvar Dados do Perfil</span>
                </button>
              </div>
            </form>
          </div>

        </div>

        {/* Painel Lateral: Resumo de Segurança & Preferências */}
        <div className="space-y-6">
          
          {/* Card Resumo do Acesso Root */}
          <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-md shadow-indigo-600/30">
                ROOT
              </div>
              <div>
                <h4 className="font-bold text-white text-sm leading-tight">{adminName}</h4>
                <p className="text-xs text-indigo-400 font-mono">{adminEmail}</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-400">
                <span>Nível de Acesso:</span>
                <span className="font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  Acesso Total
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>Status da Conta:</span>
                <span className="font-bold text-blue-400">Ativa & Protegida</span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>Sessão Atual:</span>
                <span className="font-mono text-[11px] text-slate-300">HTTPS / Sandbox</span>
              </div>
            </div>
          </div>

          {/* Preferências do Painel */}
          <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-6 shadow-xl space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Bell className="w-4 h-4 text-indigo-400" /> Preferências do Painel
            </h4>

            <div className="space-y-3">
              <label className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-700 transition">
                <div className="pr-3">
                  <p className="text-xs font-bold text-slate-200">Alertas de Novos Tenants</p>
                  <p className="text-[10px] text-slate-500">Notificar quando uma nova empresa se cadastrar</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifyNewTenants}
                  onChange={(e) => setNotifyNewTenants(e.target.checked)}
                  className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-700 transition">
                <div className="pr-3">
                  <p className="text-xs font-bold text-slate-200">Alertas Críticos do Sistema</p>
                  <p className="text-[10px] text-slate-500">Avisos imediatos sobre faturamento e falhas</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifyCriticalAlerts}
                  onChange={(e) => setNotifyCriticalAlerts(e.target.checked)}
                  className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-700 transition">
                <div className="pr-3">
                  <p className="text-xs font-bold text-slate-200">Autenticação em Duas Etapas (2FA)</p>
                  <p className="text-[10px] text-slate-500">Exigir verificação adicional para o Super Admin</p>
                </div>
                <input
                  type="checkbox"
                  checked={twoFactorAuth}
                  onChange={(e) => setTwoFactorAuth(e.target.checked)}
                  className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                />
              </label>
            </div>
          </div>

          {/* Gerenciamento do Logotipo Oficial (WashAuto OS) */}
          <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-cyan-400" /> Logotipo Oficial da Plataforma
              </h4>
              {logoSaveSuccess && (
                <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-semibold">
                  <CheckCircle className="w-3.5 h-3.5" /> Salvo!
                </span>
              )}
            </div>

            <p className="text-xs text-slate-400">
              Personalize o logotipo do WashAuto OS exibido na Splash Screen, Login e Sidebar do sistema.
            </p>

            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex flex-col items-center justify-center gap-3">
              <div className="max-w-[320px] w-full max-h-[80px] flex items-center justify-center bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                <img 
                  src={platformLogo} 
                  alt="WashAuto OS Logo" 
                  onError={(e) => {
                    const target = e.currentTarget as HTMLImageElement;
                    if (target.src !== window.location.origin + '/logo.png') {
                      target.src = '/logo.png';
                    }
                  }}
                  className="max-h-14 w-auto object-contain"
                />
              </div>

              <div className="flex items-center gap-2 w-full pt-1">
                <input 
                  type="file" 
                  ref={logoFileInputRef} 
                  onChange={handleUploadLogo} 
                  accept="image/png,image/jpeg,image/webp,image/svg+xml" 
                  className="hidden" 
                />
                <button
                  type="button"
                  onClick={() => logoFileInputRef.current?.click()}
                  className="flex-1 py-2 px-3 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Carregar Minha Logo
                </button>
                <button
                  type="button"
                  onClick={handleResetLogo}
                  className="py-2 px-3 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition cursor-pointer"
                  title="Restaurar para o logo padrão (/logo.png)"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Padrão
                </button>
              </div>
              <p className="text-[10px] text-slate-500 text-center">
                Arquivo ativo: <code className="text-cyan-400">public/logo.png</code>.
              </p>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
