(() => {
  const list=document.getElementById('priceList');if(!list)return;
  const feedback=document.getElementById('priceFeedback'),checkBtn=document.getElementById('priceCheckBtn'),addBtn=document.getElementById('priceAddBtn');
  const retryBtn=document.getElementById('priceRetryBtn');
  let busy=false,loadedAt=0;
  const money=value=>new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY',maximumFractionDigits:2}).format(value);
  const date=value=>value?new Date(value).toLocaleString('tr-TR',{timeZone:'Europe/Istanbul',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'Henüz kontrol edilmedi';
  async function request(body){
    // Ten products may take several upstream batches. Avoid the shared 30s limit.
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),170000);
    try{
      const response=await fetch('/api/price-tracker',{...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{}),signal:controller.signal});
      const result=await response.json();if(!response.ok)throw Error(result.error||'İşlem tamamlanamadı.');return result;
    }catch(error){
      if(error.name==='AbortError')throw Error('Kontrol uzun sürdü. Sonucu görmek için listeyi yenile; işlem sunucuda sürüyor olabilir.');
      throw error;
    }finally{clearTimeout(timer);}
  }
  function setBusy(value){busy=value;checkBtn.disabled=value;addBtn.disabled=value;retryBtn.disabled=value;list.setAttribute('aria-busy',String(value));}
  function render(data){
    document.getElementById('priceLastCheck').textContent='Son kontrol: '+date(data.lastCompletedAt);
    list.innerHTML=data.products.map(item=>{
      const history=item.history.slice(-3).reverse();
      const cheaper=item.price!=null && item.referencePrice!=null && item.price<item.referencePrice;
      const available=item.automationAvailable!==false;
      return `<article class="price-card ${available&&item.enabled?'':'price-paused'}" data-price-id="${escapeHtml(item.id)}">
        <div class="price-product-top">${item.image?`<img src="${escapeHtml(item.image)}" alt="" width="72" height="88" loading="lazy" decoding="async">`:''}<div><span class="price-store">${escapeHtml(item.store)}</span><h3>${escapeHtml(item.name)}</h3><a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">Mağazada gör ↗</a></div></div>
        <div class="price-current"><strong>${item.price==null?(available?'Fiyat bekleniyor':'Otomatik takip beklemede'):money(item.price)}</strong>${cheaper?`<span>Takipte görülen üst fiyattan %${Math.round((1-item.price/item.referencePrice)*100)} düşük</span>`:''}</div>
        <p class="price-meta">${item.inStock===false?'Stokta görünmüyor · ':''}${!available?'Otomatik fiyat alınamıyor':item.enabled?'Takip açık':'Takip duraklatıldı'} · ${escapeHtml(date(item.lastCheckedAt))}</p>
        ${item.error?`<p class="price-error">${escapeHtml(item.error)}</p>`:''}
        <form class="price-card-form"><div class="price-form-row"><div><label>Hedef fiyat (isteğe bağlı)<input class="price-target" type="number" inputmode="decimal" min="0.01" max="100000" step="0.01" placeholder="Örn. 250" value="${item.target??''}"></label></div><div><label>Bildirim alacak kişi<select class="price-owner"><option value="Hilalişko" ${item.owner==='Hilalişko'?'selected':''}>Hilalişko</option><option value="Furki" ${item.owner==='Furki'?'selected':''}>Furki</option></select></label></div></div>
        <label class="price-enabled-label"><input class="price-enabled" type="checkbox" ${item.enabled?'checked':''} ${available?'':'disabled'}> ${available?'Bu ürünü takip et':'Otomatik takip yeniden açılana kadar beklemede'}</label>
        <button class="btn-secondary" type="submit">Ayarları kaydet</button></form>
        ${history.length?`<details class="price-history"><summary>Kaydedilen fiyatlar</summary><ul>${history.map(point=>`<li><span>${escapeHtml(date(point.at))}</span><strong>${money(point.price)}</strong></li>`).join('')}</ul></details>`:''}
      </article>`;
    }).join('');
  }
  async function load(force=false){
    if(busy||(!force&&Date.now()-loadedAt<60000))return;
    setBusy(true);
    try{render(await request());loadedAt=Date.now();retryBtn.hidden=true;}
    catch(error){feedback.textContent=error.message;retryBtn.hidden=false;if(!loadedAt)list.textContent='Liste yüklenemedi. Bağlantını kontrol edip tekrar dene.';}
    finally{setBusy(false);}
  }
  retryBtn.addEventListener('click',()=>{feedback.textContent='';return load(true);});
  document.getElementById('openPriceTracker').addEventListener('click',()=>switchTab('prices'));
  document.getElementById('priceBackBtn').addEventListener('click',()=>switchTab('home'));
  window.addEventListener('biz:tabchange',event=>{if(event.detail.tab==='prices')void load();});
  checkBtn.addEventListener('click',async()=>{
    if(busy)return;setBusy(true);feedback.textContent='Mağaza fiyatları kontrol ediliyor…';
    try{
      const result=await request({action:'check'});
      feedback.textContent=result.skipped?(result.reason==='running'?'Bir kontrol zaten sürüyor. Biraz sonra tekrar açabilirsin.':'Yakın zamanda kontrol edildi. Yeniden kontrol edilebilecek zaman: '+date(result.nextCheckAt)):
        result.failed?'Kontrol tamamlandı; bazı mağaza fiyatları okunamadı. Eski kayıtlar korundu.':'Fiyatlar kontrol edildi. Aynı indirim için tekrar bildirim gönderilmez.';
    }catch(error){feedback.textContent=error.message;retryBtn.hidden=false;}finally{setBusy(false);await load(true);}
  });
  document.getElementById('priceAddForm').addEventListener('submit',async event=>{
    event.preventDefault();if(busy)return;setBusy(true);let saved=false;
    try{
      const result=await request({action:'add',url:document.getElementById('priceProductUrl').value.trim(),owner:document.getElementById('priceProductOwner').value});
      document.getElementById('priceProductUrl').value='';feedback.textContent=result.message;saved=true;
    }catch(error){feedback.textContent=error.message;retryBtn.hidden=false;}finally{setBusy(false);if(saved)await load(true);}
  });
  list.addEventListener('submit',async event=>{
    const form=event.target.closest('.price-card-form');if(!form)return;event.preventDefault();if(busy)return;
    const card=form.closest('[data-price-id]'),value=form.querySelector('.price-target').value;
    setBusy(true);let saved=false;const button=form.querySelector('button');button.disabled=true;
    try{
      await request({action:'update',id:card.dataset.priceId,enabled:form.querySelector('.price-enabled').checked,target:value===''?null:Number(value),owner:form.querySelector('.price-owner').value});
      feedback.textContent='Takip ayarları kaydedildi.';saved=true;
    }catch(error){feedback.textContent=error.message;retryBtn.hidden=false;}finally{setBusy(false);button.disabled=false;if(saved)await load(true);}
  });
  if(currentTab==='prices')void load();
})();
