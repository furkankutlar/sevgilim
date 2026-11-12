// ============================================================
// SAYAÇ
// ============================================================
const startDate = new Date(2026, 5, 20, 0, 0, 0); // 20 Haziran 2026, 00:00

function calcDiff(start, now){
  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();
  let days = now.getDate() - start.getDate();
  let hours = now.getHours() - start.getHours();
  let minutes = now.getMinutes() - start.getMinutes();
  let seconds = now.getSeconds() - start.getSeconds();

  if(seconds < 0){ seconds += 60; minutes--; }
  if(minutes < 0){ minutes += 60; hours--; }
  if(hours < 0){ hours += 24; days--; }
  if(days < 0){
    const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    days += prevMonth.getDate();
    months--;
  }
  if(months < 0){ months += 12; years--; }

  return {years, months, days, hours, minutes, seconds};
}

function update(){
  if(document.hidden) return;
  const now = new Date();
  const d = calcDiff(startDate, now);
  document.getElementById('years').textContent = d.years;
  document.getElementById('months').textContent = d.months;
  document.getElementById('days').textContent = d.days;
  document.getElementById('hours').textContent = d.hours;
  document.getElementById('minutes').textContent = d.minutes;
  document.getElementById('seconds').textContent = d.seconds;
}

update();
setInterval(update, 1000);
document.addEventListener('visibilitychange', () => { if(!document.hidden) update(); });

// ---------- Uçuşan kalp efekti ----------
const heartsContainer = document.getElementById('hearts');
const heartChars = ['💗','💕','♡'];
function spawnHeart(){
  if(heartsContainer.hidden || document.hidden || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const el = document.createElement('div');
  el.className = 'heart';
  el.textContent = heartChars[Math.floor(Math.random()*heartChars.length)];
  el.style.left = Math.random()*100 + 'vw';
  el.style.fontSize = (12 + Math.random()*14) + 'px';
  const duration = 10 + Math.random()*8;
  el.style.animationDuration = duration + 's';
  heartsContainer.appendChild(el);
  setTimeout(()=> el.remove(), duration*1000);
}
setInterval(spawnHeart, 1400);
for(let i=0;i<5;i++) setTimeout(spawnHeart, i*400);

// ============================================================
// KUTLAMA QUIZİ
// ============================================================
const celebrationQuiz = document.getElementById('celebrationQuiz');
const celebrationResult = document.getElementById('celebrationResult');

if(celebrationQuiz && celebrationResult){
  const quizQuestions = Array.from(celebrationQuiz.querySelectorAll('.quiz-question'));
  const quizMessages = {
    sarilma: 'Birtanemmmm şimdi kollarımda olamasan da gelince ilk iş senin kollarında 🤍',
    mesaj: 'Gece güzel bir mesaj seni bekliyorrr sevgilimmmmm',
    gece: 'Gece sohbetleri zaten bizim gizli favorimiz; bu ay daha uzunları olsun 🌙',
    date: 'Date planları en sevdiğim şeylerden; bir mini kaçamak çok yakışır 💞',
    huzur: 'Bu ay dileğim de aynı: içinin hep huzur dolması ve hafif kalman 🍀',
    ask: 'Biraz daha aşk, biraz daha yakınlık, biraz daha biz — en güzel kombinasyon bu 💘'
  };
  const originalResultHTML = celebrationResult.innerHTML;
  const quizHeartLayer = document.createElement('div');
  quizHeartLayer.className = 'heart-burst-layer';
  document.body.appendChild(quizHeartLayer);

  function spawnBurstHearts(){
    quizHeartLayer.innerHTML = '';
    const hearts = ['🤍','💗','💕','💖'];
    const count = 18;
    for(let i = 0; i < count; i++){
      const heart = document.createElement('div');
      heart.className = 'heart-burst';
      heart.textContent = hearts[i % hearts.length];
      const angle = (Math.PI * 2 * i) / count;
      const distance = 180 + Math.random() * 140;
      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance;
      heart.style.setProperty('--dx', dx + 'px');
      heart.style.setProperty('--dy', dy + 'px');
      heart.style.animationDelay = (i * 20) + 'ms';
      quizHeartLayer.appendChild(heart);
      setTimeout(() => heart.remove(), 900);
    }
    setTimeout(() => { quizHeartLayer.innerHTML = ''; }, 950);
  }

  function openBubble(text, nextLabel){
    celebrationResult.innerHTML = '<div class="quiz-result-title">Cevabın</div><div class="quiz-result-text"><span class="quiz-result-copy"></span></div><button class="quiz-next-btn" type="button" id="quizNextBtn">Bir sonraki soru diyee</button>';
    celebrationResult.querySelector('.quiz-result-copy').textContent = text;
    celebrationResult.classList.add('open');
    const liveNextBtn = celebrationResult.querySelector('#quizNextBtn');
    if(liveNextBtn){
      liveNextBtn.textContent = nextLabel || 'Bir sonraki soru diyee';
    }
    spawnBurstHearts();
  }

  function goToStep(step){
    quizQuestions.forEach(q => q.classList.remove('active'));
    const nextQuestion = quizQuestions.find(q => Number(q.dataset.step) === step);
    if(nextQuestion){
      nextQuestion.classList.add('active');
      celebrationResult.classList.remove('open');
      celebrationResult.innerHTML = originalResultHTML;
      const restoredBtn = celebrationResult.querySelector('#quizNextBtn');
      if(restoredBtn){
        restoredBtn.textContent = 'Bir sonraki soru diyee';
      }
    }
  }

  celebrationQuiz.addEventListener('click', (e) => {
    const btn = e.target.closest('.quiz-option');
    if(!btn) return;
    const reply = btn.dataset.reply;
    celebrationQuiz.querySelectorAll('.quiz-option').forEach(option => option.classList.toggle('selected', option === btn));
    if(reply === 'sarilma'){
      openBubble('Birtanemmmm şimdi kollarımda olamasan da gelince ilk iş senin kollarında 🤍', 'Bir sonraki soru diyee');
    }else if(reply === 'mesaj'){
      openBubble('Gece güzel bir mesaj seni bekliyorrr sevgilimmmmm', 'Bir sonraki soru diyee');
    }else if(reply === 'gece' || reply === 'date'){
      openBubble(quizMessages[reply], 'Bir sonraki soru diyee');
    }else if(reply === 'huzur' || reply === 'ask'){
      openBubble(quizMessages[reply], 'Bitti 💗');
    }
  });

  celebrationResult.addEventListener('click', (e) => {
    const btn = e.target.closest('#quizNextBtn');
    if(!btn) return;
    const activeQuestion = quizQuestions.find(q => q.classList.contains('active'));
    const currentStep = activeQuestion ? Number(activeQuestion.dataset.step) : 0;
    goToStep(currentStep + 1);
  });

}

// ============================================================
// SUPABASE ENTEGRASYONU
// ============================================================
const SUPABASE_URL = "https://gxsagwouvimjlzbovyay.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4c2Fnd291dmltamx6Ym92eWF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyNDk1MDUsImV4cCI6MjA5ODgyNTUwNX0.8GViEPzagEaKg8vAAfOh429JnqQ6OcJvmb1E7XFX93E";


async function fetchWithTimeout(input, options = {}){
  const controller = new AbortController();
  const abort = () => controller.abort();
  if(options.signal?.aborted) controller.abort();
  else options.signal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, 30000);
  try{ return await fetch(input, { ...options, signal: controller.signal }); }
  finally{ clearTimeout(timeout); options.signal?.removeEventListener('abort', abort); }
}
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: { fetch: fetchWithTimeout }
});
const connectionStatus = document.getElementById('connectionStatus');
function updateConnectionStatus(){
  connectionStatus.hidden = navigator.onLine;
  connectionStatus.textContent = navigator.onLine ? '' : 'Çevrimdışısın. Bağlantı gelince tekrar deneyeceğiz.';
}
window.addEventListener('online', updateConnectionStatus);
window.addEventListener('offline', updateConnectionStatus);
updateConnectionStatus();
if('serviceWorker' in navigator){
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then(() => navigator.serviceWorker.ready)
      .then(() => updateSubscriptionIdentity())
      .catch(() => console.warn('Çevrimdışı kullanım hazırlanamadı.'));
  });
}

