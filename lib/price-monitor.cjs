const { randomUUID } = require('node:crypto');
const { istanbulDate } = require('./daily-question.cjs');
const { READER_VERSION }=require('./price-source.cjs');
const INTERVAL=6*3600000;
function qualifies(item){
  if(!item.enabled || !item.inStock || item.price==null || item.referencePrice==null || item.price>=item.referencePrice) return false;
  if(item.lastAlertPrice!=null && item.price>=item.lastAlertPrice) return false;
  return item.target!=null ? item.price<=item.target : item.price<=item.referencePrice*.95 && item.referencePrice-item.price>=5;
}
function createMonitor({store,fetchProduct,notifier,now=()=>new Date()}){
  return async function check({notify=true,onlyMissing=false}={}){
    const time=now(),stamp=time.toISOString(),leaseId=randomUUID();
    const acquired=await store.mutate(state=>{
      const next=state.lastRunAt ? Date.parse(state.lastRunAt)+INTERVAL : 0;
      const leaseStart=state.lease?.startedAt || state.lastRunAt;
      const leaseDeadline=state.lease ? Math.min(Date.parse(state.lease.expires),leaseStart?Date.parse(leaseStart)+4*60000:Infinity):0;
      if(leaseDeadline>time.getTime()) return {unchanged:true,value:{skipped:true,reason:'running',nextCheckAt:new Date(leaseDeadline).toISOString()}};
      const products=state.products.filter(item=>item.enabled && (!onlyMissing || (item.price==null && (item.lastMissingReaderVersion!==READER_VERSION || !item.lastMissingAttemptAt || time.getTime()-Date.parse(item.lastMissingAttemptAt)>=1800000))));
      if(onlyMissing && !products.length)return{unchanged:true,value:{skipped:true,reason:'recent'}};
      if(!onlyMissing && next>time.getTime()) return {unchanged:true,value:{skipped:true,reason:'recent',nextCheckAt:new Date(next).toISOString()}};
      state.lease={id:leaseId,startedAt:stamp,expires:new Date(time.getTime()+4*60000).toISOString()};if(!onlyMissing)state.lastRunAt=stamp;
      if(onlyMissing)products.forEach(item=>{item.lastMissingAttemptAt=stamp;item.lastMissingReaderVersion=READER_VERSION;});
      return {value:{products:products.map(item=>({id:item.id,url:item.url}))}};
    });
    if(acquired.skipped) return acquired;
    try{
      const results=[];
      // Küçük gruplar mağazalara ve sunucuya gereksiz yük bindirmesin.
      for(let i=0;i<acquired.products.length;i+=3){
        const group=await Promise.all(acquired.products.slice(i,i+3).map(async item=>{
          try{return{id:item.id,url:item.url,value:await fetchProduct(item.url)};}
          catch(error){console.warn('Price source failed',item.id,error.name,String(error.message).slice(0,200));return{id:item.id,url:item.url,error:'Fiyat okunamadı. Önceki fiyat korunuyor.'};}
        }));results.push(...group);
      }
      await store.mutate(state=>{
        for(const result of results){
          const item=state.products.find(p=>p.id===result.id && p.url===result.url && p.enabled);if(!item)continue;
          item.lastAttemptAt=stamp;
          if(result.error){item.error=result.error;continue;}
          const product=result.value;
          if(item.price!=null && (product.price < item.price*.2 || product.price>item.price*5)){
            item.error='Beklenmedik fiyat değişimi: mağaza sayfasından kontrol et.';continue;
          }
          item.previousPrice=item.price;
          if(item.referencePrice==null)item.referencePrice=product.price;
          else item.referencePrice=Math.max(item.referencePrice,product.price);
          Object.assign(item,{name:product.name,image:product.image,price:product.price,inStock:product.inStock,lastCheckedAt:stamp,error:null});
          if(!item.history.length || item.history.at(-1).price!==product.price)item.history.push({price:product.price,at:stamp});
          item.history=item.history.slice(-60);
        }
        state.lastCompletedAt=stamp;
      });
      const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Istanbul',hour:'2-digit',hourCycle:'h23'}).format(time));
      if(notify && hour>=9 && hour<22){
        const day=istanbulDate(time);
        for(const owner of ['Hilalişko','Furki']){
          const key=`price:${owner}:${day}`;
          const snapshot=(await store.read()).state;
          if(snapshot.events.some(event=>event.id===key))continue;
          const candidates=snapshot.products.filter(item=>item.owner===owner && item.lastCheckedAt===stamp && !item.error && qualifies(item));
          if(!candidates.length)continue;
          let delivery;
          try{delivery=await notifier.prepare(owner);}catch(error){console.warn('Price notification unavailable');continue;}
          if(!delivery.count)continue;
          const claimed=await store.mutate(state=>{
            if(state.events.some(event=>event.id===key))return{unchanged:true,value:[]};
            const items=state.products.filter(item=>item.owner===owner && item.lastCheckedAt===stamp && !item.error && qualifies(item));
            if(!items.length)return{unchanged:true,value:[]};
            // Göndermeden önce kalıcı talep: işlem yeniden çalışsa da aynı özet gönderilmez.
            state.events.push({id:key,owner,at:stamp,status:'reserved',productIds:items.map(item=>item.id)});
            state.events=state.events.slice(-120);
            items.forEach(item=>{item.lastAlertPrice=item.price;item.lastAlertAt=stamp;});
            return{value:items.map(item=>({id:item.id,name:item.name,price:item.price}))};
          });
          if(!claimed.length)continue;
          let status='failed';
          try{const result=await delivery.send(claimed,day);status=result.sent>0?'sent':'failed';}catch(error){console.warn('Price summary could not be delivered');}
          await store.mutate(state=>{const event=state.events.find(event=>event.id===key);if(event)event.status=status;});
        }
      }
      return {checked:results.length,failed:results.filter(result=>result.error).length,nextCheckAt:new Date(time.getTime()+INTERVAL).toISOString()};
    }finally{
      await store.mutate(state=>{if(state.lease?.id===leaseId)state.lease=null;else return{unchanged:true};});
    }
  };
}
module.exports={INTERVAL,qualifies,createMonitor};
