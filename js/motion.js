/* ==========================================================================
   NetStore — hareket katmanı

   Arayüzün "canlı" hissini veren küçük işlerin tek adresi. Hiçbiri veriye
   dokunmaz: sayfa JS olmadan da (ya da bu dosya hiç yüklenmese de) tam
   içerikle çizilir — buradaki her şey mevcut düğümlerin üzerine eklenir.

     1. Giriş sırası   — sayfa blokları sırayla yükselerek belirir
     2. Sayaç          — KPI rakamları sıfırdan hedefe sayılır (seçili dilin
                          rakamlarıyla: ۱۲۳ / 123)
     3. Dolum          — oran çubukları sıfırdan gerçek genişliğe akar
     4. Işık hâlesi    — kartlar imleci yumuşak bir parıltıyla izler
     5. Dalga          — düğmeye basınca yayılan halka
     6. Kaydırma şeridi— üst barın altındaki okuma göstergesi

   "Hareketi azalt" açıksa hepsi devre dışı kalır ve içerik doğrudan son
   hâliyle görünür (bkz. css/netstore.css · 15d).
   ========================================================================== */

/** İşletim sisteminde hareket azaltma açık mı? Her çağrıda taze okunur. */
function reducedMotion() {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  catch (e) { return false; }
}

/* --------------------------------------------------------------------------
   1. Giriş sırası

   Sayfanın üst düzey blokları (kart ızgaraları, başlık, tablolar) sırayla
   belirir. Izgaraların kendisi değil içindeki kartlar tek tek gecikir —
   böylece altı KPI kartı tek blok gibi değil, bir dalga gibi girer.
   Gecikme üst sınırı var: uzun listelerde son satır bir saniye bekletmesin.
   -------------------------------------------------------------------------- */

const REVEAL_STEP = 55;    /* blok başına gecikme (ms) */
const REVEAL_MAX  = 420;   /* toplam gecikme tavanı (ms) */

function revealPage(host) {
  if (!host || reducedMotion()) return;

  let i = 0;
  const delay = function () { return Math.min(i++ * REVEAL_STEP, REVEAL_MAX) + 'ms'; };

  Array.prototype.forEach.call(host.children, function (block) {
    /* Izgaraysa kartlarını tek tek getir, kabuğu olduğu yerde bırak. */
    if (block.classList.contains('grid') && block.children.length > 1) {
      Array.prototype.forEach.call(block.children, function (cell) {
        cell.style.setProperty('--d', delay());
        cell.classList.add('reveal');
      });
      return;
    }
    block.style.setProperty('--d', delay());
    block.classList.add('reveal');
  });

  /* Tablo satırları ve zaman çizelgesi kendi içinde akar. */
  host.querySelectorAll('table.data tbody tr, .timeline .tl-item').forEach(function (row, ri) {
    if (ri > 14) return;                       /* uzun listede yalnızca ilk ekran */
    row.style.setProperty('--d', (140 + ri * 32) + 'ms');
    row.classList.add('reveal-row');
  });
}

/* --------------------------------------------------------------------------
   2. Sayaç

   `data-count` taşıyan kutular sıfırdan hedefe sayılır. Biçimlendirme i18n'e
   bırakılır: para AFN/افغانی, rakamlar seçili dilin rakam kümesinde çıkar.
   Bitişte hedef değer bir kez daha yazılır — yuvarlama hatası kalmasın.
   -------------------------------------------------------------------------- */

const COUNT_MS = 1000;

function runCounters(host) {
  const els = (host || document).querySelectorAll('[data-count]');
  if (!els.length) return;

  els.forEach(function (el, i) {
    const to = Number(el.getAttribute('data-count'));
    const fmt = el.getAttribute('data-count-fmt') === 'num' ? num : money;

    if (!isFinite(to)) return;

    /* Hareket kapalıysa ya da sayılacak bir şey yoksa doğrudan yaz. */
    if (reducedMotion() || Math.abs(to) < 2) { el.textContent = fmt(to); return; }

    const wait = Math.min(i * 70, 320);
    const t0 = performance.now() + wait;
    el.textContent = fmt(0);

    requestAnimationFrame(function step(now) {
      const p = Math.max(0, Math.min(1, (now - t0) / COUNT_MS));
      const eased = 1 - Math.pow(1 - p, 4);     /* sona doğru yavaşlar */
      el.textContent = fmt(to * eased);
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = fmt(to);
    });
  });
}

