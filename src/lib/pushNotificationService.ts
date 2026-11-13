import { getMessaging, getToken, onMessage, isSupported as isMessagingSupported } from 'firebase/messaging';
import { collection, doc, setDoc, deleteDoc, getDocs, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import app, { db, handleFirestoreError, OperationType } from './firebase';

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
 * Gera ou recupera um ID único e estável por navegador/dispositivo para o cliente
 */
export function getClientDeviceId(): string {
  if (typeof window === 'undefined') return `client_dev_${Date.now()}`;
  const stored = localStorage.getItem('saas_client_push_device_id');
  if (stored) return stored;

  const fallbackFingerprint = btoa(
    (navigator.userAgent || 'browser').slice(0, 40) +
    String(window.screen?.width || 0) +
    String(window.screen?.height || 0) +
    String(Date.now()).slice(-6)
  ).replace(/[^a-zA-Z0-9]/g, '').slice(0, 24);

  const id = `client_${fallbackFingerprint}`;
  try {
    localStorage.setItem('saas_client_push_device_id', id);
  } catch (_) {}
  return id;
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
 * Solicita autorização de notificações ao usuário no navegador (Painel da Empresa),
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
        applicationServerKey: convertedKey as BufferSource
      });
      console.log('📡 [Push Service] Nova inscrição Web Push criada');
    }

    // 2. Tenta obter token FCM compatível via Firebase Messaging
    let fcmToken = '';
    try {
      const supported = await isMessagingSupported();
      if (supported) {
        const messaging = getMessaging(app);
        fcmToken = await getToken(messaging, {
          vapidKey: VAPID_PUBLIC_KEY,
          serviceWorkerRegistration: swReg
        });
        console.log('🔥 [FCM] Token obtido com sucesso:', fcmToken ? `${fcmToken.substring(0, 15)}...` : 'vazio');
      }
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
      handleFirestoreError(dbErr, OperationType.WRITE, `tenants/${cleanTId}/fcm_tokens/${tokenDocId}`);
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
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `tenants/${cleanTId}/fcm_tokens/${tokenDocId}`);
      }
    }

    localStorage.removeItem(`saas_push_enabled_${cleanTId}`);
    return true;
  } catch (err) {
    console.warn('Erro ao desativar push:', err);
    return false;
  }
}

// =========================================================================
// 🚗 NOTIFICAÇÕES PUSH FCM PARA O CLIENTE (STATUS DO VEÍCULO)
// =========================================================================

export interface ClientPushParams {
  tenantId: string;
  tenantName?: string;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  plates?: string[];
}

/**
 * Solicita permissão de Push FCM para o CLIENTE e vincula este dispositivo
 * ao seu telefone, e-mail e placas no Firestore e servidor Express.
 */
