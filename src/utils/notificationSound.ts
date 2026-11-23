/**
 * Utilitário de Áudio para Notificações Push e Alertas em Tempo Real
 * Combina Web Audio API (com auto-resume) e fallback em WAV PCM gerado em memória
 * para garantir som audível no computador e celular (inclusive ao testar notificações).
 */

let sharedAudioCtx: AudioContext | null = null;
let cachedWavUrl: string | null = null;
let lastPlayedAt = 0;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
    sharedAudioCtx = new AudioCtx();
  }
  return sharedAudioCtx;
}

/**
 * Gera um arquivo WAV PCM (16-bit mono) em memória com um toque duplo de sino (E5 -> B5)
 * como fallback garantido caso o AudioContext esteja bloqueado ou indisponível.
 */
function getChimeWavUrl(): string | null {
  if (typeof window === 'undefined' || typeof Blob === 'undefined') return null;
  if (cachedWavUrl) return cachedWavUrl;

  try {
    const sampleRate = 22050;
    const durationSec = 0.55;
    const numSamples = Math.floor(sampleRate * durationSec);
    const buffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(buffer);

    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + numSamples * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // PCM chunk size
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, 1, true); // Mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, numSamples * 2, true);

    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      let sample = 0;

      // Nota 1: 659.25 Hz (E5) de 0s a 0.16s
      if (t < 0.18) {
        const env1 = Math.exp(-t * 14);
        sample += Math.sin(2 * Math.PI * 659.25 * t) * 0.45 * env1;
      }

      // Nota 2: 987.77 Hz (B5) + harmônico suave de 0.13s até 0.55s
      if (t >= 0.13) {
        const t2 = t - 0.13;
        const env2 = Math.exp(-t2 * 7.5);
        sample +=
          (Math.sin(2 * Math.PI * 987.77 * t2) * 0.5 +
            Math.sin(2 * Math.PI * 1975.53 * t2) * 0.12) *
          env2;
      }

      const clamped = Math.max(-1, Math.min(1, sample));
      view.setInt16(44 + i * 2, Math.round(clamped * 32767), true);
    }

    const blob = new Blob([buffer], { type: 'audio/wav' });
    cachedWavUrl = URL.createObjectURL(blob);
    return cachedWavUrl;
  } catch {
    return null;
  }
}

/**
 * Desbloqueia o contexto de áudio dentro de um gesto do usuário (clique/toque).
 */
export async function unlockNotificationAudio(): Promise<void> {
  try {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      await ctx.resume();
    }
  } catch (_) {}
}

/**
 * Reproduz um toque de notificação nítido e agradável (duas notas harmônicas).
 */
export async function playNotificationSound(): Promise<boolean> {
  const nowMs = Date.now();
  if (nowMs - lastPlayedAt < 250) {
    return true;
  }
  lastPlayedAt = nowMs;

  // 1. Tenta via Web Audio API (menor latência e controle preciso)
  try {
    const ctx = getAudioContext();
    if (ctx) {
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      if (ctx.state === 'running') {
        const now = ctx.currentTime;

        // Nota 1: E5 (659.25 Hz)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(659.25, now);
        gain1.gain.setValueAtTime(0.001, now);
        gain1.gain.linearRampToValueAtTime(0.32, now + 0.015);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.24);

        // Nota 2: B5 (987.77 Hz)
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(987.77, now + 0.13);
        gain2.gain.setValueAtTime(0.001, now + 0.13);
        gain2.gain.linearRampToValueAtTime(0.35, now + 0.15);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.13);
        osc2.stop(now + 0.57);

        return true;
      }
    }
  } catch (_) {}

  // 2. Fallback via HTMLAudioElement com WAV PCM gerado em memória
  try {
    const wavUrl = getChimeWavUrl();
    if (wavUrl) {
      const audio = new Audio(wavUrl);
      audio.volume = 0.85;
      await audio.play();
      return true;
    }
  } catch (_) {}

  return false;
}
