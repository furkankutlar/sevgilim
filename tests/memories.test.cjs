const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function memoriesApp(count = 55){
  const rows = Array.from({length:count},(_,i)=>({id:String(i).padStart(6,'0'),title:'Anı '+i,
    memory_date:'2026-11-01',description:'Not '+i,image_url:null,original_image_url:null}));
  const nodes = new Map(['loadMoreMemoriesBtn','memoriesFeedback'].map(id=>[id,{textContent:'',hidden:false,disabled:false,addEventListener(){}}]));
  const grid = {innerHTML:''}, calls = [];
  let failNext = false;
  const client = {from(table){
    assert.equal(table,'memories');
    let filter = null, limit;
    const query = {select(){return query;},order(){return query;},or(value){filter=value;return query;},limit(value){limit=value;return query;},
      then(resolve,reject){
        calls.push({limit,filter});
        if(failNext){failNext=false;return Promise.resolve({error:new Error('network')}).then(resolve,reject);}
        let selected = rows.slice();
        if(filter){
          const match = filter.match(/^memory_date\.lt\.(.*),and\(memory_date\.eq\.(.*),id\.lt\.(.*)\)$/);
          assert.ok(match,'date/id keyset filter');
          selected=selected.filter(row=>row.memory_date<match[1]||(row.memory_date===match[2]&&row.id<match[3]));
        }
        selected.sort((a,b)=>b.memory_date.localeCompare(a.memory_date)||b.id.localeCompare(a.id));
        return Promise.resolve({data:selected.slice(0,limit).map(row=>({...row})),error:null}).then(resolve,reject);
      }};
    return query;
  }};
  const source=fs.readFileSync(path.join(__dirname,'../script.js'),'utf8');
  const start=source.indexOf('let currentMemories = []');
  const end=source.indexOf('// ANILAR — FOTOĞRAF KIRPMA',start);
  assert.ok(start>0&&end>start);
  const context=vm.createContext({supabaseClient:client,memoriesGrid:grid,document:{getElementById:id=>nodes.get(id)},
    escapeHtml:String,formatDate:String,timeAgo:()=>'',console:{error(){}},confirm:()=>false,alert(){}});
  vm.runInContext(source.slice(start,end),context);
  return {rows,nodes,calls,grid,run:code=>vm.runInContext(code,context),failNext:()=>{failNext=true;}};
}

test('memories initially load 20 and use date/id cursor for remaining pages',async()=>{
  const a=memoriesApp();await a.run('fetchMemories()');
  assert.equal(a.run('currentMemories.length'),20);
  assert.equal(a.run('currentMemories[0].id'),'000054');
  assert.equal(a.calls[0].limit,20);
  await a.run('fetchMemories({append:true})');
  await a.run('fetchMemories({append:true})');
  assert.equal(a.run('currentMemories.length'),55);
  assert.equal(a.run('hasMoreMemories'),false);
  assert.equal(a.run('new Set(currentMemories.map(m=>m.id)).size'),55);
  assert.equal(a.nodes.get('loadMoreMemoriesBtn').hidden,true);
});
test('refresh after add/edit/delete retains loaded depth and correct ordering',async()=>{
  const a=memoriesApp();await a.run('fetchMemories()');await a.run('fetchMemories({append:true})');
  a.rows.push({id:'new-memory',title:'Yeni',memory_date:'2026-11-10'});
  a.rows.find(m=>m.id==='000050').memory_date='2026-10-01';
  a.rows.splice(a.rows.findIndex(m=>m.id==='000053'),1);
  await a.run('fetchMemories({force:true})');
  assert.equal(a.run('currentMemories.length'),40);
  assert.equal(a.run('currentMemories[0].id'),'new-memory');
  assert.equal(a.run("currentMemories.some(m=>m.id==='000053')"),false);
  assert.equal(a.calls.at(-1).limit,40);
});
test('failed next page keeps existing memories and permits retry',async()=>{
  const a=memoriesApp();await a.run('fetchMemories()');a.failNext();
  await a.run('fetchMemories({append:true})');
  assert.equal(a.run('currentMemories.length'),20);
  assert.match(a.nodes.get('memoriesFeedback').textContent,/yüklenemedi/);
  assert.equal(a.nodes.get('loadMoreMemoriesBtn').disabled,false);
  await a.run('fetchMemories({append:true})');assert.equal(a.run('currentMemories.length'),40);
});
test('failed first page replaces spinner with retry state',async()=>{
  const a=memoriesApp();a.failNext();await a.run('fetchMemories()');
  assert.match(a.grid.innerHTML,/yüklenemedi/);
  assert.equal(a.nodes.get('loadMoreMemoriesBtn').hidden,false);
  assert.equal(a.nodes.get('loadMoreMemoriesBtn').textContent,'Tekrar dene');
});
test('returning to same memories within 30 seconds does not re-download list',async()=>{
  const a=memoriesApp();await a.run('fetchMemories()');await a.run('fetchMemories()');
  assert.equal(a.calls.length,1);
});
