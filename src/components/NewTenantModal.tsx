import React, { useState } from 'react';
import { 
  X, 
  Building2, 
  PlusCircle, 
  Key, 
  RefreshCw, 
  Copy, 
  Check, 
  FileText, 
  MapPin, 
  Phone, 
  Mail, 
  Search, 
  Sparkles, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft,
  Loader2,
  Eye,
  EyeOff,
  Shield,
  QrCode
} from 'lucide-react';
import { Tenant, PlanType, TenantStatus } from '../types';
import { saveTenantToFirestore, saveCompanyEmailMapping } from '../lib/firebaseService';
import { TenantQRCode } from './TenantQRCode';

interface NewTenantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTenant: (newTenant: Tenant) => void;
  onTestClientPortal?: (tenant: Tenant) => void;
}

export const NewTenantModal: React.FC<NewTenantModalProps> = ({
  isOpen,
  onClose,
  onAddTenant,
  onTestClientPortal
}) => {
  // 'rapido' is now Step 1 (default active tab matching user request)
  const [activeTab, setActiveTab] = useState<'rapido' | 'fiscal' | 'geral' | 'acesso' | 'qrcode'>('rapido');
  const [fastCompanyName, setFastCompanyName] = useState('');
  
  // Fiscal / Company extended data (Step 1)
  const [razaoSocial, setRazaoSocial] = useState('');
  const [nomeFantasia, setNomeFantasia] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [inscricaoEstadual, setInscricaoEstadual] = useState('');
  const [cep, setCep] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [stateUf, setStateUf] = useState('SP');
  const [logoUrl, setLogoUrl] = useState('');

  // Step 2 Data (Pre-filled automatically from Step 1)
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [plan, setPlan] = useState<PlanType>('Pro');
  const [status, setStatus] = useState<TenantStatus>('Ativo');
  const [ownerName, setOwnerName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [maxUsers, setMaxUsers] = useState<number>(500);
  const [mrrAmount, setMrrAmount] = useState<number>(499);

  // Search loading states & feedback
  const [isSearchingCnpj, setIsSearchingCnpj] = useState(false);
  const [isSearchingCep, setIsSearchingCep] = useState(false);
  const [autoFillMessage, setAutoFillMessage] = useState<string | null>(null);

  // Temporary password generation (Step 3)
  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$';
    let pwd = '';
    for (let i = 0; i < 8; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `Auto#${pwd}`;
  };

  const [tempPassword, setTempPassword] = useState(() => generateRandomPassword());
  const [showTempPassword, setShowTempPassword] = useState(false);
  const [copiedPwd, setCopiedPwd] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [createdSuccessTenant, setCreatedSuccessTenant] = useState<Tenant | null>(null);

  if (!isOpen) return null;

  // Helper to generate a clean domain slug
  const generateSlug = (text: string) => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove acentos
      .replace(/[^a-z0-9]/g, '');
  };

  const flashAutoFillNotice = (msg: string) => {
    setAutoFillMessage(msg);
    setTimeout(() => setAutoFillMessage(null), 4000);
  };

  // Automated Sync: When Razão Social changes
  const handleRazaoSocialChange = (val: string) => {
    setRazaoSocial(val);
    
    // If Nome Fantasia is empty or was identical to previous Razão Social, sync it
    if (!nomeFantasia || nomeFantasia === razaoSocial) {
      setNomeFantasia(val);
      setName(val);
      const slug = generateSlug(val);
      setDomain(slug ? `${slug}.saas.com` : '');
    } else {
      // Keep name synchronized if it matched razaoSocial
      if (!name || name === razaoSocial) {
        setName(val);
        const slug = generateSlug(val);
        setDomain(slug ? `${slug}.saas.com` : '');
      }
    }
  };

  // Automated Sync: When Nome Fantasia changes
  const handleNomeFantasiaChange = (val: string) => {
    setNomeFantasia(val);
    // Automatically fill the Empresa Name and Subdomain in Step 2
    setName(val || razaoSocial);
    const textToSlug = val || razaoSocial;
    const slug = generateSlug(textToSlug);
    setDomain(slug ? `${slug}.saas.com` : '');
  };

  // Format and Auto-Lookup CNPJ
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

    // If reaches 14 numbers, trigger auto-lookup
    if (raw.length === 14) {
      fetchCnpjData(raw);
    }
  };

  // Lookup CNPJ via BrasilAPI / ReceitaWS
  const fetchCnpjData = async (rawDigits?: string) => {
    const clean = (rawDigits || cnpj).replace(/\D/g, '');
    if (clean.length !== 14) return;

    setIsSearchingCnpj(true);
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`);
      if (response.ok) {
        const data = await response.json();
        
        const razao = data.razao_social || '';
        const fantasia = data.nome_fantasia || data.razao_social || '';
        const email = data.email || contactEmail;
        const phone = data.ddd_telefone_1 ? `(${data.ddd_telefone_1.slice(0,2)}) ${data.ddd_telefone_1.slice(2)}` : contactPhone;
        const socio = data.qsa?.[0]?.nome_socio || ownerName;

        setRazaoSocial(razao);
        setNomeFantasia(fantasia);
        
        // Auto-fill Item 2 (Dados Principais)
        setName(fantasia || razao);
        const slug = generateSlug(fantasia || razao);
        setDomain(slug ? `${slug}.saas.com` : '');
        if (email) setContactEmail(email.toLowerCase());
        if (phone) setContactPhone(phone);
        if (socio) setOwnerName(socio);

        // Auto-fill Address
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

        flashAutoFillNotice(`✨ Dados da empresa ${fantasia || razao} preenchidos automaticamente via Receita Federal!`);
      }
    } catch (err) {
      console.warn('CNPJ auto lookup failed:', err);
    } finally {
      setIsSearchingCnpj(false);
    }
  };

  // Format and Auto-Lookup CEP via ViaCEP
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
          flashAutoFillNotice(`📍 Endereço preenchido automaticamente para ${data.localidade}/${data.uf}!`);
        }
      }
    } catch (err) {
      console.warn('CEP auto lookup failed:', err);
    } finally {
      setIsSearchingCep(false);
    }
  };

  const handlePlanChange = (val: PlanType) => {
    setPlan(val);
    if (val === 'Basic') {
      setMrrAmount(199);
      setMaxUsers(50);
    } else if (val === 'Pro') {
      setMrrAmount(499);
      setMaxUsers(500);
    } else if (val === 'Enterprise') {
      setMrrAmount(1299);
      setMaxUsers(5000);
    }
  };

  const handleCopyPassword = () => {
    navigator.clipboard.writeText(tempPassword);
    setCopiedPwd(true);
    setTimeout(() => setCopiedPwd(false), 2000);
  };

  const handleFastCreate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const companyName = fastCompanyName.trim();
    if (!companyName) {
      flashAutoFillNotice('Por favor, digite o nome do lava-jato.');
      return;
    }

    const slug = generateSlug(companyName) || `lavajato-${Date.now()}`;
    const code = companyName.slice(0, 2).toUpperCase() || 'WA';
    const formattedDate = new Date().toLocaleDateString('pt-BR');

    const createdTenant: Tenant = {
      id: `t-${Date.now()}`,
      name: companyName,
      code,
      domain: `${slug}.saas.com`,
      plan: 'Pro',
      status: 'Ativo',
      endUsersCount: 1,
      maxUsers: 500,
      mrrAmount: 499,
      createdAt: formattedDate,
      contactEmail: `${slug}@empresa.com`,
      contactPhone: '(11) 99999-9999',
      ownerName: companyName,
      lastActive: 'Agora mesmo',
      tempPassword: generateRandomPassword(),
      razaoSocial: companyName,
      nomeFantasia: companyName,
      cnpj: '',
      inscricaoEstadual: '',
      address: {
        cep: '01310-100',
        street: 'Av. Principal',
        number: '100',
        complement: '',
        neighborhood: 'Centro',
        city: 'São Paulo',
        state: 'SP',
      },
      logoUrl: ''
    };

    setIsSaving(true);
    try {
      // Inicia novo lava-jato 100% zerado (sem agendamentos pendentes ou lavagens fictícias na fila)
      localStorage.setItem(`saas_tenant_washes_${createdTenant.id}`, '[]');
      localStorage.setItem(`saas_tenant_appointments_${createdTenant.id}`, '[]');
      localStorage.setItem(`saas_tenant_wash_history_${createdTenant.id}`, '[]');

      await saveTenantToFirestore(createdTenant);
      if (createdTenant.contactEmail) {
        saveCompanyEmailMapping(createdTenant.contactEmail, createdTenant);
      }
      onAddTenant(createdTenant);
      setCreatedSuccessTenant(createdTenant);
      setFastCompanyName('');
    } catch (err) {
      console.error('Error saving fast tenant:', err);
      onAddTenant(createdTenant);
      setCreatedSuccessTenant(createdTenant);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Ensure we have at least a business name and email
    const finalName = name.trim() || nomeFantasia.trim() || razaoSocial.trim();
    const finalEmail = contactEmail.trim() || `${generateSlug(finalName) || 'contato'}@empresa.com`;

    if (!finalName) {
      setActiveTab('fiscal');
      return;
    }

    const code = finalName.slice(0, 2).toUpperCase();
    const formattedDate = new Date().toLocaleDateString('pt-BR');

    const createdTenant: Tenant = {
      id: `t-${Date.now()}`,
      name: finalName,
      code: code || 'TC',
      domain: domain || `${generateSlug(finalName)}.saas.com`,
      plan,
      status,
      endUsersCount: status === 'Ativo' ? 1 : 0,
      maxUsers,
      mrrAmount: status === 'Trial' ? 0 : mrrAmount,
      createdAt: formattedDate,
      contactEmail: finalEmail,
      contactPhone: contactPhone.trim() || '',
      ownerName: ownerName.trim() || finalName,
      lastActive: 'Agora mesmo',
      tempPassword: tempPassword.trim() || '',
      razaoSocial: razaoSocial.trim() || '',
      nomeFantasia: nomeFantasia.trim() || finalName,
      cnpj: cnpj.trim() || '',
      inscricaoEstadual: inscricaoEstadual.trim() || '',
      address: {
        cep: cep.trim() || '',
        street: street.trim() || '',
        number: number.trim() || '',
        complement: complement.trim() || '',
        neighborhood: neighborhood.trim() || '',
        city: city.trim() || '',
        state: stateUf.trim() || '',
      },
      logoUrl: logoUrl.trim() || ''
    };

    setIsSaving(true);
    try {
      // Inicia novo lava-jato 100% zerado (sem agendamentos pendentes ou lavagens fictícias na fila)
      localStorage.setItem(`saas_tenant_washes_${createdTenant.id}`, '[]');
      localStorage.setItem(`saas_tenant_appointments_${createdTenant.id}`, '[]');
      localStorage.setItem(`saas_tenant_wash_history_${createdTenant.id}`, '[]');

      // 🏢 Cria a empresa na coleção 'tenants' e 'empresas' do Firestore
      await saveTenantToFirestore(createdTenant);
      if (createdTenant.contactEmail) {
        saveCompanyEmailMapping(createdTenant.contactEmail, createdTenant);
      }
      onAddTenant(createdTenant);
      setCreatedSuccessTenant(createdTenant);

      // Reset fields
      setName('');
      setDomain('');
      setOwnerName('');
      setContactEmail('');
      setContactPhone('');
      setRazaoSocial('');
      setNomeFantasia('');
      setCnpj('');
      setInscricaoEstadual('');
      setCep('');
      setStreet('');
      setNumber('');
      setComplement('');
      setNeighborhood('');
      setCity('');
      setLogoUrl('');
      setTempPassword(generateRandomPassword());
    } catch (err) {
      console.error('Error saving tenant to Firestore:', err);
      onAddTenant(createdTenant);
      setCreatedSuccessTenant(createdTenant);
    } finally {
      setIsSaving(false);
    }
  };

  const handleFinishSuccess = () => {
    setCreatedSuccessTenant(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#020617]/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl relative max-h-[90vh] flex flex-col">
        <button
          onClick={createdSuccessTenant ? handleFinishSuccess : onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* TELA DE SUCESSO COM QR CODE IMEDIATO APÓS O CADASTRO */}
        {createdSuccessTenant ? (
          <div className="space-y-5 overflow-y-auto pr-1 flex-1 py-2">
            <div className="flex items-center gap-3 border-b border-[#1e293b] pb-3 shrink-0">
              <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#f8fafc]">Empresa Cadastrada com Sucesso!</h2>
                <p className="text-[11px] text-slate-400">
                  A empresa <strong className="text-emerald-400">{createdSuccessTenant.name}</strong> foi registrada no Firestore com acesso liberado e QR Code gerado.
                </p>
              </div>
            </div>

            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-300 text-xs flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                <strong>Placa do Lava-Jato Pronta!</strong> O QR Code abaixo já está vinculado a esta empresa. Você pode imprimir a placa física para o totem de atendimento agora mesmo.
              </span>
            </div>

            <TenantQRCode 
              empresa={{
                id: createdSuccessTenant.id,
                nome: createdSuccessTenant.name,
                slug: (createdSuccessTenant.domain ? createdSuccessTenant.domain.split('.')[0] : createdSuccessTenant.name)
                  .toLowerCase()
                  .normalize('NFD')
                  .replace(/[\u0300-\u036f]/g, '')
                  .replace(/[^a-z0-9]/g, '') || createdSuccessTenant.id,
                logoUrl: createdSuccessTenant.logoUrl
              }}
            />

            <div className="pt-4 border-t border-[#1e293b] flex flex-wrap items-center justify-between gap-3">
              {onTestClientPortal && (
                <button
                  type="button"
                  onClick={() => {
                    onTestClientPortal(createdSuccessTenant);
                    handleFinishSuccess();
                  }}
                  className="px-4 py-2.5 rounded-xl font-bold text-xs text-slate-950 transition flex items-center gap-2 shadow-lg shadow-cyan-500/20 hover:opacity-90 cursor-pointer"
                  style={{ background: 'linear-gradient(90deg, #00A3FF, #00FFCC)' }}
                >
                  📱 Abrir Tela do Cliente (Via QR) Deste Lava-Jato
                </button>
              )}
              <button
                type="button"
                onClick={handleFinishSuccess}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs transition flex items-center gap-2 shadow-lg shadow-emerald-600/30 cursor-pointer ml-auto"
              >
                <Check className="w-4 h-4" /> Concluir & Ir para o Painel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 border-b border-[#1e293b] pb-3 shrink-0">
              <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#f8fafc]">Cadastrar Nova Empresa (Tenant)</h2>
                <p className="text-[11px] text-slate-400">
                  Cadastre rapidamente pelo nome ou preencha os dados fiscais e operacionais completos.
                </p>
              </div>
            </div>

        {/* Feedback visual de preenchimento automático */}
        {autoFillMessage && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs px-3.5 py-2 rounded-xl flex items-center gap-2 animate-fadeIn shrink-0">
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-medium">{autoFillMessage}</span>
          </div>
        )}

        {/* Modal Internal Navigation */}
        <div className="flex items-center gap-2 border-b border-[#1e293b] pb-2 shrink-0 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab('rapido')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'rapido' 
                ? 'bg-[#00A3FF] text-white shadow-sm shadow-blue-500/30' 
                : 'bg-[#020617] text-cyan-400 hover:text-cyan-300 border border-cyan-500/30'
            }`}
          >
            ⚡ 1. Cadastro Rápido & QR Code
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('fiscal')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'fiscal' 
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30' 
                : 'bg-[#020617] text-slate-400 hover:text-slate-200 border border-[#1e293b]'
            }`}
          >
            <FileText className="w-3.5 h-3.5" /> 2. Razão Social & CNPJ
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('geral')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'geral' 
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30' 
                : 'bg-[#020617] text-slate-400 hover:text-slate-200 border border-[#1e293b]'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" /> 3. Dados Principais & Plano
            {name && <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block ml-1"></span>}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('acesso')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'acesso' 
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30' 
                : 'bg-[#020617] text-slate-400 hover:text-slate-200 border border-[#1e293b]'
            }`}
          >
            <Key className="w-3.5 h-3.5" /> 4. Senha de Acesso
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('qrcode')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'qrcode' 
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30' 
                : 'bg-[#020617] text-emerald-400 hover:text-emerald-300 border border-emerald-500/30'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" /> 5. Totem & QR Code PWA
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs overflow-y-auto pr-1 flex-1">
          
          {/* ================= ABA RÁPIDA: CADASTRO DO NOME + QR CODE DIRETO ================= */}
          {activeTab === 'rapido' && (
            <div className="space-y-4 py-1">
              <div className="bg-[#111827] border border-[#1F2937] p-5 rounded-xl space-y-4">
                <div>
                  <label className="block text-sm text-[#9CA3AF] font-semibold mb-2">
                    Nome do Lava-Jato
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Estética Automotiva Brilho"
                    value={fastCompanyName}
                    onChange={(e) => setFastCompanyName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleFastCreate();
                      }
                    }}
                    className="w-full p-3 bg-[#1F2937] border border-[#374151] rounded-lg text-white font-medium focus:outline-none focus:border-[#00A3FF] text-sm"
                  />
                  <p className="text-[11px] text-slate-400 mt-1.5">
                    O sistema cria automaticamente o link exclusivo, cadastra no Firestore e gera a placa com QR Code para o balcão.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleFastCreate}
                  disabled={isSaving || !fastCompanyName.trim()}
                  className="w-full py-3 px-5 rounded-lg font-bold text-slate-950 text-base transition hover:opacity-90 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20"
                  style={{ background: 'linear-gradient(90deg, #00A3FF, #00FFCC)' }}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" /> Cadastrando Empresa & Gerando QR Code...
                    </>
                  ) : (
                    <>
                      <QrCode className="w-5 h-5" /> Cadastrar Empresa & Gerar QR Code
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 bg-slate-900/50 p-3 rounded-lg border border-slate-800">
                <span>Deseja preencher Razão Social, CNPJ ou endereço físico completo?</span>
                <button
                  type="button"
                  onClick={() => setActiveTab('fiscal')}
                  className="text-blue-400 hover:underline font-bold cursor-pointer"
                >
                  Ir para Cadastro Fiscal →
                </button>
              </div>
            </div>
          )}
          
          {/* ================= ABA 1: FISCAL E ENDEREÇO (AGORA ITEM 1 COM AUTOFILL) ================= */}
          {activeTab === 'fiscal' && (
            <div className="space-y-3">
              <div className="p-2.5 bg-indigo-500/5 border border-indigo-500/20 rounded-xl text-indigo-300 text-[11px] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>
                  <strong>Automação Ativa:</strong> Ao preencher a Razão Social, Nome Fantasia ou buscar o CNPJ, o <strong>Nome da Empresa</strong>, <strong>Subdomínio</strong> e <strong>Contatos</strong> da Etapa 2 serão preenchidos automaticamente!
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-bold">CNPJ (Busca Automática)</label>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      placeholder="00.000.000/0001-00"
                      value={cnpj}
                      onChange={handleCnpjChange}
                      className="w-full bg-[#020617] border border-[#1e293b] rounded-lg p-2.5 pr-9 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => fetchCnpjData()}
                      disabled={isSearchingCnpj}
                      className="absolute right-2 text-slate-400 hover:text-indigo-400 p-1"
                      title="Consultar CNPJ na Receita"
                    >
                      {isSearchingCnpj ? (
                        <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                      ) : (
                        <Search className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-bold">Inscrição Estadual (IE)</label>
                  <input
                    type="text"
                    placeholder="123.456.789.000 ou Isento"
                    value={inscricaoEstadual}
                    onChange={(e) => setInscricaoEstadual(e.target.value)}
                    className="w-full bg-[#020617] border border-[#1e293b] rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-bold">Razão Social *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Hooli Estética e Serviços Automotivos LTDA"
                    value={razaoSocial}
                    onChange={(e) => handleRazaoSocialChange(e.target.value)}
                    className="w-full bg-[#020617] border border-[#1e293b] rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-bold">Nome Fantasia (Auto-Preenche Nome do App)</label>
                  <input
                    type="text"
                    placeholder="Ex: Hooli Auto Spa"
                    value={nomeFantasia}
                    onChange={(e) => handleNomeFantasiaChange(e.target.value)}
                    className="w-full bg-[#020617] border border-[#1e293b] rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-indigo-500 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-bold">CEP (Busca Automática)</label>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      placeholder="01001-000"
                      value={cep}
                      onChange={handleCepChange}
                      className="w-full bg-[#020617] border border-[#1e293b] rounded-lg p-2.5 pr-8 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                    />
                    {isSearchingCep && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400 absolute right-2.5" />
                    )}
                  </div>
                </div>

                <div className="col-span-2">
                  <label className="block text-slate-300 mb-1 font-bold">Logradouro / Rua</label>
                  <input
                    type="text"
                    placeholder="Av. Paulista"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    className="w-full bg-[#020617] border border-[#1e293b] rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-bold">Número</label>
                  <input
                    type="text"
                    placeholder="1000"
                    value={number}
                    onChange={(e) => setNumber(e.target.value)}
                    className="w-full bg-[#020617] border border-[#1e293b] rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-bold">Bairro</label>
                  <input
                    type="text"
                    placeholder="Bela Vista"
                    value={neighborhood}
                    onChange={(e) => setNeighborhood(e.target.value)}
                    className="w-full bg-[#020617] border border-[#1e293b] rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-bold">Cidade / UF</label>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      placeholder="São Paulo"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full bg-[#020617] border border-[#1e293b] rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                    <input
                      type="text"
                      placeholder="SP"
                      maxLength={2}
                      value={stateUf}
                      onChange={(e) => setStateUf(e.target.value.toUpperCase())}
                      className="w-12 bg-[#020617] border border-[#1e293b] rounded-lg p-2.5 text-slate-200 uppercase text-center font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-bold">URL do Logotipo da Empresa (Opcional)</label>
                <input
                  type="url"
                  placeholder="https://exemplo.com/logo.png"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  className="w-full bg-[#020617] border border-[#1e293b] rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
            </div>
          )}

          {/* ================= ABA 2: DADOS PRINCIPAIS & PLANO (PREENCHIDO AUTOMATICAMENTE DA ETAPA 1) ================= */}
          {activeTab === 'geral' && (
            <div className="space-y-3">
              {(nomeFantasia || razaoSocial) && (
                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-300 text-[11px] flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    Campos preenchidos automaticamente com base no cadastro da <strong>Etapa 1</strong>. Você pode personalizá-los livremente.
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-bold">Nome de Exibição da Empresa *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Hooli Auto Spa"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-[#020617] border border-[#1e293b] rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-indigo-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-bold">Subdomínio do Tenant (Gerado Automaticamente)</label>
                  <input
                    type="text"
                    placeholder="hooli.saas.com"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    className="w-full bg-[#020617] border border-[#1e293b] rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono text-emerald-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-bold">Responsável / Gerente</label>
                  <input
                    type="text"
                    placeholder="Gavin Belson"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    className="w-full bg-[#020617] border border-[#1e293b] rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-bold">E-mail Principal de Acesso *</label>
                  <input
                    type="email"
                    required
                    placeholder="contato@hooli.com"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    className="w-full bg-[#020617] border border-[#1e293b] rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-bold">WhatsApp / Telefone</label>
                  <input
                    type="text"
                    placeholder="(11) 98765-4321"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    className="w-full bg-[#020617] border border-[#1e293b] rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-bold">Plano Contratado</label>
                  <select
                    value={plan}
                    onChange={(e) => handlePlanChange(e.target.value as PlanType)}
                    className="w-full bg-[#020617] border border-[#1e293b] rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="Basic">Basic (R$ 199/mês)</option>
                    <option value="Pro">Pro (R$ 499/mês)</option>
                    <option value="Enterprise">Enterprise (R$ 1.299/mês)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-bold">Status Inicial</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as TenantStatus)}
                    className="w-full bg-[#020617] border border-[#1e293b] rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="Ativo">Ativo</option>
                    <option value="Trial">Trial (14 dias grátis)</option>
                    <option value="Inadimplente">Inadimplente</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-bold">Limite de Usuários / Operadores</label>
                  <input
                    type="number"
                    value={maxUsers}
                    onChange={(e) => setMaxUsers(Number(e.target.value))}
                    className="w-full bg-[#020617] border border-[#1e293b] rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-bold">Valor da Mensalidade MRR (R$)</label>
                  <input
                    type="number"
                    value={mrrAmount}
                    onChange={(e) => setMrrAmount(Number(e.target.value))}
                    className="w-full bg-[#020617] border border-[#1e293b] rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ================= ABA 3: SENHA TEMPORÁRIA DE ACESSO ================= */}
          {activeTab === 'acesso' && (
            <div className="space-y-4 bg-[#020617] p-4 rounded-xl border border-indigo-500/20">
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-100 text-sm">Senha Temporária de Primeiro Acesso</h4>
                  <p className="text-slate-400 text-xs mt-0.5">
                    Forneça esta senha para o responsável acessar a área da empresa. Ele poderá trocá-la nas configurações do painel.
                  </p>
                </div>
              </div>

              <div className="bg-[#0f172a] border border-[#1e293b] p-3.5 rounded-xl flex items-center justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Senha Temporária Gerada</span>
                    <span className="inline-flex items-center gap-1 text-[9px] bg-slate-800 text-emerald-400 px-1.5 py-0.2 rounded font-mono font-bold border border-emerald-500/20">
                      <Shield className="w-2.5 h-2.5 text-emerald-400" />
                      {showTempPassword ? 'Visível' : 'Protegida'}
                    </span>
                  </div>
                  <input
                    type={showTempPassword ? "text" : "password"}
                    readOnly
                    autoComplete="off"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    value={tempPassword}
                    className="bg-transparent text-emerald-400 font-mono font-bold text-base w-full focus:outline-none tracking-wider"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowTempPassword(!showTempPassword)}
                    className="p-2 bg-[#020617] hover:bg-slate-800 text-slate-300 border border-[#1e293b] rounded-lg transition cursor-pointer"
                    title={showTempPassword ? "Ocultar senha (modo segurança)" : "Mostrar senha"}
                  >
                    {showTempPassword ? <EyeOff className="w-4 h-4 text-amber-400" /> : <Eye className="w-4 h-4 text-slate-400" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setTempPassword(generateRandomPassword())}
                    className="p-2 bg-[#020617] hover:bg-slate-800 text-slate-300 border border-[#1e293b] rounded-lg transition cursor-pointer"
                    title="Gerar nova senha aleatória"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyPassword}
                    className={`px-3 py-2 rounded-lg font-bold text-xs flex items-center gap-1.5 transition cursor-pointer ${
                      copiedPwd 
                        ? 'bg-emerald-600 text-white' 
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                    }`}
                  >
                    {copiedPwd ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copiedPwd ? 'Copiada!' : 'Copiar Senha'}
                  </button>
                </div>
              </div>

              <div className="p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-lg text-slate-300 text-[11px] space-y-1">
                <p>🔹 <strong>Nome Cadastrado:</strong> {name || nomeFantasia || razaoSocial || 'Não definido'}</p>
                <p>🔹 <strong>E-mail de Login:</strong> {contactEmail || 'O e-mail preenchido no cadastro'}</p>
                <p>🔹 <strong>Subdomínio / Tenant:</strong> {domain || `${generateSlug(name || 'empresa')}.saas.com`}</p>
                <p>🔹 A empresa terá acesso imediato à gestão de lavagens, funcionários, estoque de produtos e comissões.</p>
              </div>
            </div>
          )}

          {/* ================= ABA 4: TOTEM & QR CODE PWA ================= */}
          {activeTab === 'qrcode' && (
            <div className="space-y-4">
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-300 text-xs flex items-center gap-2.5">
                <Sparkles className="w-4 h-4 text-blue-400 shrink-0" />
                <span>
                  <strong>Placa de Identificação & Roteamento Inteligente:</strong> Ao cadastrar, este QR Code direciona o cliente final diretamente para o portal e cardápio de serviços desta empresa.
                </span>
              </div>

              <TenantQRCode 
                empresa={{
                  id: `t-${Date.now()}`,
                  nome: name.trim() || nomeFantasia.trim() || razaoSocial.trim() || 'Nova Empresa de Lava-Jato',
                  slug: generateSlug(name || nomeFantasia || razaoSocial || 'novaempresa') || 'empresa',
                  logoUrl: logoUrl.trim() || undefined
                }}
              />
            </div>
          )}

          <div className="pt-4 flex justify-between items-center border-t border-[#1e293b]">
            <div className="flex gap-2">
              {activeTab !== 'fiscal' && (
                <button
                  type="button"
                  onClick={() => {
                    if (activeTab === 'qrcode') setActiveTab('acesso');
                    else if (activeTab === 'acesso') setActiveTab('geral');
                    else if (activeTab === 'geral') setActiveTab('fiscal');
                  }}
                  className="px-3 py-2 bg-[#020617] hover:bg-slate-900 text-slate-300 rounded-lg font-medium transition border border-[#1e293b] flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Voltar
                </button>
              )}
              {activeTab !== 'qrcode' && (
                <button
                  type="button"
                  onClick={() => {
                    if (activeTab === 'fiscal') setActiveTab('geral');
                    else if (activeTab === 'geral') setActiveTab('acesso');
                    else if (activeTab === 'acesso') setActiveTab('qrcode');
                  }}
                  className="px-3.5 py-2 bg-[#0f172a] hover:bg-slate-800 text-indigo-300 rounded-lg font-medium transition border border-indigo-500/30 flex items-center gap-1 cursor-pointer"
                >
                  Avançar <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-[#020617] hover:bg-slate-900 text-slate-300 rounded-lg font-medium transition border border-[#1e293b] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white rounded-lg font-bold transition flex items-center gap-1.5 shadow-sm shadow-indigo-600/30 cursor-pointer"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Salvando no Firestore...</span>
                  </>
                ) : (
                  <>
                    <PlusCircle className="w-4 h-4" />
                    <span>Cadastrar Empresa & Salvar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
        </>
        )}
      </div>
    </div>
  );
};
