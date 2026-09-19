/* ==========================================================================
   NetStore — Kılavuz çalışma zamanı

   İçerik content.js içinde (DOCS: bölüm listesi, her metin üç dilde).
   Bu dosya onu çizer: içindekiler, dil/tema düğmeleri, sayfa içi arama,
   kaydırırken içindekilerde aktif bölüm, çapa ile bölüme gitme.

   Uygulamanın katmanları olduğu gibi kullanılır:
     ../js/i18n.js  — lang(), setLang(), LANGS, applyLangToDocument()
     ../js/theme.js — theme(), toggleTheme(), applyThemeToDocument()
     ../js/icons.js — icon(), hydrateIcons()
     ../js/motion.js— ışık hâlesi, dalga, kaydırma şeridi (kendiliğinden)
   ========================================================================== */

/* Kılavuza özgü birkaç metin — uygulamanın sözlüğüne karışmasın. */
const DT = {
  title:      { tr:'Kılavuz',                    en:'Guide',                  fa:'راهنما' },
  crumb:      { tr:'Kullanım kılavuzu',          en:'User guide',             fa:'راهنمای استفاده' },
  intro_h:    { tr:'NetStore nasıl kullanılır',  en:'How to use NetStore',    fa:'نحوهٔ استفاده از نت‌ستور' },
  intro_p:    { tr:'Stok, satış, müşteri, borç ve tahsilat — hepsi tek defterde. Bu kılavuz her ekranı, her düğmeyi ve dikkat etmeniz gereken noktaları anlatır. Sol taraftaki listeden bir bölüm seçin ya da arama kutusuna yazın.',
                en:'Stock, sales, customers, debt and payments — all in one ledger. This guide walks through every screen, every button and the things to watch out for. Pick a section from the list or type in the search box.',
                fa:'موجودی، فروش، مشتری، بدهی و دریافتی — همه در یک دفتر. این راهنما هر صفحه، هر دکمه و نکاتی را که باید مراقب باشید شرح می‌دهد. از فهرست یک بخش را انتخاب کنید یا در جعبهٔ جستجو بنویسید.' },
  toc:        { tr:'İçindekiler',                en:'Contents',               fa:'فهرست' },
  search_ph:  { tr:'Kılavuzda ara…',             en:'Search the guide…',      fa:'جستجو در راهنما…' },
  n_match:    { tr:'{n} bölüm eşleşti',          en:'{n} sections match',     fa:'{n} بخش یافت شد' },
  no_match:   { tr:'Eşleşen bölüm yok',          en:'No matching section',    fa:'بخشی یافت نشد' },
  open_app:   { tr:'Uygulamayı aç',              en:'Open the app',           fa:'باز کردن برنامه' },
  open_app_s: { tr:'Defterinize dönün',          en:'Back to your ledger',    fa:'بازگشت به دفتر' },
  to_top:     { tr:'Başa dön',                   en:'Back to top',            fa:'بازگشت به بالا' },
  sections:   { tr:'{n} bölüm',                  en:'{n} sections',           fa:'{n} بخش' },
  foot:       { tr:'Bu kılavuz uygulamayla birlikte güncellenir.', en:'This guide is updated together with the app.', fa:'این راهنما همراه با برنامه به‌روز می‌شود.' },
  aria_theme: { tr:'Koyu / aydınlık tema',       en:'Dark / light theme',     fa:'پوستهٔ تیره / روشن' },
  aria_lang:  { tr:'Dil seç',                    en:'Select language',        fa:'انتخاب زبان' },
  aria_menu:  { tr:'İçindekileri aç',            en:'Open contents',          fa:'باز کردن فهرست' },
  aria_close: { tr:'Kapat',                      en:'Close',                  fa:'بستن' },
  tip:        { tr:'İpucu',                      en:'Tip',                    fa:'نکته' },
  warn:       { tr:'Dikkat',                     en:'Warning',                fa:'هشدار' },
  note:       { tr:'Not',                        en:'Note',                   fa:'یادداشت' }
};

function dt(key, vars) {
  const row = DT[key];
  let s = row ? (row[lang()] || row.en || row.tr) : key;
  if (vars) Object.keys(vars).forEach(function (k) { s = s.split('{' + k + '}').join(vars[k]); });
  return s;
}

/** Üç dilli bir metin nesnesinden seçili dili alır. */
function pick(m) {
  if (!m) return '';
  if (typeof m === 'string') return m;
  return m[lang()] || m.en || m.tr || '';
}

/* --------------------------------------------------------------------------
   Satır içi işaretler
   **Etiket**  → arayüz rozeti · `değer` → kod · → ok
   Önce kaçış, sonra işaret: içerik HTML olarak yorumlanmaz.
   -------------------------------------------------------------------------- */
