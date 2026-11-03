import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { collection, doc, setDoc, deleteDoc, getDocs, query, where } from 'firebase/firestore';
import app, { db } from './firebase';

export const VAPID_PUBLIC_KEY = 'BKYRV7kGXesqIWRIeGL0wCZNdkYyg5qRpP3or6VgvA153TcAjQ0k3ikJA5dvFb2JPbirpoRQmNHUL6drnnPiONM';

/**
 * Converte chave pública VAPID base64 para Uint8Array exigido pelo PushManager
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isPushNotificationSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'serviceWorker' in navigator && 'Notification' in window && 'PushManager' in window;
}

export function getPushNotificationPermission(): NotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'default';
  }
  return Notification.permission;
}

/**
 * Registra o Service Worker oficial de notificações em segundo plano (/firebase-messaging-sw.js)
 */
export async function getOrRegisterPushServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushNotificationSupported()) return null;

  try {
    const existing = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
    if (existing && existing.active) {
      return existing;
    }

    const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/'
    });

    await navigator.serviceWorker.ready;
    console.log('✅ [Push Service] Service Worker registrado com sucesso:', reg.scope);
    return reg;
  } catch (err) {
    console.warn('⚠️ [Push Service] Falha ao registrar Service Worker:', err);
    return null;
  }
}

export interface PushSubscriptionResult {
  success: boolean;
  permission: NotificationPermission;
  token?: string;
  subscription?: PushSubscription | null;
  errorMessage?: string;
}

/**
 * Solicita autorização de notificações ao usuário no navegador,
 * gera a inscrição Web Push + Token FCM e grava no Firestore da empresa
 */
export async function requestPushPermissionAndSubscribe(
  tenantId: string,
  tenantName: string = 'Lava-Jato'
): Promise<PushSubscriptionResult> {
  if (!isPushNotificationSupported()) {
    return {
      success: false,
      permission: 'denied',
      errorMessage: 'Este navegador não suporta notificações Push em segundo plano.'
    };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return {
        success: false,
        permission,
        errorMessage: permission === 'denied' 
          ? 'Notificações foram bloqueadas no navegador. Clique no cadeado na barra de endereços para permitir.'
          : 'A permissão de notificações não foi concedida.'
      };
    }

    const swReg = await getOrRegisterPushServiceWorker();
    if (!swReg) {
      return {
        success: false,
        permission: 'granted',
        errorMessage: 'Não foi possível inicializar o Service Worker no navegador.'
      };
    }

    // 1. Gera inscrição nativa Web Push com o par de chaves VAPID
    let subscription = await swReg.pushManager.getSubscription();
    if (!subscription) {
      const convertedKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      subscription = await swReg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey
      });
      console.log('📡 [Push Service] Nova inscrição Web Push criada');
    }

    // 2. Tenta obter token FCM compatível via Firebase Messaging
    let fcmToken = '';
    try {
      const messaging = getMessaging(app);
      fcmToken = await getToken(messaging, {
        vapidKey: VAPID_PUBLIC_KEY,
        serviceWorkerRegistration: swReg
      });
      console.log('🔥 [FCM] Token obtido com sucesso:', fcmToken ? `${fcmToken.substring(0, 15)}...` : 'vazio');
    } catch (fcmErr) {
      console.log('ℹ️ [FCM notice] Fallback nativo Web Push ativo:', fcmErr);
    }

    const cleanTId = tenantId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const subJson = subscription ? subscription.toJSON() : null;
    const deviceId = btoa(navigator.userAgent.slice(0, 40) + window.screen.width + window.screen.height)
      .replace(/[^a-zA-Z0-9]/g, '').slice(0, 20);
    const tokenDocId = `device_${deviceId}`;

    // 3. Salva no Firestore sob a coleção de tokens da empresa
    try {
      const tokenPayload = {
        id: tokenDocId,
        tenantId: cleanTId,
        tenantName,
        fcmToken: fcmToken || null,
        subscription: subJson,
        endpoint: subscription?.endpoint || null,
        userAgent: navigator.userAgent,
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'tenants', cleanTId, 'fcm_tokens', tokenDocId), tokenPayload, { merge: true });
      console.log(`💾 [Push Service] Token/Assinatura salvos no Firestore para o lava-jato ${cleanTId}`);
    } catch (dbErr) {
      console.warn('Aviso ao gravar token no Firestore:', dbErr);
    }

    // 4. Registra no servidor backend Node.js (/api/register-push-subscription)
    try {
      await fetch('/api/register-push-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: cleanTId,
          tenantName,
          tokenDocId,
          subscription: subJson,
          fcmToken
        })
      });
    } catch (_) {}

    // 5. Salva status ativo no localStorage para persistência de UI
    try {
      localStorage.setItem(`saas_push_enabled_${cleanTId}`, 'true');
      localStorage.setItem(`saas_push_doc_${cleanTId}`, tokenDocId);
    } catch (_) {}

    return {
      success: true,
      permission: 'granted',
      token: fcmToken,
      subscription
    };

  } catch (err: any) {
    console.error('Erro ao configurar notificações Push:', err);
    return {
      success: false,
      permission: Notification.permission,
      errorMessage: err.message || 'Falha ao ativar notificações Push.'
    };
  }
}

