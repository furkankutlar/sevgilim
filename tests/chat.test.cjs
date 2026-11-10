const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');

function app(messages = []){
  const rows = messages.map(row => ({ ...row }));
  const calls = [], channels = new Map(), intervals = new Map(), events = new Map();
  let intervalId = 0, failInsert = false;
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
    let operation = 'select', limit = Infinity, filter = null, ids = null, neq = null, isNull = null, input;
    const query = {
      select(columns, options){ query.columns = columns; query.head = options?.head; return query; },
      order(){ return query; }, limit(n){ limit = n; return query; },
      or(value){ filter = value; return query; },
      neq(column, value){ neq = [column, value]; return query; },
      is(column){ isNull = column; return query; },
      in(column, values){ ids = values; return query; },
      insert(value){ operation = 'insert'; input = value; return query; },
      update(value){ operation = 'update'; input = value; return query; },
      then(resolve, reject){
        calls.push({ table, operation, columns: query.columns, limit });
        let selected = rows.filter(row => (!ids || ids.includes(row.id)) && (!neq || row[neq[0]] !== neq[1]) && (!isNull || row[isNull] == null));
        if(filter){
          const match = filter.match(/^created_at\.lt\.(.*),and\(created_at\.eq\.(.*),id\.lt\.(.*)\)$/);
          assert.ok(match, 'stable keyset pagination filter');
          selected = selected.filter(row => row.created_at < match[1] || (row.created_at === match[2] && row.id < match[3]));
        }
        selected.sort((a,b) => a.created_at === b.created_at ? b.id.localeCompare(a.id) : b.created_at.localeCompare(a.created_at));
        let result;
        if(operation === 'insert'){
          if(failInsert) result = { error: new Error('offline') };
          else { rows.push(...input.map((row, i) => ({ ...row, id: 'new-' + i, created_at: '2030-01-01T00:00:00Z', read_at: null }))); result = { error: null }; }
        }else if(operation === 'update'){
          selected.forEach(row => Object.assign(row, input)); result = { error: null };
        }else result = { data: selected.slice(0, limit).map(row => ({ ...row })), count: selected.length, error: null };
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
    history: { replaceState(){} }, localStorage: { getItem: key => key === 'biz-identity' ? 'Furki' : null, setItem(){} },
    supabase: { createClient: () => fakeSupabase }, console: { log(){}, error(){}, warn(){} },
    setTimeout: () => 0, clearTimeout(){}, setInterval(callback, ms){ const id = ++intervalId; intervals.set(id, {callback, ms}); return id; },
    clearInterval: id => intervals.delete(id), requestAnimationFrame: callback => callback(),
    AbortController, fetch: async () => ({ ok: true, json: async () => ({ sent: 1, total: 1 }) }),
    alert(){}, confirm: () => false });
  vm.runInContext(fs.readFileSync(path.join(root, 'script.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(root, 'chat.js'), 'utf8'), context);
  return { context, rows, calls, nodes, channels, intervals, events,
    run: code => vm.runInContext(code, context), failInsert: () => { failInsert = true; } };
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
