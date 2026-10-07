import React, { useState } from 'react';
import { 
  Droplet, 
  User, 
  Building2, 
  ShieldCheck, 
  Mail, 
  Lock, 
  ArrowRight, 
  X, 
  CheckCircle2, 
  Sparkles,
  HelpCircle,
  Loader2,
  Eye,
  EyeOff,
  ShieldAlert,
  Shield,
  Key,
  QrCode,
  Plus,
  Trash2,
  MapPin,
  Car
} from 'lucide-react';
import { Tenant } from '../types';
import { PWAInstallButton } from './PWAInstallButton';
import { QrCodeScannerModal } from './QrCodeScannerModal';
import { 
  registerClientInFirebaseAuth, 
  loginClientInFirebaseAuth, 
  registerEmpresaInFirebaseAuth,
  loginEmpresaInFirebaseAuth,
  loginSuperAdminInFirebaseAuth,
  saveTenantToFirestore,
  saveCompanyEmailMapping,
  saveClientEmailMapping,
  saveClientFullRegistration,
  getCompanyEmailMapping,
  getClientEmailMapping,
  findTenantByCompanyEmailFirestore,
  findTenantIdByClientEmailFirestore 
} from '../lib/firebaseService';


export type LoginProfileType = 'cliente' | 'empresa' | 'admin';

interface LoginModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  isModal?: boolean;
  tenants: Tenant[];
  onLoginAsClient: (tenant: Tenant, clientInfo?: { name: string; phone: string; email?: string }) => void;
  onLoginAsEmpresa: (tenant: Tenant) => void;
  onLoginAsSuperAdmin: () => void;
  onReplaySplash?: () => void;
}

// Helper to extract clean slug from typed domain or URL
const extractDomainSlug = (input: string) => {
  return input
    .toLowerCase()
    .replace('https://', '')
    .replace('http://', '')
    .replace('.saas.com', '')
    .replace('.seusaas.com', '')
    .replace(/[^a-z0-9-]/g, '')
    .trim();
};

