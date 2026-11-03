import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  collection, 
  addDoc, 
  setDoc,
  deleteDoc,
  doc,
  query, 
  where, 
  onSnapshot, 
  serverTimestamp 
} from 'firebase/firestore';
import { 
  User, 
  Car, 
  Bike, 
  Phone, 
  MapPin, 
  Plus, 
  Trash2, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  MessageCircle, 
  Mail, 
  Tablet, 
  Smartphone, 
  Calendar,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { db } from '../lib/firebase';
import { formatCelular, formatCep, cleanDigits } from '../lib/formatters';

export interface Veiculo {
  tipo: 'Carro' | 'Moto';
  marca: string;
  modelo: string;
  cor: string;
  ano: string;
  placa: string;
}

export interface Cliente {
  id?: string;
  nomeCompleto: string;
  telefone?: string;
  email?: string;
  cep: string;
  endereco: string;
  numero?: string;
  bairro: string;
  cidade: string;
  estado: string;
  origem?: string;
  veiculos: Veiculo[];
  empresa: string;
  tenantId?: string;
  dataCadastro?: any;
}

export interface ClientesWorkspaceProps {
  tenantId: string;
  tenantNome?: string;
  tenantSlug?: string;
  tenant?: any;
  appointments?: any[];
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  backgroundColor: '#1F2937',
  border: '1px solid #374151',
  borderRadius: '8px',
  color: '#F9FAFB',
  padding: '10px 12px',
  fontSize: '14px',
  outline: 'none',
  boxSizing: 'border-box'
};

const btnPrimaryStyle: React.CSSProperties = {
  width: '100%',
  backgroundColor: '#00A3FF',
  color: '#FFFFFF',
  padding: '12px 16px',
  borderRadius: '8px',
  border: 'none',
  fontWeight: 600,
  fontSize: '14px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  marginTop: '16px'
};

const btnSecondaryStyle: React.CSSProperties = {
  width: '100%',
  backgroundColor: '#374151',
  color: '#E5E7EB',
  padding: '10px 14px',
  borderRadius: '8px',
  border: '1px solid #4B5563',
  fontWeight: 500,
  fontSize: '13px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px'
};

function normalizePlate(p?: string): string {
  return (p || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function cleanDocId(id: string): string {
  if (!id) return `doc-${Date.now()}`;
  return String(id).trim().replace(/[^a-zA-Z0-9_\-.:@]/g, '_') || `doc-${Date.now()}`;
}

/**
 * Função de mesclagem e deduplicação inteligente de clientes vindos de múltiplas fontes:
 * /clientes, /tenants/{tenantId}/clients, /usuarios, agendamentos e cache local do totem.
 */
function mergeAndDeduplicateClients(sourceGroups: any[][]): Cliente[] {
  const mapByKey = new Map<string, Cliente>();

  for (const list of sourceGroups) {
    if (!Array.isArray(list)) continue;
    for (const raw of list) {
      if (!raw) continue;
      const nomeCompleto = String(raw.nomeCompleto || raw.name || raw.nome || raw.clientName || '').trim();
      if (!nomeCompleto) continue;

      const rawPhone = String(raw.telefone || raw.phone || raw.clientPhone || '').trim();
      const phoneDigits = cleanDigits(rawPhone);
      const email = String(raw.email || raw.clientEmail || '').trim().toLowerCase();

      // Extração e normalização de veículos
      let rawVehicles: any[] = [];
      if (Array.isArray(raw.veiculos) && raw.veiculos.length > 0) {
        rawVehicles = raw.veiculos;
      } else if (raw.vehicle) {
        if (typeof raw.vehicle === 'object') {
          rawVehicles = [raw.vehicle];
        } else if (typeof raw.vehicle === 'string') {
          const parts = raw.vehicle.trim().split(' ');
          rawVehicles = [{
            tipo: 'Carro',
            marca: parts[0] || 'Geral',
            modelo: raw.vehicle,
            placa: raw.plate || raw.placa || ''
          }];
        }
      } else if (raw.plate || raw.placa) {
        rawVehicles = [{
          tipo: 'Carro',
          marca: 'Geral',
          modelo: 'Veículo',
          placa: raw.plate || raw.placa || ''
        }];
      }

      const formattedVehicles: Veiculo[] = rawVehicles
        .filter(v => v && (v.marca || v.modelo || v.placa))
        .map(v => ({
          tipo: v.tipo ? (String(v.tipo).toLowerCase().includes('moto') ? 'Moto' : 'Carro') : 'Carro',
          marca: String(v.marca || v.brand || 'Geral').trim(),
          modelo: String(v.modelo || v.model || 'Veículo').trim(),
          cor: String(v.cor || v.color || '').trim(),
          ano: String(v.ano || v.year || '').trim(),
          placa: String(v.placa || v.plate || '').toUpperCase().trim()
        }));

      // Chave única para evitar duplicatas:
      // 1º Telefone com DDD (últimos 9 dígitos)
      // 2º E-mail
      // 3º Nome normalizado + Primeira Placa
      let dedupeKey = '';
      if (phoneDigits && phoneDigits.length >= 8) {
        dedupeKey = `tel_${phoneDigits.slice(-9)}`;
      } else if (email && email.includes('@')) {
        dedupeKey = `mail_${email}`;
      } else {
        const normName = nomeCompleto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
        const firstPlate = formattedVehicles.find(v => v.placa)?.placa || '';
        dedupeKey = `name_${normName}_${normalizePlate(firstPlate)}`;
      }

      const existing = mapByKey.get(dedupeKey);
      if (!existing) {
        mapByKey.set(dedupeKey, {
          id: raw.id || raw.uid || `c-${dedupeKey}`,
          nomeCompleto,
          telefone: rawPhone,
          email,
          cep: raw.cep || '',
          endereco: raw.endereco || raw.address || '',
          numero: raw.numero || raw.number || '',
          bairro: raw.bairro || raw.neighborhood || '',
          cidade: raw.cidade || raw.city || '',
          estado: raw.estado || raw.state || raw.stateUf || '',
          origem: raw.origem || (raw.origin ? String(raw.origin) : 'Balcão / Nuvem'),
          veiculos: formattedVehicles,
          empresa: raw.empresa || raw.tenantId || '',
          tenantId: raw.tenantId || raw.empresa || '',
          dataCadastro: raw.dataCadastro || raw.createdAt || raw.updatedAt || new Date().toISOString()
        });
      } else {
        // Enriquecimento com dados adicionais
        if (!existing.telefone && rawPhone) existing.telefone = rawPhone;
        if (!existing.email && email) existing.email = email;
        if (!existing.endereco && (raw.endereco || raw.address)) existing.endereco = raw.endereco || raw.address;
        if (!existing.cep && raw.cep) existing.cep = raw.cep;
        if (!existing.cidade && (raw.cidade || raw.city)) existing.cidade = raw.cidade || raw.city;
        if (!existing.bairro && (raw.bairro || raw.neighborhood)) existing.bairro = raw.bairro || raw.neighborhood;
        if (!existing.estado && (raw.estado || raw.stateUf)) existing.estado = raw.estado || raw.stateUf;
        
        // Prioriza origem detalhada
        if (raw.origem && (!existing.origem || existing.origem === 'Balcão / Nuvem')) {
          existing.origem = raw.origem;
        }

        // Adiciona veículos sem duplicar placas iguais
        for (const newV of formattedVehicles) {
          const normP = normalizePlate(newV.placa);
          const existsPlate = normP && existing.veiculos.some(v => normalizePlate(v.placa) === normP);
          if (!existsPlate && (newV.marca || newV.modelo || newV.placa)) {
            existing.veiculos.push(newV);
          }
        }
      }
    }
  }

  const result = Array.from(mapByKey.values());
  // Ordena por data de cadastro decrescente (mais recentes primeiro)
  result.sort((a, b) => {
    const tA = a.dataCadastro?.toMillis ? a.dataCadastro.toMillis() : (a.dataCadastro ? new Date(a.dataCadastro).getTime() : 0);
    const tB = b.dataCadastro?.toMillis ? b.dataCadastro.toMillis() : (b.dataCadastro ? new Date(b.dataCadastro).getTime() : 0);
    return tB - tA;
  });

  return result;
}

export const ClientesWorkspace: React.FC<ClientesWorkspaceProps> = ({ 
  tenantId, 
  tenantNome,
  tenantSlug,
  tenant,
  appointments = []
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [busca, setBusca] = useState<string>('');
  
  // Estados para as fontes de dados em tempo real
  const [clientesDb, setClientesDb] = useState<any[]>([]);
  const [subcollectionDb, setSubcollectionDb] = useState<any[]>([]);
  const [usuariosDb, setUsuariosDb] = useState<any[]>([]);
  const [localTotemClients, setLocalTotemClients] = useState<any[]>([]);
  const [realtimeAppointments, setRealtimeAppointments] = useState<any[]>([]);

  // Feedback
  const [feedback, setFeedback] = useState<{ tipo: 'sucesso' | 'erro'; mensagem: string } | null>(null);
  const [isBuscandoCep, setIsBuscandoCep] = useState<boolean>(false);
  const [isSalvando, setIsSalvando] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Estados para o Formulário de Cadastro Manual/Interno (Balcão)
  const [nomeCompleto, setNomeCompleto] = useState('');
  const [telefone, setTelefone] = useState('');
  const [emailForm, setEmailForm] = useState('');
  const [cep, setCep] = useState('');
  const [endereco, setEndereco] = useState('');
  const [numero, setNumero] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('');

  // Estado para a lista dinâmica de veículos no formulário
  const [veiculos, setVeiculos] = useState<Veiculo[]>([
    { tipo: 'Carro', marca: '', modelo: '', cor: '', ano: '', placa: '' }
  ]);

  // Limpa feedback após 4 segundos
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  // Computa slugs alternativos para queries resilientes
  const cleanTenantSlug = useMemo(() => {
    const raw = tenantSlug || tenant?.slug || tenantNome || '';
    return raw
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
  }, [tenantSlug, tenant?.slug, tenantNome]);

  const cleanTId = useMemo(() => cleanDocId(tenantId), [tenantId]);

  // Carrega clientes do cache local do Totem e perfis salvos
  const loadLocalClients = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      const allLocal: any[] = [];
      
      // 1. Totem tablet cache
      const rawTotem = localStorage.getItem(`saas_totem_clients_${tenantId}`);
      if (rawTotem) {
        const parsed = JSON.parse(rawTotem);
        if (Array.isArray(parsed)) allLocal.push(...parsed);
      }
      if (cleanTId !== tenantId) {
        const rawTotemClean = localStorage.getItem(`saas_totem_clients_${cleanTId}`);
        if (rawTotemClean) {
          const parsed = JSON.parse(rawTotemClean);
          if (Array.isArray(parsed)) allLocal.push(...parsed);
        }
      }

      // 2. Client profile
      const rawProfile = localStorage.getItem(`saas_client_profile_${tenantId}`);
      if (rawProfile) {
        const p = JSON.parse(rawProfile);
        if (p.name) {
          const rawVeh = localStorage.getItem(`saas_client_vehicles_${tenantId}`);
          allLocal.push({
            nomeCompleto: p.name,
            telefone: p.phone,
            email: p.email,
            origem: 'Aplicativo / PWA',
            veiculos: rawVeh ? JSON.parse(rawVeh) : []
          });
        }
      }

      setLocalTotemClients(allLocal);
    } catch (_) {}
  }, [tenantId, cleanTId]);

  // 1. ESCUTA EM TEMPO REAL MULTI-COLEÇÃO DO FIRESTORE
  useEffect(() => {
    if (!tenantId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    loadLocalClients();

    const unsubscribers: (() => void)[] = [];

    // A) Escuta na coleção raiz '/clientes' por 'empresa' == tenantId
    try {
      const qClientesTenantId = query(
        collection(db, 'clientes'),
        where('empresa', '==', tenantId)
      );
      const unsub1 = onSnapshot(qClientesTenantId, (snapshot) => {
        const items: any[] = [];
        snapshot.forEach((docSnap) => items.push({ id: docSnap.id, ...docSnap.data() }));
        setClientesDb(prev => {
          const others = prev.filter(x => x._source !== 'empresa_tenantId');
          return [...others, ...items.map(i => ({ ...i, _source: 'empresa_tenantId' }))];
        });
        setLoading(false);
      }, (err) => console.warn('Erro na consulta /clientes por tenantId:', err));
      unsubscribers.push(unsub1);
    } catch (_) {}

    // B) Escuta na coleção raiz '/clientes' por slug se for diferente do tenantId (ex: box1000)
    if (cleanTenantSlug && cleanTenantSlug !== tenantId) {
      try {
        const qClientesSlug = query(
          collection(db, 'clientes'),
          where('empresa', '==', cleanTenantSlug)
        );
        const unsub2 = onSnapshot(qClientesSlug, (snapshot) => {
          const items: any[] = [];
          snapshot.forEach((docSnap) => items.push({ id: docSnap.id, ...docSnap.data() }));
          setClientesDb(prev => {
            const others = prev.filter(x => x._source !== 'empresa_slug');
            return [...others, ...items.map(i => ({ ...i, _source: 'empresa_slug' }))];
          });
        }, (err) => console.warn('Erro na consulta /clientes por slug:', err));
        unsubscribers.push(unsub2);
      } catch (_) {}

      try {
        const qClientesTSlug = query(
          collection(db, 'clientes'),
          where('empresa', '==', `t-${cleanTenantSlug}`)
        );
        const unsub3 = onSnapshot(qClientesTSlug, (snapshot) => {
          const items: any[] = [];
          snapshot.forEach((docSnap) => items.push({ id: docSnap.id, ...docSnap.data() }));
          setClientesDb(prev => {
            const others = prev.filter(x => x._source !== 'empresa_tslug');
            return [...others, ...items.map(i => ({ ...i, _source: 'empresa_tslug' }))];
          });
        }, (err) => console.warn('Erro na consulta /clientes por t-slug:', err));
        unsubscribers.push(unsub3);
      } catch (_) {}
    }

    // C) Escuta na subcoleção do lava-jato '/tenants/{cleanTId}/clients'
    try {
      const colSubRef = collection(db, 'tenants', cleanTId, 'clients');
      const unsubSub = onSnapshot(colSubRef, (snapshot) => {
        const items: any[] = [];
        snapshot.forEach((docSnap) => items.push({ id: docSnap.id, ...docSnap.data() }));
        setSubcollectionDb(items);
        setLoading(false);
      }, (err) => console.warn('Erro ao escutar subcoleção tenants/clients:', err));
      unsubscribers.push(unsubSub);
    } catch (_) {}

    // D) Escuta em '/usuarios' com role == 'cliente'
    try {
      const qUsuarios = query(
        collection(db, 'usuarios'),
        where('role', '==', 'cliente')
      );
      const unsubUsers = onSnapshot(qUsuarios, (snapshot) => {
        const items: any[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          const matches = d.tenantId === tenantId || 
                          d.tenantId === cleanTId || 
                          d.empresaId === tenantId || 
                          d.empresaId === cleanTId ||
                          (cleanTenantSlug && (d.tenantId === cleanTenantSlug || d.empresaId === cleanTenantSlug));
          if (matches) {
            items.push({ id: docSnap.id, ...d });
          }
        });
        setUsuariosDb(items);
      }, (err) => console.warn('Erro ao escutar usuarios:', err));
      unsubscribers.push(unsubUsers);
    } catch (_) {}

    // E) Escuta em tempo real em '/tenants/{cleanTId}/appointments'
    try {
      const colAppRef = collection(db, 'tenants', cleanTId, 'appointments');
      const unsubApps = onSnapshot(colAppRef, (snapshot) => {
        const items: any[] = [];
        snapshot.forEach((docSnap) => items.push({ id: docSnap.id, ...docSnap.data() }));
        setRealtimeAppointments(items);
      }, (err) => console.warn('Erro ao escutar agendamentos para clientes:', err));
      unsubscribers.push(unsubApps);
    } catch (_) {}

    // Escuta evento de storage para sincronização instantânea de totem
    const handleStorageEvent = () => loadLocalClients();
    window.addEventListener('storage', handleStorageEvent);
    window.addEventListener('saas_data_sync', handleStorageEvent);

    return () => {
      unsubscribers.forEach(unsub => unsub());
      window.removeEventListener('storage', handleStorageEvent);
      window.removeEventListener('saas_data_sync', handleStorageEvent);
    };
  }, [tenantId, cleanTId, cleanTenantSlug, loadLocalClients]);

  // Agrega e deduplica todas as fontes em uma lista única
  const clientes = useMemo(() => {
    return mergeAndDeduplicateClients([
      clientesDb,
      subcollectionDb,
      usuariosDb,
      realtimeAppointments,
      appointments,
      localTotemClients
    ]);
  }, [clientesDb, subcollectionDb, usuariosDb, realtimeAppointments, appointments, localTotemClients]);

  // Ação manual de recarregar dados
  const handleManualRefresh = () => {
    setIsRefreshing(true);
    loadLocalClients();
    setTimeout(() => {
      setIsRefreshing(false);
      setFeedback({ tipo: 'sucesso', mensagem: 'Base de clientes atualizada com a nuvem!' });
    }, 600);
  };

  // 2. BUSCA AUTOMÁTICA DE CEP VIA API
  const handleBuscarCEP = async (cepValue: string) => {
    const limpo = cleanDigits(cepValue).slice(0, 8);
    if (limpo.length !== 8) return;

    setIsBuscandoCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${limpo}/json/`);
      const dados = await response.json();
      if (!dados.erro) {
        setCep(formatCep(limpo));
        setEndereco(dados.logradouro || '');
        setBairro(dados.bairro || '');
        setCidade(dados.localidade || '');
        setEstado(dados.uf || '');
      } else {
        setFeedback({ tipo: 'erro', mensagem: 'CEP não encontrado no ViaCEP.' });
      }
    } catch (err) {
      console.error("Erro ao buscar CEP:", err);
      setFeedback({ tipo: 'erro', mensagem: 'Não foi possível consultar o CEP automaticamente.' });
    } finally {
      setIsBuscandoCep(false);
    }
  };

  // 3. ADICIONAR / REMOVER CAMPO DE VEÍCULO DINAMICAMENTE
  const handleAddVehicleField = () => {
    setVeiculos([...veiculos, { tipo: 'Carro', marca: '', modelo: '', cor: '', ano: '', placa: '' }]);
  };

  const handleRemoveVehicleField = (indexToRemove: number) => {
    if (veiculos.length <= 1) return;
    setVeiculos(veiculos.filter((_, idx) => idx !== indexToRemove));
  };

  const handleVehicleChange = (index: number, field: keyof Veiculo, value: string) => {
    const novosVeiculos = [...veiculos];
    novosVeiculos[index][field] = value as any;
    setVeiculos(novosVeiculos);
  };

  // 4. SALVAR CADASTRO MANUAL NO FIRESTORE
  const handleCadastrarCliente = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nomeCompleto.trim()) {
      setFeedback({ tipo: 'erro', mensagem: 'Por favor, informe o nome completo do cliente.' });
      return;
    }

    setIsSalvando(true);

    try {
      const veiculosFormatados = veiculos
        .filter(v => v.marca.trim() || v.modelo.trim() || v.placa.trim())
        .map(v => ({
          tipo: v.tipo || 'Carro',
          marca: v.marca.trim() || 'Geral',
          modelo: v.modelo.trim() || 'Veículo',
          cor: v.cor.trim(),
          ano: v.ano.trim(),
          placa: (v.placa || '').toUpperCase().trim()
        }));

      const finalVeiculos = veiculosFormatados.length > 0 ? veiculosFormatados : [
        { tipo: 'Carro' as const, marca: 'Geral', modelo: 'Veículo', cor: 'Padrão', ano: '2024', placa: 'BR-0000' }
      ];

      const cleanPhoneDigits = cleanDigits(telefone);
      const cleanClientId = cleanPhoneDigits && cleanPhoneDigits.length >= 8
        ? cleanPhoneDigits
        : `c-${Date.now()}`;

      const novoCliente = {
        id: cleanClientId,
        empresa: tenantId,
        tenantId: tenantId,
        empresaId: tenantId,
        nomeCompleto: nomeCompleto.trim(),
        telefone: formatCelular(telefone.trim()),
        email: emailForm.trim().toLowerCase(),
        cep: formatCep(cep.trim()),
        endereco: endereco.trim(),
        numero: numero.trim(),
        bairro: bairro.trim(),
        cidade: cidade.trim(),
        estado: estado.trim().toUpperCase(),
        origem: 'Balcão da Empresa',
        veiculos: finalVeiculos,
        dataCadastro: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Salva em /clientes e na subcoleção /tenants/{tenantId}/clients
      await setDoc(doc(db, 'clientes', cleanClientId), novoCliente, { merge: true });
      await setDoc(doc(db, 'tenants', cleanTId, 'clients', cleanClientId), novoCliente, { merge: true });
      
      // Limpa o formulário após o sucesso
      setNomeCompleto('');
      setTelefone('');
      setEmailForm('');
      setCep('');
      setEndereco('');
      setNumero('');
      setBairro('');
      setCidade('');
      setEstado('');
      setVeiculos([{ tipo: 'Carro', marca: '', modelo: '', cor: '', ano: '', placa: '' }]);
      
      setFeedback({ tipo: 'sucesso', mensagem: 'Cliente e veículos cadastrados com sucesso na Nuvem!' });
    } catch (error) {
      console.error("Erro ao salvar cliente no Firestore:", error);
      setFeedback({ tipo: 'erro', mensagem: 'Erro ao salvar no banco de dados Firestore.' });
    } finally {
      setIsSalvando(false);
    }
  };

  // 5. EXCLUIR CLIENTE DO BANCO
  const handleExcluirCliente = async (clienteId?: string) => {
    if (!clienteId) return;
    try {
      await deleteDoc(doc(db, 'clientes', clienteId));
      try {
        await deleteDoc(doc(db, 'tenants', cleanTId, 'clients', clienteId));
      } catch (_) {}

      // Limpa se estava no cache do totem
      try {
        const rawTotem = localStorage.getItem(`saas_totem_clients_${tenantId}`);
        if (rawTotem) {
          const list = JSON.parse(rawTotem);
          const filtered = list.filter((c: any) => c.id !== clienteId && c.uid !== clienteId);
          localStorage.setItem(`saas_totem_clients_${tenantId}`, JSON.stringify(filtered));
        }
      } catch (_) {}

      setFeedback({ tipo: 'sucesso', mensagem: 'Ficha do cliente excluída da nuvem.' });
    } catch (err) {
      console.error('Erro ao excluir cliente:', err);
      setFeedback({ tipo: 'erro', mensagem: 'Não foi possível excluir o cliente.' });
    }
  };

  // Filtro de busca de clientes (por Nome, Placa, Modelo, Marca, Telefone ou E-mail)
  const clientesFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return clientes;

    return clientes.filter(c => {
      const matchNome = (c.nomeCompleto || '').toLowerCase().includes(termo);
      const matchTel = (c.telefone || '').toLowerCase().includes(termo);
      const matchEmail = (c.email || '').toLowerCase().includes(termo);
      const matchPlacaOuModelo = c.veiculos?.some(v => 
        (v.placa || '').toLowerCase().includes(termo) ||
        (v.modelo || '').toLowerCase().includes(termo) ||
        (v.marca || '').toLowerCase().includes(termo)
      );
      return matchNome || matchTel || matchEmail || matchPlacaOuModelo;
    });
  }, [clientes, busca]);

  // Helper para renderizar badge de origem
  const renderOrigemBadge = (origem?: string) => {
    const orig = (origem || '').toLowerCase();
    if (orig.includes('totem')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
          <Tablet className="w-3 h-3 text-purple-400" />
          Totem Tablet
        </span>
      );
    }
    if (orig.includes('aplicativo') || orig.includes('pwa') || orig.includes('app')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
          <Smartphone className="w-3 h-3 text-cyan-400" />
          App Celular
        </span>
      );
    }
    if (orig.includes('agendamento')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
          <Calendar className="w-3 h-3 text-amber-400" />
          Agendamento Online
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30">
        <User className="w-3 h-3 text-blue-400" />
        Balcão
      </span>
    );
  };

  return (
    <div style={{ backgroundColor: '#0B0F19', color: '#F3F4F6', padding: '24px', minHeight: '100vh', boxSizing: 'border-box' }}>
      
      {/* CABEÇALHO */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '24px' }}>
        <div>
          <h1 style={{ color: '#FFF', fontSize: '24px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <User style={{ color: '#00A3FF', width: '26px', height: '26px' }} />
            Gestão de Clientes & Balcão
          </h1>
          <p style={{ color: '#9CA3AF', fontSize: '13px', margin: '4px 0 0 0' }}>
            Cadastro unificado em tempo real: clientes do Balcão, do Totem de autoatendimento, do Aplicativo e de Agendamentos.
          </p>
        </div>

        {/* CONTADOR TOTAL & BOTÃO ATUALIZAR */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer active:scale-95"
            title="Recarregar clientes da nuvem"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-cyan-400' : 'text-slate-400'}`} />
            <span>Atualizar</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#111827', border: '1px solid #1F2937', padding: '8px 16px', borderRadius: '10px' }}>
            <span style={{ fontSize: '12px', color: '#9CA3AF' }}>Total cadastrados:</span>
            <span style={{ fontSize: '16px', fontWeight: 700, color: '#00A3FF' }}>{clientes.length}</span>
          </div>
        </div>
      </div>

      {/* BANNER DE FEEDBACK / AVISO */}
      {feedback && (
        <div style={{
          backgroundColor: feedback.tipo === 'sucesso' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
          border: `1px solid ${feedback.tipo === 'sucesso' ? '#10B981' : '#EF4444'}`,
          color: feedback.tipo === 'sucesso' ? '#34D399' : '#F87171',
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '14px'
        }}>
          {feedback.tipo === 'sucesso' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{feedback.mensagem}</span>
        </div>
      )}

      {/* GRID PRINCIPAL */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
        
        {/* COLUNA ESQUERDA: FORMULÁRIO DE CADASTRO INTERNO (BALCÃO) */}
        <div style={{ backgroundColor: '#111827', border: '1px solid #1F2937', borderRadius: '12px', padding: '24px' }}>
          <h2 style={{ color: '#FFF', fontSize: '17px', fontWeight: 600, marginBottom: '16px', borderBottom: '1px solid #1F2937', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus style={{ color: '#00A3FF', width: '18px', height: '18px' }} />
            Cadastrar Novo Cliente (Balcão)
          </h2>
          
          <form onSubmit={handleCadastrarCliente}>
            {/* Nome Completo */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '13px', color: '#9CA3AF', marginBottom: '4px', fontWeight: 500 }}>
                Nome Completo *
              </label>
              <input 
                type="text" 
                placeholder="Ex: João da Silva"
                value={nomeCompleto} 
                onChange={e => setNomeCompleto(e.target.value)} 
                required 
                style={inputStyle} 
              />
            </div>

            {/* Telefone e E-mail */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '13px', color: '#9CA3AF', marginBottom: '4px', fontWeight: 500 }}>
                  WhatsApp / Celular
                </label>
                <input 
                  type="tel" 
                  placeholder="(11) 98765-4321"
                  maxLength={15}
                  value={telefone} 
                  onChange={e => setTelefone(formatCelular(e.target.value))} 
                  style={inputStyle} 
                />
              </div>

              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '13px', color: '#9CA3AF', marginBottom: '4px', fontWeight: 500 }}>
                  E-mail (Opcional)
                </label>
                <input 
                  type="email" 
                  placeholder="cliente@email.com"
                  value={emailForm} 
                  onChange={e => setEmailForm(e.target.value)} 
                  style={inputStyle} 
                />
              </div>
            </div>

            {/* CEP e Endereço */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '13px', color: '#9CA3AF', marginBottom: '4px', fontWeight: 500 }}>
                  CEP {isBuscandoCep && <span style={{ color: '#00A3FF', fontSize: '11px' }}>(buscando...)</span>}
                </label>
                <input 
                  type="text" 
                  value={cep} 
                  maxLength={9} 
                  onBlur={e => handleBuscarCEP(e.target.value)} 
                  onChange={e => {
                    const formatted = formatCep(e.target.value);
                    setCep(formatted);
                    if (cleanDigits(formatted).length === 8) {
                      handleBuscarCEP(formatted);
                    }
                  }} 
                  style={inputStyle} 
                  placeholder="00000-000" 
                />
              </div>

              <div style={{ flex: 2 }}>
                <label style={{ display: 'block', fontSize: '13px', color: '#9CA3AF', marginBottom: '4px', fontWeight: 500 }}>
                  Endereço
                </label>
                <input 
                  type="text" 
                  placeholder="Rua / Avenida"
                  value={endereco} 
                  onChange={e => setEndereco(e.target.value)} 
                  style={inputStyle} 
                />
              </div>
            </div>

            {/* Bairro, Cidade, UF e Número */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <div style={{ flex: 2 }}>
                <label style={{ display: 'block', fontSize: '13px', color: '#9CA3AF', marginBottom: '4px', fontWeight: 500 }}>Bairro</label>
                <input type="text" placeholder="Bairro" value={bairro} onChange={e => setBairro(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ flex: 2 }}>
                <label style={{ display: 'block', fontSize: '13px', color: '#9CA3AF', marginBottom: '4px', fontWeight: 500 }}>Cidade</label>
                <input type="text" placeholder="Cidade" value={cidade} onChange={e => setCidade(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '13px', color: '#9CA3AF', marginBottom: '4px', fontWeight: 500 }}>UF</label>
                <input type="text" placeholder="SP" value={estado} maxLength={2} onChange={e => setEstado(e.target.value.toUpperCase())} style={inputStyle} />
              </div>
            </div>

            {/* VEÍCULOS */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <h3 style={{ color: '#FFF', fontSize: '14px', margin: 0, fontWeight: 600 }}>Veículo(s) do Cliente</h3>
              <span style={{ fontSize: '12px', color: '#9CA3AF' }}>{veiculos.length} veículo(s)</span>
            </div>

            {veiculos.map((v, index) => (
              <div 
                key={index} 
                style={{ 
                  backgroundColor: '#1F2937', 
                  padding: '12px', 
                  borderRadius: '8px', 
                  marginBottom: '12px', 
                  borderLeft: '4px solid #00A3FF',
                  position: 'relative'
                }}
              >
                {/* Linha 1: Tipo, Marca, Modelo e botão excluir veículo */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                  <select 
                    value={v.tipo} 
                    onChange={e => handleVehicleChange(index, 'tipo', e.target.value)} 
                    style={{ ...inputStyle, width: '90px' }}
                  >
                    <option value="Carro">Carro</option>
                    <option value="Moto">Moto</option>
                  </select>
                  <input 
                    type="text" 
                    placeholder="Marca (ex: Fiat)" 
                    value={v.marca} 
                    onChange={e => handleVehicleChange(index, 'marca', e.target.value)} 
                    style={inputStyle} 
                  />
                  <input 
                    type="text" 
                    placeholder="Modelo (ex: Argo)" 
                    value={v.modelo} 
                    onChange={e => handleVehicleChange(index, 'modelo', e.target.value)} 
                    style={inputStyle} 
                  />
                  {veiculos.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveVehicleField(index)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#EF4444',
                        cursor: 'pointer',
                        padding: '6px'
                      }}
                      title="Remover veículo"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>

                {/* Linha 2: Cor, Ano e Placa */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    type="text" 
                    placeholder="Cor" 
                    value={v.cor} 
                    onChange={e => handleVehicleChange(index, 'cor', e.target.value)} 
                    style={inputStyle} 
                  />
                  <input 
                    type="text" 
                    placeholder="Ano" 
                    value={v.ano} 
                    onChange={e => handleVehicleChange(index, 'ano', e.target.value)} 
                    style={{ ...inputStyle, width: '80px' }} 
                  />
                  <input 
                    type="text" 
                    placeholder="Placa (BRA2E19)" 
                    value={v.placa} 
                    onChange={e => handleVehicleChange(index, 'placa', e.target.value.toUpperCase())} 
                    style={{ ...inputStyle, fontWeight: 700, letterSpacing: '0.5px' }} 
                  />
                </div>
              </div>
            ))}

            <button 
              type="button" 
              onClick={handleAddVehicleField} 
              style={btnSecondaryStyle}
            >
              <Plus size={14} /> Adicionar Outro Veículo
            </button>

            <button 
              type="submit" 
              disabled={isSalvando}
              style={{ ...btnPrimaryStyle, opacity: isSalvando ? 0.7 : 1 }}
            >
              {isSalvando ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Salvando na Nuvem...
                </>
              ) : (
                'Salvar Cadastro no Banco'
              )}
            </button>
          </form>
        </div>

        {/* COLUNA DIREITA: LISTAGEM UNIFICADA EM TEMPO REAL */}
        <div style={{ backgroundColor: '#111827', border: '1px solid #1F2937', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column' }}>
          
          <div style={{ borderBottom: '1px solid #1F2937', paddingBottom: '12px', marginBottom: '16px' }}>
            <div className="flex items-center justify-between gap-2">
              <h2 style={{ color: '#FFF', fontSize: '17px', fontWeight: 600, margin: 0 }}>
                Clientes Cadastrados ({clientesFiltrados.length})
              </h2>
              <span className="text-[11px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Tempo Real
              </span>
            </div>
            <p style={{ color: '#9CA3AF', fontSize: '12px', margin: '4px 0 0 0' }}>
              Sincronizado automaticamente com Totem, Aplicativo, Agendamentos e Balcão.
            </p>

            {/* BARRA DE PESQUISA */}
            <div style={{ marginTop: '12px', position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#6B7280' }} />
              <input 
                type="text"
                placeholder="Buscar por cliente, placa, telefone, e-mail ou modelo..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
                style={{ ...inputStyle, paddingLeft: '36px' }}
              />
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#9CA3AF', fontStyle: 'italic', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <Loader2 size={24} className="animate-spin text-cyan-400" />
              <span>Sincronizando clientes da nuvem em tempo real...</span>
            </div>
          ) : clientesFiltrados.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 16px', color: '#6B7280', fontStyle: 'italic' }}>
              {busca ? 'Nenhum cliente corresponde ao filtro de busca.' : 'Nenhum cliente cadastrado neste lava-jato ainda. Registros feitos no Totem, Aplicativo ou Agendamento aparecerão aqui automaticamente!'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '600px', overflowY: 'auto', paddingRight: '4px' }}>
              {clientesFiltrados.map((cliente) => (
                <div 
                  key={cliente.id} 
                  style={{ 
                    backgroundColor: '#1F2937', 
                    border: '1px solid #374151', 
                    padding: '16px', 
                    borderRadius: '10px',
                    transition: 'border-color 0.2s'
                  }}
                  className="hover:border-cyan-500/40"
                >
                  {/* CABEÇALHO DO CARD DO CLIENTE */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 style={{ color: '#FFFFFF', fontSize: '15px', fontWeight: 600, margin: 0 }}>
                          {cliente.nomeCompleto}
                        </h4>
                        {renderOrigemBadge(cliente.origem)}
                      </div>

                      {/* CONTATOS: TELEFONE / WHATSAPP & EMAIL */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-1.5">
                        {cliente.telefone && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <Phone size={12} style={{ color: '#00A3FF' }} />
                            <span style={{ fontSize: '12px', color: '#9CA3AF', fontFamily: 'monospace' }}>
                              {formatCelular(cliente.telefone)}
                            </span>
                            <a 
                              href={`https://wa.me/55${cleanDigits(cliente.telefone)}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              style={{ 
                                color: '#22C55E', 
                                fontSize: '11px', 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: '3px', 
                                marginLeft: '4px',
                                textDecoration: 'none',
                                fontWeight: 600
                              }}
                            >
                              <MessageCircle size={12} /> WhatsApp
                            </a>
                          </div>
                        )}

                        {cliente.email && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <Mail size={12} style={{ color: '#A855F7' }} />
                            <a
                              href={`mailto:${cliente.email}`}
                              style={{ fontSize: '12px', color: '#CBD5E1', textDecoration: 'none' }}
                              className="hover:underline"
                            >
                              {cliente.email}
                            </a>
                          </div>
                        )}
                      </div>

                    </div>

                    {/* BOTÃO EXCLUIR */}
                    <button
                      onClick={() => handleExcluirCliente(cliente.id)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#6B7280',
                        cursor: 'pointer',
                        padding: '4px',
                        borderRadius: '4px'
                      }}
                      className="hover:text-red-400 transition"
                      title="Excluir cadastro do cliente"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  {/* ENDEREÇO */}
                  {(cliente.endereco || cliente.cidade) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#9CA3AF', marginBottom: '10px' }}>
                      <MapPin size={12} style={{ color: '#F59E0B', flexShrink: 0 }} />
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {[cliente.endereco, cliente.numero ? `Nº ${cliente.numero}` : '', cliente.bairro, cliente.cidade ? `${cliente.cidade}/${cliente.estado}` : ''].filter(Boolean).join(' - ')}
                        {cliente.cep && ` (CEP: ${formatCep(cliente.cep)})`}
                      </span>
                    </div>
                  )}

                  {/* VEÍCULOS CADASTRADOS */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px', borderTop: '1px solid #2D3748', paddingTop: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Veículos ({cliente.veiculos?.length || 0}):
                    </span>
                    
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {cliente.veiculos && cliente.veiculos.length > 0 ? (
                        cliente.veiculos.map((v, vIdx) => (
                          <div 
                            key={vIdx}
                            style={{
                              backgroundColor: '#111827',
                              border: '1px solid #374151',
                              borderRadius: '6px',
                              padding: '6px 10px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              fontSize: '12px'
                            }}
                          >
                            {v.tipo === 'Moto' ? (
                              <Bike size={14} style={{ color: '#F59E0B' }} />
                            ) : (
                              <Car size={14} style={{ color: '#00A3FF' }} />
                            )}
                            <span style={{ color: '#E5E7EB', fontWeight: 500 }}>
                              {v.marca} {v.modelo} {v.cor && `(${v.cor})`}
                            </span>
                            <span style={{ 
                              backgroundColor: '#0F172A', 
                              border: '1px solid #00A3FF', 
                              color: '#38BDF8', 
                              padding: '2px 6px', 
                              borderRadius: '4px', 
                              fontWeight: 700, 
                              fontSize: '11px' 
                            }}>
                              {v.placa || 'SEM PLACA'}
                            </span>
                          </div>
                        ))
                      ) : (
                        <span style={{ fontSize: '12px', color: '#6B7280', fontStyle: 'italic' }}>
                          Nenhum veículo registrado
                        </span>
                      )}
                    </div>
                  </div>

                </div>
              ))}
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
