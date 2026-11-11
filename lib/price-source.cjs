const { createHash } = require('node:crypto');
const READER_VERSION=2;
// Only Gratis public product prices are supported.
const isSourceAvailable = product => product.store === 'Gratis';
const SEEDS = [
  { url: 'https://www.gratis.com/durulanmayan-sac-bakim-kremleri/pantene-kivircik-sekillendirici-durulanmayan-krem-300-ml-p-10015186', name: 'Pantene Kıvırcık Şekillendirici Krem 300 ml' }
];
function productUrl(value){
  if(typeof value !== 'string' || value.length > 1000) throw Error('Geçerli bir ürün bağlantısı gir.');
  const url = new URL(value);
  if(url.protocol !== 'https:' || url.username || url.password || url.port) throw Error('Yalnızca HTTPS ürün bağlantıları destekleniyor.');
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const store = host === 'gratis.com' ? 'Gratis' : null;
  const match = store === 'Gratis' ? url.pathname.match(/-p-(\d+)\/?$/) : null;
  if(!match) throw Error('Gratis ürün sayfasının bağlantısını gir.');
  url.hostname = 'www.' + host; url.search = ''; url.hash = ''; url.pathname = url.pathname.replace(/\/$/,'');
  return { url: url.href, store, code: match[1], id: createHash('sha256').update(host + ':' + match[1]).digest('hex').slice(0,24) };
}
function parseProduct(html, location){
  const target = productUrl(location);
  const products = [];
  function visit(value){
    if(Array.isArray(value)) return value.forEach(visit);
    if(!value || typeof value !== 'object') return;
    if([].concat(value['@type'] || []).includes('Product')) products.push(value);
    if(value['@graph']) visit(value['@graph']);
  }
  for(const match of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
    try{ visit(JSON.parse(match[1])); }catch(error){}
  }
  const product = products.find(item => String(item.sku || '').replace(/^BP_/,'') === target.code ||
    [].concat(item.offers || []).some(offer => { try{ return productUrl(offer.url).id === target.id; }catch(error){ return false; } }));
  if(!product) throw Error('Ürünün fiyat kaydı doğrulanamadı.');
  const offers = [].concat(product.offers || []).filter(offer => offer['@type'] === 'Offer' && offer.priceCurrency === 'TRY');
  const prices = [...new Set(offers.map(offer => Number(offer.price)))];
  if(prices.length !== 1 || !Number.isFinite(prices[0]) || prices[0] < 0.01 || prices[0] > 100000) throw Error('Tek bir geçerli TL fiyatı bulunamadı.');
  const price = Math.round(prices[0] * 100) / 100;
  const availability = String(offers[0].availability || '').split('/').at(-1).toLowerCase();
  if(!['instock','outofstock','soldout','limitedavailability'].includes(availability)) throw Error('Stok durumu doğrulanamadı.');
  let image = typeof product.image === 'string' ? product.image : Array.isArray(product.image) ? product.image[0] : null;
  try{ const img = new URL(image); if(img.protocol !== 'https:') image = null; }catch(error){ image = null; }
  return { ...target, name: String(product.name || '').slice(0,200), image, price, inStock: ['instock','limitedavailability'].includes(availability) };
}
async function fetchProduct(value, fetcher = globalThis.fetch){
  const product = productUrl(value);
  let url = product.url;
  for(let redirects = 0; redirects < 3; redirects++){
    const response = await fetcher(url, { redirect: 'manual', signal: AbortSignal.timeout(20000), headers: { Accept: 'text/html' } });
    if([301,302,303,307,308].includes(response.status)){
      const next = new URL(response.headers.get('location'),url).href;
      if(productUrl(next).id !== product.id) throw Error('Ürün bağlantısı başka sayfaya yönlendi.');
      url = productUrl(next).url; continue;
    }
    if(!response.ok) throw Error('Mağaza şu anda fiyatı paylaşmıyor. HTTP '+response.status);
    const reader = response.body.getReader(); const chunks = []; let size = 0;
    try{
      while(true){ const {done,value:chunk} = await reader.read(); if(done) break;
        size += chunk.length; if(size > 4 * 1024 * 1024) throw Error('Ürün sayfası beklenenden büyük.'); chunks.push(chunk); }
    }catch(error){ await reader.cancel().catch(()=>{}); throw error; }
    return parseProduct(Buffer.concat(chunks).toString('utf8'), product.url);
  }
  throw Error('Ürün sayfası çok fazla yönlendirme yaptı.');
}
module.exports = { SEEDS, READER_VERSION, isSourceAvailable, productUrl, parseProduct, fetchProduct };