const memoriesGrid = document.getElementById('memoriesGrid');
const bucketListContainer = document.getElementById('bucketListContainer');

function escapeHtml(str){
  return String(str ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}

function formatDate(dateStr){
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString('tr-TR', { day:'numeric', month:'long', year:'numeric' });
}

function timeAgo(dateStr){
  const date = new Date(dateStr + "T00:00:00");
  const now = new Date();
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  if(diffDays < 0) return "yakında";
  if(diffDays === 0) return "bugün";
  if(diffDays === 1) return "dün";
  if(diffDays < 30) return `${diffDays} gün önce`;
  const diffMonths = Math.floor(diffDays / 30);
  if(diffMonths < 12) return `${diffMonths} ay önce`;
  const diffYears = Math.floor(diffMonths / 12);
  return `${diffYears} yıl önce`;
}

// ============================================================
// ANILAR — LİSTELEME
// ============================================================
let currentMemories = [];
const MEMORY_PAGE_SIZE = 20;
const loadMoreMemoriesBtn = document.getElementById('loadMoreMemoriesBtn');
const memoriesFeedback = document.getElementById('memoriesFeedback');
let memoryLoadPromise = null;
let memoryRefreshQueued = false;
let hasMoreMemories = false;
let memoriesFetchedAt = 0;

function updateMemoryPagination({ failed = false } = {}){
  if(!loadMoreMemoriesBtn) return;
  loadMoreMemoriesBtn.hidden = !hasMoreMemories && !(failed && currentMemories.length === 0);
  loadMoreMemoriesBtn.disabled = !!memoryLoadPromise;
  loadMoreMemoriesBtn.textContent = failed && currentMemories.length === 0 ? 'Tekrar dene' : 'Daha fazla anı yükle';
}

function renderMemories(memories){
  if(!memories || memories.length === 0){
    memoriesGrid.innerHTML = '<div class="memories-empty">Henüz anı eklenmedi. İlk anıyı sen ekle! 💗</div>';
    return;
  }
  memoriesGrid.innerHTML = memories.map(m => `
    <div class="memory-card" data-id="${m.id}">
      ${m.image_url ? `<img src="${escapeHtml(m.image_url)}" alt="" loading="lazy" decoding="async" onerror="this.remove()">` : ''}
      <div class="memory-date">${formatDate(m.memory_date)} <span class="memory-ago">· ${timeAgo(m.memory_date)}</span></div>
      <div class="memory-title">${escapeHtml(m.title)}</div>
      <div class="memory-actions">
        <button class="icon-btn" data-action="edit" data-id="${m.id}" aria-label="Düzenle">✏️</button>
        <button class="icon-btn" data-action="delete" data-id="${m.id}" aria-label="Sil">🗑️</button>
      </div>
    </div>
  `).join('');
}

async function fetchMemories({ append = false, force = false } = {}){
  if(memoryLoadPromise){
    if(!append && force) memoryRefreshQueued = true;
    return memoryLoadPromise;
  }
  if(append && (!hasMoreMemories || !currentMemories.length)) return;
  if(!append && !force && currentMemories.length && Date.now() - memoriesFetchedAt < 30000){
    renderMemories(currentMemories);
    return;
  }
  let failed = false;
  memoryLoadPromise = (async () => {
    let nextPage = append;
    do{
      memoryRefreshQueued = false;
      failed = false;
      try{
        // Yenilemede daha önce açılmış sayfaların derinliğini koru.
        const limit = nextPage ? MEMORY_PAGE_SIZE : Math.max(MEMORY_PAGE_SIZE, currentMemories.length);
        let query = supabaseClient.from('memories')
          .select('id,title,memory_date,description,image_url,original_image_url')
          .order('memory_date', { ascending: false }).order('id', { ascending: false });
        if(nextPage){
          const cursor = currentMemories.at(-1);
          query = query.or(`memory_date.lt.${cursor.memory_date},and(memory_date.eq.${cursor.memory_date},id.lt.${cursor.id})`);
        }
        const { data, error } = await query.limit(limit);
        if(error) throw error;
        const rows = data || [];
        const merged = nextPage ? [...currentMemories, ...rows] : rows;
        currentMemories = [...new Map(merged.map(memory => [memory.id, memory])).values()]
          .sort((a, b) => a.memory_date === b.memory_date
            ? String(b.id).localeCompare(String(a.id)) : b.memory_date.localeCompare(a.memory_date));
        hasMoreMemories = rows.length === limit;
        memoriesFetchedAt = Date.now();
        if(memoriesFeedback) memoriesFeedback.textContent = '';
        renderMemories(currentMemories);
      }catch(error){
        failed = true;
        const message = currentMemories.length ? 'Yeni anılar yüklenemedi. Mevcut anıların burada; tekrar deneyebilirsin.' : 'Anılar yüklenemedi. Bağlantını kontrol edip tekrar deneyebilirsin.';
        if(memoriesFeedback) memoriesFeedback.textContent = message;
        if(!currentMemories.length) memoriesGrid.innerHTML = '<div class="memories-error">Anılar yüklenemedi.</div>';
      }
      nextPage = false;
    }while(memoryRefreshQueued);
  })();
  updateMemoryPagination();
  try{ await memoryLoadPromise; }
  finally{ memoryLoadPromise = null; updateMemoryPagination({ failed }); }
}

if(loadMoreMemoriesBtn) loadMoreMemoriesBtn.addEventListener('click', () =>
  void fetchMemories(currentMemories.length ? { append: true } : { force: true }));

async function addMemory(memory){
  const { error } = await supabaseClient.from('memories').insert([memory]);
  return { error };
}

async function updateMemory(id, memory){
  const { error } = await supabaseClient.from('memories').update(memory).eq('id', id);
  return { error };
}

async function deleteMemory(id){
  if(!confirm('Bu anıyı silmek istediğine emin misin?')) return;
  const { error } = await supabaseClient.from('memories').delete().eq('id', id);
  if(error){
    alert('Silinirken bir hata oluştu.');
    console.error(error);
    return;
  }
  fetchMemories({ force: true });
}

// ============================================================
// ANILAR — FOTOĞRAF KIRPMA + YÜKLEME
// ============================================================
const STORAGE_BUCKET = "memory-photos";

function getCroppedBlob(quality = 0.85, maxWidth = 1200){
  return new Promise((resolve, reject) => {
    if(!cropper){ resolve(null); return; }
    const canvas = cropper.getCroppedCanvas({ maxWidth, imageSmoothingQuality: 'high' });
    canvas.toBlob((blob) => {
      if(blob) resolve(blob); else reject(new Error('Görsel işlenemedi'));
    }, 'image/jpeg', quality);
  });
}

function getResizedOriginalBlob(file, maxWidth = 1920, quality = 0.85){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if(width > maxWidth){
          height = Math.round(height * (maxWidth / width));
          width = maxWidth;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if(blob) resolve(blob); else reject(new Error('Görsel işlenemedi'));
        }, 'image/jpeg', quality);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function uploadImage(blob){
  try{
    const fileName = `${crypto.randomUUID()}.jpg`;
    const { error: uploadError } = await supabaseClient
      .storage
      .from(STORAGE_BUCKET)
      .upload(fileName, blob, { contentType: 'image/jpeg' });

    if(uploadError) return { error: uploadError };

    const { data } = supabaseClient.storage.from(STORAGE_BUCKET).getPublicUrl(fileName);
    return { url: data.publicUrl };
  }catch(err){
    return { error: err };
  }
}

// ============================================================
// ANILAR — MODAL KONTROLLERİ
// ============================================================
const modalOverlay = document.getElementById('modalOverlay');
const openModalBtn = document.getElementById('openModalBtn');
const cancelBtn = document.getElementById('cancelBtn');
const saveBtn = document.getElementById('saveBtn');
const memImgFile = document.getElementById('memImgFile');
const currentImagePreview = document.getElementById('currentImagePreview');
const cropWrap = document.getElementById('cropWrap');
const cropImage = document.getElementById('cropImage');

let editingId = null;
let existingImageUrl = null;
let existingOriginalImageUrl = null;
let cropper = null;
let cropperReadyPromise = null;

function destroyCropper(){
  if(cropper){
    cropper.destroy();
    cropper = null;
  }
  cropperReadyPromise = null;
  cropWrap.style.display = 'none';
}

openModalBtn.addEventListener('click', () => {
  editingId = null;
  existingImageUrl = null;
  existingOriginalImageUrl = null;
  document.getElementById('modalTitle').textContent = 'Yeni bir anı ekle 💗';
  saveBtn.textContent = 'Kaydet';
  currentImagePreview.style.display = 'none';
  modalOverlay.classList.add('open');
});
cancelBtn.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => {
  if(e.target === modalOverlay) closeModal();
});