/* --------------------------------------------------------------------------
   3. Dolum

   Oran çubuklarının genişliği satır içi biçemde yazılıdır. Bir kare için
   sıfıra çekip geri veriyoruz: CSS geçişi böyle devreye girer ve çubuk
   akarak dolar. Satır içi değere hiç dokunulmaz — yalnızca sırası değişir.
   -------------------------------------------------------------------------- */

function growBars(host) {
  if (reducedMotion()) return;

  const bars = (host || document).querySelectorAll('.meter-fill, .hbar-fill, .stack-seg, .gauge-arc');
  bars.forEach(function (el) {
    if (el.classList.contains('gauge-arc')) {
      const off = el.style.strokeDashoffset;
      if (!off) return;
      el.style.strokeDashoffset = el.getAttribute('data-empty') || off;
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { el.style.strokeDashoffset = off; });
      });
      return;
    }

    const target = el.style.width;
    if (!target) return;
    el.style.width = '0%';
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { el.style.width = target; });
    });
  });
}

/* --------------------------------------------------------------------------
   4. Işık hâlesi

   Kartlar imlecin yerini iki özel özellikte (`--mx`, `--my`) tutar; hâleyi
   CSS çiziyor. Tek bir dinleyici var ve kare başına en fazla bir kez yazar —
   pointermove saniyede yüzlerce kez tetiklenebilir.
   -------------------------------------------------------------------------- */

let _spotQueued = false;
let _spotEvent = null;

document.addEventListener('pointermove', function (ev) {
  if (ev.pointerType === 'touch') return;      /* dokunmada hâle anlamsız */
  _spotEvent = ev;
  if (_spotQueued) return;
  _spotQueued = true;

  requestAnimationFrame(function () {
    _spotQueued = false;
    const ev2 = _spotEvent;
    if (!ev2 || !ev2.target || !ev2.target.closest) return;

    const el = ev2.target.closest('.card, .stat');
    if (!el) return;

    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    el.style.setProperty('--mx', (((ev2.clientX - r.left) / r.width) * 100).toFixed(1) + '%');
    el.style.setProperty('--my', (((ev2.clientY - r.top) / r.height) * 100).toFixed(1) + '%');
  });
}, { passive: true });

/* --------------------------------------------------------------------------
   5. Dalga

   Basılan noktadan yayılan halka. Düğmenin kendi HTML'ine dokunulmaz;
   halka geçici bir <span> olarak eklenir ve animasyon bitince silinir.
   -------------------------------------------------------------------------- */

document.addEventListener('pointerdown', function (ev) {
  if (reducedMotion()) return;
  if (!ev.target || !ev.target.closest) return;

  const btn = ev.target.closest('.btn');
  if (!btn) return;

  const r = btn.getBoundingClientRect();
  const size = Math.max(r.width, r.height);

  const ink = document.createElement('span');
  ink.className = 'ripple';
  ink.style.width = ink.style.height = size + 'px';
  ink.style.left = (ev.clientX - r.left - size / 2) + 'px';
  ink.style.top  = (ev.clientY - r.top  - size / 2) + 'px';

  btn.appendChild(ink);
  setTimeout(function () { ink.remove(); }, 600);
}, { passive: true });

/* --------------------------------------------------------------------------
   6. Kaydırma şeridi — üst barın altında ne kadar okundu
   -------------------------------------------------------------------------- */

function initScrollBar() {
  const bar = document.getElementById('scrollBar');
  if (!bar) return;

  let queued = false;
  function paint() {
    queued = false;
    const h = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.transform = 'scaleX(' + (h > 24 ? Math.min(1, window.scrollY / h) : 0) + ')';
  }

  window.addEventListener('scroll', function () {
    if (queued) return;
    queued = true;
    requestAnimationFrame(paint);
  }, { passive: true });

  paint();
}

/* --------------------------------------------------------------------------
   Sayfa çizildikten sonra tek çağrı — app.js · render() sonunda
   -------------------------------------------------------------------------- */

function mountMotion(host) {
  const page = host || document.getElementById('page');

  revealPage(page);
  runCounters(page);
  growBars(page);

  /* Kenar çubuğu yalnızca ilk açılışta akar; her rota değişiminde değil. */
  if (!document.body.classList.contains('nav-animated')) {
    document.body.classList.add('nav-animated');
    if (!reducedMotion()) {
      document.querySelectorAll('#sidebarNav > *').forEach(function (el, i) {
        el.style.setProperty('--d', (i * 26) + 'ms');
        el.classList.add('reveal-row');
      });
    }
  }
}
