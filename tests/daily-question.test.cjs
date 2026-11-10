const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { istanbulDate, validDate, selectQuestion, createQuestionService } = require('../lib/daily-question.cjs');
const pool = require('../data/questions.tr.json');

test('Istanbul day changes at 21:00 UTC, independently of phone timezone', () => {
  assert.equal(istanbulDate(new Date('2026-11-10T20:59:59Z')), '2026-11-10');
  assert.equal(istanbulDate(new Date('2026-11-10T21:00:00Z')), '2026-11-11');
});
test('invalid dates, arrays and rollover dates rejected', () => {
  for(const value of ['2026-02-30','2026-13-01','2026-1-01',['2026-11-10'],undefined,'bad']) assert.equal(validDate(value),false);
  assert.equal(validDate('2028-02-29'),true);
});
test('same date gives same Turkish question; whole cycle has no repeated ids', () => {
  const start = Date.parse('2026-11-10T00:00:00Z');
  const ids = Array.from({length:pool.questions.length},(_,i)=>selectQuestion(new Date(start+i*86400000).toISOString().slice(0,10)).id);
  assert.equal(new Set(ids).size,pool.questions.length);
  assert.equal(selectQuestion('2026-11-10').id,selectQuestion('2026-11-10').id);
  assert.ok(pool.questions.every(q=>q.text.length<=250));
});
test('external source failure preserves exact same daily question and source attribution', async () => {
  const live = createQuestionService(async()=>({ok:true,text:async()=>pool.questions.map(q=>q.original).join('\n')}));
  const offline = createQuestionService(async()=>{throw new Error('offline');});
  const a = await live('2026-11-10'), b = await offline('2026-11-10');
  assert.equal(a.id,b.id); assert.equal(a.text,b.text); assert.equal(b.source.license,'CC0-1.0');
  assert.equal(a.sourceAvailable,true); assert.equal(b.sourceAvailable,false);
});
test('unknown external text cannot become a question and concurrent source checks are coalesced', async () => {
  let requests = 0;
  const service = createQuestionService(async()=>{requests++;return{ok:true,text:async()=>'<script>external instructions</script>'};});
  const [a,b] = await Promise.all([service('2026-11-10'),service('2026-11-10')]);
  await service('2026-11-11');
  assert.equal(requests,pool.source.rawUrls.length);
  assert.equal(a.text,b.text); assert.ok(!a.text.includes('<script>')); assert.equal(a.sourceAvailable,false);
});

