/* ==========================================================================
   NetStore — belge güvenliği: mühür, kaşe, güvenlik deseni, doğrulama

   Kâğıda basılan fatura ve fişlerin taklit edilmesini ve üzerinde
   oynanmasını zorlaştıran katman:

   · Mühür (sealSvg)     — dükkânın yuvarlak resmî mührü, kodla çizilir.
   · Kaşe (stampSvg)     — durum kaşesi: ÖDENDİ / ÖDENMEDİ / VADESİ GEÇTİ …
   · Desen (bandSvg)     — fotokopide bozulan ince çizgili güvenlik şeridi.
   · Mikro yazı          — büyütmeden okunmayan tekrar eden satır.
   · Doğrulama kodu      — belgenin numarası, tarihi ve tutarından türetilen
                           8 haneli kod. Tutar değiştirilirse kod tutmaz.
   · Karekod (qrSvg)     — aynı bilgiler; herhangi bir telefon kamerasıyla
                           okununca belgenin ASIL değerleri görünür.
   · Doğrulama aracı     — Faturalar → Belge Doğrula: numara + kod girilir,
                           defterdeki kayıtla karşılaştırılır.

   Kod, dükkâna özel gizli bir anahtarla (docSecret) hesaplanır; anahtar
   ayarlarla birlikte saklanır ve ortak defterde iki telefonda da aynıdır.
   ========================================================================== */

/* --------------------------------------------------------------------------
   Doğrulama kodu
   -------------------------------------------------------------------------- */

/* Crockford Base32: I, L, O, U yok — kâğıttan okurken 1/I, 0/O karışmasın. */
const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** 32 bit FNV-1a. Kriptografik değil; amaç kâğıt üzerindeki oynamayı
    yakalamak, dünyayı korumak değil. */
