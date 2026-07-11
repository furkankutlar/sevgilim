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

// ---------- Uçuşan kalp efekti ----------
const heartsContainer = document.getElementById('hearts');
const heartChars = ['💗','💕','♡'];
function spawnHeart(){
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
// SUPABASE ENTEGRASYONU
// ============================================================
const SUPABASE_URL = "https://gxsagwouvimjlzbovyay.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4c2Fnd291dmltamx6Ym92eWF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyNDk1MDUsImV4cCI6MjA5ODgyNTUwNX0.8GViEPzagEaKg8vAAfOh429JnqQ6OcJvmb1E7XFX93E";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const memoriesGrid = document.getElementById('memoriesGrid');
const bucketListContainer = document.getElementById('bucketListContainer');

function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
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

function renderMemories(memories){
  if(!memories || memories.length === 0){
    memoriesGrid.innerHTML = '<div class="memories-empty">Henüz anı eklenmedi. İlk anıyı sen ekle! 💗</div>';
    return;
  }
  memoriesGrid.innerHTML = memories.map(m => `
    <div class="memory-card" data-id="${m.id}">
      ${m.image_url ? `<img src="${escapeHtml(m.image_url)}" alt="" onerror="this.remove()">` : ''}
      <div class="memory-date">${formatDate(m.memory_date)} <span class="memory-ago">· ${timeAgo(m.memory_date)}</span></div>
      <div class="memory-title">${escapeHtml(m.title)}</div>
      <div class="memory-actions">
        <button class="icon-btn" data-action="edit" data-id="${m.id}" aria-label="Düzenle">✏️</button>
        <button class="icon-btn" data-action="delete" data-id="${m.id}" aria-label="Sil">🗑️</button>
      </div>
    </div>
  `).join('');
}

async function fetchMemories(){
  const { data, error } = await supabaseClient
    .from('memories')
    .select('*')
    .order('memory_date', { ascending: false });

  if(error){
    console.error('Anılar hatası:', error);
    memoriesGrid.innerHTML = '<div class="memories-error">Anılar yüklenirken bir hata oluştu.</div>';
    return;
  }

  currentMemories = data || [];
  renderMemories(currentMemories);
}

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
  fetchMemories();
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
  fetchMemories();
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
  if(!('serviceWorker' in navigator) || !('PushManager' in window)){
    alert('Bu tarayıcı bildirimleri desteklemiyor. iPhone kullanıyorsan siteyi Safari üzerinden "Ana Ekrana Ekle" yaptığından ve ana ekrandaki simgeden açtığından emin ol.');
    return;
  }

  try{
    const permission = await Notification.requestPermission();
    if(permission !== 'granted'){
      alert('Bildirim izni verilmedi.');
      return;
    }

    const registration = await navigator.serviceWorker.register('sw.js');
    await navigator.serviceWorker.ready;

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
    await fetch('/api/send-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body, excludeOwner: excludeOwner || null, type: type || null })
    });
  }catch(err){
    console.error('Bildirim gönderme hatası:', err);
  }
}

const enableNotifBtn = document.getElementById('enableNotifBtn');
enableNotifBtn.addEventListener('click', enableNotifications);

// ============================================================
// SAYFA YÜKLENİNCE
// ============================================================
fetchMemories();
fetchBucketList();
fetchSpecialDays();

// ============================================================
// SEKME ÇUBUĞU (ALT NAVİGASYON)
// ============================================================
const tabButtons = document.querySelectorAll('.tab-btn');
const tabPages = document.querySelectorAll('.tab-page');
let chatPollInterval = null;

