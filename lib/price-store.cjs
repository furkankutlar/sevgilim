const blob = require('@vercel/blob');
const { SEEDS, productUrl } = require('./price-source.cjs');
const PATH = 'price-tracker/state-v1.json';
function emptyState(){
  return { version:1, products:SEEDS.map(seed=>({ ...productUrl(seed.url),name:seed.name,owner:'Hilalişko',enabled:true,target:null,
    price:null,referencePrice:null,lastAlertPrice:null,history:[],createdAt:new Date().toISOString() })), events:[],lastRunAt:null,lease:null };
}
function createStore(sdk = blob){
  async function load(){
    const result = await sdk.get(PATH,{access:'private',useCache:false});
    if(!result) return null;
    const state = await new Response(result.stream).json();
    if(state.version !== 1 || !Array.isArray(state.products) || state.products.length > 10) throw Error('Takip verisi okunamadı.');
    return {state,etag:result.blob.etag};
  }
  async function read(){
    const found = await load(); if(found) return found;
    try{
      await sdk.put(PATH,JSON.stringify(emptyState()),{access:'private',addRandomSuffix:false,allowOverwrite:false,contentType:'application/json',cacheControlMaxAge:60});
    }catch(error){ const raced=await load();if(raced)return raced;throw error; }
    const initialized = await load(); if(!initialized) throw Error('Takip kaydı oluşturulamadı.'); return initialized;
  }
  async function mutate(change){
    for(let attempt=0;attempt<5;attempt++){
      const {state,etag} = await read();
      const output = await change(state);
      if(output?.unchanged) return output.value;
      try{
        await sdk.put(PATH,JSON.stringify(state),{access:'private',addRandomSuffix:false,allowOverwrite:true,ifMatch:etag,contentType:'application/json',cacheControlMaxAge:60});
        return output?.value;
      }catch(error){
        if(error.name !== 'BlobPreconditionFailedError' || attempt===4) throw error;
        await new Promise(resolve=>setTimeout(resolve,30*(2**attempt)));
      }
    }
  }
  return {read,mutate};
}
module.exports = { createStore, emptyState };
