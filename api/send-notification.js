const webpush = require('web-push');
const { createClient } = require('@supabase/supabase-js');

// Yalnızca aynı işlev örneğindeki ani tekrarları azaltır.
// Dağıtık koruma veya kullanıcı doğrulaması yerine geçmez.
const requestWindows = new Map();
function allowRequest(ip){
  const now = Date.now();
  for(const [key, value] of requestWindows) if(value.until <= now) requestWindows.delete(key);
  const window = requestWindows.get(ip) || { count: 0, until: now + 60000 };
  if(window.count >= 20) return false;
  if(!requestWindows.has(ip) && requestWindows.size >= 256) return false;
  window.count++;
  requestWindows.set(ip, window);
  return true;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if(req.method !== 'POST'){
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Yalnızca POST destekleniyor.' });
  }
  // Tarayıcılar arası istekleri engeller; oturum doğrulaması değildir.
  let origin;
  try{ origin = new URL(req.headers.origin); }catch(error){}
  if(!origin || origin.host !== req.headers.host || !['https:', 'http:'].includes(origin.protocol)){
    return res.status(403).json({ error: 'İstek kaynağı geçersiz.' });
  }
  if(!String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')){
    return res.status(415).json({ error: 'JSON gerekli.' });
  }
  const { title, body = '', excludeOwner = null, type = null } = req.body || {};
  if(typeof title !== 'string' || !title.trim() || title.length > 100 || typeof body !== 'string' || body.length > 500 ||
    ![null, 'Furki', 'Hilalişko'].includes(excludeOwner) || ![null, 'chat'].includes(type)){
    return res.status(400).json({ error: 'Bildirim içeriği geçersiz.' });
  }
  const ip = String(req.headers['x-vercel-forwarded-for'] || req.socket?.remoteAddress || 'unknown');
  if(!allowRequest(ip)){
    res.setHeader('Retry-After', '60');
    return res.status(429).json({ error: 'Çok sık istek gönderildi. Biraz sonra tekrar dene.' });
  }
  if(!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY ||
    !process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY){
    return res.status(503).json({ error: 'Bildirim hizmeti henüz yapılandırılmamış.' });
  }
  try{
    webpush.setVapidDetails('mailto:site-sahibi@example.com', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(15000) }) }
    });
    const { data: allSubscriptions, error } = await supabase.from('push_subscriptions')
      .select('endpoint,p256dh,auth,owner_name');
    if(error) throw error;
    const subscriptions = (allSubscriptions || []).filter(s => !excludeOwner || s.owner_name !== excludeOwner);
    const url = type === 'chat' ? '/#chat' : title.includes('anı') ? '/#memories' : '/#bucket';
    const payload = JSON.stringify({ title: title.trim(), body, url, type });
    const results = await Promise.allSettled(subscriptions.map(sub => webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, { TTL: 3600, timeout: 10000 }
    )));
    const expired = subscriptions.filter((sub, i) => results[i].status === 'rejected' &&
      [404, 410].includes(results[i].reason?.statusCode)).map(sub => sub.endpoint);
    if(expired.length){
      const { error: cleanupError } = await supabase.from('push_subscriptions').delete().in('endpoint', expired);
      if(cleanupError) console.warn('Süresi biten bildirim abonelikleri temizlenemedi.');
    }
    const sent = results.filter(result => result.status === 'fulfilled').length;
    if(subscriptions.length > 0 && sent === 0){
      return res.status(502).json({ error: 'Bildirim hizmeti yanıt vermedi.', sent, total: subscriptions.length });
    }
    return res.status(200).json({ sent, total: subscriptions.length });
  }catch(error){
    console.error('Bildirim hizmeti isteği başarısız.');
    return res.status(500).json({ error: 'Bildirim gönderilemedi.' });
  }
};
