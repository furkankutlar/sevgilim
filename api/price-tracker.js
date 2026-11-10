const { timingSafeEqual }=require('node:crypto');
const {createStore}=require('../lib/price-store.cjs');
const {productUrl,fetchProduct,READER_VERSION}=require('../lib/price-source.cjs');
const {createMonitor,INTERVAL}=require('../lib/price-monitor.cjs');
const {createNotifier}=require('../lib/price-notifications.cjs');
const store=createStore();
const monitor=createMonitor({store,fetchProduct,notifier:createNotifier()});
function isCron(req){
  if(!process.env.CRON_SECRET)return false;
  const expected=Buffer.from('Bearer '+process.env.CRON_SECRET),actual=Buffer.from(String(req.headers.authorization||''));
  return actual.length===expected.length && timingSafeEqual(actual,expected);
}
module.exports=async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  try{
    if(req.query?.job==='daily'){
      if(req.method!=='GET' || !isCron(req))return res.status(401).json({error:'Yetkisiz istek.'});
      const result=await monitor();console.info('Daily price check',JSON.stringify(result));return res.status(200).json(result);
    }
    if(req.method==='GET'){
      let {state}=await store.read();
      if(!state.lastRunAt){await monitor({notify:false});state=(await store.read()).state;}
      else if(state.products.some(item=>item.enabled && item.price==null && (item.lastMissingReaderVersion!==READER_VERSION || !item.lastMissingAttemptAt || Date.now()-Date.parse(item.lastMissingAttemptAt)>=1800000))){
        await monitor({notify:false,onlyMissing:true});state=(await store.read()).state;
      }
      return res.status(200).json({products:state.products,lastCompletedAt:state.lastCompletedAt||null,
        nextCheckAt:state.lastRunAt?new Date(Date.parse(state.lastRunAt)+INTERVAL).toISOString():null,
        schedule:'Her gün 16:00–17:00 arasında',events:state.events.slice(-10).map(({at,status,owner})=>({at,status,owner}))});
    }
    if(req.method!=='POST'){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Bu işlem desteklenmiyor.'});}
    let origin;try{origin=new URL(req.headers.origin);}catch(error){}
    if(!origin || origin.protocol!=='https:' || origin.host!==req.headers.host)return res.status(403).json({error:'Geçersiz istek kaynağı.'});
    if(!String(req.headers['content-type']||'').startsWith('application/json'))return res.status(415).json({error:'JSON gerekli.'});
    if(JSON.stringify(req.body||{}).length>4096)return res.status(400).json({error:'İstek çok uzun.'});
    const {action,id,owner}=req.body||{};
    if(action==='check')return res.status(200).json(await monitor());
    if(action==='add'){
      if(!['Hilalişko','Furki'].includes(owner))return res.status(400).json({error:'Bildirim alacak kişiyi seç.'});
      let product;try{product=productUrl(req.body.url);}catch(error){return res.status(400).json({error:error.message});}
      const existing=(await store.read()).state.products;
      if(existing.some(item=>item.id===product.id))return res.status(409).json({error:'Bu ürün zaten takip ediliyor.'});
      if(existing.length>=10)return res.status(409).json({error:'En fazla 10 ürün takip edebilirsin.'});
      let baseline=null;try{baseline=await fetchProduct(product.url);}catch(error){}
      const addedAt=new Date().toISOString();
      const result=await store.mutate(state=>{
        if(state.products.some(item=>item.id===product.id))return{unchanged:true,value:'duplicate'};
        if(state.products.length>=10)return{unchanged:true,value:'full'};
        state.products.push({...product,name:product.store+' ürünü · '+product.code,owner,enabled:true,target:null,
          price:baseline?.price??null,referencePrice:baseline?.price??null,lastAlertPrice:null,history:baseline?[{price:baseline.price,at:addedAt}]:[],createdAt:addedAt,
          ...(baseline?{name:baseline.name,image:baseline.image,inStock:baseline.inStock,lastCheckedAt:addedAt}: {error:'İlk fiyat okunamadı; sonraki kontrolde tekrar denenecek.'})});
        return{value:'added'};
      });
      if(result!=='added')return res.status(409).json({error:result==='full'?'En fazla 10 ürün takip edebilirsin.':'Bu ürün zaten takip ediliyor.'});
      return res.status(200).json({ok:true,message:baseline?'Ürün eklendi; başlangıç fiyatı kaydedildi.':'Ürün eklendi. İlk fiyat, sonraki kontrolde bildirim göndermeden kaydedilecek.'});
    }
    if(action==='update'){
      const {enabled,target}=req.body;
      if(typeof enabled!=='boolean' || (target!==null && (typeof target!=='number' || !Number.isFinite(target) || target<.01 || target>100000)) || !['Hilalişko','Furki'].includes(owner))return res.status(400).json({error:'Takip ayarları geçersiz.'});
      const found=await store.mutate(state=>{
        const item=state.products.find(item=>item.id===id);if(!item)return{unchanged:true,value:false};
        Object.assign(item,{enabled,target:target===null?null:Math.round(target*100)/100,owner});return{value:true};
      });
      return res.status(found?200:404).json(found?{ok:true}:{error:'Ürün bulunamadı.'});
    }
    return res.status(400).json({error:'Geçersiz işlem.'});
  }catch(error){
    let detail=String(error.message||'').slice(0,500);
    for(const name of ['BLOB_READ_WRITE_TOKEN','CRON_SECRET','VAPID_PRIVATE_KEY','SUPABASE_ANON_KEY'])if(process.env[name])detail=detail.replaceAll(process.env[name],'[redacted]');
    console.error('Price tracker unavailable',error.name,detail);
    return res.status(503).json({error:'Takip servisine şu anda ulaşılamıyor. Kayıtların korunuyor; biraz sonra tekrar dene.'});
  }
};
