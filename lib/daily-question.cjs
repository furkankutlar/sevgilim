const { createHash } = require('node:crypto');
const pool = require('../data/questions.tr.json');

function istanbulDate(now = new Date()){
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(now);
  const part = name => parts.find(item => item.type === name).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function validDate(value){
  if(typeof value !== 'string' || !/^20\d{2}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(value + 'T12:00:00Z');
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}

// Bir kez karıştırılmış sabit sıra: her gün ilerler, havuz bitmeden tekrar etmez.
const order = [...pool.questions].sort((a, b) => {
  const hash = item => createHash('sha256').update(`biz:${pool.version}:${item.id}`).digest('hex');
  return hash(a).localeCompare(hash(b));
});
function selectQuestion(date){
  if(!validDate(date)) throw new TypeError('Geçersiz tarih.');
  const day = Math.floor(Date.parse(date + 'T00:00:00Z') / 86400000);
  return order[((day % order.length) + order.length) % order.length];
}

function createQuestionService(fetcher = globalThis.fetch){
  let checkedAt = 0;
  let originals = new Set();
  let pending = null;
  async function checkSource(){
    if(checkedAt && Date.now() - checkedAt < 6 * 60 * 60 * 1000) return originals;
    if(pending) return pending;
    pending = (async () => {
      const verified = new Set();
      const results = await Promise.allSettled(pool.source.rawUrls.map(async url => {
        const response = await fetcher(url, { signal: AbortSignal.timeout(3500), headers: { Accept: 'text/plain' } });
        if(!response.ok) throw new Error('Soru kaynağı yanıt vermedi.');
        const text = await response.text();
        if(text.length > 65536) throw new Error('Beklenmeyen kaynak boyutu.');
        return text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
      }));
      for(const result of results) if(result.status === 'fulfilled') result.value.forEach(line => verified.add(line));
      originals = verified;
      checkedAt = Date.now();
      return originals;
    })();
    try{ return await pending; }finally{ pending = null; }
  }
  return async function dailyQuestion(date){
    const selected = selectQuestion(date);
    const verified = await checkSource();
    // Kesintide aynı lisanslı kopya ve aynı çeviri kullanılır; soru değişmez.
    return { date, id: selected.id, text: selected.text, category: selected.category,
      source: { name: pool.source.name, url: pool.source.url, license: pool.source.license },
      sourceAvailable: verified.has(selected.original), poolVersion: pool.version };
  };
}

module.exports = { istanbulDate, validDate, selectQuestion, createQuestionService };