export async function requestClientPushPermissionAndSubscribe(
  params: ClientPushParams
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
          ? 'As notificações estão bloqueadas no navegador. Libere no ícone de cadeado ao lado do endereço.'
          : 'A permissão para notificações não foi aceita.'
      };
    }

    const swReg = await getOrRegisterPushServiceWorker();
    if (!swReg) {
      return {
        success: false,
        permission: 'granted',
        errorMessage: 'Não foi possível inicializar o Service Worker de notificações.'
      };
    }

    let subscription = await swReg.pushManager.getSubscription();
    if (!subscription) {
      const convertedKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      subscription = await swReg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey as BufferSource
      });
    }

    let fcmToken = '';
    try {
      const supported = await isMessagingSupported();
      if (supported) {
        const messaging = getMessaging(app);
        fcmToken = await getToken(messaging, {
          vapidKey: VAPID_PUBLIC_KEY,
          serviceWorkerRegistration: swReg
        });
        console.log('🔥 [FCM Cliente] Token obtido:', fcmToken ? `${fcmToken.substring(0, 15)}...` : 'vazio');
      }
    } catch (fcmErr) {
      console.log('ℹ️ [FCM Cliente] Fallback Web Push nativo ativo:', fcmErr);
    }

    const cleanTId = params.tenantId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const subJson = subscription ? subscription.toJSON() : null;
    const tokenDocId = getClientDeviceId();
    const normalizedPlates = Array.isArray(params.plates)
      ? params.plates.map(p => String(p || '').toUpperCase().replace(/[^A-Z0-9]/g, '')).filter(Boolean)
      : [];
    const phoneDigits = String(params.clientPhone || '').replace(/\D/g, '');
    const cleanEmail = String(params.clientEmail || '').trim().toLowerCase();

    try {
      const tokenPayload = {
        id: tokenDocId,
        tenantId: cleanTId,
        tenantName: params.tenantName || 'Lava-Jato',
        role: 'cliente',
        clientName: params.clientName || 'Cliente',
        clientPhone: params.clientPhone || '',
        phoneDigits,
        clientEmail: cleanEmail,
        plates: normalizedPlates,
        fcmToken: fcmToken || null,
        subscription: subJson,
        endpoint: subscription?.endpoint || null,
        userAgent: navigator.userAgent,
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'tenants', cleanTId, 'client_fcm_tokens', tokenDocId), tokenPayload, { merge: true });
    } catch (dbErr) {
      handleFirestoreError(dbErr, OperationType.WRITE, `tenants/${cleanTId}/client_fcm_tokens/${tokenDocId}`);
    }

    try {
      await fetch('/api/register-client-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: cleanTId,
          tokenDocId,
          subscription: subJson,
          fcmToken,
          clientName: params.clientName,
          clientPhone: params.clientPhone,
          clientEmail: cleanEmail,
          plates: normalizedPlates
        })
      });
    } catch (_) {}

    try {
      localStorage.setItem(`saas_client_push_enabled_${cleanTId}`, 'true');
      localStorage.setItem(`saas_client_push_doc_${cleanTId}`, tokenDocId);
    } catch (_) {}

    return {
      success: true,
      permission: 'granted',
      token: fcmToken,
      subscription
    };
  } catch (err: any) {
    console.error('Erro ao ativar notificações push do cliente:', err);
    return {
      success: false,
      permission: Notification.permission,
      errorMessage: err.message || 'Falha ao ativar alertas push.'
    };
  }
}

/**
 * Atualiza silenciosamente placas, telefone e e-mail vinculados ao token push do cliente
 */
export async function syncClientPushMetadata(params: ClientPushParams): Promise<void> {
  if (typeof window === 'undefined' || !isPushNotificationSupported()) return;
  const cleanTId = params.tenantId.replace(/[^a-zA-Z0-9_-]/g, '_');
  if (Notification.permission !== 'granted') return;
  if (localStorage.getItem(`saas_client_push_enabled_${cleanTId}`) !== 'true') return;

  try {
    const swReg = await getOrRegisterPushServiceWorker();
    const subscription = swReg ? await swReg.pushManager.getSubscription() : null;
    const subJson = subscription ? subscription.toJSON() : null;
    const tokenDocId = getClientDeviceId();
    const normalizedPlates = Array.isArray(params.plates)
      ? params.plates.map(p => String(p || '').toUpperCase().replace(/[^A-Z0-9]/g, '')).filter(Boolean)
      : [];
    const phoneDigits = String(params.clientPhone || '').replace(/\D/g, '');
    const cleanEmail = String(params.clientEmail || '').trim().toLowerCase();

    await setDoc(doc(db, 'tenants', cleanTId, 'client_fcm_tokens', tokenDocId), {
      clientName: params.clientName || 'Cliente',
      clientPhone: params.clientPhone || '',
      phoneDigits,
      clientEmail: cleanEmail,
      plates: normalizedPlates,
      subscription: subJson || undefined,
      active: true,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    if (subscription) {
      await fetch('/api/register-client-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: cleanTId,
          tokenDocId,
          subscription: subJson,
          clientName: params.clientName,
          clientPhone: params.clientPhone,
          clientEmail: cleanEmail,
          plates: normalizedPlates
        })
      }).catch(() => {});
    }
  } catch (_) {}
}

/**
 * Desativa notificações push de status do veículo para o cliente neste dispositivo
 */