memoriesGrid.addEventListener('click', (e) => {
  const btn = e.target.closest('.icon-btn');
  if(btn){
    e.stopPropagation();
    const id = btn.dataset.id;
    if(btn.dataset.action === 'edit') openEditModal(id);
    if(btn.dataset.action === 'delete') deleteMemory(id);
    return;
  }
  const card = e.target.closest('.memory-card');
  if(card) openDetailModal(card.dataset.id);
});

function openEditModal(id){
  const m = currentMemories.find(x => String(x.id) === String(id));
  if(!m) return;

  editingId = id;
  existingImageUrl = m.image_url || null;
  existingOriginalImageUrl = m.original_image_url || null;

  document.getElementById('modalTitle').textContent = 'Anıyı düzenle 💗';
  saveBtn.textContent = 'Güncelle';
  document.getElementById('memTitle').value = m.title;
  document.getElementById('memDate').value = m.memory_date;
  document.getElementById('memDesc').value = m.description || '';
  memImgFile.value = '';
  destroyCropper();

  if(m.image_url){
    currentImagePreview.src = m.image_url;
    currentImagePreview.style.display = 'block';
  }else{
    currentImagePreview.style.display = 'none';
  }

  modalOverlay.classList.add('open');
}

memImgFile.addEventListener('change', () => {
  const file = memImgFile.files[0];
  destroyCropper();
  if(!file) return;

  currentImagePreview.style.display = 'none';

  let resolveReady;
  cropperReadyPromise = new Promise((resolve) => { resolveReady = resolve; });

  const reader = new FileReader();
  reader.onload = (e) => {
    cropWrap.style.display = 'block';
    cropImage.onload = () => {
      cropper = new Cropper(cropImage, {
        aspectRatio: 4 / 3,
        viewMode: 1,
        autoCropArea: 1,
        background: false,
        ready(){
          resolveReady();
        }
      });
    };
    cropImage.src = e.target.result;
  };
  reader.onerror = () => {
    alert('Fotoğraf okunamadı, tekrar dener misin?');
    resolveReady();
  };
  reader.readAsDataURL(file);
});

