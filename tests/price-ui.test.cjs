const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function ui(){
  const elements=new Map(),calls=[],timers=[],replies=[];
  function element(id){
    if(!elements.has(id))elements.set(id,{events:{},value:'',hidden:false,disabled:false,textContent:'',innerHTML:'',
      addEventListener(name,fn){this.events[name]=fn;},setAttribute(){},dataset:{}});
    return elements.get(id);
  }
  const context={document:{getElementById:element},window:{addEventListener(){}},currentTab:'home',switchTab(){},
    escapeHtml:value=>String(value).replace(/[<>&"]/g,ch=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[ch])),
    Intl,Date,AbortController,JSON,Error,String,Number,setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout(){},
    fetch:async(url,options)=>{calls.push({url,options});const reply=replies.shift();if(reply instanceof Error)throw reply;return{ok:true,json:async()=>reply};}};
  vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../price-tracker.js'),'utf8'),context);
  return {element,calls,replies,timers,load:()=>element('priceRetryBtn').events.click(),
    submit:()=>element('priceAddForm').events.submit({preventDefault(){}})};
}
test('price list failure offers GET retry and paused source does not appear active',async()=>{
  const u=ui();u.replies.push(Error('offline'));await u.load();
  assert.equal(u.element('priceRetryBtn').hidden,false);
  assert.match(u.element('priceList').textContent,/yüklenemedi/);
  u.replies.push({products:[{id:'watsons',store:'Watsons',name:'Product',url:'https://www.watsons.com.tr/p/BP_1',
    enabled:true,automationAvailable:false,price:null,history:[],target:null,owner:'Hilalişko',error:'Otomatik takip beklemede.'}]});
  await u.load();assert.equal(u.calls.length,2);assert.equal(u.calls[1].options.method,undefined);
  assert.equal(u.element('priceRetryBtn').hidden,true);
  assert.match(u.element('priceList').innerHTML,/Otomatik takip beklemede/);
  assert.doesNotMatch(u.element('priceList').innerHTML,/Takip açık/);
  assert.equal(u.element('priceCheckBtn').disabled,false);
});
test('failed settings save retains typed target and does not replace existing cards',async()=>{
  const u=ui(),button={disabled:false},target={value:'250'};
  const form={closest:()=>({dataset:{priceId:'one'}}),querySelector:selector=>({
    '.price-target':target,'.price-enabled':{checked:true},'.price-owner':{value:'Hilalişko'},button
  }[selector])};
  u.element('priceList').innerHTML='existing cards';u.replies.push(Error('offline'));
  await u.element('priceList').events.submit({target:{closest:()=>form},preventDefault(){}});
  assert.equal(target.value,'250');assert.equal(u.calls.length,1);
  assert.equal(u.element('priceList').innerHTML,'existing cards');assert.equal(button.disabled,false);
});
test('add request locks controls and uncertain timeout preserves URL without automatic resubmit',async()=>{
  const u=ui();u.element('priceProductUrl').value='https://www.gratis.com/product-p-123';
  u.replies.push(Object.assign(Error('aborted'),{name:'AbortError'}));
  const pending=u.submit();assert.equal(u.element('priceCheckBtn').disabled,true);await pending;
  assert.equal(u.calls.length,1);assert.ok(u.calls[0].options.signal);
  assert.match(u.element('priceFeedback').textContent,/sunucuda sürüyor/);
  assert.equal(u.element('priceProductUrl').value,'https://www.gratis.com/product-p-123');
  assert.equal(u.element('priceCheckBtn').disabled,false);
});