/**
 * Desativa notificações push para a empresa neste dispositivo
 */
export async function disablePushNotifications(tenantId: string): Promise<boolean> {
  try {
    const cleanTId = tenantId.replace(/[^a-zA-Z0-9_-]/g, '_');
    if (isPushNotificationSupported()) {
      const reg = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
      if (reg) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await sub.unsubscribe();
        }
      }
    }

    const tokenDocId = localStorage.getItem(`saas_push_doc_${cleanTId}`);
    if (tokenDocId) {
      try {
        await deleteDoc(doc(db, 'tenants', cleanTId, 'fcm_tokens', tokenDocId));
      } catch (_) {}
    }

    localStorage.removeItem(`saas_push_enabled_${cleanTId}`);
    return true;
  } catch (err) {
    console.warn('Erro ao desativar push:', err);
    return false;
  }
}

/**
 * Dispara notificação Push em segundo plano para o lava-jato
 * quando um novo cliente se cadastra no Totem
 */
export async function sendTotemPushNotification(params: {
  tenantId: string;
  clientName: string;
  phone?: string;
  vehicle?: string;
  plate?: string;
  carWashName?: string;
}): Promise<{ success: boolean; sentCount?: number }> {
  const cleanTId = params.tenantId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const carWash = params.carWashName || 'Lava-Jato';
  const vehicleDesc = params.vehicle || (params.plate ? `Placa: ${params.plate}` : 'Veículo');

  const title = `🚨 Novo Cadastro no Totem! - ${params.clientName}`;
  const body = `🚘 ${params.clientName} acabou de se cadastrar no Totem de ${carWash}!\nVeículo: ${vehicleDesc}\nTelefone: ${params.phone || 'Não informado'}`;
  const url = `/?empresa=${encodeURIComponent(cleanTId)}&aba=clientes`;

  console.log(`📡 [Push Service] Despachando push notification do Totem para tenant ${cleanTId}...`);

  // 1. Envia via endpoint do servidor Express (/api/send-totem-push)
  let serverResult = false;
  let sentCount = 0;
  try {
    const res = await fetch('/api/send-totem-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: cleanTId,
        title,
        body,
        url,
        clientName: params.clientName,
        phone: params.phone,
        vehicle: vehicleDesc,
        plate: params.plate
      })
    });
    const data = await res.json();
    serverResult = !!data.success;
    sentCount = data.sentCount || 0;
  } catch (apiErr) {
    console.warn('⚠️ [Push Service] Falha ao chamar /api/send-totem-push:', apiErr);
  }

  // 2. Grava evento no Firestore em /tenants/{tenantId}/totem_notifications
  try {
    const notifId = `totem_notif_${Date.now()}`;
    await setDoc(doc(db, 'tenants', cleanTId, 'totem_notifications', notifId), {
      id: notifId,
      tenantId: cleanTId,
      title,
      body,
      clientName: params.clientName,
      phone: params.phone || '',
      vehicle: vehicleDesc,
      plate: params.plate || '',
      url,
      read: false,
      createdAt: new Date().toISOString()
    });
  } catch (fsErr) {
    console.warn('Aviso ao registrar notificação no Firestore:', fsErr);
  }

  // 3. Se o navegador tiver permissão concedida e Service Worker ativo nesta máquina,
  // exibe notificação local garantida imediatamente
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
        if (reg) {
          reg.showNotification(title, {
            body,
            icon: '/pwa-192x192.png',
            badge: '/pwa-192x192.png',
            vibrate: [250, 100, 250, 100, 400],
            tag: `totem-direct-${Date.now()}`,
            data: { url, clientName: params.clientName, tenantId: cleanTId }
          } as any);
        }
      }
    } catch (_) {}
  }

  return { success: serverResult || true, sentCount };
}

/**
 * Envia uma notificação de teste para o proprietário validar o recebimento
 */
export async function sendTestPushNotification(
  tenantId: string,
  carWashName: string = 'Seu Lava-Jato'
): Promise<{ success: boolean; message: string }> {
  try {
    const cleanTId = tenantId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const title = `🔔 Teste de Notificação Push - ${carWashName}`;
    const body = `Tudo pronto! Seu navegador está configurado para receber alertas em tempo real mesmo com o painel fechado.`;
    const url = `/?empresa=${encodeURIComponent(cleanTId)}&aba=clientes`;

    // 1. Tenta envio pelo backend
    const res = await fetch('/api/send-totem-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: cleanTId,
        title,
        body,
        url,
        clientName: 'Cliente Teste (Totem)',
        phone: '(11) 99999-8888',
        vehicle: 'Honda Civic Preto',
        plate: 'BRA2E19'
      })
    });
    const result = await res.json();

    // 2. Dispara notificação local pelo Service Worker como confirmação imediata
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      const reg = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
      if (reg) {
        await reg.showNotification(title, {
          body,
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          vibrate: [200, 100, 200],
          tag: 'test-push-' + Date.now(),
          data: { url }
        } as any);
      }
    }

    return {
      success: true,
      message: result.sentCount > 0 
        ? `Notificação enviada com sucesso para ${result.sentCount} dispositivo(s)!`
        : 'Notificação de teste gerada com sucesso no seu dispositivo!'
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Falha ao despachar notificação de teste.'
    };
  }
}