function closeModal(){
  modalOverlay.classList.remove('open');
  document.getElementById('memTitle').value = '';
  document.getElementById('memDate').value = '';
  document.getElementById('memDesc').value = '';
  memImgFile.value = '';
  currentImagePreview.style.display = 'none';
  currentImagePreview.src = '';
  destroyCropper();
  editingId = null;
  existingImageUrl = null;
  existingOriginalImageUrl = null;
}

saveBtn.addEventListener('click', async () => {
  const title = document.getElementById('memTitle').value.trim();
  const date = document.getElementById('memDate').value;
  const description = document.getElementById('memDesc').value.trim();
  const file = memImgFile.files[0];

  if(!title || !date){
    alert('Lütfen başlık ve tarih gir.');
    return;
  }

  saveBtn.disabled = true;
  let image_url = existingImageUrl;
  let original_image_url = existingOriginalImageUrl;

  if(file){
    saveBtn.textContent = 'Fotoğraf hazırlanıyor...';
    if(cropperReadyPromise){
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000));
      try{
        await Promise.race([cropperReadyPromise, timeout]);
      }catch(err){
        alert('Fotoğraf hazırlanamadı. İnternet bağlantını kontrol edip tekrar dener misin?');
        saveBtn.disabled = false;
        saveBtn.textContent = editingId ? 'Güncelle' : 'Kaydet';
        return;
      }
    }

    if(!cropper){
      alert('Fotoğraf işlenemedi, lütfen tekrar dener misin?');
      saveBtn.disabled = false;
      saveBtn.textContent = editingId ? 'Güncelle' : 'Kaydet';
      return;
    }

    saveBtn.textContent = 'Fotoğraf yükleniyor...';
    try{
      const [croppedBlob, originalBlob] = await Promise.all([
        getCroppedBlob(),
        getResizedOriginalBlob(file)
      ]);

      const [croppedRes, originalRes] = await Promise.all([
        uploadImage(croppedBlob),
        uploadImage(originalBlob)
      ]);

      if(croppedRes.error || originalRes.error){
        alert('Fotoğraf yüklenirken bir hata oluştu, tekrar dener misin?');
        console.error(croppedRes.error || originalRes.error);
        saveBtn.disabled = false;
        saveBtn.textContent = editingId ? 'Güncelle' : 'Kaydet';
        return;
      }

      image_url = croppedRes.url;
      original_image_url = originalRes.url;
    }catch(err){
      alert('Fotoğraf işlenirken bir hata oluştu, tekrar dener misin?');
      console.error(err);
      saveBtn.disabled = false;
      saveBtn.textContent = editingId ? 'Güncelle' : 'Kaydet';
      return;
    }
  }

  saveBtn.textContent = editingId ? 'Güncelleniyor...' : 'Kaydediliyor...';

  const payload = {
    title,
    memory_date: date,
    description: description || null,
    image_url,
    original_image_url
  };

  const { error } = editingId
    ? await updateMemory(editingId, payload)
    : await addMemory(payload);

  saveBtn.disabled = false;
  saveBtn.textContent = editingId ? 'Güncelle' : 'Kaydet';

  if(error){
    alert('Bir hata oluştu, tekrar dener misin?');
    console.error(error);
    return;
  }

  if(!editingId){
    sendNotification('Yeni bir anı eklendi 💗', title);
  }

  closeModal();
  fetchMemories({ force: true });
});