function fnv1a(str, seed) {
  let h = (seed >>> 0) || 0x811C9DC5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Parçalardan 8 haneli kod: XXXX-XXXX. İki farklı tohumla 40 bit. */
function docCode(parts) {
  const s = parts.map((p) => String(p == null ? '' : p)).join('\u001F');
  const a = fnv1a(s, 0x811C9DC5);
  const b = fnv1a(s + '\u001E' + a.toString(16), 0x9747B28C);
  let out = '';
  for (let i = 0; i < 4; i++) out += CODE_ALPHABET[(a >>> (i * 5)) & 31];
  for (let i = 0; i < 4; i++) out += CODE_ALPHABET[(b >>> (i * 5)) & 31];
  return out.slice(0, 4) + '-' + out.slice(4);
}

/** Dükkâna özel gizli anahtar; ilk gerektiğinde üretilir ve ayarlarla
    birlikte kaydedilir (ortak defterde buluta gider). */
function docSecret() {
  let s = typeof setting === 'function' ? setting('docSecret') : '';
  if (s && s.length >= 16) return s;
  s = '';
  const bytes = new Uint8Array(16);
  if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  for (let i = 0; i < 16; i++) s += CODE_ALPHABET[bytes[i] & 31];
  SETTINGS.docSecret = s;
  if (typeof saveSettings === 'function') saveSettings();
  return s;
}

/** Yerel takvimde YYYY-MM-DD — kod ve karekod için saat dilimine bağımsız. */
function isoLocal(d) {
  const x = new Date(d);
  return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' +
    String(x.getDate()).padStart(2, '0');
}

/** Tutarı iki ondalıkla, dil bağımsız. */
function amountKey(v) { return (Math.round((Number(v) || 0) * 100) / 100).toFixed(2); }

function invoiceCode(sale) {
  const st = saleTotals(sale);
  return docCode(['I', sale.no, isoLocal(sale.date), amountKey(st.total), sale.items.length, docSecret()]);
}

function receiptCode(p, sale) {
  return docCode(['R', sale ? sale.no : '', isoLocal(p.date), amountKey(p.amount), p.id, docSecret()]);
}

/** Garanti belgesi kodu: satış, garanti bitişi ve seri numaraları üzerinden. */
function warrantyCode(sale) {
  const items = warrantyItems(sale);
  const end = warrantyEnd(sale);
  const serials = items.map(function (x) { return x.pid + ':' + x.months + ':' + x.serial; }).join(',');
  return docCode(['W', sale.no, isoLocal(sale.date), end ? isoLocal(end) : '', serials, docSecret()]);
}

/** Kâğıttan okunan numara/kod: boşluk, tire, küçük harf, Fars rakamı toleranslı. */
function cleanCode(s) {
  return String(s || '')
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06F0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .toUpperCase().replace(/[^0-9A-Z]/g, '')
    .replace(/O/g, '0').replace(/[IL]/g, '1').replace(/U/g, 'V');
}
function cleanNo(s) {
  return String(s || '')
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06F0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .toUpperCase().replace(/[\s_]/g, '').replace(/[–—]/g, '-');
}

/**
 * Kâğıt belgeyi defterle karşılaştırır.
 * Dönen: { state:'ok'|'bad'|'none', kind:'invoice'|'receipt', sale, payment }
 */
function verifyDoc(noRaw, codeRaw) {
  const no = cleanNo(noRaw), code = cleanCode(codeRaw);
  const sale = SALES.find((s) => cleanNo(s.no) === no);
  if (!sale) return { state: 'none' };
  if (code && cleanCode(invoiceCode(sale)) === code) return { state: 'ok', kind: 'invoice', sale };
  const pay = code ? PAYMENTS.find((p) => p.saleId === sale.id && cleanCode(receiptCode(p, sale)) === code) : null;
  if (pay) return { state: 'ok', kind: 'receipt', sale, payment: pay };
  if (code && warrantyItems(sale).length && cleanCode(warrantyCode(sale)) === code) {
    return { state: 'ok', kind: 'warranty', sale };
  }
  return { state: 'bad', kind: 'invoice', sale };
}

/* --------------------------------------------------------------------------
   Karekod
   -------------------------------------------------------------------------- */

/** Karekod içeriği: her kamera uygulamasının düz metin gösterebileceği,
    dilden bağımsız kısa satır. */
function invoiceQrText(sale) {
  const st = saleTotals(sale);
  return 'NETSTORE|INV|' + sale.no + '|' + isoLocal(sale.date) + '|' + amountKey(st.total) + ' ' + currencyLabel() + '|' + invoiceCode(sale);
}
function warrantyQrText(sale) {
  const end = warrantyEnd(sale);
  return 'NETSTORE|WRNT|' + sale.no + '|' + isoLocal(sale.date) + '|' +
    (end ? isoLocal(end) : '-') + '|' + warrantyCode(sale);
}
function receiptQrText(p, sale) {
  return 'NETSTORE|RCPT|' + (sale ? sale.no : '-') + '|' + isoLocal(p.date) + '|' + amountKey(p.amount) + ' ' + currencyLabel() + '|' + receiptCode(p, sale);
}

/** Karekodu tek bir <path> ile çizer — yazdırmada keskin kalır. */
function qrSvg(text, size) {
  if (typeof qrcode !== 'function') return '';
  let qr;
  try {
    qr = qrcode(0, 'M');
    qr.addData(text, 'Byte');
    qr.make();
  } catch (e) { return ''; }
  const n = qr.getModuleCount();
  const quiet = 2, dim = n + quiet * 2;
  let d = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) d += 'M' + (c + quiet) + ' ' + (r + quiet) + 'h1v1h-1z';
    }
  }
  return '<svg class="qr" viewBox="0 0 ' + dim + ' ' + dim + '" width="' + size + '" height="' + size + '" ' +
    'shape-rendering="crispEdges" role="img" aria-label="QR"><rect width="' + dim + '" height="' + dim +
    '" fill="#fff"/><path d="' + d + '" fill="#0F172A"/></svg>';
}

/* --------------------------------------------------------------------------
   Çizimler
   -------------------------------------------------------------------------- */

let _sealSeq = 0;

/** Mürekkep filtresi: doku + hafif titreme. Her SVG kendi kimliğini taşır. */
function inkDefs(id) {
  return '<defs>' +
    '<filter id="ink' + id + '" x="-6%" y="-6%" width="112%" height="112%">' +
      '<feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="n"/>' +
      '<feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.15 1.55" result="grain"/>' +
      '<feComposite in="SourceGraphic" in2="grain" operator="in" result="worn"/>' +
      '<feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="1" seed="3" result="w"/>' +
      '<feDisplacementMap in="worn" in2="w" scale="1.4" xChannelSelector="R" yChannelSelector="G"/>' +
    '</filter>' +
  '</defs>';
}

/** Latin olmayan (Arap harfli) metin var mı — halka yazısı için. */
function hasArabicScript(s) { return /[؀-ۿ]/.test(String(s || '')); }

/** Metni ölçüye sığdır: uzun adlar küçülsün, kısa adlar taşmasın. */
function fitLen(s, maxLen, width) { return s.length > maxLen ? ' textLength="' + width + '" lengthAdjust="spacingAndGlyphs"' : ''; }

