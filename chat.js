// Sohbet geçmişi yalnızca açıldığında yüklenir; son 50 mesajdan başlanır.
const CHAT_PAGE_SIZE = 50;
const chatMessagesEl = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const chatSendBtn = document.getElementById('chatSendBtn');
const chatBadge = document.getElementById('chatBadge');
const chatInputRow = document.getElementById('chatInputRow');
const typingIndicator = document.getElementById('typingIndicator');
const loadOlderBtn = document.getElementById('loadOlderBtn');
const chatFeedback = document.getElementById('chatFeedback');
let messageCache = new Map();
let hasOlderMessages = false;
let oldestMessage = null;
let chatRefreshPromise = null;
let chatRefreshAgain = false;
let loadingOlder = false;
let sendingMessage = false;
const pendingMessages = new Map();
const loadedPendingSenders = new Set();
const MAX_PENDING_MESSAGES = 50;
let realtimeConnected = false;
let renderedMessageIds = new Set();
let typingHideTimeout = null;
let lastTypingSentAt = 0;

function isChatTabActive(){
  return currentTab === 'chat' && document.visibilityState === 'visible';
}

function formatChatTime(dateStr){
  return new Date(dateStr).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function orderedMessages(){
  return [...messageCache.values()].sort((a, b) =>
    a.created_at === b.created_at ? (String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0)
      : (a.created_at < b.created_at ? -1 : 1));
}

function renderMessages({ prepend = false, forceBottom = false } = {}){
  const messages = orderedMessages();
  const oldHeight = chatMessagesEl.scrollHeight;
  const oldTop = chatMessagesEl.scrollTop;
  const nearBottom = oldHeight - oldTop - chatMessagesEl.clientHeight < 80;
  chatMessagesEl.innerHTML = messages.length ? messages.map(m => {
    const mine = m.sender === myIdentity;
    const seen = mine ? (m.read_at ? ' · Görüldü ✓✓' : ' · Gönderildi ✓') : '';
    const animate = !prepend && !renderedMessageIds.has(m.id);
    return `<div class="chat-bubble ${mine ? 'mine' : 'theirs'}${animate ? ' bubble-new' : ''}">
      ${escapeHtml(m.content)}
      <span class="chat-time">${mine ? '' : escapeHtml(m.sender) + ' · '}${formatChatTime(m.created_at)}${seen}</span>
    </div>`;
  }).join('') : '<div class="memories-empty">Henüz mesaj yok, ilk mesajı sen yaz! 💗</div>';
  renderedMessageIds = new Set(messages.map(m => m.id));
  if(prepend) chatMessagesEl.scrollTop = oldTop + chatMessagesEl.scrollHeight - oldHeight;
  else if(forceBottom || nearBottom) chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
  else chatMessagesEl.scrollTop = oldTop;
  loadOlderBtn.hidden = !hasOlderMessages;
}

async function updateChatBadge(){
  if(!myIdentity){ chatBadge.style.display = 'none'; return; }
  const identity = myIdentity;
  try{
    const { count, error } = await supabaseClient.from('messages')
      .select('id', { count: 'exact', head: true }).neq('sender', identity).is('read_at', null);
    if(error) throw error;
    if(identity === myIdentity) chatBadge.style.display = count > 0 ? 'block' : 'none';
  }catch(error){ console.error('Okunmamış mesaj sayısı alınamadı.'); }
}

async function markMessagesAsRead(){
  if(!myIdentity || !isChatTabActive()) return;
  const unreadIds = orderedMessages().filter(m => m.sender !== myIdentity && !m.read_at).map(m => m.id);
  if(!unreadIds.length) return;
  const readAt = new Date().toISOString();
  try{
    const { error } = await supabaseClient.from('messages').update({ read_at: readAt })
      .in('id', unreadIds).neq('sender', myIdentity).is('read_at', null);
    if(error) throw error;
    unreadIds.forEach(id => {
      const message = messageCache.get(id);
      if(message) messageCache.set(id, { ...message, read_at: readAt });
    });
  }catch(error){ console.error('Mesajlar okundu olarak işaretlenemedi.'); }
}

function messageQuery(){
  return supabaseClient.from('messages').select('id,sender,content,created_at,read_at')
    .order('created_at', { ascending: false }).order('id', { ascending: false });
}

async function fetchMessages(){
  const { data, error } = await messageQuery().limit(CHAT_PAGE_SIZE);
  if(error) throw error;
  const rows = data || [];
  // Uzun bir kopmada arada boşluk oluştuysa geçmiş sayfalamasını yeniden başlat.
  if(messageCache.size && rows.length === CHAT_PAGE_SIZE && !rows.some(m => messageCache.has(m.id))){
    messageCache.clear();
    oldestMessage = null;
  }
  rows.forEach(m => messageCache.set(m.id, m));
  if(!oldestMessage){
    oldestMessage = rows.at(-1) || null;
    hasOlderMessages = rows.length === CHAT_PAGE_SIZE;
  }
  renderMessages();
}

async function refreshChat(){
  if(!isChatTabActive() || !navigator.onLine) return;
  if(loadingOlder) return;
  if(chatRefreshPromise){ chatRefreshAgain = true; return chatRefreshPromise; }
  chatRefreshPromise = (async () => {
    try{
      do {
        chatRefreshAgain = false;
        await fetchMessages();
        await markMessagesAsRead();
        await updateChatBadge();
        chatFeedback.textContent = '';
      } while(chatRefreshAgain && isChatTabActive() && navigator.onLine);
    }catch(error){
      chatFeedback.textContent = 'Mesajlar yenilenemedi. Bağlantı gelince tekrar denenecek.';
    }
  })();
  try{ await chatRefreshPromise; }finally{ chatRefreshPromise = null; }
}

async function loadOlderMessages(){
  if(loadingOlder || chatRefreshPromise || !oldestMessage || !hasOlderMessages) return;
  loadingOlder = true;
  loadOlderBtn.disabled = true;
  try{
    const cursor = oldestMessage;
    const { data, error } = await messageQuery()
      .or(`created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`)
      .limit(CHAT_PAGE_SIZE);
    if(error) throw error;
    const rows = data || [];
    rows.forEach(m => messageCache.set(m.id, m));
    if(rows.length) oldestMessage = rows.at(-1);
    hasOlderMessages = rows.length === CHAT_PAGE_SIZE;
    renderMessages({ prepend: true });
    await markMessagesAsRead();
    await updateChatBadge();
    chatFeedback.textContent = '';
  }catch(error){ chatFeedback.textContent = 'Eski mesajlar yüklenemedi. Tekrar deneyebilirsin.'; }
  finally{ loadingOlder = false; loadOlderBtn.disabled = false; }
}

function validPendingMessage(saved, sender){
  return saved?.sender === sender && typeof saved.content === 'string' && saved.content.length > 0 && saved.content.length <= 500 &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(saved.id);
}

function savePendingMessages(sender){
  const records = [...pendingMessages.values()].filter(message => message.sender === sender);
  try{
    if(records.length) localStorage.setItem('biz-pending-messages:' + sender, JSON.stringify(records));
    else localStorage.removeItem('biz-pending-messages:' + sender);
    localStorage.removeItem('biz-pending-message:' + sender);
  }catch(error){ /* Depolama kullanılamasa da bu oturumdaki kimlikler bellekte korunur. */ }
}

function readPendingMessages(sender){
  if(!loadedPendingSenders.has(sender)){
    loadedPendingSenders.add(sender);
    try{
      const records = JSON.parse(localStorage.getItem('biz-pending-messages:' + sender) || '[]');
      if(Array.isArray(records)) for(const saved of records){
        if(validPendingMessage(saved, sender)) pendingMessages.set(saved.id, saved);
      }
      // Önceki sürümün tek bekleyen kaydını kimliğini değiştirmeden taşı.
      const legacy = JSON.parse(localStorage.getItem('biz-pending-message:' + sender) || 'null');
      if(validPendingMessage(legacy, sender)){
        pendingMessages.set(legacy.id, legacy);
        savePendingMessages(sender);
      }
    }catch(error){}
  }
  return [...pendingMessages.values()].filter(message => message.sender === sender);
}

function readPendingMessage(sender, content){
  return readPendingMessages(sender).find(message => content === undefined || message.content === content) || null;
}

function createMessageId(){
  if(typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

function restorePendingDraft(){
  if(!myIdentity || chatInput.value) return;
  const saved = readPendingMessage(myIdentity);
  if(saved) chatInput.value = saved.content;
}

// Günün sorusu da aynı güvenilir gönderim yolunu kullanır.
async function sendChatContent(value){
  if(sendingMessage) return false;
  const content = String(value || '').trim();
  if(!content || content.length > 500) return false;
  if(!myIdentity){ identityModalOverlay.classList.add('open'); return false; }
  if(!navigator.onLine){ chatFeedback.textContent = 'Çevrimdışısın. Mesajın kutuda duruyor; bağlanınca gönderebilirsin.'; return false; }
  sendingMessage = true;
  chatSendBtn.disabled = true;
  const sender = myIdentity;
  try{
    const saved = readPendingMessage(sender, content);
    if(!saved && readPendingMessages(sender).length >= MAX_PENDING_MESSAGES){
      chatFeedback.textContent = 'Gönderimi doğrulanmamış çok fazla mesaj var. Önce bekleyen mesajlarından birini tekrar dene.';
      return false;
    }
    const outgoing = saved || { id: createMessageId(), sender, content };
    pendingMessages.set(outgoing.id, outgoing);
    // Ağ isteğinden önce sakla: sunucu kaydetse fakat yanıt kaybolsa da aynı kimlikle tekrar edilir.
    savePendingMessages(sender);
    const { error } = await supabaseClient.from('messages').insert([outgoing]);
    let reconciled = false;
    if(error){
      if(error.code !== '23505') throw error;
      const { data: existing, error: lookupError } = await supabaseClient.from('messages')
        .select('id,sender,content,created_at,read_at').eq('id', outgoing.id).maybeSingle();
      if(lookupError || !existing || existing.sender !== sender || existing.content !== content) throw error;
      messageCache.set(existing.id, existing);
      reconciled = true;
    }
    pendingMessages.delete(outgoing.id);
    savePendingMessages(sender);
    chatFeedback.textContent = '';
    // Yinelenen kayıt uzlaştırılırken yeniden bildirim gönderme.
    await refreshChat();
    if(!reconciled) void sendNotification(`💬 ${sender}`, content, sender, 'chat');
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
    return true;
  }catch(error){
    chatFeedback.textContent = 'Mesaj gönderilemedi veya yanıt alınamadı. Mesajın duruyor; tekrar deneyebilirsin.';
    return false;
  }
  finally{ sendingMessage = false; chatSendBtn.disabled = false; }
}

async function sendMessage(){
  const submittedValue = chatInput.value;
  const sent = await sendChatContent(submittedValue);
  if(sent && chatInput.value === submittedValue) chatInput.value = '';
  return sent;
}

function hideTypingIndicator(){
  clearTimeout(typingHideTimeout);
  typingIndicator.style.display = 'none';
}

function syncChatActivity(){
  if(chatPollInterval){ clearInterval(chatPollInterval); chatPollInterval = null; }
  if(!isChatTabActive() || !navigator.onLine){ hideTypingIndicator(); return; }
  void refreshChat();
  // Anlık bağlantı sağlıklıyken ek sorgu yok; kopunca 15 saniyelik yedek.
  if(!realtimeConnected) chatPollInterval = setInterval(() => void refreshChat(), 15000);
}

chatSendBtn.addEventListener('click', sendMessage);
chatInput.addEventListener('keydown', e => {
  if(e.key === 'Enter' && !e.isComposing){ e.preventDefault(); void sendMessage(); }
});
loadOlderBtn.addEventListener('click', loadOlderMessages);

const typingChannel = supabaseClient.channel('typing-status', { config: { broadcast: { self: false } } });
typingChannel.on('broadcast', { event: 'typing' }, ({ payload }) => {
  if(!isChatTabActive() || !['Furki', 'Hilalişko'].includes(payload?.sender) || payload.sender === myIdentity) return;
  typingIndicator.textContent = `${payload.sender} yazıyor...`;
  typingIndicator.style.display = 'block';
  clearTimeout(typingHideTimeout);
  typingHideTimeout = setTimeout(hideTypingIndicator, 3000);
}).subscribe();

chatInput.addEventListener('input', () => {
  if(!myIdentity || !navigator.onLine || !isChatTabActive()) return;
  if(Date.now() - lastTypingSentAt < 1500) return;
  lastTypingSentAt = Date.now();
  void typingChannel.send({ type: 'broadcast', event: 'typing', payload: { sender: myIdentity } });
});

supabaseClient.channel('messages-realtime')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, ({ new: message }) => {
    hideTypingIndicator();
    if(isChatTabActive()){
      if(message?.id && message.created_at){
        messageCache.set(message.id, message);
        renderMessages();
        void markMessagesAsRead().then(updateChatBadge);
      }else void refreshChat();
    }else void updateChatBadge();
  })
  .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, ({ new: message }) => {
    if(messageCache.has(message?.id)){
      messageCache.set(message.id, { ...messageCache.get(message.id), ...message });
      if(isChatTabActive()) renderMessages();
    }
    void updateChatBadge();
  })
  .subscribe(status => {
    realtimeConnected = status === 'SUBSCRIBED';
    syncChatActivity();
  });

window.addEventListener('online', () => { syncChatActivity(); void updateChatBadge(); });
window.addEventListener('offline', syncChatActivity);
document.addEventListener('visibilitychange', () => {
  syncChatActivity();
  if(document.visibilityState === 'visible') void updateChatBadge();
});

function restoreTab(){
  const validTabs = ['home', 'memories', 'bucket', 'special', 'chat', 'settings', 'prices'];
  let target = location.hash.slice(1);
  if(!validTabs.includes(target)){
    try{ target = localStorage.getItem('biz-last-tab'); }catch(error){}
  }
  switchTab(validTabs.includes(target) ? target : 'home');
}
window.addEventListener('hashchange', restoreTab);
void updateChatBadge();
restorePendingDraft();
restoreTab();
