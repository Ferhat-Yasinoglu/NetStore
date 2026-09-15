/* ==========================================================================
   NetStore — grafikler

   Bağımlılıksız SVG. İnce marklar, hairline (kesiksiz) grid, seçici etiket,
   iki seriden itibaren daima legend, hover'da crosshair + tooltip.
   Seri renkleri CVD ve kontrast açısından doğrulanmıştır.

   Renkler CSS tokenlarından okunur (readChartTheme): tema değişince grafik
   de değişsin diye. SVG'nin içine yazılan renk, sonradan CSS ile
   düzeltilemez — bu yüzden her çizimden önce tokenlar tazelenir.

   Eğriler monoton kübik (Fritsch–Carlson) ile yumuşatılır: klasik
   Catmull-Rom sıfır değerlerin altına taşıp "eksi satış" gibi görünüyordu;
   monoton yorumlama veri noktaları arasında asla taşmaz.
   ========================================================================== */

/* Tema tokenları okunana kadar geçerli olan koyu tema değerleri. */
let SERIES_1 = '#A78BFA';  /* Satış */
let SERIES_2 = '#34D399';  /* Kâr   */
let GRID     = 'rgba(148,163,184,0.12)';
let AXIS_INK = '#64748B';
let SURFACE  = '#0F1626';
let GAUGE_TO = '#A7F3D0';

/** Grafik renklerini CSS tokenlarından tazeler. render() her çizimde çağırır. */
function readChartTheme() {
  let cs;
  try { cs = getComputedStyle(document.documentElement); } catch (e) { return; }

  const read = function (name, fallback) {
    const v = (cs.getPropertyValue(name) || '').trim();
    return v || fallback;
  };

  SERIES_1 = read('--series-1', SERIES_1);
  SERIES_2 = read('--series-2', SERIES_2);
  GRID     = read('--grid', GRID);
  AXIS_INK = read('--axis-ink', AXIS_INK);
  SURFACE  = read('--chart-surface', SURFACE);
  GAUGE_TO = read('--gauge-to', GAUGE_TO);
}

/* --- yardımcılar --- */
function niceCeil(v) {
  if (v <= 0) return 10;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / mag;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * mag;
}
function shortMoney(v) {
  if (Math.abs(v) >= 1000) return (v / 1000).toFixed(v % 1000 === 0 ? 0 : 1).replace('.', ',') + 'k';
  return String(Math.round(v));
}
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Her çizimde benzersiz kimlik — aynı sayfadaki iki grafik gradyan çalmasın. */
let _gidSeq = 0;
function gid(prefix) { return prefix + (++_gidSeq) + Math.random().toString(36).slice(2, 6); }

function f1(n) { return Number(n).toFixed(1); }

/**
 * Monoton kübik eğri. Veri noktalarından geçer, aralarında taşmaz.
 * pts: [[x, y], …] — x artan sırada.
 */
function smoothPath(pts) {
  const n = pts.length;
  if (!n) return '';
  if (n === 1) return 'M' + f1(pts[0][0]) + ' ' + f1(pts[0][1]);

  const dx = [], slope = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1][0] - pts[i][0];
    slope[i] = dx[i] === 0 ? 0 : (pts[i + 1][1] - pts[i][1]) / dx[i];
  }

  const tan = [slope[0]];
  for (let i = 1; i < n - 1; i++) {
    if (slope[i - 1] * slope[i] <= 0) { tan[i] = 0; continue; }
    const w1 = 2 * dx[i] + dx[i - 1];
    const w2 = dx[i] + 2 * dx[i - 1];
    tan[i] = (w1 + w2) / (w1 / slope[i - 1] + w2 / slope[i]);
  }
  tan[n - 1] = slope[n - 2];

  let d = 'M' + f1(pts[0][0]) + ' ' + f1(pts[0][1]);
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ' C' + f1(pts[i][0] + h) + ' ' + f1(pts[i][1] + tan[i] * h) +
         ',' + f1(pts[i + 1][0] - h) + ' ' + f1(pts[i + 1][1] - tan[i + 1] * h) +
         ',' + f1(pts[i + 1][0]) + ' ' + f1(pts[i + 1][1]);
  }
  return d;
}