/**
 * Yuvarlak resmî mühür.
 * Halka: Latin yazı (ad Latin değilse NETSTORE) üstte, vergi no altta.
 * Merkez: işletme adı (seçili dil), amblem, “RESMİ MÜHÜR”, telefon.
 */
function sealSvg(opts) {
  const id = ++_sealSeq;
  const o = opts || {};
  const name = o.name || bizName();
  const ring = hasArabicScript(name) ? 'NETSTORE' : name.toUpperCase();
  const ringBottom = o.sub || (setting('tax') ? String(setting('tax')).toUpperCase() : 'NETSTORE');
  const word = t('inv_seal_word');
  const phone = String(setting('phone') || '');
  const color = o.color || '#3B2DB3';
  const size = o.size || 150;
  const rtl = typeof lang === 'function' && lang() === 'fa';

  /* Halka yazıları: üst yay saat 9→3 (üstten), alt yay saat 3→9 (alttan). */
  return '<svg class="seal" viewBox="0 0 200 200" width="' + size + '" height="' + size + '" role="img" aria-label="' + esc(word) + '">' +
    inkDefs(id) +
    '<defs>' +
      '<path id="sealTop' + id + '" d="M 30 100 A 70 70 0 0 1 170 100"/>' +
      '<path id="sealBot' + id + '" d="M 170 100 A 70 70 0 0 1 30 100"/>' +
    '</defs>' +
    '<g filter="url(#ink' + id + ')" fill="none" stroke="' + color + '" style="color:' + color + '">' +
      '<circle cx="100" cy="100" r="94" stroke-width="3.2"/>' +
      '<circle cx="100" cy="100" r="88" stroke-width="1.1"/>' +
      '<circle cx="100" cy="100" r="54" stroke-width="1.6"/>' +
      /* halka yazıları */
      '<text fill="' + color + '" stroke="none" font-size="13.5" font-weight="800" letter-spacing="2.2" font-family="Inter, Arial, sans-serif">' +
        '<textPath href="#sealTop' + id + '" startOffset="50%" text-anchor="middle">' + esc(ring) + '</textPath>' +
      '</text>' +
      '<text fill="' + color + '" stroke="none" font-size="11" font-weight="700" letter-spacing="2.6" font-family="Inter, Arial, sans-serif">' +
        '<textPath href="#sealBot' + id + '" startOffset="50%" text-anchor="middle">' + esc(ringBottom) + '</textPath>' +
      '</text>' +
      /* yıldız ayraçlar */
      '<text x="24" y="105" fill="' + color + '" stroke="none" font-size="13" text-anchor="middle">✦</text>' +
      '<text x="176" y="105" fill="' + color + '" stroke="none" font-size="13" text-anchor="middle">✦</text>' +
      /* amblem: altıgen içinde şimşek — elektronik */
      '<g transform="translate(100 74)">' +
        '<polygon points="0,-15 13,-7.5 13,7.5 0,15 -13,7.5 -13,-7.5" stroke-width="1.6"/>' +
        '<polygon points="2,-10 -6,1.5 -0.5,1.5 -2,10 6,-1.5 0.5,-1.5" fill="' + color + '" stroke="none"/>' +
      '</g>' +
      /* merkez yazılar */
      '<text x="100" y="109" fill="' + color + '" stroke="none" font-size="' + (name.length > 18 ? 10.5 : 13) + '" font-weight="800" text-anchor="middle"' +
        (rtl ? ' direction="rtl"' : '') + fitLen(name, 16, 92) + '>' + esc(name) + '</text>' +
      '<line x1="58" y1="118" x2="142" y2="118" stroke-width="0.9"/>' +
      '<text x="100" y="131" fill="' + color + '" stroke="none" font-size="9" font-weight="700" letter-spacing="' + (rtl ? '0' : '1.6') + '" text-anchor="middle"' +
        (rtl ? ' direction="rtl"' : '') + '>' + esc(word) + '</text>' +
      '<text x="100" y="144" fill="' + color + '" stroke="none" font-size="8.5" font-weight="600" text-anchor="middle" font-family="Inter, Arial, sans-serif" direction="ltr">' + esc(phone) + '</text>' +
    '</g>' +
  '</svg>';
}

