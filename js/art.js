/* ==========================================================================
   NetStore — çizimler

   Arayüzde kullanılan elle çizilmiş SVG resimler; hepsi kodla üretilir,
   dosya yüklenmez, tema ve dile göre renk alır:

   · catArt(cat)     — ürün kategorisi için renkli küçük resim (telefon,
                       bilgisayar, aksesuar, ekran). Tablo satırlarında.
   · emptyArt(kind)  — boş liste sahneleri: raf, sepet, müşteriler, cüzdan,
                       hareket, genel.
   · shopArt()       — dükkân vitrini: dashboard karşılama şeridi ve giriş
                       ekranı.
   Kimlikler her çizimde benzersizdir (aynı sayfada birden çok kopya olur).
   ========================================================================== */

let _artSeq = 0;
function artId(p) { return p + (++_artSeq); }

/* Kategori renkleri: tema bağımsız, koyu/açık ikisinde de doygun. */
const CAT_TONES = {
  phone:     ['#7C3AED', '#3B82F6'],
  computer:  ['#06B6D4', '#0EA5E9'],
  accessory: ['#F59E0B', '#EC4899'],
  display:   ['#10B981', '#06B6D4'],
  wearable:  ['#F43F5E', '#8B5CF6'],
  other:     ['#64748B', '#94A3B8']
};

/* Kategori çizimleri — 40×40 kutu, beyaz çizgi, yuvarlak uçlar. */
const CAT_SHAPES = {
  phone:
    '<rect x="13" y="7" width="14" height="26" rx="3.2"/>' +
    '<path d="M17.5 10.5h5"/>' +
    '<circle cx="20" cy="29.2" r="1" fill="#fff" stroke="none"/>' +
    '<path d="M16 14h8v10h-8z" opacity="0.55"/>',
  computer:
    '<rect x="9" y="10" width="22" height="14" rx="2"/>' +
    '<path d="M6 28.5h28"/>' +
    '<path d="M16 28.5v-2h8v2" opacity="0.7"/>' +
    '<path d="M13 14h9" opacity="0.55"/>',
  accessory:
    '<path d="M11 9c0 6 3 6 3 11s-3 5-3 10" opacity="0.8"/>' +
    '<rect x="19" y="18" width="13" height="13" rx="3.2"/>' +
    '<path d="M23 12v6M28 12v6"/>' +
    '<path d="M26.6 21.5l-2.6 3.4h3.2l-2.6 3.4" opacity="0.95"/>',
  display:
    '<rect x="7" y="9" width="26" height="17" rx="2.2"/>' +
    '<path d="M20 26v5M14 31.5h12"/>' +
    '<path d="M11 13h10" opacity="0.55"/>' +
    '<path d="M11 17.5h6" opacity="0.4"/>',
  wearable:
    '<rect x="12" y="12" width="16" height="16" rx="4.5"/>' +
    '<path d="M15 12V7.5a1.5 1.5 0 0 1 1.5-1.5h7A1.5 1.5 0 0 1 25 7.5V12M15 28v4.5a1.5 1.5 0 0 0 1.5 1.5h7a1.5 1.5 0 0 0 1.5-1.5V28"/>' +
    '<path d="M20 16.5v3.5l2.5 1.5" opacity="0.95"/>' +
    '<path d="M29.5 17.5v5" opacity="0.7"/>',
  other:
    '<path d="M8 14l12-6 12 6-12 6z"/>' +
    '<path d="M8 14v12l12 6 12-6V14"/>' +
    '<path d="M20 20v12" opacity="0.7"/>'
};

/** Kategori küçük resmi: gradyan zemin + beyaz çizgi. size: piksel. */
function catArt(cat, size) {
  const key = CAT_SHAPES[cat] ? cat : 'other';
  const tone = CAT_TONES[key];
  const g = artId('cg');
  return '<svg class="cat-art cat-' + key + '" viewBox="0 0 40 40" width="' + (size || 36) + '" height="' + (size || 36) +
    '" aria-hidden="true">' +
    '<defs><linearGradient id="' + g + '" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="' + tone[0] + '"/><stop offset="1" stop-color="' + tone[1] + '"/>' +
    '</linearGradient></defs>' +
    '<rect width="40" height="40" rx="11" fill="url(#' + g + ')"/>' +
    '<circle cx="31" cy="9" r="9" fill="#fff" opacity="0.14"/>' +
    '<g fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + CAT_SHAPES[key] + '</g>' +
  '</svg>';
}

/* --------------------------------------------------------------------------
   Boş liste sahneleri — 160×110
   -------------------------------------------------------------------------- */

function artDefs(id) {
  return '<defs>' +
    '<linearGradient id="' + id + 'a" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="#A78BFA"/><stop offset="1" stop-color="#22D3EE"/>' +
    '</linearGradient>' +
    '<radialGradient id="' + id + 'glow" cx="50%" cy="50%" r="50%">' +
      '<stop offset="0" stop-color="#7C3AED" stop-opacity="0.35"/><stop offset="1" stop-color="#7C3AED" stop-opacity="0"/>' +
    '</radialGradient>' +
  '</defs>';
}

