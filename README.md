# Biz

İki kişilik anı, ortak plan, özel gün ve sohbet uygulaması. Statik arayüz Vercel'de,
veriler Supabase'de; bildirimler Vercel işlevi üzerinden Web Push ile gönderilir.

## Geliştirme ve doğrulama

Node.js 24 ile `npm ci`, `npm run check` ve `npm test` çalıştırın.
Testler sahte verilerle çalışır; gerçek mesajlara yazmaz ve bildirim göndermez.
Tarayıcıdaki Supabase ve Cropper dosyaları `vendor/` içinde sürümleri sabitlenmiş
olarak bulunur. Paket güncellemesinde ilgili `dist/umd/supabase.js`,
`dist/cropper.min.js`, `dist/cropper.min.css` ve lisans dosyalarını yenileyin.
Service worker değiştiğinde `SHELL_CACHE` sürümünü artırın.

## Yayın

Vercel projesi: `sevgilim`; üretim dalı: `main`; adres: https://furhi.vercel.app.
Bildirim işlevi için mevcut `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` sunucu ortamında gereklidir.
Gizli anahtarları depoya eklemeyin. Tarayıcıdaki anon anahtarı bir giriş parolası değildir.

Sohbet önce en yeni 50 mesajı getirir; önceki sayfalar tarih ve kimlik imleciyle
yüklenir. Realtime sağlıklıyken periyodik sorgu yapılmaz. Bağlantı bozulursa yalnızca
görünür sohbet sekmesi 15 saniyede bir yenilenir. Mesajlar cihazın arka planında
okundu işaretlenmez. Çevrimdışı önbellek yalnızca uygulama dosyalarını içerir;
sohbet verileri ve fotoğraflar service worker önbelleğine alınmaz.

## Mobil kullanım ve günün sorusu

Arayüz Safari/Chrome'da ana ekrana eklenen uygulama kullanımına göre düzenlenmiştir:
yerel uygulama ikonları, ekran çentiği/alt güvenli bölge boşlukları, dar ekran menüsü
ve VisualViewport tabanlı klavye yerleşimi bulunur. Harici GIF ve web fontları kaldırılmıştır.
Gerçek iPhone Safari klavyesi, masaüstü/otomatik testlerle tamamen doğrulanamaz.

`GET /api/daily-question?date=YYYY-MM-DD` aynı İstanbul günü için aynı soruyu döndürür.
53 soruluk CC0 Blabber verisi kontrollü biçimde Türkçeleştirilmiştir. Sabit karıştırılmış
sıra havuz tükenmeden tekrar etmez. İşlev sabitlenmiş dış kaynağı doğrular; kaynak
kesilirse aynı sorunun yerel lisanslı kopyasını sunar. Yeni soru eklemek için
`data/questions.tr.json` ve çeviriler birlikte güncellenir; kaynak sürümü rastgele değiştirilmez.
Lisans ve kaynak ayrıntıları `data/QUESTIONS-LICENSE.md` içindedir.

Günün sorusunun cevabı mevcut ortak sohbete normal bir mesaj olarak gider.
Bugünün sorusu ve yazılan cevap taslağı aynı telefonda saklanır. İki cevabın
karşılıklı kilidini açan bir erişim sistemi yoktur. Oturum güvenliği ayrıca ele alınacaktır.

Anılar 20'şer yüklenir. Belirsiz ağ hatası alan mesajlar cihazda UUID ile saklanır;
tekrar denemede aynı kimlik kullanılır. Her kişi için en fazla 50 çözülmemiş gönderim
tutulur; sınır dolunca eski kayıtlar sessizce atılmaz. Başarılı gönderimler temizlenir.
Sunucunun kaydedip yanıtın kaybolduğu bir gönderim uzlaştırılırken ikinci push
gönderilmez; bu durumda ilk bildirim kaçmış olabilir.

## Erişim sınırları

### Cüzdan

Ana sayfadaki Cüzdanımız kartı `/#wallet` görünümünü açar. Video referansındaki
koyu yeşil/mint görünüm mobil ekran için uyarlanmıştır. Kasalarım / Tüm kasalar,
güncel toplam bakiye, ay seçimi, aylık gelir-gider, kategori dağılımı ve hareket
listesi bulunur. Başlangıç bakiyesi gelire, kasalar arası aktarım gelir-gidere
eklenmez. Negatif bakiye mümkündür; bu gerçek banka işlemi yapmayan manuel kayıt defteridir.

Kullanıcının açık kararıyla eşleştirme kodu veya yeni giriş akışı eklenmedi.
Furki / Hilalişko isim seçimi kullanılır; her ikisi de bütün kayıtları görür.
İşlemler sunucuda bildirilen kasa sahibine göre kontrol edilir, fakat isim seçimi
kimlik doğrulama değildir: siteye ulaşan biri başka adı seçebilir ve API okunabilir.
Bu bölüm gerçek oturum açma eklenene kadar hassas finansal kayıtlar için erişim
güvencesi sağlamaz. Private Blob dosyası tek başına API yetkilendirmesi değildir.