// ============================================================
// ANILAR — DETAY MODALI
// ============================================================
const detailModalOverlay = document.getElementById('detailModalOverlay');
const detailCloseBtn = document.getElementById('detailCloseBtn');

function openDetailModal(id){
  const m = currentMemories.find(x => String(x.id) === String(id));
  if(!m) return;

  const detailImage = document.getElementById('detailImage');
  const fullImageUrl = m.original_image_url || m.image_url;
  if(fullImageUrl){
    detailImage.src = fullImageUrl;
    detailImage.style.display = 'block';
  }else{
    detailImage.style.display = 'none';
  }

  document.getElementById('detailTitle').textContent = m.title;
  document.getElementById('detailDate').textContent = `${formatDate(m.memory_date)} · ${timeAgo(m.memory_date)}`;

  const detailDesc = document.getElementById('detailDesc');
  detailDesc.textContent = m.description || '';
  detailDesc.style.display = m.description ? 'block' : 'none';

  detailModalOverlay.classList.add('open');
}

function closeDetailModal(){
  detailModalOverlay.classList.remove('open');
}

detailCloseBtn.addEventListener('click', closeDetailModal);
detailModalOverlay.addEventListener('click', (e) => {
  if(e.target === detailModalOverlay) closeDetailModal();
});

// ============================================================
// YAPILACAKLAR LİSTESİ (BUCKET LIST)
// ============================================================
async function fetchBucketList() {
  const { data, error } = await supabaseClient
    .from('bucket_list')
    .select('*')
    .order('created_at', { ascending: true });

  if(error) {
    console.error('Bucket hatası:', error);
    bucketListContainer.innerHTML = '<div class="bucket-empty">Yüklenirken hata oluştu.</div>';
    return;
  }

  if(!data || data.length === 0) {
    bucketListContainer.innerHTML = '<div class="bucket-empty">Henüz bir hayal eklenmedi, birlikte ilk hayalinizi yazın! ✨</div>';
    return;
  }

  bucketListContainer.innerHTML = data.map(item => `
    <div class="bucket-item ${item.is_completed ? 'completed' : ''}" data-id="${item.id}">
      <div class="bucket-left">
        <div class="bucket-checkbox"></div>
        <div class="bucket-text">${escapeHtml(item.title)}</div>
      </div>
      <button class="icon-btn" style="width:28px; height:28px; font-size:12px;" data-action="delete-bucket" data-id="${item.id}">🗑️</button>
    </div>
  `).join('');
}

