import React, { useState, useEffect, useMemo } from 'react';
import { 
  Fuel, 
  Package, 
  Plus, 
  Trash2, 
  Printer, 
  Calendar, 
  Clock, 
  Car, 
  Check, 
  AlertTriangle, 
  CheckCircle, 
  Search, 
  MessageSquare, 
  DollarSign, 
  Percent, 
  Sparkles, 
  Eye, 
  Edit3, 
  Wrench, 
  Layers, 
  X, 
  ShieldCheck, 
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Filter
} from 'lucide-react';
import { Tenant, OilProductItem, OilChangeRecord, OilProductCategory } from '../types';
import { 
  saveOilProductToFirestore, 
  deleteOilProductFromFirestore, 
  subscribeToTenantOilProducts,
  saveOilChangeToFirestore,
  deleteOilChangeFromFirestore,
  subscribeToTenantOilChanges
} from '../lib/firebaseService';

interface TrocaOleoWorkspaceProps {
  tenant: Tenant;
  onToast: (msg: string) => void;
}

export const CATEGORY_LABELS: Record<OilProductCategory, string> = {
  oleo_motor: '🛢️ Óleo de Motor',
  filtro_oleo: '🔘 Filtro de Óleo',
  filtro_ar: '💨 Filtro de Ar',
  filtro_combustivel: '⛽ Filtro de Combustível',
  filtro_cabine: '❄️ Filtro de Cabine (Ar Cond.)',
  correia_dentada: '⚙️ Correia Dentada',
  fluido_freio: '🛑 Fluído de Freio',
  aditivo_radiador: '🧪 Aditivo de Radiador',
  outros: '📦 Outros Produtos & Peças'
};

const DEFAULT_PRODUCTS: Omit<OilProductItem, 'tenantId'>[] = [
  {
    id: 'prod-oil-5w30',
    name: 'Óleo 5W30 Sintético API SP',
    category: 'oleo_motor',
    brand: 'Mobil Super',
    viscosity: '5W30',
    code: 'MOB-5W30',
    stock: 48,
    minStock: 12,
    unit: 'litros',
    purchasePrice: 32.00,
    markupPercent: 30,
    salePrice: 41.60, // 32 * 1.30
    updatedAt: new Date().toISOString()
  },
  {
    id: 'prod-oil-10w40',
    name: 'Óleo 10W40 Semissintético',
    category: 'oleo_motor',
    brand: 'Lubrax Tecno',
    viscosity: '10W40',
    code: 'LUB-10W40',
    stock: 36,
    minStock: 8,
    unit: 'litros',
    purchasePrice: 26.00,
    markupPercent: 30,
    salePrice: 33.80, // 26 * 1.30
    updatedAt: new Date().toISOString()
  },
  {
    id: 'prod-oil-15w40',
    name: 'Óleo 15W40 Mineral',
    category: 'oleo_motor',
    brand: 'Castrol GTX',
    viscosity: '15W40',
    code: 'CAS-15W40',
    stock: 24,
    minStock: 6,
    unit: 'litros',
    purchasePrice: 22.00,
    markupPercent: 30,
    salePrice: 28.60, // 22 * 1.30
    updatedAt: new Date().toISOString()
  },
  {
    id: 'prod-filtro-psl55',
    name: 'Filtro de Óleo PSL55',
    category: 'filtro_oleo',
    brand: 'Tecfil',
    code: 'TEC-PSL55',
    stock: 15,
    minStock: 4,
    unit: 'unidades',
    purchasePrice: 18.00,
    markupPercent: 30,
    salePrice: 23.40, // 18 * 1.30
    updatedAt: new Date().toISOString()
  },
  {
    id: 'prod-filtro-ar-arl4152',
    name: 'Filtro de Ar Motor ARL4152',
    category: 'filtro_ar',
    brand: 'Tecfil',
    code: 'TEC-ARL4152',
    stock: 8,
    minStock: 3,
    unit: 'unidades',
    purchasePrice: 25.00,
    markupPercent: 30,
    salePrice: 32.50, // 25 * 1.30
    updatedAt: new Date().toISOString()
  },
  {
    id: 'prod-correia-ct874',
    name: 'Correia Dentada CT874 (121 Dentes)',
    category: 'correia_dentada',
    brand: 'Continental Contitech',
    code: 'CONTI-CT874',
    stock: 5,
    minStock: 2,
    unit: 'unidades',
    purchasePrice: 65.00,
    markupPercent: 30,
    salePrice: 84.50, // 65 * 1.30
    updatedAt: new Date().toISOString()
  }
];

