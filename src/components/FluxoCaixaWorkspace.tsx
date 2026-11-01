import React, { useState, useEffect, useMemo } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  ArrowUpRight, 
  ArrowDownRight, 
  Wallet, 
  Calendar, 
  Filter, 
  Plus, 
  Minus, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  FileText, 
  Printer, 
  Download, 
  Search, 
  Receipt, 
  CreditCard, 
  Banknote, 
  QrCode, 
  Lock, 
  Unlock, 
  Sparkles, 
  Trash2, 
  ChevronRight,
  PieChart,
  ShoppingBag,
  Fuel,
  Users,
  Building2,
  X
} from 'lucide-react';
import { Tenant, CashTransaction, CashTransactionType, CashTransactionCategory, CashPaymentMethod, CashRegisterSession, OilChangeRecord } from '../types';
import { 
  saveCashTransactionToFirestore, 
  deleteCashTransactionFromFirestore, 
  subscribeToTenantCashTransactions,
  saveCashRegisterSessionToFirestore,
  subscribeToTenantCashRegisterSession
} from '../lib/firebaseService';

interface FluxoCaixaWorkspaceProps {
  tenant: Tenant;
  washHistory?: Array<{
    id: string;
    plate: string;
    vehicle: string;
    service: string;
    price: number;
    completedAt: string;
    date: string;
    paymentMethod: string;
    commissionAmount: number;
    clientName?: string;
  }>;
  oilChanges?: OilChangeRecord[];
  onToast: (msg: string) => void;
}