// Not: id alanı Supabase'de uuid (metin) olduğu için parseInt KULLANILMIYOR.
// Tıklama olayları tek bir dinleyici (event delegation) ile yönetiliyor,
// böylece liste her yenilendiğinde tekrar tekrar dinleyici eklenmiyor.
bucketListContainer.addEventListener('click', (e) => {
  const delBtn = e.target.closest('[data-action="delete-bucket"]');
  if(delBtn){
    deleteBucket(delBtn.dataset.id);
    return;
  }
  const left = e.target.closest('.bucket-left');
  if(left){
    const item = left.closest('.bucket-item');
    const id = item.dataset.id;
    const isCompleted = item.classList.contains('completed');
    toggleBucket(id, isCompleted);
  }
});

async function toggleBucket(id, currentStatus) {
  const { error } = await supabaseClient
    .from('bucket_list')
    .update({ is_completed: !currentStatus })
    .eq('id', id);

  if(error){
    console.error('Toggle hatası:', error);
    return;
  }
  fetchBucketList();
}

async function deleteBucket(id) {
  const { error } = await supabaseClient
    .from('bucket_list')
    .delete()
    .eq('id', id);

  if(error){
    console.error('Delete hatası:', error);
    return;
  }
  fetchBucketList();
}

async function addBucket() {
  const input = document.getElementById('bucketInput');
  const title = input.value.trim();
  if (!title) return;

  const { error } = await supabaseClient
    .from('bucket_list')
    .insert([{ title, is_completed: false }]);

  if(error) {
    console.error('Insert hatası:', error);
    alert('Eklenirken bir hata oluştu, tekrar dener misin?');
    return;
  }

  input.value = '';
  sendNotification('Yeni bir hayal eklendi ✨', title);
  fetchBucketList();
}

const bucketAddBtn = document.getElementById('bucketAddBtn');
const bucketInput = document.getElementById('bucketInput');

bucketAddBtn.addEventListener('click', addBucket);
bucketInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') addBucket();
});

// ============================================================
// ÖZEL GÜN SAYACI (her yıl kendini yenileyen geri sayımlar)
// ============================================================
const specialDaysGrid = document.getElementById('specialDaysGrid');
const specialTitleInput = document.getElementById('specialTitleInput');
const specialDateInput = document.getElementById('specialDateInput');
const specialAddBtn = document.getElementById('specialAddBtn');

function getNextOccurrence(dateStr){
  const original = new Date(dateStr + "T00:00:00");
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(now.getFullYear(), original.getMonth(), original.getDate());
  if(next < todayStart){
    next = new Date(now.getFullYear() + 1, original.getMonth(), original.getDate());
  }
  return next;
}

function daysUntil(dateStr){
  const next = getNextOccurrence(dateStr);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  return Math.round((next - todayStart) / (1000 * 60 * 60 * 24));
}

function formatShortDate(d){
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
}

async function fetchSpecialDays(){
  const { data, error } = await supabaseClient.from('special_days').select('*');

  if(error){
    console.error('Özel günler hatası:', error);
    specialDaysGrid.innerHTML = '<div class="memories-error">Yüklenirken bir hata oluştu.</div>';
    return;
  }

  if(!data || data.length === 0){
    specialDaysGrid.innerHTML = '<div class="memories-empty">Henüz özel gün eklenmedi. İlkini sen ekle! 💗</div>';
    return;
  }

  const withDays = data
    .map(item => ({ ...item, _daysLeft: daysUntil(item.event_date), _next: getNextOccurrence(item.event_date) }))
    .sort((a, b) => a._daysLeft - b._daysLeft);

  specialDaysGrid.innerHTML = withDays.map(item => `
    <div class="special-card" data-id="${item.id}">
      <button class="special-delete" data-action="delete-special" data-id="${item.id}" aria-label="Sil">🗑️</button>
      ${item._daysLeft === 0
        ? `<div class="special-days-num">🎉</div><div class="special-days-label">Bugün!</div>`
        : `<div class="special-days-num">${item._daysLeft}</div><div class="special-days-label">gün kaldı</div>`}
      <div class="special-title">${escapeHtml(item.title)}</div>
      <div class="special-date">${formatShortDate(item._next)}</div>
    </div>
  `).join('');
}

