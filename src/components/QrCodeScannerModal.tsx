import React, { useEffect, useRef, useState } from 'react';
import { Camera, X, Upload, AlertCircle, CheckCircle2, Loader2, QrCode } from 'lucide-react';
import jsQR from 'jsqr';

interface QrCodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (domainSlug: string) => void;
}

export const QrCodeScannerModal: React.FC<QrCodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess
}) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to extract clean slug from any scanned text or URL
  const extractDomainFromScanned = (rawText: string): string => {
    let text = rawText.trim();
    try {
      // If it is a full URL, parse the pathname or search params
      if (text.startsWith('http://') || text.startsWith('https://')) {
        const url = new URL(text);
        const searchParam = url.searchParams.get('empresa') || url.searchParams.get('slug') || url.searchParams.get('t');
        if (searchParam) return searchParam.toLowerCase().replace(/[^a-z0-9-]/g, '').trim();
        const pathSegments = url.pathname.split('/').filter(Boolean);
        if (pathSegments.length > 0) {
          const lastSeg = pathSegments[pathSegments.length - 1];
          return lastSeg.toLowerCase().replace(/[^a-z0-9-]/g, '').trim();
        }
        return url.hostname.replace('.saas.com', '').replace(/[^a-z0-9-]/g, '').trim();
      }
    } catch (e) {
      // Not a standard URL, continue
    }
    // Clean string fallback
    return text
      .toLowerCase()
      .replace(/https?:\/\//g, '')
      .replace('.saas.com', '')
      .replace('.seusaas.com', '')
      .replace(/[^a-z0-9-]/g, '')
      .trim();
  };

  // Start live camera stream
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }

    let activeStream: MediaStream | null = null;

    const startCamera = async () => {
      setCameraError(null);
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Câmera não suportada pelo seu navegador.');
        }

        // Try rear camera first (environment), fallback to user
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 480 } }
        }).catch(() => {
          return navigator.mediaDevices.getUserMedia({ video: true });
        });

        activeStream = mediaStream;
        setStream(mediaStream);

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.setAttribute('playsinline', 'true');
          videoRef.current.play().catch(console.error);
        }
      } catch (err: any) {
        console.warn('Camera access error:', err);
        setCameraError(err.message || 'Não foi possível acessar a câmera. Você pode enviar uma foto do QR Code.');
      }
    };

    startCamera();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isOpen]);

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
  };

  // Continuous frame scanner via requestAnimationFrame
  useEffect(() => {
    if (!stream || !isOpen) return;

    const scanFrame = () => {
      if (!videoRef.current || !canvasRef.current) {
        animFrameRef.current = requestAnimationFrame(scanFrame);
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
        canvas.height = video.videoHeight;
        canvas.width = video.videoWidth;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert'
        });

        if (code && code.data) {
          const slug = extractDomainFromScanned(code.data);
          if (slug) {
            stopCamera();
            onScanSuccess(slug);
            onClose();
            return;
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(scanFrame);
    };

    animFrameRef.current = requestAnimationFrame(scanFrame);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [stream, isOpen]);

  // Handle uploaded image file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingFile(true);
    setCameraError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setIsProcessingFile(false);
          setCameraError('Erro ao processar imagem.');
          return;
        }

        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);

        setIsProcessingFile(false);
        if (code && code.data) {
          const slug = extractDomainFromScanned(code.data);
          if (slug) {
            stopCamera();
            onScanSuccess(slug);
            onClose();
            return;
          }
        }
        setCameraError('Nenhum QR Code válido foi identificado na imagem.');
      };
      img.onerror = () => {
        setIsProcessingFile(false);
        setCameraError('Falha ao abrir imagem.');
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    const slug = extractDomainFromScanned(manualCode);
    if (slug) {
      stopCamera();
      onScanSuccess(slug);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl relative">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-2 text-white font-bold text-sm">
            <QrCode className="w-4 h-4 text-cyan-400" />
            <span>Escanear QR Code do Lava-Jato</span>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Video / Camera Viewport */}
        <div className="relative bg-black h-64 flex items-center justify-center overflow-hidden">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Scanner Overlay Frame */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-48 h-48 border-2 border-cyan-400/80 rounded-2xl relative shadow-[0_0_20px_rgba(6,182,212,0.3)]">
              <span className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-cyan-400 rounded-tl-sm"></span>
              <span className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-cyan-400 rounded-tr-sm"></span>
              <span className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-cyan-400 rounded-bl-sm"></span>
              <span className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-cyan-400 rounded-br-sm"></span>
              <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent absolute top-1/2 -translate-y-1/2 animate-pulse"></div>
            </div>
          </div>

          {/* Overlay loading/instructions */}
          {cameraError && (
            <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-4 text-center">
              <AlertCircle className="w-8 h-8 text-amber-400 mb-2" />
              <p className="text-xs text-slate-300 font-medium mb-3">{cameraError}</p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-3.5 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <Upload className="w-3.5 h-3.5" /> Enviar Foto do QR Code
              </button>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="p-4 space-y-3 bg-slate-900">
          <p className="text-[11px] text-center text-slate-400">
            Aponte a câmera para a placa ou totem com o QR Code no balcão do lava-jato.
          </p>

          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              capture="environment"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessingFile}
              className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              {isProcessingFile ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Processando...</span>
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Carregar da Galeria / Foto</span>
                </>
              )}
            </button>
          </div>

          {/* Manual input fallback */}
          <form onSubmit={handleManualSubmit} className="pt-2 border-t border-slate-800 flex gap-2">
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Ou digite o link/código aqui..."
              className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
            />
            <button
              type="submit"
              disabled={!manualCode.trim()}
              className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white font-bold px-3 py-1.5 rounded-lg text-xs cursor-pointer transition shrink-0"
            >
              Confirmar
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};