/** Dikdörtgen kaşe: çift çerçeve, iri yazı, altında tarih. tone: success|warning|danger|info */
function stampSvg(text, tone, sub) {
  const id = ++_sealSeq;
  const colors = { success: '#15803D', warning: '#B45309', danger: '#B91C1C', info: '#3B2DB3' };
  const color = colors[tone] || colors.info;
  const rtl = typeof lang === 'function' && lang() === 'fa';
  const long = text.length > 12;
  return '<svg class="stamp" viewBox="0 0 260 96" width="200" height="74" role="img" aria-label="' + esc(text) + '">' +
    inkDefs(id) +
    '<g filter="url(#ink' + id + ')" fill="none" stroke="' + color + '">' +
      '<rect x="4" y="4" width="252" height="88" rx="9" stroke-width="4"/>' +
      '<rect x="12" y="12" width="236" height="72" rx="6" stroke-width="1.4"/>' +
      '<text x="130" y="' + (sub ? 50 : 60) + '" fill="' + color + '" stroke="none" font-size="' + (long ? 22 : 30) + '" font-weight="900" ' +
        'letter-spacing="' + (rtl ? '0' : long ? '1' : '3') + '" text-anchor="middle"' + (rtl ? ' direction="rtl"' : '') +
        (text.length > 16 ? ' textLength="220" lengthAdjust="spacingAndGlyphs"' : '') + '>' + esc(text) + '</text>' +
      (sub ? '<text x="130" y="74" fill="' + color + '" stroke="none" font-size="12.5" font-weight="700" letter-spacing="1.5" text-anchor="middle" font-family="Inter, Arial, sans-serif" direction="ltr">' + esc(sub) + '</text>' : '') +
    '</g>' +
  '</svg>';
}

/** Satış durumuna göre kaşe metni ve tonu. */
function saleStamp(sale) {
  const s = saleStatus(sale);
  const map = { paid: ['stamp_paid', 'success'], partial: ['stamp_partial', 'warning'],
                pending: ['stamp_pending', 'info'], late: ['stamp_late', 'danger'] };
  const m = map[s.key] || map.pending;
  return { text: t(m[0]), tone: m[1] };
}

/**
 * Güvenlik şeridi: iç içe geçen ince dalgalar (gilyoş). Fotokopide
 * bulanıklaşır, deseni elle çizmek pratikte mümkün değildir.
 */
function bandSvg(color) {
  const c = color || '#7C3AED';
  const W = 1000, H = 28;
  let paths = '';
  const waves = [[9, 3.0, 0], [9, 3.0, Math.PI], [7, 4.5, 1.1], [7, 4.5, 1.1 + Math.PI], [5, 6.0, 2.3], [5, 6.0, 2.3 + Math.PI]];
  waves.forEach((w, i) => {
    const amp = w[0], freq = w[1], ph = w[2];
    let d = '';
    for (let x = 0; x <= W; x += 4) {
      const y = H / 2 + amp * Math.sin((x / W) * Math.PI * 2 * freq + ph) * Math.cos((x / W) * Math.PI * 2 * 0.5 + i);
      d += (x === 0 ? 'M' : 'L') + x + ' ' + y.toFixed(2);
    }
    paths += '<path d="' + d + '" stroke-width="' + (i % 2 ? 0.55 : 0.8) + '" opacity="' + (0.55 + (i % 3) * 0.15) + '"/>';
  });
  return '<svg class="band" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true">' +
    '<g fill="none" stroke="' + c + '">' + paths + '</g></svg>';
}

/** Mikro yazı: büyütmeden okunmayan tekrar satırı. */
function microtextSvg(text, color) {
  const rep = (' ' + text + ' ·').repeat(14);
  return '<svg class="micro" viewBox="0 0 1000 8" preserveAspectRatio="none" aria-hidden="true">' +
    '<text x="0" y="6.2" font-size="5.2" font-weight="700" letter-spacing="0.6" fill="' + (color || '#94A3B8') +
    '" font-family="Inter, Arial, sans-serif" textLength="1000" lengthAdjust="spacingAndGlyphs">' + esc(rep) + '</text></svg>';
}

/** Çapraz “KOPYA” filigranı; yalnız .sheet.copy açıkken görünür. */
function watermarkSvg(text) {
  return '<svg class="wm" viewBox="0 0 400 400" aria-hidden="true">' +
    '<text x="200" y="215" text-anchor="middle" font-size="72" font-weight="900" letter-spacing="6" fill="#B91C1C" ' +
    'opacity="0.13" transform="rotate(-32 200 200)">' + esc(text) + '</text></svg>';
}

/* --------------------------------------------------------------------------
   Belge parçaları (invoice.js buradan çağırır)
   -------------------------------------------------------------------------- */

