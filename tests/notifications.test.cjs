const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');

function api({ configured = true, failPush = false, noPartner = false } = {}){
  const deliveries = [], removed = [];
  const subscriptions = [
    {endpoint:'https://push.example/a', p256dh:'a', auth:'a', owner_name:'Furki'},
    {endpoint:'https://push.example/b', p256dh:'b', auth:'b', owner_name:noPartner ? null : 'Hilalişko'}
  ];
  const client = { from(){ return { select: async () => ({data: subscriptions}),
    delete(){ return {in: async (column, ids) => { removed.push(...ids); return {}; }}; } }; } };
  const context = vm.createContext({ module: {exports:{}}, URL, Map, Date, AbortSignal, fetch(){},
    console: {error(){}, warn(){}, info(){}}, process: {env: configured ? {SUPABASE_URL:'https://db.example', SUPABASE_ANON_KEY:'test', VAPID_PUBLIC_KEY:'test', VAPID_PRIVATE_KEY:'test'} : {}},
    require(name){ return name === 'web-push' ? {setVapidDetails(){}, async sendNotification(sub, payload){
      deliveries.push({sub, payload: JSON.parse(payload)});
      if(failPush) throw {statusCode:410};
    }} : {createClient: () => client}; }
  });
  vm.runInContext(fs.readFileSync(path.join(root,'api/send-notification.js'),'utf8'), context);
  async function request(overrides = {}){
    const headers = {'host':'furhi.vercel.app','origin':'https://furhi.vercel.app','content-type':'application/json'};
    const req = {method:'POST',body:{title:'💬 Furki',body:'Merhaba',excludeOwner:'Furki',type:'chat'},socket:{remoteAddress:'127.0.0.1'},...overrides,headers:{...headers,...overrides.headers}};
    const res = {headers:{},statusCode:200,setHeader(k,v){this.headers[k]=v;},status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;}};
    await context.module.exports(req,res); return res;
  }
  return {request, deliveries, removed};
}
test('notification API rejects methods, cross-origin requests and non-JSON bodies', async () => {
  const a = api();
  assert.equal((await a.request({method:'GET'})).statusCode,405);
  assert.equal((await a.request({headers:{origin:'https://attacker.example'}})).statusCode,403);
  assert.equal((await a.request({headers:{'content-type':'text/plain'}})).statusCode,415);
  assert.equal(a.deliveries.length,0);
});
test('notification API validates content lengths and identity values', async () => {
  const a = api();
  assert.equal((await a.request({body:{title:'x'.repeat(101)}})).statusCode,400);
  assert.equal((await a.request({body:{title:'x',body:'x'.repeat(501)}})).statusCode,400);
  assert.equal((await a.request({body:{title:'x',excludeOwner:'other'}})).statusCode,400);
});
test('missing notification config gives controlled 503 instead of import crash', async () => {
  assert.equal((await api({configured:false}).request()).statusCode,503);
});
test('notification skips sender and links to chat', async () => {
  const a = api(); const response = await a.request();
  assert.equal(response.statusCode,200); assert.equal(response.body.sent,1);
  assert.equal(a.deliveries[0].sub.endpoint,'https://push.example/b');
  assert.equal(a.deliveries[0].payload.url,'/#chat');
  assert.equal(response.body.recipientRegistered,true);
});
test('unassigned subscriptions do not falsely report that partner is registered',async()=>{
  const response=await api({noPartner:true}).request();
  assert.equal(response.statusCode,200);assert.equal(response.body.recipientRegistered,false);
});
test('expired subscriptions are cleaned and failed deliveries are not reported as success', async () => {
  const a = api({failPush:true}); const response = await a.request();
  assert.equal(response.statusCode,502); assert.equal(a.removed[0],'https://push.example/b');
});
test('burst limiter returns 429 after 20 requests per instance', async () => {
  const a = api(); for(let i=0;i<20;i++) assert.equal((await a.request()).statusCode,200);
  const response = await a.request(); assert.equal(response.statusCode,429);
  assert.equal(response.headers['Retry-After'],'60');
});

