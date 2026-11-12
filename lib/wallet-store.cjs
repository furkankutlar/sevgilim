const blob=require('@vercel/blob');
const {empty,apply}=require('../wallet-model.js');
const PATH='wallet/shared-v1.json';
function createWalletStore(sdk=blob){
  const conflict=e=>(typeof sdk.BlobPreconditionFailedError==='function'&&e instanceof sdk.BlobPreconditionFailedError)||e.name==='BlobPreconditionFailedError';
  async function load(){
    let before;try{before=await sdk.head(PATH);}catch(e){if(e instanceof sdk.BlobNotFoundError)return null;throw e;}
    const response=await sdk.get(PATH,{access:'private',useCache:false,headers:{'accept-encoding':'identity'}});
    if(!response)throw Error('Missing wallet');
    const state=await new Response(response.stream).json(),after=await sdk.head(PATH);
    if(before.etag!==after.etag)throw new sdk.BlobPreconditionFailedError();
    if(state.version!==1||!Array.isArray(state.accounts)||!Array.isArray(state.entries))throw Error('Invalid wallet');
    return {state,etag:after.etag};
  }
  async function run(body){
    for(let i=0;i<5;i++){
      try{
        const found=await load();const state=found?.state||empty();
        if(!body)return state;
        if(!apply(state,body))return state;
        await sdk.put(PATH,JSON.stringify(state),{access:'private',addRandomSuffix:false,allowOverwrite:Boolean(found),...(found?{ifMatch:found.etag}:{}),contentType:'application/json',cacheControlMaxAge:60});
        return state;
      }catch(e){
        const creationRace=e.name==='BlobAlreadyExistsError'||(sdk.BlobAlreadyExistsError&&e instanceof sdk.BlobAlreadyExistsError);
        if((!conflict(e)&&!creationRace)||i===4)throw e;
        await new Promise(r=>setTimeout(r,30*2**i));
      }
    }
  }
  return {read:()=>run(),mutate:body=>run(body)};
}
module.exports={createWalletStore};