/** Karekod + kod + açıklama şeridi. */
function verifyStrip(qrText, code) {
  return '<div class="sheet-verify">' +
    qrSvg(qrText, 92) +
    '<div class="sheet-verify-text">' +
      '<div class="sheet-verify-label">' + esc(t('inv_verify_code')) + '</div>' +
      '<div class="sheet-verify-code mono">' + esc(code) + '</div>' +
      '<div class="sheet-verify-hint">' + esc(t('inv_verify_hint')) + '</div>' +
    '</div>' +
  '</div>' + microtextSvg('NETSTORE · ' + t('inv_original') + ' · ' + code);
}

/* --------------------------------------------------------------------------
   Doğrulama aracı (Faturalar → Belge Doğrula)
   -------------------------------------------------------------------------- */

function verifyModal() {
  openModal(
    '<div class="card-head"><div><h3>' + esc(t('vf_title')) + '</h3>' +
      '<p class="sub">' + esc(t('vf_hint')) + '</p></div>' +
    '<div class="head-actions"><button class="btn btn-ghost btn-sm btn-icon" data-act="close-modal" ' +
      'aria-label="' + esc(t('aria_close')) + '">' + icon('x') + '</button></div></div>' +
    '<div class="card-body"><div class="field-grid">' +
      '<div class="field field-half"><label for="vfNo">' + esc(t('inv_no')) + '</label>' +
        '<input type="text" id="vfNo" placeholder="FT-202609-0001" autocomplete="off" spellcheck="false"></div>' +
      '<div class="field field-half"><label for="vfCode">' + esc(t('inv_verify_code')) + '</label>' +
        '<input type="text" id="vfCode" placeholder="XXXX-XXXX" autocomplete="off" spellcheck="false" class="mono"></div>' +
    '</div><div id="vfResult"></div></div>' +
    '<div class="modal-foot">' +
      '<button class="btn btn-ghost" data-act="close-modal">' + esc(t('btn_cancel')) + '</button>' +
      '<button class="btn btn-primary" data-act="verify-run">' + icon('shield') + esc(t('vf_check')) + '</button>' +
    '</div>'
  );
}

function runVerify() {
  const noEl = document.getElementById('vfNo'), codeEl = document.getElementById('vfCode');
  const out = document.getElementById('vfResult');
  if (!noEl || !out) return;
  const r = verifyDoc(noEl.value, codeEl ? codeEl.value : '');
  let html = '';
  if (r.state === 'none') {
    html = '<div class="alert alert-danger">' + icon('alert') + '<div><strong>' + esc(t('vf_not_found')) + '</strong></div></div>';
  } else {
    const st = saleTotals(r.sale), c = customerById(r.sale.customerId);
    const facts =
      '<table class="vf-facts"><tbody>' +
        '<tr><td>' + esc(t('inv_no')) + '</td><td class="e mono">' + esc(r.sale.no) + '</td></tr>' +
        '<tr><td>' + esc(t('inv_date')) + '</td><td class="e">' + fmtDate(r.sale.date) + '</td></tr>' +
        '<tr><td>' + esc(t('c_customer')) + '</td><td class="e">' + esc(customerName(c)) + '</td></tr>' +
        '<tr><td>' + esc(t('inv_grand')) + '</td><td class="e"><b>' + money(st.total) + '</b></td></tr>' +
        '<tr><td>' + esc(t('inv_paid')) + '</td><td class="e">' + money(st.paid) + '</td></tr>' +
        (r.payment ? '<tr><td>' + esc(t('inv_receipt')) + '</td><td class="e"><b>' + money(r.payment.amount) + '</b> · ' + fmtDate(r.payment.date) + '</td></tr>' : '') +
        '<tr><td>' + esc(t('c_status')) + '</td><td class="e">' + statusBadge(saleStatus(r.sale)) + '</td></tr>' +
      '</tbody></table>';
    if (r.state === 'ok') {
      html = '<div class="alert alert-success">' + icon('check') + '<div><strong>' +
        esc(r.kind === 'receipt' ? t('vf_ok_receipt')
          : r.kind === 'warranty' ? t('vf_ok_warranty') : t('vf_ok')) + '</strong></div></div>' + facts;
    } else {
      html = '<div class="alert alert-danger">' + icon('alert') + '<div><strong>' + esc(t('vf_bad_code')) + '</strong>' +
        '<span class="alert-text">' + esc(t('vf_compare')) + '</span></div></div>' + facts;
    }
    html += '<div class="vf-actions"><button class="btn btn-ghost btn-sm" data-act="verify-open" data-id="' + esc(r.sale.id) + '">' +
      icon('invoice') + esc(t('btn_invoice')) + '</button></div>';
  }
  out.innerHTML = html;
  if (typeof hydrateIcons === 'function') hydrateIcons(out);
}
