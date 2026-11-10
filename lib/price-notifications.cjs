const webpush = require('web-push');
const { createClient } = require('@supabase/supabase-js');
function safeEndpoint(endpoint){
  try{ const url=new URL(endpoint); return url.protocol==='https:' && !url.port && !url.username &&
    ['web.push.apple.com','fcm.googleapis.com','updates.push.services.mozilla.com'].includes(url.hostname); }catch(error){ return false; }
}
function createNotifier(){
  return { async prepare(owner){
    const env=process.env;
    if(!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY || !env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return {count:0};
    const db=createClient(env.SUPABASE_URL,env.SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false},
      global:{fetch:(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(12000)})}});
    const {data,error}=await db.from('push_subscriptions').select('endpoint,p256dh,auth,owner_name').eq('owner_name',owner);
    if(error) throw Error('Bildirim cihazları alınamadı.');
    const subscriptions=(data||[]).filter(sub=>safeEndpoint(sub.endpoint));
    return { count:subscriptions.length, async send(items,day){
      webpush.setVapidDetails('mailto:site-sahibi@example.com',env.VAPID_PUBLIC_KEY,env.VAPID_PRIVATE_KEY);
      const money=n=>new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY',maximumFractionDigits:2}).format(n);
      const body=items.map(item=>`${item.name}: ${money(item.price)}`).join('\n').slice(0,450);
      const payload=JSON.stringify({title:items.length===1?'Takip ettiğin ürün ucuzladı':'İstek listende fiyatlar düştü',body,url:'/#prices',type:'price',tag:'price-digest-'+day});
      const results=await Promise.allSettled(subscriptions.map(sub=>webpush.sendNotification({endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth}},payload,{TTL:6*3600,timeout:10000})));
      const sent=results.filter(result=>result.status==='fulfilled').length;
      console.info('Price digest',JSON.stringify({products:items.length,devices:subscriptions.length,sent}));
      return {sent,total:subscriptions.length};
    }};
  }};
}
module.exports={createNotifier,safeEndpoint};