/** Parıltı: küçük dört köşeli yıldız; CSS ile yanıp söner. */
function sparkle(x, y, s, delay) {
  return '<path class="spark" style="animation-delay:' + (delay || 0) + 'ms" d="M' + x + ' ' + (y - s) +
    'q0 ' + s + ' ' + s + ' ' + s + 'q-' + s + ' 0 -' + s + ' ' + s + 'q0 -' + s + ' -' + s + ' -' + s + 'q' + s + ' 0 ' + s + ' -' + s + 'z" fill="#FBBF24"/>';
}

const EMPTY_SCENES = {
  /* raf ve kutular */
  products: function (u) {
    return '<path d="M30 78h100M30 52h100" stroke="url(#' + u + 'a)"/>' +
      '<path d="M36 52v26M124 52v26" stroke="url(#' + u + 'a)" opacity="0.5"/>' +
      '<rect x="44" y="58" width="20" height="20" rx="3" stroke="url(#' + u + 'a)"/>' +
      '<rect x="70" y="62" width="24" height="16" rx="3" stroke="url(#' + u + 'a)"/>' +
      '<rect x="100" y="56" width="16" height="22" rx="3" stroke="url(#' + u + 'a)"/>' +
      '<path d="M44 66h20M70 70h24M100 64h16" stroke="url(#' + u + 'a)" opacity="0.5"/>' +
      '<rect x="48" y="30" width="22" height="18" rx="3" stroke="url(#' + u + 'a)" stroke-dasharray="3 3"/>' +
      '<path d="M59 34v10M54 39h10" stroke="#FBBF24" stroke-width="2.2"/>' +
      sparkle(92, 36, 3, 0) + sparkle(112, 44, 2.2, 700) + sparkle(36, 44, 2, 1300);
  },
  /* sepet */
  sales: function (u) {
    return '<path d="M34 34h10l9 34h44l8-24H50" stroke="url(#' + u + 'a)"/>' +
      '<circle cx="60" cy="80" r="4.5" stroke="url(#' + u + 'a)"/>' +
      '<circle cx="92" cy="80" r="4.5" stroke="url(#' + u + 'a)"/>' +
      '<path d="M62 52h30M66 60h22" stroke="url(#' + u + 'a)" opacity="0.5"/>' +
      '<circle cx="116" cy="40" r="9" stroke="url(#' + u + 'a)"/>' +
      '<path d="M116 35v10M111 40h10" stroke="#FBBF24" stroke-width="2.2"/>' +
      sparkle(40, 24, 2.4, 300) + sparkle(104, 22, 3, 900);
  },
  /* iki kişi */
  customers: function (u) {
    return '<circle cx="66" cy="42" r="11" stroke="url(#' + u + 'a)"/>' +
      '<path d="M44 82c2-14 10-20 22-20s20 6 22 20" stroke="url(#' + u + 'a)"/>' +
      '<circle cx="98" cy="46" r="9" stroke="url(#' + u + 'a)" opacity="0.7"/>' +
      '<path d="M86 82c1-11 6-17 12-17s11 6 12 17" stroke="url(#' + u + 'a)" opacity="0.7"/>' +
      '<path d="M104 22h22a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4h-10l-6 5v-5h-6a4 4 0 0 1-4-4v-8a4 4 0 0 1 4-4z" stroke="url(#' + u + 'a)"/>' +
      '<path d="M110 29h12M110 33h8" stroke="url(#' + u + 'a)" opacity="0.5"/>' +
      sparkle(40, 36, 2.4, 500);
  },
  /* cüzdan ve madeni para */
  payments: function (u) {
    return '<rect x="40" y="40" width="70" height="42" rx="7" stroke="url(#' + u + 'a)"/>' +
      '<path d="M40 52h70" stroke="url(#' + u + 'a)" opacity="0.5"/>' +
      '<rect x="92" y="58" width="18" height="12" rx="3" stroke="url(#' + u + 'a)"/>' +
      '<circle cx="101" cy="64" r="2" fill="#FBBF24"/>' +
      '<path d="M48 40v-6a5 5 0 0 1 5-5h44" stroke="url(#' + u + 'a)" opacity="0.6"/>' +
      '<circle cx="120" cy="34" r="10" stroke="#FBBF24" stroke-width="2"/>' +
      '<path d="M116 34l3 3 5-6" stroke="#FBBF24" stroke-width="2.2"/>' +
      sparkle(32, 30, 2.4, 200) + sparkle(134, 52, 2, 1000);
  },
  /* hareket: düz çizgi ve saat */
  moves: function (u) {
    return '<path d="M30 74h100" stroke="url(#' + u + 'a)" opacity="0.4" stroke-dasharray="4 4"/>' +
      '<path d="M34 66l18-10 14 6 16-16 14 8 12-12 14 10" stroke="url(#' + u + 'a)"/>' +
      '<circle cx="66" cy="62" r="2.6" fill="#22D3EE"/>' +
      '<circle cx="96" cy="54" r="2.6" fill="#22D3EE"/>' +
      '<circle cx="118" cy="30" r="10" stroke="url(#' + u + 'a)"/>' +
      '<path d="M118 24v6l4 3" stroke="#FBBF24" stroke-width="2"/>' +
      sparkle(40, 36, 2.4, 400);
  },
  /* genel: klasör ve büyüteç */
  default: function (u) {
    return '<path d="M36 40a4 4 0 0 1 4-4h20l6 6h50a4 4 0 0 1 4 4v32a4 4 0 0 1-4 4H40a4 4 0 0 1-4-4z" stroke="url(#' + u + 'a)" stroke-dasharray="4 3"/>' +
      '<circle cx="104" cy="70" r="11" stroke="url(#' + u + 'a)"/>' +
      '<path d="M112 78l10 10" stroke="url(#' + u + 'a)" stroke-width="2.6"/>' +
      '<path d="M50 56h30M50 64h20" stroke="url(#' + u + 'a)" opacity="0.5"/>' +
      sparkle(128, 34, 2.6, 300);
  }
};

