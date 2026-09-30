import React, { useState } from 'react';
import { Download, Smartphone, Share, PlusSquare, X, CheckCircle2 } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  compact?: boolean;
  variant?: 'primary' | 'outline' | 'subtle';
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  compact = false,
  variant = 'primary',
  className = ''
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  // If already running as an installed PWA in standalone mode, hide
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    setIsInstalling(true);
    try {
      await install();
    } finally {
      setIsInstalling(false);
    }
  };

  // Base styling variants
  const getButtonStyles = () => {
    if (variant === 'outline') {
      return 'border border-cyan-500/30 hover:border-cyan-400 bg-slate-900/60 hover:bg-slate-800 text-cyan-300 shadow-sm';
    }
    if (variant === 'subtle') {
      return 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60';
    }
    // Default primary
    return 'bg-gradient-to-r from-blue-600 via-cyan-600 to-blue-700 hover:from-blue-500 hover:to-cyan-600 text-white shadow-lg shadow-cyan-900/30 border border-cyan-400/20';
  };

  // Chromium / Android / Desktop install flow
  if (isInstallable) {
    return (
      <button
        onClick={handleInstallClick}
        disabled={isInstalling}
        type="button"
        title="Instalar aplicativo WashAuto OS no seu dispositivo"
        className={`inline-flex items-center gap-2 rounded-xl font-bold transition-all duration-200 cursor-pointer active:scale-95 ${
          compact ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-xs sm:text-sm'
        } ${getButtonStyles()} ${className}`}
      >
        <Download className={`${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} animate-bounce`} />
        <span>{compact ? 'Instalar App' : 'Instalar WashAuto OS'}</span>
      </button>
    );
  }

  // iOS Safari flow (beforeinstallprompt is not supported on WebKit/iOS)
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          type="button"
          title="Instalar aplicativo no iPhone/iPad"
          className={`inline-flex items-center gap-2 rounded-xl font-bold transition-all duration-200 cursor-pointer active:scale-95 ${
            compact ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-xs sm:text-sm'
          } ${getButtonStyles()} ${className}`}
        >
          <Smartphone className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
          <span>{compact ? 'Instalar App' : 'Instalar no iOS'}</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-6 shadow-2xl relative text-left">
              <button
                onClick={() => setShowIOSGuide(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <img 
                  src="/logo.png" 
                  alt="WashAuto OS" 
                  onError={(e) => {
                    const target = e.currentTarget as HTMLImageElement;
                    if (target.src !== window.location.origin + '/logo.png') {
                      target.src = '/logo.png';
                    }
                  }}
                  className="w-12 h-12 rounded-xl object-contain bg-slate-950 p-1 shadow-md border border-cyan-500/30" 
                />
                <div>
                  <h3 className="text-base font-bold text-slate-100">Instalar WashAuto OS</h3>
                  <p className="text-xs text-slate-400">Adicionar à tela de início do iOS</p>
                </div>
              </div>

              <div className="space-y-3 my-4 text-xs sm:text-sm text-slate-300">
                <div className="flex items-start gap-2.5 bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600/30 text-blue-400 font-bold flex items-center justify-center text-xs">
                    1
                  </span>
                  <div>
                    No Safari, toque no botão de <strong>Compartilhar</strong> <Share className="inline w-3.5 h-3.5 text-blue-400 ml-1" /> na barra inferior.
                  </div>
                </div>

                <div className="flex items-start gap-2.5 bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600/30 text-blue-400 font-bold flex items-center justify-center text-xs">
                    2
                  </span>
                  <div>
                    Role a lista e selecione <strong>Adicionar à Tela de Início</strong> <PlusSquare className="inline w-3.5 h-3.5 text-blue-400 ml-1" />.
                  </div>
                </div>

                <div className="flex items-start gap-2.5 bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600/30 text-blue-400 font-bold flex items-center justify-center text-xs">
                    3
                  </span>
                  <div>
                    Toque em <strong>Adicionar</strong> no canto superior direito para concluir.
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-full mt-2 rounded-xl bg-blue-600 hover:bg-blue-500 py-2.5 text-xs sm:text-sm font-bold text-white transition cursor-pointer"
              >
                Entendido
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Fallback for desktop/browsers where beforeinstallprompt hasn't fired yet
  // provide a manual action or button that lets the user know the app can be installed
  return (
    <>
      <button
        onClick={() => setShowIOSGuide(true)}
        type="button"
        title="Instalar App no navegador"
        className={`inline-flex items-center gap-1.5 rounded-xl font-bold transition-all duration-200 cursor-pointer active:scale-95 opacity-85 hover:opacity-100 ${
          compact ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-xs'
        } ${getButtonStyles()} ${className}`}
      >
        <Smartphone className={compact ? 'w-3.5 h-3.5' : 'w-3.5 h-3.5'} />
        <span>{compact ? 'PWA' : 'Instalar App'}</span>
      </button>

      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-6 text-slate-100 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-blue-400" />
                Instalar Aplicativo
              </h3>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-4 text-xs sm:text-sm text-slate-300 space-y-2">
              <p>Para instalar o <strong>WashAuto OS</strong> diretamente:</p>
              <p>1. No computador: clique no ícone de instalação (computador/seta) na barra de endereços do seu navegador.</p>
              <p>2. No celular: toque no menu de opções do navegador e selecione <strong>"Adicionar à tela de início"</strong> ou <strong>"Instalar aplicativo"</strong>.</p>
            </div>

            <button
              onClick={() => setShowIOSGuide(false)}
              className="w-full mt-2 rounded-xl bg-blue-600 hover:bg-blue-500 py-2.5 text-xs sm:text-sm font-bold text-white transition cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
};
