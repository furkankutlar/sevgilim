const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {emptyState}=require('../lib/price-store.cjs');
function api(){
  let state=emptyState(),checks=[];state.lastRunAt='2026-11-10T13:00:00Z';state.products.forEach(item=>{item.price=100;item.referencePrice=100;});
  const store={read:async()=>({state:structuredClone(state)}),mutate:async change=>{const result=change(state);return result?.value;}};
  const modules={
    'node:crypto':require('node:crypto'),
    '../lib/price-store.cjs':{createStore:()=>store},
    '../lib/price-source.cjs':{...require('../lib/price-source.cjs'),fetchProduct:async url=>({...require('../lib/price-source.cjs').productUrl(url),name:'Product',price:99,inStock:true})},
    '../lib/price-monitor.cjs':{INTERVAL:21600000,createMonitor:()=>async options=>{checks.push(options);return {checked:2};}},
    '../lib/price-notifications.cjs':{createNotifier:()=>({})}
  };
  const ctx=vm.createContext({module:{exports:{}},require:name=>modules[name],process:{env:{CRON_SECRET:'test-secret'}},Buffer,Date,URL,JSON,console:{info(){},error(){}}});
  vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../api/price-tracker.js'),'utf8'),ctx);
  return {state,checks,request:async(req={})=>{
    const request={method:'GET',query:{},headers:{host:'furhi.vercel.app',origin:'https://furhi.vercel.app','content-type':'application/json'},...req};
    const res={headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(body){this.body=body;return this;}};
    await ctx.module.exports(request,res);return res;
  }};
}
test('public list reads do not run checks once baseline exists',async()=>{
  const a=api(),r=await a.request();assert.equal(r.code,200);assert.equal(r.body.products.length,2);assert.equal(a.checks.length,0);
});

test('paused Watsons baseline does not trigger fetch-on-read and status is explicit',async()=>{
  const a=api();a.state.products[1].price=null;
  const r=await a.request();assert.equal(r.code,200);assert.equal(a.checks.length,0);
  assert.equal(r.body.products[0].automationAvailable,true);
  assert.equal(r.body.products[1].automationAvailable,false);
  assert.match(r.body.products[1].error,/beklemede/);
});
test('scheduled checks require server secret; missing and wrong credentials rejected',async()=>{
  const a=api();assert.equal((await a.request({query:{job:'daily'}})).code,401);
  assert.equal((await a.request({query:{job:'daily'},headers:{authorization:'Bearer wrong'}})).code,401);
  assert.equal((await a.request({query:{job:'daily'},headers:{authorization:'Bearer test-secret'}})).code,200);
  assert.equal(a.checks.length,1);
});
test('cross-origin writes and invalid stores rejected without adding products',async()=>{
  const a=api();assert.equal((await a.request({method:'POST',headers:{origin:'https://attacker.example',host:'furhi.vercel.app'}})).code,403);
  const r=await a.request({method:'POST',body:{action:'add',owner:'Hilalişko',url:'https://127.0.0.1/internal'}});assert.equal(r.code,400);assert.equal(a.state.products.length,2);
});
test('duplicate add is rejected before fetching product and settings can pause a tracked item',async()=>{
  const a=api();const item=a.state.products[0];
  assert.equal((await a.request({method:'POST',body:{action:'add',owner:'Hilalişko',url:item.url}})).code,409);
  assert.equal((await a.request({method:'POST',body:{action:'update',id:item.id,owner:'Hilalişko',target:250,enabled:false}})).code,200);
  assert.equal(a.state.products[0].enabled,false);assert.equal(a.state.products[0].target,250);
});
test('invalid notification owner and negative target do not modify settings',async()=>{
  const a=api(),item=a.state.products[0];
  assert.equal((await a.request({method:'POST',body:{action:'update',id:item.id,owner:'someone',target:250,enabled:true}})).code,400);
  assert.equal((await a.request({method:'POST',body:{action:'update',id:item.id,owner:'Hilalişko',target:-1,enabled:true}})).code,400);
  assert.equal(item.target,null);
});
