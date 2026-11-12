(() => {
  const root=document.getElementById('walletRoot');if(!root)return;
  const W=BizWallet,dialog=document.getElementById('walletDialog'),form=document.getElementById('walletForm'),feedback=document.getElementById('walletFeedback');
  let state=W.empty(),scope='mine',selected='',month=W.today().slice(0,7),loaded=false,busy=false,loading=false,epoch=0,visibleLimit=30,pending=null;
  const key='biz-wallet-pending-v1',esc=escapeHtml;
  try{pending=JSON.parse(localStorage.getItem(key)||'null');}catch(e){}
  const actor=()=>['Furki','Hilalişko'].includes(myIdentity)?myIdentity:null;
  const money=cents=>new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY',maximumFractionDigits:2}).format(cents/100);
  const decimal=cents=>(cents/100).toFixed(2).replace('.',',');
  const account=id=>state.accounts.find(a=>a.id===id);
  const monthTitle=()=>new Date(month+'-15T12:00:00Z').toLocaleDateString('tr-TR',{month:'long',year:'numeric'});
  function notice(message){feedback.textContent=message;}
  async function request(body){
    const response=await fetchWithTimeout('/api/wallet',body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});
    const data=await response.json();if(!response.ok)throw Object.assign(Error(data.error||'İşlem tamamlanamadı.'),{status:response.status});return data;
  }
  function render(){
    const identity=actor(),accounts=state.accounts.filter(a=>scope==='all'||a.owner===identity);
    if(selected&&!accounts.some(a=>a.id===selected))selected='';
    const ids=(selected?accounts.filter(a=>a.id===selected):accounts).map(a=>a.id),stats=W.summary(state,ids,month);
    const entries=state.entries.filter(t=>t.date.startsWith(month)&&(ids.includes(t.accountId)||ids.includes(t.toAccountId))).sort((a,b)=>b.date.localeCompare(a.date)||b.updatedAt.localeCompare(a.updatedAt)||b.id.localeCompare(a.id));
    root.innerHTML=`<div class="wallet-top"><div><span class="wallet-eyebrow">GÜNLÜK HAYAT, DAHA DÜZENLİ</span><h2>Cüzdan<span>ımız.</span></h2><p>Birlikte görün, kendi kasanızı yönetin.</p></div><button type="button" class="wallet-icon-btn" data-w="refresh" aria-label="Cüzdanı yenile">↻</button></div>
      <div class="wallet-scope" role="group" aria-label="Kasa görünümü"><button type="button" data-w="mine" aria-pressed="${scope==='mine'}">Kasalarım</button><button type="button" data-w="all" aria-pressed="${scope==='all'}">Tüm kasalar</button></div>
      ${pending?'<div class="wallet-alert">Önceki işlemin sonucu bekleniyor. Çift kayıt olmadan yeniden kontrol edebilirsin.<button type="button" data-w="retry">İşlemi tamamla</button></div>':''}
      <div class="wallet-balance"><div class="wallet-balance-top"><span>${selected?esc(account(selected).name):scope==='mine'?'Benim toplam bakiyem':'Birlikte toplam bakiyemiz'}</span><span aria-hidden="true">◈</span></div><strong>${money(stats.balance)}</strong><small>Güncel bakiye · tüm zamanlar</small><div class="wallet-balance-footer"><span>${accounts.length} kasa <span aria-hidden="true">/</span> Türk lirası</span><span class="wallet-chip">${esc(identity||'İsmini seç')}</span></div></div>
      <div class="wallet-month"><button type="button" data-w="prev" aria-label="Önceki ay">‹</button><strong>${esc(monthTitle())}</strong><button type="button" data-w="next" aria-label="Sonraki ay" ${month>=W.today().slice(0,7)?'disabled':''}>›</button></div>
      <div class="wallet-totals"><div><span><i aria-hidden="true">↙</i> Gelir</span><strong>${money(stats.income)}</strong></div><div><span><i aria-hidden="true">↗</i> Gider</span><strong>${money(stats.expense)}</strong></div></div>
      <div class="wallet-actions"><button type="button" class="wallet-primary" data-w="addEntry" ${!identity||!state.accounts.some(a=>a.owner===identity)?'disabled':''}>＋ İşlem ekle</button><button type="button" class="wallet-secondary" data-w="addAccount" ${!identity?'disabled':''}>Yeni kasa</button></div>
      <div class="wallet-section-title"><h3>Kasalar</h3>${selected?'<button type="button" data-w="clear">Tümünü göster</button>':'<span>Bakiyeler güncel</span>'}</div>
      <div class="wallet-accounts">${accounts.map(a=>`<div class="wallet-account ${selected===a.id?'selected':''}"><button type="button" class="wallet-account-select" data-w="select" data-id="${esc(a.id)}" aria-pressed="${selected===a.id}"><span class="wallet-account-icon" aria-hidden="true">▤</span><span><b>${esc(a.name)}</b><small>${esc(a.owner)}</small></span><strong>${money(W.accountBalance(state,a.id))}</strong></button>${a.owner===identity?`<button type="button" class="wallet-account-edit" data-w="editAccount" data-id="${esc(a.id)}" aria-label="${esc(a.name)} kasasını düzenle">Düzenle</button>`:''}</div>`).join('')||'<p class="wallet-empty">İlk kasanı oluştur.<br>Nakit, banka veya birikim hesabınla başlayabilirsin.</p>'}</div>
      <div class="wallet-section-title"><h3>Harcama dağılımı</h3><span>Seçili ay</span></div>
      <div class="wallet-breakdown">${stats.categories.map(c=>`<div><span>${esc(c.name)} <b>${money(c.total)}</b></span><div class="wallet-track"><i style="width:${Math.round(c.total/stats.expense*100)}%"></i></div></div>`).join('')||'<p class="wallet-empty">Bu ay için henüz gider yok.</p>'}</div>
      <div class="wallet-section-title"><h3>Hareketler</h3><span>${entries.length} işlem</span></div>
      <div class="wallet-transactions">${entries.slice(0,visibleLimit).map(t=>`<button type="button" class="wallet-transaction" data-w="editEntry" data-id="${esc(t.id)}" aria-label="${esc(t.note||t.category)}, ${money(t.amount)}${account(t.accountId)?.owner===identity?', düzenle':', ayrıntılar'}"><span class="wallet-tx-icon ${t.type}" aria-hidden="true">${t.type==='income'?'↙':t.type==='expense'?'↗':'⇄'}</span><span class="wallet-tx-title"><b>${esc(t.note||t.category)}</b><small>${esc(account(t.accountId)?.name||'Kasa')}${t.type==='transfer'?' → '+esc(account(t.toAccountId)?.name||'Kasa'):''} · ${esc(t.owner)}<br>${esc(t.date.split('-').reverse().join('.'))} · ${esc(t.category)}</small></span><strong class="${t.type}">${t.type==='income'?'+':t.type==='expense'?'−':''}${money(t.amount)}</strong></button>`).join('')||'<p class="wallet-empty">Bu görünümde kayıt yok.<br>İşlem eklediğinde burada göreceksin.</p>'}</div>
      ${entries.length>visibleLimit?'<button type="button" class="wallet-secondary wallet-more" data-w="more">Daha fazla göster</button>':''}
      <p class="wallet-footnote">Aktarımlar gelir ve gidere dahil edilmez. Diğer kişinin kasaları görüntülenebilir; işlem eklemek için kendi kasanı seç.</p>`;
    root.setAttribute('aria-busy',String(busy));
  }
  async function load(){
    if(loading||busy)return;loading=true;const ticket=epoch;
    try{const result=await request();if(ticket===epoch){state=result;loaded=true;render();}}
    catch(e){notice(e.message);if(!loaded)root.innerHTML='<p class="wallet-empty">Cüzdan yüklenemedi.</p><button type="button" class="wallet-secondary" data-w="refresh">Tekrar dene</button>';}
    finally{loading=false;}
  }
  async function save(body,retry=false){
    if(busy)return;if(pending&&!retry){notice('Önce bekleyen işlemi tamamla.');return;}
    busy=true;epoch++;form.querySelectorAll('button').forEach(b=>b.disabled=true);
    try{
      localStorage.setItem(key,JSON.stringify(body));pending=body;
      state=await request(body);localStorage.removeItem(key);pending=null;loaded=true;dialog.close();notice('Kaydedildi. Kasalar güncellendi.');render();
    }catch(e){
      if(e.status&&e.status<500){pending=null;try{localStorage.removeItem(key);}catch(ignore){}}
      notice(e.message);document.getElementById('walletFormError').textContent=e.message;render();
    }finally{busy=false;form.querySelectorAll('button').forEach(b=>b.disabled=false);root.setAttribute('aria-busy','false');}
  }
  const options=(items,value)=>items.map(([id,label])=>`<option value="${esc(id)}" ${id===value?'selected':''}>${esc(label)}</option>`).join('');
  function open(kind,item){
    if(!actor()){notice('Önce uygulamada adını seç.');return;}
    if(pending){notice('Önce bekleyen işlemi tamamla.');return;}
    const own=state.accounts.filter(a=>a.owner===actor()),isAccount=kind==='Account',readOnly=item&&(isAccount?item.owner:account(item.accountId)?.owner)!==actor();
    form.dataset.kind=kind;form.dataset.id=item?.id||crypto.randomUUID();form.dataset.revision=item?.revision||'';
    form.innerHTML=`<div class="wallet-sheet-top"><h3>${readOnly?'İşlem ayrıntıları':item?(isAccount?'Kasayı düzenle':'İşlemi düzenle'):(isAccount?'Yeni kasa':'Yeni işlem')}</h3><button type="button" data-close aria-label="Kapat">×</button></div>
      <fieldset ${readOnly?'disabled':''}>${isAccount?`
        <label>Kasa adı<input name="name" maxlength="35" required placeholder="Örn. Nakit veya banka" value="${esc(item?.name||'')}"></label>
        <label>Başlangıç bakiyesi (₺)<input name="opening" type="text" inputmode="decimal" required value="${decimal(item?.opening||0)}"></label><p class="wallet-form-hint">Takibe başladığın andaki tutar. Gelir toplamına eklenmez.</p>`:`
        <label>İşlem türü<select name="type">${options([['expense','Gider'],['income','Gelir'],['transfer','Kasalar arası aktarım']],item?.type||'expense')}</select></label>
        <label>Tutar (₺)<input name="amount" type="text" inputmode="decimal" required placeholder="0,00" value="${item?decimal(item.amount):''}"></label>
        <label>Kasa<select name="accountId">${options((readOnly?state.accounts:own).map(a=>[a.id,a.name+' · '+a.owner]),item?.accountId||(own.some(a=>a.id===selected)?selected:own[0]?.id))}</select></label>
        <label id="walletTransferLabel">Hedef kasa<select name="toAccountId">${options((readOnly?state.accounts:own).map(a=>[a.id,a.name]),item?.toAccountId||own[1]?.id)}</select></label>
        <label id="walletCategoryLabel">Kategori<select name="category">${options(W.CATEGORIES.map(c=>[c,c]),item?.category)}</select></label>
        <label>Tarih<input name="date" type="date" required min="2000-01-01" max="${W.today()}" value="${item?.date||W.today()}"></label>
        <label>Açıklama <span>(isteğe bağlı)</span><input name="note" maxlength="120" placeholder="Örn. Haftalık market" value="${esc(item?.note||'')}"></label>`}</fieldset>
      <p id="walletFormError" role="status" aria-live="polite"></p>${!readOnly?'<button type="submit" class="wallet-primary">Kaydet</button>':''}
      ${item&&!readOnly?`<details class="wallet-delete"><summary>${isAccount?'Kasayı':'İşlemi'} sil</summary><p>Bu kayıt silinecek${isAccount?'':'; kasa bakiyesi yeniden hesaplanacak'}. Emin misin?</p><button type="button" class="wallet-secondary" data-delete>Evet, sil</button></details>`:''}`;
    toggleFields();dialog.showModal();
  }
  function toggleFields(){if(!form.elements.type)return;document.getElementById('walletTransferLabel').hidden=form.elements.type.value!=='transfer';document.getElementById('walletCategoryLabel').hidden=form.elements.type.value!=='expense';}
  form.addEventListener('change',toggleFields);
  form.addEventListener('submit',event=>{
    event.preventDefault();if(busy)return;
    try{
      const data=Object.fromEntries(new FormData(form));data.id=form.dataset.id;if(form.dataset.revision)data.revision=Number(form.dataset.revision);
      if(form.dataset.kind==='Account')data.opening=W.amount(data.opening);else data.amount=W.amount(data.amount);
      void save({action:'save'+form.dataset.kind,actor:actor(),data});
    }catch(e){document.getElementById('walletFormError').textContent=e.message;}
  });
  form.addEventListener('click',event=>{
    if(event.target.closest('[data-close]')){if(!busy)dialog.close();}
    if(event.target.closest('[data-delete]'))void save({action:'delete'+form.dataset.kind,actor:actor(),data:{id:form.dataset.id,revision:Number(form.dataset.revision)}});
  });
  dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
  root.addEventListener('click',event=>{
    const b=event.target.closest('[data-w]');if(!b||busy)return;const action=b.dataset.w;
    if(action==='refresh'){notice('');void load();return;}
    if(action==='retry'){if(pending?.actor!==actor()){notice('Bekleyen işlemi tamamlamak için '+(pending?.actor||'önceki kişi')+' adını seç.');return;}void save(pending,true);return;}
    if(action==='addAccount'){open('Account');return;}if(action==='editAccount'){open('Account',account(b.dataset.id));return;}
    if(action==='addEntry'){open('Entry');return;}if(action==='editEntry'){open('Entry',state.entries.find(t=>t.id===b.dataset.id));return;}
    if(action==='mine'||action==='all'){scope=action;selected='';visibleLimit=30;}
    if(action==='select'){selected=selected===b.dataset.id?'':b.dataset.id;visibleLimit=30;}
    if(action==='clear')selected='';if(action==='more')visibleLimit+=30;
    if(action==='prev'||action==='next'){const d=new Date(month+'-15T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+(action==='prev'?-1:1));month=d.toISOString().slice(0,7);visibleLimit=30;}
    render();
  });
  document.getElementById('openWallet').addEventListener('click',()=>switchTab('wallet'));
  document.getElementById('walletBack').addEventListener('click',()=>switchTab('home'));
  window.addEventListener('biz:tabchange',event=>{if(event.detail.tab==='wallet'){if(loaded)render();void load();}});
  window.addEventListener('biz:identitychange',()=>{if(dialog.open)dialog.close();scope='mine';selected='';if(loaded)render();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&currentTab==='wallet'&&!dialog.open)void load();});
  window.addEventListener('online',()=>{if(currentTab==='wallet')void load();});
  setInterval(()=>{if(currentTab==='wallet'&&!document.hidden&&!dialog.open&&!pending)void load();},45000);
  if(currentTab==='wallet')void load();
})();
