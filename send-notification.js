const webpush = require('web-push');
const { createClient } = require('@supabase/supabase-js');

webpush.setVapidDetails(
  'mailto:site-sahibi@example.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { title, body } = req.body || {};
  if (!title) {
    res.status(400).json({ error: 'title gerekli' });
    return;
  }

  const { data: subscriptions, error } = await supabase
    .from('push_subscriptions')
    .select('*');

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const payload = JSON.stringify({ title, body: body || '', url: '/' });

  const results = await Promise.allSettled(
    (subscriptions || []).map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      )
    )
  );

  // Artık geçersiz olan (kullanıcının bildirimi kapattığı) abonelikleri temizle
  const toDelete = [];
  results.forEach((r, i) => {
    if (r.status === 'rejected' && (r.reason.statusCode === 404 || r.reason.statusCode === 410)) {
      toDelete.push(subscriptions[i].endpoint);
    }
  });
  if (toDelete.length > 0) {
    await supabase.from('push_subscriptions').delete().in('endpoint', toDelete);
  }

  res.status(200).json({ sent: results.filter((r) => r.status === 'fulfilled').length });
};