export async function disableClientPushNotifications(tenantId: string): Promise<boolean> {
  try {
    const cleanTId = tenantId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const tokenDocId = localStorage.getItem(`saas_client_push_doc_${cleanTId}`) || getClientDeviceId();

    if (isPushNotificationSupported()) {
      const reg = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
      if (reg) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await sub.unsubscribe();
        }
      }
    }

    try {
      await deleteDoc(doc(db, 'tenants', cleanTId, 'client_fcm_tokens', tokenDocId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `tenants/${cleanTId}/client_fcm_tokens/${tokenDocId}`);
    }

    localStorage.removeItem(`saas_client_push_enabled_${cleanTId}`);
    return true;
  } catch (err) {
    console.warn('Erro ao desativar push do cliente:', err);
    return false;
  }
}

/**
 * Escuta mensagens FCM enquanto o aplicativo do cliente está aberto (Foreground)
 */
export function listenForegroundClientPushMessages(
  onReceive: (payload: { title: string; body: string; data?: Record<string, any> }) => void
): () => void {
  let active = true;
  let unsubscribeFn: (() => void) | null = null;

  isMessagingSupported()
    .then((supported) => {
      if (!supported || !active) return;
      try {
        const messaging = getMessaging(app);
        unsubscribeFn = onMessage(messaging, (payload) => {
          const title = payload.notification?.title || payload.data?.title || '🚗 Atualização do Veículo';
          const body = payload.notification?.body || payload.data?.body || 'O status do seu veículo mudou.';
          onReceive({ title, body, data: payload.data });
        });
      } catch (_) {}
    })
    .catch(() => {});

  return () => {
    active = false;
    if (unsubscribeFn) {
      try { unsubscribeFn(); } catch (_) {}
    }
  };
}

export interface ClientStatusNotificationRecord {
  id: string;
  tenantId: string;
  title: string;
  body: string;
  clientName?: string;
  clientPhone?: string;
  phoneDigits?: string;
  clientEmail?: string;
  vehicle: string;
  plate: string;
  newStatus: string;
  source?: string;
  url: string;
  read?: boolean;
  createdAt: string;
}

/**
 * Escuta em tempo real as notificações de status do veículo salvas no Firestore
 * exclusivamente para o cliente conectado (match por telefone, e-mail ou placa).
 */
export function subscribeToClientStatusNotifications(
  tenantId: string,
  clientIdentifiers: { phone?: string; email?: string; plates?: string[] },
  callback: (notifications: ClientStatusNotificationRecord[]) => void
): () => void {
  try {
    const cleanTId = tenantId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const colRef = collection(db, 'tenants', cleanTId, 'client_notifications');
    const q = query(colRef, orderBy('createdAt', 'desc'), limit(20));

    const targetPhone = String(clientIdentifiers.phone || '').replace(/\D/g, '');
    const targetEmail = String(clientIdentifiers.email || '').trim().toLowerCase();
    const targetPlates = new Set(
      (clientIdentifiers.plates || []).map(p => String(p || '').toUpperCase().replace(/[^A-Z0-9]/g, '')).filter(Boolean)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: ClientStatusNotificationRecord[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as ClientStatusNotificationRecord;
        const dPhone = String(data.phoneDigits || data.clientPhone || '').replace(/\D/g, '');
        const dEmail = String(data.clientEmail || '').trim().toLowerCase();
        const dPlate = String(data.plate || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

        const matchPhone = targetPhone.length >= 8 && dPhone.length >= 8 && (dPhone.includes(targetPhone) || targetPhone.includes(dPhone));
        const matchEmail = targetEmail.includes('@') && dEmail === targetEmail;
        const matchPlate = dPlate && targetPlates.has(dPlate);

        if (matchPhone || matchEmail || matchPlate) {
          items.push({ ...data, id: docSnap.id });
        }
      });
      callback(items);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `tenants/${cleanTId}/client_notifications`);
    });

    return unsubscribe;
  } catch (err) {
    console.warn('subscribeToClientStatusNotifications init error:', err);
    return () => {};
  }
}