export const FluxoCaixaWorkspace: React.FC<FluxoCaixaWorkspaceProps> = ({
  tenant,
  washHistory = [],
  oilChanges = [],
  onToast
}) => {
  // Transações no Firestore
  const [transactions, setTransactions] = useState<CashTransaction[]>([]);
  const [cashRegister, setCashRegister] = useState<CashRegisterSession | null>(null);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [periodFilter, setPeriodFilter] = useState<'hoje' | 'ontem' | '7dias' | 'mes' | 'todos'>('hoje');
  const [typeFilter, setTypeFilter] = useState<'todos' | 'entrada' | 'saida'>('todos');
  const [paymentFilter, setPaymentFilter] = useState<string>('todos');
  const [searchQuery, setSearchQuery] = useState('');

  // Modais
  const [showNewEntryModal, setShowNewEntryModal] = useState(false);
  const [showNewExitModal, setShowNewExitModal] = useState(false);
  const [showOpenRegisterModal, setShowOpenRegisterModal] = useState(false);
  const [showCloseRegisterModal, setShowCloseRegisterModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  // Estados do Formulário de Entrada
  const [entryCategory, setEntryCategory] = useState<CashTransactionCategory>('venda_balcao');
  const [entryDescription, setEntryDescription] = useState('');
  const [entryAmount, setEntryAmount] = useState<string>('');
  const [entryPaymentMethod, setEntryPaymentMethod] = useState<CashPaymentMethod>('PIX');
  const [entryClient, setEntryClient] = useState('');
  const [entryNotes, setEntryNotes] = useState('');

  // Estados do Formulário de Saída
  const [exitCategory, setExitCategory] = useState<CashTransactionCategory>('sangria_retirada');
  const [exitDescription, setExitDescription] = useState('');
  const [exitAmount, setExitAmount] = useState<string>('');
  const [exitPaymentMethod, setExitPaymentMethod] = useState<CashPaymentMethod>('Dinheiro');
  const [exitRecipient, setExitRecipient] = useState('');
  const [exitNotes, setExitNotes] = useState('');

  // Estados de Abertura / Fechamento de Caixa
  const [initialBalanceInput, setInitialBalanceInput] = useState<string>('100.00');
  const [countedCashInput, setCountedCashInput] = useState<string>('');
  const [closingNotes, setClosingNotes] = useState('');

  // Sincronização em Tempo Real via Firestore
  useEffect(() => {
    if (!tenant.id) return;
    setLoading(true);

    const unsubTrans = subscribeToTenantCashTransactions(tenant.id, (items) => {
      setTransactions(items);
      setLoading(false);
    });

    const unsubRegister = subscribeToTenantCashRegisterSession(tenant.id, (session) => {
      setCashRegister(session);
    });

    return () => {
      unsubTrans();
      unsubRegister();
    };
  }, [tenant.id]);

  // Se o caixa não tiver sessão criada para hoje, define status inicial
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const isRegisterOpen = cashRegister?.status === 'aberto' && cashRegister?.date === todayStr;

  // Formatação de Moeda
  const formatBRL = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // Consolidação de Transações Totais (Manuais + Lavagens do Pátio + Trocas de Óleo)
  // Cria uma visão unificada para garantir que todo o faturamento do lava-jato apareça no fluxo
  const consolidatedTransactions = useMemo(() => {
    const list: CashTransaction[] = [...transactions];

    // Inclui lavagens concluídas que ainda não foram convertidas manualmente
    washHistory.forEach(wash => {
      const alreadyHas = list.some(t => t.referenceId === `wash-${wash.id}`);
      if (!alreadyHas) {
        list.push({
          id: `wash-${wash.id}`,
          tenantId: tenant.id,
          type: 'entrada',
          category: 'venda_lavagem',
          categoryLabel: 'Lavagem de Veículo',
          description: `Lavagem ${wash.service} - ${wash.plate} (${wash.vehicle})`,
          amount: wash.price,
          paymentMethod: (wash.paymentMethod as CashPaymentMethod) || 'PIX',
          date: wash.date || todayStr,
          time: wash.completedAt.includes('às') ? wash.completedAt.split('às')[1]?.trim() : '12:00',
          operator: 'Sistema / Pátio',
          referenceId: `wash-${wash.id}`,
          recipientOrClient: wash.clientName || 'Cliente Balcão',
          createdAt: wash.date || new Date().toISOString()
        });
      }
    });

    // Inclui trocas de óleo
    oilChanges.forEach(oil => {
      const alreadyHas = list.some(t => t.referenceId === `oil-${oil.id}`);
      if (!alreadyHas) {
        list.push({
          id: `oil-${oil.id}`,
          tenantId: tenant.id,
          type: 'entrada',
          category: 'venda_oleo',
          categoryLabel: 'Troca de Óleo',
          description: `Troca de Óleo ${oil.oilType || ''} - ${oil.vehiclePlate} (${oil.vehicleModel})`,
          amount: oil.totalPrice,
          paymentMethod: (oil.paymentMethod as CashPaymentMethod) || 'PIX',
          date: oil.changeDate || todayStr,
          time: '14:00',
          operator: oil.responsibleTechnician || 'Técnico Troca',
          referenceId: `oil-${oil.id}`,
          recipientOrClient: oil.clientName || 'Cliente Troca',
          createdAt: oil.createdAt || new Date().toISOString()
        });
      }
    });

    // Ordenação decrescente por data e hora
    return list.sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.time || '00:00'}`).getTime();
      const dateB = new Date(`${b.date}T${b.time || '00:00'}`).getTime();
      return dateB - dateA;
    });
  }, [transactions, washHistory, oilChanges, tenant.id, todayStr]);

  // Transações Filtradas por Período, Tipo, Pagamento e Busca
  const filteredTransactions = useMemo(() => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    return consolidatedTransactions.filter(t => {
      // Filtro por Período
      if (periodFilter === 'hoje' && t.date !== todayStr) return false;
      if (periodFilter === 'ontem' && t.date !== yesterday) return false;
      if (periodFilter === '7dias') {
        const itemDate = new Date(t.date);
        if (itemDate < sevenDaysAgo) return false;
      }
      if (periodFilter === 'mes' && !t.date.startsWith(currentMonthStr)) return false;

      // Filtro por Tipo (Entrada / Saída)
      if (typeFilter !== 'todos' && t.type !== typeFilter) return false;

      // Filtro por Forma de Pagamento
      if (paymentFilter !== 'todos' && t.paymentMethod !== paymentFilter) return false;

      // Busca por Texto
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesDesc = t.description.toLowerCase().includes(q);
        const matchesClient = t.recipientOrClient?.toLowerCase().includes(q);
        const matchesCat = t.category.toLowerCase().includes(q);
        if (!matchesDesc && !matchesClient && !matchesCat) return false;
      }

      return true;
    });
  }, [consolidatedTransactions, periodFilter, typeFilter, paymentFilter, searchQuery, todayStr]);

  // Métricas e Totais Consolidados do Período Filtrado
  const metrics = useMemo(() => {
    let totalEntradas = 0;
    let totalSaidas = 0;

    let totalPIX = 0;
    let totalDinheiro = 0;
    let totalCartaoCredito = 0;
    let totalCartaoDebito = 0;
    let totalOutros = 0;

    let saidasDinheiro = 0;
    let saidasComissao = 0;
    let saidasSangria = 0;
    let saidasInsumos = 0;
    let saidasOperacional = 0;

    filteredTransactions.forEach(t => {
      if (t.type === 'entrada') {
        totalEntradas += t.amount;
        if (t.paymentMethod === 'PIX') totalPIX += t.amount;
        else if (t.paymentMethod === 'Dinheiro') totalDinheiro += t.amount;
        else if (t.paymentMethod === 'Cartão de Crédito') totalCartaoCredito += t.amount;
        else if (t.paymentMethod === 'Cartão de Débito') totalCartaoDebito += t.amount;
        else totalOutros += t.amount;
      } else {
        totalSaidas += t.amount;
        if (t.paymentMethod === 'Dinheiro') saidasDinheiro += t.amount;
        if (t.category === 'comissao_equipe') saidasComissao += t.amount;
        else if (t.category === 'sangria_retirada') saidasSangria += t.amount;
        else if (t.category === 'compra_insumos') saidasInsumos += t.amount;
        else saidasOperacional += t.amount;
      }
    });

    const saldoLiquido = totalEntradas - totalSaidas;
    const initialFundo = isRegisterOpen ? (cashRegister?.initialBalance || 0) : 0;
    const dinheiroNaGavetaEsperado = initialFundo + totalDinheiro - saidasDinheiro;

    return {
      totalEntradas,
      totalSaidas,
      saldoLiquido,
      totalPIX,
      totalDinheiro,
      totalCartaoCredito,
      totalCartaoDebito,
      totalOutros,
      saidasDinheiro,
      saidasComissao,
      saidasSangria,
      saidasInsumos,
      saidasOperacional,
      dinheiroNaGavetaEsperado,
      quantidadeTransacoes: filteredTransactions.length
    };
  }, [filteredTransactions, isRegisterOpen, cashRegister]);

  // Handler: Abertura de Caixa
  const handleOpenRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const balance = parseFloat(initialBalanceInput.replace(',', '.')) || 0;
    const now = new Date();
    const session: CashRegisterSession = {
      id: `session-${Date.now()}`,
      tenantId: tenant.id,
      date: todayStr,
      status: 'aberto',
      openedAt: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      openedBy: 'Operador / Dono',
      initialBalance: balance,
      notes: 'Abertura de caixa com fundo de troco'
    };

    // Cria registro de transação de suprimento inicial
    const suprimentoTrans: CashTransaction = {
      id: `cash-open-${Date.now()}`,
      tenantId: tenant.id,
      type: 'entrada',
      category: 'suprimento_troco',
      categoryLabel: 'Fundo de Troco (Abertura)',
      description: 'Fundo de troco inicial de abertura do caixa',
      amount: balance,
      paymentMethod: 'Dinheiro',
      date: todayStr,
      time: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      operator: 'Dono / Caixa',
      createdAt: now.toISOString()
    };

    await saveCashRegisterSessionToFirestore(tenant.id, session);
    await saveCashTransactionToFirestore(tenant.id, suprimentoTrans);
    setShowOpenRegisterModal(false);
    onToast(`✅ Caixa aberto com sucesso! Fundo inicial: ${formatBRL(balance)}`);
  };

  // Handler: Fechamento de Caixa
  const handleCloseRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cashRegister) return;

    const countedCash = parseFloat(countedCashInput.replace(',', '.')) || 0;
    const difference = countedCash - metrics.dinheiroNaGavetaEsperado;
    const now = new Date();

    const updatedSession: CashRegisterSession = {
      ...cashRegister,
      status: 'fechado',
      closedAt: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      closedBy: 'Dono / Gerente',
      finalPhysicalCash: countedCash,
      differenceCash: difference,
      notes: closingNotes || 'Fechamento de caixa concluído com sucesso'
    };

    await saveCashRegisterSessionToFirestore(tenant.id, updatedSession);
    setShowCloseRegisterModal(false);
    setShowReportModal(true);
    onToast(`🔒 Caixa do dia fechado! Total apurado: ${formatBRL(countedCash)}`);
  };

  // Handler: Salvar Nova Entrada
  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(entryAmount.replace(',', '.')) || 0;
    if (amountNum <= 0) {
      onToast('Informe um valor válido para a entrada.');
      return;
    }

    const now = new Date();
    const newTrans: CashTransaction = {
      id: `cash-${Date.now()}`,
      tenantId: tenant.id,
      type: 'entrada',
      category: entryCategory,
      categoryLabel: getCategoryLabel(entryCategory),
      description: entryDescription || 'Entrada avulsa no caixa',
      amount: amountNum,
      paymentMethod: entryPaymentMethod,
      date: todayStr,
      time: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      operator: 'Operador de Caixa',
      recipientOrClient: entryClient || undefined,
      notes: entryNotes || undefined,
      createdAt: now.toISOString()
    };

    await saveCashTransactionToFirestore(tenant.id, newTrans);
    setEntryDescription('');
    setEntryAmount('');
    setEntryClient('');
    setEntryNotes('');
    setShowNewEntryModal(false);
    onToast(`🟢 Entrada de ${formatBRL(amountNum)} registrada com sucesso!`);
  };

  // Handler: Salvar Nova Saída (Despesa / Sangria)
  const handleSaveExit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(exitAmount.replace(',', '.')) || 0;
    if (amountNum <= 0) {
      onToast('Informe um valor válido para a saída.');
      return;
    }

    const now = new Date();
    const newTrans: CashTransaction = {
      id: `cash-${Date.now()}`,
      tenantId: tenant.id,
      type: 'saida',
      category: exitCategory,
      categoryLabel: getCategoryLabel(exitCategory),
      description: exitDescription || 'Saída / Despesa de caixa',
      amount: amountNum,
      paymentMethod: exitPaymentMethod,
      date: todayStr,
      time: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      operator: 'Dono / Caixa',
      recipientOrClient: exitRecipient || undefined,
      notes: exitNotes || undefined,
      createdAt: now.toISOString()
    };

    await saveCashTransactionToFirestore(tenant.id, newTrans);
    setExitDescription('');
    setExitAmount('');
    setExitRecipient('');
    setExitNotes('');
    setShowNewExitModal(false);
    onToast(`🔴 Saída de ${formatBRL(amountNum)} registrada com sucesso!`);
  };

  // Handler: Excluir Lançamento
  const handleDeleteTransaction = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta movimentação do caixa?')) {
      await deleteCashTransactionFromFirestore(tenant.id, id);
      onToast('Lançamento removido do caixa.');
    }
  };

  // Rótulos Legíveis para Categorias
  const getCategoryLabel = (cat: CashTransactionCategory) => {
    switch (cat) {
      case 'venda_lavagem': return 'Lavagem de Veículo';
      case 'venda_oleo': return 'Troca de Óleo / Filtros';
      case 'venda_balcao': return 'Venda de Balcão / Acessórios';
      case 'suprimento_troco': return 'Fundo de Troco / Suprimento';
      case 'comissao_equipe': return 'Comissão de Lavador';
      case 'sangria_retirada': return 'Sangria / Retirada do Dono';
      case 'compra_insumos': return 'Compra de Insumos / Estoque';
      case 'despesa_operacional': return 'Conta / Despesa Operacional';
      case 'alimentacao': return 'Alimentação da Equipe';
      case 'manutencao': return 'Manutenção de Máquinas';
      case 'outra_saida': return 'Outra Saída';
      default: return 'Outra Movimentação';
    }
  };

  // Exportar Relatório em CSV
  const handleExportCSV = () => {
    if (filteredTransactions.length === 0) {
      onToast('Nenhuma transação para exportar.');
      return;
    }

    const headers = ['Data', 'Hora', 'Tipo', 'Categoria', 'Descricao', 'Valor (R$)', 'Forma Pagamento', 'Cliente/Favorecido', 'Operador'];
    const rows = filteredTransactions.map(t => [
      `"${t.date}"`,
      `"${t.time || ''}"`,
      `"${t.type.toUpperCase()}"`,
      `"${t.categoryLabel || getCategoryLabel(t.category)}"`,
      `"${t.description.replace(/"/g, '""')}"`,
      t.amount.toFixed(2),
      `"${t.paymentMethod}"`,
      `"${t.recipientOrClient || ''}"`,
      `"${t.operator || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `fluxo_de_caixa_${tenant.name.replace(/\s+/g, '_')}_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onToast('Extrato de fluxo de caixa exportado em CSV com sucesso!');
  };

  return (
    <div className="space-y-6">
      
      {/* ================= TOPO: CABEÇALHO & STATUS DO CAIXA ================= */}
      <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-2xl shadow-inner">
              <Wallet className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl font-black text-white tracking-tight">Controle de Caixa & Fluxo Financeiro</h2>
                {isRegisterOpen ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[11px] font-bold">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Caixa Aberto ({cashRegister?.openedAt})
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-[11px] font-bold">
                    <Lock className="w-3 h-3 text-amber-400" />
                    Caixa Fechado
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Controle de vendas, recebimentos em PIX, cartões e dinheiro físico, despesas, sangrias e fechamento diário.
              </p>
            </div>
          </div>

          {/* Botões de Ação Rápida */}
          <div className="flex items-center gap-2 flex-wrap">
            {isRegisterOpen ? (
              <button
                type="button"
                onClick={() => {
                  setCountedCashInput(metrics.dinheiroNaGavetaEsperado.toFixed(2));
                  setShowCloseRegisterModal(true);
                }}
                className="py-2.5 px-3.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer"
              >
                <Lock className="w-4 h-4 text-amber-400" />
                <span>Fechar Caixa do Dia</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowOpenRegisterModal(true)}
                className="py-2.5 px-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-lg shadow-blue-600/20"
              >
                <Unlock className="w-4 h-4" />
                <span>Abrir Caixa do Dia</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowNewEntryModal(true)}
              className="py-2.5 px-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-xs flex items-center gap-2 transition cursor-pointer shadow-lg shadow-emerald-600/20"
            >
              <Plus className="w-4 h-4" />
              <span>+ Entrada (Receita)</span>
            </button>

            <button
              type="button"
              onClick={() => setShowNewExitModal(true)}
              className="py-2.5 px-3.5 bg-rose-600/90 hover:bg-rose-500 text-white font-black rounded-xl text-xs flex items-center gap-2 transition cursor-pointer shadow-lg shadow-rose-600/20"
            >
              <Minus className="w-4 h-4" />
              <span>- Saída (Despesa)</span>
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              title="Exportar Extrato em CSV"
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setShowReportModal(true)}
              title="Imprimir Relatório de Caixa"
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl transition cursor-pointer"
            >
              <Printer className="w-4 h-4 text-emerald-400" />
            </button>
          </div>

        </div>
      </div>

      {/* ================= BLOCO 1: CARDS DE MÉTRICAS FINANCEIRAS (KPIS) ================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Saldo Líquido do Caixa */}
        <div className="bg-[#0f172a] border border-[#1e293b] p-4 rounded-2xl relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Saldo Líquido</span>
            <span className={`p-2 rounded-xl text-xs font-bold flex items-center gap-1 ${
              metrics.saldoLiquido >= 0 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
            }`}>
              {metrics.saldoLiquido >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              {metrics.saldoLiquido >= 0 ? 'Positivo' : 'Negativo'}
            </span>
          </div>
          <div className="mt-2.5">
            <span className={`text-2xl font-black font-mono tracking-tight ${metrics.saldoLiquido >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {formatBRL(metrics.saldoLiquido)}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Receitas menos todas as saídas e despesas
          </p>
        </div>

        {/* Card 2: Total de Entradas (Vendas) */}
        <div className="bg-[#0f172a] border border-[#1e293b] p-4 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total de Entradas</span>
            <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <ArrowUpRight className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-2.5">
            <span className="text-2xl font-black font-mono text-emerald-400 tracking-tight">
              {formatBRL(metrics.totalEntradas)}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-1 font-mono">
            <span>PIX: {formatBRL(metrics.totalPIX)}</span>
            <span>·</span>
            <span>Dinheiro: {formatBRL(metrics.totalDinheiro)}</span>
          </div>
        </div>

        {/* Card 3: Total de Saídas (Despesas / Sangrias) */}
        <div className="bg-[#0f172a] border border-[#1e293b] p-4 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total de Saídas</span>
            <span className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <ArrowDownRight className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-2.5">
            <span className="text-2xl font-black font-mono text-rose-400 tracking-tight">
              {formatBRL(metrics.totalSaidas)}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-1 font-mono">
            <span>Sangrias: {formatBRL(metrics.saidasSangria)}</span>
            <span>·</span>
            <span>Comissões: {formatBRL(metrics.saidasComissao)}</span>
          </div>
        </div>

        {/* Card 4: Dinheiro Físico Esperado na Gaveta */}
        <div className="bg-gradient-to-br from-amber-950/20 via-[#0f172a] to-[#0f172a] border border-amber-500/30 p-4 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
              <Banknote className="w-3.5 h-3.5 text-amber-400" /> Dinheiro em Espécie
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
              Na Gaveta
            </span>
          </div>
          <div className="mt-2.5">
            <span className="text-2xl font-black font-mono text-amber-300 tracking-tight">
              {formatBRL(metrics.dinheiroNaGavetaEsperado)}
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
            Fundo inicial ({formatBRL(cashRegister?.initialBalance || 0)}) + Entradas em espécie - Saídas em dinheiro
          </p>
        </div>

      </div>

      {/* ================= BLOCO 2: DISTRIBUIÇÃO POR FORMA DE PAGAMENTO ================= */}
      <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-4">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Receipt className="w-4 h-4 text-blue-400" />
          Recebimentos por Forma de Pagamento no Período
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          
          <div className="bg-[#020617] border border-emerald-500/20 rounded-xl p-3">
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold mb-1">
              <QrCode className="w-4 h-4" /> PIX
            </div>
            <div className="text-base font-black font-mono text-white">
              {formatBRL(metrics.totalPIX)}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {metrics.totalEntradas > 0 ? `${((metrics.totalPIX / metrics.totalEntradas) * 100).toFixed(1)}% do faturamento` : '0%'}
            </div>
          </div>

          <div className="bg-[#020617] border border-amber-500/20 rounded-xl p-3">
            <div className="flex items-center gap-1.5 text-xs text-amber-400 font-bold mb-1">
              <Banknote className="w-4 h-4" /> Dinheiro
            </div>
            <div className="text-base font-black font-mono text-white">
              {formatBRL(metrics.totalDinheiro)}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {metrics.totalEntradas > 0 ? `${((metrics.totalDinheiro / metrics.totalEntradas) * 100).toFixed(1)}% do faturamento` : '0%'}
            </div>
          </div>

          <div className="bg-[#020617] border border-blue-500/20 rounded-xl p-3">
            <div className="flex items-center gap-1.5 text-xs text-blue-400 font-bold mb-1">
              <CreditCard className="w-4 h-4" /> Cartão de Débito
            </div>
            <div className="text-base font-black font-mono text-white">
              {formatBRL(metrics.totalCartaoDebito)}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {metrics.totalEntradas > 0 ? `${((metrics.totalCartaoDebito / metrics.totalEntradas) * 100).toFixed(1)}% do faturamento` : '0%'}
            </div>
          </div>

          <div className="bg-[#020617] border border-purple-500/20 rounded-xl p-3">
            <div className="flex items-center gap-1.5 text-xs text-purple-400 font-bold mb-1">
              <CreditCard className="w-4 h-4" /> Cartão de Crédito
            </div>
            <div className="text-base font-black font-mono text-white">
              {formatBRL(metrics.totalCartaoCredito)}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {metrics.totalEntradas > 0 ? `${((metrics.totalCartaoCredito / metrics.totalEntradas) * 100).toFixed(1)}% do faturamento` : '0%'}
            </div>
          </div>

        </div>
      </div>

      {/* ================= BLOCO 3: BARRA DE FILTROS & BUSCA ================= */}
      <div className="bg-[#0f172a] border border-[#1e293b] p-3.5 rounded-2xl flex flex-col md:flex-row gap-3 items-center justify-between">
        
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Período */}
          <div className="flex items-center gap-1 bg-[#020617] p-1 rounded-xl border border-[#1e293b] text-xs">
            <button
              type="button"
              onClick={() => setPeriodFilter('hoje')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                periodFilter === 'hoje' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={() => setPeriodFilter('ontem')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                periodFilter === 'ontem' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Ontem
            </button>
            <button
              type="button"
              onClick={() => setPeriodFilter('7dias')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                periodFilter === '7dias' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Últimos 7 Dias
            </button>
            <button
              type="button"
              onClick={() => setPeriodFilter('mes')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                periodFilter === 'mes' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Este Mês
            </button>
            <button
              type="button"
              onClick={() => setPeriodFilter('todos')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                periodFilter === 'todos' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Todos
            </button>
          </div>

          {/* Tipo de Transação */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="bg-[#020617] border border-[#1e293b] text-slate-200 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="todos">Todos os Tipos (Entradas & Saídas)</option>
            <option value="entrada">🟢 Apenas Entradas (Receitas)</option>
            <option value="saida">🔴 Apenas Saídas (Despesas)</option>
          </select>

          {/* Forma de Pagamento */}
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="bg-[#020617] border border-[#1e293b] text-slate-200 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="todos">Todas as Formas de Pagto</option>
            <option value="PIX">PIX</option>
            <option value="Dinheiro">Dinheiro</option>
            <option value="Cartão de Débito">Cartão de Débito</option>
            <option value="Cartão de Crédito">Cartão de Crédito</option>
          </select>
        </div>

        {/* Campo de Busca */}
        <div className="relative w-full md:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Buscar descrição ou cliente..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#020617] border border-[#1e293b] rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

      </div>

      {/* ================= BLOCO 4: TABELA DO EXTRATO DE FLUXO DE CAIXA ================= */}
      <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-[#1e293b] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-400" />
            <h3 className="font-bold text-white text-sm">Extrato de Movimentações ({filteredTransactions.length} lançamentos)</h3>
          </div>
          <span className="text-xs text-slate-400">
            Período: <strong className="text-white capitalize">{periodFilter}</strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-[#020617] text-slate-400 font-bold border-b border-[#1e293b]">
              <tr>
                <th className="py-3 px-4">Data & Hora</th>
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4">Descrição & Categoria</th>
                <th className="py-3 px-4">Cliente / Favorecido</th>
                <th className="py-3 px-4">Forma de Pagto</th>
                <th className="py-3 px-4 text-right">Valor</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e293b]/70">
              {filteredTransactions.map(trans => {
                const isEntrada = trans.type === 'entrada';
                return (
                  <tr key={trans.id} className="hover:bg-slate-800/40 transition">
                    
                    {/* Data & Hora */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-mono text-slate-200 font-semibold">{trans.date}</div>
                      <div className="text-[10px] text-slate-500">{trans.time || '12:00'}</div>
                    </td>

                    {/* Tipo (Badge Entrada ou Saída) */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {isEntrada ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          <ArrowUpRight className="w-3 h-3" /> ENTRADA
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-400 border border-rose-500/30">
                          <ArrowDownRight className="w-3 h-3" /> SAÍDA
                        </span>
                      )}
                    </td>

                    {/* Descrição & Categoria */}
                    <td className="py-3 px-4">
                      <div className="font-bold text-white max-w-xs truncate">{trans.description}</div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-medium">
                          {trans.categoryLabel || getCategoryLabel(trans.category)}
                        </span>
                        {trans.referenceId && (
                          <span className="text-blue-400">· Integrado ao Sistema</span>
                        )}
                      </div>
                    </td>

                    {/* Cliente / Favorecido */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="text-slate-300 font-medium">{trans.recipientOrClient || 'Balcão / Geral'}</span>
                    </td>

                    {/* Forma de Pagamento */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-700 font-mono text-[11px] text-slate-300">
                        {trans.paymentMethod}
                      </span>
                    </td>

                    {/* Valor */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <span className={`font-mono font-black text-sm ${isEntrada ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isEntrada ? '+' : '-'} {formatBRL(trans.amount)}
                      </span>
                    </td>

                    {/* Ações */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      {!trans.referenceId ? (
                        <button
                          type="button"
                          onClick={() => handleDeleteTransaction(trans.id)}
                          className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition cursor-pointer"
                          title="Excluir Lançamento Manual"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-600 font-mono" title="Lançamento gerado automaticamente por serviço concluído">
                          Automático
                        </span>
                      )}
                    </td>

                  </tr>
                );
              })}

              {filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 text-xs">
                    <Receipt className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
                    Nenhuma movimentação de caixa encontrada para os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================= MODAL: NOVA ENTRADA (RECEITA / VENDA) ================= */}
      {showNewEntryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <Plus className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-white text-base">Registrar Nova Entrada (Receita)</h3>
                  <p className="text-xs text-slate-400">Adicione uma venda de balcão, lavagem avulsa ou suprimento</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowNewEntryModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEntry} className="space-y-4 text-xs">
              
              <div>
                <label className="block text-slate-300 font-bold mb-1">Categoria da Entrada *</label>
                <select
                  value={entryCategory}
                  onChange={(e) => setEntryCategory(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="venda_balcao">🛍️ Venda de Balcão (Aromatizantes, Ceras, Bebidas)</option>
                  <option value="venda_lavagem">🚗 Venda de Lavagem Avulsa</option>
                  <option value="venda_oleo">🛢️ Venda de Óleo / Peça Avulsa</option>
                  <option value="suprimento_troco">💵 Suprimento / Aporte de Troco</option>
                  <option value="outra_entrada">➕ Outra Receita / Entrada</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Descrição do Lançamento *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: 2x Aromatizantes Little Trees + Cera Líquida"
                  value={entryDescription}
                  onChange={(e) => setEntryDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Valor (R$) *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-slate-500 font-bold">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="50,00"
                      value={entryAmount}
                      onChange={(e) => setEntryAmount(e.target.value)}
                      className="w-full bg-slate-950 border border-emerald-500/50 rounded-xl pl-9 pr-3 py-2 text-white font-mono font-black text-base focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">Forma de Pagamento *</label>
                  <select
                    value={entryPaymentMethod}
                    onChange={(e) => setEntryPaymentMethod(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="PIX">⚡ PIX</option>
                    <option value="Dinheiro">💵 Dinheiro (Gaveta)</option>
                    <option value="Cartão de Débito">💳 Cartão de Débito</option>
                    <option value="Cartão de Crédito">💳 Cartão de Crédito</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Cliente / Veículo (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ex: Pedro Henrique (Civic ABC-1234)"
                  value={entryClient}
                  onChange={(e) => setEntryClient(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Observações (Opcional)</label>
                <textarea
                  rows={2}
                  placeholder="Anotações internas sobre esta venda..."
                  value={entryNotes}
                  onChange={(e) => setEntryNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNewEntryModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl transition cursor-pointer shadow-lg shadow-emerald-600/30 flex items-center gap-1.5"
                >
                  <CheckCircle className="w-4 h-4" />
                  Salvar Entrada
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* ================= MODAL: NOVA SAÍDA (DESPESA / SANGRIA) ================= */}
      {showNewExitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  <Minus className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-white text-base">Registrar Nova Saída (Despesa / Sangria)</h3>
                  <p className="text-xs text-slate-400">Retiradas do dono, pagamento de comissões, compras ou contas</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowNewExitModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveExit} className="space-y-4 text-xs">
              
              <div>
                <label className="block text-slate-300 font-bold mb-1">Categoria da Saída *</label>
                <select
                  value={exitCategory}
                  onChange={(e) => setExitCategory(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-rose-500 cursor-pointer"
                >
                  <option value="sangria_retirada">💸 Sangria / Retirada do Dono (Depósito ou Pró-labore)</option>
                  <option value="comissao_equipe">💼 Pagamento de Comissão da Equipe</option>
                  <option value="compra_insumos">📦 Compra de Insumos (Shampoo, Cera, Panos)</option>
                  <option value="despesa_operacional">💡 Contas Operacionais (Água, Energia, Aluguel)</option>
                  <option value="manutencao">🔧 Manutenção de Equipamentos / Lavadoras</option>
                  <option value="alimentacao">☕ Alimentação / Lanche da Equipe</option>
                  <option value="outra_saida">➖ Outra Saída</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Descrição do Pagamento / Retirada *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Compra de 50L de Shampoo Automotivo Neutro"
                  value={exitDescription}
                  onChange={(e) => setExitDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Valor da Saída (R$) *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-slate-500 font-bold">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="120,00"
                      value={exitAmount}
                      onChange={(e) => setExitAmount(e.target.value)}
                      className="w-full bg-slate-950 border border-rose-500/50 rounded-xl pl-9 pr-3 py-2 text-white font-mono font-black text-base focus:outline-none focus:border-rose-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">Forma de Saída *</label>
                  <select
                    value={exitPaymentMethod}
                    onChange={(e) => setExitPaymentMethod(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-rose-500 cursor-pointer"
                  >
                    <option value="Dinheiro">💵 Dinheiro da Gaveta</option>
                    <option value="PIX">⚡ PIX da Empresa</option>
                    <option value="Cartão de Débito">💳 Cartão de Débito</option>
                    <option value="Cartão de Crédito">💳 Cartão de Crédito</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Favorecido / Fornecedor / Lavador</label>
                <input
                  type="text"
                  placeholder="Ex: Distribuidora de Produtos / Lavador Carlos"
                  value={exitRecipient}
                  onChange={(e) => setExitRecipient(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Observações (Opcional)</label>
                <textarea
                  rows={2}
                  placeholder="Número de nota fiscal, recibo ou detalhes..."
                  value={exitNotes}
                  onChange={(e) => setExitNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNewExitModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-black rounded-xl transition cursor-pointer shadow-lg shadow-rose-600/30 flex items-center gap-1.5"
                >
                  <Minus className="w-4 h-4" />
                  Salvar Saída
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* ================= MODAL: ABRIR CAIXA DO DIA ================= */}
      {showOpenRegisterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  <Unlock className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-white text-base">Abrir Caixa do Dia</h3>
                  <p className="text-xs text-slate-400">Defina o fundo de troco inicial da gaveta</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowOpenRegisterModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleOpenRegister} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">Fundo de Troco Inicial (R$) *</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-500 font-bold">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={initialBalanceInput}
                    onChange={(e) => setInitialBalanceInput(e.target.value)}
                    className="w-full bg-slate-950 border border-blue-500/50 rounded-xl pl-9 pr-3 py-2 text-white font-mono font-black text-lg focus:outline-none focus:border-blue-400"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Valor em cédulas e moedas presentes na gaveta para iniciar as operações.
                </p>
              </div>

              <div className="p-3 bg-[#020617] border border-blue-500/20 rounded-xl text-slate-300 space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span>Data de Abertura:</span>
                  <strong className="text-white font-mono">{todayStr}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Horário:</span>
                  <strong className="text-white font-mono">{new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</strong>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowOpenRegisterModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl transition cursor-pointer shadow-lg shadow-blue-600/30 flex items-center gap-1.5"
                >
                  <Unlock className="w-4 h-4" />
                  Confirmar Abertura
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* ================= MODAL: FECHAR CAIXA DO DIA ================= */}
      {showCloseRegisterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Lock className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-white text-base">Fechamento de Caixa do Dia</h3>
                  <p className="text-xs text-slate-400">Conferência de valores e encerramento das movimentações</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCloseRegisterModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCloseRegister} className="space-y-4 text-xs">
              
              {/* Resumo do Dia para Conferência */}
              <div className="bg-[#020617] border border-slate-800 rounded-xl p-3.5 space-y-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Resumo Apurado pelo Sistema (Hoje)
                </span>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block">Total em PIX:</span>
                    <strong className="text-emerald-400 font-mono text-sm">{formatBRL(metrics.totalPIX)}</strong>
                  </div>
                  <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block">Total em Cartões:</span>
                    <strong className="text-blue-400 font-mono text-sm">{formatBRL(metrics.totalCartaoDebito + metrics.totalCartaoCredito)}</strong>
                  </div>
                  <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block">Fundo de Troco Inicial:</span>
                    <strong className="text-slate-200 font-mono text-sm">{formatBRL(cashRegister?.initialBalance || 0)}</strong>
                  </div>
                  <div className="bg-slate-900/80 p-2 rounded-lg border border-amber-500/30">
                    <span className="text-amber-400 font-bold block">Dinheiro Esperado na Gaveta:</span>
                    <strong className="text-amber-300 font-mono text-sm">{formatBRL(metrics.dinheiroNaGavetaEsperado)}</strong>
                  </div>
                </div>
              </div>

              {/* Entrada de Dinheiro Contado */}
              <div>
                <label className="block text-slate-200 font-bold mb-1">
                  💵 Valor Físico Contado na Gaveta (R$) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-500 font-bold">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={countedCashInput}
                    onChange={(e) => setCountedCashInput(e.target.value)}
                    className="w-full bg-slate-950 border border-amber-500/60 rounded-xl pl-9 pr-3 py-2 text-white font-mono font-black text-lg focus:outline-none focus:border-amber-400"
                  />
                </div>

                {/* Cálculo de Diferença em Tempo Real */}
                {countedCashInput && (
                  <div className="mt-2 p-2.5 rounded-xl border flex items-center justify-between text-xs">
                    {parseFloat(countedCashInput.replace(',', '.')) === metrics.dinheiroNaGavetaEsperado ? (
                      <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                        <CheckCircle className="w-4 h-4" /> Caixa bateu 100% sem sobra ou falta!
                      </span>
                    ) : parseFloat(countedCashInput.replace(',', '.')) > metrics.dinheiroNaGavetaEsperado ? (
                      <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                        <ArrowUpRight className="w-4 h-4" /> Sobra de caixa: + {formatBRL(parseFloat(countedCashInput.replace(',', '.')) - metrics.dinheiroNaGavetaEsperado)}
                      </span>
                    ) : (
                      <span className="text-rose-400 font-bold flex items-center gap-1.5">
                        <ArrowDownRight className="w-4 h-4" /> Falta de caixa: - {formatBRL(metrics.dinheiroNaGavetaEsperado - parseFloat(countedCashInput.replace(',', '.')))}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Observações do Fechamento</label>
                <textarea
                  rows={2}
                  placeholder="Ex: Tudo conferido e depositado no cofre..."
                  value={closingNotes}
                  onChange={(e) => setClosingNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCloseRegisterModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl transition cursor-pointer shadow-lg shadow-amber-500/30 flex items-center gap-1.5"
                >
                  <Lock className="w-4 h-4" />
                  Fechar Caixa & Gerar Relatório
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* ================= MODAL: COMPROVANTE / RELATÓRIO DE FECHAMENTO ================= */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <Receipt className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-white text-base">Relatório de Fechamento de Caixa</h3>
                  <p className="text-xs text-slate-400">{tenant.nomeFantasia || tenant.name} - {todayStr}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cupom Impresso Formatado */}
            <div className="bg-white text-slate-950 font-mono text-xs p-5 rounded-xl shadow-inner space-y-3 leading-relaxed">
              <div className="text-center border-b border-dashed border-slate-300 pb-3">
                <h4 className="font-black text-sm uppercase">{tenant.nomeFantasia || tenant.name}</h4>
                <p className="text-[10px] text-slate-600">RELATÓRIO DE FECHAMENTO DE CAIXA</p>
                <p className="text-[10px] text-slate-600">Data: {todayStr} | Emitido às {new Date().toLocaleTimeString('pt-BR')}</p>
              </div>

              <div className="space-y-1 border-b border-dashed border-slate-300 pb-2">
                <div className="flex justify-between font-bold">
                  <span>(+) TOTAL DE ENTRADAS:</span>
                  <span className="text-emerald-700">{formatBRL(metrics.totalEntradas)}</span>
                </div>
                <div className="flex justify-between pl-2 text-[11px] text-slate-600">
                  <span>· PIX:</span>
                  <span>{formatBRL(metrics.totalPIX)}</span>
                </div>
                <div className="flex justify-between pl-2 text-[11px] text-slate-600">
                  <span>· Dinheiro:</span>
                  <span>{formatBRL(metrics.totalDinheiro)}</span>
                </div>
                <div className="flex justify-between pl-2 text-[11px] text-slate-600">
                  <span>· Cartão Débito:</span>
                  <span>{formatBRL(metrics.totalCartaoDebito)}</span>
                </div>
                <div className="flex justify-between pl-2 text-[11px] text-slate-600">
                  <span>· Cartão Crédito:</span>
                  <span>{formatBRL(metrics.totalCartaoCredito)}</span>
                </div>
              </div>

              <div className="space-y-1 border-b border-dashed border-slate-300 pb-2">
                <div className="flex justify-between font-bold">
                  <span>(-) TOTAL DE SAÍDAS:</span>
                  <span className="text-rose-700">{formatBRL(metrics.totalSaidas)}</span>
                </div>
                <div className="flex justify-between pl-2 text-[11px] text-slate-600">
                  <span>· Sangrias / Retiradas:</span>
                  <span>{formatBRL(metrics.saidasSangria)}</span>
                </div>
                <div className="flex justify-between pl-2 text-[11px] text-slate-600">
                  <span>· Comissões Pagas:</span>
                  <span>{formatBRL(metrics.saidasComissao)}</span>
                </div>
                <div className="flex justify-between pl-2 text-[11px] text-slate-600">
                  <span>· Insumos / Estoque:</span>
                  <span>{formatBRL(metrics.saidasInsumos)}</span>
                </div>
                <div className="flex justify-between pl-2 text-[11px] text-slate-600">
                  <span>· Despesas Operacionais:</span>
                  <span>{formatBRL(metrics.saidasOperacional)}</span>
                </div>
              </div>

              <div className="space-y-1 pt-1 border-b border-dashed border-slate-300 pb-2">
                <div className="flex justify-between font-black text-sm">
                  <span>SALDO LÍQUIDO FINAL:</span>
                  <span className={metrics.saldoLiquido >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                    {formatBRL(metrics.saldoLiquido)}
                  </span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-600">
                  <span>Dinheiro Físico na Gaveta:</span>
                  <span className="font-bold">{formatBRL(metrics.dinheiroNaGavetaEsperado)}</span>
                </div>
              </div>

              <div className="text-center text-[10px] text-slate-500 pt-1">
                WashAuto OS - Gestão Inteligente para Lava-Jato
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  const text = `📊 *Fechamento de Caixa - ${tenant.nomeFantasia || tenant.name}*\n📅 Data: ${todayStr}\n\n*Entradas:* ${formatBRL(metrics.totalEntradas)}\n• PIX: ${formatBRL(metrics.totalPIX)}\n• Dinheiro: ${formatBRL(metrics.totalDinheiro)}\n• Cartões: ${formatBRL(metrics.totalCartaoDebito + metrics.totalCartaoCredito)}\n\n*Saídas:* ${formatBRL(metrics.totalSaidas)}\n• Sangrias: ${formatBRL(metrics.saidasSangria)}\n• Comissões: ${formatBRL(metrics.saidasComissao)}\n\n*Saldo Líquido:* ${formatBRL(metrics.saldoLiquido)}\n💵 Dinheiro em Gaveta: ${formatBRL(metrics.dinheiroNaGavetaEsperado)}`;
                  window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                <span>Enviar p/ WhatsApp</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Printer className="w-4 h-4" /> Imprimir
                </button>
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
