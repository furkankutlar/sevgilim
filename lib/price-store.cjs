const blob = require('@vercel/blob');
const { SEEDS, productUrl } = require('./price-source.cjs');
const PATH = 'price-tracker/state-v1.json';
function emptyState(){
  return { version:1, products:SEEDS.map(seed=>({ ...productUrl(seed.url),name:seed.name,owner:'Hilalişko',enabled:true,target:null,
    price:null,referencePrice:null,lastAlertPrice:null,history:[],createdAt:new Date().toISOString() })), events:[],lastRunAt:null,lease:null };
}
function createStore(sdk = blob){
  async function load(){
    let before;
    if(sdk.head){try{before=await sdk.head(PATH);}catch(error){if(error instanceof sdk.BlobNotFoundError)return null;throw error;}}
    const result = await sdk.get(PATH,{access:'private',useCache:false,headers:{'accept-encoding':'identity'}});
    if(!result) return null;
    const state = await new Response(result.stream).json();
    if(state.version !== 1 || !Array.isArray(state.products) || state.products.length > 10) throw Error('Takip verisi okunamadı.');
    const after=sdk.head?await sdk.head(PATH):null;
    if(before && after && before.etag!==after.etag)throw new sdk.BlobPreconditionFailedError();
    return {state,etag:after?.etag || result.blob.etag};
  }
  async function read(){
    // One-time cleanup also frees old Watsons entries from the ten-product limit.
    for(let attempt=0;attempt<5;attempt++){
      const found=await load();
      if(!found)break;
      if(!found.state.products.some(item=>item.store==='Watsons'))return found;
      found.state.products=found.state.products.filter(item=>item.store!=='Watsons');
      try{
        await sdk.put(PATH,JSON.stringify(found.state),{access:'private',addRandomSuffix:false,allowOverwrite:true,ifMatch:found.etag,contentType:'application/json',cacheControlMaxAge:60});
        return await load();
      }catch(error){
        const conflict=(typeof sdk.BlobPreconditionFailedError==='function' && error instanceof sdk.BlobPreconditionFailedError) || error.name==='BlobPreconditionFailedError';
        if(!conflict || attempt===4)throw error;
      }
    }
    try{
      await sdk.put(PATH,JSON.stringify(emptyState()),{access:'private',addRandomSuffix:false,allowOverwrite:false,contentType:'application/json',cacheControlMaxAge:60});
    }catch(error){ const raced=await load();if(raced)return raced;throw error; }
    const initialized = await load(); if(!initialized) throw Error('Takip kaydı oluşturulamadı.'); return initialized;
  }
  async function mutate(change){
    for(let attempt=0;attempt<5;attempt++){
      try{
      const {state,etag} = await read();
      const output = await change(state);
      if(output?.unchanged) return output.value;
        await sdk.put(PATH,JSON.stringify(state),{access:'private',addRandomSuffix:false,allowOverwrite:true,ifMatch:etag,contentType:'application/json',cacheControlMaxAge:60});
        return output?.value;
      }catch(error){
        const conflict=(typeof sdk.BlobPreconditionFailedError==='function' && error instanceof sdk.BlobPreconditionFailedError) || error.name==='BlobPreconditionFailedError';
        if(!conflict || attempt===4) throw error;
        await new Promise(resolve=>setTimeout(resolve,30*(2**attempt)));
      }
    }
  }
  return {read,mutate};
}
module.exports = { createStore, emptyState };