/** Boş liste sahnesi. kind: products | sales | customers | payments | moves | default */
function emptyArt(kind) {
  const draw = EMPTY_SCENES[kind] || EMPTY_SCENES.default;
  const u = artId('ea');
  return '<svg class="empty-art" viewBox="0 0 160 110" width="176" height="121" aria-hidden="true">' +
    artDefs(u) +
    '<ellipse cx="80" cy="60" rx="66" ry="40" fill="url(#' + u + 'glow)"/>' +
    '<ellipse cx="80" cy="94" rx="46" ry="5" fill="#7C3AED" opacity="0.14"/>' +
    '<g fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + draw(u) + '</g>' +
  '</svg>';
}

/* --------------------------------------------------------------------------
   Dükkân vitrini — 240×130
   -------------------------------------------------------------------------- */

function shopArt(label) {
  const u = artId('sh');
  const name = label || 'NetStore';
  /* tente: 6 kavisli parça */
  let awning = 'M40 44';
  for (let i = 0; i < 6; i++) awning += ' q13 10 26 0';
  return '<svg class="shop-art" viewBox="0 0 240 130" width="240" height="130" aria-hidden="true">' +
    artDefs(u) +
    '<defs><linearGradient id="' + u + 'b" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#7C3AED" stop-opacity="0.35"/><stop offset="1" stop-color="#22D3EE" stop-opacity="0.08"/>' +
    '</linearGradient></defs>' +
    '<ellipse cx="120" cy="66" rx="100" ry="54" fill="url(#' + u + 'glow)"/>' +
    '<g fill="none" stroke="url(#' + u + 'a)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
      /* zemin */
      '<path d="M22 112h196" opacity="0.5"/>' +
      /* gövde */
      '<path d="M40 44v68M200 44v68"/>' +
      /* tabela */
      '<rect x="46" y="18" width="148" height="20" rx="5" fill="url(#' + u + 'b)"/>' +
      /* tente */
      '<path d="' + awning + '" fill="url(#' + u + 'b)"/>' +
      '<path d="M40 44h160" opacity="0.6"/>' +
      /* vitrin */
      '<rect x="52" y="60" width="86" height="52" rx="3" fill="url(#' + u + 'b)"/>' +
      '<path d="M52 86h86" opacity="0.35"/>' +
      /* vitrindeki cihazlar */
      '<rect x="62" y="68" width="12" height="20" rx="2"/>' +
      '<rect x="82" y="72" width="30" height="16" rx="2"/>' +
      '<path d="M78 92h38" opacity="0.7"/>' +
      '<rect x="118" y="70" width="14" height="18" rx="2"/>' +
      '<path d="M100 96h16M108 92v4" opacity="0.6"/>' +
      /* kapı */
      '<rect x="150" y="60" width="40" height="52" rx="3" fill="url(#' + u + 'b)"/>' +
      '<circle cx="182" cy="88" r="2" fill="#FBBF24" stroke="none"/>' +
      '<path d="M150 66h40" opacity="0.35"/>' +
    '</g>' +
    /* tabela yazısı */
    '<text x="120" y="32" text-anchor="middle" font-size="11" font-weight="800" letter-spacing="1.5" fill="#fff" opacity="0.92" font-family="Inter, Arial, sans-serif">' + esc(name) + '</text>' +
    sparkle(214, 30, 3, 0) + sparkle(30, 58, 2.2, 800) + sparkle(228, 74, 2, 1500) +
  '</svg>';
}
