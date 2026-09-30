import React, { useState } from 'react';
import { 
  Activity, 
  Search, 
  Terminal, 
  Database, 
  Cpu, 
  HardDrive, 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle, 
  Info, 
  X,
  Filter,
  FileText
} from 'lucide-react';
import { SystemLog, LogLevel } from '../types';

interface LogsSectionProps {
  logs: SystemLog[];
  onAddLog: (newLog: SystemLog) => void;
  onClearLogs: () => void;
}

export const LogsSection: React.FC<LogsSectionProps> = ({
  logs,
  onAddLog,
  onClearLogs
}) => {
  const [logFilter, setLogFilter] = useState<string>('all');
  const [logSearch, setLogSearch] = useState<string>('');

  const filteredLogs = logs.filter((l) => {
    const matchesFilter = logFilter === 'all' || l.level === logFilter;
    const matchesSearch = 
      l.event.toLowerCase().includes(logSearch.toLowerCase()) ||
      l.tenantName.toLowerCase().includes(logSearch.toLowerCase()) ||
      l.user.toLowerCase().includes(logSearch.toLowerCase()) ||
      l.ipAddress.includes(logSearch);

    return matchesFilter && matchesSearch;
  });

  const triggerTestAlert = () => {
    const testLog: SystemLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toLocaleString('pt-BR'),
      level: 'WARN',
      tenantName: 'Stark Tech',
      event: 'Pico de tráfego detectado na API Endpoint (/api/v1/webhook)',
      ipAddress: '189.100.22.4',
      user: 'api_monitor'
    };
    onAddLog(testLog);
  };

  return (
    <div className="space-y-6">

      {/* Health Indicator Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-bold">
              Latência PostgreSQL
            </span>
            <span className="text-lg font-bold text-[#f8fafc]">12 ms</span>
            <span className="text-[10px] text-emerald-400 block font-bold">Operacional (Normal)</span>
          </div>
        </div>

        <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-bold">
              Uptime do Gateway API
            </span>
            <span className="text-lg font-bold text-[#f8fafc]">99.98%</span>
            <span className="text-[10px] text-indigo-400 block font-bold">100% disponibilidade</span>
          </div>
        </div>

        <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center font-bold">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-bold">
              Redis Cache Hit
            </span>
            <span className="text-lg font-bold text-[#f8fafc]">99.4%</span>
            <span className="text-[10px] text-purple-400 block font-bold">Taxa excelente</span>
          </div>
        </div>

        <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-bold">
              Armazenamento
            </span>
            <span className="text-lg font-bold text-[#f8fafc]">42% (2.1 TB)</span>
            <span className="text-[10px] text-blue-400 block font-bold">De 5.0 TB disponíveis</span>
          </div>
        </div>

      </div>

      {/* Logs Table Container */}
      <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl overflow-hidden shadow-xl">
        <div className="p-5 border-b border-[#1e293b] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-indigo-400" />
            <div>
              <h2 className="text-base font-bold text-[#f8fafc]">Logs de Auditoria & Eventos do Sistema</h2>
              <p className="text-[11px] text-slate-400">Stream em tempo real dos eventos em todas as contas</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={triggerTestAlert}
              className="bg-[#020617] border border-[#1e293b] hover:bg-slate-900 text-slate-300 px-3 py-1.5 rounded-lg text-xs font-bold transition"
            >
              Simular Evento de Alerta
            </button>
            <button
              onClick={onClearLogs}
              className="text-slate-400 hover:text-rose-400 text-xs font-bold px-2 py-1"
            >
              Limpar Logs
            </button>
          </div>
        </div>

        {/* Controls / Filter */}
        <div className="p-4 bg-[#020617]/40 border-b border-[#1e293b] flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              value={logSearch}
              onChange={(e) => setLogSearch(e.target.value)}
              placeholder="Buscar por mensagem de log, IP ou tenant..."
              className="w-full bg-[#020617] border border-[#1e293b] text-xs text-slate-200 rounded-lg pl-9 pr-3 py-1.5 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2 bg-[#020617] border border-[#1e293b] rounded-lg px-3 py-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={logFilter}
              onChange={(e) => setLogFilter(e.target.value)}
              className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer font-medium"
            >
              <option value="all" className="bg-[#020617]">Todos os Níveis</option>
              <option value="INFO" className="bg-[#020617]">INFO</option>
              <option value="WARN" className="bg-[#020617]">WARN</option>
              <option value="ERROR" className="bg-[#020617]">ERROR</option>
              <option value="SECURITY" className="bg-[#020617]">SECURITY</option>
            </select>
          </div>
        </div>

        {/* Logs Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300 font-mono">
            <thead className="bg-slate-900/80 text-[11px] uppercase text-slate-400 font-sans border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-3">Nível</th>
                <th className="py-3 px-4">Tenant / Origem</th>
                <th className="py-3 px-6">Evento / Descrição</th>
                <th className="py-3 px-4">Endereço IP</th>
                <th className="py-3 px-4">Usuário</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-sans">
                    <FileText className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-300">Nenhum registro de auditoria no sistema.</p>
                    <p className="text-[11px] text-slate-500 mt-1">Os logs de segurança e eventos serão gerados automaticamente conforme o uso.</p>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-900/50 transition">
                    <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                      {log.timestamp}
                    </td>

                    <td className="py-3 px-3">
                      {log.level === 'INFO' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 inline-flex items-center gap-1">
                          <Info className="w-3 h-3" /> INFO
                        </span>
                      )}
                      {log.level === 'WARN' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 inline-flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> WARN
                        </span>
                      )}
                      {log.level === 'ERROR' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 inline-flex items-center gap-1">
                          <X className="w-3 h-3" /> ERROR
                        </span>
                      )}
                      {log.level === 'SECURITY' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20 inline-flex items-center gap-1">
                          <ShieldAlert className="w-3 h-3" /> SEC
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 font-sans font-semibold text-slate-200 whitespace-nowrap">
                      {log.tenantName}
                    </td>

                    <td className="py-3 px-6 text-slate-300 font-sans">
                      {log.event}
                    </td>

                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                      {log.ipAddress}
                    </td>

                    <td className="py-3 px-4 text-slate-400 font-sans whitespace-nowrap">
                      {log.user}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
