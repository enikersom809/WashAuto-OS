import React, { useState } from 'react';
import { Sparkles, X, Send, Bot, User, RefreshCw, AlertCircle } from 'lucide-react';
import { Tenant } from '../types';

interface AiAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenants: Tenant[];
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  time: string;
}

export const AiAssistantModal: React.FC<AiAssistantModalProps> = ({
  isOpen,
  onClose,
  tenants
}) => {
  const [promptInput, setPromptInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'm1',
      sender: 'ai',
      text: 'Olá! Sou o **IA Advisor do SaaS Master**. Posso analisar as métricas de MRR das suas empresas, identificar contas com risco de churn, recomendar estratégias de upsell e sugerir ações de cobrança.',
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  if (!isOpen) return null;

  const quickPrompts = [
    'Analisar risco de Churn nas empresas ativas',
    'Como converter empresas em Trial para o Plano Pro?',
    'Estratégias para recuperar tenants inadimplentes',
    'Relatório executivo de projeção de MRR para o próximo mês'
  ];

  const handleSend = async (customPrompt?: string) => {
    const textToSend = customPrompt || promptInput;
    if (!textToSend.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    setPromptInput('');
    setLoading(true);

    try {
      const totalMrr = tenants.reduce((acc, t) => t.status === 'Ativo' ? acc + t.mrrAmount : acc, 0);

      const res = await fetch('/api/ai-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: textToSend,
          context: {
            tenantsCount: tenants.length,
            totalMrr,
            activeCount: tenants.filter(t => t.status === 'Ativo').length,
            overdueCount: tenants.filter(t => t.status === 'Inadimplente').length,
            trialCount: tenants.filter(t => t.status === 'Trial').length,
            tenantsSummary: tenants.map(t => ({
              name: t.name,
              plan: t.plan,
              status: t.status,
              users: t.endUsersCount,
              mrr: t.mrrAmount
            }))
          }
        })
      });

      const data = await res.json();

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: data.answer || 'Erro ao processar resposta do assistente.',
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'ai',
          text: 'Ocorreu uma falha ao conectar com o serviço de inteligência. Tente novamente em instantes.',
          time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-950 border border-slate-800 rounded-xl max-w-2xl w-full h-[600px] flex flex-col shadow-2xl relative overflow-hidden">
        
        {/* Header Modal */}
        <div className="p-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Sparkles className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">SaaS Master IA Advisor</h3>
              <p className="text-[11px] text-slate-400">Análise inteligente de métricas e negócios</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Chat Messages Body */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 text-xs ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.sender === 'ai' && (
                <div className="w-7 h-7 rounded-lg bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[82%] p-3.5 rounded-xl text-xs leading-relaxed whitespace-pre-wrap ${
                  msg.sender === 'user'
                    ? 'bg-indigo-600 text-white rounded-br-none'
                    : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none'
                }`}
              >
                {msg.text}
                <span className={`block text-[10px] mt-1.5 text-right ${msg.sender === 'user' ? 'text-indigo-200' : 'text-slate-500'}`}>
                  {msg.time}
                </span>
              </div>

              {msg.sender === 'user' && (
                <div className="w-7 h-7 rounded-lg bg-slate-800 text-slate-300 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-xs text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 p-3 rounded-xl w-fit">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>SaaS Master IA analisando base de dados de empresas...</span>
            </div>
          )}
        </div>

        {/* Prompts Rápidos & Input */}
        <div className="p-4 bg-slate-900/60 border-t border-slate-800 space-y-3">
          {/* Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {quickPrompts.map((qp, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(qp)}
                className="text-[11px] bg-slate-900 hover:bg-slate-800 text-indigo-300 border border-slate-800 hover:border-indigo-500/40 px-2.5 py-1 rounded-full whitespace-nowrap transition flex-shrink-0"
              >
                {qp}
              </button>
            ))}
          </div>

          {/* Form input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              placeholder="Pergunte ao assistente de IA sobre MRR, churn ou empresas..."
              className="flex-1 bg-slate-900 border border-slate-800 text-xs text-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              disabled={loading || !promptInput.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white p-2.5 rounded-lg transition"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};
