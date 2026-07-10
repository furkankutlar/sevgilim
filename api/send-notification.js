const webpush = require('web-push');
const { createClient } = require('@supabase/supabase-js');

webpush.setVapidDetails(
  'mailto:site-sahibi@example.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const { title, body, excludeOwner } = req.body || {};
    if (!title) {
      res.status(400).json({ error: 'title gerekli' });
      return;
    }

    const { data: allSubscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('*');

    if (error) {
      console.error('Supabase select hatası:', error);
      res.status(500).json({ error: error.message });
      return;
    }

    // Bir sohbet mesajı gönderenin kendi cihazına bildirim gitmesini istemiyoruz
    const subscriptions = excludeOwner
      ? (allSubscriptions || []).filter((s) => s.owner_name !== excludeOwner)
      : (allSubscriptions || []);

    console.log(`Bulunan abonelik sayısı: ${(allSubscriptions || []).length}, gönderilecek: ${subscriptions.length}`);

    const payload = JSON.stringify({ title, body: body || '', url: '/' });

    const results = await Promise.allSettled(
      (subscriptions || []).map((sub) =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        )
      )
    );

    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.error(`Gönderim hatası (${i}):`, r.reason && r.reason.message ? r.reason.message : r.reason);
      }
    });

    const toDelete = [];
    results.forEach((r, i) => {
      if (r.status === 'rejected' && (r.reason.statusCode === 404 || r.reason.statusCode === 410)) {
        toDelete.push(subscriptions[i].endpoint);
      }
    });
    if (toDelete.length > 0) {
      await supabase.from('push_subscriptions').delete().in('endpoint', toDelete);
    }

    res.status(200).json({ sent: results.filter((r) => r.status === 'fulfilled').length, total: (subscriptions || []).length });
  } catch (err) {
    console.error('Beklenmeyen hata:', err);
    res.status(500).json({ error: err.message || 'Bilinmeyen hata' });
  }
};
