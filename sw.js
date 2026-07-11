// Bu dosya, push bildirimi geldiğinde arka planda çalışıp
// telefonda bildirimi gösteren "service worker" betiğidir.

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'Biz 💗', body: event.data ? event.data.text() : 'Yeni bir bildirim var' };
  }

  const title = data.title || 'Biz 💗';
  const icon = 'https://gxsagwouvimjlzbovyay.supabase.co/storage/v1/object/public/memory-photos/resim1.jpg';

  const options = {
    body: data.body || '',
    icon: icon,
    badge: icon,
    data: { url: data.url || '/' }
  };

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Bu bir sohbet mesajıysa ve açık bir pencere zaten Mesajlar sekmesini
      // gösteriyorsa, bildirimi hiç göstermeye gerek yok (WhatsApp'taki gibi)
      const alreadyViewingChat = data.type === 'chat' && clientList.some((client) => client.url.includes('#chat'));
      if (alreadyViewingChat) {
        return;
      }
      return self.registration.showNotification(title, options);
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