function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function inline(s) {
  return escapeHtml(s)
    .replace(/\*\*([^*]+)\*\*/g, '<b class="ui">$1</b>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\s([→←])\s/g, ' <span class="arrow">$1</span> ');
}

/* --------------------------------------------------------------------------
   Çizim
   -------------------------------------------------------------------------- */
function renderBlock(b) {
  const type = b.type;
  if (type === 'p')   return '<p>' + inline(pick(b.text)) + '</p>';
  if (type === 'h')   return '<h3>' + inline(pick(b.text)) + '</h3>';
  if (type === 'steps')
    return '<ol class="steps">' + (b.items || []).map(function (it) { return '<li>' + inline(pick(it)) + '</li>'; }).join('') + '</ol>';
  if (type === 'list')
    return '<ul class="list">' + (b.items || []).map(function (it) { return '<li>' + inline(pick(it)) + '</li>'; }).join('') + '</ul>';
  if (type === 'tip' || type === 'warn' || type === 'note') {
    const tone = type === 'tip' ? 'success' : type === 'warn' ? 'danger' : 'info';
    const ic = type === 'tip' ? 'check' : type === 'warn' ? 'alert' : 'info';
    return '<div class="alert alert-' + tone + '">' + icon(ic) +
      '<div><strong>' + escapeHtml(dt(type)) + ':</strong> <span class="alert-text">' + inline(pick(b.text)) + '</span></div></div>';
  }
  if (type === 'table') {
    const head = (b.head || []).map(function (h) { return '<th>' + inline(pick(h)) + '</th>'; }).join('');
    const rows = (b.rows || []).map(function (r) {
      return '<tr>' + r.map(function (c) { return '<td>' + inline(pick(c)) + '</td>'; }).join('') + '</tr>';
    }).join('');
    return '<div class="table-wrap"><table class="data"><thead><tr>' + head + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
  }
  return '';
}

function renderSection(s) {
  return '<section class="card doc-section" id="' + escapeHtml(s.id) + '">' +
    '<div class="card-head">' +
      '<span class="sec-ico">' + icon(s.icon) + '</span>' +
      '<div style="min-width:0"><h2>' + inline(pick(s.title)) + '</h2>' +
      '<p class="lead">' + inline(pick(s.lead)) + '</p></div>' +
    '</div>' +
    '<div class="card-body"><div class="doc-body">' +
      (s.blocks || []).map(renderBlock).join('') +
    '</div></div>' +
  '</section>';
}

function renderTOC(filter) {
  const q = normalizeQ(filter || '');
  let shown = 0;
  const html = DOCS.map(function (s) {
    const hit = !q || sectionText(s).indexOf(q) !== -1;
    if (hit) shown++;
    return '<a class="nav-item' + (hit ? '' : ' dim') + '" href="#' + escapeHtml(s.id) + '" data-sec="' + escapeHtml(s.id) + '">' +
      icon(s.icon) + '<span>' + escapeHtml(pick(s.title)) + '</span></a>';
  }).join('');
  document.getElementById('toc').innerHTML =
    '<div class="nav-group-label">' + escapeHtml(dt('toc')) + '</div>' + html +
    (q ? '<div class="toc-count">' + escapeHtml(shown ? dt('n_match', { n: shown }) : dt('no_match')) + '</div>' : '');
  markActive();
}

/* Aramada Türkçe büyük/küçük ve Fars rakamı farkı olmasın. */
function normalizeQ(s) {
  return String(s).toLocaleLowerCase('tr')
    .replace(/[۰-۹]/g, function (d) { return String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)); })
    .replace(/[٠-٩]/g, function (d) { return String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)); })
    .trim();
}
const _textCache = {};
function sectionText(s) {
  const k = s.id + '|' + lang();
  if (_textCache[k]) return _textCache[k];
  const parts = [pick(s.title), pick(s.lead)];
  (s.blocks || []).forEach(function (b) {
    if (b.text) parts.push(pick(b.text));
    (b.items || []).forEach(function (i) { parts.push(pick(i)); });
    (b.head || []).forEach(function (i) { parts.push(pick(i)); });
    (b.rows || []).forEach(function (r) { r.forEach(function (c) { parts.push(pick(c)); }); });
  });
  return (_textCache[k] = normalizeQ(parts.join(' ')));
}

