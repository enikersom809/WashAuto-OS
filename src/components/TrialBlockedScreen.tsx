import React, { useState } from 'react';
import {
  Lock,
  CheckCircle2,
  RefreshCw,
  LogOut,
  MessageCircle,
  Clock,
  ShieldAlert,
  Crown,
  Sparkles,
  Building2
} from 'lucide-react';
import { Tenant } from '../types';
import { TenantTrialStatusInfo } from '../utils/trialService';

interface TrialBlockedScreenProps {
  tenant: Tenant;
  trialInfo: TenantTrialStatusInfo;
  onRefreshStatus: () => Promise<boolean> | boolean;
  onLogout: () => void;
}

const CONTRACTION_PLANS = [
  {
    id: 'Basic',
    name: 'Basic Mensal',
    price: 'R$ 199/mês',
    limit: 'Até 250 clientes · Fila e Agendamento'
  },
  {
    id: 'Pro',
    name: 'Pro Mensal',
    price: 'R$ 499/mês',
    limit: 'Até 2.000 clientes · Leva e Traz, Caixa, Push e WhatsApp'
  },
  {
    id: 'Enterprise',
    name: 'Enterprise Mensal',
    price: 'R$ 1.299/mês',
    limit: 'Até 10.000 clientes · Multi-unidades e Domínio Próprio'
  },
  {
    id: 'Vitalicio',
    name: 'Licença Vitalícia',
    price: 'R$ 4.000 único',
    limit: 'Sem mensalidades · Uso definitivo e ilimitado'
  }
] as const;

