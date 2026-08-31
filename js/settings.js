/* ==========================================================================
   NetStore — işletme ayarları

   Ayarlar sayfasındaki alanların gerçek kaynağı. Defterin kendisi gibi iki
   modda da aynı imzalarla çalışır:

     yerel  — localStorage (netstore-settings)
     ortak  — Firestore'da tek belge: shops/{SHOP_ID}/meta/settings
              İki cihaz aynı ayarı görür; biri değiştirince diğeri anında
              günceller (bkz. cloudSubscribeSettings).

   Ayarlar defterin bir parçası DEĞİL, defterin üstündeki tercihlerdir; bu
   yüzden kayıt koleksiyonlarından ayrı tutulur. Yedek dosyasına yine de
   yazılır — yedekten dönen kişi işletme bilgilerini tekrar girmesin diye.
   ========================================================================== */

const SETTINGS_KEY = 'netstore-settings';

/* İşletme adı ve adresi bilerek BOŞ: doldurulmadıkları sürece faturada
   seçili dilin örnek adı görünür (bkz. bizName / bizAddr). Böylece
   uygulama ilk açıldığında fatura başlığı boş kalmaz. */
const SETTINGS_DEFAULTS = {
  bizName:   '',
  bizAddr:   '',
  tax:       'AF-1234567890',
  phone:     '+93 20 210 00 00',
  email:     'info@netstore.af',
  dueDays:   30,   /* yeni satışta önerilen vade */
  lateAlert: 0,    /* vadeden kaç gün önce uyarılsın: 0 = yalnız gecikince */
  minStock:  5     /* yeni üründe önerilen minimum stok */
};

let SETTINGS = Object.assign({}, SETTINGS_DEFAULTS);

/* Yazı alanlarının üst sınırı. Faturaya basılan bir metnin sayfayı
   taşırmaması ve buluta şişmiş belge gitmemesi için. */
const SETTINGS_MAX_LEN = 200;
const SETTINGS_TEXT = ['bizName', 'bizAddr', 'tax', 'phone', 'email'];

/* Gecikme uyarısı için kabul edilen gün sayıları (arayüzdeki seçeneklerle
   birebir aynı olmalı). */
const LATE_ALERT_DAYS = [0, 3, 7];

/* --------------------------------------------------------------------------
   Okuma
   -------------------------------------------------------------------------- */

function setting(key) { return SETTINGS[key]; }

/** Faturadaki işletme adı. Ayar boşsa dile göre örnek ad kullanılır. */
function bizName() { return SETTINGS.bizName || t('inv_biz_name'); }

/** Faturadaki işletme adresi. Ayar boşsa dile göre örnek adres kullanılır. */
function bizAddr() { return SETTINGS.bizAddr || t('inv_biz_addr'); }

/* --------------------------------------------------------------------------
   Doğrulama

   Gelen nesneye güvenilmez: buluttan, yedek dosyasından ya da eski bir
   sürümden gelmiş olabilir. Tanımadığımız her alan varsayılana düşer —
   yarım bir ayar takımı, varsayılanlardan daha kötüdür.
   -------------------------------------------------------------------------- */

function intOr(v, lo, hi, fallback) {
  const n = Math.round(Number(v));
  if (!isFinite(n) || n < lo || n > hi) return fallback;
  return n;
}

function normalizeSettings(obj) {
  const out = Object.assign({}, SETTINGS_DEFAULTS);
  if (!obj || typeof obj !== 'object') return out;

  SETTINGS_TEXT.forEach(function (k) {
    if (typeof obj[k] === 'string') out[k] = obj[k].trim().slice(0, SETTINGS_MAX_LEN);
  });

  out.dueDays   = intOr(obj.dueDays, 0, 3650, SETTINGS_DEFAULTS.dueDays);
  out.minStock  = intOr(obj.minStock, 0, 1000000, SETTINGS_DEFAULTS.minStock);
  out.lateAlert = LATE_ALERT_DAYS.indexOf(Number(obj.lateAlert)) >= 0
    ? Number(obj.lateAlert) : SETTINGS_DEFAULTS.lateAlert;

  return out;
}

/** Ayarları belleğe alır (doğrulayarak). */
function applySettings(obj) { SETTINGS = normalizeSettings(obj); }

/** Varsayılanlara döner — çıkış yapıldığında ve "demoya dön" işleminde. */
function resetSettings() { SETTINGS = Object.assign({}, SETTINGS_DEFAULTS); }

/* --------------------------------------------------------------------------
   Kalıcılık
   -------------------------------------------------------------------------- */

/** Diskteki ayarları belleğe alır. Yalnızca yerel modda çağrılır. */
function loadSettingsLocal() {
  let raw;
  try { raw = localStorage.getItem(SETTINGS_KEY); } catch (e) { return false; }
  if (!raw) return false;

  let obj;
  try { obj = JSON.parse(raw); } catch (e) { return false; }

  applySettings(obj);
  return true;
}

/** Ortak moddaysa buluta, değilse diske yazar. */
function saveSettings() {
  if (typeof cloudActive === 'function' && cloudActive()) return cloudSaveSettings();

  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(SETTINGS));
    return true;
  } catch (e) {
    if (typeof toast === 'function') toast(t('st_save_failed'), 'warning');
    return false;
  }
}

/* --------------------------------------------------------------------------
   Türetilmiş hesap
   -------------------------------------------------------------------------- */

/**
 * Vadesi yaklaşan — henüz gecikmemiş ama ayarlanan gün sayısı içinde
 * dolacak — ödenmemiş faturalar. Gecikmiş olanlar buraya girmez; onların
 * kendi uyarısı var.
 */
function dueSoonSales() {
  const days = SETTINGS.lateAlert;
  if (!days) return [];

  const limit = addDays(TODAY, days);
  return SALES.filter(function (s) {
    return saleStatus(s).key !== 'paid' && s.due >= TODAY && s.due <= limit;
  });
}
