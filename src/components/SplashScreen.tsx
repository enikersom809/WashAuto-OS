import React, { useState, useEffect } from 'react';
import { getPlatformLogo } from '../lib/logoManager';

interface SplashScreenProps {
  onFinish?: () => void;
  durationMs?: number;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onFinish,
  durationMs = 5000
}) => {
  const [progress, setProgress] = useState(0);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [logoSrc, setLogoSrc] = useState<string>(() => getPlatformLogo());

  useEffect(() => {
    const handleLogoChange = (e: any) => {
      setLogoSrc(e.detail || getPlatformLogo());
    };
    window.addEventListener('washauto_logo_changed', handleLogoChange);
    return () => window.removeEventListener('washauto_logo_changed', handleLogoChange);
  }, []);

  useEffect(() => {
    const startTime = Date.now();
    const intervalStep = 50;

    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min((elapsed / durationMs) * 100, 100);
      setProgress(pct);

      if (elapsed >= durationMs) {
        clearInterval(timer);
        handleFinish();
      }
    }, intervalStep);

    return () => clearInterval(timer);
  }, [durationMs]);

  const handleFinish = () => {
    setIsFadingOut(true);
    setTimeout(() => {
      setIsDone(true);
      if (onFinish) onFinish();
    }, 500); // Fade-out exato de 0.5s conforme o script do usuário
  };

  if (isDone) return null;

  return (
    <div
      id="splash-screen"
      className={`fixed inset-0 z-[9999] flex flex-col justify-center items-center p-5 text-center select-none transition-all duration-500 ease-out ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{
        backgroundColor: '#0B0F19',
        color: '#F3F4F6'
      }}
    >
      {/* 1. CONTAINER DA LOGO */}
      <div 
        className="logo-container max-w-[500px] w-full text-center mb-5 flex flex-col items-center justify-center px-4"
      >
        <img
          src={logoSrc}
          alt="WashAuto OS Logo"
          onError={(e) => {
            const target = e.currentTarget as HTMLImageElement;
            if (target.src !== window.location.origin + '/logo.png') {
              target.src = '/logo.png';
            }
          }}
          className="w-full h-auto max-h-[160px] object-contain drop-shadow-[0_4px_20px_rgba(0,163,255,0.25)] transition-all duration-300"
        />
      </div>

      {/* 2. BARRA DE CARREGAMENTO MINIMALISTA: 200px, 3px, neon gradient */}
      <div 
        className="loader-bar w-[200px] h-[3px] rounded-full overflow-hidden mt-2.5 relative"
        style={{
          background: 'rgba(255, 255, 255, 0.1)'
        }}
      >
        <div
          className="loader-progress h-full transition-all duration-75 ease-linear"
          style={{
            width: `${progress}%`,
            background: 'linear-gradient(90deg, #00A3FF, #00FFCC)',
            boxShadow: '0 0 10px #00A3FF'
          }}
        />
      </div>

      {/* Botão para pular apresentação */}
      <div className="mt-8">
        <button
          type="button"
          onClick={handleFinish}
          className="text-xs text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700 bg-slate-900/60 hover:bg-slate-800/80 px-4 py-1.5 rounded-lg transition cursor-pointer"
        >
          Pular Apresentação
        </button>
      </div>
    </div>
  );
};