export const TrocaOleoWorkspace: React.FC<TrocaOleoWorkspaceProps> = ({ tenant, onToast }) => {
  const [activeSubTab, setActiveSubTab] = useState<'trocas' | 'estoque' | 'lembretes'>('trocas');
  
  // Lista de Produtos do Estoque
  const [products, setProducts] = useState<OilProductItem[]>(() => {
    const saved = localStorage.getItem(`saas_oil_products_${tenant.id}`);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return DEFAULT_PRODUCTS.map(p => ({ ...p, tenantId: tenant.id }));
  });

  // Lista de Trocas de Óleo
  const [oilChanges, setOilChanges] = useState<OilChangeRecord[]>(() => {
    const saved = localStorage.getItem(`saas_oil_changes_${tenant.id}`);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [];
  });

  // Modais
  const [showNewChangeModal, setShowNewChangeModal] = useState<boolean>(false);
  const [showNewProductModal, setShowNewProductModal] = useState<boolean>(false);
  const [selectedChangeForSticker, setSelectedChangeForSticker] = useState<OilChangeRecord | null>(null);

  // Busca e Filtros
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('todas');

  // Sincronização em tempo real do Firestore
  useEffect(() => {
    const unsubProducts = subscribeToTenantOilProducts(tenant.id, (remoteProducts) => {
      if (remoteProducts && remoteProducts.length > 0) {
        setProducts(remoteProducts);
        localStorage.setItem(`saas_oil_products_${tenant.id}`, JSON.stringify(remoteProducts));
      }
    });

    const unsubChanges = subscribeToTenantOilChanges(tenant.id, (remoteChanges) => {
      if (remoteChanges) {
        setOilChanges(remoteChanges);
        localStorage.setItem(`saas_oil_changes_${tenant.id}`, JSON.stringify(remoteChanges));
      }
    });

    return () => {
      unsubProducts();
      unsubChanges();
    };
  }, [tenant.id]);

  // ================= FORMULÁRIO DE NOVA TROCA DE ÓLEO =================
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [currentKmInput, setCurrentKmInput] = useState<string>('75000');
  const [selectedIntervalKm, setSelectedIntervalKm] = useState<8000 | 10000>(10000); // 8.000 ou 10.000 km
  const [selectedOilProduct, setSelectedOilProduct] = useState<string>('prod-oil-5w30');
  const [oilLiters, setOilLiters] = useState<number>(4);
  const [selectedFilters, setSelectedFilters] = useState<string[]>(['prod-filtro-psl55']);
  const [laborPrice, setLaborPrice] = useState<number>(40);
  const [paymentMethod, setPaymentMethod] = useState<'PIX' | 'Cartão de Débito' | 'Cartão de Crédito' | 'Dinheiro'>('PIX');
  const [technicianName, setTechnicianName] = useState<string>('Técnico do Pátio');
  const [changeNotes, setChangeNotes] = useState<string>('');

  // Cálculo Automático da Próxima Troca de Óleo
  const currentKmNumber = useMemo(() => {
    const cleaned = parseInt(currentKmInput.replace(/\D/g, ''), 10);
    return isNaN(cleaned) ? 0 : cleaned;
  }, [currentKmInput]);

  const calculatedNextKm = useMemo(() => {
    return currentKmNumber + selectedIntervalKm;
  }, [currentKmNumber, selectedIntervalKm]);

  // Previsão de Data para Próxima Troca (6 meses a partir de hoje)
  const calculatedNextDate = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 6);
    return d.toLocaleDateString('pt-BR');
  }, []);

  // Itens Selecionados e Cálculo do Total da Troca
  const selectedOilItem = useMemo(() => {
    return products.find(p => p.id === selectedOilProduct);
  }, [products, selectedOilProduct]);

  const totalCalculatedPrice = useMemo(() => {
    let total = Number(laborPrice || 0);
    if (selectedOilItem) {
      total += selectedOilItem.salePrice * Number(oilLiters || 0);
    }
    selectedFilters.forEach(filterId => {
      const prod = products.find(p => p.id === filterId);
      if (prod) total += prod.salePrice;
    });
    return total;
  }, [laborPrice, selectedOilItem, oilLiters, selectedFilters, products]);

  // Submeter Nova Troca de Óleo
  const handleCreateOilChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehiclePlate.trim() || !vehicleModel.trim() || !clientName.trim()) {
      onToast('⚠️ Preencha nome do cliente, placa e modelo do veículo.');
      return;
    }
    if (currentKmNumber <= 0) {
      onToast('⚠️ Informe a quilometragem atual do veículo.');
      return;
    }

    const itemsUsedList = [];
    if (selectedOilItem) {
      itemsUsedList.push({
        productId: selectedOilItem.id,
        name: selectedOilItem.name,
        category: selectedOilItem.category,
        quantity: Number(oilLiters),
        unitPrice: selectedOilItem.salePrice,
        totalPrice: selectedOilItem.salePrice * Number(oilLiters)
      });
    }

    selectedFilters.forEach(fId => {
      const prod = products.find(p => p.id === fId);
      if (prod) {
        itemsUsedList.push({
          productId: prod.id,
          name: prod.name,
          category: prod.category,
          quantity: 1,
          unitPrice: prod.salePrice,
          totalPrice: prod.salePrice
        });
      }
    });

    const newChangeRecord: OilChangeRecord = {
      id: `troca-${Date.now()}`,
      tenantId: tenant.id,
      clientName: clientName.trim(),
      clientPhone: clientPhone.trim() || undefined,
      vehiclePlate: vehiclePlate.trim().toUpperCase(),
      vehicleModel: vehicleModel.trim(),
      currentKm: currentKmNumber,
      intervalKm: selectedIntervalKm,
      nextChangeKm: calculatedNextKm,
      changeDate: new Date().toLocaleDateString('pt-BR'),
      nextChangeDate: calculatedNextDate,
      oilType: selectedOilItem ? `${selectedOilItem.brand || ''} ${selectedOilItem.viscosity || ''} (${oilLiters}L)`.trim() : 'Óleo de Motor',
      litersUsed: Number(oilLiters),
      itemsUsed: itemsUsedList,
      laborPrice: Number(laborPrice || 0),
      totalPrice: totalCalculatedPrice,
      paymentMethod,
      status: 'Concluído',
      responsibleTechnician: technicianName,
      notes: changeNotes.trim() || undefined,
      createdAt: new Date().toISOString()
    };

    // Atualiza estado local e Firestore
    const updatedChanges = [newChangeRecord, ...oilChanges];
    setOilChanges(updatedChanges);
    localStorage.setItem(`saas_oil_changes_${tenant.id}`, JSON.stringify(updatedChanges));
    await saveOilChangeToFirestore(tenant.id, newChangeRecord);

    // Baixa automática de estoque dos produtos utilizados
    const updatedProducts = products.map(prod => {
      if (selectedOilItem && prod.id === selectedOilItem.id) {
        return { ...prod, stock: Math.max(0, prod.stock - Number(oilLiters)) };
      }
      if (selectedFilters.includes(prod.id)) {
        return { ...prod, stock: Math.max(0, prod.stock - 1) };
      }
      return prod;
    });
    setProducts(updatedProducts);
    localStorage.setItem(`saas_oil_products_${tenant.id}`, JSON.stringify(updatedProducts));
    for (const p of updatedProducts) {
      if ((selectedOilItem && p.id === selectedOilItem.id) || selectedFilters.includes(p.id)) {
        saveOilProductToFirestore(tenant.id, p).catch(console.error);
      }
    }

    setShowNewChangeModal(false);
    setSelectedChangeForSticker(newChangeRecord); // Abre etiqueta imediatamente para impressão
    onToast(`✅ Troca de Óleo registrada! Próxima troca: ${calculatedNextKm.toLocaleString('pt-BR')} km.`);

    // Limpa campos
    setClientName('');
    setClientPhone('');
    setVehiclePlate('');
    setVehicleModel('');
    setChangeNotes('');
  };

  const handleDeleteOilChange = async (changeId: string) => {
    if (!window.confirm('Deseja realmente excluir este registro de troca de óleo?')) return;
    const filtered = oilChanges.filter(c => c.id !== changeId);
    setOilChanges(filtered);
    localStorage.setItem(`saas_oil_changes_${tenant.id}`, JSON.stringify(filtered));
    await deleteOilChangeFromFirestore(tenant.id, changeId);
    onToast('🗑️ Registro de troca de óleo removido.');
  };

  // ================= FORMULÁRIO DE NOVO PRODUTO NO ESTOQUE =================
  const [prodName, setProdName] = useState('');
  const [prodCategory, setProdCategory] = useState<OilProductCategory>('oleo_motor');
  const [prodBrand, setProdBrand] = useState('');
  const [prodViscosity, setProdViscosity] = useState('5W30');
  const [prodCode, setProdCode] = useState('');
  const [prodStock, setProdStock] = useState<number>(24);
  const [prodMinStock, setProdMinStock] = useState<number>(6);
  const [prodUnit, setProdUnit] = useState<'litros' | 'unidades'>('litros');
  const [prodPurchasePriceInput, setProdPurchasePriceInput] = useState<string>('30.00');
  const [prodMarkupInput, setProdMarkupInput] = useState<string>('30'); // 30% automático

  // Cálculo automático do preço de venda com base no valor de compra + 30%
  const purchasePriceVal = useMemo(() => {
    const p = parseFloat(prodPurchasePriceInput.replace(',', '.'));
    return isNaN(p) ? 0 : p;
  }, [prodPurchasePriceInput]);

  const markupVal = useMemo(() => {
    const m = parseFloat(prodMarkupInput.replace(',', '.'));
    return isNaN(m) ? 30 : m; // 30% padrão
  }, [prodMarkupInput]);

  const calculatedSalePrice = useMemo(() => {
    return purchasePriceVal * (1 + markupVal / 100);
  }, [purchasePriceVal, markupVal]);

  const calculatedProfitAmount = useMemo(() => {
    return calculatedSalePrice - purchasePriceVal;
  }, [calculatedSalePrice, purchasePriceVal]);

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodName.trim()) {
      onToast('⚠️ Informe o nome do produto.');
      return;
    }
    if (purchasePriceVal <= 0) {
      onToast('⚠️ Informe o valor de compra do produto.');
      return;
    }

    const newProd: OilProductItem = {
      id: `oil-prod-${Date.now()}`,
      tenantId: tenant.id,
      name: prodName.trim(),
      category: prodCategory,
      brand: prodBrand.trim() || undefined,
      viscosity: prodCategory === 'oleo_motor' ? prodViscosity : undefined,
      code: prodCode.trim() || undefined,
      stock: Number(prodStock) || 0,
      minStock: Number(prodMinStock) || 3,
      unit: prodCategory === 'oleo_motor' ? 'litros' : prodUnit,
      purchasePrice: purchasePriceVal,
      markupPercent: markupVal,
      salePrice: parseFloat(calculatedSalePrice.toFixed(2)),
      updatedAt: new Date().toISOString()
    };

    const updated = [newProd, ...products];
    setProducts(updated);
    localStorage.setItem(`saas_oil_products_${tenant.id}`, JSON.stringify(updated));
    await saveOilProductToFirestore(tenant.id, newProd);

    setShowNewProductModal(false);
    onToast(`📦 Produto "${newProd.name}" cadastrado com margem de +${markupVal}% (R$ ${newProd.salePrice.toFixed(2)})!`);
    
    // Limpa form
    setProdName('');
    setProdCode('');
    setProdBrand('');
  };

  const handleDeleteProduct = async (prodId: string) => {
    if (!window.confirm('Deseja excluir este item do estoque?')) return;
    const filtered = products.filter(p => p.id !== prodId);
    setProducts(filtered);
    localStorage.setItem(`saas_oil_products_${tenant.id}`, JSON.stringify(filtered));
    await deleteOilProductFromFirestore(tenant.id, prodId);
    onToast('🗑️ Item removido do estoque de lubrificantes.');
  };

  const handleQuickAddStock = async (prod: OilProductItem, amount: number) => {
    const updated = products.map(p => p.id === prod.id ? { ...p, stock: p.stock + amount } : p);
    setProducts(updated);
    localStorage.setItem(`saas_oil_products_${tenant.id}`, JSON.stringify(updated));
    const target = updated.find(p => p.id === prod.id);
    if (target) await saveOilProductToFirestore(tenant.id, target);
    onToast(`Estoque atualizado: +${amount} ${prod.unit} em ${prod.name}`);
  };

  // Estatísticas
  const lowStockProducts = products.filter(p => p.stock <= p.minStock);
  const totalStockCost = products.reduce((acc, p) => acc + (p.purchasePrice * p.stock), 0);
  const totalStockValue = products.reduce((acc, p) => acc + (p.salePrice * p.stock), 0);
  const totalRevenueOilChanges = oilChanges.reduce((acc, c) => acc + c.totalPrice, 0);

  // Filtragem de Trocas
  const filteredChanges = useMemo(() => {
    return oilChanges.filter(c => {
      const matchSearch = c.vehiclePlate.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          c.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          c.vehicleModel.toLowerCase().includes(searchTerm.toLowerCase());
      return matchSearch;
    });
  }, [oilChanges, searchTerm]);

  // Filtragem de Produtos
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchCat = filterCategory === 'todas' || p.category === filterCategory;
      const matchSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (p.brand && p.brand.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (p.viscosity && p.viscosity.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchCat && matchSearch;
    });
  }, [products, filterCategory, searchTerm]);

  return (
    <div className="space-y-6">
      
      {/* ================= HEADER DO MÓDULO ================= */}
      <div className="bg-gradient-to-r from-slate-900 via-amber-950/30 to-slate-900 border border-amber-500/30 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-44 h-44 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400">
                <Fuel className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <span>Troca de Óleo & Lubrificação</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Gestão completa de trocas de óleo, quilometragem programada, estoque com margem de 30% e emissão de etiquetas.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={() => setShowNewProductModal(true)}
              className="py-2.5 px-3.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
            >
              <Package className="w-4 h-4 text-amber-400" />
              <span>+ Cadastrar Produto / Peça</span>
            </button>

            <button
              type="button"
              onClick={() => setShowNewChangeModal(true)}
              className="py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 transition cursor-pointer shadow-lg shadow-amber-500/20"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Troca de Óleo</span>
            </button>
          </div>
        </div>

        {/* Resumo Rápido de Métricas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-slate-800/80">
          <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-xl">
            <span className="text-[10px] text-slate-400 block font-medium">Trocas Realizadas</span>
            <span className="text-lg font-black text-amber-400 mt-0.5 block">{oilChanges.length}</span>
            <span className="text-[10px] text-slate-500">veículos atendidos</span>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-xl">
            <span className="text-[10px] text-slate-400 block font-medium">Faturamento em Trocas</span>
            <span className="text-lg font-black text-emerald-400 mt-0.5 block">
              R$ {totalRevenueOilChanges.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-slate-500">produtos + mão de obra</span>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-xl">
            <span className="text-[10px] text-slate-400 block font-medium">Itens no Estoque</span>
            <span className="text-lg font-black text-blue-400 mt-0.5 block">{products.length} cadastrados</span>
            <span className="text-[10px] text-slate-500">margem automática +30%</span>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-xl">
            <span className="text-[10px] text-slate-400 block font-medium">Alertas de Reposição</span>
            <span className={`text-lg font-black mt-0.5 block ${lowStockProducts.length > 0 ? 'text-rose-400 animate-pulse' : 'text-slate-400'}`}>
              {lowStockProducts.length} itens baixos
            </span>
            <span className="text-[10px] text-slate-500">
              {lowStockProducts.length > 0 ? 'necessitam reposição' : 'estoque equilibrado'}
            </span>
          </div>
        </div>
      </div>

      {/* ================= ABAS INTERNAS ================= */}
      <div className="flex border-b border-slate-800 gap-2">
        <button
          type="button"
          onClick={() => setActiveSubTab('trocas')}
          className={`py-3 px-4 font-bold text-xs flex items-center gap-2 border-b-2 transition cursor-pointer ${
            activeSubTab === 'trocas'
              ? 'border-amber-400 text-amber-300'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Fuel className="w-4 h-4" />
          <span>Ordens de Troca de Óleo ({oilChanges.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('estoque')}
          className={`py-3 px-4 font-bold text-xs flex items-center gap-2 border-b-2 transition cursor-pointer ${
            activeSubTab === 'estoque'
              ? 'border-amber-400 text-amber-300'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Controle de Estoque & Peças ({products.length})</span>
          {lowStockProducts.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-rose-500/20 text-rose-300 text-[10px] border border-rose-500/30">
              {lowStockProducts.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('lembretes')}
          className={`py-3 px-4 font-bold text-xs flex items-center gap-2 border-b-2 transition cursor-pointer ${
            activeSubTab === 'lembretes'
              ? 'border-amber-400 text-amber-300'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Próximas Trocas & Lembretes</span>
        </button>
      </div>

      {/* ================= CONTEÚDO DA SUB-ABA 1: TROCAS DE ÓLEO ================= */}
      {activeSubTab === 'trocas' && (
        <div className="space-y-4">
          
          {/* Barra de Busca e Ação Rápida */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Buscar por placa, cliente ou carro..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowNewChangeModal(true)}
              className="w-full sm:w-auto py-2 px-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-md"
            >
              <Plus className="w-4 h-4" />
              <span>Registrar Troca de Óleo</span>
            </button>
          </div>

          {/* Lista de Trocas Realizadas */}
          {filteredChanges.length === 0 ? (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-10 text-center space-y-3">
              <Fuel className="w-10 h-10 text-amber-400/40 mx-auto" />
              <h3 className="text-base font-bold text-slate-200">Nenhuma troca de óleo registrada ainda</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Registre uma nova troca de óleo selecionando a quilometragem atual do veículo e os produtos utilizados.
              </p>
              <button
                type="button"
                onClick={() => setShowNewChangeModal(true)}
                className="inline-flex items-center gap-1.5 py-2 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition cursor-pointer mt-2"
              >
                <Plus className="w-3.5 h-3.5" /> Fazer Primeira Troca
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredChanges.map(change => (
                <div 
                  key={change.id}
                  className="bg-slate-900 border border-slate-800 hover:border-amber-500/40 rounded-2xl p-4 space-y-3 transition shadow-lg relative flex flex-col justify-between"
                >
                  <div className="space-y-2.5">
                    {/* Cabeçalho do Card */}
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-mono font-black text-sm text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                          {change.vehiclePlate}
                        </span>
                        <h4 className="font-bold text-white text-sm mt-1">{change.vehicleModel}</h4>
                        <p className="text-[11px] text-slate-400 flex items-center gap-1">
                          👤 {change.clientName} {change.clientPhone ? `· ${change.clientPhone}` : ''}
                        </p>
                      </div>

                      <span className="text-[10px] font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                        {change.changeDate}
                      </span>
                    </div>

                    {/* Destaque de Quilometragem (Atual vs Próxima Calculada Automaticamente) */}
                    <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-2.5 grid grid-cols-2 gap-2 text-center">
                      <div className="border-r border-slate-800 pr-1">
                        <span className="text-[10px] text-slate-500 block font-medium">KM NA TROCA</span>
                        <span className="text-xs font-mono font-bold text-slate-200">
                          {change.currentKm.toLocaleString('pt-BR')} km
                        </span>
                      </div>
                      <div className="pl-1">
                        <span className="text-[10px] text-amber-400/90 block font-black flex items-center justify-center gap-1">
                          PRÓXIMA (+{change.intervalKm.toLocaleString('pt-BR')} km)
                        </span>
                        <span className="text-sm font-mono font-black text-amber-300">
                          {change.nextChangeKm.toLocaleString('pt-BR')} km
                        </span>
                      </div>
                    </div>

                    {/* Produtos Utilizados */}
                    <div className="space-y-1 text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
                      <div className="flex justify-between">
                        <span>🛢️ Óleo:</span>
                        <span className="font-medium text-slate-200">{change.oilType || 'Conforme especificação'}</span>
                      </div>
                      {change.itemsUsed && change.itemsUsed.length > 0 && (
                        <div className="flex justify-between">
                          <span>📦 Itens:</span>
                          <span className="font-medium text-slate-200 truncate max-w-[180px]">
                            {change.itemsUsed.map(i => `${i.quantity}x ${i.name}`).join(', ')}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between text-emerald-400 font-bold pt-1">
                        <span>Total Pago ({change.paymentMethod || 'PIX'}):</span>
                        <span>R$ {change.totalPrice.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Ações: Imprimir Etiqueta Adesiva, WhatsApp e Excluir */}
                  <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => setSelectedChangeForSticker(change)}
                      className="flex-1 py-1.5 px-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition cursor-pointer"
                      title="Gerar etiqueta adesiva para colar no para-brisa"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Etiqueta Adesiva</span>
                    </button>

                    {change.clientPhone && (
                      <a
                        href={`https://wa.me/55${change.clientPhone.replace(/\D/g, '')}?text=${encodeURIComponent(
                          `Olá ${change.clientName}! Passando para registrar a troca de óleo do seu ${change.vehicleModel} (${change.vehiclePlate}) realizada em ${change.changeDate}. Sua próxima troca está prevista para ${change.nextChangeKm.toLocaleString('pt-BR')} km ou em 6 meses (${change.nextChangeDate}). Obrigado pela confiança no ${tenant.nomeFantasia || tenant.name}!`
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-bold flex items-center justify-center transition"
                        title="Enviar comprovante e lembrete no WhatsApp"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={() => handleDeleteOilChange(change.id)}
                      className="p-1.5 bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-lg transition cursor-pointer"
                      title="Excluir registro"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ================= CONTEÚDO DA SUB-ABA 2: ESTOQUE DE PRODUTOS ================= */}
      {activeSubTab === 'estoque' && (
        <div className="space-y-4">
          
          {/* Barra de Filtros e Cadastro */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
              <div className="relative flex-1 md:w-64">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Buscar produto ou viscosidade..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                <option value="todas">Todas as Categorias</option>
                <option value="oleo_motor">🛢️ Óleos de Motor</option>
                <option value="filtro_oleo">🔘 Filtros de Óleo</option>
                <option value="filtro_ar">💨 Filtros de Ar</option>
                <option value="filtro_combustivel">⛽ Filtros de Combustível</option>
                <option value="filtro_cabine">❄️ Filtros de Cabine</option>
                <option value="correia_dentada">⚙️ Correias Dentadas</option>
                <option value="fluido_freio">🛑 Fluídos de Freio</option>
                <option value="aditivo_radiador">🧪 Aditivos</option>
                <option value="outros">📦 Outros</option>
              </select>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto justify-end">
              <div className="text-[11px] text-slate-400 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
                <span>Custo Total: <strong>R$ {totalStockCost.toFixed(2)}</strong></span>
                <span className="mx-2 text-slate-600">|</span>
                <span className="text-emerald-400">Venda (+30%): <strong>R$ {totalStockValue.toFixed(2)}</strong></span>
              </div>

              <button
                type="button"
                onClick={() => setShowNewProductModal(true)}
                className="py-2 px-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Novo Produto</span>
              </button>
            </div>
          </div>

          {/* Tabela de Produtos do Estoque */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Produto & Categoria</th>
                    <th className="py-3 px-4">Estoque Atual</th>
                    <th className="py-3 px-4">Preço de Compra</th>
                    <th className="py-3 px-4">Cálculo Margem</th>
                    <th className="py-3 px-4">Preço de Venda</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 text-slate-300">
                  {filteredProducts.map(prod => {
                    const isLow = prod.stock <= prod.minStock;
                    const profit = prod.salePrice - prod.purchasePrice;

                    return (
                      <tr key={prod.id} className="hover:bg-slate-850/50 transition">
                        {/* Produto */}
                        <td className="py-3 px-4">
                          <div className="font-bold text-white text-xs">{prod.name}</div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                            <span className="text-amber-400">{CATEGORY_LABELS[prod.category] || prod.category}</span>
                            {prod.viscosity && <span className="font-mono bg-slate-800 px-1 rounded text-slate-300">{prod.viscosity}</span>}
                            {prod.brand && <span>· {prod.brand}</span>}
                            {prod.code && <span className="font-mono text-slate-500">[{prod.code}]</span>}
                          </div>
                        </td>

                        {/* Estoque */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className={`font-mono font-black text-sm ${isLow ? 'text-rose-400' : 'text-slate-100'}`}>
                              {prod.stock} {prod.unit}
                            </span>
                            {isLow && (
                              <span className="text-[10px] bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded border border-rose-500/30 flex items-center gap-1">
                                <AlertTriangle className="w-2.5 h-2.5" /> Baixo (mín. {prod.minStock})
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Preço de Compra */}
                        <td className="py-3 px-4 font-mono">
                          R$ {prod.purchasePrice.toFixed(2)}
                        </td>

                        {/* Cálculo Automático de 30% */}
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold font-mono text-[11px]">
                            <Percent className="w-3 h-3" />
                            +{prod.markupPercent}% (+R$ {profit.toFixed(2)})
                          </span>
                        </td>

                        {/* Preço de Venda */}
                        <td className="py-3 px-4 font-mono font-black text-amber-300 text-sm">
                          R$ {prod.salePrice.toFixed(2)}
                        </td>

                        {/* Ações */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleQuickAddStock(prod, prod.unit === 'litros' ? 12 : 5)}
                              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] font-bold cursor-pointer transition"
                              title={`Entrada rápida (+${prod.unit === 'litros' ? '12L' : '5 un'})`}
                            >
                              +{prod.unit === 'litros' ? '12L' : '5un'}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteProduct(prod.id)}
                              className="p-1.5 text-slate-500 hover:text-rose-400 rounded transition cursor-pointer"
                              title="Excluir produto"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= CONTEÚDO DA SUB-ABA 3: LEMBRETES & PRÓXIMAS TROCAS ================= */}
      {activeSubTab === 'lembretes' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-amber-400" />
                <span>Cronograma de Próximas Trocas Programadas</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Acompanhe os clientes e veículos que estão atingindo a quilometragem recomendada ou a data limite de 6 meses.
              </p>
            </div>

            {oilChanges.length === 0 ? (
              <p className="text-xs text-slate-500">Nenhuma troca registrada para gerar lembretes.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {oilChanges.map(change => (
                  <div key={change.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-amber-400 text-xs bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                          {change.vehiclePlate}
                        </span>
                        <span className="font-bold text-white text-xs">{change.vehicleModel}</span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Cliente: <strong>{change.clientName}</strong> · Realizada em {change.changeDate} ({change.currentKm.toLocaleString('pt-BR')} km)
                      </p>
                      <div className="flex items-center gap-3 text-xs pt-1">
                        <span className="text-amber-300 font-bold font-mono">
                          🎯 Próxima Troca: {change.nextChangeKm.toLocaleString('pt-BR')} km
                        </span>
                        <span className="text-slate-400 font-mono">
                          📅 {change.nextChangeDate}
                        </span>
                      </div>
                    </div>

                    {change.clientPhone && (
                      <a
                        href={`https://wa.me/55${change.clientPhone.replace(/\D/g, '')}?text=${encodeURIComponent(
                          `Olá ${change.clientName}! Aqui é do ${tenant.nomeFantasia || tenant.name}. Passando para lembrar que a próxima troca de óleo do seu ${change.vehicleModel} (${change.vehiclePlate}) está prevista para ${change.nextChangeKm.toLocaleString('pt-BR')} km ou até ${change.nextChangeDate}. Já conferiu a quilometragem do seu carro essa semana? Podemos agendar para você!`
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shrink-0"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Avisar WhatsApp</span>
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= MODAL: NOVA TROCA DE ÓLEO (CÁLCULO AUTOMÁTICO 8.000 / 10.000 KM) ================= */}
      {showNewChangeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Fuel className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-white text-base">Registrar Troca de Óleo</h3>
                  <p className="text-xs text-slate-400">Preencha os dados do veículo e da troca realizada</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowNewChangeModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOilChange} className="space-y-4 text-xs">
              
              {/* Dados do Cliente e Veículo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Nome do Cliente *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: João da Silva"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">WhatsApp / Telefone</label>
                  <input
                    type="text"
                    placeholder="(11) 99999-9999"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">Placa do Veículo *</label>
                  <input
                    type="text"
                    required
                    placeholder="ABC-1234"
                    value={vehiclePlate}
                    onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-amber-300 font-mono font-bold uppercase placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">Modelo do Carro *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Honda Civic 2.0"
                    value={vehicleModel}
                    onChange={(e) => setVehicleModel(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* ================= BLOCO PRINCIPAL: QUILOMETRAGEM AUTOMÁTICA ================= */}
              <div className="bg-gradient-to-br from-amber-950/40 via-slate-950 to-slate-900 border-2 border-amber-500/50 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-amber-300 flex items-center gap-1.5 uppercase tracking-wide">
                    <Fuel className="w-4 h-4 text-amber-400" /> Quilometragem & Intervalo de Troca
                  </span>
                  <span className="text-[10px] bg-amber-500/20 text-amber-400 font-bold px-2 py-0.5 rounded-full border border-amber-500/30">
                    Cálculo Automático
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Entrada do KM Atual */}
                  <div>
                    <label className="block text-slate-300 font-bold mb-1">KM Atual do Odômetro *</label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        placeholder="Ex: 85.000"
                        value={currentKmInput}
                        onChange={(e) => setCurrentKmInput(e.target.value)}
                        className="w-full bg-slate-950 border border-amber-500/50 rounded-xl px-3 py-2.5 text-base font-mono font-black text-white focus:outline-none focus:border-amber-400"
                      />
                      <span className="absolute right-3 top-2.5 text-slate-400 font-bold">KM</span>
                    </div>
                  </div>

                  {/* Seletor do Intervalo: 8.000 km ou 10.000 km */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-slate-300 font-bold">Intervalo de Troca *</label>
                      <span className="text-[10px] text-amber-400 font-medium">Soma automática ao KM</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedIntervalKm(8000)}
                        className={`py-2 px-3 rounded-xl font-bold text-xs transition cursor-pointer border flex flex-col items-center justify-center text-center ${
                          selectedIntervalKm === 8000
                            ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                            : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-600'
                        }`}
                      >
                        <span className="font-black text-sm">8.000 km</span>
                        <span className="text-[10px] font-medium opacity-90 mt-0.5">
                          {currentKmNumber > 0 ? `→ ${(currentKmNumber + 8000).toLocaleString('pt-BR')} km` : 'Uso severo / Mineral'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedIntervalKm(10000)}
                        className={`py-2 px-3 rounded-xl font-bold text-xs transition cursor-pointer border flex flex-col items-center justify-center text-center ${
                          selectedIntervalKm === 10000
                            ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                            : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-600'
                        }`}
                      >
                        <span className="font-black text-sm">10.000 km</span>
                        <span className="text-[10px] font-medium opacity-90 mt-0.5">
                          {currentKmNumber > 0 ? `→ ${(currentKmNumber + 10000).toLocaleString('pt-BR')} km` : 'Sintético / Padrão'}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Resultado Automático da Próxima Troca */}
                <div className="bg-slate-950/90 border border-amber-500/40 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-center sm:text-left">
                  <div>
                    <div className="flex items-center gap-1.5 justify-center sm:justify-start">
                      <span className="text-[10px] text-slate-400 uppercase font-bold">🎯 Próxima Troca Programada:</span>
                      <span className="text-[9px] bg-emerald-500/20 text-emerald-400 font-bold px-1.5 py-0.5 rounded border border-emerald-500/30">
                        Cálculo Automático (+{selectedIntervalKm.toLocaleString('pt-BR')} km)
                      </span>
                    </div>
                    <span className="text-2xl font-mono font-black text-amber-300">
                      {calculatedNextKm.toLocaleString('pt-BR')} KM
                    </span>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {currentKmNumber > 0 ? (
                        <>Odômetro atual: <strong>{currentKmNumber.toLocaleString('pt-BR')} km</strong> + Intervalo: <strong>{selectedIntervalKm.toLocaleString('pt-BR')} km</strong></>
                      ) : (
                        'Informe a quilometragem atual do odômetro'
                      )}
                    </p>
                  </div>
                  <div className="text-center sm:text-right">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">📅 Ou Limite por Tempo:</span>
                    <span className="text-sm font-mono font-bold text-slate-200">
                      {calculatedNextDate} (6 meses)
                    </span>
                  </div>
                </div>
              </div>

              {/* Seleção de Produtos do Estoque */}
              <div className="space-y-3 pt-1">
                <span className="font-bold text-slate-300 block">Itens Utilizados (Baixa Automática no Estoque)</span>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-slate-400 mb-1">Óleo de Motor</label>
                    <select
                      value={selectedOilProduct}
                      onChange={(e) => {
                        const newId = e.target.value;
                        setSelectedOilProduct(newId);
                        const prod = products.find(p => p.id === newId);
                        if (prod) {
                          const desc = `${prod.name} ${prod.viscosity || ''} ${prod.description || ''}`.toLowerCase();
                          if (desc.includes('mineral') || desc.includes('15w40') || desc.includes('20w50')) {
                            setSelectedIntervalKm(8000);
                          } else {
                            setSelectedIntervalKm(10000);
                          }
                        }
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                    >
                      <option value="">Nenhum óleo selecionado</option>
                      {products.filter(p => p.category === 'oleo_motor').map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.viscosity || ''}) - R$ {p.salePrice.toFixed(2)}/L [Estoque: {p.stock}L]
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Quantidade (Litros)</label>
                    <input
                      type="number"
                      step="0.5"
                      min="1"
                      max="20"
                      value={oilLiters}
                      onChange={(e) => setOilLiters(parseFloat(e.target.value) || 1)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                {/* Filtros e Peças Adicionais */}
                <div>
                  <label className="block text-slate-400 mb-1.5">Filtros & Peças Trocadas:</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
                    {products.filter(p => p.category !== 'oleo_motor').map(prod => {
                      const isSelected = selectedFilters.includes(prod.id);
                      return (
                        <button
                          key={prod.id}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setSelectedFilters(prev => prev.filter(id => id !== prod.id));
                            } else {
                              setSelectedFilters(prev => [...prev, prod.id]);
                            }
                          }}
                          className={`p-2 rounded-xl border text-left flex items-center justify-between transition cursor-pointer ${
                            isSelected 
                              ? 'bg-amber-500/15 border-amber-500/50 text-white' 
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          <div className="truncate pr-2">
                            <span className="block font-bold text-xs truncate">{prod.name}</span>
                            <span className="text-[10px] text-slate-500">Estoque: {prod.stock} un</span>
                          </div>
                          <span className="font-mono font-bold text-amber-300 shrink-0">
                            +R$ {prod.salePrice.toFixed(2)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Mão de Obra e Pagamento */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div>
                    <label className="block text-slate-400 mb-1">Valor Mão de Obra (R$)</label>
                    <input
                      type="number"
                      step="5"
                      value={laborPrice}
                      onChange={(e) => setLaborPrice(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Forma de Pagamento</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                    >
                      <option value="PIX">PIX</option>
                      <option value="Cartão de Débito">Cartão de Débito</option>
                      <option value="Cartão de Crédito">Cartão de Crédito</option>
                      <option value="Dinheiro">Dinheiro</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Técnico Responsável</label>
                    <input
                      type="text"
                      value={technicianName}
                      onChange={(e) => setTechnicianName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* Totalizador & Botão de Salvar */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">VALOR TOTAL DA TROCA</span>
                  <span className="text-2xl font-black text-emerald-400 font-mono">
                    R$ {totalCalculatedPrice.toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowNewChangeModal(false)}
                    className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition cursor-pointer"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    className="py-2.5 px-5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl shadow-lg shadow-amber-500/20 flex items-center gap-2 transition cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>Concluir Troca & Gerar Etiqueta</span>
                  </button>
                </div>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: NOVO PRODUTO NO ESTOQUE (CÁLCULO AUTOMÁTICO 30%) ================= */}
      {showNewProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Package className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-white text-base">Cadastrar Produto no Estoque</h3>
                  <p className="text-xs text-slate-400">Cálculo automático de 30% sobre o valor de compra</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowNewProductModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="space-y-4 text-xs">
              
              <div>
                <label className="block text-slate-300 font-bold mb-1">Nome do Produto *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Óleo 5W30 Sintético Shell Helix"
                  value={prodName}
                  onChange={(e) => setProdName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Categoria *</label>
                  <select
                    value={prodCategory}
                    onChange={(e) => setProdCategory(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="oleo_motor">🛢️ Óleo de Motor</option>
                    <option value="filtro_oleo">🔘 Filtro de Óleo</option>
                    <option value="filtro_ar">💨 Filtro de Ar</option>
                    <option value="filtro_combustivel">⛽ Filtro de Combustível</option>
                    <option value="filtro_cabine">❄️ Filtro de Cabine</option>
                    <option value="correia_dentada">⚙️ Correia Dentada</option>
                    <option value="fluido_freio">🛑 Fluído de Freio</option>
                    <option value="aditivo_radiador">🧪 Aditivo de Radiador</option>
                    <option value="outros">📦 Outros</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">Marca / Fabricante</label>
                  <input
                    type="text"
                    placeholder="Ex: Mobil, Tecfil, Gates"
                    value={prodBrand}
                    onChange={(e) => setProdBrand(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {prodCategory === 'oleo_motor' && (
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Viscosidade do Óleo</label>
                  <input
                    type="text"
                    placeholder="Ex: 5W30, 10W40, 15W40, 0W20"
                    value={prodViscosity}
                    onChange={(e) => setProdViscosity(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Estoque Inicial</label>
                  <input
                    type="number"
                    min="0"
                    value={prodStock}
                    onChange={(e) => setProdStock(parseInt(e.target.value, 10) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">Estoque Mínimo (Alerta)</label>
                  <input
                    type="number"
                    min="1"
                    value={prodMinStock}
                    onChange={(e) => setProdMinStock(parseInt(e.target.value, 10) || 1)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* ================= BLOCO: CÁLCULO AUTOMÁTICO DE 30% DE MARGEM ================= */}
              <div className="bg-slate-950 border-2 border-emerald-500/40 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                    <DollarSign className="w-4 h-4" /> Formação de Preço (Cálculo Automático)
                  </span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-bold border border-emerald-500/30">
                    +30% Margem Automática
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-bold mb-1">Valor de Compra (Custo) *</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-slate-400 font-bold">R$</span>
                      <input
                        type="text"
                        required
                        placeholder="30.00"
                        value={prodPurchasePriceInput}
                        onChange={(e) => setProdPurchasePriceInput(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-white font-mono font-bold focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-bold mb-1">Margem de Lucro (%)</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={prodMarkupInput}
                        onChange={(e) => setProdMarkupInput(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-3 pr-8 py-2 text-emerald-400 font-mono font-bold focus:outline-none focus:border-emerald-500"
                      />
                      <span className="absolute right-3 top-2 text-slate-400 font-bold">%</span>
                    </div>
                  </div>
                </div>

                {/* Feedback do Preço de Venda Calculado */}
                <div className="bg-slate-900 border border-emerald-500/30 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-bold uppercase">Preço de Venda Sugerido:</span>
                    <span className="text-xl font-mono font-black text-emerald-400">
                      R$ {calculatedSalePrice.toFixed(2)}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block font-bold uppercase">Lucro por Unidade:</span>
                    <span className="text-xs font-mono font-bold text-amber-300">
                      +R$ {calculatedProfitAmount.toFixed(2)} ({markupVal}%)
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewProductModal(false)}
                  className="py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="py-2 px-5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl transition cursor-pointer shadow-md"
                >
                  Salvar no Estoque
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: ETIQUETA ADESIVA DE PARA-BRISA (IMPRESSÃO) ================= */}
      {selectedChangeForSticker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-white text-sm">Etiqueta Adesiva de Para-brisa</h3>
              </div>

              <button
                type="button"
                onClick={() => setSelectedChangeForSticker(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Visual Realista do Adesivo Automotivo de Troca de Óleo */}
            <div id="etiqueta-impressao" className="bg-white text-slate-950 p-5 rounded-2xl border-4 border-amber-400 shadow-xl space-y-3 font-sans select-all">
              
              {/* Topo do Adesivo com Logo / Nome do Lava Jato */}
              <div className="text-center border-b-2 border-dashed border-slate-300 pb-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 block">
                  CONTROLE DE LUBRIFICAÇÃO & TROCA DE ÓLEO
                </span>
                <h4 className="text-base font-black text-slate-900 uppercase">
                  {tenant.nomeFantasia || tenant.name}
                </h4>
                {tenant.contactPhone && (
                  <p className="text-[10px] font-semibold text-slate-600">📞 {tenant.contactPhone}</p>
                )}
              </div>

              {/* Dados do Carro */}
              <div className="flex items-center justify-between text-xs font-bold pt-1">
                <span>PLACA: <strong className="font-mono text-sm bg-slate-100 px-1.5 py-0.5 rounded border border-slate-300">{selectedChangeForSticker.vehiclePlate}</strong></span>
                <span className="truncate max-w-[150px]">{selectedChangeForSticker.vehicleModel}</span>
              </div>

              {/* Bloco de KM Atual vs Próximo KM */}
              <div className="grid grid-cols-2 gap-2 text-center py-1">
                <div className="bg-slate-100 p-2 rounded-lg border border-slate-200">
                  <span className="text-[9px] font-bold text-slate-500 block uppercase">KM NA TROCA</span>
                  <span className="text-xs font-mono font-bold text-slate-800">
                    {selectedChangeForSticker.currentKm.toLocaleString('pt-BR')} km
                  </span>
                  <span className="text-[9px] text-slate-500 block">{selectedChangeForSticker.changeDate}</span>
                </div>

                <div className="bg-amber-100 p-2 rounded-lg border-2 border-amber-400">
                  <span className="text-[9px] font-black text-amber-800 block uppercase">PRÓXIMA TROCA</span>
                  <span className="text-sm font-mono font-black text-slate-950">
                    {selectedChangeForSticker.nextChangeKm.toLocaleString('pt-BR')} km
                  </span>
                  <span className="text-[9px] font-bold text-amber-900 block">{selectedChangeForSticker.nextChangeDate}</span>
                </div>
              </div>

              {/* Óleo e Filtros Utilizados */}
              <div className="text-[10px] space-y-0.5 border-t border-slate-200 pt-2 text-slate-700">
                <div className="flex justify-between">
                  <span>Óleo Utilizado:</span>
                  <strong className="text-slate-900">{selectedChangeForSticker.oilType || 'Conforme Manual'}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Intervalo Aplicado:</span>
                  <strong className="text-slate-900">+{selectedChangeForSticker.intervalKm.toLocaleString('pt-BR')} km (ou 6 meses)</strong>
                </div>
                {selectedChangeForSticker.responsibleTechnician && (
                  <div className="flex justify-between">
                    <span>Técnico:</span>
                    <span>{selectedChangeForSticker.responsibleTechnician}</span>
                  </div>
                )}
              </div>

              <div className="text-center pt-1 border-t border-dashed border-slate-200">
                <span className="text-[9px] text-slate-500 block">
                  Colar no canto superior esquerdo do para-brisa interno.
                </span>
              </div>
            </div>

            {/* Botões de Ação */}
            <div className="flex items-center justify-between gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  window.print();
                }}
                className="flex-1 py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-md"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir Etiqueta</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedChangeForSticker(null)}
                className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Fechar
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
