(() => {
  const list=document.getElementById('priceList');if(!list)return;
  const feedback=document.getElementById('priceFeedback'),checkBtn=document.getElementById('priceCheckBtn'),addBtn=document.getElementById('priceAddBtn');
  let busy=false,loadedAt=0;
  const money=value=>new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY',maximumFractionDigits:2}).format(value);
  const date=value=>value?new Date(value).toLocaleString('tr-TR',{timeZone:'Europe/Istanbul',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'Henüz kontrol edilmedi';
  async function request(body){
    const response=await fetchWithTimeout('/api/price-tracker',body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});
    const result=await response.json();if(!response.ok)throw Error(result.error||'İşlem tamamlanamadı.');return result;
  }
  function render(data){
    document.getElementById('priceLastCheck').textContent='Son kontrol: '+date(data.lastCompletedAt);
    list.innerHTML=data.products.map(item=>{
      const history=item.history.slice(-3).reverse();
      const cheaper=item.price!=null && item.referencePrice!=null && item.price<item.referencePrice;
      return `<article class="price-card ${item.enabled?'':'price-paused'}" data-price-id="${escapeHtml(item.id)}">
        <div class="price-product-top">${item.image?`<img src="${escapeHtml(item.image)}" alt="" width="72" height="88" loading="lazy" decoding="async">`:''}<div><span class="price-store">${escapeHtml(item.store)}</span><h3>${escapeHtml(item.name)}</h3><a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">Mağazada gör ↗</a></div></div>
        <div class="price-current"><strong>${item.price==null?'Fiyat bekleniyor':money(item.price)}</strong>${cheaper?`<span>Takipte görülen üst fiyattan %${Math.round((1-item.price/item.referencePrice)*100)} düşük</span>`:''}</div>
        <p class="price-meta">${item.inStock===false?'Stokta görünmüyor · ':''}${item.enabled?'Takip açık':'Takip duraklatıldı'} · ${escapeHtml(date(item.lastCheckedAt))}</p>
        ${item.error?`<p class="price-error">${escapeHtml(item.error)}</p>`:''}
        <form class="price-card-form"><div class="price-form-row"><div><label>Hedef fiyat (isteğe bağlı)<input class="price-target" type="number" inputmode="decimal" min="0.01" max="100000" step="0.01" placeholder="Örn. 250" value="${item.target??''}"></label></div><div><label>Bildirim alacak kişi<select class="price-owner"><option value="Hilalişko" ${item.owner==='Hilalişko'?'selected':''}>Hilalişko</option><option value="Furki" ${item.owner==='Furki'?'selected':''}>Furki</option></select></label></div></div>
        <label class="price-enabled-label"><input class="price-enabled" type="checkbox" ${item.enabled?'checked':''}> Bu ürünü takip et</label>
        <button class="btn-secondary" type="submit">Ayarları kaydet</button></form>
        ${history.length?`<details class="price-history"><summary>Kaydedilen fiyatlar</summary><ul>${history.map(point=>`<li><span>${escapeHtml(date(point.at))}</span><strong>${money(point.price)}</strong></li>`).join('')}</ul></details>`:''}
      </article>`;
    }).join('');
  }
  async function load(force=false){
    if(busy||(!force&&Date.now()-loadedAt<60000))return;
    busy=true;checkBtn.disabled=true;
    try{render(await request());loadedAt=Date.now();}
    catch(error){feedback.textContent=error.message;}
    finally{busy=false;checkBtn.disabled=false;}
  }
  document.getElementById('openPriceTracker').addEventListener('click',()=>switchTab('prices'));
  document.getElementById('priceBackBtn').addEventListener('click',()=>switchTab('home'));
  window.addEventListener('biz:tabchange',event=>{if(event.detail.tab==='prices')void load();});
  checkBtn.addEventListener('click',async()=>{
    if(busy)return;busy=true;checkBtn.disabled=true;feedback.textContent='Mağaza fiyatları kontrol ediliyor…';
    try{
      const result=await request({action:'check'});
      feedback.textContent=result.skipped?(result.reason==='running'?'Bir kontrol zaten sürüyor. Biraz sonra tekrar açabilirsin.':'Yakın zamanda kontrol edildi. Yeniden kontrol edilebilecek zaman: '+date(result.nextCheckAt)):
        result.failed?'Kontrol tamamlandı; bazı mağaza fiyatları okunamadı. Eski kayıtlar korundu.':'Fiyatlar kontrol edildi. Aynı indirim için tekrar bildirim gönderilmez.';
    }catch(error){feedback.textContent=error.message;}finally{busy=false;await load(true);}
  });
  document.getElementById('priceAddForm').addEventListener('submit',async event=>{
    event.preventDefault();if(busy)return;busy=true;addBtn.disabled=true;
    try{
      const result=await request({action:'add',url:document.getElementById('priceProductUrl').value.trim(),owner:document.getElementById('priceProductOwner').value});
      document.getElementById('priceProductUrl').value='';feedback.textContent=result.message;
    }catch(error){feedback.textContent=error.message;}finally{busy=false;addBtn.disabled=false;await load(true);}
  });
  list.addEventListener('submit',async event=>{
    const form=event.target.closest('.price-card-form');if(!form)return;event.preventDefault();if(busy)return;
    const card=form.closest('[data-price-id]'),value=form.querySelector('.price-target').value;
    busy=true;const button=form.querySelector('button');button.disabled=true;
    try{
      await request({action:'update',id:card.dataset.priceId,enabled:form.querySelector('.price-enabled').checked,target:value===''?null:Number(value),owner:form.querySelector('.price-owner').value});
      feedback.textContent='Takip ayarları kaydedildi.';
    }catch(error){feedback.textContent=error.message;}finally{busy=false;button.disabled=false;await load(true);}
  });
  if(currentTab==='prices')void load();
})();
