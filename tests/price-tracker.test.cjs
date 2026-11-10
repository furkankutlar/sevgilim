const test=require('node:test'),assert=require('node:assert/strict');
const {productUrl,parseProduct,fetchProduct,SEEDS}=require('../lib/price-source.cjs');
const {createStore}=require('../lib/price-store.cjs');
const {createMonitor,qualifies}=require('../lib/price-monitor.cjs');
function html(price=362,extra={}){return '<script type="application/ld+json">'+JSON.stringify({'@type':'Product',name:'Test ürünü',sku:'10015186',image:'https://img.example/product.jpg',offers:{'@type':'Offer',price,priceCurrency:'TRY',availability:'https://schema.org/InStock'},...extra})+'</script>';}
function fakeBlob(){
  let state=null,version=0;const failures={writes:0};
  return {failures,async get(){return state?{stream:new Response(JSON.stringify(state)).body,blob:{etag:String(version)}}:null;},
    async put(path,text,options){
      if(failures.writes){failures.writes--;version++;}
      if(options.ifMatch!=null && options.ifMatch!==String(version))throw Object.assign(Error('stale etag'),{name:'BlobPreconditionFailedError'});
      if(state&&!options.allowOverwrite)throw Error('already exists');
      state=JSON.parse(text);version++;return{etag:String(version)};
    }};
}
function rig(){
  const blob=fakeBlob(),store=createStore(blob),sent=[];
  let at='2026-11-10T13:00:00Z',fail=false,stock=true;
  const prices={Gratis:100,Watsons:200};
  const monitor=createMonitor({store,now:()=>new Date(at),fetchProduct:async url=>{
    if(fail)throw Error('blocked');const product=productUrl(url);return{...product,name:product.store+' Test',price:prices[product.store],inStock:stock,image:null};
  },notifier:{prepare:async owner=>({count:1,send:async(items,day)=>{sent.push({owner,items,day});return{sent:1};}})}});
  return{store,blob,monitor,sent,prices,time:value=>{at=value;},fail:value=>{fail=value;},stock:value=>{stock=value;}};
}
test('only canonical Gratis/Watsons product URLs accepted; tracking parameters stripped',()=>{
  const original=productUrl(SEEDS[0].url);assert.equal(productUrl(SEEDS[0].url+'?utm_source=test').id,original.id);
  for(const url of ['http://www.gratis.com/a-p-12','https://gratis.com.evil.example/a-p-12','https://127.0.0.1/a-p-12','https://name:password@www.gratis.com/a-p-12','https://www.gratis.com:444/a-p-12','https://www.watsons.com.tr/anything'])assert.throws(()=>productUrl(url));
});
test('product structured data parsed, unrelated prices and currencies rejected',()=>{
  assert.equal(parseProduct(html(),SEEDS[0].url).price,362);
  assert.throws(()=>parseProduct(html(0),SEEDS[0].url));
  assert.throws(()=>parseProduct(html(10,{sku:'other'}),SEEDS[0].url));
  assert.throws(()=>parseProduct(html(10,{offers:{'@type':'Offer',price:10,priceCurrency:'USD'}}),SEEDS[0].url));
  assert.throws(()=>parseProduct('<h1>Challenge</h1>',SEEDS[0].url));
});
test('Watsons graph and explicit out-of-stock parsed',()=>{
  const graph={'@graph':[{'@type':'BreadcrumbList'},{'@type':'Product',name:'Urban Care',sku:'1300649',offers:{'@type':'Offer',price:279,priceCurrency:'TRY',availability:'OutOfStock'}}]};
  const result=parseProduct('<script type="application/ld+json">'+JSON.stringify(graph)+'</script>',SEEDS[1].url);
  assert.equal(result.price,279);assert.equal(result.inStock,false);
});
test('fetch does not follow redirects to internal or unrelated destinations',async()=>{
  await assert.rejects(()=>fetchProduct(SEEDS[0].url,async()=>new Response('',{status:302,headers:{location:'http://127.0.0.1/'}})));
  await assert.rejects(()=>fetchProduct(SEEDS[0].url,async()=>new Response('',{status:403})));
});
test('store bootstraps once, retries etag collision without lost update',async()=>{
  const sdk=fakeBlob(),store=createStore(sdk);await Promise.all([store.read(),store.read()]);
  assert.equal((await store.read()).state.products.length,2);
  sdk.failures.writes=1;
  await store.mutate(state=>{state.products[0].target=250;});
  assert.equal((await store.read()).state.products[0].target,250);
});
test('first observations establish baseline without sending any notification',async()=>{
  const r=rig();await r.monitor();assert.equal(r.sent.length,0);
  const state=(await r.store.read()).state;assert.equal(state.products[0].price,100);assert.equal(state.products[0].history.length,1);
});
test('two qualifying drops bundled into one owner digest; repeated check is skipped',async()=>{
  const r=rig();await r.monitor();r.time('2026-11-11T13:00:00Z');r.prices.Gratis=90;r.prices.Watsons=180;
  await r.monitor();assert.equal(r.sent.length,1);assert.equal(r.sent[0].items.length,2);
  assert.equal((await r.monitor()).skipped,true);assert.equal(r.sent.length,1);
});
test('price rising and returning to same discount never sends duplicate alert',async()=>{
  const r=rig();await r.monitor();r.time('2026-11-11T13:00:00Z');r.prices.Gratis=90;await r.monitor();
  r.time('2026-11-12T13:00:00Z');r.prices.Gratis=100;await r.monitor();
  r.time('2026-11-13T13:00:00Z');r.prices.Gratis=90;await r.monitor();assert.equal(r.sent.length,1);
  r.time('2026-11-14T13:00:00Z');r.prices.Gratis=80;await r.monitor();assert.equal(r.sent.length,2);
});
test('rounding noise, increases, paused items and out-of-stock do not alert',()=>{
  const base={enabled:true,inStock:true,referencePrice:100,price:99,lastAlertPrice:null};
  assert.equal(qualifies(base),false);assert.equal(qualifies({...base,price:101}),false);
  assert.equal(qualifies({...base,price:90,enabled:false}),false);assert.equal(qualifies({...base,price:90,inStock:false}),false);
  assert.equal(qualifies({...base,referencePrice:10,price:9}),false);
});
test('target price overrides percent rule and still requires a real drop',()=>{
  const item={enabled:true,inStock:true,referencePrice:300,price:290,lastAlertPrice:null,target:280};
  assert.equal(qualifies(item),false);assert.equal(qualifies({...item,price:279}),true);
  assert.equal(qualifies({...item,referencePrice:279,price:279,target:300}),false);
});
test('night checks remain silent; observed sale can alert next daytime check',async()=>{
  const r=rig();await r.monitor();r.time('2026-11-11T21:00:00Z');r.prices.Gratis=90;await r.monitor();assert.equal(r.sent.length,0);
  r.time('2026-11-12T13:00:00Z');await r.monitor();assert.equal(r.sent.length,1);
});
test('failed fetch never overwrites known price or creates notification',async()=>{
  const r=rig();await r.monitor();r.time('2026-11-11T13:00:00Z');r.fail(true);const result=await r.monitor();
  assert.equal(result.failed,2);assert.equal((await r.store.read()).state.products[0].price,100);assert.equal(r.sent.length,0);
});
test('same owner receives at most one digest per Istanbul day even on further drop',async()=>{
  const r=rig();await r.monitor();r.time('2026-11-11T07:00:00Z');r.prices.Gratis=90;await r.monitor();
  r.time('2026-11-11T13:00:00Z');r.prices.Gratis=80;await r.monitor();assert.equal(r.sent.length,1);
});
test('stale lease expires; active lease prevents concurrent job',async()=>{
  const r=rig();await r.store.mutate(state=>{state.lease={id:'other',expires:'2026-11-10T13:10:00Z'};});
  assert.equal((await r.monitor()).reason,'running');r.time('2026-11-10T13:11:00Z');assert.equal((await r.monitor()).checked,2);
});
test('no matching device does not mark a sale as notified',async()=>{
  const r=rig();await r.monitor();r.time('2026-11-11T13:00:00Z');r.prices.Gratis=90;
  const noDevice=createMonitor({store:r.store,now:()=>new Date('2026-11-11T13:00:00Z'),fetchProduct:async url=>({...productUrl(url),name:'Test',image:null,price:90,inStock:true}),notifier:{prepare:async()=>({count:0})}});
  await noDevice();assert.equal((await r.store.read()).state.products[0].lastAlertPrice,null);
});
