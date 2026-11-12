(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.BizWallet=factory();})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  const PEOPLE=['Furki','Hilalişko'],CATEGORIES=['Market','Yeme içme','Ulaşım','Alışveriş','Faturalar','Sağlık','Eğlence','Diğer'];
  const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
  function fail(message,status=400){throw Object.assign(Error(message),{status});}
  function amount(value){
    const s=String(value).trim().replace(',','.');
    if(!/^-?\d{1,9}(?:\.\d{1,2})?$/.test(s))fail('Tutarı en fazla iki ondalık basamakla gir.');
    const result=Math.round(Number(s)*100);if(!Number.isSafeInteger(result)||Math.abs(result)>10000000000)fail('Tutar çok büyük.');return result;
  }
  const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  function date(value){return typeof value==='string'&&/^20\d{2}-\d{2}-\d{2}$/.test(value)&&!isNaN(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value&&value<=today();}
  const empty=()=>({version:1,accounts:[],entries:[]});
  function accountBalance(state,id){return state.entries.reduce((sum,t)=>sum+(t.type==='income'&&t.accountId===id?t.amount:0)-(t.type==='expense'&&t.accountId===id?t.amount:0)+(t.type==='transfer'?(t.toAccountId===id?t.amount:0)-(t.accountId===id?t.amount:0):0),state.accounts.find(a=>a.id===id)?.opening||0);}
  function summary(state,ids,month){
    const entries=state.entries.filter(t=>ids.includes(t.accountId)&&t.date.startsWith(month));
    const income=entries.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0),expense=entries.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
    return {balance:ids.reduce((s,id)=>s+accountBalance(state,id),0),income,expense,categories:CATEGORIES.map(name=>({name,total:entries.filter(t=>t.type==='expense'&&t.category===name).reduce((s,t)=>s+t.amount,0)})).filter(c=>c.total).sort((a,b)=>b.total-a.total)};
  }
  function apply(state,body,stamp=new Date().toISOString()){
    const {actor,action,data={}}=body;if(!PEOPLE.includes(actor))fail('Önce uygulamada adını seç.');
    if(!uuid(data.id))fail('Geçersiz kayıt.');
    const accounts=state.accounts,entries=state.entries;
    function own(id){const a=accounts.find(a=>a.id===id);if(!a)fail('Kasa bulunamadı.',404);if(a.owner!==actor)fail('Yalnızca kendi kasanda işlem yapabilirsin.',403);return a;}
    function revision(existing){if(existing&&existing.revision!==data.revision)fail('Bu kayıt diğer cihazda değişti. Listeyi yenileyip tekrar dene.',409);}
    if(action==='saveAccount'){
      const existing=accounts.find(a=>a.id===data.id);if(existing)own(existing.id);
      if(!existing&&data.revision!=null)fail('Bu kasa silinmiş. Listeyi yenile.',409);
      const name=typeof data.name==='string'?data.name.trim():'';
      if(!name||name.length>35||!Number.isSafeInteger(data.opening)||Math.abs(data.opening)>10000000000)fail('Kasa adı ve başlangıç bakiyesini kontrol et.');
      if(existing&&existing.name===name&&existing.opening===data.opening)return false;
      revision(existing);if(!existing&&accounts.length>=12)fail('En fazla 12 kasa oluşturabilirsin.');
      const item={id:data.id,name,opening:data.opening,owner:actor,revision:(existing?.revision||0)+1,updatedAt:stamp};
      if(existing)Object.assign(existing,item);else accounts.push(item);return true;
    }
    if(action==='deleteAccount'){
      if(!accounts.some(a=>a.id===data.id))return false;const a=own(data.id);revision(a);
      if(entries.some(t=>t.accountId===data.id||t.toAccountId===data.id))fail('Bu kasada hareket var. Önce hareketleri sil veya başka kasaya taşı.');
      state.accounts=accounts.filter(a=>a.id!==data.id);return true;
    }
    const existing=entries.find(t=>t.id===data.id);
    if(action==='deleteEntry'){
      if(!existing)return false;own(existing.accountId);revision(existing);state.entries=entries.filter(t=>t.id!==data.id);return true;
    }
    if(action!=='saveEntry')fail('Geçersiz işlem.');
    if(!existing&&data.revision!=null)fail('Bu işlem silinmiş. Listeyi yenile.',409);
    if(existing)own(existing.accountId);own(data.accountId);
    if(!['income','expense','transfer'].includes(data.type)||!Number.isSafeInteger(data.amount)||data.amount<=0||data.amount>10000000000||!date(data.date))fail('İşlem türünü, tutarı ve tarihi kontrol et. Gelecek tarihli işlem girilemez.');
    if(data.type==='transfer'){own(data.toAccountId);if(data.toAccountId===data.accountId)fail('Aktarılacak farklı bir kasa seç.');}
    if(data.type==='expense'&&!CATEGORIES.includes(data.category))fail('Harcama kategorisini seç.');
    if(typeof data.note!=='string'||data.note.length>120)fail('Açıklama en fazla 120 karakter olabilir.');
    const item={id:data.id,accountId:data.accountId,toAccountId:data.type==='transfer'?data.toAccountId:null,type:data.type,amount:data.amount,date:data.date,category:data.type==='expense'?data.category:data.type==='income'?'Gelir':'Aktarım',note:data.note.trim(),owner:actor};
    if(existing&&Object.keys(item).every(k=>item[k]===existing[k]))return false;
    revision(existing);if(!existing&&entries.length>=2000)fail('Cüzdanın 2.000 işlem sınırına ulaştı.');
    item.revision=(existing?.revision||0)+1;item.updatedAt=stamp;
    if(existing)Object.assign(existing,item);else entries.push(item);return true;
  }
  return {PEOPLE,CATEGORIES,amount,today,empty,accountBalance,summary,apply};
});
