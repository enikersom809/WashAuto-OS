import React, { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Printer, Copy, Check, ExternalLink, Sparkles, Car } from 'lucide-react';

export interface EmpresaProps {
  id?: string;
  nome: string;
  slug: string;
  logoUrl?: string;
}

interface TenantQRCodeProps {
  empresa: EmpresaProps;
  className?: string;
}

/**
 * Componente: Geração e Impressão de Placa com QR Code Dinâmico
 * Desenvolvido para Tailwind CSS v4 com regras nativas de impressão (print:*).
 */
export const TenantQRCode: React.FC<TenantQRCodeProps> = ({ empresa, className = '' }) => {
  const [copied, setCopied] = React.useState(false);
  const printContainerRef = useRef<HTMLDivElement>(null);

  // URL dinâmica do PWA apontando para a rota do inquilino
  const targetUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/${empresa.slug}`
    : `https://app.saas.com/${empresa.slug}`;

  // Copiar link para o clipboard
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(targetUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Falha ao copiar URL:', err);
    }
  };

  // Disparar impressão nativa do navegador
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className={`flex flex-col gap-6 ${className}`}>
      {/* 
        ESTILOS GLOBAIS DE IMPRESSÃO 
        Garante que apenas o container com id "placa-impressao-qrcode" seja impresso
      */}
      <style>{`
        @media print {
          /* Oculta tudo na página exceto a placa designada */
          body * {
            visibility: hidden !important;
          }
          #placa-impressao-qrcode, #placa-impressao-qrcode * {
            visibility: visible !important;
          }
          #placa-impressao-qrcode {
            position: absolute !important;
            left: 50% !important;
            top: 50% !important;
            transform: translate(-50%, -50%) !important;
            width: 100% !important;
            max-width: 480px !important;
            margin: 0 auto !important;
            padding: 2.5rem !important;
            box-shadow: none !important;
            border: 2px solid #000 !important;
            background: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          @page {
            size: A4 portrait;
            margin: 1cm;
          }
        }
      `}</style>

      {/* PAINEL DE CONTROLE / CARD DE VISUALIZAÇÃO (Oculto na impressão pelo layout print) */}
      <div className="print:hidden bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl text-slate-100 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex flex-col gap-2 max-w-md">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold w-fit">
            <Sparkles className="w-3.5 h-3.5" />
            <span>PWA Multi-tenant Automático</span>
          </div>
          <h3 className="text-lg font-bold text-white">Placa de Balcão & Totem QR Code</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Imprima e posicione esta placa no balcão ou na área de espera do lava-jato. 
            Ao escanear, o cliente é direcionado imediatamente para o agendamento exclusivo da <strong>{empresa.nome}</strong>.
          </p>
          <div className="mt-2 flex items-center gap-2 text-xs font-mono text-slate-400 bg-slate-950 px-3 py-2 rounded-lg border border-slate-800 break-all">
            <span className="text-slate-500 select-none">URL:</span>
            <span className="text-blue-400 truncate">{targetUrl}</span>
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="flex flex-col sm:flex-row md:flex-col gap-2.5 w-full md:w-auto shrink-0">
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition shadow-lg shadow-blue-600/25 cursor-pointer active:scale-98"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir Placa de Balcão</span>
          </button>

          <button
            type="button"
            onClick={handleCopyLink}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-400">Link Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-slate-400" />
                <span>Copiar Link do App</span>
              </>
            )}
          </button>

          <a
            href={`/${empresa.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 font-semibold text-xs border border-slate-800 transition"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Testar Experiência do Cliente</span>
          </a>
        </div>
      </div>

      {/* 
        PLACA FÍSICA DESIGNADA PARA EXIBIÇÃO E IMPRESSÃO
        Este elemento possui id="placa-impressao-qrcode" e Tailwind classes para ambas visualizações
      */}
      <div className="flex justify-center items-center py-2">
        <div
          id="placa-impressao-qrcode"
          ref={printContainerRef}
          className="w-full max-w-sm bg-white text-slate-950 p-8 rounded-3xl border-2 border-slate-200 shadow-2xl flex flex-col items-center text-center transition-all"
        >
          {/* Header da Placa */}
          <div className="flex items-center justify-center gap-2 mb-4">
            {empresa.logoUrl ? (
              <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 p-1 flex items-center justify-center shadow-md overflow-hidden">
                <img src={empresa.logoUrl} alt={empresa.nome} className="w-full h-full object-contain" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md">
                <Car className="w-5 h-5" />
              </div>
            )}
            <span className="text-[11px] font-black uppercase tracking-widest text-blue-600">
              Lava-Jato Inteligente
            </span>
          </div>

          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight mb-1">
            {empresa.nome}
          </h2>
          <p className="text-xs text-slate-600 font-medium mb-6">
            Agendamentos, Status da Lavagem e Fidelidade
          </p>

          {/* Container do QR Code com moldura e contraste alto */}
          <div className="p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl shadow-inner mb-6 flex items-center justify-center">
            <QRCodeSVG
              value={targetUrl}
              size={210}
              level="H" // Alta tolerância a falhas (30% de dano/leitura de câmera)
              includeMargin={true}
              bgColor="#ffffff"
              fgColor="#0f172a"
            />
          </div>

          {/* Call to Action */}
          <div className="w-full bg-blue-50 border border-blue-100 rounded-xl p-3 mb-4">
            <p className="text-xs font-bold text-blue-900 uppercase tracking-wide">
              📱 Aponte a câmera do seu celular
            </p>
            <p className="text-[11px] text-blue-700 mt-0.5">
              Escaneie aqui para agendar sua lavagem
            </p>
          </div>

          {/* Rodapé da Placa */}
          <div className="text-[10px] text-slate-600 font-mono tracking-tighter flex items-center gap-1">
            <span>Powered by AutoClean SaaS •</span>
            <span className="font-semibold text-slate-700">/{empresa.slug}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
