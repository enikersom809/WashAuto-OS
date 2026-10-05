import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Users, 
  Package, 
  Percent, 
  Key, 
  Image as ImageIcon, 
  FileText, 
  MapPin, 
  Phone, 
  Mail, 
  CheckCircle, 
  Plus, 
  Trash2, 
  Save, 
  Lock, 
  RefreshCw, 
  Upload, 
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
  DollarSign,
  Droplet,
  ShoppingBag,
  Search,
  Loader2,
  QrCode,
  Car,
  Printer,
  Receipt
} from 'lucide-react';
import { Tenant } from '../types';
import { TenantQRCode } from './TenantQRCode';
import { saveTenantToFirestore } from '../lib/firebaseService';

interface StaffMember {
  id: string;
  name: string;
  initials: string;
  role: string;
  defaultCommission: number; // %
  completedWashes: number;
  accumulatedCommission: number; // R$
  phone?: string;
  email?: string;
}

interface ProductItem {
  id: string;
  name: string;
  category: 'insumo' | 'venda';
  stock: number;
  minStock: number;
  unitPrice?: number;
  unit: string;
}

interface TenantConfigSettingsProps {
  tenant: Tenant;
  staffList: StaffMember[];
  onUpdateStaffList: (newStaffList: StaffMember[]) => void;
  products: ProductItem[];
  onUpdateProducts: (newProducts: ProductItem[]) => void;
  onUpdateTenantDetails: (updatedTenant: Tenant) => void;
}

