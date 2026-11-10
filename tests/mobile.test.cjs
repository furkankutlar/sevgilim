const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function app({ visualViewport = true, theme = '' } = {}){
  const frames = new Map(), observers = new Map(), properties = new Map();
  let frameId = 0;
  function target(value = {}){
    const events = new Map();
    return { ...value, events, addEventListener(name,callback){ events.set(name,callback); },
      emit(name){ events.get(name)?.(); } };
  }
  function element(dataset = {}){
    const attributes = new Map(), classes = new Set();
    return {dataset,attributes,classes,
      classList:{toggle(name,enabled){enabled?classes.add(name):classes.delete(name);},contains(name){return classes.has(name);}},
      setAttribute(name,value){attributes.set(name,value);},removeAttribute(name){attributes.delete(name);}};
  }
  const root = element({theme}); root.style = {setProperty:(name,value)=>properties.set(name,value)};
  const body = element(); const chatInput = element(); const themeMeta = {content:''};
  const names = ['home','memories','bucket','special','chat','settings'];
  const pages = names.map(name=>element({page:name})), buttons = names.map(name=>element({tab:name}));
  pages[0].classes.add('active');buttons[0].classes.add('active');
  const viewport = target({height:844,offsetTop:0,scale:1});
  const window = target({innerHeight:844,innerWidth:390,visualViewport:visualViewport?viewport:undefined});
  const document = target({documentElement:root,body,activeElement:null,hidden:false,
    getElementById: id=>id==='chatInput'?chatInput:null,
    querySelector: selector=>selector==='.tab-page.active'?pages.find(p=>p.classes.has('active')):
      selector==='.tab-btn.active'?buttons.find(b=>b.classes.has('active')):
      selector==='meta[name="theme-color"]'?themeMeta:null,
    querySelectorAll: selector=>selector==='.tab-page'?pages:selector==='.tab-btn'?buttons:[]
  });
  class MutationObserver{
    constructor(callback){this.callback=callback;}
    observe(node){observers.set(node,this.callback);}
  }
  const context = vm.createContext({window,document,MutationObserver,
    requestAnimationFrame(callback){const id=++frameId;frames.set(id,callback);return id;}});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../mobile.js'),'utf8'),context);
  function flush(){for(const [id,callback] of [...frames]){frames.delete(id);callback();}}
  flush();
  return {window,document,viewport,pages,buttons,body,root,themeMeta,chatInput,properties,flush,
    mutate: node=>observers.get(node)?.(),
    focus(){document.activeElement={matches:()=>true};document.emit('focusin');},
    blur(){document.activeElement=null;document.emit('focusout');}
  };
}

test('initial route sets one current tab and preserves mobile send action',()=>{
  const a=app();
  assert.equal(a.body.dataset.currentTab,'home');
  assert.equal(a.buttons.filter(b=>b.attributes.get('aria-current')==='page').length,1);
  assert.equal(a.chatInput.attributes.get('enterkeyhint'),'send');
});
test('asynchronous tab activation uses active navigation target rather than reverting to home',()=>{
  const a=app();
  a.pages[0].classes.delete('active');a.buttons[0].classes.delete('active');a.buttons[4].classes.add('active');
  a.mutate(a.pages[0]);a.flush();
  assert.equal(a.body.dataset.currentTab,'chat');
  assert.equal(a.buttons[4].attributes.get('aria-current'),'page');
  a.pages[4].classes.add('active');a.mutate(a.pages[4]);a.flush();
  assert.equal(a.body.dataset.currentTab,'chat');
});
test('iOS-style visual viewport shrink offsets composer above keyboard',()=>{
  const a=app();a.focus();a.viewport.height=460;a.viewport.offsetTop=12;a.viewport.emit('resize');a.flush();
  assert.equal(a.body.classes.has('keyboard-open'),true);
  assert.equal(a.properties.get('--viewport-height'),'460px');
  assert.equal(a.properties.get('--viewport-offset'),'12px');
  assert.equal(a.properties.get('--keyboard-inset'),'372px');
});
test('Android layout resize hides navigation without applying keyboard height twice',()=>{
  const a=app();a.focus();a.window.innerHeight=460;a.viewport.height=460;a.viewport.emit('resize');a.flush();
  assert.equal(a.body.classes.has('keyboard-open'),true);
  assert.equal(a.properties.get('--keyboard-inset'),'0px');
});
test('blur keeps geometry until keyboard closing animation restores viewport',()=>{
  const a=app();a.focus();a.viewport.height=460;a.viewport.emit('resize');a.flush();
  a.blur();a.flush();
  assert.equal(a.body.classes.has('keyboard-open'),true);
  a.viewport.height=844;a.viewport.emit('resize');a.flush();
  assert.equal(a.body.classes.has('keyboard-open'),false);
  assert.equal(a.properties.get('--keyboard-inset'),'0px');
});
test('pinch zoom is not mistaken for keyboard opening',()=>{
  const a=app();a.focus();a.viewport.scale=2;a.viewport.height=422;a.viewport.emit('resize');a.flush();
  assert.equal(a.body.classes.has('keyboard-open'),false);
});
test('theme color follows saved theme initially and later toggles',()=>{
  const a=app({theme:'dark'});assert.equal(a.themeMeta.content,'#1c191b');
  delete a.root.dataset.theme;a.mutate(a.root);
  assert.equal(a.themeMeta.content,'#fbf6f2');
});
test('viewport fallback works when VisualViewport is unavailable',()=>{
  const a=app({visualViewport:false});a.focus();a.window.innerHeight=480;a.window.emit('resize');a.flush();
  assert.equal(a.properties.get('--viewport-height'),'480px');
  assert.equal(a.properties.get('--keyboard-inset'),'0px');
  assert.equal(a.body.classes.has('keyboard-open'),true);
});