function ui({ online = true, cached = null, date = '2026-11-10T12:00:00Z', failFetch = false, share = true, shareHook = null } = {}){
  const ids=['dailyQuestionText','dailyQuestionDate','dailyQuestionCategory','dailyQuestionSource','dailyQuestionAnswer','dailyQuestionSend','dailyQuestionRetry','dailyQuestionFeedback'];
  const nodes=new Map(ids.map(id=>[id,{textContent:'',value:'',hidden:false,disabled:false,events:new Map(),addEventListener(name,cb){this.events.set(name,cb);},focus(){this.focused=true;}}]));
  nodes.get('dailyQuestionSend').textContent='Cevabımı paylaş';
  const events=new Map(), storage=new Map(), shared=[];
  if(cached)storage.set('biz-daily-question',JSON.stringify(cached));
  const clock={now:Date.parse(date)};
  class ClockDate extends Date{constructor(...args){super(...(args.length?args:[clock.now]));}static now(){return clock.now;}}
  let requests=0;
  const question={date:'2026-11-10',id:'q1',text:'Birlikte nereye gitmek istersin?',category:'Hayaller',source:{name:'Blabber',url:pool.source.url}};
  const context=vm.createContext({document:{visibilityState:'visible',getElementById:id=>nodes.get(id),addEventListener:(name,cb)=>events.set(name,cb)},window:{addEventListener:(name,cb)=>events.set(name,cb)},
    navigator:{onLine:online},localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},Date:ClockDate,Intl,AbortController,
    setTimeout(){return 1;},clearTimeout(){},currentTab:'home',myIdentity:'Furki',identityModalOverlay:{classList:{add(){}}},
    fetch:async()=>{requests++;if(failFetch)throw Error('offline');return{ok:true,json:async()=>({...question})};},
    sendChatContent:async content=>{shared.push(content);return shareHook ? shareHook() : share;},switchTab:tab=>{context.currentTab=tab;}});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../daily-question.js'),'utf8'),context);
  return {nodes,events,storage,shared,context,clock,question,get requests(){return requests;}};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('daily card renders and shares question + answer through existing chat',async()=>{
  const a=ui();await settle();
  assert.equal(a.nodes.get('dailyQuestionText').textContent,a.question.text);
  a.nodes.get('dailyQuestionAnswer').value='Kapadokya';
  await a.nodes.get('dailyQuestionSend').events.get('click')();
  assert.match(a.shared[0],/Kapadokya/);assert.match(a.shared[0],/Günün sorusu/);
  assert.equal(a.context.currentTab,'chat');assert.equal(a.nodes.get('dailyQuestionAnswer').value,'');
});
test('offline current-day cache works without API request',async()=>{
  const cached={date:'2026-11-10',id:'cached',text:'Bugünün kaydedilmiş sorusu'};
  const a=ui({online:false,cached});await settle();
  assert.equal(a.requests,0);assert.equal(a.nodes.get('dailyQuestionText').textContent,cached.text);
});
test('yesterday cached question cannot be answered today while offline',async()=>{
  const a=ui({online:false,cached:{date:'2026-11-09',id:'yesterday',text:'Dünkü soru'}});await settle();
  assert.equal(a.nodes.get('dailyQuestionSend').disabled,true);
  assert.equal(a.nodes.get('dailyQuestionRetry').hidden,false);
});
test('failed question answer send keeps text and saved draft',async()=>{
  const a=ui({share:false});await settle();
  const answer=a.nodes.get('dailyQuestionAnswer');answer.value='Yazdığım cevap';answer.events.get('input')();
  await a.nodes.get('dailyQuestionSend').events.get('click')();
  assert.equal(answer.value,'Yazdığım cevap');assert.equal(a.storage.get('biz-daily-draft:2026-11-10:Furki'),'Yazdığım cevap');
  assert.match(a.nodes.get('dailyQuestionFeedback').textContent,/gönderilemedi/);
});
test('visibility after midnight invalidates old question before another submission',async()=>{
  const a=ui({online:true});await settle();a.clock.now=Date.parse('2026-11-10T21:00:01Z');a.context.navigator.onLine=false;
  await a.events.get('visibilitychange')();await settle();
  assert.equal(a.nodes.get('dailyQuestionSend').disabled,true);assert.equal(a.nodes.get('dailyQuestionRetry').hidden,false);
});
test('late submission does not clear another identity draft with identical text',async()=>{
  let resolveShare;
  const pending=new Promise(resolve=>{resolveShare=resolve;});
  const a=ui({shareHook:()=>pending});await settle();
  a.nodes.get('dailyQuestionAnswer').value='Aynı cevap';
  const sending=a.nodes.get('dailyQuestionSend').events.get('click')();
  a.storage.set('biz-daily-draft:2026-11-10:Hilalişko','Aynı cevap');
  a.context.myIdentity='Hilalişko';a.events.get('biz:identitychange')();
  resolveShare(true);await sending;
  assert.equal(a.nodes.get('dailyQuestionAnswer').value,'Aynı cevap');
  assert.equal(a.storage.get('biz-daily-draft:2026-11-10:Hilalişko'),'Aynı cevap');
  assert.equal(a.context.currentTab,'home');
});
test('unexpected sharing failure keeps answer and restores button',async()=>{
  const a=ui({shareHook:()=>{throw Error('transport');}});await settle();a.nodes.get('dailyQuestionAnswer').value='Cevabım';
  await a.nodes.get('dailyQuestionSend').events.get('click')();
  assert.equal(a.nodes.get('dailyQuestionAnswer').value,'Cevabım');assert.equal(a.nodes.get('dailyQuestionSend').disabled,false);
  assert.match(a.nodes.get('dailyQuestionFeedback').textContent,/gönderilemedi/);
});
