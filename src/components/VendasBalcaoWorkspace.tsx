import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingBag, 
  ShoppingCart, 
  DollarSign, 
  Plus, 
  Minus, 
  Search, 
  Filter, 
  Trash2, 
  CheckCircle, 
  Printer, 
  Sparkles, 
  AlertTriangle, 
  CreditCard, 
  Banknote, 
  QrCode, 
  Receipt, 
  Package, 
  ArrowRight, 
  Clock, 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  Edit, 
  X,
  FileSpreadsheet,
  Download,
  Percent,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  Check,
  Copy,
  MessageCircle,
  Bell,
  SlidersHorizontal,
  CheckCheck,
  RefreshCw
} from 'lucide-react';
import { Tenant, SaleProductItem, SaleProductCategory, SaleCartItem, CounterSaleRecord, CashPaymentMethod } from '../types';
import { 
  saveSaleProductToFirestore, 
  deleteSaleProductFromFirestore, 
  subscribeToTenantSaleProducts,
  saveCounterSaleToFirestore,
  subscribeToTenantCounterSales
} from '../lib/firebaseService';

interface VendasBalcaoWorkspaceProps {
  tenant: Tenant;
  onToast: (msg: string) => void;
}

export const VendasBalcaoWorkspace: React.FC<VendasBalcaoWorkspaceProps> = ({
  tenant,
  onToast
}) => {
  // Lista de Produtos de Venda e Vendas Realizadas
  const [products, setProducts] = useState<SaleProductItem[]>([]);
  const [salesHistory, setSalesHistory] = useState<CounterSaleRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Navegação Interna da Dashboard de Vendas
  // 'pdv' = Frente de Caixa / Venda Rápida
  // 'financeiro' = Fluxo Financeiro Exclusivo do Balcão (Separado do fluxo operacional)
  // 'catalogo' = Cadastro e Gestão de Produtos
  // 'historico' = Histórico de Vendas e Recibos
  // 'alertas' = Alertas de Estoque Mínimo & Notificações do Administrador
  const [viewMode, setViewMode] = useState<'pdv' | 'financeiro' | 'catalogo' | 'historico' | 'alertas'>('pdv');

  // Filtros de Categoria no PDV
  const [selectedCategory, setSelectedCategory] = useState<string>('todos');
  const [productSearch, setProductSearch] = useState('');

  // Filtros e Estados da Seção de Alertas de Estoque
  const [alertFilter, setAlertFilter] = useState<'todos_alertas' | 'zerados' | 'minimo' | 'todos_produtos'>('todos_alertas');
  const [alertSearch, setAlertSearch] = useState('');
  const [quickAddQuantities, setQuickAddQuantities] = useState<{ [productId: string]: string }>({});
  const [editingMinStockProduct, setEditingMinStockProduct] = useState<SaleProductItem | null>(null);
  const [newMinStockInput, setNewMinStockInput] = useState<string>('5');

  // Carrinho de Compras (Frente de Caixa / PDV)
  const [cart, setCart] = useState<SaleCartItem[]>([]);
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<CashPaymentMethod>('PIX');
  const [discountAmount, setDiscountAmount] = useState<string>('0');
  const [cashGiven, setCashGiven] = useState<string>('');
  const [saleNotes, setSaleNotes] = useState('');
  
  // Controle de Separação Financeira do Caixa Operacional
  // Por padrão é FALSE: a transação é registrada no fluxo financeiro próprio do balcão!
  const [integrateWithOperationalCash, setIntegrateWithOperationalCash] = useState<boolean>(false);

  // Modal de Ajuste de Quantidade Rápida de Produto
  const [selectedProductForQuantity, setSelectedProductForQuantity] = useState<SaleProductItem | null>(null);
  const [quantityInput, setQuantityInput] = useState<number>(1);

  // Modais de Cadastro / Edição
  const [showNewProductModal, setShowNewProductModal] = useState(false);
  const [showEditProductModal, setShowEditProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<SaleProductItem | null>(null);

  // Modal de Comprovante de Venda
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [lastCompletedSale, setLastCompletedSale] = useState<CounterSaleRecord | null>(null);

  // Filtros do Fluxo Financeiro de Balcão
  const [financialPeriod, setFinancialPeriod] = useState<'hoje' | 'ontem' | '7dias' | 'mes' | 'todos'>('hoje');
  const [financialPaymentFilter, setFinancialPaymentFilter] = useState<string>('todos');

  // Formulário de Cadastro de Produto de Venda
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState<SaleProductCategory>('aromatizantes');
  const [formBarcode, setFormBarcode] = useState('');
  const [formCostPrice, setFormCostPrice] = useState<string>('10.00');
  const [formSalePrice, setFormSalePrice] = useState<string>('20.00');
  const [formStock, setFormStock] = useState<string>('15');
  const [formMinStock, setFormMinStock] = useState<string>('5');
  const [formUnit, setFormUnit] = useState('unidades');
  const [formNotes, setFormNotes] = useState('');

  // Produtos Padrão Iniciais (se vazio)
  const defaultSaleProducts: SaleProductItem[] = useMemo(() => [
    {
      id: `sprod-1`,
      tenantId: tenant.id,
      name: 'Aromatizante Little Trees (Baunilha)',
      category: 'aromatizantes',
      categoryLabel: 'Aromatizantes',
      costPrice: 7.50,
      salePrice: 15.00,
      stock: 24,
      minStock: 5,
      unit: 'unidades',
      updatedAt: new Date().toISOString()
    },
    {
      id: `sprod-2`,
      tenantId: tenant.id,
      name: 'Cera Líquida Spray de Brilho Rápido 500ml',
      category: 'estetica_automotiva',
      categoryLabel: 'Estética Automotiva',
      costPrice: 18.00,
      salePrice: 35.00,
      stock: 12,
      minStock: 3,
      unit: 'frascos',
      updatedAt: new Date().toISOString()
    },
    {
      id: `sprod-3`,
      tenantId: tenant.id,
      name: 'Pretinho Gel Brilho Molhado Pneus 500g',
      category: 'estetica_automotiva',
      categoryLabel: 'Estética Automotiva',
      costPrice: 14.00,
      salePrice: 28.00,
      stock: 18,
      minStock: 4,
      unit: 'frascos',
      updatedAt: new Date().toISOString()
    },
    {
      id: `sprod-4`,
      tenantId: tenant.id,
      name: 'Toalha de Microfibra 40x40cm Extra Macia',
      category: 'acessorios',
      categoryLabel: 'Acessórios',
      costPrice: 9.00,
      salePrice: 20.00,
      stock: 30,
      minStock: 8,
      unit: 'unidades',
      updatedAt: new Date().toISOString()
    },
    {
      id: `sprod-5`,
      tenantId: tenant.id,
      name: 'Refrigerante Coca-Cola Lata 350ml',
      category: 'conveniencia_bebidas',
      categoryLabel: 'Bebidas & Conveniência',
      costPrice: 3.20,
      salePrice: 6.00,
      stock: 36,
      minStock: 10,
      unit: 'latas',
      updatedAt: new Date().toISOString()
    },
    {
      id: `sprod-6`,
      tenantId: tenant.id,
      name: 'Água Mineral sem Gás 500ml',
      category: 'conveniencia_bebidas',
      categoryLabel: 'Bebidas & Conveniência',
      costPrice: 1.50,
      salePrice: 4.00,
      stock: 40,
      minStock: 12,
      unit: 'garrafas',
      updatedAt: new Date().toISOString()
    },
    {
      id: `sprod-7`,
      tenantId: tenant.id,
      name: 'Palheta Limpador Para-brisa Silicone 18"',
      category: 'palhetas_limpador',
      categoryLabel: 'Palhetas',
      costPrice: 20.00,
      salePrice: 45.00,
      stock: 8,
      minStock: 2,
      unit: 'unidades',
      updatedAt: new Date().toISOString()
    }
  ], [tenant.id]);

  // Sincronização em Tempo Real via Firestore
  useEffect(() => {
    if (!tenant.id) return;
    setLoading(true);

    const unsubProducts = subscribeToTenantSaleProducts(tenant.id, (items) => {
      if (items.length === 0) {
        setProducts(defaultSaleProducts);
      } else {
        setProducts(items);
      }
      setLoading(false);
    });

    const unsubSales = subscribeToTenantCounterSales(tenant.id, (items) => {
      setSalesHistory(items);
    });

    return () => {
      unsubProducts();
      unsubSales();
    };
  }, [tenant.id, defaultSaleProducts]);

  // Formatação de Moeda
  const formatBRL = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Produtos Filtrados para o PDV
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      if (selectedCategory !== 'todos' && p.category !== selectedCategory) return false;
      if (productSearch.trim()) {
        const q = productSearch.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesBarcode = p.barcode?.toLowerCase().includes(q);
        if (!matchesName && !matchesBarcode) return false;
      }
      return true;
    });
  }, [products, selectedCategory, productSearch]);

  // Cálculos do Carrinho
  const cartSubtotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.totalPrice, 0);
  }, [cart]);

  const cartTotalCost = useMemo(() => {
    return cart.reduce((acc, item) => acc + ((item.costPrice || 0) * item.quantity), 0);
  }, [cart]);

  const discountVal = useMemo(() => {
    const val = parseFloat(discountAmount.replace(',', '.')) || 0;
    return val > cartSubtotal ? cartSubtotal : val;
  }, [discountAmount, cartSubtotal]);

  const cartTotal = useMemo(() => {
    return Math.max(0, cartSubtotal - discountVal);
  }, [cartSubtotal, discountVal]);

  const cartEstimatedProfit = useMemo(() => {
    return cartTotal - cartTotalCost;
  }, [cartTotal, cartTotalCost]);

  const cashChange = useMemo(() => {
    if (paymentMethod !== 'Dinheiro') return 0;
    const given = parseFloat(cashGiven.replace(',', '.')) || 0;
    return given > cartTotal ? given - cartTotal : 0;
  }, [paymentMethod, cashGiven, cartTotal]);

  // Vendas Filtradas para o Fluxo Financeiro Exclusivo do Balcão
  const filteredFinancialSales = useMemo(() => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    return salesHistory.filter(s => {
      if (financialPeriod === 'hoje' && s.date !== todayStr) return false;
      if (financialPeriod === 'ontem' && s.date !== yesterday) return false;
      if (financialPeriod === '7dias') {
        const itemDate = new Date(s.date);
        if (itemDate < sevenDaysAgo) return false;
      }
      if (financialPeriod === 'mes' && !s.date.startsWith(currentMonthStr)) return false;

      if (financialPaymentFilter !== 'todos' && s.paymentMethod !== financialPaymentFilter) return false;

      return true;
    });
  }, [salesHistory, financialPeriod, financialPaymentFilter, todayStr]);

  // Métricas do Fluxo Financeiro Exclusivo do Balcão
  const financialMetrics = useMemo(() => {
    let receitaBruta = 0;
    let custoTotalMercadorias = 0;
    let totalPIX = 0;
    let totalDinheiro = 0;
    let totalDebito = 0;
    let totalCredito = 0;

    filteredFinancialSales.forEach(s => {
      receitaBruta += s.totalAmount;
      custoTotalMercadorias += (s.totalCost || 0);

      if (s.paymentMethod === 'PIX') totalPIX += s.totalAmount;
      else if (s.paymentMethod === 'Dinheiro') totalDinheiro += s.totalAmount;
      else if (s.paymentMethod === 'Cartão de Débito') totalDebito += s.totalAmount;
      else if (s.paymentMethod === 'Cartão de Crédito') totalCredito += s.totalAmount;
    });

    const lucroBruto = receitaBruta - custoTotalMercadorias;
    const margemPercentual = receitaBruta > 0 ? (lucroBruto / receitaBruta) * 100 : 0;

    return {
      receitaBruta,
      custoTotalMercadorias,
      lucroBruto,
      margemPercentual,
      totalPIX,
      totalDinheiro,
      totalDebito,
      totalCredito,
      quantidadeVendas: filteredFinancialSales.length,
      ticketMedio: filteredFinancialSales.length > 0 ? receitaBruta / filteredFinancialSales.length : 0
    };
  }, [filteredFinancialSales]);

  // ================= CÁLCULOS E MÉTRICAS DE ALERTAS DE ESTOQUE =================
  // Produtos com Estoque Crítico (<= minStock definido)
  const lowStockAlertProducts = useMemo(() => {
    return products.filter(p => p.stock <= p.minStock);
  }, [products]);

  const outOfStockCount = useMemo(() => {
    return lowStockAlertProducts.filter(p => p.stock <= 0).length;
  }, [lowStockAlertProducts]);

  const atMinStockCount = useMemo(() => {
    return lowStockAlertProducts.filter(p => p.stock > 0 && p.stock <= p.minStock).length;
  }, [lowStockAlertProducts]);

  const healthyStockCount = useMemo(() => {
    return products.filter(p => p.stock > p.minStock).length;
  }, [products]);

  // Estimativa do custo total de reposição para levar os produtos em alerta até 2x o estoque mínimo
  const estimatedRestockCost = useMemo(() => {
    return lowStockAlertProducts.reduce((acc, p) => {
      const neededQty = Math.max(0, (p.minStock * 2) - p.stock);
      return acc + (neededQty * (p.costPrice || 0));
    }, 0);
  }, [lowStockAlertProducts]);

  // Lista filtrada para a seção de alertas
  const displayedAlertProducts = useMemo(() => {
    let list: SaleProductItem[] = [];
    if (alertFilter === 'zerados') {
      list = products.filter(p => p.stock <= 0);
    } else if (alertFilter === 'minimo') {
      list = products.filter(p => p.stock > 0 && p.stock <= p.minStock);
    } else if (alertFilter === 'todos_produtos') {
      list = [...products].sort((a, b) => (a.stock - a.minStock) - (b.stock - b.minStock));
    } else {
      // 'todos_alertas'
      list = [...lowStockAlertProducts].sort((a, b) => {
        if (a.stock === 0 && b.stock > 0) return -1;
        if (b.stock === 0 && a.stock > 0) return 1;
        return (a.stock / Math.max(1, a.minStock)) - (b.stock / Math.max(1, b.minStock));
      });
    }

    if (alertSearch.trim()) {
      const q = alertSearch.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q) || p.barcode?.toLowerCase().includes(q));
    }

    return list;
  }, [products, lowStockAlertProducts, alertFilter, alertSearch]);

  // Entrada Rápida de Estoque (+5, +10, etc.)
  const handleQuickAddStock = async (product: SaleProductItem, addedQty: number) => {
    if (addedQty <= 0) return;
    const newStock = product.stock + addedQty;
    const updated: SaleProductItem = {
      ...product,
      stock: newStock,
      updatedAt: new Date().toISOString()
    };
    await saveSaleProductToFirestore(tenant.id, updated);
    onToast(`✅ Estoque de "${product.name}" atualizado: +${addedQty} ${product.unit} (Total: ${newStock})`);
  };

  // Entrada Personalizada de Estoque
  const handleCustomAddStock = async (product: SaleProductItem) => {
    const rawVal = quickAddQuantities[product.id] || '';
    const num = parseInt(rawVal, 10);
    if (isNaN(num) || num <= 0) {
      onToast('Informe uma quantidade válida para adicionar ao estoque.');
      return;
    }
    await handleQuickAddStock(product, num);
    setQuickAddQuantities(prev => ({ ...prev, [product.id]: '' }));
  };

  // Atualizar Nível Mínimo Definido
  const handleSaveMinStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMinStockProduct) return;
    const newMin = parseInt(newMinStockInput, 10);
    if (isNaN(newMin) || newMin < 0) {
      onToast('Informe um número válido para o nível mínimo.');
      return;
    }
    const updated: SaleProductItem = {
      ...editingMinStockProduct,
      minStock: newMin,
      updatedAt: new Date().toISOString()
    };
    await saveSaleProductToFirestore(tenant.id, updated);
    onToast(`⚙️ Nível mínimo de alerta para "${editingMinStockProduct.name}" redefinido para ${newMin} ${editingMinStockProduct.unit}!`);
    setEditingMinStockProduct(null);
  };

  // Copiar Lista de Reposição para o Fornecedor (WhatsApp)
  const handleCopyRestockList = () => {
    if (lowStockAlertProducts.length === 0) {
      onToast('Nenhum produto está no nível mínimo de estoque no momento!');
      return;
    }

    const dateStr = new Date().toLocaleDateString('pt-BR');
    let text = `*📦 LISTA DE REPOSIÇÃO DE ESTOQUE - ${tenant.nomeFantasia || tenant.name}*\n`;
    text += `*Data:* ${dateStr}\n`;
    text += `*Total de itens em alerta:* ${lowStockAlertProducts.length}\n\n`;
    text += `*Produtos para Cotação / Reposição:*\n`;

    lowStockAlertProducts.forEach((p, idx) => {
      const suggestedBuy = Math.max(1, (p.minStock * 2) - p.stock);
      const status = p.stock === 0 ? '🚨 ESGOTADO' : `⚠️ Estoque Crítico (${p.stock}/${p.minStock})`;
      text += `${idx + 1}. *${p.name}*\n`;
      text += `   - Situação: ${status}\n`;
      text += `   - Estoque Atual: ${p.stock} ${p.unit}\n`;
      text += `   - Mínimo Definido: ${p.minStock} ${p.unit}\n`;
      text += `   - Sugestão de Compra: *+${suggestedBuy} ${p.unit}*\n\n`;
    });

    text += `_Notificação gerada automaticamente pela Central de Alertas de Vendas Balcão._`;

    navigator.clipboard.writeText(text).then(() => {
      onToast('📋 Lista copiada para a área de transferência! Pronta para colar no WhatsApp do fornecedor.');
    }).catch(() => {
      onToast('Lista preparada com sucesso!');
    });
  };

  // Abrir Modal de Quantidade do Produto
  const handleOpenQuantitySelector = (product: SaleProductItem) => {
    if (product.stock <= 0) {
      onToast(`⚠️ O produto "${product.name}" está sem estoque no momento.`);
      return;
    }
    setSelectedProductForQuantity(product);
    setQuantityInput(1);
  };

  // Confirmar Adição ao Carrinho com a Quantidade Escolhida
  const handleConfirmAddToCartWithQuantity = (product: SaleProductItem, qty: number) => {
    if (qty <= 0) return;
    if (qty > product.stock) {
      onToast(`Estoque insuficiente! Disponível: ${product.stock} ${product.unit}.`);
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        const newQty = existing.quantity + qty;
        if (newQty > product.stock) {
          onToast(`Limite atingido! Estoque máximo: ${product.stock} unidades.`);
          return prev;
        }
        return prev.map(item => 
          item.productId === product.id
            ? { 
                ...item, 
                quantity: newQty, 
                totalPrice: newQty * item.unitPrice 
              }
            : item
        );
      } else {
        return [...prev, {
          productId: product.id,
          name: product.name,
          unitPrice: product.salePrice,
          costPrice: product.costPrice,
          quantity: qty,
          totalPrice: qty * product.salePrice
        }];
      }
    });

    setSelectedProductForQuantity(null);
    onToast(`🛒 ${qty}x "${product.name}" adicionado(s) ao carrinho!`);
  };

  // Alterar Quantidade Diretamente no Carrinho
  const handleUpdateCartQuantity = (productId: string, delta: number) => {
    setCart(prev => {
      const target = prev.find(i => i.productId === productId);
      if (!target) return prev;

      const product = products.find(p => p.id === productId);
      const newQty = target.quantity + delta;

      if (newQty <= 0) {
        return prev.filter(i => i.productId !== productId);
      }

      if (product && newQty > product.stock) {
        onToast(`Estoque máximo atingido (${product.stock} unidades).`);
        return prev;
      }

      return prev.map(item => 
        item.productId === productId
          ? { ...item, quantity: newQty, totalPrice: newQty * item.unitPrice }
          : item
      );
    });
  };

  // Alterar Quantidade Digitada no Carrinho
  const handleSetCartQuantity = (productId: string, directQty: number) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    if (directQty <= 0) {
      setCart(prev => prev.filter(i => i.productId !== productId));
      return;
    }

    const clampedQty = Math.min(directQty, product.stock);
    if (directQty > product.stock) {
      onToast(`Quantidade ajustada para o estoque máximo disponível (${product.stock}).`);
    }

    setCart(prev => prev.map(item => 
      item.productId === productId
        ? { ...item, quantity: clampedQty, totalPrice: clampedQty * item.unitPrice }
        : item
    ));
  };

  // Remover do Carrinho
  const handleRemoveFromCart = (productId: string) => {
    setCart(prev => prev.filter(i => i.productId !== productId));
  };

  // Limpar Carrinho
  const handleClearCart = () => {
    setCart([]);
    setClientName('');
    setClientPhone('');
    setDiscountAmount('0');
    setCashGiven('');
    setSaleNotes('');
  };

  // Finalizar Venda no Balcão
  const handleCheckoutSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) {
      onToast('Adicione pelo menos um produto ao carrinho.');
      return;
    }

    const now = new Date();
    const saleId = `sale-${Date.now()}`;
    const saleNum = salesHistory.length + 1001;
    const profit = cartTotal - cartTotalCost;
    const margin = cartTotal > 0 ? (profit / cartTotal) * 100 : 0;

    const saleRecord: CounterSaleRecord = {
      id: saleId,
      tenantId: tenant.id,
      saleNumber: saleNum,
      items: [...cart],
      subtotal: cartSubtotal,
      discount: discountVal,
      totalCost: cartTotalCost,
      grossProfit: profit,
      profitMarginPercent: margin,
      totalAmount: cartTotal,
      paymentMethod,
      clientName: clientName.trim() || 'Consumidor Final',
      clientPhone: clientPhone.trim() || undefined,
      cashGiven: paymentMethod === 'Dinheiro' ? (parseFloat(cashGiven.replace(',', '.')) || cartTotal) : undefined,
      changeGiven: paymentMethod === 'Dinheiro' ? cashChange : undefined,
      operator: 'Operador de Balcão',
      integrateWithOperationalCash, // Separado por padrão!
      date: todayStr,
      time: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      notes: saleNotes || undefined,
      createdAt: now.toISOString()
    };

    // 1. Salva a Venda no Firestore
    // Se integrateWithOperationalCash for false, fica estritamente no financeiro de vendas de balcão!
    await saveCounterSaleToFirestore(tenant.id, saleRecord);

    // 2. Atualiza e dá baixa no estoque de cada produto vendido
    const triggeredLowStockAlerts: { name: string; remaining: number; min: number }[] = [];
    for (const item of cart) {
      const prod = products.find(p => p.id === item.productId);
      if (prod) {
        const updatedStock = Math.max(0, prod.stock - item.quantity);
        if (updatedStock <= prod.minStock) {
          triggeredLowStockAlerts.push({
            name: prod.name,
            remaining: updatedStock,
            min: prod.minStock
          });
        }
        const updatedProduct: SaleProductItem = {
          ...prod,
          stock: updatedStock,
          updatedAt: new Date().toISOString()
        };
        await saveSaleProductToFirestore(tenant.id, updatedProduct);
      }
    }

    setLastCompletedSale(saleRecord);
    setShowReceiptModal(true);
    handleClearCart();
    
    if (integrateWithOperationalCash) {
      onToast(`🎉 Venda #${saleNum} de ${formatBRL(cartTotal)} concluída e lançada no Caixa Geral!`);
    } else {
      onToast(`🎉 Venda #${saleNum} de ${formatBRL(cartTotal)} registrada no Fluxo Financeiro de Balcão!`);
    }

    // Notificação ao administrador se atingir o estoque mínimo
    if (triggeredLowStockAlerts.length > 0) {
      setTimeout(() => {
        const alertSummary = triggeredLowStockAlerts
          .map(a => `"${a.name}" (${a.remaining}/${a.min} un)`)
          .join(', ');
        onToast(`🚨 ALERTA DE ESTOQUE AO ADMINISTRADOR: ${alertSummary} atingiu o nível mínimo definido!`);
      }, 1500);
    }
  };

  // Salvar / Editar Produto de Venda
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      onToast('Informe o nome do produto.');
      return;
    }

    const costNum = parseFloat(formCostPrice.replace(',', '.')) || 0;
    const saleNum = parseFloat(formSalePrice.replace(',', '.')) || 0;
    const stockNum = parseInt(formStock, 10) || 0;
    const minStockNum = parseInt(formMinStock, 10) || 0;

    const newProd: SaleProductItem = {
      id: editingProduct ? editingProduct.id : `sprod-${Date.now()}`,
      tenantId: tenant.id,
      name: formName.trim(),
      category: formCategory,
      categoryLabel: getCategoryLabel(formCategory),
      barcode: formBarcode.trim() || undefined,
      costPrice: costNum,
      salePrice: saleNum,
      stock: stockNum,
      minStock: minStockNum,
      unit: formUnit.trim() || 'unidades',
      notes: formNotes.trim() || undefined,
      updatedAt: new Date().toISOString()
    };

    await saveSaleProductToFirestore(tenant.id, newProd);
    setShowNewProductModal(false);
    setShowEditProductModal(false);
    setEditingProduct(null);
    resetProductForm();
    onToast(`✅ Produto "${newProd.name}" salvo com sucesso!`);
  };

  // Excluir Produto de Venda
  const handleDeleteProduct = async (productId: string) => {
    if (window.confirm('Tem certeza que deseja excluir este produto do catálogo de vendas?')) {
      await deleteSaleProductFromFirestore(tenant.id, productId);
      onToast('Produto excluído do catálogo.');
    }
  };

  // Abrir Edição de Produto
  const handleEditClick = (product: SaleProductItem) => {
    setEditingProduct(product);
    setFormName(product.name);
    setFormCategory(product.category);
    setFormBarcode(product.barcode || '');
    setFormCostPrice(product.costPrice.toString());
    setFormSalePrice(product.salePrice.toString());
    setFormStock(product.stock.toString());
    setFormMinStock(product.minStock.toString());
    setFormUnit(product.unit);
    setFormNotes(product.notes || '');
    setShowEditProductModal(true);
  };

  // Limpar Formulário
  const resetProductForm = () => {
    setFormName('');
    setFormCategory('aromatizantes');
    setFormBarcode('');
    setFormCostPrice('10.00');
    setFormSalePrice('20.00');
    setFormStock('15');
    setFormMinStock('5');
    setFormUnit('unidades');
    setFormNotes('');
  };

  // Exportar Extrato Financeiro de Vendas de Balcão (CSV)
  const handleExportFinancialCSV = () => {
    if (filteredFinancialSales.length === 0) {
      onToast('Nenhuma transação de venda para exportar.');
      return;
    }

    const headers = ['Venda No', 'Data', 'Hora', 'Cliente', 'Forma Pagto', 'Subtotal (R$)', 'Desconto (R$)', 'Total (R$)', 'Custo (R$)', 'Lucro (R$)', 'Destino'];
    const rows = filteredFinancialSales.map(s => [
      `"${s.saleNumber || s.id.slice(-4)}"`,
      `"${s.date}"`,
      `"${s.time}"`,
      `"${(s.clientName || 'Consumidor Final').replace(/"/g, '""')}"`,
      `"${s.paymentMethod}"`,
      s.subtotal.toFixed(2),
      s.discount.toFixed(2),
      s.totalAmount.toFixed(2),
      (s.totalCost || 0).toFixed(2),
      (s.grossProfit || (s.totalAmount - (s.totalCost || 0))).toFixed(2),
      s.integrateWithOperationalCash ? '"Caixa Geral"' : '"Caixa Balcao"'
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `extrato_vendas_balcao_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onToast('Extrato financeiro das vendas de balcão exportado em CSV!');
  };

  // Rótulos Legíveis para Categorias de Venda
  function getCategoryLabel(cat: SaleProductCategory) {
    switch (cat) {
      case 'aromatizantes': return 'Aromatizantes';
      case 'estetica_automotiva': return 'Estética Automotiva';
      case 'conveniencia_bebidas': return 'Bebidas & Conveniência';
      case 'acessorios': return 'Acessórios';
      case 'palhetas_limpador': return 'Palhetas';
      default: return 'Outros Produtos';
    }
  }

  return (
    <div className="space-y-6">
      
      {/* ================= TOPO: CABEÇALHO & SELEÇÃO DE VISTA DA DASHBOARD ================= */}
      <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-2xl shadow-inner">
              <ShoppingBag className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl font-black text-white tracking-tight">Dashboard de Vendas de Balcão (PDV)</h2>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[11px] font-bold">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                  Fluxo Financeiro Separado
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Frente de caixa com seleção de produtos, ajuste de quantidade, controle financeiro de balcão e baixa automática de estoque.
              </p>
            </div>
          </div>

          {/* Abas Superiores de Navegação da Dashboard de Vendas */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center bg-[#020617] p-1 rounded-xl border border-[#1e293b]">
              <button
                type="button"
                onClick={() => setViewMode('pdv')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'pdv' ? 'bg-amber-500 text-slate-950 font-black shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>Frente de Caixa (PDV)</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('financeiro')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'financeiro' ? 'bg-amber-500 text-slate-950 font-black shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                <DollarSign className="w-3.5 h-3.5" />
                <span>Financeiro de Vendas</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('catalogo')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'catalogo' ? 'bg-amber-500 text-slate-950 font-black shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                <span>Catálogo & Estoque</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('alertas')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 relative ${
                  viewMode === 'alertas' ? 'bg-amber-500 text-slate-950 font-black shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                <AlertTriangle className={`w-3.5 h-3.5 ${lowStockAlertProducts.length > 0 ? (viewMode === 'alertas' ? 'text-slate-950' : 'text-amber-400') : ''}`} />
                <span>Alertas de Estoque</span>
                {lowStockAlertProducts.length > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black ${
                    viewMode === 'alertas' ? 'bg-slate-950 text-amber-400' : 'bg-rose-500 text-white animate-pulse'
                  }`}>
                    {lowStockAlertProducts.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setViewMode('historico')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'historico' ? 'bg-amber-500 text-slate-950 font-black shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Histórico</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                resetProductForm();
                setShowNewProductModal(true);
              }}
              className="py-2.5 px-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer shadow-lg shadow-blue-600/20"
            >
              <Plus className="w-4 h-4" />
              <span>+ Novo Produto</span>
            </button>
          </div>

        </div>
      </div>

      {/* ================= BANNER NOTIFICADOR GLOBAL AO ADMINISTRADOR: ALERTAS DE ESTOQUE ================= */}
      {lowStockAlertProducts.length > 0 && viewMode !== 'alertas' && (
        <div className="bg-gradient-to-r from-rose-950/40 via-amber-950/25 to-[#0f172a] border border-rose-500/40 rounded-2xl p-4 sm:p-4.5 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-fade-in">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 bg-rose-500/20 border border-rose-500/30 rounded-xl text-rose-400 shrink-0 mt-0.5 shadow-inner">
              <AlertTriangle className="w-5 h-5 text-rose-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider bg-rose-500 text-slate-950 px-2 py-0.5 rounded shadow">
                  🚨 Notificação ao Administrador
                </span>
                <span className="text-xs font-bold text-rose-300">
                  {lowStockAlertProducts.length} {lowStockAlertProducts.length === 1 ? 'produto atingiu' : 'produtos atingiram'} o nível mínimo definido!
                </span>
                {outOfStockCount > 0 && (
                  <span className="text-[10px] bg-rose-600 text-white font-mono font-bold px-2 py-0.5 rounded-full">
                    {outOfStockCount} zerado(s)
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-300 mt-1">
                {lowStockAlertProducts.slice(0, 4).map(p => `${p.name} (Atual: ${p.stock} / Mín: ${p.minStock} ${p.unit})`).join(' · ')}
                {lowStockAlertProducts.length > 4 ? ` e mais ${lowStockAlertProducts.length - 4} itens pendentes de reposição.` : '.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
            <button
              type="button"
              onClick={handleCopyRestockList}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              title="Copiar lista de compras para o WhatsApp"
            >
              <Copy className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Copiar Lista</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('alertas')}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black flex items-center gap-1.5 transition cursor-pointer shadow-lg shadow-amber-500/20"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Ver Seção de Alertas ({lowStockAlertProducts.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* ================= MODO 1: FRENTE DE CAIXA / PDV RÁPIDO ================= */}
      {viewMode === 'pdv' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Coluna Esquerda: Vitrine e Seleção de Produtos (2 colunas) */}
          <div className="lg:col-span-2 space-y-4">
            
            {/* Barra de Filtros por Categoria e Busca */}
            <div className="bg-[#0f172a] border border-[#1e293b] p-3 rounded-2xl flex flex-col sm:flex-row gap-2.5 items-center justify-between">
              
              <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedCategory('todos')}
                  className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
                    selectedCategory === 'todos' ? 'bg-amber-500 text-slate-950 font-black' : 'bg-[#020617] text-slate-300 border border-[#1e293b]'
                  }`}
                >
                  Todos ({products.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCategory('aromatizantes')}
                  className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
                    selectedCategory === 'aromatizantes' ? 'bg-amber-500 text-slate-950 font-black' : 'bg-[#020617] text-slate-300 border border-[#1e293b]'
                  }`}
                >
                  🌸 Aromatizantes
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCategory('estetica_automotiva')}
                  className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
                    selectedCategory === 'estetica_automotiva' ? 'bg-amber-500 text-slate-950 font-black' : 'bg-[#020617] text-slate-300 border border-[#1e293b]'
                  }`}
                >
                  ✨ Estética & Ceras
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCategory('conveniencia_bebidas')}
                  className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
                    selectedCategory === 'conveniencia_bebidas' ? 'bg-amber-500 text-slate-950 font-black' : 'bg-[#020617] text-slate-300 border border-[#1e293b]'
                  }`}
                >
                  🥤 Bebidas
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCategory('acessorios')}
                  className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
                    selectedCategory === 'acessorios' ? 'bg-amber-500 text-slate-950 font-black' : 'bg-[#020617] text-slate-300 border border-[#1e293b]'
                  }`}
                >
                  🧽 Acessórios
                </button>
              </div>

              <div className="relative w-full sm:w-56">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar produto por nome..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full bg-[#020617] border border-[#1e293b] rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>

            </div>

            {/* Grade de Produtos: Seleção com 1 clique e Ajuste de Quantidade */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filteredProducts.map(prod => {
                const isOutOfStock = prod.stock <= 0;
                const inCartItem = cart.find(i => i.productId === prod.id);

                return (
                  <div
                    key={prod.id}
                    className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between relative group ${
                      isOutOfStock
                        ? 'bg-slate-950/40 border-slate-800/50 opacity-60'
                        : inCartItem
                          ? 'bg-amber-950/20 border-amber-500/70 shadow-lg shadow-amber-500/10'
                          : 'bg-[#0f172a] border-[#1e293b] hover:border-amber-500/50 hover:bg-slate-850'
                    }`}
                  >
                    {inCartItem && (
                      <span className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-black text-xs shadow-md animate-scale-in">
                        {inCartItem.quantity} no carrinho
                      </span>
                    )}

                    <div onClick={() => !isOutOfStock && handleOpenQuantitySelector(prod)} className="cursor-pointer">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        {prod.categoryLabel || getCategoryLabel(prod.category)}
                      </span>
                      <h4 className="font-bold text-white text-xs sm:text-sm mt-1 line-clamp-2 leading-snug">
                        {prod.name}
                      </h4>
                    </div>

                    <div className="mt-3 pt-2 border-t border-[#1e293b]/60 flex items-center justify-between gap-1">
                      <div onClick={() => !isOutOfStock && handleOpenQuantitySelector(prod)} className="cursor-pointer">
                        <span className="text-base font-black font-mono text-emerald-400">
                          {formatBRL(prod.salePrice)}
                        </span>
                        <div className="text-[10px] text-slate-500">
                          Estoque: {prod.stock} {prod.unit}
                        </div>
                      </div>

                      {/* Botões de Ação Rápida */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={isOutOfStock}
                          onClick={() => handleOpenQuantitySelector(prod)}
                          title="Ajustar quantidade e adicionar"
                          className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold transition cursor-pointer"
                        >
                          Qtd
                        </button>
                        <button
                          type="button"
                          disabled={isOutOfStock}
                          onClick={() => handleConfirmAddToCartWithQuantity(prod, 1)}
                          title="+1 unidade"
                          className="p-1.5 rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 font-black transition cursor-pointer shadow-sm"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredProducts.length === 0 && (
                <div className="col-span-full py-12 text-center text-slate-500 text-xs bg-[#0f172a] rounded-2xl border border-[#1e293b]">
                  <Package className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
                  Nenhum produto cadastrado para esta categoria.
                </div>
              )}
            </div>

          </div>

          {/* Coluna Direita: Carrinho & Fechamento da Venda de Balcão */}
          <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-5 space-y-4 flex flex-col justify-between shadow-2xl">
            
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#1e293b] pb-3">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-amber-400" />
                  <h3 className="font-bold text-white text-sm">Carrinho do Balcão ({cart.length} itens)</h3>
                </div>
                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearCart}
                    className="text-[11px] text-slate-400 hover:text-rose-400 transition cursor-pointer"
                  >
                    Limpar
                  </button>
                )}
              </div>

              {/* Lista de Itens no Carrinho com Ajuste de Quantidade */}
              <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                {cart.map(item => (
                  <div key={item.productId} className="bg-[#020617] border border-[#1e293b] rounded-xl p-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-200 truncate">{item.name}</p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        {formatBRL(item.unitPrice)} un.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Ajuste de Quantidade Inline */}
                      <div className="flex items-center bg-slate-900 border border-slate-700 rounded-lg">
                        <button
                          type="button"
                          onClick={() => handleUpdateCartQuantity(item.productId, -1)}
                          className="px-2 py-1 text-slate-400 hover:text-white cursor-pointer font-bold text-xs"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleSetCartQuantity(item.productId, parseInt(e.target.value, 10) || 1)}
                          className="w-10 text-center bg-transparent text-xs font-mono font-bold text-amber-300 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleUpdateCartQuantity(item.productId, 1)}
                          className="px-2 py-1 text-slate-400 hover:text-white cursor-pointer font-bold text-xs"
                        >
                          +
                        </button>
                      </div>

                      <span className="text-xs font-black font-mono text-emerald-400 w-16 text-right">
                        {formatBRL(item.totalPrice)}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleRemoveFromCart(item.productId)}
                        className="p-1 text-slate-500 hover:text-rose-400 rounded cursor-pointer"
                        title="Remover Item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}

                {cart.length === 0 && (
                  <div className="py-8 text-center text-slate-500 text-xs">
                    <ShoppingBag className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
                    Nenhum produto selecionado.<br />Clique nos produtos da vitrine para adicionar.
                  </div>
                )}
              </div>

              {/* Informações de Pagamento e Finalização */}
              {cart.length > 0 && (
                <form onSubmit={handleCheckoutSale} className="space-y-3 pt-2 border-t border-[#1e293b] text-xs">
                  
                  {/* Dados do Cliente */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-slate-300 font-bold mb-1 text-[11px]">Cliente</label>
                      <input
                        type="text"
                        placeholder="Consumidor Final"
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        className="w-full bg-[#020617] border border-[#1e293b] rounded-xl px-2.5 py-1.5 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-bold mb-1 text-[11px]">Telefone (WhatsApp)</label>
                      <input
                        type="text"
                        placeholder="(11) 99999-9999"
                        value={clientPhone}
                        onChange={(e) => setClientPhone(e.target.value)}
                        className="w-full bg-[#020617] border border-[#1e293b] rounded-xl px-2.5 py-1.5 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>

                  {/* Forma de Pagamento */}
                  <div>
                    <label className="block text-slate-300 font-bold mb-1 text-[11px]">Forma de Pagamento *</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('PIX')}
                        className={`p-2 rounded-xl text-[11px] font-bold border flex items-center justify-center gap-1.5 transition cursor-pointer ${
                          paymentMethod === 'PIX'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500 shadow-md'
                            : 'bg-[#020617] border-[#1e293b] text-slate-400 hover:text-white'
                        }`}
                      >
                        <QrCode className="w-3.5 h-3.5" /> PIX
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentMethod('Dinheiro')}
                        className={`p-2 rounded-xl text-[11px] font-bold border flex items-center justify-center gap-1.5 transition cursor-pointer ${
                          paymentMethod === 'Dinheiro'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500 shadow-md'
                            : 'bg-[#020617] border-[#1e293b] text-slate-400 hover:text-white'
                        }`}
                      >
                        <Banknote className="w-3.5 h-3.5" /> Dinheiro
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentMethod('Cartão de Débito')}
                        className={`p-2 rounded-xl text-[11px] font-bold border flex items-center justify-center gap-1.5 transition cursor-pointer ${
                          paymentMethod === 'Cartão de Débito'
                            ? 'bg-blue-500/20 text-blue-300 border-blue-500 shadow-md'
                            : 'bg-[#020617] border-[#1e293b] text-slate-400 hover:text-white'
                        }`}
                      >
                        <CreditCard className="w-3.5 h-3.5" /> Débito
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentMethod('Cartão de Crédito')}
                        className={`p-2 rounded-xl text-[11px] font-bold border flex items-center justify-center gap-1.5 transition cursor-pointer ${
                          paymentMethod === 'Cartão de Crédito'
                            ? 'bg-purple-500/20 text-purple-300 border-purple-500 shadow-md'
                            : 'bg-[#020617] border-[#1e293b] text-slate-400 hover:text-white'
                        }`}
                      >
                        <CreditCard className="w-3.5 h-3.5" /> Crédito
                      </button>
                    </div>
                  </div>

                  {/* Dinheiro & Troco */}
                  {paymentMethod === 'Dinheiro' && (
                    <div className="grid grid-cols-2 gap-2 bg-[#020617] p-2.5 rounded-xl border border-amber-500/30">
                      <div>
                        <label className="block text-slate-400 text-[10px] font-bold mb-1">Valor Recebido (R$)</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Ex: 50.00"
                          value={cashGiven}
                          onChange={(e) => setCashGiven(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white font-mono font-bold text-xs"
                        />
                      </div>
                      <div className="text-right">
                        <span className="block text-slate-400 text-[10px] font-bold mb-1">Troco a Devolver</span>
                        <span className="text-sm font-black font-mono text-amber-300">
                          {formatBRL(cashChange)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* ================= CONTROLE DE SEPARAÇÃO FINANCEIRA ================= */}
                  <div className="p-3 bg-[#020617] border border-blue-500/30 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-200 flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-blue-400" /> Destino Financeiro da Venda
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold">
                        {integrateWithOperationalCash ? 'Integrado ao Geral' : 'Separado (Balcão)'}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-[11px]">
                      <label className="flex items-start gap-2 text-slate-300 cursor-pointer">
                        <input
                          type="radio"
                          name="cashDestination"
                          checked={!integrateWithOperationalCash}
                          onChange={() => setIntegrateWithOperationalCash(false)}
                          className="mt-0.5 text-amber-500 focus:ring-amber-400"
                        />
                        <span>
                          <strong>Caixa Exclusivo de Balcão (Recomendado)</strong>: Não mistura o dinheiro da loja com as lavagens operacionais de pátio.
                        </span>
                      </label>

                      <label className="flex items-start gap-2 text-slate-400 cursor-pointer">
                        <input
                          type="radio"
                          name="cashDestination"
                          checked={integrateWithOperationalCash}
                          onChange={() => setIntegrateWithOperationalCash(true)}
                          className="mt-0.5 text-blue-500 focus:ring-blue-400"
                        />
                        <span>
                          <strong>Integrar ao Fluxo Geral</strong>: Lança também como entrada no Controle de Caixa operacional da empresa.
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Resumo Financeiro do Pedido */}
                  <div className="bg-[#020617] p-3 rounded-xl border border-[#1e293b] space-y-1">
                    <div className="flex justify-between text-slate-400 text-[11px]">
                      <span>Subtotal dos Produtos:</span>
                      <span className="font-mono">{formatBRL(cartSubtotal)}</span>
                    </div>
                    <div className="flex justify-between text-slate-500 text-[10px]">
                      <span>Custo das Mercadorias (CMV):</span>
                      <span className="font-mono">{formatBRL(cartTotalCost)}</span>
                    </div>
                    <div className="flex justify-between text-emerald-400 text-[11px]">
                      <span>Lucro Bruto Estimado:</span>
                      <span className="font-mono font-bold">+{formatBRL(cartEstimatedProfit)}</span>
                    </div>
                    <div className="flex justify-between text-white font-black text-base pt-1 border-t border-slate-800">
                      <span>Total da Venda:</span>
                      <span className="text-amber-400 font-mono">{formatBRL(cartTotal)}</span>
                    </div>
                  </div>

                  {/* Botão de Finalização */}
                  <button
                    type="submit"
                    className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-amber-500/20"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Concluir Venda no Balcão ({formatBRL(cartTotal)})</span>
                  </button>

                </form>
              )}

            </div>

          </div>

        </div>
      )}

      {/* ================= MODO 2: FLUXO FINANCEIRO EXCLUSIVO DO BALCÃO ================= */}
      {viewMode === 'financeiro' && (
        <div className="space-y-6 animate-fade-in">
          
          {/* Topo do Financeiro: Banner Explicativo de Separação */}
          <div className="bg-gradient-to-r from-blue-950/40 via-[#0f172a] to-emerald-950/30 border border-blue-500/30 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
                <ShieldCheck className="w-6 h-6" />
              </span>
              <div>
                <h3 className="font-bold text-white text-sm">Controle Financeiro Separado — Vendas de Balcão & Loja</h3>
                <p className="text-xs text-slate-400">
                  Transações financeiras exclusivas da conveniência e acessórios, sem misturar com as lavagens do pátio.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportFinancialCSV}
                className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-blue-400" />
                <span>Exportar Extrato (CSV)</span>
              </button>
            </div>
          </div>

          {/* Cards de Métricas Financeiras Exclusivas de Vendas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            <div className="bg-[#0f172a] border border-[#1e293b] p-4 rounded-2xl">
              <div className="flex items-center justify-between text-slate-400 text-[11px] font-bold uppercase">
                <span>Receita Bruta Balcão</span>
                <DollarSign className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-black font-mono text-emerald-400 mt-2">
                {formatBRL(financialMetrics.receitaBruta)}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {financialMetrics.quantidadeVendas} vendas no período ({financialPeriod})
              </p>
            </div>

            <div className="bg-[#0f172a] border border-[#1e293b] p-4 rounded-2xl">
              <div className="flex items-center justify-between text-slate-400 text-[11px] font-bold uppercase">
                <span>Custo das Mercadorias (CMV)</span>
                <Package className="w-4 h-4 text-rose-400" />
              </div>
              <div className="text-2xl font-black font-mono text-rose-400 mt-2">
                {formatBRL(financialMetrics.custoTotalMercadorias)}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Custo de aquisição dos produtos vendidos
              </p>
            </div>

            <div className="bg-[#0f172a] border border-[#1e293b] p-4 rounded-2xl">
              <div className="flex items-center justify-between text-slate-400 text-[11px] font-bold uppercase">
                <span>Lucro Bruto Real</span>
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-black font-mono text-white mt-2">
                {formatBRL(financialMetrics.lucroBruto)}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-bold mt-1">
                <Percent className="w-3.5 h-3.5" />
                <span>Margem Média: {financialMetrics.margemPercentual.toFixed(1)}%</span>
              </div>
            </div>

            <div className="bg-[#0f172a] border border-[#1e293b] p-4 rounded-2xl">
              <div className="flex items-center justify-between text-slate-400 text-[11px] font-bold uppercase">
                <span>Ticket Médio Balcão</span>
                <Sparkles className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-black font-mono text-amber-300 mt-2">
                {formatBRL(financialMetrics.ticketMedio)}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Por transação de venda de balcão
              </p>
            </div>

          </div>

          {/* Formas de Pagamento Recebidas no Balcão */}
          <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-4">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
              Recebimentos do Balcão por Forma de Pagamento
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-[#020617] border border-emerald-500/20 rounded-xl p-3">
                <span className="text-xs text-emerald-400 font-bold flex items-center gap-1.5">
                  <QrCode className="w-4 h-4" /> PIX Loja
                </span>
                <span className="text-base font-black font-mono text-white block mt-1">
                  {formatBRL(financialMetrics.totalPIX)}
                </span>
              </div>

              <div className="bg-[#020617] border border-amber-500/20 rounded-xl p-3">
                <span className="text-xs text-amber-400 font-bold flex items-center gap-1.5">
                  <Banknote className="w-4 h-4" /> Dinheiro Balcão
                </span>
                <span className="text-base font-black font-mono text-white block mt-1">
                  {formatBRL(financialMetrics.totalDinheiro)}
                </span>
              </div>

              <div className="bg-[#020617] border border-blue-500/20 rounded-xl p-3">
                <span className="text-xs text-blue-400 font-bold flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4" /> Cartão Débito
                </span>
                <span className="text-base font-black font-mono text-white block mt-1">
                  {formatBRL(financialMetrics.totalDebito)}
                </span>
              </div>

              <div className="bg-[#020617] border border-purple-500/20 rounded-xl p-3">
                <span className="text-xs text-purple-400 font-bold flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4" /> Cartão Crédito
                </span>
                <span className="text-base font-black font-mono text-white block mt-1">
                  {formatBRL(financialMetrics.totalCredito)}
                </span>
              </div>
            </div>
          </div>

          {/* Extrato Financeiro de Vendas de Balcão */}
          <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 border-b border-[#1e293b] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-amber-400" />
                <h4 className="font-bold text-white text-sm">
                  Extrato Financeiro de Vendas ({filteredFinancialSales.length} transações)
                </h4>
              </div>

              {/* Filtros de Período */}
              <div className="flex items-center gap-1.5 bg-[#020617] p-1 rounded-xl border border-[#1e293b] text-xs">
                <button
                  type="button"
                  onClick={() => setFinancialPeriod('hoje')}
                  className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                    financialPeriod === 'hoje' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Hoje
                </button>
                <button
                  type="button"
                  onClick={() => setFinancialPeriod('ontem')}
                  className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                    financialPeriod === 'ontem' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Ontem
                </button>
                <button
                  type="button"
                  onClick={() => setFinancialPeriod('7dias')}
                  className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                    financialPeriod === '7dias' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  7 Dias
                </button>
                <button
                  type="button"
                  onClick={() => setFinancialPeriod('mes')}
                  className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                    financialPeriod === 'mes' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Este Mês
                </button>
                <button
                  type="button"
                  onClick={() => setFinancialPeriod('todos')}
                  className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                    financialPeriod === 'todos' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Todos
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-[#020617] text-slate-400 font-bold border-b border-[#1e293b]">
                  <tr>
                    <th className="py-3 px-4">Venda Nº</th>
                    <th className="py-3 px-4">Data & Hora</th>
                    <th className="py-3 px-4">Cliente</th>
                    <th className="py-3 px-4">Forma Pagto</th>
                    <th className="py-3 px-4 text-right">Valor Venda</th>
                    <th className="py-3 px-4 text-right">Custo (CMV)</th>
                    <th className="py-3 px-4 text-right">Lucro Líquido</th>
                    <th className="py-3 px-4 text-center">Destino</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e293b]/70">
                  {filteredFinancialSales.map(sale => {
                    const cost = sale.totalCost || 0;
                    const profit = sale.grossProfit || (sale.totalAmount - cost);

                    return (
                      <tr key={sale.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3 px-4 font-mono font-bold text-amber-400">
                          #{sale.saleNumber || sale.id.slice(-4)}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-mono text-slate-200">{sale.date}</div>
                          <div className="text-[10px] text-slate-500">{sale.time}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-white">{sale.clientName || 'Consumidor Final'}</span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-700 font-mono text-[11px] text-slate-300">
                            {sale.paymentMethod}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-black text-emerald-400 text-sm whitespace-nowrap">
                          {formatBRL(sale.totalAmount)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-rose-400 text-xs whitespace-nowrap">
                          {formatBRL(cost)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400 text-xs whitespace-nowrap">
                          +{formatBRL(profit)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            sale.integrateWithOperationalCash
                              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}>
                            {sale.integrateWithOperationalCash ? 'Caixa Geral' : 'Exclusivo Balcão'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredFinancialSales.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500 text-xs">
                        Nenhuma transação financeira de venda registrada no período selecionado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

          </div>

        </div>
      )}

      {/* ================= MODO 3: CATÁLOGO DE PRODUTOS DE VENDA ================= */}
      {viewMode === 'catalogo' && (
        <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl overflow-hidden shadow-xl">
          
          <div className="p-4 border-b border-[#1e293b] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Package className="w-4 h-4 text-amber-400" />
                Catálogo de Produtos de Venda ({products.length} itens)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Produtos comerciais comercializados aos clientes no balcão da loja.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                resetProductForm();
                setShowNewProductModal(true);
              }}
              className="py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md"
            >
              <Plus className="w-4 h-4" /> Cadastrar Produto
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[#020617] text-slate-400 font-bold border-b border-[#1e293b]">
                <tr>
                  <th className="py-3 px-4">Produto</th>
                  <th className="py-3 px-4">Categoria</th>
                  <th className="py-3 px-4 text-right">Preço de Custo</th>
                  <th className="py-3 px-4 text-right">Preço de Venda</th>
                  <th className="py-3 px-4 text-right">Margem de Lucro</th>
                  <th className="py-3 px-4 text-center">Estoque Atual</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e293b]/70">
                {products.map(prod => {
                  const profit = prod.salePrice - prod.costPrice;
                  const marginPercent = prod.costPrice > 0 ? (profit / prod.costPrice) * 100 : 0;
                  const isLow = prod.stock <= prod.minStock;

                  return (
                    <tr key={prod.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4">
                        <div className="font-bold text-white">{prod.name}</div>
                        {prod.barcode && (
                          <div className="text-[10px] text-slate-500 font-mono">Código: {prod.barcode}</div>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-[10px] text-slate-300 font-medium">
                          {prod.categoryLabel || getCategoryLabel(prod.category)}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-slate-400">
                        {formatBRL(prod.costPrice)}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-black text-emerald-400 text-sm">
                        {formatBRL(prod.salePrice)}
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-xs">
                        <span className="text-emerald-400 font-bold">+{marginPercent.toFixed(0)}%</span>
                        <span className="text-[10px] text-slate-500 block">Lucro: {formatBRL(profit)}</span>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          isLow
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        }`}>
                          {isLow && <AlertTriangle className="w-3 h-3" />}
                          {prod.stock} {prod.unit}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleEditClick(prod)}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
                            title="Editar Produto"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteProduct(prod.id)}
                            className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition cursor-pointer"
                            title="Excluir Produto"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {products.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500 text-xs">
                      Nenhum produto cadastrado no catálogo de vendas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* ================= MODO 4: HISTÓRICO DE VENDAS REALIZADAS ================= */}
      {viewMode === 'historico' && (
        <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl overflow-hidden shadow-xl">
          
          <div className="p-4 border-b border-[#1e293b] flex items-center justify-between">
            <div>
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-400" />
                Histórico de Vendas de Balcão ({salesHistory.length} vendas registradas)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Vendas realizadas pelo PDV com baixa de estoque e registro financeiro.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[#020617] text-slate-400 font-bold border-b border-[#1e293b]">
                <tr>
                  <th className="py-3 px-4">Nº Venda</th>
                  <th className="py-3 px-4">Data & Hora</th>
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">Itens Vendidos</th>
                  <th className="py-3 px-4">Pagamento</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-4 text-right">Comprovante</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e293b]/70">
                {salesHistory.map(sale => (
                  <tr key={sale.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-mono font-bold text-amber-400">
                      #{sale.saleNumber || sale.id.slice(-4)}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-mono text-slate-200">{sale.date}</div>
                      <div className="text-[10px] text-slate-500">{sale.time}</div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-semibold text-white">{sale.clientName || 'Consumidor Final'}</div>
                      {sale.clientPhone && (
                        <div className="text-[10px] text-slate-400">{sale.clientPhone}</div>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <div className="max-w-xs truncate text-slate-300">
                        {sale.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
                      </div>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-700 font-mono text-[11px] text-slate-300">
                        {sale.paymentMethod}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-black text-emerald-400 text-sm whitespace-nowrap">
                      {formatBRL(sale.totalAmount)}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setLastCompletedSale(sale);
                          setShowReceiptModal(true);
                        }}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold transition cursor-pointer inline-flex items-center gap-1"
                        title="Ver Recibo"
                      >
                        <Printer className="w-3.5 h-3.5 text-amber-400" />
                        <span>Recibo</span>
                      </button>
                    </td>
                  </tr>
                ))}

                {salesHistory.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500 text-xs">
                      Nenhuma venda de balcão realizada até o momento.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* ================= MODO 5: SEÇÃO DE ALERTAS DE ESTOQUE (NOTIFICAÇÃO DO ADMINISTRADOR) ================= */}
      {viewMode === 'alertas' && (
        <div className="space-y-6">
          
          {/* Topo da Seção de Alertas: Título e Ações Rápidas Globais */}
          <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-2xl shadow-inner">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className="text-lg font-black text-white">Central de Alertas de Estoque & Reposição</h3>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[11px] font-bold">
                    <Bell className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
                    Notificação do Administrador
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Monitoramento em tempo real dos produtos de balcão que atingiram ou estão abaixo do nível mínimo definido.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                type="button"
                onClick={handleCopyRestockList}
                className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold rounded-xl text-xs flex items-center gap-2 transition cursor-pointer shadow-md"
                title="Copiar lista de compras para enviar pelo WhatsApp"
              >
                <Copy className="w-4 h-4 text-amber-400" />
                <span>Copiar Lista para Fornecedor</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  resetProductForm();
                  setShowNewProductModal(true);
                }}
                className="py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition cursor-pointer shadow-md shadow-blue-600/20"
              >
                <Plus className="w-4 h-4" />
                <span>+ Novo Produto</span>
              </button>
            </div>
          </div>

          {/* 4 Cards de Métricas e KPIs de Estoque */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            
            <div className={`p-4 rounded-2xl border transition shadow-lg ${
              outOfStockCount > 0 ? 'bg-rose-950/20 border-rose-500/40' : 'bg-[#0f172a] border-[#1e293b]'
            }`}>
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Estoque Zerado</span>
                <span className={`p-1.5 rounded-lg ${outOfStockCount > 0 ? 'bg-rose-500/20 text-rose-400' : 'bg-slate-800 text-slate-400'}`}>
                  <AlertTriangle className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-black font-mono text-rose-400">
                {outOfStockCount}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {outOfStockCount === 0 ? 'Nenhum produto esgotado' : 'Produtos sem estoque físico'}
              </p>
            </div>

            <div className={`p-4 rounded-2xl border transition shadow-lg ${
              atMinStockCount > 0 ? 'bg-amber-950/20 border-amber-500/40' : 'bg-[#0f172a] border-[#1e293b]'
            }`}>
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">No Nível Mínimo</span>
                <span className={`p-1.5 rounded-lg ${atMinStockCount > 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-400'}`}>
                  <SlidersHorizontal className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-black font-mono text-amber-400">
                {atMinStockCount}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Gatilho de reposição acionado
              </p>
            </div>

            <div className="bg-[#0f172a] p-4 rounded-2xl border border-[#1e293b] shadow-lg">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Estoque Regular</span>
                <span className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg">
                  <CheckCircle className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-400">
                {healthyStockCount}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Produtos acima do nível mínimo
              </p>
            </div>

            <div className="bg-[#0f172a] p-4 rounded-2xl border border-[#1e293b] shadow-lg">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Custo de Reposição</span>
                <span className="p-1.5 bg-blue-500/20 text-blue-400 rounded-lg">
                  <DollarSign className="w-4 h-4" />
                </span>
              </div>
              <div className="text-xl sm:text-2xl font-black font-mono text-slate-100">
                {formatBRL(estimatedRestockCost)}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Para repor dobro do estoque mínimo
              </p>
            </div>

          </div>

          {/* Barra de Filtros e Busca de Alertas */}
          <div className="bg-[#0f172a] border border-[#1e293b] p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xl">
            <div className="flex items-center gap-1.5 bg-[#020617] p-1 rounded-xl border border-[#1e293b] overflow-x-auto">
              <button
                type="button"
                onClick={() => setAlertFilter('todos_alertas')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  alertFilter === 'todos_alertas' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>Todos os Alertas</span>
                <span className="px-1.5 py-0.2 rounded-full bg-slate-900 text-amber-400 text-[10px] font-mono">
                  {lowStockAlertProducts.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setAlertFilter('zerados')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  alertFilter === 'zerados' ? 'bg-rose-500 text-white font-black' : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>Apenas Zerados</span>
                <span className="px-1.5 py-0.2 rounded-full bg-slate-900 text-rose-400 text-[10px] font-mono">
                  {outOfStockCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setAlertFilter('minimo')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  alertFilter === 'minimo' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>No Nível Mínimo</span>
                <span className="px-1.5 py-0.2 rounded-full bg-slate-900 text-amber-400 text-[10px] font-mono">
                  {atMinStockCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setAlertFilter('todos_produtos')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  alertFilter === 'todos_produtos' ? 'bg-blue-600 text-white font-black' : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>Auditar Todos ({products.length})</span>
              </button>
            </div>

            <div className="relative w-full md:w-64">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={alertSearch}
                onChange={(e) => setAlertSearch(e.target.value)}
                placeholder="Buscar produto por nome..."
                className="w-full bg-[#020617] border border-[#1e293b] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-amber-400 outline-none"
              />
            </div>
          </div>

          {/* Lista de Cards de Alerta de Estoque */}
          {displayedAlertProducts.length === 0 ? (
            <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-12 text-center shadow-xl space-y-3">
              <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <CheckCircle className="w-8 h-8" />
              </div>
              <h4 className="text-base font-bold text-white">Nenhum produto em alerta de estoque!</h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                {alertFilter === 'todos_alertas'
                  ? 'Excelente! Todos os produtos cadastrados na loja do balcão estão operando acima dos níveis mínimos de segurança definidos.'
                  : 'Nenhum item corresponde ao filtro selecionado no momento.'}
              </p>
              {alertFilter !== 'todos_produtos' && (
                <button
                  type="button"
                  onClick={() => setAlertFilter('todos_produtos')}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Ver Todos os Produtos Cadastrados
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {displayedAlertProducts.map(product => {
                const isOutOfStock = product.stock <= 0;
                const isAtMin = product.stock > 0 && product.stock <= product.minStock;
                const isHealthy = product.stock > product.minStock;

                const percentOfMin = Math.min(100, Math.round((product.stock / Math.max(1, product.minStock)) * 100));
                const suggestedRestock = Math.max(1, (product.minStock * 2) - product.stock);
                const suggestedCost = suggestedRestock * (product.costPrice || 0);

                // Mensagem pronta para WhatsApp do fornecedor
                const whatsappText = encodeURIComponent(
                  `Olá! Gostaria de cotar reposição de estoque:\nProduto: ${product.name}\nEstoque atual: ${product.stock} ${product.unit}\nQuantidade desejada: ${suggestedRestock} ${product.unit}\nFavor enviar cotação e prazo.`
                );

                return (
                  <div 
                    key={product.id}
                    className={`bg-[#0f172a] rounded-2xl border p-5 shadow-xl space-y-4 transition ${
                      isOutOfStock 
                        ? 'border-rose-500/50 bg-gradient-to-b from-rose-950/20 to-[#0f172a]' 
                        : isAtMin 
                          ? 'border-amber-500/40 bg-gradient-to-b from-amber-950/15 to-[#0f172a]'
                          : 'border-[#1e293b]'
                    }`}
                  >
                    {/* Topo do Card: Categoria, Nome e Badge de Situação */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block">
                          {product.categoryLabel || getCategoryLabel(product.category)}
                        </span>
                        <h4 className="font-bold text-white text-sm sm:text-base mt-0.5">
                          {product.name}
                        </h4>
                        {product.barcode && (
                          <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                            Cód: {product.barcode}
                          </span>
                        )}
                      </div>

                      <div>
                        {isOutOfStock && (
                          <span className="px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-black uppercase flex items-center gap-1 shrink-0 animate-pulse">
                            <AlertTriangle className="w-3 h-3 text-rose-400" />
                            Zerado (0 {product.unit})
                          </span>
                        )}
                        {isAtMin && (
                          <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black uppercase flex items-center gap-1 shrink-0">
                            <AlertTriangle className="w-3 h-3 text-amber-400" />
                            Nível Mínimo
                          </span>
                        )}
                        {isHealthy && (
                          <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-black uppercase flex items-center gap-1 shrink-0">
                            <CheckCircle className="w-3 h-3 text-emerald-400" />
                            Estoque Normal
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Bloco de Indicadores de Estoque Atual vs Mínimo */}
                    <div className="bg-[#020617] rounded-xl p-3.5 border border-[#1e293b] space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">Estoque Atual</span>
                          <span className={`text-xl font-black font-mono ${
                            isOutOfStock ? 'text-rose-400' : isAtMin ? 'text-amber-400' : 'text-emerald-400'
                          }`}>
                            {product.stock} <span className="text-xs font-normal text-slate-400">{product.unit}</span>
                          </span>
                        </div>

                        <div className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Nível Mínimo</span>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingMinStockProduct(product);
                                setNewMinStockInput(String(product.minStock));
                              }}
                              className="p-1 hover:bg-slate-800 text-slate-400 hover:text-amber-400 rounded transition cursor-pointer"
                              title="Alterar nível mínimo deste produto"
                            >
                              <Edit className="w-3 h-3" />
                            </button>
                          </div>
                          <span className="text-sm font-bold font-mono text-slate-200">
                            {product.minStock} {product.unit}
                          </span>
                        </div>
                      </div>

                      {/* Barra de Progresso Visual de Nível de Estoque */}
                      <div className="space-y-1">
                        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${
                              isOutOfStock 
                                ? 'bg-rose-500 w-0' 
                                : isAtMin 
                                  ? 'bg-amber-400' 
                                  : 'bg-emerald-500'
                            }`}
                            style={{ width: `${percentOfMin}%` }}
                          />
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono">
                          <span>{isOutOfStock ? 'Estoque Esgotado' : `${percentOfMin}% do nível de segurança`}</span>
                          <span>Preço Custo: {formatBRL(product.costPrice || 0)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Sugestão de Reposição & Custo Estimado */}
                    <div className="bg-[#0f172a] p-3 rounded-xl border border-[#1e293b] flex items-center justify-between text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Sugestão de Reposição</span>
                        <span className="font-bold text-amber-300 font-mono">
                          +{suggestedRestock} {product.unit}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block">Investimento Estimado</span>
                        <span className="font-bold text-slate-200 font-mono">
                          {formatBRL(suggestedCost)}
                        </span>
                      </div>
                    </div>

                    {/* Ações de Reabastecimento Rápido */}
                    <div className="space-y-2 pt-1 border-t border-[#1e293b]">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                        Entrada Rápida de Estoque (+ Reposição):
                      </span>
                      
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => handleQuickAddStock(product, 5)}
                          className="px-2.5 py-1.5 bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-300 border border-slate-700 rounded-lg text-xs font-mono font-bold transition cursor-pointer"
                        >
                          +5 {product.unit}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickAddStock(product, 10)}
                          className="px-2.5 py-1.5 bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-300 border border-slate-700 rounded-lg text-xs font-mono font-bold transition cursor-pointer"
                        >
                          +10 {product.unit}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickAddStock(product, 20)}
                          className="px-2.5 py-1.5 bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-300 border border-slate-700 rounded-lg text-xs font-mono font-bold transition cursor-pointer"
                        >
                          +20 {product.unit}
                        </button>

                        {/* Campo de quantidade customizada */}
                        <div className="flex items-center gap-1 ml-auto">
                          <input
                            type="number"
                            min="1"
                            step="1"
                            placeholder="Qtd"
                            value={quickAddQuantities[product.id] || ''}
                            onChange={(e) => setQuickAddQuantities(prev => ({ ...prev, [product.id]: e.target.value }))}
                            className="w-16 bg-[#020617] border border-[#1e293b] focus:border-amber-400 rounded-lg px-2 py-1 text-xs text-white font-mono outline-none text-center"
                          />
                          <button
                            type="button"
                            onClick={() => handleCustomAddStock(product)}
                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                          >
                            Entrada
                          </button>
                        </div>
                      </div>

                      {/* Botão de Cotação WhatsApp */}
                      <div className="pt-1 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingMinStockProduct(product);
                            setNewMinStockInput(String(product.minStock));
                          }}
                          className="text-[11px] text-slate-400 hover:text-amber-400 flex items-center gap-1 transition cursor-pointer"
                        >
                          <SlidersHorizontal className="w-3 h-3" />
                          <span>Ajustar Mínimo (atual: {product.minStock})</span>
                        </button>

                        <a
                          href={`https://wa.me/?text=${whatsappText}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition cursor-pointer font-bold"
                          title="Cotar este produto no WhatsApp do distribuidor"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>Cotar no Fornecedor</span>
                        </a>
                      </div>

                    </div>

                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

      {/* ================= MODAL DE AJUSTE RÁPIDO DO NÍVEL MÍNIMO DEFINIDO ================= */}
      {editingMinStockProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0f172a] border border-amber-500/40 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#1e293b] pb-3">
              <div>
                <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block">Gatilho de Notificação</span>
                <h3 className="font-bold text-white text-sm mt-0.5">{editingMinStockProduct.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingMinStockProduct(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMinStock} className="space-y-4">
              <div>
                <label className="text-xs text-slate-300 font-bold block mb-1">
                  Estoque Mínimo para Disparar Alerta ({editingMinStockProduct.unit})
                </label>
                <p className="text-[11px] text-slate-400 mb-2">
                  Quando a quantidade deste produto for igual ou menor a este número, o sistema notificará o administrador automaticamente.
                </p>
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={newMinStockInput}
                  onChange={(e) => setNewMinStockInput(e.target.value)}
                  className="w-full bg-[#020617] border border-[#1e293b] focus:border-amber-400 rounded-xl px-4 py-2.5 text-white font-mono font-bold text-base outline-none"
                  placeholder="Ex: 5"
                />
              </div>

              <div className="bg-[#020617] p-3 rounded-xl border border-[#1e293b] flex items-center justify-between text-xs">
                <span className="text-slate-400">Estoque Atual:</span>
                <span className="font-mono font-bold text-white">{editingMinStockProduct.stock} {editingMinStockProduct.unit}</span>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingMinStockProduct(null)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black transition cursor-pointer shadow-lg shadow-amber-500/20"
                >
                  Salvar Novo Mínimo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL DE AJUSTE RÁPIDO DE QUANTIDADE DO PRODUTO ================= */}
      {selectedProductForQuantity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-amber-500/40 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div>
                <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block">
                  {selectedProductForQuantity.categoryLabel || getCategoryLabel(selectedProductForQuantity.category)}
                </span>
                <h3 className="font-bold text-white text-sm mt-0.5">{selectedProductForQuantity.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProductForQuantity(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between bg-[#020617] p-3 rounded-xl border border-slate-800">
                <div>
                  <span className="text-[10px] text-slate-500 block">Preço Unitário</span>
                  <span className="text-base font-black font-mono text-emerald-400">
                    {formatBRL(selectedProductForQuantity.salePrice)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 block">Estoque Disponível</span>
                  <span className="text-xs font-mono font-bold text-slate-300">
                    {selectedProductForQuantity.stock} {selectedProductForQuantity.unit}
                  </span>
                </div>
              </div>

              {/* Seletor e Botões Rápidos de Quantidade */}
              <div>
                <label className="block text-slate-300 font-bold mb-1.5 text-xs">
                  Quantidade a adicionar:
                </label>
                
                {/* Botões Rápidos de Quantidade Pré-definida */}
                <div className="grid grid-cols-5 gap-1.5 mb-2">
                  {[1, 2, 3, 5, 10].map(q => (
                    <button
                      key={q}
                      type="button"
                      disabled={q > selectedProductForQuantity.stock}
                      onClick={() => setQuantityInput(q)}
                      className={`py-1.5 rounded-lg font-bold text-xs transition cursor-pointer border ${
                        quantityInput === q
                          ? 'bg-amber-500 text-slate-950 border-amber-400 font-black'
                          : 'bg-[#020617] text-slate-300 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {q}x
                    </button>
                  ))}
                </div>

                {/* Ajuste Fino (+ / - e Digitação) */}
                <div className="flex items-center bg-[#020617] border border-slate-700 rounded-xl p-1">
                  <button
                    type="button"
                    onClick={() => setQuantityInput(prev => Math.max(1, prev - 1))}
                    className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg font-black text-sm cursor-pointer"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="1"
                    max={selectedProductForQuantity.stock}
                    value={quantityInput}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10) || 1;
                      setQuantityInput(Math.min(selectedProductForQuantity.stock, Math.max(1, val)));
                    }}
                    className="w-full text-center bg-transparent text-lg font-mono font-black text-white focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setQuantityInput(prev => Math.min(selectedProductForQuantity.stock, prev + 1))}
                    className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg font-black text-sm cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Subtotal Calculado */}
              <div className="bg-slate-950 p-2.5 rounded-xl border border-emerald-500/30 flex items-center justify-between text-xs">
                <span className="text-slate-400">Total do Item:</span>
                <span className="font-mono font-black text-base text-emerald-400">
                  {formatBRL(selectedProductForQuantity.salePrice * quantityInput)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedProductForQuantity(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleConfirmAddToCartWithQuantity(selectedProductForQuantity, quantityInput)}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer shadow-lg shadow-amber-500/20"
              >
                <Check className="w-4 h-4" />
                Adicionar {quantityInput}x ({formatBRL(selectedProductForQuantity.salePrice * quantityInput)})
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ================= MODAL: CADASTRAR OU EDITAR PRODUTO ================= */}
      {(showNewProductModal || showEditProductModal) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Package className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-white text-base">
                    {editingProduct ? 'Editar Produto de Venda' : 'Cadastrar Novo Produto para Venda'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Produtos exclusivos para venda ao cliente no balcão da loja
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowNewProductModal(false);
                  setShowEditProductModal(false);
                  setEditingProduct(null);
                }}
                className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4 text-xs">
              
              <div>
                <label className="block text-slate-300 font-bold mb-1">Nome do Produto *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Aromatizante Little Trees Baunilha"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Categoria Comercial *</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-400 cursor-pointer"
                  >
                    <option value="aromatizantes">🌸 Aromatizantes</option>
                    <option value="estetica_automotiva">✨ Estética Automotiva & Ceras</option>
                    <option value="conveniencia_bebidas">🥤 Bebidas & Conveniência</option>
                    <option value="acessorios">🧽 Acessórios & Panos</option>
                    <option value="palhetas_limpador">🚗 Palhetas Limpador</option>
                    <option value="outros_produtos">📦 Outros Produtos</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">Código de Barras / Ref (Opcional)</label>
                  <input
                    type="text"
                    placeholder="7891234567890"
                    value={formBarcode}
                    onChange={(e) => setFormBarcode(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              {/* Preços e Formação de Margem */}
              <div className="bg-[#020617] border border-slate-800 rounded-xl p-3.5 space-y-3">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Precificação & Margem de Lucro
                </span>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1 text-[11px]">Preço de Custo (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formCostPrice}
                      onChange={(e) => setFormCostPrice(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 text-[11px]">Preço de Venda (R$) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formSalePrice}
                      onChange={(e) => setFormSalePrice(e.target.value)}
                      className="w-full bg-slate-900 border border-emerald-500/50 rounded-lg px-2.5 py-1.5 text-emerald-400 font-mono font-black text-sm"
                    />
                  </div>

                  <div className="col-span-2 sm:col-span-1 bg-slate-900/60 p-2 rounded-lg border border-slate-800 flex flex-col justify-center">
                    <span className="text-[10px] text-slate-500">Lucro Bruto:</span>
                    <span className="text-xs font-black font-mono text-emerald-400">
                      {formatBRL((parseFloat(formSalePrice) || 0) - (parseFloat(formCostPrice) || 0))}
                    </span>
                  </div>
                </div>
              </div>

              {/* Controle de Estoque */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Estoque Inicial</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formStock}
                    onChange={(e) => setFormStock(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">Estoque Mínimo</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formMinStock}
                    onChange={(e) => setFormMinStock(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">Unidade</label>
                  <input
                    type="text"
                    required
                    placeholder="unidades, latas..."
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Observações (Opcional)</label>
                <textarea
                  rows={2}
                  placeholder="Informações adicionais do produto..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewProductModal(false);
                    setShowEditProductModal(false);
                    setEditingProduct(null);
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl transition cursor-pointer shadow-lg shadow-blue-600/30 flex items-center gap-1.5"
                >
                  <CheckCircle className="w-4 h-4" />
                  {editingProduct ? 'Salvar Alterações' : 'Cadastrar Produto'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* ================= MODAL: RECIBO / COMPROVANTE DE VENDA ================= */}
      {showReceiptModal && lastCompletedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <Receipt className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-white text-base">Comprovante de Venda</h3>
                  <p className="text-xs text-slate-400">Venda #{lastCompletedSale.saleNumber || lastCompletedSale.id.slice(-4)}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowReceiptModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cupom Impresso Formatado */}
            <div className="bg-white text-slate-950 font-mono text-xs p-5 rounded-xl shadow-inner space-y-3 leading-relaxed">
              <div className="text-center border-b border-dashed border-slate-300 pb-2">
                <h4 className="font-black text-sm uppercase">{tenant.nomeFantasia || tenant.name}</h4>
                <p className="text-[10px] text-slate-600">COMPROVANTE DE VENDA DE BALCÃO</p>
                <p className="text-[10px] text-slate-600">
                  Venda #{lastCompletedSale.saleNumber || lastCompletedSale.id.slice(-4)} | {lastCompletedSale.date} às {lastCompletedSale.time}
                </p>
                <span className="inline-block mt-1 text-[9px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold">
                  {lastCompletedSale.integrateWithOperationalCash ? 'Lançado no Caixa Geral' : 'Caixa Exclusivo Balcão'}
                </span>
              </div>

              <div className="border-b border-dashed border-slate-300 pb-2 space-y-1">
                <p className="text-[11px]">
                  <strong>Cliente:</strong> {lastCompletedSale.clientName || 'Consumidor Final'}
                </p>
                {lastCompletedSale.clientPhone && (
                  <p className="text-[11px]">
                    <strong>Tel:</strong> {lastCompletedSale.clientPhone}
                  </p>
                )}
              </div>

              <div className="space-y-1.5 border-b border-dashed border-slate-300 pb-2">
                <div className="flex justify-between font-bold text-[11px] text-slate-600">
                  <span>ITEM</span>
                  <span>TOTAL</span>
                </div>
                {lastCompletedSale.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-[11px]">
                    <span>{item.quantity}x {item.name}</span>
                    <span>{formatBRL(item.totalPrice)}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-1 border-b border-dashed border-slate-300 pb-2">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{formatBRL(lastCompletedSale.subtotal)}</span>
                </div>
                {lastCompletedSale.discount > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Desconto:</span>
                    <span>- {formatBRL(lastCompletedSale.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-sm pt-1">
                  <span>TOTAL A PAGAR:</span>
                  <span>{formatBRL(lastCompletedSale.totalAmount)}</span>
                </div>
              </div>

              <div className="space-y-1 text-[11px] border-b border-dashed border-slate-300 pb-2">
                <div className="flex justify-between">
                  <span>Forma de Pagto:</span>
                  <span className="font-bold">{lastCompletedSale.paymentMethod}</span>
                </div>
                {lastCompletedSale.paymentMethod === 'Dinheiro' && lastCompletedSale.cashGiven && (
                  <>
                    <div className="flex justify-between">
                      <span>Valor Pago:</span>
                      <span>{formatBRL(lastCompletedSale.cashGiven)}</span>
                    </div>
                    <div className="flex justify-between font-bold">
                      <span>Troco:</span>
                      <span>{formatBRL(lastCompletedSale.changeGiven || 0)}</span>
                    </div>
                  </>
                )}
              </div>

              <div className="text-center text-[10px] text-slate-500 pt-1">
                Agradecemos a preferência! Volte sempre!
              </div>
            </div>

            {/* Ações */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  const text = `🧾 *Comprovante de Compra - ${tenant.nomeFantasia || tenant.name}*\nVenda #${lastCompletedSale.saleNumber || lastCompletedSale.id.slice(-4)}\n📅 Data: ${lastCompletedSale.date} às ${lastCompletedSale.time}\n👤 Cliente: ${lastCompletedSale.clientName}\n\n*Itens:*\n${lastCompletedSale.items.map(i => `• ${i.quantity}x ${i.name} - ${formatBRL(i.totalPrice)}`).join('\n')}\n\n*Total Pago:* ${formatBRL(lastCompletedSale.totalAmount)} (${lastCompletedSale.paymentMethod})\n\nAgradecemos a preferência!`;
                  window.open(`https://api.whatsapp.com/send?phone=${lastCompletedSale.clientPhone?.replace(/\D/g, '') || ''}&text=${encodeURIComponent(text)}`, '_blank');
                }}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                <span>WhatsApp</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Printer className="w-4 h-4" /> Imprimir
                </button>
                <button
                  type="button"
                  onClick={() => setShowReceiptModal(false)}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition cursor-pointer"
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
