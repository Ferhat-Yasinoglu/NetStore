/* ==========================================================================
   NetStore — tema katmanı (koyu / aydınlık)

   Renklerin tamamı css/netstore.css içindeki tokenlardan gelir; burada
   yalnızca kök öğedeki `data-theme` niteliği yönetilir. Bu dosya i18n gibi
   <head> içinde, gövdeden ÖNCE yüklenir: seçili tema ilk boyamadan önce
   uygulansın diye. Aksi hâlde aydınlık temayı seçen kullanıcıda sayfa bir an
   koyu çizilip sonra beyazlıyordu.

   İlk açılışta işletim sisteminin tercihi kullanılır; kullanıcı düğmeye
   basınca seçim `netstore-theme` anahtarıyla saklanır ve bir daha sorulmaz.
   ========================================================================== */

const THEME_KEY = 'netstore-theme';

/* Üst bardaki tarayıcı çubuğunun rengi — tema ile birlikte değişir. */
const THEME_COLOR = { dark: '#070B16', light: '#F1F3FB' };

let THEME = (function () {
  let saved = null;
  try { saved = localStorage.getItem(THEME_KEY); } catch (e) { /* özel sekme */ }
  if (saved === 'light' || saved === 'dark') return saved;

  try {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
  } catch (e) { /* eski tarayıcı */ }

  return 'dark';
})();

function theme() { return THEME; }

/** Niteliği ve tarayıcı çubuğu rengini yazar. Boyamadan önce çağrılır. */
function applyThemeToDocument() {
  document.documentElement.setAttribute('data-theme', THEME);

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLOR[THEME] || THEME_COLOR.dark);
}

/**
 * Temayı değiştirir.
 *
 * Grafikler renklerini SVG'nin içine yazdığı için (stroke, gradyan durakları)
 * tema değişince yeniden çizilmeleri gerekir — bu yüzden render() çağrılır.
 * render() sayfayı başa sarar; kullanıcı listenin ortasındayken tema
 * değiştirdiyse bulunduğu yeri kaybetmesin diye kaydırma konumu geri konur.
 */
function setTheme(next) {
  if (next !== 'light' && next !== 'dark') return;
  if (next === THEME) return;

  THEME = next;
  try { localStorage.setItem(THEME_KEY, THEME); } catch (e) { /* yazılamadı: oturumluk kalır */ }

  /* Renkler sıçramasın: kısa bir çapraz geçiş sınıfı. */
  const root = document.documentElement;
  root.classList.add('theme-shift');
  applyThemeToDocument();
  setTimeout(function () { root.classList.remove('theme-shift'); }, 420);

  const y = window.scrollY;
  if (typeof render === 'function') {
    render();
    window.scrollTo(0, y);
  }
}

function toggleTheme() { setTheme(THEME === 'dark' ? 'light' : 'dark'); }