/**
 * Monta mensagem amigável e dispara notificação Push FCM + Web Push para o CLIENTE
 * sempre que o status do veículo no lava-jato for alterado.
 */
export async function sendClientVehicleStatusPushNotification(params: {
  tenantId: string;
  tenantName?: string;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  vehicle: string;
  plate?: string;
  service?: string;
  newStatus: string;
  customTitle?: string;
  customBody?: string;
  source?: 'patio' | 'agendamento' | 'leva_e_traz';
}): Promise<{ success: boolean; sentCount?: number }> {
  const cleanTId = params.tenantId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const carWash = params.tenantName || 'Lava-Jato';
  const vehicleLabel = params.plate
    ? `${params.vehicle} (${params.plate.toUpperCase()})`
    : params.vehicle || 'Seu Veículo';

  let title = params.customTitle || '';
  let body = params.customBody || '';

  if (!title || !body) {
    const st = params.newStatus;
    if (st === 'Aguardando') {
      title = `⏳ Na Fila do Pátio - ${carWash}`;
      body = `Seu ${vehicleLabel} deu entrada e aguarda o início do serviço${params.service ? ` (${params.service})` : ''}.`;
    } else if (st === 'Em Execução' || st === 'Em Lavagem') {
      title = `🫧 Lavagem Iniciada! - ${carWash}`;
      body = `Boa notícia! Seu ${vehicleLabel} entrou em lavagem neste momento${params.service ? ` (${params.service})` : ''}.`;
    } else if (st === 'Concluído' || st === 'concluido') {
      title = `✅ Veículo Pronto para Retirada!`;
      body = `Seu ${vehicleLabel} acabou de ser finalizado em ${carWash}! Já está limpo e pronto.`;
    } else if (st === 'Aprovado') {
      title = `📅 Agendamento Aprovado! - ${carWash}`;
      body = `Seu agendamento para ${vehicleLabel} foi confirmado pela equipe.`;
    } else if (st === 'Cancelado' || st === 'cancelado') {
      title = `❌ Atendimento Cancelado - ${carWash}`;
      body = `O atendimento para ${vehicleLabel} foi marcado como cancelado.`;
    } else if (st === 'motorista_a_caminho') {
      title = `🚗 Motorista a Caminho da Coleta!`;
      body = `O motorista de ${carWash} saiu para buscar seu ${vehicleLabel}.`;
    } else if (st === 'coletado') {
      title = `🔑 Veículo Coletado com Segurança!`;
      body = `Seu ${vehicleLabel} foi coletado e está a caminho de ${carWash}.`;
    } else if (st === 'no_patio') {
      title = `🫧 Veículo Chegou ao Pátio!`;
      body = `Seu ${vehicleLabel} chegou em ${carWash} e já está na operação de lavagem.`;
    } else if (st === 'em_entrega') {
      title = `🚚 Motorista Saindo para Entrega!`;
      body = `Seu ${vehicleLabel} já está limpo e o motorista está a caminho para entregá-lo!`;
    } else if (st === 'entregue') {
      title = `✨ Veículo Entregue com Sucesso!`;
      body = `Entrega concluída do seu ${vehicleLabel}. Obrigado pela preferência em ${carWash}!`;
    } else {
      title = `🚗 Status Atualizado: ${st}`;
      body = `Seu ${vehicleLabel} em ${carWash} agora está com status: ${st}.`;
    }
  }

  const url = `/?empresa=${encodeURIComponent(cleanTId)}&aba=status`;
  const phoneDigits = String(params.clientPhone || '').replace(/\D/g, '');
  const cleanEmail = String(params.clientEmail || '').trim().toLowerCase();
  const cleanPlate = String(params.plate || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

  // 1. Busca assinaturas e tokens FCM do cliente armazenados no Firestore
  const targetSubscriptions: any[] = [];
  try {
    const tokensCol = collection(db, 'tenants', cleanTId, 'client_fcm_tokens');
    const q = query(tokensCol, where('active', '==', true));
    const snaps = await getDocs(q);
    snaps.forEach((docSnap) => {
      const data = docSnap.data();
      const dPhone = String(data.phoneDigits || data.clientPhone || '').replace(/\D/g, '');
      const dEmail = String(data.clientEmail || '').trim().toLowerCase();
      const dPlates: string[] = Array.isArray(data.plates) ? data.plates : [];

      const matchPhone = phoneDigits.length >= 8 && dPhone.length >= 8 && (dPhone.includes(phoneDigits) || phoneDigits.includes(dPhone));
      const matchEmail = cleanEmail.includes('@') && dEmail === cleanEmail;
      const matchPlate = cleanPlate && dPlates.includes(cleanPlate);

      if (matchPhone || matchEmail || matchPlate) {
        if (data.subscription && data.subscription.endpoint) {
          targetSubscriptions.push(data.subscription);
        }
      }
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, `tenants/${cleanTId}/client_fcm_tokens`);
  }

  // 2. Grava evento de notificação no Firestore para atualização instantânea em foreground/histórico do cliente
  try {
    const notifId = `client_notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    await setDoc(doc(db, 'tenants', cleanTId, 'client_notifications', notifId), {
      id: notifId,
      tenantId: cleanTId,
      title,
      body,
      clientName: params.clientName || '',
      clientPhone: params.clientPhone || '',
      phoneDigits,
      clientEmail: cleanEmail,
      vehicle: params.vehicle || '',
      plate: cleanPlate,
      newStatus: params.newStatus,
      source: params.source || 'patio',
      url,
      read: false,
      createdAt: new Date().toISOString()
    });
  } catch (fsErr) {
    handleFirestoreError(fsErr, OperationType.WRITE, `tenants/${cleanTId}/client_notifications`);
  }

  // 3. Dispara Web Push via servidor backend Express para dispositivos em segundo plano / aba fechada
  let sentCount = 0;
  let serverResult = false;
  try {
    const res = await fetch('/api/send-client-status-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: cleanTId,
        title,
        body,
        url,
        clientName: params.clientName || '',
        clientPhone: params.clientPhone || '',
        clientEmail: cleanEmail,
        plate: params.plate || '',
        vehicle: params.vehicle || '',
        newStatus: params.newStatus,
        targetSubscriptions
      })
    });
    const data = await res.json();
    serverResult = !!data.success;
    sentCount = data.sentCount || 0;
  } catch (apiErr) {
    console.warn('⚠️ [Push Cliente] Falha ao chamar /api/send-client-status-push:', apiErr);
  }

  return { success: serverResult || true, sentCount };
}

/**
 * Envia uma notificação de teste no navegador para o cliente validar o recebimento
 */
export async function sendClientTestPushNotification(
  params: ClientPushParams
): Promise<{ success: boolean; message: string }> {
  try {
    const cleanTId = params.tenantId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const title = `🚗 Teste de Alerta - ${params.tenantName || 'Portal do Cliente'}`;
    const body = `Notificações ativadas! Você será avisado instantaneamente sempre que seu veículo mudar de status no lava-jato.`;
    const url = `/?empresa=${encodeURIComponent(cleanTId)}&aba=status`;

    // 1. Dispara via backend se houver assinatura registrada
    await fetch('/api/send-client-status-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: cleanTId,
        title,
        body,
        url,
        clientName: params.clientName || 'Cliente',
        clientPhone: params.clientPhone || '',
        clientEmail: params.clientEmail || '',
        plate: params.plates?.[0] || '',
        vehicle: 'Seu Veículo',
        newStatus: 'Teste'
      })
    }).catch(() => {});

    // 2. Confirmação local pelo Service Worker
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      const reg = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
      if (reg) {
        await reg.showNotification(title, {
          body,
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          vibrate: [200, 100, 200],
          tag: 'client-test-push-' + Date.now(),
          data: { url, tab: 'status', targetRole: 'cliente', tenantId: cleanTId }
        } as any);
      }
    }

    return {
      success: true,
      message: 'Alerta Push de teste enviado! Verifique a notificação no seu dispositivo.'
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Falha ao enviar alerta de teste.'
    };
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
    handleFirestoreError(fsErr, OperationType.WRITE, `tenants/${cleanTId}/totem_notifications`);
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