function worker(clients = [], options = {}){
  const handlers = new Map(), shown = [], opened = [];
  let skipped = false, claimed = false;
  const self = { location:{origin:'https://furhi.vercel.app'}, addEventListener:(name,callback)=>handlers.set(name,callback),
    skipWaiting:async()=>{skipped=true;},
    clients:{matchAll:async()=>clients,openWindow:async url=>opened.push(url),claim:async()=>{claimed=true;}},
    registration:{showNotification:async(title,options)=>shown.push({title,options})} };
  vm.runInNewContext(fs.readFileSync(path.join(root,'sw.js'),'utf8'),{self,URL,Response,...options});
  const invoke = async (name,values) => { let pending; handlers.get(name)({...values,waitUntil:p=>{pending=p;}}); await pending; };
  return {handlers,shown,opened,invoke,skipped:()=>skipped,claimed:()=>claimed};
}
test('hidden chat tab does not suppress push notification', async () => {
  const w = worker([{url:'https://furhi.vercel.app/#chat',visibilityState:'hidden',focused:false}]);
  await w.invoke('push',{data:{json:()=>({type:'chat',title:'Mesaj',url:'/#chat'})}});
  assert.equal(w.shown.length,1);
});
test('visible focused chat suppresses duplicate notification', async () => {
  const w = worker([{url:'https://furhi.vercel.app/#chat',visibilityState:'visible',focused:true}]);
  await w.invoke('push',{data:{json:()=>({type:'chat'})}}); assert.equal(w.shown.length,0);
});
test('notification click navigates existing window to target before focus', async () => {
  const actions = [];
  const client = {url:'https://furhi.vercel.app/#home',navigate:async url=>{actions.push(url);return client;},focus:async()=>actions.push('focus')};
  const w = worker([client]);
  await w.invoke('notificationclick',{notification:{close(){},data:{url:'/#chat'}}});
  assert.deepEqual(actions,['https://furhi.vercel.app/#chat','focus']);
});
test('notification cannot open external origin', async () => {
  const w = worker(); await w.invoke('notificationclick',{notification:{close(){},data:{url:'https://attacker.example'}}});
  assert.equal(w.opened[0],'https://furhi.vercel.app/');
});
test('service worker does not intercept private data or API requests', () => {
  const w = worker(); let intercepted = false;
  for(const url of ['https://furhi.vercel.app/api/send-notification','https://db.example/rest/v1/messages','https://db.example/storage/v1/photo.jpg']){
    w.handlers.get('fetch')({request:{method:'GET',url},respondWith(){intercepted=true;}});
  }
  assert.equal(intercepted,false);
});

for(const failAt of ['open','put']){
  test('successful network response survives cache '+failAt+' failure',async()=>{
    const caches={open:async()=>{
      if(failAt==='open')throw new Error('quota');
      return {put:async()=>{throw new Error('quota');}};
    },match:async()=>new Response('stale')};
    const w=worker([],{caches,fetch:async()=>new Response('fresh',{status:200})});
    let response;const work=[];
    w.handlers.get('fetch')({request:{method:'GET',url:'https://furhi.vercel.app/script.js'},
      respondWith:pending=>{response=pending;},waitUntil:pending=>work.push(pending)});
    const result=await response;assert.equal(result.status,200);assert.equal(await result.text(),'fresh');
    await Promise.all(work);
  });
}
test('cache unavailable does not block worker install or activation',async()=>{
  const caches={open:async()=>{throw new Error('quota');},keys:async()=>{throw new Error('storage unavailable');}};
  const w=worker([],{caches});await w.invoke('install',{});await w.invoke('activate',{});
  assert.equal(w.skipped(),true);assert.equal(w.claimed(),true);
});
