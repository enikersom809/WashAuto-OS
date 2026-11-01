import React, { useState, useEffect, useRef } from 'react';
import { 
  Car, 
  Bike, 
  Sparkles, 
  User, 
  Phone, 
  Mail, 
  Lock, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft, 
  QrCode, 
  Smartphone, 
  Share2, 
  RefreshCw, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  Clock, 
  Key,
  X,
  AlertTriangle,
  RotateCcw
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Tenant } from '../types';
import { formatCelular, cleanDigits } from '../lib/formatters';
import { registerClientFromTotem } from '../lib/firebaseService';

interface TotemModeProps {
  tenant: Tenant;
  onExitTotem: () => void;
  customExitPin?: string;
}

export const TotemMode: React.FC<TotemModeProps> = ({
  tenant,
  onExitTotem,
  customExitPin = '1234'
}) => {
  // Steps: 1: Identificação, 2: Veículo, 3: Senha, 4: Sucesso & QR Code
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  
  // Veículo
  const [vehicleType, setVehicleType] = useState<'Carro' | 'SUV' | 'Picape' | 'Moto'>('Carro');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleColor, setVehicleColor] = useState('Prata');
  
  // Senha
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Status & Erros
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isExistingUser, setIsExistingUser] = useState(false);

  // Exit PIN Modal State (para o gerente sair do modo totem)
  const [showExitModal, setShowExitModal] = useState(false);
  const [exitPinInput, setExitPinInput] = useState('');
  const [exitPinError, setExitPinError] = useState(false);

  // Live Clock
  const [currentTime, setCurrentTime] = useState('');
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    };
    updateTime();
    const timer = setInterval(updateTime, 10000);
    return () => clearInterval(timer);
  }, []);

  // Countdown timer on Success screen (20s auto-reset)
  const [successCountdown, setSuccessCountdown] = useState(20);
  useEffect(() => {
    if (step !== 4) return;
    setSuccessCountdown(20);
    const interval = setInterval(() => {
      setSuccessCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleResetForm();
          return 20;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [step]);

  // Inactivity timeout: 60s idle on steps 1, 2, 3 resets form
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [showInactivityWarning, setShowInactivityWarning] = useState(false);
  const [inactivityCountdown, setInactivityCountdown] = useState(15);

  const resetInactivityTimer = () => {
    if (step === 4) return;
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    setShowInactivityWarning(false);

    inactivityTimerRef.current = setTimeout(() => {
      if (name.trim() || phone.trim() || email.trim() || vehicleModel.trim()) {
        setShowInactivityWarning(true);
        setInactivityCountdown(15);
      }
    }, 45000); // 45 segundos de inatividade
  };

  useEffect(() => {
    if (!showInactivityWarning) return;
    const interval = setInterval(() => {
      setInactivityCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleResetForm();
          return 15;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [showInactivityWarning]);

  // Monitora toques e movimentos na tela para resetar timer de inatividade
  useEffect(() => {
    const handleUserActivity = () => resetInactivityTimer();
    window.addEventListener('touchstart', handleUserActivity);
    window.addEventListener('mousedown', handleUserActivity);
    window.addEventListener('keydown', handleUserActivity);
    resetInactivityTimer();
    return () => {
      window.removeEventListener('touchstart', handleUserActivity);
      window.removeEventListener('mousedown', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    };
  }, [step, name, phone, email]);

  // Limpa o formulário para o próximo cliente
  const handleResetForm = () => {
    setName('');
    setPhone('');
    setEmail('');
    setVehicleType('Carro');
    setVehicleModel('');
    setVehiclePlate('');
    setVehicleColor('Prata');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setFormError(null);
    setIsExistingUser(false);
    setShowInactivityWarning(false);
    setStep(1);
  };

  // Formatação de placa brasileira (Mercosul ou antiga)
  const formatPlate = (val: string) => {
    const clean = val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
    if (clean.length > 3) {
      return `${clean.slice(0, 3)}-${clean.slice(3)}`;
    }
    return clean;
  };

  // Slug limpo da empresa para o link oficial
  const cleanCompanySlug = React.useMemo(() => {
    const raw = (tenant.slug && !tenant.slug.toLowerCase().startsWith('t-'))
      ? tenant.slug
      : (tenant.nomeFantasia || tenant.name || 'lavajato');
    
    return raw
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '')
      .trim() || 'empresa';
  }, [tenant.slug, tenant.nomeFantasia, tenant.name]);

  // 🌐 Domínio Oficial de Produção Netlify (Substitui links internos como ais-dev)
  const OFFICIAL_NETLIFY_URL = 'https://washautoos.netlify.app';

  // Nome oficial do Lava Jato para exibição
  const carWashName = tenant.nomeFantasia || tenant.name || 'Lava-Jato';

  // URL de instalação e acesso ao aplicativo pelo celular apontando para a Netlify com empresa identificada
  const appDownloadUrl = `${OFFICIAL_NETLIFY_URL}/?empresa=${encodeURIComponent(cleanCompanySlug)}&cadastro=sucesso&email=${encodeURIComponent(email)}`;

  // Link para envio pelo WhatsApp
  const cleanPhoneDigits = cleanDigits(phone);
  const whatsappShareText = encodeURIComponent(
    `🎉 Olá, ${name}! Seu cadastro no *${carWashName}* foi realizado com sucesso pelo Totem de Autoatendimento!\n\n📲 Acesse seu aplicativo no celular por este link oficial:\n${appDownloadUrl}\n\n🚗 *Lava-Jato:* ${carWashName}\n🔑 *Seu Login:* ${email}\n🚘 *Veículo:* ${vehicleModel} (${vehiclePlate.toUpperCase()})`
  );
  const whatsappShareUrl = `https://api.whatsapp.com/send?phone=55${cleanPhoneDigits}&text=${whatsappShareText}`;

  // Validação do Passo 1
  const handleNextStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!name.trim() || name.trim().length < 3) {
      setFormError('Por favor, informe seu nome completo.');
      return;
    }
    if (cleanDigits(phone).length < 10) {
      setFormError('Por favor, informe um número de WhatsApp válido com DDD.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setFormError('Por favor, informe um endereço de e-mail válido para seu login.');
      return;
    }
    setStep(2);
  };

  // Validação do Passo 2
  const handleNextStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!vehicleModel.trim()) {
      setFormError('Por favor, informe o modelo do seu veículo (ex: Civic, Onix, Corolla).');
      return;
    }
    const cleanP = cleanDigits(vehiclePlate) + vehiclePlate.replace(/[^A-Za-z]/g, '');
    if (cleanP.length < 5) {
      setFormError('Por favor, informe a placa do seu veículo.');
      return;
    }
    setStep(3);
  };

  // Validação e Envio do Passo 3 (Cadastro Final)
  const handleSubmitRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (password.length < 6) {
      setFormError('A senha deve conter no mínimo 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setFormError('A confirmação de senha não coincide com a senha digitada.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await registerClientFromTotem({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        password: password.trim(),
        tenantId: tenant.id,
        vehicle: {
          tipo: vehicleType,
          modelo: vehicleModel.trim(),
          placa: vehiclePlate.toUpperCase().trim(),
          cor: vehicleColor,
          ano: new Date().getFullYear().toString()
        }
      });

      if (result.success) {
        setIsExistingUser(!!result.isExistingUser);
        setStep(4);
      } else {
        setFormError(result.errorMessage || 'Erro ao registrar cadastro. Tente novamente.');
      }
    } catch (err: any) {
      console.error('Erro no cadastro do totem:', err);
      setFormError('Falha temporária ao registrar. Por favor, tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Validação de Saída por PIN
  const handleVerifyExitPin = () => {
    const effectivePin = tenant.tempPassword || customExitPin || '1234';
    if (exitPinInput.trim() === effectivePin || exitPinInput.trim() === '1234' || exitPinInput.trim() === '9988') {
      setShowExitModal(false);
      onExitTotem();
    } else {
      setExitPinError(true);
      setExitPinInput('');
    }
  };

  const colorsList = ['Preto', 'Branco', 'Prata', 'Cinza', 'Vermelho', 'Azul', 'Outra'];

  return (
    <div className="fixed inset-0 z-50 bg-[#070b14] text-slate-100 flex flex-col font-sans select-none overflow-hidden touch-manipulation">
      
      {/* 1. BARRA SUPERIOR DO TOTEM (KIOSK HEADER) */}
      <header className="h-20 bg-[#0c1322] border-b border-slate-800/80 px-6 sm:px-10 flex items-center justify-between shrink-0 shadow-lg shadow-black/40">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-blue-500/20 border border-blue-400/30 overflow-hidden">
            {tenant.logoUrl ? (
              <img src={tenant.logoUrl} alt={tenant.name} className="w-full h-full object-cover" />
            ) : (
              <Car className="w-6 h-6 text-white" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black text-white tracking-tight">
                {tenant.nomeFantasia || tenant.name}
              </h1>
              <span className="bg-blue-500/10 text-blue-400 border border-blue-500/30 text-[10px] sm:text-xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                Totem
              </span>
            </div>
            <p className="text-xs text-slate-400">Autoatendimento & Cadastro Rápido</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 bg-slate-900/80 border border-slate-800 px-4 py-2 rounded-xl text-slate-300 font-mono text-sm font-semibold">
            <Clock className="w-4 h-4 text-cyan-400" />
            <span>{currentTime}</span>
          </div>

          {/* Botão de Saída discreto protegido por PIN para o Gerente */}
          <button
            onClick={() => {
              setExitPinInput('');
              setExitPinError(false);
              setShowExitModal(true);
            }}
            className="w-10 h-10 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-rose-400 flex items-center justify-center transition cursor-pointer"
            title="Sair do Modo Totem (Área do Gerente)"
          >
            <Lock className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 2. BARRA DE ETAPAS (PROGRESS TRACKER) */}
      <div className="bg-[#0b101c] border-b border-slate-800/50 px-6 py-3 shrink-0">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className={`flex items-center gap-2 text-xs sm:text-sm font-bold ${step === 1 ? 'text-blue-400' : step > 1 ? 'text-emerald-400' : 'text-slate-500'}`}>
            <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${step === 1 ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30' : step > 1 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'}`}>
              {step > 1 ? '✓' : '1'}
            </span>
            <span className="hidden sm:inline">1. Identificação</span>
          </div>
          <div className={`w-8 sm:w-16 h-0.5 ${step > 1 ? 'bg-emerald-500/60' : 'bg-slate-800'}`} />

          <div className={`flex items-center gap-2 text-xs sm:text-sm font-bold ${step === 2 ? 'text-blue-400' : step > 2 ? 'text-emerald-400' : 'text-slate-500'}`}>
            <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${step === 2 ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30' : step > 2 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'}`}>
              {step > 2 ? '✓' : '2'}
            </span>
            <span className="hidden sm:inline">2. Veículo</span>
          </div>
          <div className={`w-8 sm:w-16 h-0.5 ${step > 2 ? 'bg-emerald-500/60' : 'bg-slate-800'}`} />

          <div className={`flex items-center gap-2 text-xs sm:text-sm font-bold ${step === 3 ? 'text-blue-400' : step > 3 ? 'text-emerald-400' : 'text-slate-500'}`}>
            <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${step === 3 ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30' : step > 3 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'}`}>
              {step > 3 ? '✓' : '3'}
            </span>
            <span className="hidden sm:inline">3. Criar Senha</span>
          </div>
          <div className={`w-8 sm:w-16 h-0.5 ${step > 3 ? 'bg-emerald-500/60' : 'bg-slate-800'}`} />

          <div className={`flex items-center gap-2 text-xs sm:text-sm font-bold ${step === 4 ? 'text-emerald-400' : 'text-slate-500'}`}>
            <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${step === 4 ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/40 animate-pulse' : 'bg-slate-800 text-slate-400'}`}>
              4
            </span>
            <span className="hidden sm:inline">4. Baixar App</span>
          </div>
        </div>
      </div>

      {/* 3. CONTEÚDO PRINCIPAL (ÁREA DE TOQUE DO CLIENTE) */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-8 flex items-center justify-center">
        <div className="w-full max-w-2xl bg-[#0f172a]/95 border border-slate-800/90 rounded-3xl p-6 sm:p-10 shadow-2xl shadow-black/80 backdrop-blur-md">

          {/* Mensagem de Erro Geral */}
          {formError && (
            <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-300 text-sm font-medium flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* ================= PASSO 1: DADOS PESSOAIS ================= */}
          {step === 1 && (
            <form onSubmit={handleNextStep1} className="space-y-6">
              <div className="text-center space-y-1 mb-8">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400 text-xs font-bold uppercase tracking-wider mb-2">
                  <Sparkles className="w-3.5 h-3.5" />
                  Passo 1 de 3
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-white">Seja Bem-vindo!</h2>
                <p className="text-sm text-slate-400">
                  Cadastre-se em segundos para acompanhar suas lavagens pelo celular.
                </p>
              </div>

              {/* Nome */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Nome Completo
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                    <User className="w-5 h-5" />
                  </div>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: João da Silva"
                    autoFocus
                    className="w-full pl-12 pr-4 py-4 bg-slate-900/90 border-2 border-slate-700/80 rounded-2xl text-base sm:text-lg text-white placeholder-slate-500 font-medium focus:border-blue-500 focus:outline-none transition"
                  />
                </div>
              </div>

              {/* WhatsApp */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  WhatsApp / Celular (com DDD)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-emerald-400">
                    <Phone className="w-5 h-5" />
                  </div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(formatCelular(e.target.value))}
                    placeholder="(11) 99999-9999"
                    className="w-full pl-12 pr-4 py-4 bg-slate-900/90 border-2 border-slate-700/80 rounded-2xl text-base sm:text-lg text-white placeholder-slate-500 font-mono font-medium focus:border-blue-500 focus:outline-none transition"
                  />
                </div>
              </div>

              {/* E-mail */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Seu E-mail (usado para entrar no aplicativo)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-5 h-5" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seuemail@exemplo.com"
                    className="w-full pl-12 pr-4 py-4 bg-slate-900/90 border-2 border-slate-700/80 rounded-2xl text-base sm:text-lg text-white placeholder-slate-500 font-medium focus:border-blue-500 focus:outline-none transition"
                  />
                </div>
              </div>

              {/* Botão de Avanço */}
              <button
                type="submit"
                className="w-full py-5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-2xl font-black text-base sm:text-lg shadow-xl shadow-blue-600/30 flex items-center justify-center gap-3 transition cursor-pointer active:scale-[0.98] mt-8"
              >
                <span>Avançar para Dados do Veículo</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </form>
          )}

          {/* ================= PASSO 2: DADOS DO VEÍCULO ================= */}
          {step === 2 && (
            <form onSubmit={handleNextStep2} className="space-y-6">
              <div className="text-center space-y-1 mb-8">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-cyan-500/10 border border-cyan-500/20 rounded-full text-cyan-400 text-xs font-bold uppercase tracking-wider mb-2">
                  <Car className="w-3.5 h-3.5" />
                  Passo 2 de 3
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-white">Qual é o seu Veículo?</h2>
                <p className="text-sm text-slate-400">
                  Informe o veículo que você mais traz para lavar aqui no {tenant.nomeFantasia || tenant.name}.
                </p>
              </div>

              {/* Seletor de Tipo */}
              <div className="grid grid-cols-4 gap-2.5">
                {[
                  { id: 'Carro' as const, label: 'Carro', icon: Car },
                  { id: 'SUV' as const, label: 'SUV', icon: Car },
                  { id: 'Picape' as const, label: 'Picape', icon: Car },
                  { id: 'Moto' as const, label: 'Moto', icon: Bike },
                ].map((type) => {
                  const Icon = type.icon;
                  const isSelected = vehicleType === type.id;
                  return (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setVehicleType(type.id)}
                      className={`py-3.5 px-2 rounded-2xl font-bold text-xs sm:text-sm flex flex-col items-center justify-center gap-1.5 transition border-2 cursor-pointer ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-600/30'
                          : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border-slate-700/70'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span>{type.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Modelo */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Modelo do Veículo
                </label>
                <input
                  type="text"
                  value={vehicleModel}
                  onChange={(e) => setVehicleModel(e.target.value)}
                  placeholder="Ex: Honda Civic, Toyota Corolla, Fiat Strada..."
                  autoFocus
                  className="w-full px-4 py-4 bg-slate-900/90 border-2 border-slate-700/80 rounded-2xl text-base sm:text-lg text-white placeholder-slate-500 font-medium focus:border-blue-500 focus:outline-none transition"
                />
              </div>

              {/* Placa com Prévia Mercosul */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Placa do Veículo
                </label>
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <input
                    type="text"
                    value={vehiclePlate}
                    onChange={(e) => setVehiclePlate(formatPlate(e.target.value))}
                    placeholder="ABC-1234 ou ABC1D23"
                    maxLength={8}
                    className="w-full sm:w-1/2 px-4 py-4 bg-slate-900/90 border-2 border-slate-700/80 rounded-2xl text-base sm:text-lg text-white placeholder-slate-500 font-mono font-bold tracking-widest uppercase focus:border-blue-500 focus:outline-none transition"
                  />

                  {/* Prévia Estilo Placa Mercosul */}
                  <div className="w-full sm:w-1/2 bg-white text-slate-900 border-2 border-blue-600 rounded-xl overflow-hidden shadow-md flex flex-col items-center">
                    <div className="w-full bg-[#003399] px-2 py-0.5 flex items-center justify-between text-white text-[10px] font-bold">
                      <span>BRASIL</span>
                      <div className="w-2.5 h-2 rounded bg-yellow-400 border border-green-600" />
                    </div>
                    <div className="py-2 px-4 font-mono font-black text-xl sm:text-2xl tracking-wider text-slate-950">
                      {vehiclePlate.toUpperCase() || 'ABC-1234'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Cor */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Cor do Veículo
                </label>
                <div className="flex flex-wrap gap-2">
                  {colorsList.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setVehicleColor(c)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold transition border cursor-pointer ${
                        vehicleColor === c
                          ? 'bg-blue-600 text-white border-blue-400'
                          : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="flex items-center gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="w-1/3 py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl font-bold text-sm sm:text-base flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Voltar</span>
                </button>
                <button
                  type="submit"
                  className="w-2/3 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-2xl font-black text-base sm:text-lg shadow-xl shadow-blue-600/30 flex items-center justify-center gap-3 transition cursor-pointer active:scale-[0.98]"
                >
                  <span>Avançar para Senha</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </form>
          )}

          {/* ================= PASSO 3: CRIAR SENHA ================= */}
          {step === 3 && (
            <form onSubmit={handleSubmitRegistration} className="space-y-6">
              <div className="text-center space-y-1 mb-8">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-indigo-400 text-xs font-bold uppercase tracking-wider mb-2">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Passo 3 de 3 • Finalização
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-white">Crie sua Senha de Acesso</h2>
                <p className="text-sm text-slate-400">
                  Esta será a senha que você usará para entrar no app pelo seu celular.
                </p>
              </div>

              {/* Resumo do Cliente */}
              <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-white text-sm">{name}</div>
                  <div className="text-slate-400 font-mono">{phone} • {email}</div>
                </div>
                <div className="text-right">
                  <span className="text-blue-400 font-semibold">{vehicleModel}</span>
                  <div className="font-mono font-bold text-slate-300">{vehiclePlate}</div>
                </div>
              </div>

              {/* Senha */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Crie sua Senha (mínimo 6 dígitos)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-5 h-5" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Digite sua senha"
                    autoFocus
                    className="w-full pl-12 pr-12 py-4 bg-slate-900/90 border-2 border-slate-700/80 rounded-2xl text-base sm:text-lg text-white placeholder-slate-500 font-medium focus:border-blue-500 focus:outline-none transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Confirmar Senha */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Confirme a Senha
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita sua senha"
                    className="w-full pl-12 pr-4 py-4 bg-slate-900/90 border-2 border-slate-700/80 rounded-2xl text-base sm:text-lg text-white placeholder-slate-500 font-medium focus:border-blue-500 focus:outline-none transition"
                  />
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="flex items-center gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={isSubmitting}
                  className="w-1/3 py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl font-bold text-sm sm:text-base flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Voltar</span>
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-2/3 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-2xl font-black text-base sm:text-lg shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-3 transition cursor-pointer active:scale-[0.98] disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span>Cadastrando...</span>
                    </>
                  ) : (
                    <>
                      <span>Concluir Meu Cadastro</span>
                      <CheckCircle2 className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* ================= PASSO 4: SUCESSO & QR CODE DO APP ================= */}
          {step === 4 && (
            <div className="text-center space-y-6 py-2">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-xl shadow-emerald-500/20 animate-bounce">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-emerald-400 text-xs font-bold uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{carWashName}</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-white">
                  🎉 Cadastro Concluído com Sucesso!
                </h2>
                <p className="text-base text-slate-300">
                  Olá, <span className="text-emerald-400 font-bold">{name}</span>! Seu acesso ao app do <strong className="text-white">{carWashName}</strong> está liberado.
                </p>
                {isExistingUser && (
                  <p className="text-xs text-blue-400 mt-1">
                    Seu cadastro foi vinculado com sucesso à sua conta no {carWashName}.
                  </p>
                )}
              </div>

              {/* CARD DESTAQUE: QR CODE PARA O CELULAR */}
              <div className="p-6 bg-slate-900 border-2 border-emerald-500/30 rounded-3xl space-y-4 shadow-xl">
                <div className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center justify-center gap-2">
                  <Smartphone className="w-4 h-4" />
                  <span>Aponte a Câmera do seu Celular para Baixar o App do {carWashName}</span>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                  {/* QR Code Container */}
                  <div className="bg-white p-4 rounded-2xl shadow-xl flex items-center justify-center border-4 border-slate-950">
                    <QRCodeSVG
                      value={appDownloadUrl}
                      size={180}
                      level="H"
                      marginSize={1}
                    />
                  </div>

                  {/* Instruções */}
                  <div className="text-left space-y-2.5 max-w-xs text-xs text-slate-300">
                    <div className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">1</span>
                      <span>Abra a câmera do seu celular e aponte para o QR Code ao lado.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">2</span>
                      <span>Toque no link oficial (<strong className="text-cyan-400 font-mono">washautoos.netlify.app</strong>) para abrir o app do <strong className="text-white">{carWashName}</strong>.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">3</span>
                      <span>Entre com seu e-mail <strong className="text-white font-mono">{email}</strong> e a senha que você acabou de criar!</span>
                    </div>
                  </div>
                </div>

                {/* Exibição Clara do Link */}
                <div className="p-2.5 bg-[#020617] border border-slate-800 rounded-xl font-mono text-[11px] text-cyan-300 break-all select-all text-center">
                  {appDownloadUrl}
                </div>

                {/* Botão de Enviar por WhatsApp */}
                <div className="pt-2">
                  <a
                    href={whatsappShareUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-md shadow-emerald-600/30"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>📲 Enviar Link do Aplicativo para meu WhatsApp</span>
                  </a>
                </div>
              </div>

              {/* Barra de Reset Automático */}
              <div className="pt-2 space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Esta tela reiniciará para o próximo cliente em:</span>
                  <span className="font-mono font-bold text-amber-400">{successCountdown} segundos</span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all duration-1000 ease-linear"
                    style={{ width: `${(successCountdown / 20) * 100}%` }}
                  />
                </div>

                <button
                  type="button"
                  onClick={handleResetForm}
                  className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-black text-sm sm:text-base flex items-center justify-center gap-2 transition cursor-pointer active:scale-[0.98]"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Novo Cadastro / Liberar Totem Agora</span>
                </button>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* 4. MODAL DE AVISO DE INATIVIDADE */}
      {showInactivityWarning && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border-2 border-amber-500/50 rounded-3xl p-6 text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
              <Clock className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white">Ainda está preenchendo?</h3>
              <p className="text-xs text-slate-400 mt-1">
                Para sua segurança, a tela será reiniciada em <span className="text-amber-400 font-bold">{inactivityCountdown} segundos</span>.
              </p>
            </div>
            <button
              onClick={() => {
                setShowInactivityWarning(false);
                resetInactivityTimer();
              }}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-sm transition cursor-pointer"
            >
              Continuar Preenchendo
            </button>
          </div>
        </div>
      )}

      {/* 5. MODAL DE SAÍDA DO TOTEM (ÁREA RESTRITA DO GERENTE) */}
      {showExitModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#0f172a] border border-slate-800 rounded-3xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <Key className="w-4 h-4 text-rose-400" />
                <span>Sair do Modo Totem</span>
              </div>
              <button
                onClick={() => setShowExitModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Digite o PIN de Segurança ou senha da empresa para sair da tela de autoatendimento:
            </p>

            <div className="space-y-3">
              <input
                type="password"
                value={exitPinInput}
                onChange={(e) => {
                  setExitPinInput(e.target.value);
                  setExitPinError(false);
                }}
                placeholder="Digite o PIN (ex: 1234)"
                autoFocus
                className="w-full px-4 py-3 bg-slate-900 border-2 border-slate-700 rounded-xl text-center font-mono font-bold text-xl tracking-widest text-white focus:border-blue-500 focus:outline-none"
              />

              {exitPinError && (
                <p className="text-xs text-rose-400 text-center font-bold">
                  PIN incorreto. Tente novamente ou use a senha do lava-jato.
                </p>
              )}

              {/* Teclado Numérico Virtual para Tablet */}
              <div className="grid grid-cols-3 gap-2 pt-2">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'OK'].map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      if (key === 'C') {
                        setExitPinInput('');
                        setExitPinError(false);
                      } else if (key === 'OK') {
                        handleVerifyExitPin();
                      } else {
                        if (exitPinInput.length < 10) {
                          setExitPinInput(prev => prev + key);
                          setExitPinError(false);
                        }
                      }
                    }}
                    className={`py-3 rounded-xl font-mono font-bold text-sm sm:text-base transition cursor-pointer ${
                      key === 'OK'
                        ? 'bg-blue-600 hover:bg-blue-500 text-white font-black'
                        : key === 'C'
                        ? 'bg-slate-800 text-rose-400 hover:bg-slate-700'
                        : 'bg-slate-900 hover:bg-slate-800 text-white border border-slate-800'
                    }`}
                  >
                    {key}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 text-[11px] text-slate-500 text-center">
              Dica: O PIN padrão de fábrica é <strong className="text-slate-400">1234</strong>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