Sunucu `wallet/shared-v1.json` dosyasını mevcut private Blob deposuna yazar;
indirim takip dosyasına dokunmaz. Kuruş cinsinden tamsayı aritmetiği, aynı UUID
ile yinelenen istekte çift kayıt önleme, ETag koşullu yazma ve kayıt revizyonu
kontrolleri kullanılır. Silinen kayıtlar eski düzenleme yanıtıyla yeniden oluşmaz.
Başarısız/belirsiz yazma isteği cihazda saklanır; kullanıcı aynı isteği yeniden
göndererek tamamlar. Bekleyen işlem varken yeni yazma engellenir. İnternetsizken
yeni kayıt yapılmaz; uygulama çevrimiçi çalışır. Cüzdan API'si service worker
tarafından önbelleğe alınmaz. Görünür cüzdan 45 saniyede bir, odak geri geldiğinde
ve elle yenilenir; kapalı sekmede cüzdan isteği gönderilmez.

12 kasa, 2.000 hareket sınırı vardır; arayüz 30'ar hareket gösterir. Gelecek tarih,
geçersiz tutar ve başka kişinin kasasına aktarım reddedilir. Hareketi olan kasayı
silmek için önce hareketler silinmeli veya diğer kasaya düzenlenmelidir. Örnek
kayıtlar yalnızca yerel önizlemededir; üretim boş cüzdanla başlar.

### İndirim defteri

Ana sayfadaki İndirim defterimiz kartı `/#prices` bölümünü açar. Yalnızca Gratis
ürün bağlantıları kabul edilir (en fazla 10 ürün). İlk kurulumda Pantene 10015186
başlangıç ürünüdür. Kullanıcı sildikten sonra yeniden eklenmez; boş liste korunur.
Önceki Watsons kayıtları koşullu Blob yazmasıyla kalıcı olarak temizlenir.

Ürün kartında hedef fiyat, bildirim alacak kişi, duraklatma ve iki adımlı silme
bulunur. Silme ürünle birlikte kayıtlı fiyat geçmişini kaldırır, takibini durdurur.
Kaybolan yanıtta silme tekrar denenebilir; ikinci istek de başarılı kabul edilir.
Kontrol sürerken silinen ürün sonuç kaydı sırasında yeniden oluşturulmaz.

Fiyatlar Gratis'in eşleşen ürün JSON-LD Offer verisinden TL olarak ve doğrulanmış
stok durumuyla okunur. Üyelik, kart veya kişisel kupon kullanılmaz. İlgisiz ürün,
CAPTCHA/hata sayfası, başka sunucuya yönlendirme ve belirsiz fiyatlar reddedilir.
Başarısız kontrol önceki fiyatı ve son başarılı kontrol zamanını değiştirmez.

`vercel.json` günlük 13:00 UTC (İstanbul 16:00, Hobby zamanlama aralığıyla 16–17)
kontrolünü `/api/price-tracker?job=daily` üzerinden çalıştırır. `CRON_SECRET` yalnızca
sunucudadır. Private Vercel Blob deposu projeye bağlanmıştır; SDK otomatik sağlanan
`BLOB_READ_WRITE_TOKEN` ile kalıcı state kullanır. Yazmalar ETag koşuluyla yapılır;
4 dakikalık lease aynı kontrolün paralel çalışmasını önler. Elle kontroller dahil
kontroller arasında en az 6 saat vardır. Uygulamanın açık olması gerekmez.
Fiyat ekranı uzun kontroller için 170 saniyelik ayrı istek süresi kullanır; hata
halinde kaydedilmemiş form değerleri korunur ve liste için yeniden yükleme sunulur.

İlk fiyat bildirimsiz başlangıçtır. Hedef yoksa takipte gözlenen en yüksek geçerli
fiyattan en az %5 ve 5 TL düşüş; hedef varsa hedefin altına inen gerçek düşüş gerekir.
22:00–09:00 İstanbul saatinde bildirim yoktur. Kişi başına günde en fazla tek özet
vardır; aynı veya daha yüksek indirim fiyatı yeniden bildirilmez. Yalnızca tam eşleşen
kişi adına kayıtlı cihazlara gider. Mağaza/kargo/üyelik/sepete özel fiyatlar dahil değildir.

Özetin kalıcı gönderim talebi push'tan önce yazılır. Bu, çökme ve tekrar çalışmada
bildirim yağmurunu engeller; talep ile push arasındaki çökmede veya sağlayıcı hatasında
o özet kaçabilir. Otomatik agresif yeniden gönderim yapılmaz. Bu tercih yinelenen
bildirimleri engellemeye öncelik verir. Gerçek giriş ertelendiği için liste ayarları
mevcut uygulamanın ortak erişim modeliyle çalışır; yalnızca saklama dosyası private'dır.

Mevcut isim seçimi bir kullanıcı doğrulaması değildir. Bu güncelleme gerçek oturum
girişi veya veritabanı yetkilendirmesi eklemez. Özel kullanımın güvenceye alınması
için Supabase Auth ile yalnızca iki hesaba izin veren RLS ve Storage kuralları,
gerçek proje şeması ve mevcut politikalar incelenerek ayrıca uygulanmalıdır.
Veritabanı yönetim erişimi olmadan politikalar doğrulanmış kabul edilmemelidir.

Bildirim API'sinin kaynak ve içerik kontrolleri kimlik doğrulama yerine geçmez.
İşlev içindeki istek sınırı yalnızca aynı sunucu örneğinde ani tekrarları azaltır;
dağıtık bir saldırı sınırı değildir. Tam koruma için doğrulanmış oturum ve paylaşılan
kalıcı hız sınırı gerekir. RLS kuralları görülmeden service-role anahtarıyla mevcut
istemci erişimini genişletmeyin.