const getInitialSlugFromUrl = () => {
  if (typeof window === 'undefined') return '';
  try {
    const searchParams = new URLSearchParams(window.location.search);
    const qSlug = searchParams.get('tenantId') || searchParams.get('empresa') || searchParams.get('slug') || searchParams.get('t') || searchParams.get('lava');
    if (qSlug) return extractDomainSlug(qSlug);
    const pathSeg = window.location.pathname.replace(/^\//, '').split('/')[0];
    if (pathSeg && pathSeg !== 'index.html' && pathSeg !== '') {
      return extractDomainSlug(pathSeg);
    }
  } catch (e) {}
  return '';
};

const getInitialActiveTab = (): LoginProfileType => {
  if (typeof window === 'undefined') return 'empresa';
  const params = new URLSearchParams(window.location.search);
  if (params.get('empresa') || params.get('slug') || params.get('cadastro') || params.get('t')) {
    return 'cliente';
  }
  const path = window.location.pathname.replace(/^\//, '').split('/')[0];
  if (path && path !== 'index.html' && path !== '') {
    return 'cliente';
  }
  return 'empresa';
};

const getInitialIsSignUp = (): boolean => {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get('cadastro') === 'cliente' || params.get('cadastro') === 'true' || params.get('empresa') || params.get('slug')) {
    return true;
  }
  const path = window.location.pathname.replace(/^\//, '').split('/')[0];
  if (path && path !== 'index.html' && path !== '') {
    return true;
  }
  return false;
};

export interface RegVehicleItem {
  id: string;
  type: 'Carro' | 'Moto';
  brand: string;
  model: string;
  color: string;
  year: string;
  plate: string;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen = true,
  onClose,
  isModal = false,
  tenants,
  onLoginAsClient,
  onLoginAsEmpresa,
  onLoginAsSuperAdmin,
  onReplaySplash
}) => {
  const [activeTab, setActiveTab] = useState<LoginProfileType>(() => getInitialActiveTab());
  const [isSignUp, setIsSignUp] = useState<boolean>(() => getInitialIsSignUp());
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [authSuccessMsg, setAuthSuccessMsg] = useState<string | null>(null);
  
  // Login Form States (Profile-isolated to prevent browser cross-tab autofill leaks)
  const [subdomain, setSubdomain] = useState(() => getInitialSlugFromUrl());
  
  // Empresa Login States
  const [empresaEmail, setEmpresaEmail] = useState('');
  const [empresaPassword, setEmpresaPassword] = useState('');

  // Cliente Login States
  const [clienteIdentifier, setClienteIdentifier] = useState('');
  const [clientePassword, setClientePassword] = useState('');

  // Super Admin Login States
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // QR Code Scanner State
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
  const [qrScanTarget, setQrScanTarget] = useState<'login' | 'reg'>('login');

  // Security / Privacy Mode (Proteção Anti-Espiões)
  const [stealthMode, setStealthMode] = useState(true);

  // Auto-Associação de E-mail ao Subdomínio / Lava-Jato
  const [autoMatchedInfo, setAutoMatchedInfo] = useState<{
    type: 'empresa' | 'cliente';
    name: string;
    subdomain: string;
    email: string;
  } | null>(null);
  const [isSearchingEmail, setIsSearchingEmail] = useState<boolean>(false);

  // Registration (Cadastre-se) States
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regCompanyName, setRegCompanyName] = useState('');
  const [regSubdomain, setRegSubdomain] = useState(() => getInitialSlugFromUrl());
  const [regPlan, setRegPlan] = useState<'Basic' | 'Pro' | 'Enterprise'>('Pro');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);

  // Endereço e CEP (Busca Automática ViaCEP)
  const [regCep, setRegCep] = useState('');
  const [regAddress, setRegAddress] = useState('');
  const [regNeighborhood, setRegNeighborhood] = useState('');
  const [regCity, setRegCity] = useState('');
  const [regState, setRegState] = useState('');
  const [isSearchingCep, setIsSearchingCep] = useState(false);

  // Veículos Dinâmicos (+ Novo Veículo Carro/Moto)
  const [regVehicles, setRegVehicles] = useState<RegVehicleItem[]>([
    { id: 'v-1', type: 'Carro', brand: '', model: '', color: '', year: '', plate: '' }
  ]);

  const handleAddVehicleField = () => {
    setRegVehicles(prev => [
      ...prev,
      {
        id: `v-${Date.now()}-${prev.length + 1}`,
        type: 'Carro',
        brand: '',
        model: '',
        color: '',
        year: '',
        plate: ''
      }
    ]);
  };

  const handleRemoveVehicleField = (index: number) => {
    if (regVehicles.length <= 1) return;
    setRegVehicles(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleVehicleChange = (index: number, field: keyof RegVehicleItem, value: string) => {
    setRegVehicles(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Busca Automática do CEP via ViaCEP
  const buscarCEP = async (cepValue: string) => {
    const clean = cepValue.replace(/\D/g, '');
    if (clean.length !== 8) return;
    setIsSearchingCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setRegAddress(data.logradouro ? `${data.logradouro}, ` : '');
        setRegNeighborhood(data.bairro || '');
        setRegCity(data.localidade || '');
        setRegState(data.uf || '');
      }
    } catch (err) {
      console.error('Erro ao buscar CEP:', err);
    } finally {
      setIsSearchingCep(false);
    }
  };

  if (isModal && !isOpen) return null;

  const handleTabChange = (type: LoginProfileType) => {
    setActiveTab(type);
    if (type !== 'cliente') {
      setIsSignUp(false);
    }
    setErrorMessage(null);
    setAuthSuccessMsg(null);
    // Limpa senhas para que a senha do Super Admin não persista na aba Empresa
    setPassword('');
    setEmpresaPassword('');
    setClientePassword('');
    setAdminPassword('');
    setSubdomain(getInitialSlugFromUrl());
    setAutoMatchedInfo(null);
    setIsSearchingEmail(false);
  };

  const handleCompanyNameChange = (val: string) => {
    setRegCompanyName(val);
    const slug = val.toLowerCase().replace(/[^a-z0-9]/g, '');
    setRegSubdomain(slug);
  };

  const handleQrScanSuccess = (scannedSlug: string) => {
    if (qrScanTarget === 'reg') {
      setRegSubdomain(scannedSlug);
    } else {
      setSubdomain(scannedSlug);
    }
    setErrorMessage(null);
  };

  // Handler que associa automaticamente o e-mail corporativo ao subdomínio da empresa,
  // ou o e-mail do cliente ao lava-jato registrado
  const handleIdentifierChange = (val: string) => {
    setIdentifier(val);
    if (activeTab === 'empresa') {
      setEmpresaEmail(val);
    } else if (activeTab === 'cliente') {
      setClienteIdentifier(val);
    } else {
      setAdminEmail(val);
    }
    const cleanEmail = val.trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      if (autoMatchedInfo) {
        setAutoMatchedInfo(null);
      }
      return;
    }

    // 1. ABA EMPRESA: Associa e-mail corporativo ao subdomínio da empresa
    if (activeTab === 'empresa') {
      // Se digitou acidentalmente ou autofill colocou o email do admin super na aba da empresa
      if (cleanEmail === 'admin_super@gmail.com' || cleanEmail === (localStorage.getItem('saas_admin_email') || '').trim().toLowerCase()) {
        setAutoMatchedInfo(null);
        return;
      }
      // a) Busca em tenants conhecidos no estado da aplicação
      const matchedTenant = tenants.find(t => 
        (t.contactEmail && t.contactEmail.trim().toLowerCase() === cleanEmail) ||
        (t.domain && cleanEmail.endsWith(`@${t.domain.replace('.saas.com', '')}.com`))
      );

      if (matchedTenant) {
        const slug = extractDomainSlug(matchedTenant.domain);
        setSubdomain(slug);
        setAutoMatchedInfo({
          type: 'empresa',
          name: matchedTenant.name,
          subdomain: slug,
          email: cleanEmail
        });
        return;
      }

      // b) Busca no mapa salvo em localStorage
      const savedMap = getCompanyEmailMapping(cleanEmail);
      if (savedMap) {
        setSubdomain(savedMap.subdomain);
        setAutoMatchedInfo({
          type: 'empresa',
          name: savedMap.tenantName,
          subdomain: savedMap.subdomain,
          email: cleanEmail
        });
        return;
      }

      // c) Busca assíncrona no Firestore se tiver formato completo
      if (cleanEmail.includes('.') && cleanEmail.split('@')[1]?.length >= 2) {
        setIsSearchingEmail(true);
        findTenantByCompanyEmailFirestore(cleanEmail)
          .then(fireTenant => {
            setIsSearchingEmail(false);
            if (fireTenant) {
              const slug = extractDomainSlug(fireTenant.domain);
              setSubdomain(slug);
              setAutoMatchedInfo({
                type: 'empresa',
                name: fireTenant.name,
                subdomain: slug,
                email: cleanEmail
              });
              saveCompanyEmailMapping(cleanEmail, fireTenant);
            }
          })
          .catch(() => setIsSearchingEmail(false));
      }
    }

    // 2. ABA CLIENTE: Associa e-mail do cliente ao lava-jato registrado
    if (activeTab === 'cliente') {
      // a) Busca no mapa salvo de clientes
      const clientMap = getClientEmailMapping(cleanEmail);
      if (clientMap) {
        const matchedT = tenants.find(t => t.id === clientMap.tenantId || extractDomainSlug(t.domain) === clientMap.subdomain);
        const slug = clientMap.subdomain || (matchedT ? extractDomainSlug(matchedT.domain) : 'autoclean');
        const name = clientMap.tenantName || matchedT?.name || 'Lava-Jato';
        setSubdomain(slug);
        setAutoMatchedInfo({
          type: 'cliente',
          name: name,
          subdomain: slug,
          email: cleanEmail
        });
        return;
      }

      // b) Varre perfis em localStorage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('saas_client_profile_')) {
          try {
            const profile = JSON.parse(localStorage.getItem(key) || '{}');
            if (profile.email && profile.email.trim().toLowerCase() === cleanEmail) {
              const tenantId = key.replace('saas_client_profile_', '');
              const matchedT = tenants.find(t => t.id === tenantId);
              const slug = matchedT ? extractDomainSlug(matchedT.domain) : tenantId;
              const name = matchedT?.name || 'Lava-Jato';
              setSubdomain(slug);
              setAutoMatchedInfo({
                type: 'cliente',
                name: name,
                subdomain: slug,
                email: cleanEmail
              });
              saveClientEmailMapping(cleanEmail, tenantId, slug, name);
              return;
            }
          } catch (_) {}
        }
      }

      // c) Busca assíncrona no Firestore
      if (cleanEmail.includes('.') && cleanEmail.split('@')[1]?.length >= 2) {
        setIsSearchingEmail(true);
        findTenantIdByClientEmailFirestore(cleanEmail)
          .then(res => {
            setIsSearchingEmail(false);
            if (res && res.tenantId) {
              const matchedT = tenants.find(t => t.id === res.tenantId);
              const slug = matchedT ? extractDomainSlug(matchedT.domain) : res.tenantId;
              const name = matchedT?.name || 'Lava-Jato Registrado';
              setSubdomain(slug);
              setAutoMatchedInfo({
                type: 'cliente',
                name: name,
                subdomain: slug,
                email: cleanEmail
              });
              saveClientEmailMapping(cleanEmail, res.tenantId, slug, name);
            }
          })
          .catch(() => setIsSearchingEmail(false));
      }
    }
  };

  // Helper to find or build tenant by domain or name
  const resolveTenantByDomain = (domainInput: string, fallbackName?: string): Tenant => {
    const raw = domainInput.trim().toLowerCase();
    const cleanSub = extractDomainSlug(raw);

    const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const explicitTenantId = searchParams?.get('tenantId')?.trim().toLowerCase();

    // 0. Match by explicit URL tenantId parameter
    if (explicitTenantId) {
      const matchById = tenants.find(t => t.id.toLowerCase() === explicitTenantId);
      if (matchById) return matchById;
      // Garante que o celular use o ID exato da empresa no QR Code sem gerar ID aleatório
      return {
        id: explicitTenantId,
        name: fallbackName || (cleanSub.length > 2 ? cleanSub.charAt(0).toUpperCase() + cleanSub.slice(1) : 'Lava-Jato Parceiro'),
        code: explicitTenantId.slice(0, 4).toUpperCase(),
        domain: `${cleanSub || explicitTenantId}.saas.com`,
        plan: 'Pro',
        status: 'Ativo',
        endUsersCount: 1,
        maxUsers: 1000,
        mrrAmount: 499,
        createdAt: new Date().toLocaleDateString('pt-BR'),
        contactEmail: `contato@${cleanSub || explicitTenantId}.com`,
        ownerName: 'Gestor da Empresa',
        lastActive: 'Agora mesmo'
      };
    }

    // 1. Direct match by id, code, full domain, subdomain or company name
    const matched = tenants.find(t => 
      t.id.toLowerCase() === raw ||
      t.id.toLowerCase() === cleanSub ||
      t.code.toLowerCase() === raw ||
      t.code.toLowerCase() === cleanSub ||
      t.domain.toLowerCase() === raw ||
      t.domain.toLowerCase() === `${cleanSub}.saas.com` ||
      t.domain.toLowerCase().startsWith(cleanSub) ||
      t.name.toLowerCase().includes(cleanSub)
    );

    if (matched) return matched;

    // 2. If there are tenants loaded from Firestore / localStorage, prioritize the existing active tenant
    const nonDemoTenants = tenants.filter(t => t.id !== 't-autoclean');
    if (nonDemoTenants.length > 0 && !raw.includes('autoclean')) {
      return nonDemoTenants[0];
    }
    if (tenants.length > 0) {
      return tenants[0];
    }

    // 3. Fallback: only if completely empty, use default stable ID
    const displayName = fallbackName || (cleanSub.length > 2 ? cleanSub.charAt(0).toUpperCase() + cleanSub.slice(1) + ' Auto Spa' : 'Auto Clean Spa');
    return {
      id: 't-autoclean',
      name: displayName,
      code: displayName.slice(0, 2).toUpperCase() || 'LJ',
      domain: `${cleanSub || 'autoclean'}.saas.com`,
      plan: 'Pro',
      status: 'Ativo',
      endUsersCount: 1,
      maxUsers: 1000,
      mrrAmount: 499,
      createdAt: new Date().toLocaleDateString('pt-BR'),
      contactEmail: `contato@${cleanSub || 'autoclean'}.com`,
      ownerName: 'Gestor da Empresa',
      lastActive: 'Agora mesmo'
    };
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setAuthSuccessMsg(null);
    setIsSubmitting(true);

    try {
      if (activeTab === 'cliente') {
        if (!regName.trim() || !regEmail.trim()) {
          setErrorMessage('Por favor, preencha seu nome e e-mail.');
          setIsSubmitting(false);
          return;
        }

        const tenantToOpen = resolveTenantByDomain(regSubdomain || 'autoclean', regSubdomain ? `${regSubdomain} Lava-Jato` : undefined);
        
        // 🔐 Cria o cliente no Firebase Authentication e salva no Firestore
        const authRes = await registerClientInFirebaseAuth({
          name: regName.trim(),
          email: regEmail.trim(),
          password: regPassword.trim() || undefined,
          phone: regPhone.trim() || '(11) 99999-9999',
          tenantId: tenantToOpen.id
        });

        if (!authRes.success && authRes.errorMessage) {
          setErrorMessage(authRes.errorMessage);
          setIsSubmitting(false);
          return;
        }

        const validVehicles = regVehicles
          .filter(v => v.model.trim() || v.plate.trim() || v.brand.trim())
          .map((v, i) => ({
            id: v.id || `v-${Date.now()}-${i}`,
            type: (v.type ? v.type.toLowerCase() : 'carro') as 'carro' | 'moto',
            brand: v.brand.trim(),
            model: v.model.trim() || 'Veículo',
            color: v.color.trim(),
            year: v.year.trim(),
            plate: v.plate.trim().toUpperCase()
          }));

        // Salva veículos para o portal do cliente
        if (validVehicles.length > 0) {
          localStorage.setItem(`saas_client_vehicles_${tenantToOpen.id}`, JSON.stringify(validVehicles));
        }

        const clientData = {
          name: regName.trim(),
          email: regEmail.trim(),
          phone: regPhone.trim() || '(11) 99999-9999',
          cep: regCep.trim(),
          address: regAddress.trim(),
          neighborhood: regNeighborhood.trim(),
          city: regCity.trim(),
          stateUf: regState.trim(),
          vehicles: validVehicles
        };
        localStorage.setItem(`saas_client_profile_${tenantToOpen.id}`, JSON.stringify(clientData));
        
        // 🏢 Salva cadastro completo no Firestore
        await saveClientFullRegistration(tenantToOpen.id, clientData);

        // Associa e-mail do cliente ao lava-jato registrado
        saveClientEmailMapping(
          regEmail.trim(),
          tenantToOpen.id,
          extractDomainSlug(tenantToOpen.domain),
          tenantToOpen.name
        );

        setAuthSuccessMsg('Cadastro realizado com sucesso!');

        setTimeout(() => {
          onLoginAsClient(tenantToOpen, clientData);
          if (onClose) onClose();
        }, 500);

      } else if (activeTab === 'empresa') {
        if (!regCompanyName.trim() || !regEmail.trim()) {
          setErrorMessage('Por favor, preencha o nome do Lava-Jato e o e-mail principal.');
          setIsSubmitting(false);
          return;
        }

        const cleanSub = extractDomainSlug(regSubdomain) || extractDomainSlug(regCompanyName) || 'lavajato';
        const createdTenant: Tenant = {
          id: `t-${Date.now().toString().slice(-4)}`,
          name: regCompanyName.trim(),
          code: regCompanyName.slice(0, 2).toUpperCase() || 'LJ',
          domain: `${cleanSub}.saas.com`,
          plan: regPlan,
          status: 'Trial',
          endUsersCount: 1,
          maxUsers: regPlan === 'Basic' ? 50 : regPlan === 'Pro' ? 500 : 5000,
          mrrAmount: regPlan === 'Basic' ? 199 : regPlan === 'Pro' ? 499 : 1299,
          createdAt: new Date().toLocaleDateString('pt-BR'),
          contactEmail: regEmail.trim(),
          ownerName: regName.trim() || regCompanyName,
          lastActive: 'Agora mesmo'
        };

        // 🏢 Cria a conta de Empresa no Firebase Auth e nas coleções 'tenants' e 'usuarios' do Firestore
        const empRes = await registerEmpresaInFirebaseAuth({
          tenant: createdTenant,
          email: regEmail.trim(),
          password: regPassword.trim() || undefined,
          name: regName.trim() || regCompanyName
        });

        if (!empRes.success && empRes.errorMessage) {
          setErrorMessage(empRes.errorMessage);
          setIsSubmitting(false);
          return;
        }

        // Associa e-mail corporativo ao subdomínio da empresa
        saveCompanyEmailMapping(regEmail.trim(), createdTenant);

        onLoginAsEmpresa(createdTenant);
        if (onClose) onClose();
      } else if (activeTab === 'admin') {
        if (!regEmail.trim() || !regPassword.trim()) {
          setErrorMessage('Por favor, informe o e-mail master e a senha para o Super Admin.');
          setIsSubmitting(false);
          return;
        }
        const admRes = await loginSuperAdminInFirebaseAuth(regEmail.trim(), regPassword.trim());
        if (!admRes.success && admRes.errorMessage) {
          setErrorMessage(admRes.errorMessage);
          setIsSubmitting(false);
          return;
        }
        onLoginAsSuperAdmin();
        if (onClose) onClose();
      }
    } catch (err: any) {
      console.error('Registration error:', err);
      setErrorMessage(err.message || 'Ocorreu um erro no cadastro.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSignUp) {
      await handleRegisterSubmit(e);
      return;
    }
    setErrorMessage(null);
    setAuthSuccessMsg(null);

    // 1. ABA SUPER ADMIN
    if (activeTab === 'admin') {
      const typedEmail = (adminEmail || identifier).trim().toLowerCase();
      const typedPassword = (adminPassword || password).trim();

      if (!typedEmail) {
        setErrorMessage('Por favor, informe o E-mail Master (admin_super@gmail.com).');
        return;
      }
      if (!typedPassword) {
        setErrorMessage('Por favor, informe a senha administrativa.');
        return;
      }

      setIsSubmitting(true);
      try {
        const res = await loginSuperAdminInFirebaseAuth(typedEmail, typedPassword);
        if (!res.success && res.errorMessage) {
          setErrorMessage(res.errorMessage);
          setIsSubmitting(false);
          return;
        }
        onLoginAsSuperAdmin();
        if (onClose) onClose();
      } catch (err: any) {
        setErrorMessage(err.message || 'Erro ao realizar login master.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // 2. ABA CLIENTE
    if (activeTab === 'cliente') {
      const typedClientIdentifier = (clienteIdentifier || identifier).trim();
      const typedClientPassword = (clientePassword || password).trim();

      setIsSubmitting(true);
      try {
        const tenantToOpen = resolveTenantByDomain(subdomain || 'autoclean');
        
        let clientData: { name: string; phone: string; email?: string } = {
          name: typedClientIdentifier.includes('@') ? typedClientIdentifier.split('@')[0] : (typedClientIdentifier || 'Cliente'),
          email: typedClientIdentifier.includes('@') ? typedClientIdentifier : '',
          phone: !typedClientIdentifier.includes('@') ? typedClientIdentifier : '(11) 99999-9999'
        };

        // Autentica cliente no Firebase Auth se houver e-mail
        if (typedClientIdentifier.includes('@')) {
          const res = await loginClientInFirebaseAuth(typedClientIdentifier, typedClientPassword || undefined);
          if (res.user && res.user.displayName) {
            clientData.name = res.user.displayName;
          }
        }

        onLoginAsClient(tenantToOpen, clientData);
        if (onClose) onClose();
      } catch (err: any) {
        console.warn('Client login warning:', err);
        const tenantToOpen = resolveTenantByDomain(subdomain || 'autoclean');
        onLoginAsClient(tenantToOpen, { name: (clienteIdentifier || identifier).split('@')[0] || 'Cliente', phone: '(11) 99999-9999' });
        if (onClose) onClose();
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // 3. ABA EMPRESA (Lava-Jato / Centro Automotivo)
    if (activeTab === 'empresa') {
      const typedEmpresaEmail = (empresaEmail || identifier).trim().toLowerCase();
      const typedEmpresaPassword = (empresaPassword || password).trim();

      if (!typedEmpresaEmail) {
        setErrorMessage('Por favor, informe o e-mail de acesso da sua empresa.');
        return;
      }

      setIsSubmitting(true);
      try {
        // Autentica no Firebase Auth se forneceu senha
        if (typedEmpresaPassword) {
          const authRes = await loginEmpresaInFirebaseAuth(typedEmpresaEmail, typedEmpresaPassword);
          if (!authRes.success && authRes.errorMessage) {
            setErrorMessage(authRes.errorMessage);
            setIsSubmitting(false);
            return;
          }
        }

        const tenantToOpen = resolveTenantByDomain(subdomain || typedEmpresaEmail.split('@')[0], 'Auto Clean Spa');
        onLoginAsEmpresa(tenantToOpen);
        if (onClose) onClose();
      } catch (err: any) {
        setErrorMessage(err.message || 'Erro ao realizar login da empresa.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }
  };

  const containerClasses = isModal 
    ? "fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in"
    : "min-h-screen w-full flex items-center justify-center p-4 bg-[#020617] text-slate-100 font-sans relative overflow-hidden";

  return (
    <div className={containerClasses}>
      
      {/* Background Lights */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />

      <div className={`w-full ${isSignUp && activeTab === 'cliente' ? 'max-w-xl' : 'max-w-md'} relative z-10 transition-all duration-300`}>
        
        {/* Close Button only in Modal mode */}
        {isModal && onClose && (
          <button 
            onClick={onClose}
            className="absolute -top-3 -right-3 z-20 w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white border border-slate-700 flex items-center justify-center transition"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Top action: PWA Install badge */}
        <div className="flex justify-center mb-3">
          <PWAInstallButton compact variant="outline" />
        </div>

        {/* Logo e Cabeçalho */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center relative mb-3 max-w-[280px] w-full">
            <img 
              src="/logo.png" 
              alt="WashAuto OS Logo" 
              onError={(e) => {
                const target = e.currentTarget as HTMLImageElement;
                if (target.src !== window.location.origin + '/logo.png') {
                  target.src = '/logo.png';
                }
              }}
              className="max-h-16 w-auto object-contain drop-shadow-[0_4px_16px_rgba(0,163,255,0.25)]"
              referrerPolicy="no-referrer"
            />
          </div>
          <p className="text-xs text-slate-400 mt-1">Selecione seu perfil abaixo para acessar o painel</p>
        </div>

        {/* Card Principal de Login */}
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">

          {/* ================= 1. SELETOR DE PERFIL (TABS CLIENTE & EMPRESA) ================= */}
          {activeTab !== 'admin' ? (
            <div className="grid grid-cols-2 gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800/80 text-xs font-bold">
              {/* Tab Cliente */}
              <button 
                type="button" 
                onClick={() => handleTabChange('cliente')} 
                className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-lg transition-all duration-200 cursor-pointer ${
                  activeTab === 'cliente' 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 font-black' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <User className="w-4 h-4 mb-0.5" />
                <span>Cliente</span>
              </button>

              {/* Tab Empresa */}
              <button 
                type="button" 
                onClick={() => handleTabChange('empresa')} 
                className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-lg transition-all duration-200 cursor-pointer ${
                  activeTab === 'empresa' 
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 font-black' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Building2 className="w-4 h-4 mb-0.5" />
                <span>Lava-Jato / Empresa</span>
              </button>
            </div>
          ) : (
            /* Banner de Acesso Super Admin com opção de retorno */
            <div className="flex items-center justify-between bg-indigo-950/70 border border-indigo-500/30 px-3.5 py-2.5 rounded-xl text-xs">
              <div className="flex items-center gap-2 text-indigo-300 font-bold">
                <ShieldCheck className="w-4 h-4 text-indigo-400" />
                <span>Acesso Master: Super Admin</span>
              </div>
              <button
                type="button"
                onClick={() => handleTabChange('empresa')}
                className="text-[11px] text-slate-400 hover:text-white transition underline cursor-pointer"
              >
                ← Voltar ao login normal
              </button>
            </div>
          )}

          {/* Indicator / Banner Dinâmico do Perfil Ativo */}
          {activeTab === 'cliente' && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 flex items-center gap-3">
              <User className="w-5 h-5 text-blue-400 flex-shrink-0" />
              <div>
                <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider">ACESSO CLIENTE</h4>
                <p className="text-[11px] text-slate-400">Agende lavagens e acompanhe seus pontos de fidelidade.</p>
              </div>
            </div>
          )}

          {activeTab === 'empresa' && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex items-center gap-3">
              <Building2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <div>
                <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Painel da Empresa (Lava-Rápido)</h4>
                <p className="text-[11px] text-slate-400">Gerencie filas, lavadores, estoque e comissões.</p>
              </div>
            </div>
          )}

          {activeTab === 'admin' && (
            <div className="bg-gradient-to-r from-indigo-950/80 to-slate-900 border border-indigo-500/30 rounded-xl p-3.5 flex items-start gap-3 shadow-lg shadow-indigo-950/40">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider">Área Restrita Super Admin</h4>
                  <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded font-mono font-bold">256-BIT</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Acesso protegido. Somente com o <strong>E-mail Master</strong> e <strong>Senha</strong> autorizados.
                </p>
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold flex items-center gap-2">
              <span className="shrink-0">⚠️</span>
              <span>{errorMessage}</span>
            </div>
          )}

          {authSuccessMsg && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{authSuccessMsg}</span>
            </div>
          )}

          {/* ================= 2. FORMULÁRIO DE LOGIN OU CADASTRO ================= */}
          {!isSignUp ? (
            /* FORMULÁRIO DE LOGIN (com key={activeTab} para destruir e recriar inputs e impedir contaminação de autofill do navegador) */
            <form key={activeTab} onSubmit={handleSubmit} autoComplete="off" data-lpignore="true" className="space-y-4">
              
              {/* 1. CAMPO E-MAIL / WHATSAPP / E-MAIL CORPORATIVO (PRIMEIRO CAMPO) */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-slate-300">
                    {activeTab === 'cliente' && 'E-mail ou WhatsApp'}
                    {activeTab === 'empresa' && 'E-mail Corporativo do Lava-Jato'}
                    {activeTab === 'admin' && 'E-mail Master (Root)'}
                  </label>
                  {activeTab !== 'admin' && (
                    <span className="text-[10px] text-slate-400 font-mono">
                      {activeTab === 'empresa' ? 'Detecta subdomínio' : 'Localiza lava-jato'}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-3 text-slate-500 pointer-events-none" />
                  {activeTab === 'empresa' && (
                    <input 
                      type="text" 
                      name="empresa_login_email"
                      id="empresa_login_email"
                      value={empresaEmail || identifier}
                      onChange={(e) => handleIdentifierChange(e.target.value)}
                      placeholder="contato@seulavajato.com" 
                      autoComplete="off"
                      data-lpignore="true"
                      data-1p-ignore="true"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-10 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 transition font-medium"
                    />
                  )}
                  {activeTab === 'cliente' && (
                    <input 
                      type="text" 
                      name="cliente_login_identity"
                      id="cliente_login_identity"
                      value={clienteIdentifier || identifier}
                      onChange={(e) => handleIdentifierChange(e.target.value)}
                      placeholder="seu@email.com ou WhatsApp" 
                      autoComplete="off"
                      data-lpignore="true"
                      data-1p-ignore="true"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-10 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500 transition font-medium"
                    />
                  )}
                  {activeTab === 'admin' && (
                    <input 
                      type="email" 
                      name="superadmin_master_email"
                      id="superadmin_master_email"
                      value={adminEmail || identifier}
                      onChange={(e) => handleIdentifierChange(e.target.value)}
                      placeholder="admin_super@gmail.com" 
                      autoComplete="username"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-10 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 transition font-medium"
                    />
                  )}
                  {isSearchingEmail && (
                    <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin absolute right-3.5 top-3" />
                  )}
                </div>
              </div>

              {/* BADGE DE ASSOCIAÇÃO AUTOMÁTICA DETECTADA */}
              {autoMatchedInfo && activeTab === 'empresa' && (
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-start justify-between text-xs text-emerald-300 animate-fadeIn">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-[11px] block">Subdomínio da Empresa Detectado:</span>
                      <span className="text-[11px] text-slate-200">
                        <strong>{autoMatchedInfo.subdomain}.saas.com</strong> ({autoMatchedInfo.name})
                      </span>
                    </div>
                  </div>
                  <span className="text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded shrink-0">
                    Auto Preenchido
                  </span>
                </div>
              )}

              {autoMatchedInfo && activeTab === 'cliente' && (
                <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-start justify-between text-xs text-blue-300 animate-fadeIn">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-[11px] block">Lava-Jato Vinculado ao seu Cadastro:</span>
                      <span className="text-[11px] text-slate-200">
                        <strong>{autoMatchedInfo.name}</strong> ({autoMatchedInfo.subdomain}.saas.com)
                      </span>
                    </div>
                  </div>
                  <span className="text-[9px] font-mono font-bold bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded shrink-0">
                    Localizado
                  </span>
                </div>
              )}

              {/* 2. CAMPO SUBDOMÍNIO / LAVA-JATO QUANDO FOR CLIENTE */}
              {activeTab === 'cliente' && (
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-bold text-slate-300">
                      Lava-Jato / Domínio
                      {autoMatchedInfo && (
                        <span className="ml-1.5 text-[10px] text-emerald-400 font-bold">✓ Vinculado</span>
                      )}
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setQrScanTarget('login');
                        setIsQrScannerOpen(true);
                      }}
                      className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-semibold cursor-pointer transition hover:underline"
                      title="Escanear QR Code do balcão ou totem"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>Ler QR Code</span>
                    </button>
                  </div>
                  <div className="relative flex items-center">
                    <input 
                      type="text" 
                      value={subdomain}
                      onChange={(e) => setSubdomain(e.target.value)}
                      placeholder="Digite o domínio (Ex: autoclean)" 
                      className={`w-full bg-slate-950 border rounded-lg pl-3 pr-24 py-2.5 text-xs text-slate-100 font-bold focus:outline-none transition font-mono ${
                        autoMatchedInfo ? 'border-blue-500/50 bg-blue-950/20' : 'border-slate-800 focus:border-blue-500'
                      }`}
                    />
                    <span className="absolute right-3 text-xs text-slate-500 font-mono font-bold">.saas.com</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1">
                    <span>💡 Digite o domínio do lava-jato ou use o botão para ler o QR Code.</span>
                  </p>
                </div>
              )}

              {/* 3. CAMPO SUBDOMÍNIO QUANDO FOR EMPRESA */}
              {activeTab === 'empresa' && (
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-bold text-slate-300">
                      Subdomínio da Empresa
                      {autoMatchedInfo && (
                        <span className="ml-1.5 text-[10px] text-emerald-400 font-bold">✓ Associado</span>
                      )}
                    </label>
                    <span className="text-[11px] text-emerald-400 font-mono">.saas.com</span>
                  </div>
                  <div className="relative flex items-center">
                    <input 
                      type="text" 
                      name="empresa_login_subdomain"
                      id="empresa_login_subdomain"
                      value={subdomain}
                      onChange={(e) => setSubdomain(e.target.value)}
                      placeholder="autoclean" 
                      autoComplete="off"
                      data-lpignore="true"
                      className={`w-full bg-slate-950 border rounded-lg pl-3 pr-24 py-2.5 text-xs text-slate-100 font-bold focus:outline-none transition font-mono ${
                        autoMatchedInfo ? 'border-emerald-500/50 bg-emerald-950/20' : 'border-slate-800 focus:border-emerald-500'
                      }`}
                    />
                    <span className="absolute right-3 text-xs text-slate-500 font-mono font-bold">.saas.com</span>
                  </div>
                  {subdomain && (
                    <div className="mt-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-[11px]">
                      <span className="text-slate-300 truncate">
                        🏢 <strong>{resolveTenantByDomain(subdomain).name}</strong>
                      </span>
                      <span className="text-emerald-400 font-mono font-bold shrink-0 ml-2">
                        {resolveTenantByDomain(subdomain).domain}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Senha com Modo de Segurança & Toggle */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
                    <span>
                      {activeTab === 'admin' ? 'Senha Administrativa Master' : activeTab === 'empresa' ? 'Senha de Acesso da Empresa' : 'Senha'}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] bg-slate-800 text-emerald-400 px-1.5 py-0.5 rounded font-mono font-bold border border-emerald-500/20">
                      <Shield className="w-2.5 h-2.5 text-emerald-400" />
                      Protegida
                    </span>
                  </label>
                  <a 
                    href="#" 
                    onClick={(e) => { 
                      e.preventDefault(); 
                      if (activeTab === 'admin') {
                        localStorage.setItem('saas_admin_email', 'admin_super@gmail.com');
                        localStorage.setItem('saas_admin_password', 'admin124050');
                        setAdminEmail('admin_super@gmail.com');
                        setAdminPassword('admin124050');
                        setIdentifier('admin_super@gmail.com');
                        setPassword('admin124050');
                        setErrorMessage(null);
                        setAuthSuccessMsg('Credenciais do Super Admin restauradas com sucesso: admin_super@gmail.com / admin124050');
                      } else {
                        setAuthSuccessMsg('Instruções de recuperação de senha enviadas para o seu e-mail.'); 
                      }
                    }} 
                    className="text-[11px] text-blue-400 hover:underline"
                  >
                    Esqueceu a senha?
                  </a>
                </div>
                <div className="relative flex items-center">
                  <Lock className="w-4 h-4 absolute left-3.5 text-slate-500 pointer-events-none" />
                  {activeTab === 'empresa' && (
                    <input 
                      type={showPassword ? "text" : "password"} 
                      name="empresa_login_secret_code"
                      id="empresa_login_secret_code"
                      value={empresaPassword || password}
                      onChange={(e) => {
                        setEmpresaPassword(e.target.value);
                        setPassword(e.target.value);
                      }}
                      placeholder="••••••••" 
                      autoComplete="new-password"
                      data-lpignore="true"
                      data-1p-ignore="true"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-10 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 transition font-mono tracking-wider"
                    />
                  )}
                  {activeTab === 'cliente' && (
                    <input 
                      type={showPassword ? "text" : "password"} 
                      name="cliente_login_secret_key"
                      id="cliente_login_secret_key"
                      value={clientePassword || password}
                      onChange={(e) => {
                        setClientePassword(e.target.value);
                        setPassword(e.target.value);
                      }}
                      placeholder="••••••••" 
                      autoComplete="new-password"
                      data-lpignore="true"
                      data-1p-ignore="true"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-10 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500 transition font-mono tracking-wider"
                    />
                  )}
                  {activeTab === 'admin' && (
                    <input 
                      type={showPassword ? "text" : "password"} 
                      name="superadmin_master_password"
                      id="superadmin_master_password"
                      value={adminPassword || password}
                      onChange={(e) => {
                        setAdminPassword(e.target.value);
                        setPassword(e.target.value);
                      }}
                      placeholder="••••••••" 
                      autoComplete="current-password"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-10 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 transition font-mono tracking-wider"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 p-1 text-slate-500 hover:text-slate-300 focus:outline-none cursor-pointer transition"
                    title={showPassword ? "Ocultar senha (modo segurança)" : "Mostrar senha"}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4 text-amber-400" />
                    ) : (
                      <Eye className="w-4 h-4 text-slate-500" />
                    )}
                  </button>
                </div>
              </div>

              {/* Dica / Auxiliar de Credenciais do Super Admin (Apenas exibido na aba admin) */}
              {activeTab === 'admin' && (
                <div className="bg-indigo-950/40 border border-indigo-500/20 rounded-xl p-3 text-xs text-indigo-300 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold flex items-center gap-1.5 text-indigo-200">
                      <Key className="w-3.5 h-3.5 text-indigo-400" />
                      Credenciais de Acesso Super Admin:
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setAdminEmail('admin_super@gmail.com');
                        setAdminPassword('admin124050');
                        setIdentifier('admin_super@gmail.com');
                        setPassword('admin124050');
                        setErrorMessage(null);
                      }}
                      className="text-[11px] font-bold text-indigo-400 hover:text-indigo-200 underline cursor-pointer"
                    >
                      Preencher credenciais
                    </button>
                  </div>
                  <div className="text-[11px] text-slate-300 font-mono flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 bg-slate-950/60 p-2 rounded-lg border border-indigo-500/10">
                    <span>E-mail: <strong className="text-white">admin_super@gmail.com</strong></span>
                    <span>Senha: <strong className="text-amber-400">admin124050</strong></span>
                  </div>
                </div>
              )}

              {/* Lembrar Login */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded bg-slate-950 border-slate-800 text-blue-600 focus:ring-0 focus:ring-offset-0"
                  />
                  <span className="text-xs text-slate-400 font-medium">Lembrar-me neste dispositivo</span>
                </label>
              </div>

              {/* Botão Entrar */}
              {activeTab === 'cliente' && (
                <button 
                  type="submit" 
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 text-xs mt-2 cursor-pointer"
                >
                  <span>Acessar Portal do Lava-Jato</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}

              {activeTab === 'empresa' && (
                <button 
                  type="submit" 
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 text-xs mt-2 cursor-pointer"
                >
                  <span>Acessar Painel Operacional</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}

              {activeTab === 'admin' && (
                <button 
                  type="submit" 
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 rounded-xl transition shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 text-xs mt-2 cursor-pointer"
                >
                  <Lock className="w-4 h-4" />
                  <span>Acessar Área Restrita (Super Admin)</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </form>
          ) : (
            /* FORMULÁRIO DE CADASTRO (CADASTRE-SE) */
            <form onSubmit={handleSubmit} className="space-y-3.5">
              
              {activeTab === 'cliente' && (
                <>
                  <div className="border-b border-slate-800 pb-2 mb-3">
                    <h3 className="text-base font-bold text-white tracking-tight">Criar Conta de Cliente</h3>
                    {regSubdomain && (
                      <p className="text-[#00A3FF] font-bold text-xs mt-0.5">
                        Bem-vindo ao {resolveTenantByDomain(regSubdomain).name}!
                      </p>
                    )}
                  </div>

                  {/* Dados Pessoais */}
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Nome Completo *</label>
                    <input 
                      type="text" 
                      required
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder="Digite seu nome completo" 
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-100 focus:outline-none focus:border-[#00A3FF] transition"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">E-mail *</label>
                      <input 
                        type="email" 
                        required
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="seu@email.com" 
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-100 focus:outline-none focus:border-[#00A3FF] transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">WhatsApp / Celular</label>
                      <input 
                        type="text" 
                        value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value)}
                        placeholder="(11) 99999-9999" 
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-100 focus:outline-none focus:border-[#00A3FF] transition"
                      />
                    </div>
                  </div>

                  {/* Endereço com Busca Automática por CEP */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-xs font-bold text-slate-300">CEP (Busca Automática)</label>
                        {isSearchingCep && <Loader2 className="w-3 h-3 text-[#00A3FF] animate-spin" />}
                      </div>
                      <input 
                        type="text" 
                        maxLength={9}
                        value={regCep}
                        onChange={(e) => {
                          const val = e.target.value;
                          setRegCep(val);
                          if (val.replace(/\D/g, '').length === 8) {
                            buscarCEP(val);
                          }
                        }}
                        onBlur={(e) => buscarCEP(e.target.value)}
                        placeholder="00000-000" 
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-100 focus:outline-none focus:border-[#00A3FF] transition font-mono"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-300 mb-1">Endereço Completo</label>
                      <input 
                        type="text" 
                        value={regAddress}
                        onChange={(e) => setRegAddress(e.target.value)}
                        placeholder="Rua, Número, Ap" 
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-100 focus:outline-none focus:border-[#00A3FF] transition"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">Bairro</label>
                      <input 
                        type="text" 
                        value={regNeighborhood}
                        onChange={(e) => setRegNeighborhood(e.target.value)}
                        placeholder="Bairro" 
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-100 focus:outline-none focus:border-[#00A3FF] transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">Cidade</label>
                      <input 
                        type="text" 
                        value={regCity}
                        onChange={(e) => setRegCity(e.target.value)}
                        placeholder="Cidade" 
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-100 focus:outline-none focus:border-[#00A3FF] transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">Estado</label>
                      <input 
                        type="text" 
                        maxLength={2}
                        value={regState}
                        onChange={(e) => setRegState(e.target.value.toUpperCase())}
                        placeholder="EX: SP" 
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-100 uppercase font-mono font-bold focus:outline-none focus:border-[#00A3FF] transition"
                      />
                    </div>
                  </div>

                  {/* Seção de Veículos Dinâmicos */}
                  <div className="pt-2">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                        <Car className="w-3.5 h-3.5 text-[#00A3FF]" />
                        <span>Veículos</span>
                        <span className="text-[10px] text-slate-400 font-normal">({regVehicles.length})</span>
                      </h4>
                    </div>

                    <div className="space-y-3">
                      {regVehicles.map((vehicle, idx) => (
                        <div 
                          key={vehicle.id} 
                          className="bg-[#1F2937]/60 border border-[#374151] p-3 rounded-xl border-l-4 border-l-[#00A3FF] transition-all"
                        >
                          <div className="flex items-center justify-between mb-2 pb-1 border-b border-slate-800/80">
                            <span className="text-[11px] font-bold text-cyan-300 flex items-center gap-1">
                              Veículo #{idx + 1} ({vehicle.type})
                            </span>
                            {regVehicles.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveVehicleField(idx)}
                                className="text-[10px] text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer font-semibold"
                              >
                                <Trash2 className="w-3 h-3" /> Remover
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
                            <div>
                              <label className="block text-[10px] text-slate-400 font-medium mb-0.5">Tipo</label>
                              <select
                                value={vehicle.type}
                                onChange={(e) => handleVehicleChange(idx, 'type', e.target.value as 'Carro' | 'Moto')}
                                className="w-full p-2 bg-[#0B0F19] border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-[#00A3FF]"
                              >
                                <option value="Carro">Carro</option>
                                <option value="Moto">Moto</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] text-slate-400 font-medium mb-0.5">Marca *</label>
                              <input
                                type="text"
                                required
                                placeholder="Ex: Toyota"
                                value={vehicle.brand}
                                onChange={(e) => handleVehicleChange(idx, 'brand', e.target.value)}
                                className="w-full p-2 bg-[#0B0F19] border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-[#00A3FF]"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-slate-400 font-medium mb-0.5">Modelo *</label>
                              <input
                                type="text"
                                required
                                placeholder="Ex: Corolla"
                                value={vehicle.model}
                                onChange={(e) => handleVehicleChange(idx, 'model', e.target.value)}
                                className="w-full p-2 bg-[#0B0F19] border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-[#00A3FF]"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div>
                              <label className="block text-[10px] text-slate-400 font-medium mb-0.5">Cor *</label>
                              <input
                                type="text"
                                required
                                placeholder="Ex: Prata"
                                value={vehicle.color}
                                onChange={(e) => handleVehicleChange(idx, 'color', e.target.value)}
                                className="w-full p-2 bg-[#0B0F19] border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-[#00A3FF]"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-slate-400 font-medium mb-0.5">Ano *</label>
                              <input
                                type="number"
                                required
                                placeholder="Ex: 2023"
                                value={vehicle.year}
                                onChange={(e) => handleVehicleChange(idx, 'year', e.target.value)}
                                className="w-full p-2 bg-[#0B0F19] border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-[#00A3FF]"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-slate-400 font-medium mb-0.5">Placa *</label>
                              <input
                                type="text"
                                required
                                placeholder="Ex: ABC1D23"
                                value={vehicle.plate}
                                onChange={(e) => handleVehicleChange(idx, 'plate', e.target.value.toUpperCase())}
                                className="w-full p-2 bg-[#0B0F19] border border-slate-700 rounded-lg text-white text-xs uppercase font-mono font-bold focus:outline-none focus:border-[#00A3FF]"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={handleAddVehicleField}
                      className="w-full mt-2 py-2 px-3 rounded-lg border border-[#00A3FF] text-[#00A3FF] hover:bg-[#00A3FF]/10 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> + Novo Veículo (Carro / Moto)
                    </button>
                  </div>

                  {/* Domínio do Lava-Jato a Agendar */}
                  <div className="pt-2">
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-xs font-bold text-slate-300">Domínio do Lava-Jato a Agendar *</label>
                      <button
                        type="button"
                        onClick={() => {
                          setQrScanTarget('reg');
                          setIsQrScannerOpen(true);
                        }}
                        className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-semibold cursor-pointer transition hover:underline"
                        title="Escanear QR Code da placa ou totem"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>Ler QR Code</span>
                      </button>
                    </div>
                    <div className="relative flex items-center">
                      <input 
                        type="text" 
                        value={regSubdomain}
                        onChange={(e) => setRegSubdomain(e.target.value)}
                        placeholder="Digite o domínio (Ex: autoclean)" 
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-3 pr-24 py-2.5 text-xs text-slate-100 font-bold focus:outline-none focus:border-[#00A3FF] transition font-mono"
                      />
                      <span className="absolute right-3 text-xs text-slate-500 font-mono font-bold">.saas.com</span>
                    </div>
                  </div>

                  {/* Senha */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
                        <span>Crie uma Senha para Acesso *</span>
                        <span className="inline-flex items-center gap-1 text-[10px] bg-slate-800 text-blue-400 px-1.5 py-0.5 rounded font-mono font-bold border border-blue-500/20">
                          <Shield className="w-2.5 h-2.5 text-blue-400" />
                          Segura
                        </span>
                      </label>
                    </div>
                    <div className="relative flex items-center">
                      <Lock className="w-4 h-4 absolute left-3 text-slate-500 pointer-events-none" />
                      <input 
                        type={showRegPassword ? "text" : "password"} 
                        required
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="••••••••" 
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-10 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-[#00A3FF] transition font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPassword(!showRegPassword)}
                        className="absolute right-3 p-1 text-slate-500 hover:text-slate-300 focus:outline-none cursor-pointer transition"
                        title={showRegPassword ? "Ocultar senha" : "Ver senha"}
                      >
                        {showRegPassword ? <EyeOff className="w-4 h-4 text-amber-400" /> : <Eye className="w-4 h-4 text-slate-500" />}
                      </button>
                    </div>
                  </div>

                  {/* Botão Finalizar Cadastro */}
                  <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="w-full py-3.5 px-5 rounded-xl font-bold text-slate-950 text-sm transition hover:opacity-90 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/25 mt-4"
                    style={{ background: 'linear-gradient(90deg, #00A3FF, #00FFCC)' }}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                        <span>Finalizando Cadastro no Lava-Jato...</span>
                      </>
                    ) : (
                      <>
                        <span>Finalizar Cadastro no Lava-Jato</span>
                        <Sparkles className="w-4 h-4 text-slate-950" />
                      </>
                    )}
                  </button>
                </>
              )}

              {activeTab === 'empresa' && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Nome do Lava-Jato / Empresa *</label>
                    <input 
                      type="text" 
                      required
                      value={regCompanyName}
                      onChange={(e) => handleCompanyNameChange(e.target.value)}
                      placeholder="Ex: Lava-Jato Express Pro" 
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Subdomínio Personalizado *</label>
                    <div className="relative flex items-center">
                      <input 
                        type="text" 
                        required
                        value={regSubdomain}
                        onChange={(e) => setRegSubdomain(e.target.value)}
                        placeholder="lavajatoexpress" 
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-3 pr-24 py-2.5 text-xs text-slate-100 font-bold focus:outline-none focus:border-emerald-500 transition font-mono"
                      />
                      <span className="absolute right-3 text-xs text-slate-500 font-mono font-bold">.saas.com</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">Nome do Gerente *</label>
                      <input 
                        type="text" 
                        required
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        placeholder="Marcos Silva" 
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 transition"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">E-mail Principal *</label>
                      <input 
                        type="email" 
                        required
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="contato@empresa.com" 
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Escolha seu Plano (14 dias grátis)</label>
                    <select
                      value={regPlan}
                      onChange={(e) => setRegPlan(e.target.value as 'Basic' | 'Pro' | 'Enterprise')}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 transition cursor-pointer font-medium"
                    >
                      <option value="Basic">Plano Basic - R$ 199/mês (Até 50 veículos)</option>
                      <option value="Pro">Plano Pro - R$ 499/mês (Até 500 veículos + Comissões)</option>
                      <option value="Enterprise">Plano Enterprise - R$ 1.299/mês (Ilimitado + Multi-Lojas)</option>
                    </select>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
                        <span>Crie uma Senha *</span>
                        <span className="inline-flex items-center gap-1 text-[10px] bg-slate-800 text-emerald-400 px-1.5 py-0.5 rounded font-mono font-bold border border-emerald-500/20">
                          <Shield className="w-2.5 h-2.5 text-emerald-400" />
                          Segura
                        </span>
                      </label>
                    </div>
                    <div className="relative flex items-center">
                      <Lock className="w-4 h-4 absolute left-3 text-slate-500 pointer-events-none" />
                      <input 
                        type={showRegPassword ? "text" : "password"} 
                        required
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="••••••••" 
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-10 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 transition font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPassword(!showRegPassword)}
                        className="absolute right-3 p-1 text-slate-500 hover:text-slate-300 focus:outline-none cursor-pointer transition"
                        title={showRegPassword ? "Ocultar senha" : "Ver senha"}
                      >
                        {showRegPassword ? <EyeOff className="w-4 h-4 text-amber-400" /> : <Eye className="w-4 h-4 text-slate-500" />}
                      </button>
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold py-3 rounded-xl transition shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 text-xs mt-3 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Criando Coleção no Firestore...</span>
                      </>
                    ) : (
                      <>
                        <span>Cadastrar Empresa & Entrar no Painel</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </>
              )}

              {activeTab === 'admin' && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Nome do Administrador *</label>
                    <input 
                      type="text" 
                      required
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder="Admin Master" 
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">E-mail Root *</label>
                    <input 
                      type="email" 
                      required
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="admin_super@gmail.com" 
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
                        <span>Crie uma Senha Root *</span>
                        <span className="inline-flex items-center gap-1 text-[10px] bg-slate-800 text-indigo-400 px-1.5 py-0.5 rounded font-mono font-bold border border-indigo-500/20">
                          <Shield className="w-2.5 h-2.5 text-indigo-400" />
                          Segura
                        </span>
                      </label>
                    </div>
                    <div className="relative flex items-center">
                      <Lock className="w-4 h-4 absolute left-3 text-slate-500 pointer-events-none" />
                      <input 
                        type={showRegPassword ? "text" : "password"} 
                        required
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="••••••••" 
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-10 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 transition font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPassword(!showRegPassword)}
                        className="absolute right-3 p-1 text-slate-500 hover:text-slate-300 focus:outline-none cursor-pointer transition"
                        title={showRegPassword ? "Ocultar senha" : "Ver senha"}
                      >
                        {showRegPassword ? <EyeOff className="w-4 h-4 text-amber-400" /> : <Eye className="w-4 h-4 text-slate-500" />}
                      </button>
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 text-xs mt-3 cursor-pointer"
                  >
                    <span>Criar Acesso Super Admin</span>
                    <ShieldCheck className="w-4 h-4" />
                  </button>
                </>
              )}

            </form>
          )}

          {/* Rodapé do Card */}
          <div className="pt-4 border-t border-slate-800/80 text-center text-xs text-slate-400 font-medium">
            {activeTab === 'admin' ? (
              <button 
                type="button" 
                onClick={() => handleTabChange('empresa')} 
                className="text-indigo-400 font-bold hover:underline bg-transparent border-0 cursor-pointer"
              >
                ← Voltar para Acesso Cliente / Empresa
              </button>
            ) : activeTab === 'cliente' ? (
              !isSignUp ? (
                <span>
                  Ainda não tem uma conta?{' '}
                  <button 
                    type="button" 
                    onClick={() => { setIsSignUp(true); setErrorMessage(null); }} 
                    className="text-blue-400 font-bold hover:underline bg-transparent border-0 cursor-pointer"
                  >
                    Cadastre-se grátis
                  </button>
                </span>
              ) : (
                <span>
                  Já possui uma conta?{' '}
                  <button 
                    type="button" 
                    onClick={() => { setIsSignUp(false); setErrorMessage(null); }} 
                    className="text-emerald-400 font-bold hover:underline bg-transparent border-0 cursor-pointer"
                  >
                    Faça login aqui
                  </button>
                </span>
              )
            ) : (
              <span className="text-[11px] text-slate-500">
                🔒 Acesso exclusivo para empresas cadastradas. Utilize a senha temporária fornecida pelo administrador.
              </span>
            )}
          </div>

        </div>

        {/* Link no Rodapé: Entrar com a conta do super admin (somente visível para quem procura acesso administrativo) */}
        {activeTab !== 'admin' && (
          <div className="mt-5 text-center">
            <button
              type="button"
              onClick={() => {
                handleTabChange('admin');
                setIsSignUp(false);
              }}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors inline-flex items-center gap-1.5 hover:underline cursor-pointer py-1.5 px-3 rounded-lg hover:bg-slate-900/60 border border-transparent hover:border-slate-800"
              title="Acesso restrito ao Painel Master"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
              <span>Entrar com a conta do super admin</span>
            </button>
          </div>
        )}

        {/* Modal de Leitura de QR Code */}
        <QrCodeScannerModal
          isOpen={isQrScannerOpen}
          onClose={() => setIsQrScannerOpen(false)}
          onScanSuccess={handleQrScanSuccess}
        />

      </div>

    </div>
  );
};