export const TenantConfigSettings: React.FC<TenantConfigSettingsProps> = ({
  tenant,
  staffList,
  onUpdateStaffList,
  products,
  onUpdateProducts,
  onUpdateTenantDetails
}) => {
  const [subTab, setSubTab] = useState<'empresa' | 'qrcode' | 'funcionarios' | 'produtos' | 'comissoes' | 'senha' | 'logo'>('empresa');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Form states for Company Data
  const [name, setName] = useState(tenant.name || '');
  const [nomeFantasia, setNomeFantasia] = useState(tenant.nomeFantasia || tenant.name || '');
  const [razaoSocial, setRazaoSocial] = useState(tenant.razaoSocial || '');
  const [cnpj, setCnpj] = useState(tenant.cnpj || '');
  const [inscricaoEstadual, setInscricaoEstadual] = useState(tenant.inscricaoEstadual || '');
  const [contactEmail, setContactEmail] = useState(tenant.contactEmail || '');
  const [contactPhone, setContactPhone] = useState(tenant.contactPhone || '');
  const [ownerName, setOwnerName] = useState(tenant.ownerName || '');

  // Address
  const [cep, setCep] = useState(tenant.address?.cep || '');
  const [street, setStreet] = useState(tenant.address?.street || '');
  const [number, setNumber] = useState(tenant.address?.number || '');
  const [complement, setComplement] = useState(tenant.address?.complement || '');
  const [neighborhood, setNeighborhood] = useState(tenant.address?.neighborhood || '');
  const [city, setCity] = useState(tenant.address?.city || '');
  const [stateUf, setStateUf] = useState(tenant.address?.state || 'SP');

  // Search states
  const [isSearchingCnpj, setIsSearchingCnpj] = useState(false);
  const [isSearchingCep, setIsSearchingCep] = useState(false);

  // Logo URL & Image Upload
  const [logoUrl, setLogoUrl] = useState(tenant.logoUrl || '');
  const [isProcessingLogo, setIsProcessingLogo] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null);

  // File Upload with automatic Canvas compression
  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setLogoUploadError('Por favor, selecione um arquivo de imagem válido (PNG, JPG, SVG, WebP).');
      return;
    }

    setIsProcessingLogo(true);
    setLogoUploadError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (!result) {
        setIsProcessingLogo(false);
        return;
      }

      if (file.type.includes('svg')) {
        setLogoUrl(result);
        setIsProcessingLogo(false);
        showNotification('✨ Logotipo SVG carregado com sucesso!');
        return;
      }

      const img = new Image();
      img.onload = () => {
        const MAX_WIDTH = 450;
        const MAX_HEIGHT = 450;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.round(width);
        canvas.height = Math.round(height);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const compressed = canvas.toDataURL('image/png', 0.9);
          setLogoUrl(compressed);
          showNotification('✨ Logotipo otimizado e carregado com sucesso!');
        } else {
          setLogoUrl(result);
        }
        setIsProcessingLogo(false);
      };
      img.onerror = () => {
        setIsProcessingLogo(false);
        setLogoUploadError('Falha ao processar o arquivo de imagem.');
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  };

  // Password Management
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [showTempPwd, setShowTempPwd] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);

  // New Staff Member Form
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffRole, setNewStaffRole] = useState('Lavador & Polidor');
  const [newStaffCommission, setNewStaffCommission] = useState(15);
  const [newStaffPhone, setNewStaffPhone] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');

  // New Product Form
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProdName, setNewProdName] = useState('');
  const [newProdCategory, setNewProdCategory] = useState<'insumo' | 'venda'>('insumo');
  const [newProdStock, setNewProdStock] = useState(10);
  const [newProdMinStock, setNewProdMinStock] = useState(3);
  const [newProdPrice, setNewProdPrice] = useState(25);
  const [newProdUnit, setNewProdUnit] = useState('unidades');

  const showNotification = (msg: string) => {
    setSaveSuccessMsg(msg);
    setTimeout(() => setSaveSuccessMsg(null), 3500);
  };

  // Auto CNPJ Lookup
  const handleCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 14);
    let formatted = raw;
    if (raw.length > 12) {
      formatted = raw.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{1,2})$/, '$1.$2.$3/$4-$5');
    } else if (raw.length > 8) {
      formatted = raw.replace(/^(\d{2})(\d{3})(\d{3})(\d{1,4})$/, '$1.$2.$3/$4');
    } else if (raw.length > 5) {
      formatted = raw.replace(/^(\d{2})(\d{3})(\d{1,3})$/, '$1.$2.$3');
    } else if (raw.length > 2) {
      formatted = raw.replace(/^(\d{2})(\d{1,3})$/, '$1.$2');
    }
    setCnpj(formatted);

    if (raw.length === 14) {
      fetchCnpjData(raw);
    }
  };

  const fetchCnpjData = async (rawDigits?: string) => {
    const clean = (rawDigits || cnpj).replace(/\D/g, '');
    if (clean.length !== 14) return;

    setIsSearchingCnpj(true);
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`);
      if (response.ok) {
        const data = await response.json();
        if (data.razao_social) setRazaoSocial(data.razao_social);
        if (data.nome_fantasia || data.razao_social) {
          setNomeFantasia(data.nome_fantasia || data.razao_social);
          setName(data.nome_fantasia || data.razao_social);
        }
        if (data.email) setContactEmail(data.email.toLowerCase());
        if (data.ddd_telefone_1) setContactPhone(`(${data.ddd_telefone_1.slice(0,2)}) ${data.ddd_telefone_1.slice(2)}`);
        if (data.qsa?.[0]?.nome_socio) setOwnerName(data.qsa[0].nome_socio);

        if (data.cep) {
          const cleanCep = data.cep.replace(/\D/g, '');
          setCep(cleanCep.length === 8 ? `${cleanCep.slice(0, 5)}-${cleanCep.slice(5)}` : data.cep);
        }
        if (data.logradouro) setStreet(data.logradouro);
        if (data.numero) setNumber(data.numero);
        if (data.complemento) setComplement(data.complemento);
        if (data.bairro) setNeighborhood(data.bairro);
        if (data.municipio) setCity(data.municipio);
        if (data.uf) setStateUf(data.uf);

        showNotification('✨ Dados da empresa preenchidos via Receita Federal!');
      }
    } catch (err) {
      console.warn('CNPJ auto lookup failed:', err);
    } finally {
      setIsSearchingCnpj(false);
    }
  };

  // Auto CEP Lookup
  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 8);
    let formatted = raw;
    if (raw.length > 5) {
      formatted = `${raw.slice(0, 5)}-${raw.slice(5)}`;
    }
    setCep(formatted);

    if (raw.length === 8) {
      fetchCepData(raw);
    }
  };

  const fetchCepData = async (rawDigits?: string) => {
    const clean = (rawDigits || cep).replace(/\D/g, '');
    if (clean.length !== 8) return;

    setIsSearchingCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      if (response.ok) {
        const data = await response.json();
        if (!data.erro) {
          if (data.logradouro) setStreet(data.logradouro);
          if (data.bairro) setNeighborhood(data.bairro);
          if (data.localidade) setCity(data.localidade);
          if (data.uf) setStateUf(data.uf);
          showNotification('📍 Endereço localizado e preenchido!');
        }
      }
    } catch (err) {
      console.warn('CEP auto lookup failed:', err);
    } finally {
      setIsSearchingCep(false);
    }
  };

  // Save Full Company Data
  const handleSaveCompanyData = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: Tenant = {
      ...tenant,
      name: name.trim() || tenant.name,
      nomeFantasia: nomeFantasia.trim() || name.trim(),
      razaoSocial: razaoSocial.trim(),
      cnpj: cnpj.trim(),
      inscricaoEstadual: inscricaoEstadual.trim(),
      contactEmail: contactEmail.trim(),
      contactPhone: contactPhone.trim(),
      ownerName: ownerName.trim(),
      address: {
        cep: cep.trim(),
        street: street.trim(),
        number: number.trim(),
        complement: complement.trim(),
        neighborhood: neighborhood.trim(),
        city: city.trim(),
        state: stateUf.trim()
      },
      logoUrl: logoUrl.trim() || undefined
    };

    onUpdateTenantDetails(updated);
    showNotification('✅ Dados cadastrais da empresa salvos com sucesso!');
  };

  // Save Logo
  const handleSaveLogo = async (e: React.FormEvent) => {
    e.preventDefault();
    const updated: Tenant = {
      ...tenant,
      logoUrl: logoUrl.trim() || undefined
    };
    onUpdateTenantDetails(updated);
    try {
      await saveTenantToFirestore(updated);
    } catch (err) {
      console.warn('Erro ao sincronizar logo no Firestore:', err);
    }
    showNotification('✅ Logotipo salvo e sincronizado! Ele já aparece no cabeçalho e nos comprovantes.');
  };

  // Save Password Change
  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError(null);

    const savedAdminPassword = (typeof localStorage !== 'undefined' && localStorage.getItem('saas_admin_password')) || 'admin124050';

    if (newPassword.length < 6) {
      setPwdError('A nova senha deve possuir pelo menos 6 caracteres.');
      return;
    }
    if (newPassword === savedAdminPassword || newPassword === 'admin124050') {
      setPwdError('Por segurança, a senha da empresa não pode ser igual à senha do Super Admin.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdError('A confirmação de senha não confere com a nova senha.');
      return;
    }

    // Save password persistently for this tenant
    localStorage.setItem(`saas_tenant_custom_password_${tenant.id}`, newPassword);
    
    // Update tenant memory
    const updated: Tenant = {
      ...tenant,
      tempPassword: newPassword
    };
    onUpdateTenantDetails(updated);

    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    showNotification('🔒 Senha de acesso da empresa alterada com sucesso!');
  };

  // Add Staff Member
  const handleAddStaffMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName.trim()) return;

    const initials = newStaffName
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'LV';

    const newMember: StaffMember = {
      id: `st-${Date.now()}`,
      name: newStaffName.trim(),
      initials,
      role: newStaffRole.trim() || 'Lavador',
      defaultCommission: Number(newStaffCommission) || 15,
      completedWashes: 0,
      accumulatedCommission: 0,
      phone: newStaffPhone.trim() || undefined,
      email: newStaffEmail.trim() || undefined
    };

    const updatedList = [...staffList, newMember];
    onUpdateStaffList(updatedList);
    setShowAddStaff(false);
    setNewStaffName('');
    setNewStaffPhone('');
    setNewStaffEmail('');
    showNotification(`👤 Colaborador ${newMember.name} adicionado à equipe com ${newMember.defaultCommission}% de comissão!`);
  };

  // Delete Staff Member
  const handleDeleteStaffMember = (staffId: string) => {
    const staff = staffList.find(s => s.id === staffId);
    if (!staff) return;
    const updatedList = staffList.filter(s => s.id !== staffId);
    onUpdateStaffList(updatedList);
    showNotification(`🗑️ Colaborador ${staff.name} foi removido da equipe.`);
  };

  // Update Individual Commission Rate
  const handleUpdateCommissionRate = (staffId: string, newRate: number) => {
    const updatedList = staffList.map(s => {
      if (s.id === staffId) {
        return { ...s, defaultCommission: newRate };
      }
      return s;
    });
    onUpdateStaffList(updatedList);
    showNotification('Taxa de comissão atualizada!');
  };

  // Add Product
  const handleAddProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName.trim()) return;

    const newProduct: ProductItem = {
      id: `p-${Date.now()}`,
      name: newProdName.trim(),
      category: newProdCategory,
      stock: Number(newProdStock),
      minStock: Number(newProdMinStock) || 3,
      unitPrice: newProdCategory === 'venda' ? Number(newProdPrice) : undefined,
      unit: newProdUnit.trim() || 'unidades'
    };

    const updatedProducts = [...products, newProduct];
    onUpdateProducts(updatedProducts);
    setShowAddProduct(false);
    setNewProdName('');
    showNotification(`📦 Item ${newProduct.name} cadastrado no estoque (${newProduct.category === 'insumo' ? 'Uso Interno' : 'Venda'})!`);
  };

  // Delete Product
  const handleDeleteProduct = (productId: string) => {
    const prod = products.find(p => p.id === productId);
    if (!prod) return;
    const updatedProducts = products.filter(p => p.id !== productId);
    onUpdateProducts(updatedProducts);
    showNotification(`🗑️ Item ${prod.name} foi removido do estoque.`);
  };

  return (
    <div className="space-y-6">

      {/* Header da Seção de Configurações */}
      <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
              Configurações Operacionais da Empresa
            </span>
            <span className="text-xs text-slate-400 font-mono">ID: {tenant.id}</span>
          </div>
          <h2 className="text-lg font-bold text-slate-100 mt-1 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-400" />
            Painel Administrativo de {tenant.name}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Gerencie os dados cadastrais completos, equipe de lavadores, controle de estoque de produtos, regras de comissões, logotipo e senhas.
          </p>
        </div>

        {saveSuccessMsg && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 animate-bounce">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            {saveSuccessMsg}
          </div>
        )}
      </div>

      {/* Navegação Sub-Abas de Configurações */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <button
          type="button"
          onClick={() => setSubTab('empresa')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition whitespace-nowrap ${
            subTab === 'empresa'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
              : 'bg-[#0f172a] text-slate-400 hover:text-slate-200 border border-[#1e293b]'
          }`}
        >
          <Building2 className="w-4 h-4" /> 1. Cadastro da Empresa
        </button>

        <button
          type="button"
          onClick={() => setSubTab('qrcode')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition whitespace-nowrap ${
            subTab === 'qrcode'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
              : 'bg-[#0f172a] text-slate-400 hover:text-slate-200 border border-[#1e293b]'
          }`}
        >
          <QrCode className="w-4 h-4 text-emerald-400" /> 2. Totem & QR Code PWA
        </button>

        <button
          type="button"
          onClick={() => setSubTab('funcionarios')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition whitespace-nowrap ${
            subTab === 'funcionarios'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
              : 'bg-[#0f172a] text-slate-400 hover:text-slate-200 border border-[#1e293b]'
          }`}
        >
          <Users className="w-4 h-4" /> 3. Funcionários ({staffList.length})
        </button>

        <button
          type="button"
          onClick={() => setSubTab('produtos')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition whitespace-nowrap ${
            subTab === 'produtos'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
              : 'bg-[#0f172a] text-slate-400 hover:text-slate-200 border border-[#1e293b]'
          }`}
        >
          <Package className="w-4 h-4" /> 3. Produtos & Estoque ({products.length})
        </button>

        <button
          type="button"
          onClick={() => setSubTab('comissoes')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition whitespace-nowrap ${
            subTab === 'comissoes'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
              : 'bg-[#0f172a] text-slate-400 hover:text-slate-200 border border-[#1e293b]'
          }`}
        >
          <Percent className="w-4 h-4" /> 4. Cadastro de Comissões
        </button>

        <button
          type="button"
          onClick={() => setSubTab('logo')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition whitespace-nowrap ${
            subTab === 'logo'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
              : 'bg-[#0f172a] text-slate-400 hover:text-slate-200 border border-[#1e293b]'
          }`}
        >
          <ImageIcon className="w-4 h-4" /> 5. Logo da Empresa
        </button>

        <button
          type="button"
          onClick={() => setSubTab('senha')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition whitespace-nowrap ${
            subTab === 'senha'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
              : 'bg-[#0f172a] text-slate-400 hover:text-slate-200 border border-[#1e293b]'
          }`}
        >
          <Key className="w-4 h-4" /> 6. Troca de Senha
        </button>
      </div>

      {/* ================= ABA 1: CADASTRO TOTAL DA EMPRESA ================= */}
      {subTab === 'empresa' && (
        <form onSubmit={handleSaveCompanyData} className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-6 space-y-6">
          <div className="border-b border-[#1e293b] pb-4 flex justify-between items-center">
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-400" />
                Dados Cadastrais, Fiscais e Contato
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Informações cadastrais completas da empresa (Razão Social, Nome Fantasia, CNPJ, Inscrição Estadual, Endereço e Contato).
              </p>
            </div>

            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition shadow-lg shadow-blue-600/25"
            >
              <Save className="w-4 h-4" /> Salvar Cadastro
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-300 font-bold mb-1">Razão Social *</label>
              <input
                type="text"
                required
                value={razaoSocial}
                onChange={(e) => setRazaoSocial(e.target.value)}
                placeholder="Ex: Auto Clean Estética Automotiva LTDA"
                className="w-full bg-[#020617] border border-[#1e293b] rounded-xl p-3 text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1">Nome Fantasia *</label>
              <input
                type="text"
                required
                value={nomeFantasia}
                onChange={(e) => setNomeFantasia(e.target.value)}
                placeholder="Ex: Auto Clean Spa Car"
                className="w-full bg-[#020617] border border-[#1e293b] rounded-xl p-3 text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1">CNPJ (Busca Automática)</label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={cnpj}
                  onChange={handleCnpjChange}
                  placeholder="00.000.000/0001-00"
                  className="w-full bg-[#020617] border border-[#1e293b] rounded-xl p-3 pr-10 text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => fetchCnpjData()}
                  disabled={isSearchingCnpj}
                  className="absolute right-3 text-slate-400 hover:text-blue-400 p-1"
                  title="Consultar CNPJ na Receita"
                >
                  {isSearchingCnpj ? (
                    <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1">Inscrição Estadual (IE)</label>
              <input
                type="text"
                value={inscricaoEstadual}
                onChange={(e) => setInscricaoEstadual(e.target.value)}
                placeholder="Ex: 123.456.789.000 ou Isento"
                className="w-full bg-[#020617] border border-[#1e293b] rounded-xl p-3 text-slate-200 font-mono focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1">Responsável / Proprietário *</label>
              <input
                type="text"
                required
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="Nome do Proprietário ou Gerente"
                className="w-full bg-[#020617] border border-[#1e293b] rounded-xl p-3 text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1">E-mail de Contato Principal *</label>
              <input
                type="email"
                required
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="contato@empresa.com"
                className="w-full bg-[#020617] border border-[#1e293b] rounded-xl p-3 text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1">WhatsApp / Telefone de Contato</label>
              <input
                type="text"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="(11) 98765-4321"
                className="w-full bg-[#020617] border border-[#1e293b] rounded-xl p-3 text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1">Subdomínio do Tenant (Sistema)</label>
              <input
                type="text"
                readOnly
                value={tenant.domain}
                className="w-full bg-[#020617]/50 border border-[#1e293b] rounded-xl p-3 text-slate-400 font-mono focus:outline-none cursor-not-allowed"
              />
            </div>
          </div>

          {/* Seção de Endereço Físico */}
          <div className="pt-4 border-t border-[#1e293b] space-y-4">
            <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-400" />
              Endereço Físico do Lava-Jato / Estética
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">CEP (Busca Automática)</label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={cep}
                    onChange={handleCepChange}
                    placeholder="01001-000"
                    className="w-full bg-[#020617] border border-[#1e293b] rounded-xl p-3 pr-8 text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                  />
                  {isSearchingCep && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400 absolute right-3" />
                  )}
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-slate-300 font-bold mb-1">Logradouro / Rua</label>
                <input
                  type="text"
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  placeholder="Av. Principal das Acácias"
                  className="w-full bg-[#020617] border border-[#1e293b] rounded-xl p-3 text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Número</label>
                <input
                  type="text"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  placeholder="1234"
                  className="w-full bg-[#020617] border border-[#1e293b] rounded-xl p-3 text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Complemento</label>
                <input
                  type="text"
                  value={complement}
                  onChange={(e) => setComplement(e.target.value)}
                  placeholder="Galpão 2 / Box 04"
                  className="w-full bg-[#020617] border border-[#1e293b] rounded-xl p-3 text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Bairro</label>
                <input
                  type="text"
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                  placeholder="Centro"
                  className="w-full bg-[#020617] border border-[#1e293b] rounded-xl p-3 text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Cidade</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="São Paulo"
                  className="w-full bg-[#020617] border border-[#1e293b] rounded-xl p-3 text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Estado (UF)</label>
                <input
                  type="text"
                  maxLength={2}
                  value={stateUf}
                  onChange={(e) => setStateUf(e.target.value.toUpperCase())}
                  placeholder="SP"
                  className="w-full bg-[#020617] border border-[#1e293b] rounded-xl p-3 text-slate-200 font-mono uppercase focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        </form>
      )}

      {/* ================= ABA TOTEM & QR CODE DINÂMICO PWA ================= */}
      {subTab === 'qrcode' && (
        <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-6 space-y-6">
          <TenantQRCode
            empresa={{
              id: tenant.id,
              nome: tenant.name,
              slug: tenant.code.toLowerCase(),
              logoUrl: tenant.logoUrl
            }}
          />
        </div>
      )}

      {/* ================= ABA 2: CADASTRO DE FUNCIONÁRIOS ================= */}
      {subTab === 'funcionarios' && (
        <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-6 space-y-6">
          <div className="border-b border-[#1e293b] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-400" />
                Equipe Operacional & Cadastro de Funcionários
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Cadastre lavadores, polidores, finalizadores e gerentes de pátio para atribuição de serviços e comissões.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowAddStaff(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition shadow-lg shadow-blue-600/25"
            >
              <Plus className="w-4 h-4" /> Novo Funcionário
            </button>
          </div>

          {/* Lista de Colaboradores */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {staffList.map(staff => (
              <div key={staff.id} className="bg-[#020617] border border-[#1e293b] rounded-xl p-4 flex flex-col justify-between space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs">
                      {staff.initials}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-100 text-sm">{staff.name}</h4>
                      <p className="text-[11px] text-slate-400">{staff.role}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteStaffMember(staff.id)}
                    className="text-slate-500 hover:text-rose-400 p-1.5 rounded transition"
                    title="Remover funcionário"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-[#1e293b] text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Taxa de Comissão:</span>
                    <strong className="text-emerald-400 font-mono font-bold">{staff.defaultCommission}% por lavagem</strong>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Lavagens Concluídas:</span>
                    <strong className="text-slate-200">{staff.completedWashes} veículos</strong>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Comissão Acumulada:</span>
                    <strong className="text-emerald-400 font-mono">R$ {staff.accumulatedCommission.toFixed(2)}</strong>
                  </div>
                  {staff.phone && (
                    <div className="flex justify-between text-slate-500 text-[11px]">
                      <span>WhatsApp:</span>
                      <span>{staff.phone}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Modal Novo Funcionário */}
          {showAddStaff && (
            <div className="fixed inset-0 z-50 bg-[#020617]/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl relative">
                <div className="flex items-center gap-2 border-b border-[#1e293b] pb-3">
                  <Users className="w-5 h-5 text-blue-400" />
                  <h3 className="text-base font-bold text-slate-100">Cadastrar Novo Funcionário</h3>
                </div>

                <form onSubmit={handleAddStaffMember} className="space-y-3 text-xs">
                  <div>
                    <label className="block text-slate-300 font-bold mb-1">Nome Completo *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Rodrigo Andrade"
                      value={newStaffName}
                      onChange={(e) => setNewStaffName(e.target.value)}
                      className="w-full bg-[#020617] border border-[#1e293b] rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-bold mb-1">Função / Cargo</label>
                    <input
                      type="text"
                      placeholder="Ex: Lavador Master / Especialista em Cera"
                      value={newStaffRole}
                      onChange={(e) => setNewStaffRole(e.target.value)}
                      className="w-full bg-[#020617] border border-[#1e293b] rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 font-bold mb-1">% Comissão Padrão</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        required
                        value={newStaffCommission}
                        onChange={(e) => setNewStaffCommission(Number(e.target.value))}
                        className="w-full bg-[#020617] border border-[#1e293b] rounded-lg p-2.5 text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-bold mb-1">WhatsApp</label>
                      <input
                        type="text"
                        placeholder="(11) 98888-7777"
                        value={newStaffPhone}
                        onChange={(e) => setNewStaffPhone(e.target.value)}
                        className="w-full bg-[#020617] border border-[#1e293b] rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="pt-3 flex justify-end gap-2 border-t border-[#1e293b]">
                    <button
                      type="button"
                      onClick={() => setShowAddStaff(false)}
                      className="px-4 py-2 bg-[#020617] text-slate-300 rounded-lg font-medium border border-[#1e293b]"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold"
                    >
                      Salvar Funcionário
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= ABA 3: PRODUTOS ESTOQUE (USO INTERNO / VENDAS) ================= */}
      {subTab === 'produtos' && (
        <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-6 space-y-6">
          <div className="border-b border-[#1e293b] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-400" />
                Cadastro de Produtos & Estoque (Uso Interno e Vendas)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Controle detalhado de insumos de estética automotiva consumidos no pátio e cosméticos expostos para venda direta ao cliente.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowAddProduct(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition shadow-lg shadow-blue-600/25"
            >
              <Plus className="w-4 h-4" /> Cadastrar Produto / Insumo
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Lista Insumos de Uso Interno */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                <Droplet className="w-3.5 h-3.5" /> Produtos de Uso Interno (Insumos de Lavagem)
              </h4>

              <div className="space-y-2">
                {products.filter(p => p.category === 'insumo').map(prod => (
                  <div key={prod.id} className="bg-[#020617] border border-[#1e293b] rounded-xl p-3.5 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-200">{prod.name}</p>
                      <p className="text-[11px] text-slate-400">
                        Estoque Atual: <strong className="text-slate-100">{prod.stock} {prod.unit}</strong> · Mínimo: {prod.minStock}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleDeleteProduct(prod.id)}
                        className="text-slate-500 hover:text-rose-400 p-1.5 rounded transition"
                        title="Remover produto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Lista Produtos de Venda no Balcão */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <ShoppingBag className="w-3.5 h-3.5" /> Produtos de Venda no Balcão
              </h4>

              <div className="space-y-2">
                {products.filter(p => p.category === 'venda').map(prod => (
                  <div key={prod.id} className="bg-[#020617] border border-[#1e293b] rounded-xl p-3.5 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-200">{prod.name}</p>
                      <p className="text-[11px] text-slate-400">
                        Preço de Venda: <strong className="text-emerald-400">R$ {prod.unitPrice?.toFixed(2)}</strong> · Estoque: {prod.stock} {prod.unit}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleDeleteProduct(prod.id)}
                        className="text-slate-500 hover:text-rose-400 p-1.5 rounded transition"
                        title="Remover produto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Modal Novo Produto */}
          {showAddProduct && (
            <div className="fixed inset-0 z-50 bg-[#020617]/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl relative">
                <div className="flex items-center gap-2 border-b border-[#1e293b] pb-3">
                  <Package className="w-5 h-5 text-blue-400" />
                  <h3 className="text-base font-bold text-slate-100">Cadastrar Produto / Insumo</h3>
                </div>

                <form onSubmit={handleAddProduct} className="space-y-3 text-xs">
                  <div>
                    <label className="block text-slate-300 font-bold mb-1">Nome do Produto *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Cera Líquida Speed Wax 1L"
                      value={newProdName}
                      onChange={(e) => setNewProdName(e.target.value)}
                      className="w-full bg-[#020617] border border-[#1e293b] rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 font-bold mb-1">Finalidade / Categoria</label>
                      <select
                        value={newProdCategory}
                        onChange={(e) => setNewProdCategory(e.target.value as 'insumo' | 'venda')}
                        className="w-full bg-[#020617] border border-[#1e293b] rounded-lg p-2.5 text-slate-200 focus:outline-none cursor-pointer"
                      >
                        <option value="insumo">Insumo (Uso Interno)</option>
                        <option value="venda">Venda no Balcão</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-bold mb-1">Unidade de Medida</label>
                      <input
                        type="text"
                        placeholder="frascos, galões, un"
                        value={newProdUnit}
                        onChange={(e) => setNewProdUnit(e.target.value)}
                        className="w-full bg-[#020617] border border-[#1e293b] rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 font-bold mb-1">Qtd. em Estoque</label>
                      <input
                        type="number"
                        required
                        value={newProdStock}
                        onChange={(e) => setNewProdStock(Number(e.target.value))}
                        className="w-full bg-[#020617] border border-[#1e293b] rounded-lg p-2.5 text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-bold mb-1">Alerta Estoque Mínimo</label>
                      <input
                        type="number"
                        required
                        value={newProdMinStock}
                        onChange={(e) => setNewProdMinStock(Number(e.target.value))}
                        className="w-full bg-[#020617] border border-[#1e293b] rounded-lg p-2.5 text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {newProdCategory === 'venda' && (
                    <div>
                      <label className="block text-slate-300 font-bold mb-1">Preço de Venda ao Cliente (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={newProdPrice}
                        onChange={(e) => setNewProdPrice(Number(e.target.value))}
                        className="w-full bg-[#020617] border border-[#1e293b] rounded-lg p-2.5 text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  )}

                  <div className="pt-3 flex justify-end gap-2 border-t border-[#1e293b]">
                    <button
                      type="button"
                      onClick={() => setShowAddProduct(false)}
                      className="px-4 py-2 bg-[#020617] text-slate-300 rounded-lg font-medium border border-[#1e293b]"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold"
                    >
                      Salvar Produto
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= ABA 4: CADASTRO DE COMISSÕES ================= */}
      {subTab === 'comissoes' && (
        <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-6 space-y-6">
          <div className="border-b border-[#1e293b] pb-4">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Percent className="w-4 h-4 text-blue-400" />
              Tabela de Regras & Percentuais de Comissões
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Configure a porcentagem de repasse de comissão automática para cada membro da equipe ao concluir ordens de lavagem.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[#020617] text-slate-400 uppercase font-bold border-b border-[#1e293b]">
                <tr>
                  <th className="py-3 px-4">Colaborador</th>
                  <th className="py-3 px-4">Cargo</th>
                  <th className="py-3 px-4">% Comissão Atual</th>
                  <th className="py-3 px-4">Ajustar Porcentagem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e293b]/60">
                {staffList.map(staff => (
                  <tr key={staff.id} className="hover:bg-slate-800/20 transition">
                    <td className="py-3 px-4 font-bold text-slate-100">{staff.name}</td>
                    <td className="py-3 px-4 text-slate-400">{staff.role}</td>
                    <td className="py-3 px-4">
                      <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full font-mono font-bold">
                        {staff.defaultCommission}%
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          defaultValue={staff.defaultCommission}
                          onBlur={(e) => handleUpdateCommissionRate(staff.id, Number(e.target.value))}
                          className="w-20 bg-[#020617] border border-[#1e293b] rounded-lg p-1.5 text-center text-slate-100 font-mono font-bold focus:outline-none focus:border-blue-500"
                        />
                        <span className="text-slate-400 font-bold">%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= ABA 5: LOGO DA EMPRESA ================= */}
      {subTab === 'logo' && (
        <form onSubmit={handleSaveLogo} className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-6 space-y-6">
          <div className="border-b border-[#1e293b] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-blue-400" />
                Identidade Visual & Logotipo Individual do Lava-Jato
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Faça o upload da imagem ou informe a URL da logo. Ela é exibida automaticamente no topo do Painel, no Totem QR Code e no <strong className="text-slate-200">Recibo/Comprovante de Atendimento</strong>.
              </p>
            </div>

            <button
              type="submit"
              disabled={isProcessingLogo}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl font-bold transition shadow-lg shadow-blue-600/25 flex items-center gap-2 cursor-pointer self-start sm:self-auto shrink-0"
            >
              <Save className="w-4 h-4" /> Salvar Logotipo
            </button>
          </div>

          {logoUploadError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{logoUploadError}</span>
            </div>
          )}

          {/* Seletor de Arquivo e URL */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
            {/* Opção 1: Upload Direto do Dispositivo */}
            <div className="bg-[#020617] border border-[#1e293b] rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-200 flex items-center gap-2">
                  <Upload className="w-4 h-4 text-blue-400" /> Fazer Upload de Imagem
                </label>
                <span className="text-[10px] text-slate-500">PNG, JPG, SVG ou WebP</span>
              </div>
              <p className="text-slate-400 text-[11px]">
                Selecione o arquivo da logo no seu computador ou celular. A imagem é otimizada e salva diretamente no sistema.
              </p>

              <div className="pt-2">
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-700 hover:border-blue-500 rounded-xl p-6 cursor-pointer bg-slate-900/50 hover:bg-slate-900 transition group">
                  <Upload className="w-8 h-8 text-slate-400 group-hover:text-blue-400 transition mb-2" />
                  <span className="font-bold text-slate-300 group-hover:text-white text-xs">
                    {isProcessingLogo ? 'Processando imagem...' : 'Clique para selecionar a imagem'}
                  </span>
                  <span className="text-[10px] text-slate-500 mt-1">Recomendado formato quadrado ou retangular</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoFileUpload}
                    className="hidden"
                    disabled={isProcessingLogo}
                  />
                </label>
              </div>
            </div>

            {/* Opção 2: Inserir Link Direto (URL) */}
            <div className="bg-[#020617] border border-[#1e293b] rounded-xl p-5 space-y-3 flex flex-col justify-between">
              <div>
                <label className="font-bold text-slate-200 flex items-center gap-2 mb-1">
                  <Search className="w-4 h-4 text-blue-400" /> Ou informe a URL da Imagem
                </label>
                <p className="text-slate-400 text-[11px] mb-3">
                  Caso sua logo já esteja hospedada na web ou em CDN, cole o link direto abaixo:
                </p>
                <input
                  type="url"
                  placeholder="https://exemplo.com/minha-logo.png"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  className="w-full bg-[#0f172a] border border-[#1e293b] rounded-xl p-3 text-slate-200 font-mono focus:outline-none focus:border-blue-500 text-xs"
                />
              </div>

              {logoUrl && (
                <div className="pt-3 border-t border-[#1e293b] flex items-center justify-between">
                  <span className="text-emerald-400 text-[11px] font-medium flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5" /> Logotipo ativo carregado
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setLogoUrl('');
                      showNotification('Logotipo removido. Clique em "Salvar Logotipo" para confirmar.');
                    }}
                    className="text-rose-400 hover:text-rose-300 text-xs flex items-center gap-1 font-medium transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remover Logotipo
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ================= SEÇÃO DE PRÉ-VISUALIZAÇÕES ================= */}
          <div className="pt-4 border-t border-[#1e293b]">
            <h4 className="text-sm font-bold text-slate-200 mb-1 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" /> Pré-Visualização em Tempo Real da Logo
            </h4>
            <p className="text-xs text-slate-400 mb-4">
              Veja exatamente como a sua logo será apresentada nas diferentes telas e no comprovante oficial:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Preview 1: Cabeçalho Operacional */}
              <div className="bg-[#020617] border border-[#1e293b] rounded-xl p-4 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 block mb-2">
                    1. Cabeçalho da Empresa
                  </span>
                  <div className="bg-[#0f172a] border border-[#1e293b] rounded-lg p-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                      {logoUrl ? (
                        <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
                      ) : (
                        <Car className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                    <div className="overflow-hidden">
                      <div className="font-bold text-xs text-slate-200 truncate">{nomeFantasia || tenant.name}</div>
                      <div className="text-[10px] text-slate-400 truncate">Painel Operacional Ativo</div>
                    </div>
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 mt-2">Visível para os operadores no dia a dia.</p>
              </div>

              {/* Preview 2: RECIBO / COMPROVANTE DE LAVAGEM */}
              <div className="bg-white text-slate-900 border-2 border-slate-300 rounded-xl p-4 shadow-md flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-1.5 border-b border-dashed border-slate-300 mb-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-700">
                      2. Recibo / Comprovante Oficial
                    </span>
                    <Printer className="w-3.5 h-3.5 text-slate-600" />
                  </div>

                  {/* Topo do Recibo com a Logo */}
                  <div className="text-center py-1">
                    {logoUrl ? (
                      <div className="w-14 h-14 mx-auto rounded-lg bg-slate-100 border border-slate-300 p-1 flex items-center justify-center overflow-hidden mb-1.5 shadow-sm">
                        <img src={logoUrl} alt="Logo Recibo" className="w-full h-full object-contain" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 mx-auto rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-xs mb-1.5">
                        {tenant.code || 'LJ'}
                      </div>
                    )}
                    <div className="font-extrabold text-xs text-slate-950 leading-tight">{nomeFantasia || tenant.name}</div>
                    {cnpj && <div className="text-[9px] text-slate-600 font-mono">CNPJ: {cnpj}</div>}
                    <div className="text-[9px] text-emerald-700 font-bold mt-1">✓ COMPROVANTE DE ATENDIMENTO</div>
                  </div>

                  {/* Resumo do Recibo */}
                  <div className="bg-slate-50 border border-slate-200 rounded p-2 text-[10px] space-y-1 mt-2 font-mono">
                    <div className="flex justify-between"><span>Placa:</span><strong>ABC-1234</strong></div>
                    <div className="flex justify-between"><span>Serviço:</span><span>Lavagem Geral</span></div>
                    <div className="flex justify-between border-t border-slate-300 pt-1 font-bold text-slate-900">
                      <span>Total Pago:</span><span className="text-emerald-700">R$ 55,00</span>
                    </div>
                  </div>
                </div>

                <div className="text-[9px] text-slate-500 text-center mt-2 border-t border-dashed border-slate-300 pt-1">
                  Impresso ou enviado no WhatsApp do cliente com a sua logo!
                </div>
              </div>

              {/* Preview 3: Totem / QR Code do Cliente */}
              <div className="bg-[#020617] border border-[#1e293b] rounded-xl p-4 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block mb-2">
                    3. Placa do Totem & QR Code
                  </span>
                  <div className="bg-white text-slate-900 rounded-lg p-3 text-center border border-slate-300 shadow-sm">
                    {logoUrl ? (
                      <div className="w-10 h-10 mx-auto rounded-lg bg-slate-100 border border-slate-200 p-0.5 flex items-center justify-center overflow-hidden mb-1">
                        <img src={logoUrl} alt="Logo Totem" className="w-full h-full object-contain" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 mx-auto rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs mb-1">
                        <Car className="w-4 h-4" />
                      </div>
                    )}
                    <div className="font-bold text-[11px] text-slate-900 truncate">{nomeFantasia || tenant.name}</div>
                    <div className="text-[9px] text-slate-500">Acesse via câmera do celular</div>
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 mt-2">Exibido na placa de balcão e no portal PWA.</p>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* ================= ABA 6: TROCA DE SENHA ================= */}
      {subTab === 'senha' && (
        <form onSubmit={handleChangePassword} className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-6 space-y-6 max-w-lg">
          <div className="border-b border-[#1e293b] pb-4">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Key className="w-4 h-4 text-blue-400" />
              Segurança & Troca de Senha de Acesso
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Atualize a senha de login da empresa para substituir senhas temporárias ou de primeiro acesso.
            </p>
          </div>

          {tenant.tempPassword && 
           tenant.tempPassword !== (localStorage.getItem('saas_admin_password') || 'admin124050') && 
           tenant.tempPassword !== 'admin124050' && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-xs flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Senha temporária registrada: <strong className="font-mono font-bold tracking-wider">{showTempPwd ? tenant.tempPassword : '••••••••••••'}</strong></span>
              </div>
              <button
                type="button"
                onClick={() => setShowTempPwd(!showTempPwd)}
                className="p-1 text-amber-400/80 hover:text-amber-200 cursor-pointer"
                title={showTempPwd ? "Ocultar senha" : "Ver senha"}
              >
                {showTempPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          )}

          {pwdError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{pwdError}</span>
            </div>
          )}

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-300 font-bold mb-1">Nova Senha *</label>
              <div className="relative flex items-center">
                <input
                  type={showPwd ? 'text' : 'password'}
                  required
                  name="tenant_security_new_pwd"
                  id="tenant_security_new_pwd"
                  autoComplete="new-password"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  placeholder="Mínimo de 6 dígitos"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-[#020617] border border-[#1e293b] rounded-xl p-3 pr-10 text-slate-200 focus:outline-none focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 text-slate-500 hover:text-slate-300"
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1">Confirme a Nova Senha *</label>
              <input
                type={showPwd ? 'text' : 'password'}
                required
                name="tenant_security_confirm_pwd"
                id="tenant_security_confirm_pwd"
                autoComplete="new-password"
                data-lpignore="true"
                data-1p-ignore="true"
                placeholder="Repita a nova senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-[#020617] border border-[#1e293b] rounded-xl p-3 text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 mt-4 cursor-pointer"
            >
              <Lock className="w-4 h-4" /> Alterar Senha de Acesso
            </button>
          </div>
        </form>
      )}

    </div>
  );
};
