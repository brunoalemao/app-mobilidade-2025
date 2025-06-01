// Service Worker para notificações
self.addEventListener('install', (event) => {
  console.log('Service Worker instalado');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker ativado');
  event.waitUntil(clients.claim());
});

self.addEventListener('push', (event) => {
  console.log('Notificação push recebida:', event.data?.text());

  const options = {
    body: event.data?.text() || 'Nova notificação',
    icon: '/logo192.png',
    badge: '/logo192.png',
    vibrate: [200, 100, 200],
    requireInteraction: true,
    data: {
      url: '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification('MobiGo', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('Notificação clicada:', event);

  event.notification.close();

  // Focar ou abrir uma nova janela
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Se já tiver uma janela aberta, focar nela
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      // Se não tiver janela aberta, abrir uma nova
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

// Lidar com mensagens do cliente
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
}); 