function render() {
  document.title = 'NetStore — ' + dt('title');
  document.getElementById('pageTitle').textContent = dt('title');
  document.getElementById('pageCrumb').textContent = dt('crumb');
  document.getElementById('brandSub').textContent = dt('title');
  document.getElementById('appLinkName').textContent = dt('open_app');
  document.getElementById('appLinkSub').textContent = dt('open_app_s');
  document.getElementById('docsSearch').placeholder = dt('search_ph');
  document.getElementById('btnTheme').setAttribute('aria-label', dt('aria_theme'));
  document.getElementById('btnBurger').setAttribute('aria-label', dt('aria_menu'));
  document.getElementById('btnNavClose').setAttribute('aria-label', dt('aria_close'));
  document.getElementById('btnApp').setAttribute('aria-label', dt('open_app'));

  document.getElementById('langSwitch').innerHTML =
    '<div class="seg" data-seg="lang" aria-label="' + escapeHtml(dt('aria_lang')) + '">' +
    Object.keys(LANGS).map(function (k) {
      return '<button data-val="' + k + '"' + (lang() === k ? ' class="on"' : '') +
        ' title="' + escapeHtml(LANGS[k].name) + '">' + escapeHtml(LANGS[k].short) + '</button>';
    }).join('') + '</div>';

  const host = document.getElementById('docs');
  host.innerHTML =
    '<div class="doc-intro">' +
      '<h2>' + escapeHtml(dt('intro_h')) + '</h2>' +
      '<p>' + escapeHtml(dt('intro_p')) + '</p>' +
      '<div class="chip-row"><span class="badge badge-accent">' + icon('archive') + escapeHtml(dt('sections', { n: DOCS.length })) + '</span></div>' +
    '</div>' +
    DOCS.map(renderSection).join('') +
    '<footer class="doc-foot"><span>' + escapeHtml(dt('foot')) + '</span><span class="spacer"></span>' +
      '<a href="../index.html#/dashboard">' + icon('dashboard') + ' ' + escapeHtml(dt('open_app')) + '</a></footer>';

  renderTOC(document.getElementById('docsSearch').value);
  hydrateIcons(document);
  revealOnScroll();
}

/* --------------------------------------------------------------------------
   Kaydırma: aktif bölüm, belirme, başa dön
   -------------------------------------------------------------------------- */
let _active = '';
function markActive() {
  document.querySelectorAll('#toc .nav-item').forEach(function (a) {
    a.classList.toggle('active', a.getAttribute('data-sec') === _active);
  });
}

function bindActiveTracking() {
  const io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { _active = e.target.id; markActive(); }
    });
  }, { rootMargin: '-25% 0px -60% 0px', threshold: 0 });
  document.querySelectorAll('.doc-section').forEach(function (s) { io.observe(s); });
}

function revealOnScroll() {
  let reduced = false;
  try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  if (reduced) { bindActiveTracking(); return; }
  const io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add('reveal');
      io.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -8% 0px' });
  document.querySelectorAll('.doc-section, .doc-intro').forEach(function (s) {
    s.style.opacity = '0';
    io.observe(s);
  });
  /* .reveal animasyonu bitince satır içi opacity kaldırılsın — sonraki
     tema/dil çizimlerinde öğe görünmez kalmasın. */
  document.querySelectorAll('.doc-section, .doc-intro').forEach(function (s) {
    s.addEventListener('animationend', function () { s.style.opacity = ''; }, { once: true });
  });
  bindActiveTracking();
}

function bindToTop() {
  const b = document.createElement('button');
  b.className = 'to-top'; b.innerHTML = icon('chevronLeft');
  b.setAttribute('aria-label', dt('to_top'));
  b.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
  document.body.appendChild(b);
  let queued = false;
  window.addEventListener('scroll', function () {
    if (queued) return; queued = true;
    requestAnimationFrame(function () { queued = false; b.classList.toggle('on', window.scrollY > 600); });
  }, { passive: true });
}

/* --------------------------------------------------------------------------
   Olaylar
   -------------------------------------------------------------------------- */
function openNav()  { document.body.classList.add('nav-open'); }
function closeNav() { document.body.classList.remove('nav-open'); }

document.addEventListener('click', function (ev) {
  const nav = ev.target.closest('[data-nav]');
  if (nav) { nav.dataset.nav === 'open' ? openNav() : closeNav(); return; }

  const seg = ev.target.closest('[data-seg="lang"] button');
  if (seg) { setLang(seg.dataset.val); render(); return; }

  if (ev.target.closest('[data-act="toggle-theme"]')) { toggleTheme(); return; }

  const toc = ev.target.closest('#toc .nav-item');
  if (toc) { closeNav(); /* çapa doğal olarak kayar */ }
});

document.addEventListener('keydown', function (ev) {
  if (ev.key === 'Escape') closeNav();
});

document.getElementById('docsSearch').addEventListener('input', function () {
  renderTOC(this.value);
});

document.addEventListener('DOMContentLoaded', function () {
  applyLangToDocument();
  if (typeof applyThemeToDocument === 'function') applyThemeToDocument();
  hydrateIcons(document);
  render();
  bindToTop();
  if (typeof initScrollBar === 'function') initScrollBar();

  /* Çapayla gelen (…#ortak) doğrudan bölüme insin. */
  if (location.hash && location.hash.length > 1) {
    const el = document.getElementById(location.hash.slice(1));
    if (el) setTimeout(function () { el.scrollIntoView({ block: 'start' }); }, 60);
  }
});
