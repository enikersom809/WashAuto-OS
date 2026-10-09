import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  addDoc, 
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
  ExternalLink,
  MessageCircle,
  Calendar
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
  cep: string;
  endereco: string;
  numero?: string;
  bairro: string;
  cidade: string;
  estado: string;
  veiculos: Veiculo[];
  empresa: string;
  dataCadastro?: any;
}

export interface ClientesWorkspaceProps {
  tenantId: string; // Passado via props após o login do tenant
  tenantNome?: string;
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

export const ClientesWorkspace: React.FC<ClientesWorkspaceProps> = ({ tenantId, tenantNome }) => {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [busca, setBusca] = useState<string>('');
  
  // Feedback
  const [feedback, setFeedback] = useState<{ tipo: 'sucesso' | 'erro'; mensagem: string } | null>(null);
  const [isBuscandoCep, setIsBuscandoCep] = useState<boolean>(false);
  const [isSalvando, setIsSalvando] = useState<boolean>(false);

  // Estados para o Formulário de Cadastro Manual/Interno (Balcão)
  const [nomeCompleto, setNomeCompleto] = useState('');
  const [telefone, setTelefone] = useState('');
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

  // 1. ESCUTA EM TEMPO REAL DOS CLIENTES DESTE LAVA-JATO NO FIRESTORE (/clientes)
  useEffect(() => {
    if (!tenantId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // Consulta os clientes pertencentes a esta empresa
    const q = query(
      collection(db, 'clientes'),
      where('empresa', '==', tenantId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const listaClientes: Cliente[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        listaClientes.push({ 
          id: docSnap.id, 
          ...data,
          veiculos: Array.isArray(data.veiculos) ? data.veiculos : []
        } as Cliente);
      });

      // Ordena de forma segura em memória (mais recentes primeiro)
      listaClientes.sort((a, b) => {
        const tA = a.dataCadastro?.toMillis ? a.dataCadastro.toMillis() : (a.dataCadastro ? new Date(a.dataCadastro).getTime() : 0);
        const tB = b.dataCadastro?.toMillis ? b.dataCadastro.toMillis() : (b.dataCadastro ? new Date(b.dataCadastro).getTime() : 0);
        return tB - tA;
      });

      setClientes(listaClientes);
      setLoading(false);
    }, (error) => {
      console.error("Erro ao escutar clientes do Firestore:", error);
      setFeedback({ tipo: 'erro', mensagem: 'Falha ao sincronizar clientes da nuvem.' });
      setLoading(false);
    });

    return () => unsubscribe();
  }, [tenantId]);

  // 2. BUSCA AUTOMÁTICA DE CEP VIA API (ViaCEP corrigido)
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
          marca: v.marca.trim(),
          modelo: v.modelo.trim(),
          cor: v.cor.trim(),
          ano: v.ano.trim(),
          placa: v.placa.trim().toUpperCase()
        }));

      const novoCliente: Omit<Cliente, 'id'> = {
        empresa: tenantId,
        nomeCompleto: nomeCompleto.trim(),
        telefone: formatCelular(telefone.trim()),
        cep: formatCep(cep.trim()),
        endereco: endereco.trim(),
        numero: numero.trim(),
        bairro: bairro.trim(),
        cidade: cidade.trim(),
        estado: estado.trim().toUpperCase(),
        veiculos: veiculosFormatados.length > 0 ? veiculosFormatados : [
          { tipo: 'Carro', marca: 'Geral', modelo: 'Veículo', cor: 'Padrão', ano: '2024', placa: 'BR-0000' }
        ],
        dataCadastro: serverTimestamp()
      };


      await addDoc(collection(db, 'clientes'), novoCliente);
      
      // Limpa o formulário após o sucesso
      setNomeCompleto('');
      setTelefone('');
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
      setFeedback({ tipo: 'sucesso', mensagem: 'Ficha do cliente excluída da nuvem.' });
    } catch (err) {
      console.error('Erro ao excluir cliente:', err);
      setFeedback({ tipo: 'erro', mensagem: 'Não foi possível excluir o cliente.' });
    }
  };

  // Filtro de busca de clientes (por Nome, Placa, Modelo ou Telefone)
  const clientesFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return clientes;

    return clientes.filter(c => {
      const matchNome = (c.nomeCompleto || '').toLowerCase().includes(termo);
      const matchTel = (c.telefone || '').toLowerCase().includes(termo);
      const matchPlacaOuModelo = c.veiculos?.some(v => 
        (v.placa || '').toLowerCase().includes(termo) ||
        (v.modelo || '').toLowerCase().includes(termo) ||
        (v.marca || '').toLowerCase().includes(termo)
      );
      return matchNome || matchTel || matchPlacaOuModelo;
    });
  }, [clientes, busca]);

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
            Cadastre clientes no balcão e visualize todos os clientes recebidos via QR Code do lava-jato em tempo real.
          </p>
        </div>

        {/* CONTADOR TOTAL */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#111827', border: '1px solid #1F2937', padding: '8px 16px', borderRadius: '10px' }}>
          <span style={{ fontSize: '12px', color: '#9CA3AF' }}>Total cadastrados:</span>
          <span style={{ fontSize: '16px', fontWeight: 700, color: '#00A3FF' }}>{clientes.length}</span>
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

            {/* Telefone / WhatsApp */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '13px', color: '#9CA3AF', marginBottom: '4px', fontWeight: 500 }}>
                WhatsApp / Celular (Opcional)
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

        {/* COLUNA DIREITA: LISTAGEM EM TEMPO REAL */}
        <div style={{ backgroundColor: '#111827', border: '1px solid #1F2937', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column' }}>
          
          <div style={{ borderBottom: '1px solid #1F2937', paddingBottom: '12px', marginBottom: '16px' }}>
            <h2 style={{ color: '#FFF', fontSize: '17px', fontWeight: 600, margin: 0 }}>
              Clientes Cadastrados (QR Code & Balcão)
            </h2>
            <p style={{ color: '#9CA3AF', fontSize: '12px', margin: '4px 0 0 0' }}>
              Atualização em tempo real sincronizada com o banco Firestore.
            </p>

            {/* BARRA DE PESQUISA */}
            <div style={{ marginTop: '12px', position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#6B7280' }} />
              <input 
                type="text"
                placeholder="Buscar por cliente, placa ou modelo..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
                style={{ ...inputStyle, paddingLeft: '36px' }}
              />
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#9CA3AF', fontStyle: 'italic', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <Loader2 size={24} className="animate-spin text-cyan-400" />
              <span>Carregando dados da nuvem...</span>
            </div>
          ) : clientesFiltrados.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 16px', color: '#6B7280', fontStyle: 'italic' }}>
              {busca ? 'Nenhum cliente corresponde ao filtro de busca.' : 'Nenhum cliente cadastrado neste lava-jato ainda.'}
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
                >
                  {/* CABEÇALHO DO CARD DO CLIENTE */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
                    <div>
                      <h4 style={{ color: '#FFFFFF', fontSize: '15px', fontWeight: 600, margin: 0 }}>
                        {cliente.nomeCompleto}
                      </h4>
                      {cliente.telefone && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                          <Phone size={12} style={{ color: '#00A3FF' }} />
                          <span style={{ fontSize: '12px', color: '#9CA3AF', fontFamily: 'monospace' }}>{formatCelular(cliente.telefone)}</span>
                          <a 
                            href={`https://wa.me/55${cleanDigits(cliente.telefone)}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            style={{ 
                              color: '#22C55E', 
                              fontSize: '11px', 
                              display: 'inline-flex', 
                              alignItems: 'center', 
                              gap: '2px', 
                              marginLeft: '6px',
                              textDecoration: 'none'
                            }}
                          >
                            <MessageCircle size={12} /> WhatsApp
                          </a>
                        </div>
                      )}

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
                        {[cliente.endereco, cliente.bairro, cliente.cidade ? `${cliente.cidade}/${cliente.estado}` : ''].filter(Boolean).join(' - ')}
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
