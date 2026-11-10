const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { webcrypto } = require('node:crypto');
const root = path.join(__dirname, '..');

function app(messages = [], { storage = new Map(), failStorageWrites = false } = {}){
  const rows = messages.map(row => ({ ...row }));
  const calls = [], channels = new Map(), intervals = new Map(), events = new Map();
  let intervalId = 0, failInsert = false, loseInsertResponse = false;
  function element(){
    let text = '';
    return { style: {}, dataset: {}, value: '', hidden: false, disabled: false, innerHTML: '',
      scrollHeight: 1000, scrollTop: 800, clientHeight: 200,
      classList: { add(){}, remove(){}, toggle(){} },
      addEventListener(){}, appendChild(){}, remove(){}, setAttribute(){}, removeAttribute(){},
      getAttribute(){ return null; },
      set textContent(value){ text = String(value); this.innerHTML = text.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); },
      get textContent(){ return text; }
    };
  }
  const nodes = new Map([...fs.readFileSync(path.join(root, 'index.html'), 'utf8').matchAll(/id="([^"]+)"/g)]
    .map(match => [match[1], element()]));
  const document = { visibilityState: 'visible', hidden: false, body: element(), documentElement: element(),
    getElementById: id => nodes.get(id) || null, createElement: element,
    querySelectorAll: () => [], addEventListener: (name, callback) => events.set(name, callback) };
  const window = { addEventListener: (name, callback) => events.set(name, callback), scrollTo(){}, matchMedia: () => ({ matches: false }) };
  function from(table){
    let operation = 'select', limit = Infinity, filter = null, ids = null, neq = null, eq = null, isNull = null, input;
    const query = {
      select(columns, options){ query.columns = columns; query.head = options?.head; return query; },
      order(){ return query; }, limit(n){ limit = n; return query; },
      or(value){ filter = value; return query; },
      neq(column, value){ neq = [column, value]; return query; },
      eq(column, value){ eq = [column, value]; return query; },
      maybeSingle(){ query.single = true; return query; },
      is(column){ isNull = column; return query; },
      in(column, values){ ids = values; return query; },
      insert(value){ operation = 'insert'; input = value; return query; },
      update(value){ operation = 'update'; input = value; return query; },
      then(resolve, reject){
        calls.push({ table, operation, columns: query.columns, limit });
        let selected = rows.filter(row => (!ids || ids.includes(row.id)) && (!eq || row[eq[0]] === eq[1]) && (!neq || row[neq[0]] !== neq[1]) && (!isNull || row[isNull] == null));
        if(filter){
          const match = filter.match(/^created_at\.lt\.(.*),and\(created_at\.eq\.(.*),id\.lt\.(.*)\)$/);
          assert.ok(match, 'stable keyset pagination filter');
          selected = selected.filter(row => row.created_at < match[1] || (row.created_at === match[2] && row.id < match[3]));
        }
        selected.sort((a,b) => a.created_at === b.created_at ? b.id.localeCompare(a.id) : b.created_at.localeCompare(a.created_at));
        let result;
        if(operation === 'insert'){
          if(failInsert) result = { error: new Error('offline') };
          else if(input.some(row => rows.some(existing => existing.id === row.id))) result = {error:{code:'23505'}};
          else {
            rows.push(...input.map((row, i) => ({ ...row, id: row.id || 'new-' + i, created_at: '2030-01-01T00:00:00Z', read_at: null })));
            result = { error: loseInsertResponse ? new Error('response lost') : null };
            loseInsertResponse = false;
          }
        }else if(operation === 'update'){
          selected.forEach(row => Object.assign(row, input)); result = { error: null };
        }else result = { data: query.single ? (selected[0] ? {...selected[0]} : null) : selected.slice(0, limit).map(row => ({ ...row })), count: selected.length, error: null };
        return Promise.resolve(result).then(resolve, reject);
      }
    };
    return query;
  }
  const fakeSupabase = { from, channel(name){
    const channel = { handlers: [], on(kind, filter, callback){ this.handlers.push({kind, filter, callback}); return this; },
      subscribe(callback){ this.status = callback; return this; }, send: async () => 'ok' };
    channels.set(name, channel); return channel;
  }};
  const context = vm.createContext({ document, window, navigator: { onLine: true }, location: { hash:'', pathname:'/', search:'' },
    history: { replaceState(){} }, localStorage: { getItem: key => key === 'biz-identity' ? 'Furki' : storage.get(key) || null,
      setItem: (key,value) => { if(failStorageWrites) throw new Error('quota'); storage.set(key,value); }, removeItem:key=>storage.delete(key) },
    supabase: { createClient: () => fakeSupabase }, console: { log(){}, error(){}, warn(){} },
    setTimeout: () => 0, clearTimeout(){}, setInterval(callback, ms){ const id = ++intervalId; intervals.set(id, {callback, ms}); return id; },
    clearInterval: id => intervals.delete(id), requestAnimationFrame: callback => callback(),
    AbortController, crypto:webcrypto, fetch: async () => ({ ok: true, json: async () => ({ sent: 1, total: 1 }) }),
    alert(){}, confirm: () => false });
  vm.runInContext(fs.readFileSync(path.join(root, 'script.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(root, 'chat.js'), 'utf8'), context);
  return { context, rows, calls, nodes, channels, intervals, events, storage,
    run: code => vm.runInContext(code, context), failInsert: () => { failInsert = true; },
    loseInsertResponse: () => { loseInsertResponse = true; } };
}
function message(i, date){
  return { id: String(i).padStart(6, '0'), created_at: date || new Date(Date.UTC(2026, 1, 1, 0, i)).toISOString(),
    sender: 'Hilalişko', content: 'Mesaj ' + i, read_at: null };
}
const settle = () => new Promise(resolve => setImmediate(resolve));

test('home does not load message history, memories or photos', async () => {
  const a = app([message(1)]); await settle();
  assert.ok(a.calls.every(call => call.table === 'messages' && call.columns === 'id'));
});
test('250+ messages: newest page first and complete history without duplicates', async () => {
  const a = app(Array.from({length: 257}, (_, i) => message(i)));
  a.run("currentTab = 'chat'"); await a.run('refreshChat()');
  assert.equal(a.run('orderedMessages()[0].id'), '000207');
  assert.equal(a.run('orderedMessages().at(-1).id'), '000256');
  for(let i=0; i<5; i++) await a.run('loadOlderMessages()');
  assert.equal(a.run('orderedMessages().length'), 257);
  assert.equal(a.run('hasOlderMessages'), false);
  assert.equal(a.run('orderedMessages()[0].id'), '000000');
});
test('identical timestamps use id cursor without dropping rows', async () => {
  const a = app(Array.from({length: 125}, (_, i) => message(i, '2026-01-01T00:00:00Z')));
  a.run("currentTab = 'chat'"); await a.run('refreshChat()');
  await a.run('loadOlderMessages()'); await a.run('loadOlderMessages()');
  assert.equal(a.run('orderedMessages().length'), 125);
});
test('background chat does not mark messages read; fallback stops while hidden', async () => {
  const a = app([message(1)]);
  a.run("currentTab = 'chat'; document.visibilityState = 'hidden'; syncChatActivity()");
  await a.run('markMessagesAsRead()');
  assert.equal(a.rows[0].read_at, null);
  assert.equal([...a.intervals.values()].some(i => i.ms === 15000), false);
});
test('no fallback polling with healthy realtime, fallback enabled on disconnect', async () => {
  const a = app(); a.run("currentTab = 'chat'");
  a.channels.get('messages-realtime').status('SUBSCRIBED'); await settle();
  assert.equal([...a.intervals.values()].some(i => i.ms === 15000), false);
  a.channels.get('messages-realtime').status('CHANNEL_ERROR'); await settle();
  assert.equal([...a.intervals.values()].filter(i => i.ms === 15000).length, 1);
});
test('double send inserts one message and preserves next draft typed during request', async () => {
  const a = app(); a.run("currentTab = 'chat'; chatInput.value = 'Merhaba'");
  const first = a.run('sendMessage()'); const duplicate = a.run('sendMessage()');
  a.run("chatInput.value = 'Bir sonraki mesaj'");
  await Promise.all([first, duplicate]);
  assert.equal(a.rows.length, 1); assert.equal(a.nodes.get('chatInput').value, 'Bir sonraki mesaj');
  assert.equal(a.nodes.get('chatSendBtn').disabled, false);
});
test('failed send keeps draft and restores send button', async () => {
  const a = app(); a.failInsert(); a.run("chatInput.value = 'Taslak'");
  await a.run('sendMessage()');
  assert.equal(a.nodes.get('chatInput').value, 'Taslak');
  assert.match(a.nodes.get('chatFeedback').textContent, /gönderilemedi/);
  assert.equal(a.nodes.get('chatSendBtn').disabled, false);
});
test('committed message with lost response is reconciled on retry, never inserted twice', async () => {
  const a = app(); a.loseInsertResponse(); a.run("chatInput.value = 'Bağlantı koptu'");
  assert.equal(await a.run('sendMessage()'), false);
  const id = a.rows[0].id;
  assert.equal(a.nodes.get('chatInput').value, 'Bağlantı koptu');
  assert.equal(await a.run('sendMessage()'), true);
  assert.equal(a.rows.length,1); assert.equal(a.rows[0].id,id);
  assert.equal(a.nodes.get('chatInput').value,'');
  assert.equal(a.storage.has('biz-pending-message:Furki'),false);
});
test('uncertain message survives reload with the same id and restores draft', async () => {
  const first = app(); first.loseInsertResponse(); first.run("chatInput.value = 'Taslak geri gelsin'");
  await first.run('sendMessage()');
  const second = app(first.rows,{storage:first.storage});
  assert.equal(second.nodes.get('chatInput').value,'Taslak geri gelsin');
  assert.equal(await second.run('sendMessage()'),true); assert.equal(second.rows.length,1);
});
for(const reload of [false,true]){
  test('daily answer does not overwrite uncertain chat id'+(reload?' across reload':''),async()=>{
    const first=app();first.loseInsertResponse();first.run("chatInput.value = 'Önceki mesaj'");
    assert.equal(await first.run('sendMessage()'),false);
    const originalId=first.rows[0].id;
    assert.equal(await first.run("sendChatContent('Günün sorusuna farklı bir cevap')"),true);
    assert.equal(first.rows.length,2);
    const saved=JSON.parse(first.storage.get('biz-pending-messages:Furki'));
    assert.equal(saved.length,1);assert.equal(saved[0].id,originalId);
    const retry=reload?app(first.rows,{storage:first.storage}):first;
    assert.equal(retry.nodes.get('chatInput').value,'Önceki mesaj');
    assert.equal(await retry.run('sendMessage()'),true);
    assert.equal(retry.rows.length,2);assert.equal(retry.rows[0].id,originalId);
    assert.equal(retry.storage.has('biz-pending-messages:Furki'),false);
  });
}
test('legacy pending record migrates without changing its id',()=>{
  const id='6de4db8a-cff4-41f1-83b8-a8c6aac99585';
  const storage=new Map([['biz-pending-message:Furki',JSON.stringify({id,sender:'Furki',content:'Eski taslak'})]]);
  const a=app([],{storage});
  assert.equal(a.nodes.get('chatInput').value,'Eski taslak');
  assert.equal(storage.has('biz-pending-message:Furki'),false);
  assert.equal(JSON.parse(storage.get('biz-pending-messages:Furki'))[0].id,id);
});
test('quota failure keeps multiple uncertain records safe in current session',async()=>{
  const a=app([],{failStorageWrites:true});a.loseInsertResponse();a.run("chatInput.value = 'Bellekteki mesaj'");
  await a.run('sendMessage()');const id=a.rows[0].id;
  await a.run("sendChatContent('Farklı cevap')");
  assert.equal(await a.run('sendMessage()'),true);
  assert.equal(a.rows.length,2);assert.equal(a.rows[0].id,id);
});
test('full pending outbox does not silently evict unresolved ids',async()=>{
  const a=app();a.failInsert();
  for(let i=0;i<50;i++)await a.run(`sendChatContent('Bekleyen ${i}')`);
  const ids=JSON.parse(a.storage.get('biz-pending-messages:Furki')).map(record=>record.id);
  assert.equal(await a.run("sendChatContent('Kapasiteyi aşan')"),false);
  assert.match(a.nodes.get('chatFeedback').textContent,/çok fazla/);
  assert.deepEqual(JSON.parse(a.storage.get('biz-pending-messages:Furki')).map(record=>record.id),ids);
  assert.equal(a.calls.filter(call=>call.operation==='insert').length,50);
});
test('same text intentionally sent after confirmed success gets a new id', async () => {
  const a = app();
  assert.equal(await a.run("sendChatContent('Tamam')"),true);
  assert.equal(await a.run("sendChatContent('Tamam')"),true);
  assert.equal(a.rows.length,2); assert.notEqual(a.rows[0].id,a.rows[1].id);
});
test('duplicate id with a different payload is not treated as successful send',async()=>{
  const id='6de4db8a-cff4-41f1-83b8-a8c6aac99585';
  const storage=new Map([['biz-pending-message:Furki',JSON.stringify({id,sender:'Furki',content:'Taslak'})]]);
  const a=app([{...message(1),id,sender:'Furki',content:'Farklı içerik'}],{storage});
  assert.equal(await a.run('sendMessage()'),false);
  assert.equal(a.nodes.get('chatInput').value,'Taslak');
});
test('new incoming message preserves position while reading older messages', async () => {
  const a = app([message(1)]); a.run("currentTab = 'chat'"); await a.run('refreshChat()');
  a.nodes.get('chatMessages').scrollTop = 100;
  const handler = a.channels.get('messages-realtime').handlers.find(h => h.filter.event === 'INSERT');
  handler.callback({ new: message(2) }); await settle();
  assert.equal(a.nodes.get('chatMessages').scrollTop, 100);
});
test('read receipt UPDATE changes existing bubble without fetching whole history', async () => {
  const own = {...message(1), sender: 'Furki'};
  const a = app([own]); a.run("currentTab = 'chat'"); await a.run('refreshChat()');
  const before = a.calls.filter(c => c.columns?.includes('content')).length;
  a.channels.get('messages-realtime').handlers.find(h => h.filter.event === 'UPDATE')
    .callback({ new: {...own, read_at: '2026-01-01T00:00:00Z'} }); await settle();
  assert.match(a.nodes.get('chatMessages').innerHTML, /Görüldü/);
  assert.equal(a.calls.filter(c => c.columns?.includes('content')).length, before);
});