specialDaysGrid.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action="delete-special"]');
  if(!btn) return;
  deleteSpecialDay(btn.dataset.id);
});

async function deleteSpecialDay(id){
  if(!confirm('Bu özel günü silmek istediğine emin misin?')) return;
  const { error } = await supabaseClient.from('special_days').delete().eq('id', id);
  if(error){
    console.error(error);
    alert('Silinirken bir hata oluştu.');
    return;
  }
  fetchSpecialDays();
}

async function addSpecialDay(){
  const title = specialTitleInput.value.trim();
  const date = specialDateInput.value;

  if(!title || !date){
    alert('Lütfen başlık ve tarih gir.');
    return;
  }

  const { error } = await supabaseClient.from('special_days').insert([{ title, event_date: date }]);
  if(error){
    console.error(error);
    alert('Eklenirken bir hata oluştu.');
    return;
  }

  specialTitleInput.value = '';
  specialDateInput.value = '';
  fetchSpecialDays();
}

specialAddBtn.addEventListener('click', addSpecialDay);
specialTitleInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') addSpecialDay(); });
specialDateInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') addSpecialDay(); });

// ============================================================
// PUSH BİLDİRİMLERİ
// ============================================================
const VAPID_PUBLIC_KEY = "BAzUSKJcL3DXVdvkE2E5UOJFGq2ZgHUPh5clcAWchBAomuiqe8pZqOPKLi345KQTLcttXE-jtLAqIS6yy6nVsQ4";

function urlBase64ToUint8Array(base64String){
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for(let i = 0; i < rawData.length; i++){
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function enableNotifications(){
  if(!myIdentity){ identityModalOverlay.classList.add('open'); return; }
  if(!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)){
    alert('Bu tarayıcı bildirimleri desteklemiyor. iPhone kullanıyorsan siteyi Safari üzerinden "Ana Ekrana Ekle" yaptığından ve ana ekrandaki simgeden açtığından emin ol.');
    return;
  }

  try{
    const permission = await Notification.requestPermission();
    if(permission !== 'granted'){
      alert('Bildirim izni verilmedi.');
      return;
    }

    await navigator.serviceWorker.register('sw.js');
    const registration = await navigator.serviceWorker.ready;

    let subscription = await registration.pushManager.getSubscription();
    if(!subscription){
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
    }

    const subJson = subscription.toJSON();
    const { error } = await supabaseClient
      .from('push_subscriptions')
      .upsert({
        endpoint: subJson.endpoint,
        p256dh: subJson.keys.p256dh,
        auth: subJson.keys.auth,
        owner_name: myIdentity || null
      }, { onConflict: 'endpoint' });

    if(error){
      console.error(error);
      alert('Kaydedilirken bir hata oluştu.');
      return;
    }

    alert('Bildirimler bu cihazda açıldı! 💗');
  }catch(err){
    console.error(err);
    alert('Bildirimler açılırken bir hata oluştu. Sayfayı ana ekrana eklediğinden emin ol.');
  }
}

async function sendNotification(title, body, excludeOwner, type){
  try{
    const response = await fetchWithTimeout('/api/send-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body, excludeOwner: excludeOwner || myIdentity || null, type: type || null })
    });
    if(!response.ok) throw new Error('Bildirim iletilemedi: ' + response.status);
    const result = await response.json();
    if(result.recipientRegistered === false){
      chatFeedback.textContent = 'Mesaj kaydedildi. Karşı tarafın bildirim kaydı doğru kişiyle eşleşmiyor; Ayarlar’dan kimliğini seçip bildirimleri açmalı.';
      return;
    }
    if(result.total > 0 && result.sent === 0) throw new Error('Bildirim iletilemedi.');
  }catch(err){
    console.error('Bildirim gönderme hatası:', err);
    chatFeedback.textContent = 'Mesaj kaydedildi, ancak bildirim iletilemedi. Karşı tarafın bildirim ayarlarını kontrol edin.';
  }
}

const enableNotifBtn = document.getElementById('enableNotifBtn');
enableNotifBtn.addEventListener('click', enableNotifications);

// ============================================================
// SAYFA YÜKLENİNCE
// ============================================================
// Listeler ilgili sekme açıldığında yüklenir.

// ============================================================
// SEKME ÇUBUĞU (ALT NAVİGASYON)
// ============================================================
const tabButtons = document.querySelectorAll('.tab-btn');
const tabPages = document.querySelectorAll('.tab-page');
let chatPollInterval = null;
let currentTab = 'home';

