const SHELL_CACHE = 'biz-shell-2026-11-10-v2';
const SHELL_PATHS = ['/', '/index.html', '/style.css', '/script.js', '/chat.js', '/mobile.js', '/daily-question.js', '/manifest.json',
  '/vendor/supabase.js', '/vendor/cropper.min.js', '/vendor/cropper.min.css',
  '/icons/icon.svg', '/icons/apple-touch-icon.png', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', event => {
  // Önbellek kotası dolu olsa da yeni çalışan çevrimiçi kullanıma geçebilsin.
  event.waitUntil(Promise.resolve().then(() => caches.open(SHELL_CACHE)).then(cache => cache.addAll(SHELL_PATHS))
    .catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(Promise.resolve().then(() => caches.keys()).then(keys => Promise.all(keys
    .filter(key => key.startsWith('biz-shell-') && key !== SHELL_CACHE).map(key => caches.delete(key))))
    .catch(() => {})
    .then(() => self.clients.claim()));
});

// Yalnızca uygulama kabuğu saklanır; mesajlar, API yanıtları ve fotoğraflar saklanmaz.
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if(event.request.method !== 'GET' || url.origin !== self.location.origin || !SHELL_PATHS.includes(url.pathname)) return;
  const network = fetch(event.request);
  // Yaşam süresini olayın içinde uzat; önbellek işlemi yanıt zincirinden tamamen bağımsızdır.
  event.waitUntil(network.then(response => {
    if(response.ok){
      const copy = response.clone();
      // Yazma hatası başarılı ağ yanıtını değiştirmesin veya geciktirmesin.
      return Promise.resolve().then(() => caches.open(SHELL_CACHE)).then(cache => cache.put(event.request, copy));
    }
  }).catch(() => {}));
  event.respondWith(network.catch(async () => {
    try{
      const cached = await caches.match(event.request);
      if(cached) return cached;
      if(event.request.mode === 'navigate') return (await caches.match('/index.html')) || Response.error();
    }catch(error){}
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
