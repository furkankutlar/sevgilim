(() => {
  const textEl = document.getElementById('dailyQuestionText');
  if(!textEl) return;
  const dateEl = document.getElementById('dailyQuestionDate');
  const categoryEl = document.getElementById('dailyQuestionCategory');
  const sourceEl = document.getElementById('dailyQuestionSource');
  const answerEl = document.getElementById('dailyQuestionAnswer');
  const sendBtn = document.getElementById('dailyQuestionSend');
  const retryBtn = document.getElementById('dailyQuestionRetry');
  const feedback = document.getElementById('dailyQuestionFeedback');
  let question = null;
  let loading = null;
  let sending = false;
  let midnightTimer = null;

  function today(){
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(new Date());
    return ['year','month','day'].map(name => parts.find(part => part.type === name).value).join('-');
  }
  const label = date => new Date(date + 'T12:00:00Z').toLocaleDateString('tr-TR', {timeZone:'Europe/Istanbul',day:'numeric',month:'long'});
  function valid(value, date){
    return value?.date === date && typeof value.id === 'string' && value.id.length <= 100 &&
      typeof value.text === 'string' && value.text.length > 0 && value.text.length <= 250;
  }
  function readCache(date){
    try{ const value = JSON.parse(localStorage.getItem('biz-daily-question')); return valid(value, date) ? value : null; }
    catch(error){ return null; }
  }
  function draftKey(){ return `biz-daily-draft:${question?.date || today()}:${myIdentity || 'unknown'}`; }
  function restoreDraft(){
    try{ answerEl.value = localStorage.getItem(draftKey()) || ''; }catch(error){}
  }
  function prefix(){ return `💭 Günün sorusu · ${label(question.date)}\n${question.text}\n\n`; }
  function render(value){
    const changed = question?.date !== value.date || question?.id !== value.id;
    question = value;
    dateEl.textContent = label(value.date);
    textEl.textContent = value.text;
    categoryEl.textContent = value.category || 'Biraz biz';
    sourceEl.href = 'https://github.com/bsoyka/blabber';
    sourceEl.hidden = false;
    answerEl.disabled = false;
    sendBtn.disabled = false;
    answerEl.maxLength = Math.min(350, 500 - prefix().length);
    retryBtn.hidden = true;
    if(changed) restoreDraft();
  }
  function scheduleMidnight(){
    clearTimeout(midnightTimer);
    const now = new Date();
    const tomorrow = Date.parse(today() + 'T00:00:00+03:00') + 86400000;
    midnightTimer = setTimeout(() => {
      if(document.visibilityState === 'visible' && currentTab === 'home') void load();
      else scheduleMidnight();
    }, Math.max(1000, tomorrow - now.getTime() + 250));
  }
  async function load(force = false){
    scheduleMidnight();
    const date = today();
    if(question?.date === date && !force) return;
    if(loading) return loading;
    const cached = readCache(date);
    if(cached && !force){ render(cached); feedback.textContent = ''; return; }
    // Dünkü soruya yanlışlıkla bugünün cevabını göndermeyelim.
    question = null;
    answerEl.disabled = true;
    sendBtn.disabled = true;
    textEl.textContent = 'Bugün birbirimize ne soralım?';
    feedback.textContent = 'Soru yükleniyor…';
    retryBtn.hidden = true;
    loading = (async () => {
      try{
        if(!navigator.onLine) throw new Error('offline');
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        let value;
        try{
          const response = await fetch(`/api/daily-question?date=${date}`, {signal:controller.signal});
          if(!response.ok) throw new Error('question request failed');
          value = await response.json();
        }finally{ clearTimeout(timeout); }
        if(date !== today()) return;
        if(!valid(value, date)) throw new Error('invalid question');
        render(value);
        try{ localStorage.setItem('biz-daily-question', JSON.stringify(value)); }catch(error){}
        feedback.textContent = '';
      }catch(error){
        const fallback = readCache(date);
        if(fallback){ render(fallback); feedback.textContent = 'Bugünün sorusu bu telefona kaydedilmiş.'; }
        else{
          textEl.textContent = 'Bugünün sorusu seni bekliyor.';
          feedback.textContent = navigator.onLine ? 'Soru yüklenemedi. Tekrar deneyebilirsin.' : 'Soruyu ilk kez açmak için internete bağlan.';
          retryBtn.hidden = false;
        }
      }
    })();
    try{ await loading; }finally{
      loading = null;
      if(date !== today() && currentTab === 'home') void load();
    }
  }
  answerEl.addEventListener('input', () => {
    try{ localStorage.setItem(draftKey(), answerEl.value); }catch(error){}
  });
  sendBtn.addEventListener('click', async () => {
    if(sending || !question) return;
    if(question.date !== today()){ await load(); return; }
    if(!myIdentity){ identityModalOverlay.classList.add('open'); feedback.textContent = 'Cevabını paylaşmak için önce kim olduğunu seç.'; return; }
    const answer = answerEl.value.trim();
    if(!answer){ answerEl.focus(); feedback.textContent = 'Önce birkaç kelime yaz.'; return; }
    const content = prefix() + answer;
    if(content.length > 500){ feedback.textContent = 'Cevabını biraz kısaltabilir misin?'; return; }
    sending = true;
    sendBtn.disabled = true;
    const oldLabel = sendBtn.textContent;
    const submitted = answerEl.value;
    const key = draftKey();
    sendBtn.textContent = 'Paylaşılıyor…';
    try{
      const sent = await sendChatContent(content);
      if(!sent){ feedback.textContent = 'Cevap gönderilemedi. Yazdıkların burada duruyor; tekrar deneyebilirsin.'; return; }
      if(draftKey() === key && answerEl.value === submitted){ answerEl.value = ''; try{ localStorage.removeItem(key); }catch(error){} }
      feedback.textContent = 'Cevabın sohbete eklendi.';
      if(draftKey() === key) switchTab('chat');
    }catch(error){
      feedback.textContent = 'Cevap gönderilemedi. Yazdıkların burada duruyor; tekrar deneyebilirsin.';
    }finally{ sending = false; sendBtn.disabled = !question; sendBtn.textContent = oldLabel; }
  });
  retryBtn.addEventListener('click', () => void load(true));
  window.addEventListener('biz:tabchange', event => { if(event.detail.tab === 'home') void load(); });
  window.addEventListener('biz:identitychange', restoreDraft);
  window.addEventListener('online', () => { if(currentTab === 'home') void load(); });
  document.addEventListener('visibilitychange', () => {
    if(document.visibilityState === 'visible' && currentTab === 'home') void load();
  });
  if(currentTab === 'home') void load();
})();
