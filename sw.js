const SHELL_CACHE = 'biz-shell-2026-11-10-v1';
const SHELL_PATHS = ['/', '/index.html', '/style.css', '/script.js', '/chat.js', '/manifest.json',
  '/vendor/supabase.js', '/vendor/cropper.min.js', '/vendor/cropper.min.css'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL_CACHE).then(cache => cache.addAll(SHELL_PATHS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key.startsWith('biz-shell-') && key !== SHELL_CACHE).map(key => caches.delete(key))))
    .then(() => self.clients.claim()));
});

// Yalnızca uygulama kabuğu saklanır; mesajlar, API yanıtları ve fotoğraflar saklanmaz.
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if(event.request.method !== 'GET' || url.origin !== self.location.origin || !SHELL_PATHS.includes(url.pathname)) return;
  const network = fetch(event.request).then(async response => {
    if(response.ok){
      const cache = await caches.open(SHELL_CACHE);
      await cache.put(event.request, response.clone());
    }
    return response;
  });
  event.respondWith(network.catch(async () => {
    const cached = await caches.match(event.request);
    if(cached) return cached;
    if(event.request.mode === 'navigate') return (await caches.match('/index.html')) || Response.error();
    return Response.error();
  }));
});

function safeNotificationUrl(value){
  try{
    const url = new URL(value || '/', self.location.origin);
    return url.origin === self.location.origin ? url.href : self.location.origin + '/';
  }catch(error){ return self.location.origin + '/'; }
}

self.addEventListener('push', event => {
  let data = {};
  try{ data = event.data?.json() || {}; }
  catch(error){ data = { body: event.data?.text() || '' }; }
  const icon = 'https://gxsagwouvimjlzbovyay.supabase.co/storage/v1/object/public/memory-photos/resim1.jpg';
  const options = { body: data.body || '', icon, badge: icon,
    data: { url: safeNotificationUrl(data.url) } };
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
    const viewingChat = data.type === 'chat' && clients.some(client =>
      client.visibilityState === 'visible' && client.focused && new URL(client.url).hash === '#chat');
    if(viewingChat) return;
    return self.registration.showNotification(data.title || 'Biz 💗', options);
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = safeNotificationUrl(event.notification.data?.url);
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async clients => {
    for(const client of clients){
      if(new URL(client.url).origin === self.location.origin && 'focus' in client){
        const navigated = await client.navigate(url);
        return (navigated || client).focus();
      }
    }
    return self.clients.openWindow(url);
  }));
});