export const TrialBlockedScreen: React.FC<TrialBlockedScreenProps> = ({
  tenant,
  trialInfo,
  onRefreshStatus,
  onLogout
}) => {
  const [selectedPlanId, setSelectedPlanId] = useState<string>('Pro');
  const [isChecking, setIsChecking] = useState(false);
  const [checkFeedback, setCheckFeedback] = useState<string | null>(null);

  const selectedPlanObj = CONTRACTION_PLANS.find((p) => p.id === selectedPlanId) || CONTRACTION_PLANS[1];

  const isTrialExpired = trialInfo.blockReason === 'trial_expired';
  const isOverdue = trialInfo.blockReason === 'overdue';

  const title = isTrialExpired
    ? 'Período de Teste de 20 Dias Encerrado'
    : isOverdue
    ? 'Acesso Bloqueado por Pendência Financeira'
    : 'Acesso Temporariamente Bloqueado';

  const description = isTrialExpired
    ? `O período gratuito de 20 dias do estabelecimento "${tenant.nomeFantasia || tenant.name}" foi concluído em ${trialInfo.trialEndsAtFormatted}. Para continuar utilizando o painel, o portal do cliente e o totem, escolha um plano abaixo para liberar o aplicativo imediatamente.`
    : isOverdue
    ? `A assinatura de "${tenant.nomeFantasia || tenant.name}" encontra-se pendente. Regularize a contratação para reativar todas as operações automaticamente.`
    : `O acesso de "${tenant.nomeFantasia || tenant.name}" está bloqueado no momento. Realize a contratação ou entre em contato com o suporte para liberar o sistema.`;

  const whatsappMessage = encodeURIComponent(
    `Olá! Gostaria de contratar o plano *${selectedPlanObj.name} (${selectedPlanObj.price})* para liberar o aplicativo do meu lava-jato:\n\n` +
      `🏢 Empresa: ${tenant.nomeFantasia || tenant.name}\n` +
      `📧 E-mail: ${tenant.contactEmail}\n` +
      `🆔 Código: ${tenant.code || tenant.id}\n\n` +
      `Aguardo confirmação para liberação do sistema.`
  );

  const handleCheckRelease = async () => {
    setIsChecking(true);
    setCheckFeedback(null);
    try {
      const unlocked = await onRefreshStatus();
      if (!unlocked) {
        setCheckFeedback(
          'Ainda consta como bloqueado no servidor. Assim que o administrador confirmar a contratação, o sistema será liberado automaticamente.'
        );
      }
    } catch {
      setCheckFeedback('Não foi possível consultar o servidor agora. Tente novamente em instantes.');
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-4xl bg-[#0f172a] border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        {/* Topo de Status do Bloqueio */}
        <div className="p-6 sm:p-8 border-b border-slate-800 bg-rose-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center shrink-0">
              {isTrialExpired ? <Clock className="w-6 h-6" /> : <Lock className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs text-rose-400 font-semibold mb-1">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Bloqueio Automático</span>
                <span aria-hidden="true">·</span>
                <span className="text-slate-400">{tenant.nomeFantasia || tenant.name}</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">{title}</h1>
              <p className="text-xs sm:text-sm text-slate-300 mt-1.5 leading-relaxed max-w-2xl">
                {description}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="self-start sm:self-center px-3.5 py-2 rounded-lg bg-[#020617] hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-300 flex items-center gap-1.5 transition whitespace-nowrap shrink-0 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sair da Conta
          </button>
        </div>

        {/* Seleção de Plano para Liberação Pós-Contratação */}
        <div className="p-6 sm:p-8 space-y-6">
          <div>
            <h2 className="text-sm font-bold text-slate-100">
              Selecione o plano desejado para liberação do aplicativo
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Após a confirmação da contratação pelo administrador, todo o histórico, clientes, agendamentos e configurações do seu teste de 20 dias permanecem preservados.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {CONTRACTION_PLANS.map((plan) => {
              const isSelected = selectedPlanId === plan.id;
              const isLifetime = plan.id === 'Vitalicio';
              return (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setSelectedPlanId(plan.id)}
                  className={`text-left p-4 rounded-xl border transition cursor-pointer flex items-start justify-between gap-3 ${
                    isSelected
                      ? isLifetime
                        ? 'bg-amber-500/10 border-amber-400/60 text-white'
                        : 'bg-indigo-600/15 border-indigo-500 text-white'
                      : 'bg-[#020617]/70 border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-sm">
                      {isLifetime ? (
                        <Crown className="w-4 h-4 text-amber-400 shrink-0" />
                      ) : (
                        <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
                      )}
                      <span>{plan.name}</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-snug">{plan.limit}</p>
                  </div>
                  <span
                    className={`text-xs font-bold font-mono tabular-nums whitespace-nowrap shrink-0 ${
                      isLifetime ? 'text-amber-300' : 'text-emerald-400'
                    }`}
                  >
                    {plan.price}
                  </span>
                </button>
              );
            })}
          </div>

          {checkFeedback && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs leading-relaxed">
              {checkFeedback}
            </div>
          )}

          {/* Ações de Contratação e Verificação */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-slate-800">
            <a
              href={`https://wa.me/5511999999999?text=${whatsappMessage}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition whitespace-nowrap"
            >
              <MessageCircle className="w-4 h-4 shrink-0" />
              Contratar {selectedPlanObj.name} ({selectedPlanObj.price})
            </a>

            <button
              type="button"
              onClick={handleCheckRelease}
              disabled={isChecking}
              className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition whitespace-nowrap cursor-pointer"
            >
              {isChecking ? (
                <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              )}
              {isChecking ? 'Verificando Liberação...' : 'Já Contratei — Verificar Liberação Agora'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface ClientOrTotemBlockedScreenProps {
  tenant: Tenant;
  mode: 'cliente' | 'totem';
  onRefreshStatus: () => Promise<boolean> | boolean;
  onLogout: () => void;
}

export const ClientOrTotemBlockedScreen: React.FC<ClientOrTotemBlockedScreenProps> = ({
  tenant,
  mode,
  onRefreshStatus,
  onLogout
}) => {
  const [isChecking, setIsChecking] = useState(false);

  const handleRefresh = async () => {
    setIsChecking(true);
    try {
      await onRefreshStatus();
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#0f172a] border border-slate-800 rounded-2xl p-6 sm:p-8 text-center space-y-5 shadow-2xl">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center">
          <Lock className="w-7 h-7" />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
            <Building2 className="w-3.5 h-3.5" />
            <span>{tenant.nomeFantasia || tenant.name}</span>
            <span aria-hidden="true">·</span>
            <span>{mode === 'totem' ? 'Totem' : 'Portal do Cliente'}</span>
          </div>
          <h1 className="text-lg sm:text-xl font-bold text-white">
            Aplicativo Temporariamente Bloqueado
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            O acesso deste estabelecimento foi suspenso automaticamente após o término do período de teste ou por pendência de assinatura. Entre em contato com o lava-jato responsável para liberação.
          </p>
        </div>

        <div className="flex flex-col gap-2.5 pt-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isChecking}
            className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
            {isChecking ? 'Verificando...' : 'Verificar se Já Foi Liberado'}
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="w-full py-2.5 px-4 rounded-xl bg-[#020617] hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Sair / Voltar ao Início
          </button>
        </div>
      </div>
    </div>
  );
};