function switchTab(tabName){
  currentTab = tabName;
  tabPages.forEach(page => {
    const isTarget = page.dataset.page === tabName;
    // Yeniden animasyonun her seferinde oynaması için önce sınıfı kaldırıp
    // bir sonraki karede tekrar ekliyoruz (aksi halde tarayıcı "zaten aktifti" sanıp atlar)
    page.classList.remove('active');
    if(isTarget){
      requestAnimationFrame(() => page.classList.add('active'));
    }
  });

  tabButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName || (tabName === 'prices' && btn.dataset.tab === 'home'));
  });

  // "+" anı ekleme butonu sadece Anılar sekmesinde görünsün
  openModalBtn.style.display = (tabName === 'memories') ? 'flex' : 'none';
  chatInputRow.style.display = (tabName === 'chat') ? 'flex' : 'none';

  // Son açık kalınan sekmeyi hatırla (sayfa yenilenince oraya dönsün)
  try{ localStorage.setItem('biz-last-tab', tabName); }catch(e){}

  // URL'nin sonuna hangi sekmede olduğumuzu yazıyoruz; bildirim geldiğinde
  // servis çalışanı (service worker) "kullanıcı zaten sohbeti mi görüyor?" diye
  // buradan anlayıp, öyleyse bildirimi hiç göstermiyor.
  try{ history.replaceState(null, '', tabName === 'home' ? (location.pathname + location.search) : ('#' + tabName)); }catch(e){}

  syncChatActivity();
  if(tabName === 'memories') void fetchMemories();
  if(tabName === 'bucket') void fetchBucketList();
  if(tabName === 'special') void fetchSpecialDays();

  window.scrollTo({ top: 0, behavior: 'instant' });
  if(typeof CustomEvent === 'function') window.dispatchEvent(new CustomEvent('biz:tabchange', { detail: { tab: tabName } }));
}

tabButtons.forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// ============================================================
// TEMA (AÇIK / KARANLIK MOD)
// ============================================================
const themeToggleBtn = document.getElementById('themeToggleBtn');

function applyTheme(theme){
  if(theme === 'dark'){
    document.documentElement.setAttribute('data-theme', 'dark');
    themeToggleBtn.textContent = '☀️ Aydınlık Moda Geç';
  }else{
    document.documentElement.removeAttribute('data-theme');
    themeToggleBtn.textContent = '🌙 Karanlık Moda Geç';
  }
  try{ localStorage.setItem('biz-theme', theme); }catch(e){}
}

applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');

themeToggleBtn.addEventListener('click', () => {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  applyTheme(isDark ? 'light' : 'dark');
});

// ============================================================
// KİMLİK (Furki / Hilalişko)
// ============================================================
const identityModalOverlay = document.getElementById('identityModalOverlay');
const chatIdentityLabel = document.getElementById('chatIdentityLabel');
const changeIdentityBtn = document.getElementById('changeIdentityBtn');

let myIdentity = null;
try{ myIdentity = localStorage.getItem('biz-identity'); }catch(e){}
if(!['Furki', 'Hilalişko'].includes(myIdentity)) myIdentity = null;

async function updateSubscriptionIdentity(){
  if(!myIdentity) return;
  try{
    if(!('serviceWorker' in navigator)) return;
    const registration = await navigator.serviceWorker.getRegistration();
    if(!registration) return;
    const subscription = await registration.pushManager.getSubscription();
    if(!subscription) return;
    const subJson = subscription.toJSON();
    const { error } = await supabaseClient
      .from('push_subscriptions')
      .upsert({ endpoint: subJson.endpoint, p256dh: subJson.keys.p256dh,
        auth: subJson.keys.auth, owner_name: myIdentity }, { onConflict: 'endpoint' });
    if(error) throw error;
  }catch(e){
    console.error('Kimlik güncelleme hatası:', e);
  }
}

// Önceden seçilmiş isimde de eşleştir; kimlik seçimine tekrar basmak gerekmesin.
window.addEventListener('online', () => void updateSubscriptionIdentity());
document.addEventListener('visibilitychange', () => {
  if(document.visibilityState === 'visible') void updateSubscriptionIdentity();
});

function setIdentity(name){
  if(!['Furki', 'Hilalişko'].includes(name)) return;
  myIdentity = name;
  try{ localStorage.setItem('biz-identity', name); }catch(e){}
  chatIdentityLabel.textContent = `Sen: ${name}`;
  identityModalOverlay.classList.remove('open');
  restorePendingDraft();
  renderMessages();
  syncChatActivity();
  updateSubscriptionIdentity();
  updateChatBadge();
  if(typeof CustomEvent === 'function') window.dispatchEvent(new CustomEvent('biz:identitychange', { detail: { identity: name } }));
}

document.querySelectorAll('.identity-btn').forEach(btn => {
  btn.addEventListener('click', () => setIdentity(btn.dataset.name));
});

changeIdentityBtn.addEventListener('click', () => {
  identityModalOverlay.classList.add('open');
});

if(myIdentity){
  chatIdentityLabel.textContent = `Sen: ${myIdentity}`;
}else{
  identityModalOverlay.classList.add('open');
}