/** Çizgilerin kendini çizmesi: uzunluğu ölçüp CSS'e verir, sınıfı ekler. */
function armDraw(host) {
  const wrap = host.querySelector('.chart-wrap');
  if (!wrap) return;

  try {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  } catch (e) { /* eski tarayıcı: animasyon kalsın */ }

  wrap.querySelectorAll('.lc-line').forEach(function (path) {
    let len = 0;
    try { len = path.getTotalLength(); } catch (e) { return; }
    if (len) path.style.setProperty('--len', Math.ceil(len));
  });
  wrap.classList.add('draw');
}

/* --------------------------------------------------------------------------
   Sparkline — KPI kartlarındaki küçük eğilim göstergesi.
   Tek seri, eksen yok: kartın rakamı zaten değeri söylüyor.
   -------------------------------------------------------------------------- */
function sparkline(values, color, w, h) {
  w = w || 104; h = h || 34;
  if (!values || values.length < 2) return '';

  const min = Math.min.apply(null, values);
  const max = Math.max.apply(null, values);
  const span = (max - min) || 1;
  const pad = 4;
  const step = (w - pad * 2) / (values.length - 1);

  const pts = values.map(function (v, i) {
    return [pad + i * step, h - pad - ((v - min) / span) * (h - pad * 2)];
  });

  const line = smoothPath(pts);
  const area = line + ' L' + f1(pts[pts.length - 1][0]) + ' ' + h + ' L' + f1(pts[0][0]) + ' ' + h + ' Z';
  const last = pts[pts.length - 1];
  const g = gid('sp'), gl = gid('spg');

  return '<svg class="spark" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h +
         '" fill="none" aria-hidden="true">' +
    '<defs>' +
      '<linearGradient id="' + g + '" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="' + color + '" stop-opacity="0.34"/>' +
        '<stop offset="100%" stop-color="' + color + '" stop-opacity="0"/>' +
      '</linearGradient>' +
      /* çizginin altındaki yumuşak ışık — koyu zeminde derinlik verir */
      '<filter id="' + gl + '" x="-30%" y="-60%" width="160%" height="240%">' +
        '<feGaussianBlur stdDeviation="2.2" result="b"/>' +
        '<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>' +
      '</filter>' +
    '</defs>' +
    '<path d="' + area + '" fill="url(#' + g + ')"/>' +
    '<path d="' + line + '" stroke="' + color + '" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round" filter="url(#' + gl + ')"/>' +
    /* uç nokta: 2px yüzey halkası ile ayrışır */
    '<circle cx="' + f1(last[0]) + '" cy="' + f1(last[1]) + '" r="2.8" fill="' + color +
      '" stroke="' + SURFACE + '" stroke-width="2"/>' +
  '</svg>';
}

/* --------------------------------------------------------------------------
   Çizgi/alan grafiği — aylık satış ve kâr.
   Tek y ekseni (iki ölçek asla yan yana çizilmez).
   -------------------------------------------------------------------------- */
