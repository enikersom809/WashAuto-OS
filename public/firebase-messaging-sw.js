/**
 * Firebase Cloud Messaging & Web Push Service Worker
 * WashAuto OS - Notificações em Segundo Plano com Aba Fechada
 */

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
    const title = payload.notification?.title || payload.data?.title || '🚨 Novo Cliente Cadastrado no Totem!';
    const body = payload.notification?.body || payload.data?.body || 'Novo cliente se cadastrou pelo totem de autoatendimento.';
    const options = {
      body: body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      vibrate: [250, 100, 250, 100, 400],
      tag: payload.data?.tag || ('totem-fcm-' + Date.now()),
      renotify: true,
      requireInteraction: true,
      data: {
        url: payload.data?.url || '/?aba=clientes',
        tenantId: payload.data?.tenantId,
        clientName: payload.data?.clientName,
        receivedAt: Date.now()
      },
      actions: [
        { action: 'open_clients', title: '👥 Ver Clientes' },
        { action: 'dismiss', title: 'Dispensar' }
      ]
    };

    return self.registration.showNotification(title, options);
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

  const title = payload.title || (payload.notification && payload.notification.title) || '🚨 Novo Cliente Cadastrado no Totem!';
  const body = payload.body || (payload.notification && payload.notification.body) || 'Um novo cliente realizou cadastro no autoatendimento.';
  const targetUrl = payload.url || (payload.data && payload.data.url) || '/?aba=clientes';

  const notificationOptions = {
    body: body,
    icon: payload.icon || '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    vibrate: [250, 100, 250, 100, 400],
    tag: payload.tag || ('push-alert-' + Date.now()),
    renotify: true,
    requireInteraction: true,
    data: {
      url: targetUrl,
      tenantId: payload.tenantId || (payload.data && payload.data.tenantId),
      clientName: payload.clientName || (payload.data && payload.data.clientName),
      timestamp: Date.now()
    },
    actions: [
      { action: 'open_clients', title: '👥 Gestão de Clientes' },
      { action: 'dismiss', title: 'Fechar' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, notificationOptions)
  );
});

// 🖱️ Manipulador de clique na notificação Push:
// Quando clicado (mesmo com navegador fechado ou em segundo plano),
// foca a aba existente ou abre uma nova diretamente em 'Gestão de Clientes & Balcão'.
self.addEventListener('notificationclick', function(event) {
  console.log('[SW] Clique na notificação push:', event.action, event.notification.data);
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const targetUrl = (event.notification.data && event.notification.data.url)
    ? event.notification.data.url
    : '/?aba=clientes';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(windowClients) {
      // 1. Procura se já existe uma guia aberta
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if ('focus' in client) {
          try {
            client.postMessage({
              type: 'NAVIGATE_TO_TAB',
              tab: 'clientes',
              source: 'push_notification',
              data: event.notification.data
            });
          } catch (_) {}
          
          if ('navigate' in client && client.url) {
            // Se já está na mesma origem, navega para a aba de clientes
            const urlObj = new URL(client.url);
            urlObj.searchParams.set('aba', 'clientes');
            client.navigate(urlObj.href);
          }
          return client.focus();
        }
      }

      // 2. Se o painel estiver completamente fechado, abre uma nova janela
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
