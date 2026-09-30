import React, { useState, useMemo } from 'react';
import { 
  Building2, 
  Search, 
  PlusCircle, 
  LogIn, 
  Pencil, 
  Trash2, 
  Download, 
  Mail, 
  CheckCircle, 
  AlertCircle,
  Eye,
  X,
  SlidersHorizontal,
  Users
} from 'lucide-react';
import { Tenant, PlanType, TenantStatus } from '../types';

interface TenantsSectionProps {
  tenants: Tenant[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onOpenNewTenantModal: () => void;
  onEditTenant: (tenant: Tenant) => void;
  onDeleteTenant: (tenantId: string) => void;
  onImpersonateTenant: (tenant: Tenant) => void;
}

export const TenantsSection: React.FC<TenantsSectionProps> = ({
  tenants,
  searchQuery,
  onSearchChange,
  onOpenNewTenantModal,
  onEditTenant,
  onDeleteTenant,
  onImpersonateTenant
}) => {
  const [selectedPlanFilter, setSelectedPlanFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [selectedTenants, setSelectedTenants] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 8;

  const [inspectingTenant, setInspectingTenant] = useState<Tenant | null>(null);
  const [tenantToDelete, setTenantToDelete] = useState<Tenant | null>(null);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState<boolean>(false);
  const [deleteSuccessMsg, setDeleteSuccessMsg] = useState<string | null>(null);

  const confirmDeleteSingleTenant = () => {
    if (tenantToDelete) {
      const name = tenantToDelete.name;
      onDeleteTenant(tenantToDelete.id);
      setSelectedTenants(prev => prev.filter(id => id !== tenantToDelete.id));
      setTenantToDelete(null);
      setDeleteSuccessMsg(`Empresa "${name}" foi excluída com sucesso do sistema.`);
      setTimeout(() => setDeleteSuccessMsg(null), 4000);
    }
  };

  const confirmBulkDelete = () => {
    selectedTenants.forEach(id => onDeleteTenant(id));
    const count = selectedTenants.length;
    setSelectedTenants([]);
    setShowBulkDeleteModal(false);
    setDeleteSuccessMsg(`${count} empresas foram excluídas com sucesso.`);
    setTimeout(() => setDeleteSuccessMsg(null), 4000);
  };

  // Filter logic
  const filteredTenants = useMemo(() => {
    return tenants.filter((tenant) => {
      const matchesSearch = 
        tenant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tenant.domain.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tenant.contactEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tenant.ownerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tenant.id.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesPlan = selectedPlanFilter === 'all' || tenant.plan === selectedPlanFilter;
      const matchesStatus = selectedStatusFilter === 'all' || tenant.status === selectedStatusFilter;

      return matchesSearch && matchesPlan && matchesStatus;
    });
  }, [tenants, searchQuery, selectedPlanFilter, selectedStatusFilter]);

  // Pagination logic
  const totalPages = Math.ceil(filteredTenants.length / itemsPerPage) || 1;
  const paginatedTenants = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredTenants.slice(start, start + itemsPerPage);
  }, [filteredTenants, currentPage]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedTenants(paginatedTenants.map((t) => t.id));
    } else {
      setSelectedTenants([]);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedTenants((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleExportCsv = () => {
    const headers = ['ID', 'Nome', 'Domínio', 'Plano', 'Status', 'Usuários', 'MRR (R$)', 'E-mail', 'Criado Em'];
    const rows = filteredTenants.map(t => [
      t.id, t.name, t.domain, t.plan, t.status, t.endUsersCount, t.mrrAmount, t.contactEmail, t.createdAt
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `tenants_saas_export_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">

      {/* Header com Filtros & Ações */}
      <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-[#f8fafc] flex items-center gap-2">
              <Building2 className="w-5 h-5 text-indigo-400" />
              Gestão Geral de Empresas (Tenants)
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {filteredTenants.length} empresas encontradas de um total de {tenants.length} cadastradas no sistema.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleExportCsv}
              className="bg-[#020617] border border-[#1e293b] hover:bg-slate-900 text-slate-300 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition"
              title="Exportar dados para CSV"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" /> Exportar CSV
            </button>
            <button
              onClick={onOpenNewTenantModal}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-sm shadow-indigo-600/30"
            >
              <PlusCircle className="w-4 h-4" /> Nova Empresa
            </button>
          </div>
        </div>

        {/* Barra de Busca e Filtros Rápidos */}
        <div className="pt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 border-t border-[#1e293b]">
          
          {/* Busca por Texto */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Nome, e-mail, domínio..."
              className="bg-[#020617] border border-[#1e293b] text-xs text-slate-200 rounded-lg pl-9 pr-3 py-1.5 focus:outline-none focus:border-indigo-500 w-full"
            />
          </div>

          {/* Filtro por Plano */}
          <div className="flex items-center gap-2 bg-[#020617] border border-[#1e293b] rounded-lg px-3 py-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={selectedPlanFilter}
              onChange={(e) => {
                setSelectedPlanFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-transparent text-xs text-slate-200 focus:outline-none w-full cursor-pointer font-medium"
            >
              <option value="all" className="bg-[#020617]">Todos os Planos</option>
              <option value="Basic" className="bg-[#020617]">Basic (R$ 199)</option>
              <option value="Pro" className="bg-[#020617]">Pro (R$ 499)</option>
              <option value="Enterprise" className="bg-[#020617]">Enterprise (R$ 1.299)</option>
            </select>
          </div>

          {/* Filtro por Status */}
          <div className="flex items-center gap-2 bg-[#020617] border border-[#1e293b] rounded-lg px-3 py-1.5">
            <CheckCircle className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={selectedStatusFilter}
              onChange={(e) => {
                setSelectedStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-transparent text-xs text-slate-200 focus:outline-none w-full cursor-pointer font-medium"
            >
              <option value="all" className="bg-[#020617]">Todos os Status</option>
              <option value="Ativo" className="bg-[#020617]">Ativo</option>
              <option value="Inadimplente" className="bg-[#020617]">Inadimplente</option>
              <option value="Trial" className="bg-[#020617]">Trial</option>
              <option value="Suspenso" className="bg-[#020617]">Suspenso</option>
            </select>
          </div>

          {/* Reset Filters button */}
          {(selectedPlanFilter !== 'all' || selectedStatusFilter !== 'all' || searchQuery) && (
            <button
              onClick={() => {
                setSelectedPlanFilter('all');
                setSelectedStatusFilter('all');
                onSearchChange('');
                setCurrentPage(1);
              }}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-bold py-1.5 flex items-center justify-center gap-1 bg-indigo-500/10 border border-indigo-500/20 rounded-lg hover:bg-indigo-500/20 transition"
            >
              <X className="w-3.5 h-3.5" /> Limpar Filtros
            </button>
          )}

        </div>
      </div>

      {/* Feedback Toast de Exclusão */}
      {deleteSuccessMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-3.5 rounded-xl text-xs flex items-center justify-between animate-fade-in shadow-lg">
          <span className="flex items-center gap-2 font-bold">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            {deleteSuccessMsg}
          </span>
          <button 
            onClick={() => setDeleteSuccessMsg(null)}
            className="text-emerald-400 hover:text-emerald-200 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Ações em Lote */}
      {selectedTenants.length > 0 && (
        <div className="bg-indigo-950/60 border border-indigo-500/30 rounded-xl p-3 px-5 flex flex-wrap items-center justify-between gap-3 text-xs text-indigo-200">
          <span>
            <strong className="font-bold text-white">{selectedTenants.length}</strong> empresa(s) selecionada(s)
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowBulkDeleteModal(true)}
              className="bg-rose-600 hover:bg-rose-500 text-white px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 shadow-sm shadow-rose-600/30"
              title="Excluir todas as empresas selecionadas"
            >
              <Trash2 className="w-3.5 h-3.5" /> Excluir Selecionadas ({selectedTenants.length})
            </button>
            <button
              onClick={() => {
                setSelectedTenants([]);
              }}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5"
            >
              <Mail className="w-3.5 h-3.5" /> Enviar E-mail
            </button>
            <button
              onClick={() => setSelectedTenants([])}
              className="text-slate-400 hover:text-slate-200 px-2 py-1"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Tabela Principal de Tenants */}
      <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-[#020617]/40 text-[11px] uppercase text-slate-500 font-bold border-b border-[#1e293b]">
              <tr>
                <th className="py-3.5 px-4 w-10">
                  <input
                    type="checkbox"
                    onChange={handleSelectAll}
                    checked={selectedTenants.length === paginatedTenants.length && paginatedTenants.length > 0}
                    className="rounded bg-[#020617] border-[#1e293b] text-indigo-600 focus:ring-0 cursor-pointer"
                  />
                </th>
                <th className="py-3.5 px-4">Empresa / Tenant</th>
                <th className="py-3.5 px-4">Plano & MRR</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Usuários Finais</th>
                <th className="py-3.5 px-4">Responsável</th>
                <th className="py-3.5 px-6 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e293b]/50">
              {paginatedTenants.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                    <Building2 className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-300">Nenhuma empresa cadastrada no SaaS ainda.</p>
                    <p className="text-[11px] text-slate-500 mt-1">Clique em "<strong>+ Nova Empresa</strong>" no topo para cadastrar o primeiro tenant do zero.</p>
                  </td>
                </tr>
              ) : (
                paginatedTenants.map((tenant) => {
                  const isSelected = selectedTenants.includes(tenant.id);
                  const isEnterprise = tenant.plan === 'Enterprise';
                  const isPro = tenant.plan === 'Pro';

                  return (
                    <tr 
                      key={tenant.id} 
                      className={`hover:bg-slate-800/20 transition ${isSelected ? 'bg-indigo-950/30' : ''}`}
                    >
                      <td className="py-4 px-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(tenant.id)}
                          className="rounded bg-[#020617] border-[#1e293b] text-indigo-600 focus:ring-0 cursor-pointer"
                        />
                      </td>

                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded font-bold flex items-center justify-center text-xs ${
                            tenant.status === 'Inadimplente' ? 'bg-rose-500/10 border border-rose-500/20 text-rose-400' :
                            tenant.status === 'Suspenso' ? 'bg-slate-500/10 border border-slate-500/20 text-slate-400' :
                            tenant.status === 'Trial' ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400' :
                            'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                          }`}>
                            {tenant.code}
                          </div>
                          <div>
                            <div className="font-semibold text-[#f8fafc] flex items-center gap-2">
                              {tenant.name}
                              <button
                                onClick={() => setInspectingTenant(tenant)}
                                className="text-slate-500 hover:text-indigo-400 transition"
                                title="Ver Detalhes Rápidos"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <div className="text-[11px] text-slate-500">{tenant.domain}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        <div className="flex flex-col gap-0.5">
                          <span className={`inline-self-start px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            isEnterprise ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                            isPro ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                            'bg-slate-500/10 text-slate-400 border-slate-500/20'
                          }`}>
                            {tenant.plan}
                          </span>
                          <span className="text-[11px] text-slate-400 font-semibold mt-0.5">
                            R$ {tenant.mrrAmount.toLocaleString('pt-BR')}/mês
                          </span>
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        {tenant.status === 'Ativo' && (
                          <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Ativo
                          </span>
                        )}
                        {tenant.status === 'Inadimplente' && (
                          <span className="flex items-center gap-1.5 text-xs font-medium text-rose-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span> Inadimplente
                          </span>
                        )}
                        {tenant.status === 'Trial' && (
                          <span className="flex items-center gap-1.5 text-xs font-medium text-amber-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span> Trial
                          </span>
                        )}
                        {tenant.status === 'Suspenso' && (
                          <span className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span> Suspenso
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-slate-500" />
                          <span className="text-slate-200 font-semibold">
                            {tenant.endUsersCount.toLocaleString('pt-BR')}
                          </span>
                          <span className="text-xs text-slate-500">/ {tenant.maxUsers}</span>
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        <div className="text-xs">
                          <p className="text-slate-200 font-semibold">{tenant.ownerName}</p>
                          <p className="text-slate-500 truncate max-w-[140px] text-[11px]">{tenant.contactEmail}</p>
                        </div>
                      </td>

                      <td className="py-4 px-6 text-right space-x-1">
                        <button
                          onClick={() => onImpersonateTenant(tenant)}
                          className="p-1.5 text-slate-500 hover:text-indigo-400 rounded transition cursor-pointer"
                          title="Acessar como admin"
                        >
                          <LogIn className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onEditTenant(tenant)}
                          className="p-1.5 text-slate-500 hover:text-white rounded transition cursor-pointer"
                          title="Editar empresa"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setTenantToDelete(tenant)}
                          className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition cursor-pointer"
                          title="Excluir empresa permanentemente"
                        >
                          <Trash2 className="w-4 h-4 text-rose-400/70 hover:text-rose-400" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Rodapé / Paginação da Tabela */}
        <div className="p-4 border-t border-[#1e293b] flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 font-bold gap-3">
          <span>
            Mostrando {paginatedTenants.length} de {filteredTenants.length} empresas
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 bg-[#020617] border border-[#1e293b] rounded hover:bg-slate-900 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Anterior
            </button>
            <span className="px-2 text-slate-300 font-semibold">
              Página {currentPage} de {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 bg-[#020617] border border-[#1e293b] rounded hover:bg-slate-900 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Próxima
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Detalhes Rápidos / Inspeção de Tenant */}
      {inspectingTenant && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative">
            <button
              onClick={() => setInspectingTenant(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
              <div className="w-12 h-12 rounded-lg bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 font-bold flex items-center justify-center text-lg">
                {inspectingTenant.code}
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-100">{inspectingTenant.name}</h3>
                <p className="text-xs text-slate-400 font-mono">{inspectingTenant.domain}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-500 block mb-1">Plano Atual</span>
                <span className="text-slate-200 font-semibold text-sm">{inspectingTenant.plan}</span>
              </div>
              <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-500 block mb-1">Valor Mensal (MRR)</span>
                <span className="text-emerald-400 font-semibold text-sm">R$ {inspectingTenant.mrrAmount}/mês</span>
              </div>
              <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-500 block mb-1">Usuários Alocados</span>
                <span className="text-slate-200 font-semibold text-sm">
                  {inspectingTenant.endUsersCount} / {inspectingTenant.maxUsers}
                </span>
              </div>
              <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-500 block mb-1">Status da Conta</span>
                <span className="text-slate-200 font-semibold text-sm">{inspectingTenant.status}</span>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                <span className="text-slate-500">Contato Responsável:</span>
                <span className="text-slate-200 font-medium">{inspectingTenant.ownerName}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                <span className="text-slate-500">E-mail Corporativo:</span>
                <span className="text-slate-200 font-medium">{inspectingTenant.contactEmail}</span>
              </div>
              {inspectingTenant.contactPhone && (
                <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                  <span className="text-slate-500">Telefone / WhatsApp:</span>
                  <span className="text-slate-200 font-medium">{inspectingTenant.contactPhone}</span>
                </div>
              )}
              {inspectingTenant.tempPassword && (
                <div className="flex justify-between border-b border-slate-800/60 pb-1.5 bg-amber-500/5 p-2 rounded border border-amber-500/20">
                  <span className="text-amber-400 font-bold flex items-center gap-1">🔑 Senha Temporária Inicial:</span>
                  <span className="text-amber-300 font-mono font-bold">{inspectingTenant.tempPassword}</span>
                </div>
              )}
              {inspectingTenant.cnpj && (
                <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                  <span className="text-slate-500">CNPJ / IE:</span>
                  <span className="text-slate-200 font-mono">{inspectingTenant.cnpj} {inspectingTenant.inscricaoEstadual ? `(${inspectingTenant.inscricaoEstadual})` : ''}</span>
                </div>
              )}
              {inspectingTenant.razaoSocial && (
                <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                  <span className="text-slate-500">Razão Social:</span>
                  <span className="text-slate-200 font-medium">{inspectingTenant.razaoSocial}</span>
                </div>
              )}
              {inspectingTenant.address?.city && (
                <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                  <span className="text-slate-500">Localização:</span>
                  <span className="text-slate-200 font-medium">{inspectingTenant.address.city}/{inspectingTenant.address.state || 'UF'}</span>
                </div>
              )}
              <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                <span className="text-slate-500">Data de Cadastro:</span>
                <span className="text-slate-200 font-medium">{inspectingTenant.createdAt}</span>
              </div>
              {inspectingTenant.notes && (
                <div className="pt-2">
                  <span className="text-slate-500 block mb-1">Anotações do Super Admin:</span>
                  <p className="bg-slate-900 p-2.5 rounded text-slate-300 border border-slate-800">
                    {inspectingTenant.notes}
                  </p>
                </div>
              )}
            </div>

            <div className="pt-4 flex items-center justify-between gap-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  const t = inspectingTenant;
                  setInspectingTenant(null);
                  setTenantToDelete(t);
                }}
                className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" /> Excluir Empresa
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setInspectingTenant(null)}
                  className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg text-xs font-medium transition cursor-pointer"
                >
                  Fechar
                </button>
                <button
                  onClick={() => {
                    const t = inspectingTenant;
                    setInspectingTenant(null);
                    onImpersonateTenant(t);
                  }}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-indigo-600/30"
                >
                  <LogIn className="w-4 h-4" /> Acessar Painel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão Individual */}
      {tenantToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-rose-500/40 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl relative animate-in fade-in zoom-in-95">
            <button
              onClick={() => setTenantToDelete(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-rose-500/20 pb-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Confirmar Exclusão</h3>
                <p className="text-[11px] text-rose-400 font-medium">Esta ação não pode ser desfeita</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <p>
                Tem certeza que deseja excluir permanentemente a empresa:
              </p>
              
              <div className="bg-[#020617] border border-slate-800 rounded-xl p-3.5 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-100 text-sm">{tenantToDelete.name}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    Plano {tenantToDelete.plan}
                  </span>
                </div>
                <p className="text-[11px] text-blue-400 font-mono font-medium">{tenantToDelete.domain}</p>
                <p className="text-[11px] text-slate-500">Responsável: {tenantToDelete.ownerName} ({tenantToDelete.contactEmail})</p>
              </div>

              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-[11px] leading-relaxed">
                ⚠️ <strong>Atenção:</strong> Todos os dados vinculados a este tenant (histórico de lavagens, funcionários, estoque, comissões e credenciais de acesso) serão removidos do SaaS.
              </div>
            </div>

            <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setTenantToDelete(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteSingleTenant}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-rose-600/30 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" /> Sim, Excluir Empresa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão em Lote */}
      {showBulkDeleteModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-rose-500/40 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl relative animate-in fade-in zoom-in-95">
            <button
              onClick={() => setShowBulkDeleteModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-rose-500/20 pb-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Exclusão em Lote ({selectedTenants.length})</h3>
                <p className="text-[11px] text-rose-400 font-medium">Remoção de múltiplas empresas selecionadas</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <p>
                Você está prestes a excluir <strong className="text-white font-bold">{selectedTenants.length} empresas</strong> selecionadas de uma vez só.
              </p>

              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-[11px] leading-relaxed">
                ⚠️ <strong>Atenção:</strong> Todas as empresas marcadas serão excluídas permanentemente com todos os seus registros de histórico, estoques e colaboradores.
              </div>
            </div>

            <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowBulkDeleteModal(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmBulkDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-rose-600/30 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" /> Confirmar e Excluir Todas ({selectedTenants.length})
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