function switchTab(tabName){
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
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  // "+" anı ekleme butonu sadece Anılar sekmesinde görünsün
  openModalBtn.style.display = (tabName === 'memories') ? 'flex' : 'none';

  // Son açık kalınan sekmeyi hatırla (sayfa yenilenince oraya dönsün)
  try{ localStorage.setItem('biz-last-tab', tabName); }catch(e){}

  // URL'nin sonuna hangi sekmede olduğumuzu yazıyoruz; bildirim geldiğinde
  // servis çalışanı (service worker) "kullanıcı zaten sohbeti mi görüyor?" diye
  // buradan anlayıp, öyleyse bildirimi hiç göstermiyor.
  try{ history.replaceState(null, '', tabName === 'home' ? (location.pathname + location.search) : ('#' + tabName)); }catch(e){}

  // Mesajlar sekmesindeyken realtime çalışmasa bile mesajlar tazelensin diye
  // her birkaç saniyede bir otomatik yenileme yapılır; sekmeden çıkınca durur.
  if(tabName === 'chat'){
    markMessagesAsRead().then(fetchMessages).then(updateChatBadge).then(() => {
      chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
    });
    if(!chatPollInterval){
      chatPollInterval = setInterval(() => {
        markMessagesAsRead().then(fetchMessages).then(updateChatBadge);
      }, 3000);
    }
  }else if(chatPollInterval){
    clearInterval(chatPollInterval);
    chatPollInterval = null;
  }

  window.scrollTo({ top: 0, behavior: 'instant' });
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

async function updateSubscriptionIdentity(){
  if(!myIdentity) return;
  try{
    if(!('serviceWorker' in navigator)) return;
    const registration = await navigator.serviceWorker.getRegistration();
    if(!registration) return;
    const subscription = await registration.pushManager.getSubscription();
    if(!subscription) return;
    const subJson = subscription.toJSON();
    await supabaseClient
      .from('push_subscriptions')
      .update({ owner_name: myIdentity })
      .eq('endpoint', subJson.endpoint);
  }catch(e){
    console.error('Kimlik güncelleme hatası:', e);
  }
}

function setIdentity(name){
  myIdentity = name;
  try{ localStorage.setItem('biz-identity', name); }catch(e){}
  chatIdentityLabel.textContent = `Sen: ${name}`;
  identityModalOverlay.classList.remove('open');
  fetchMessages();
  updateSubscriptionIdentity();
  updateChatBadge();
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

// ============================================================
// MESAJLAR (SOHBET)
// ============================================================
const chatMessagesEl = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const chatSendBtn = document.getElementById('chatSendBtn');
const chatBadge = document.getElementById('chatBadge');

function formatChatTime(dateStr){
  const d = new Date(dateStr);
  return d.toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

let lastMessageCount = 0;
let renderedMessageIds = new Set();

function renderMessages(messages){
  if(!messages || messages.length === 0){
    chatMessagesEl.innerHTML = '<div class="memories-empty">Henüz mesaj yok, ilk mesajı sen yaz! 💗</div>';
    lastMessageCount = 0;
    renderedMessageIds = new Set();
    return;
  }

  const wasNearBottom = (chatMessagesEl.scrollHeight - chatMessagesEl.scrollTop - chatMessagesEl.clientHeight) < 80;
  const isNewMessage = messages.length !== lastMessageCount;

  chatMessagesEl.innerHTML = messages.map(m => {
    const mine = m.sender === myIdentity;
    const seenLabel = (mine && m.read_at) ? ' · Görüldü ✓✓' : (mine ? ' · Gönderildi ✓' : '');
    const isNewBubble = !renderedMessageIds.has(m.id);
    return `
    <div class="chat-bubble ${mine ? 'mine' : 'theirs'}${isNewBubble ? ' bubble-new' : ''}">
      ${escapeHtml(m.content)}
      <span class="chat-time">${mine ? '' : escapeHtml(m.sender) + ' · '}${formatChatTime(m.created_at)}${seenLabel}</span>
    </div>
  `;
  }).join('');

  renderedMessageIds = new Set(messages.map(m => m.id));

  // Kullanıcı zaten en altta duruyorsa veya yeni bir mesaj geldiyse aşağı kaydır;
  // eski mesajları okumak için yukarı kaydırmışsa yerini bozma
  if(wasNearBottom || isNewMessage){
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
  }
  lastMessageCount = messages.length;
}

async function updateChatBadge(){
  if(!myIdentity){ chatBadge.style.display = 'none'; return; }
  try{
    const { count, error } = await supabaseClient
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .neq('sender', myIdentity)
      .is('read_at', null);
    if(error){ console.error('Rozet hatası:', error); return; }
    chatBadge.style.display = (count && count > 0) ? 'block' : 'none';
  }catch(e){
    console.error('Rozet hatası:', e);
  }
}

async function markMessagesAsRead(){
  if(!myIdentity) return;
  try{
    const { error } = await supabaseClient
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .neq('sender', myIdentity)
      .is('read_at', null);
    if(error) console.error('Okundu işaretleme hatası:', error);
  }catch(e){
    console.error('Okundu işaretleme hatası:', e);
  }
}

async function fetchMessages(){
  const { data, error } = await supabaseClient
    .from('messages')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(200);

  if(error){
    console.error('Mesaj hatası:', error);
    chatMessagesEl.innerHTML = '<div class="memories-error">Mesajlar yüklenirken bir hata oluştu.</div>';
    return;
  }
  renderMessages(data);
}

async function sendMessage(){
  const content = chatInput.value.trim();
  if(!content) return;
  if(!myIdentity){
    identityModalOverlay.classList.add('open');
    return;
  }

  chatSendBtn.disabled = true;
  const { error } = await supabaseClient.from('messages').insert([{ sender: myIdentity, content }]);
  chatSendBtn.disabled = false;

  if(error){
    console.error(error);
    alert('Mesaj gönderilemedi, tekrar dener misin?');
    return;
  }

  chatInput.value = '';
  await fetchMessages();
  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
  sendNotification(`💬 ${myIdentity}`, content, myIdentity, 'chat');
}

chatSendBtn.addEventListener('click', sendMessage);
chatInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') sendMessage(); });

// Yeni mesaj geldiğinde anlık güncelleme (Supabase Realtime)
supabaseClient
  .channel('messages-realtime')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
    const chatPage = document.querySelector('.tab-page[data-page="chat"]');
    if(chatPage && chatPage.classList.contains('active')){
      markMessagesAsRead().then(fetchMessages).then(updateChatBadge);
    }else{
      fetchMessages();
      updateChatBadge();
    }
  })
  .subscribe((status) => {
    console.log('Realtime durumu:', status);
  });

fetchMessages();
updateChatBadge();

// ============================================================
// SON AÇIK KALINAN SEKMEYİ HATIRLAMA
// ============================================================
try{
  const savedTab = localStorage.getItem('biz-last-tab');
  if(savedTab && savedTab !== 'home' && document.querySelector(`.tab-page[data-page="${savedTab}"]`)){
    switchTab(savedTab);
  }
}catch(e){}
