/**
 * Firebase Cloud Messaging & Web Push Service Worker
 * WashAuto OS - Notificações em Segundo Plano com Aba Fechada
 * Suporta alertas para o Dono do Lava-Jato (Totem) e para o Cliente (Status do Veículo)
 */

function resolveNotificationContext(payload) {
  const data = (payload && payload.data) ? payload.data : {};
  const notif = (payload && payload.notification) ? payload.notification : {};
  const isClientStatus =
    data.targetRole === 'cliente' ||
    data.type === 'vehicle_status' ||
    payload.targetRole === 'cliente' ||
    payload.type === 'vehicle_status';

  if (isClientStatus) {
    const title = notif.title || payload.title || data.title || '🚗 Atualização do Seu Veículo!';
    const body = notif.body || payload.body || data.body || 'O status do seu veículo no lava-jato foi atualizado.';
    const tenantParam = data.tenantId || payload.tenantId ? `empresa=${encodeURIComponent(data.tenantId || payload.tenantId)}&` : '';
    const targetUrl = data.url || payload.url || `/?${tenantParam}aba=status`;

    return {
      isClientStatus: true,
      title,
      body,
      targetUrl,
      tab: 'status',
      tag: data.tag || payload.tag || ('client-status-' + (data.plate || Date.now())),
      actions: [
        { action: 'open_status', title: '🚗 Ver Status do Veículo' },
        { action: 'dismiss', title: 'Fechar' }
      ]
    };
  }

  const title = notif.title || payload.title || data.title || '🚨 Novo Cliente Cadastrado no Totem!';
  const body = notif.body || payload.body || data.body || 'Um novo cliente realizou cadastro no autoatendimento.';
  const targetUrl = data.url || payload.url || '/?aba=clientes';

  return {
    isClientStatus: false,
    title,
    body,
    targetUrl,
    tab: 'clientes',
    tag: data.tag || payload.tag || ('totem-fcm-' + Date.now()),
    actions: [
      { action: 'open_clients', title: '👥 Gestão de Clientes' },
      { action: 'dismiss', title: 'Fechar' }
    ]
  };
}

// Importa scripts oficiais de compatibilidade do Firebase Messaging
try {
  importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

  firebase.initializeApp({
    apiKey: "AIzaSyBkoQseuHZuIZDKFTRtpgqOlI7BCVP95yY",
    authDomain: "meulavajatogestaoparalavajato.firebaseapp.com",
    projectId: "meulavajatogestaoparalavajato",
    storageBucket: "meulavajatogestaoparalavajato.firebasestorage.app",
    messagingSenderId: "372328060896",
    appId: "1:372328060896:web:596b7467604aba2a78bd85"
  });

  const messaging = firebase.messaging();

  messaging.onBackgroundMessage(function(payload) {
    console.log('[firebase-messaging-sw.js] onBackgroundMessage recebido:', payload);
    const ctx = resolveNotificationContext(payload);
    const data = (payload && payload.data) ? payload.data : {};

    const options = {
      body: ctx.body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      vibrate: [250, 100, 250, 100, 400],
      tag: ctx.tag,
      renotify: true,
      requireInteraction: true,
      data: {
        url: ctx.targetUrl,
        tab: ctx.tab,
        targetRole: ctx.isClientStatus ? 'cliente' : 'empresa',
        tenantId: data.tenantId,
        clientName: data.clientName,
        plate: data.plate,
        newStatus: data.newStatus,
        receivedAt: Date.now()
      },
      actions: ctx.actions
    };

    return self.registration.showNotification(ctx.title, options);
  });
} catch (err) {
  console.warn('[firebase-messaging-sw.js] Falha ao carregar scripts FCM compat:', err);
}

// 🔔 Ouvinte nativo da Web Push API (RFC 8292 / W3C Push API)
// Garante funcionamento em todos os navegadores mesmo sem scripts externos
self.addEventListener('push', function(event) {
  console.log('[SW] Evento push recebido no Service Worker:', event);
  let payload = {};

  if (event.data) {
    try {
      payload = event.data.json();
    } catch (_) {
      try {
        payload = { title: '🚨 Alerta do Lava-Jato', body: event.data.text() };
      } catch (_) {
        payload = {};
      }
    }
  }

  const ctx = resolveNotificationContext(payload);
  const data = payload.data || {};

  const notificationOptions = {
    body: ctx.body,
    icon: payload.icon || '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    vibrate: [250, 100, 250, 100, 400],
    tag: ctx.tag,
    renotify: true,
    requireInteraction: true,
    data: {
      url: ctx.targetUrl,
      tab: ctx.tab,
      targetRole: ctx.isClientStatus ? 'cliente' : 'empresa',
      tenantId: payload.tenantId || data.tenantId,
      clientName: payload.clientName || data.clientName,
      plate: payload.plate || data.plate,
      newStatus: payload.newStatus || data.newStatus,
      timestamp: Date.now()
    },
    actions: ctx.actions
  };

  event.waitUntil(
    self.registration.showNotification(ctx.title, notificationOptions)
  );
});

// 🖱️ Manipulador de clique na notificação Push:
// Quando clicado (mesmo com navegador fechado ou em segundo plano),
// foca a aba existente ou abre uma nova diretamente na aba correta.
self.addEventListener('notificationclick', function(event) {
  console.log('[SW] Clique na notificação push:', event.action, event.notification.data);
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const notifData = event.notification.data || {};
  const targetTab = notifData.tab || (notifData.targetRole === 'cliente' ? 'status' : 'clientes');
  const targetUrl = notifData.url || (targetTab === 'status' ? '/?aba=status' : '/?aba=clientes');

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(windowClients) {
      // 1. Procura se já existe uma guia aberta
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if ('focus' in client) {
          try {
            client.postMessage({
              type: 'NAVIGATE_TO_TAB',
              tab: targetTab,
              source: 'push_notification',
              data: notifData
            });
          } catch (_) {}

          if ('navigate' in client && client.url) {
            try {
              const urlObj = new URL(client.url);
              urlObj.searchParams.set('aba', targetTab);
              client.navigate(urlObj.href);
            } catch (_) {}
          }
          return client.focus();
        }
      }

      // 2. Se o painel/app estiver completamente fechado, abre uma nova janela
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Mensagens internas entre cliente e Service Worker
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