function lineChart(host, opts) {
  const data = opts.data;
  const series = opts.series;                 // [{key, name, color}]
  if (!host || !data || !data.length) return;

  const W = 760, H = 258;
  const m = { t: 16, r: 16, b: 32, l: 48 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;

  let max = 0;
  data.forEach(function (d) { series.forEach(function (s) { if (d[s.key] > max) max = d[s.key]; }); });
  const top = niceCeil(max * 1.12) || 10;

  const x = function (i) { return m.l + (data.length === 1 ? iw / 2 : (i / (data.length - 1)) * iw); };
  const y = function (v) { return m.t + ih - (v / top) * ih; };

  const TICKS = 4;
  let grid = '', yLabels = '';
  for (let i = 0; i <= TICKS; i++) {
    const v = (top / TICKS) * i, gy = y(v);
    grid += '<line x1="' + m.l + '" y1="' + f1(gy) + '" x2="' + (W - m.r) +
            '" y2="' + f1(gy) + '" stroke="' + GRID + '" stroke-width="1"' +
            (i ? ' stroke-dasharray="3 5"' : '') + '/>';
    yLabels += '<text x="' + (m.l - 10) + '" y="' + f1(gy + 3.5) +
               '" text-anchor="end" font-size="10.5" fill="' + AXIS_INK + '">' + shortMoney(v) + '</text>';
  }

  let xLabels = '';
  const skip = data.length > 8 ? 2 : 1;
  data.forEach(function (d, i) {
    if (i % skip !== 0 && i !== data.length - 1) return;
    xLabels += '<text x="' + f1(x(i)) + '" y="' + (H - 10) +
               '" text-anchor="middle" font-size="10.5" fill="' + AXIS_INK + '">' +
               esc(d.ref ? monthShort(d.ref) : d.label) + '</text>';
  });

  let defs = '', paths = '', dots = '';
  series.forEach(function (s, si) {
    const pts = data.map(function (d, i) { return [x(i), y(d[s.key])]; });
    const line = smoothPath(pts);
    const gArea = gid('la'), gLine = gid('ll'), gGlow = gid('lg');

    defs +=
      '<linearGradient id="' + gArea + '" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="' + s.color + '" stop-opacity="' + (si === 0 ? '0.30' : '0.14') + '"/>' +
        '<stop offset="100%" stop-color="' + s.color + '" stop-opacity="0"/>' +
      '</linearGradient>' +
      /* çizgi soldan sağa hafifçe açılır: eğilim yönü okunur olsun */
      '<linearGradient id="' + gLine + '" x1="0" y1="0" x2="1" y2="0">' +
        '<stop offset="0%" stop-color="' + s.color + '" stop-opacity="0.55"/>' +
        '<stop offset="100%" stop-color="' + s.color + '" stop-opacity="1"/>' +
      '</linearGradient>' +
      '<filter id="' + gGlow + '" x="-10%" y="-40%" width="120%" height="180%">' +
        '<feGaussianBlur stdDeviation="3.4" result="b"/>' +
        '<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>' +
      '</filter>';

    paths += '<path class="lc-area" d="' + line + ' L' + f1(x(data.length - 1)) + ' ' + (m.t + ih) +
             ' L' + f1(x(0)) + ' ' + (m.t + ih) + ' Z" fill="url(#' + gArea + ')"/>';
    paths += '<path class="lc-line" d="' + line + '" stroke="url(#' + gLine + ')" stroke-width="2.4" fill="none" ' +
             'stroke-linecap="round" stroke-linejoin="round" filter="url(#' + gGlow + ')"/>';

    /* seçici etiket: yalnızca son nokta işaretlenir, etrafında yavaş bir nabız */
    const last = pts[pts.length - 1];
    dots += '<g class="lc-end">' +
      '<circle class="lc-pulse" cx="' + f1(last[0]) + '" cy="' + f1(last[1]) + '" r="4" fill="' + s.color + '"/>' +
      '<circle cx="' + f1(last[0]) + '" cy="' + f1(last[1]) +
      '" r="4.2" fill="' + s.color + '" stroke="' + SURFACE + '" stroke-width="2"/></g>';
  });

  /* hover katmanı */
  let hover = '<g class="lc-hover" style="opacity:0">' +
    '<line class="lc-cross" y1="' + m.t + '" y2="' + (m.t + ih) + '" stroke="' + AXIS_INK +
    '" stroke-width="1" stroke-dasharray="3 4" stroke-opacity="0.75"/>';
  series.forEach(function (s) {
    hover += '<circle class="lc-mk" r="5" fill="' + s.color + '" stroke="' + SURFACE + '" stroke-width="2.5"/>';
  });
  hover += '</g>';

  host.innerHTML =
    '<div class="chart-wrap ltr">' +
      '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" preserveAspectRatio="none" ' +
        'style="height:258px" aria-label="' + esc(opts.aria || 'Aylık satış ve kâr grafiği') + '">' +
        '<defs>' + defs + '</defs>' +
        grid + yLabels + xLabels + paths + dots + hover +
        '<rect class="lc-catch" x="' + m.l + '" y="' + m.t + '" width="' + iw + '" height="' + ih +
        '" fill="transparent" style="cursor:crosshair"/>' +
      '</svg>' +
      '<div class="chart-tip"></div>' +
    '</div>';

  armDraw(host);

  /* --- etkileşim --- */
  const svg   = host.querySelector('svg');
  const wrap  = host.querySelector('.chart-wrap');
  const tip   = host.querySelector('.chart-tip');
  const hoverG= host.querySelector('.lc-hover');
  const cross = host.querySelector('.lc-cross');
  const marks = host.querySelectorAll('.lc-mk');
  const catch_= host.querySelector('.lc-catch');

  function locate(ev) {
    const r = svg.getBoundingClientRect();
    const px = ((ev.clientX - r.left) / r.width) * W;
    let best = 0, bd = Infinity;
    data.forEach(function (d, i) { const dd = Math.abs(x(i) - px); if (dd < bd) { bd = dd; best = i; } });
    return best;
  }

  function show(ev) {
    const i = locate(ev);
    const d = data[i];
    const cx = x(i);

    hoverG.style.opacity = '1';
    cross.setAttribute('x1', cx); cross.setAttribute('x2', cx);
    series.forEach(function (s, si) {
      marks[si].setAttribute('cx', cx);
      marks[si].setAttribute('cy', y(d[s.key]));
    });

    let rows = '';
    series.forEach(function (s) {
      rows += '<div class="tip-row"><span class="legend-swatch" style="background:' + s.color +
              ';color:' + s.color + '"></span>' +
              '<span class="tip-name">' + esc(s.name) + '</span>' +
              '<span class="tip-val">' + money(d[s.key]) + '</span></div>';
    });
    tip.innerHTML = '<div class="tip-title">' +
      esc(d.ref ? monthShort(d.ref) + ' ' + calYear(d.ref) : d.label) +
      '</div>' + rows;
    tip.classList.add('on');

    const wr = wrap.getBoundingClientRect();
    const rel = (cx / W) * wr.width;
    const tw = tip.offsetWidth;
    let left = rel - tw / 2;
    left = Math.max(4, Math.min(wr.width - tw - 4, left));
    tip.style.left = left + 'px';
    tip.style.top  = '6px';
  }

  function hide() {
    hoverG.style.opacity = '0';
    tip.classList.remove('on');
  }

  catch_.addEventListener('pointermove', show);
  catch_.addEventListener('pointerdown', show);
  catch_.addEventListener('pointerleave', hide);
}

/* --------------------------------------------------------------------------
   Yığılmış çubuk — alacak yaşlandırması.
   Parça-bütün ilişkisi; segmentler 2px yüzey boşluğu ile ayrılır.
   Genişlikler satır içi yazılır; motion.js bunları sıfırdan akıtır.
   -------------------------------------------------------------------------- */
function stackedBar(host, segments) {
  const total = segments.reduce(function (s, x) { return s + x.value; }, 0);
  if (!host) return;

  if (total <= 0) {
    host.innerHTML = '<div class="empty">' + icon('check') + '<p>' + esc(t('e_no_balance')) + '</p></div>';
    return;
  }

  let bars = '';
  segments.forEach(function (s) {
    if (s.value <= 0) return;
    bars += '<div class="stack-seg" style="width:' + ((s.value / total) * 100).toFixed(2) + '%;background:' +
            s.color + '" title="' + esc(s.name) + ' · ' + esc(money(s.value)) + '"></div>';
  });

  let legend = '';
  segments.forEach(function (s) {
    legend += '<div class="hbar-row" style="grid-template-columns:auto 1fr auto;gap:0 10px">' +
      '<span class="legend-swatch" style="background:' + s.color + ';color:' + s.color + '"></span>' +
      '<span class="hbar-name" style="font-size:12.5px;font-weight:500">' + esc(s.name) + '</span>' +
      '<span class="hbar-val strong" style="color:var(--text);font-weight:700">' + money(s.value) + '</span>' +
      '</div>';
  });

  host.innerHTML =
    '<div class="stack-bar">' + bars + '</div>' +
    '<div class="hbar aging-legend" style="gap:11px;margin-top:16px">' + legend + '</div>';
}

/* --------------------------------------------------------------------------
   Yatay çubuklar — kategori / ürün kırılımı. Tek seri, tek renk.
   -------------------------------------------------------------------------- */
function hBars(host, rows, color) {
  if (!host) return;
  const max = rows.reduce(function (m, r) { return Math.max(m, r.value); }, 0) || 1;

  host.innerHTML = '<div class="hbar">' + rows.map(function (r) {
    const c = r.color || color || SERIES_1;
    return '<div class="hbar-row">' +
      '<span class="hbar-name">' + esc(r.name) + '</span>' +
      '<span class="hbar-val">' + (r.display || money(r.value)) + '</span>' +
      '<span class="hbar-track"><span class="hbar-fill" style="width:' +
        ((r.value / max) * 100).toFixed(1) + '%;background:' + c + ';color:' + c + '"></span></span>' +
    '</div>';
  }).join('') + '</div>';
}

/* --------------------------------------------------------------------------
   Radyal ölçek — tek bir oranı (tahsilat yüzdesi) tek bakışta verir.
   Yay, çevrenin `ratio` kadarını kaplar; motion.js sıfırdan doldurur.
   -------------------------------------------------------------------------- */
function ringGauge(host, opts) {
  if (!host) return;

  const size = opts.size || 168;
  const stroke = opts.stroke || 13;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, isFinite(opts.ratio) ? opts.ratio : 0));
  const g = gid('rg');

  const from = opts.from || SERIES_2;
  const to = opts.to || GAUGE_TO;

  host.innerHTML =
    '<div class="gauge" style="width:' + size + 'px;height:' + size + 'px">' +
      '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size +
        '" role="img" aria-label="' + esc(opts.aria || '') + '">' +
        '<defs><linearGradient id="' + g + '" x1="0" y1="0" x2="1" y2="1">' +
          '<stop offset="0%" stop-color="' + from + '"/>' +
          '<stop offset="100%" stop-color="' + to + '"/>' +
        '</linearGradient></defs>' +
        /* yuva */
        '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + f1(r) + '" fill="none" ' +
          'stroke="var(--surface-3)" stroke-width="' + stroke + '"/>' +
        /* yay — saat 12'den başlasın diye çeyrek tur geri döndürülür */
        '<circle class="gauge-arc" cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + f1(r) + '" fill="none" ' +
          'stroke="url(#' + g + ')" stroke-width="' + stroke + '" stroke-linecap="round" ' +
          'stroke-dasharray="' + f1(c) + '" data-empty="' + f1(c) + '" ' +
          'style="stroke-dashoffset:' + f1(c * (1 - p)) + '" ' +
          'transform="rotate(-90 ' + size / 2 + ' ' + size / 2 + ')"/>' +
      '</svg>' +
      '<div class="gauge-center">' +
        '<div class="gauge-pct">' + esc(pctPlain(p * 100)) + (lang() === 'fa' ? '٪' : '%') + '</div>' +
        '<div class="gauge-cap">' + esc(opts.caption || '') + '</div>' +
      '</div>' +
    '</div>';
}
