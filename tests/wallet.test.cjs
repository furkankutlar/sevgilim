const test=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const W=require('../wallet-model.js'),{createWalletStore}=require('../lib/wallet-store.cjs');
function rig(){
  const state=W.empty(),a=randomUUID(),b=randomUUID(),h=randomUUID();
  for(const [id,owner,name] of [[a,'Furki','Banka'],[b,'Furki','Nakit'],[h,'Hilalişko','Birikim']])W.apply(state,{actor:owner,action:'saveAccount',data:{id,name,opening:10000}});
  const tx=(type,amount,other={})=>({actor:'Furki',action:'saveEntry',data:{id:randomUUID(),accountId:a,type,amount,date:'2026-01-12',category:'Market',note:'',...other}});
  return{state,a,b,h,tx};
}
test('decimal money uses integer kuruş; invalid formats and fractions rejected',()=>{
  assert.equal(W.amount('0,29'),29);assert.equal(W.amount('1250.50'),125050);assert.equal(W.amount('-10,05'),-1005);
  for(const value of ['1e5','1.234,56','Infinity','0.009','',null])assert.throws(()=>W.amount(value));
});
test('income, expense and transfers produce correct balances without double-counting',()=>{
  const r=rig();W.apply(r.state,r.tx('income',20000));W.apply(r.state,r.tx('expense',1234));W.apply(r.state,r.tx('transfer',5000,{toAccountId:r.b}));
  assert.equal(W.accountBalance(r.state,r.a),23766);assert.equal(W.accountBalance(r.state,r.b),15000);
  const totals=W.summary(r.state,[r.a,r.b],'2026-01');assert.equal(totals.balance,38766);assert.equal(totals.income,20000);assert.equal(totals.expense,1234);
  assert.equal(totals.categories[0].total,1234);assert.equal(W.summary(r.state,[r.a],'2026-02').expense,0);
});
test('duplicate submissions are idempotent; editing and deleting recompute balances',()=>{
  const r=rig(),body=r.tx('expense',500);W.apply(r.state,body);assert.equal(W.apply(r.state,body),false);assert.equal(r.state.entries.length,1);
  W.apply(r.state,{...body,data:{...body.data,amount:1000,revision:1}});assert.equal(W.accountBalance(r.state,r.a),9000);
  const del={actor:'Furki',action:'deleteEntry',data:{id:body.data.id,revision:2}};W.apply(r.state,del);assert.equal(W.apply(r.state,del),false);assert.equal(W.accountBalance(r.state,r.a),10000);
  assert.throws(()=>W.apply(r.state,{...body,data:{...body.data,amount:200,revision:2}}),e=>e.status===409);
});
test('other owner operations, cross-owner transfers and stale edits rejected',()=>{
  const r=rig();assert.throws(()=>W.apply(r.state,r.tx('expense',100,{accountId:r.h})),e=>e.status===403);
  assert.throws(()=>W.apply(r.state,r.tx('transfer',100,{toAccountId:r.h})),e=>e.status===403);
  assert.throws(()=>W.apply(r.state,r.tx('transfer',100,{toAccountId:r.a})));
  const body=r.tx('expense',100);W.apply(r.state,body);assert.throws(()=>W.apply(r.state,{...body,data:{...body.data,amount:200}}),e=>e.status===409);
  assert.throws(()=>W.apply(r.state,{actor:'Furki',action:'saveAccount',data:{id:r.h,name:'Rename',opening:0}}),e=>e.status===403);
});
test('invalid amount, date, category and identity cannot create entries',()=>{
  const r=rig();for(const fields of [{amount:0},{amount:1.5},{date:'2026-02-30'},{date:'2099-01-01'},{category:'unknown'},{note:'x'.repeat(121)}])assert.throws(()=>W.apply(r.state,r.tx('expense',100,fields)));
  assert.throws(()=>W.apply(r.state,{...r.tx('income',100),actor:'Someone'}));assert.equal(r.state.entries.length,0);
});
test('accounts with movement cannot be deleted; empty account deletion stays deleted',()=>{
  const r=rig();W.apply(r.state,r.tx('expense',100));assert.throws(()=>W.apply(r.state,{actor:'Furki',action:'deleteAccount',data:{id:r.a,revision:1}}));
  W.apply(r.state,{actor:'Furki',action:'deleteAccount',data:{id:r.b,revision:1}});assert.equal(r.state.accounts.length,2);
});
function fakeBlob(){
  let value=null,version=0,inject=false;
  class NotFound extends Error{}class Conflict extends Error{}class Exists extends Error{}
  const sdk={BlobNotFoundError:NotFound,BlobPreconditionFailedError:Conflict,BlobAlreadyExistsError:Exists,
    collide(){inject=true;},async head(){if(!value)throw new NotFound();return{etag:String(version)};},
    async get(){return{stream:new Response(JSON.stringify(value)).body,blob:{etag:'wrong-download-etag'}};},
    async put(path,text,options){
      if(inject){inject=false;version++;throw new Conflict();}
      if(value&&!options.allowOverwrite)throw new Exists();
      if(options.ifMatch&&options.ifMatch!==String(version))throw new Conflict();
      value=JSON.parse(text);version++;return{etag:String(version)};
    }};return sdk;
}
test('wallet persistence retries real SDK-style conflicts without lost or duplicate writes',async()=>{
  const sdk=fakeBlob(),store=createWalletStore(sdk),a=randomUUID(),b=randomUUID();assert.equal((await store.read()).accounts.length,0);
  await store.mutate({actor:'Furki',action:'saveAccount',data:{id:a,name:'Banka',opening:0}});sdk.collide();
  await store.mutate({actor:'Hilalişko',action:'saveAccount',data:{id:b,name:'Nakit',opening:0}});
  assert.equal((await store.read()).accounts.length,2);
  const op={actor:'Furki',action:'saveEntry',data:{id:randomUUID(),accountId:a,type:'income',amount:99,date:'2026-01-12',note:''}};
  await store.mutate(op);await store.mutate(op);assert.equal((await store.read()).entries.length,1);
});
test('wallet API gates writes by origin, content type and model ownership',async()=>{
  const vm=require('node:vm'),fs=require('node:fs'),r=rig(),store={read:async()=>r.state,mutate:async body=>{W.apply(r.state,body);return r.state;}};
  const ctx={module:{exports:{}},require:()=>({createWalletStore:()=>store}),URL,JSON,console};
  vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../api/wallet.js'),'utf8'),ctx);
  async function call(method='GET',headers={},body={}){
    const res={setHeader(){},status(code){this.code=code;return this;},json(value){this.value=value;return this;}};
    await ctx.module.exports({method,headers:{host:'furhi.vercel.app',origin:'https://furhi.vercel.app','content-type':'application/json',...headers},body},res);return res;
  }
  assert.equal((await call()).code,200);assert.equal((await call('PUT')).code,405);
  assert.equal((await call('POST',{origin:'https://evil.example'},r.tx('income',100))).code,403);
  assert.equal((await call('POST',{'content-type':'text/plain'},r.tx('income',100))).code,415);
  assert.equal((await call('POST',{},r.tx('expense',100,{accountId:r.h}))).code,403);
  assert.equal((await call('POST',{},r.tx('expense',100))).code,200);
});
test('two devices creating accounts concurrently retain both accounts',async()=>{
  const sdk=fakeBlob(),first=createWalletStore(sdk),second=createWalletStore(sdk);
  await Promise.all([
    first.mutate({actor:'Furki',action:'saveAccount',data:{id:randomUUID(),name:'Banka',opening:1000}}),
    second.mutate({actor:'Hilalişko',action:'saveAccount',data:{id:randomUUID(),name:'Nakit',opening:2000}})
  ]);
  const saved=await first.read();assert.equal(saved.accounts.length,2);assert.equal(saved.accounts.reduce((s,a)=>s+a.opening,0),3000);
});
