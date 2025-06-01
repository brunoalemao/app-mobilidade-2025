// Service Worker para notificações
self.addEventListener('install', (event) => {
  console.log('Service Worker instalado');
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker ativado');
});

// Lidar com notificações push
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      ...data.options,
      icon: data.options.icon || '/car-icon.png',
      badge: data.options.badge || '/logo192.png',
      vibrate: data.options.vibrate || [200, 100, 200],
      requireInteraction: true
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

// Lidar com cliques em notificações
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Se tiver um rideId nos dados, redirecionar para a página da corrida
  if (event.notification.data && event.notification.data.rideId) {
    event.waitUntil(
      clients.openWindow(`/ride/${event.notification.data.rideId}`)
    );
  } else {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
}); 