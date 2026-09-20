/* ==========================================================================
   NetStore — fatura ve tahsilat fişi
   Belge tamamen seçili dilde üretilir (فارسی / Türkçe / English), yazı yönü
   ve rakam biçimi dile göre; para birimi her dilde Afgani.
   Yazdırıldığında yalnızca belge basılır, arayüz basılmaz.
   Mühür, kaşe, güvenlik şeridi ve doğrulama kodu js/seal.js'ten gelir.
   ========================================================================== */

/* İşletme bilgileri (ad, adres, vergi no, telefon, e-posta) artık burada
   sabit değil: Ayarlar sayfasından girilir ve js/settings.js'te durur. */

function docHost() { return document.getElementById('docHost'); }

function openDoc(html) {
  const host = docHost();
  host.innerHTML = html;
  host.classList.add('on');
  document.body.classList.add('doc-open');
  host.scrollTop = 0;
}

function closeDoc() {
  const host = docHost();
  host.classList.remove('on');
  host.innerHTML = '';
  document.body.classList.remove('doc-open');
}

/* --- belge kabuğu: araç çubuğu + A4 sayfa --- */
function docShell(inner) {
  return '<div class="doc-bar">' +
      '<button class="btn btn-ghost" data-act="close-doc">' + icon('x') + t('aria_close') + '</button>' +
      '<div class="spacer"></div>' +
      '<button class="btn btn-ghost" data-act="toggle-copy" aria-pressed="false">' + icon('copy') + t('inv_copy_toggle') + '</button>' +
      '<button class="btn btn-primary" data-act="print-doc">' + icon('printer') + t('inv_print') + '</button>' +
    '</div>' +
    '<div class="doc-scroll"><article class="sheet">' + inner + '</article></div>';
}

function sheetHeader(docTitle, meta) {
  return '<header class="sheet-head">' +
      '<div class="sheet-brand">' +
        '<img class="sheet-mark" src="icons/logo-128.png" alt="">' +
        '<div>' +
          '<div class="sheet-biz">' + esc(bizName()) + '</div>' +
          '<div class="sheet-biz-sub">' + esc(bizAddr()) + '</div>' +
          '<div class="sheet-biz-sub">' + ltr(setting('phone')) + ' · ' +
            ltr(setting('email')) + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="sheet-meta">' +
        '<div class="sheet-doctype">' + esc(docTitle) + '</div>' +
        meta.map((m) =>
          '<div class="sheet-meta-row"><span>' + esc(m[0]) + '</span><b>' + m[1] + '</b></div>').join('') +
      '</div>' +
    '</header>' + bandSvg();
}

function partyBlock(label, lines) {
  return '<div class="sheet-party">' +
    '<div class="sheet-party-label">' + esc(label) + '</div>' +
    lines.filter(Boolean).map((l, i) =>
      '<div class="' + (i === 0 ? 'sheet-party-name' : 'sheet-party-line') + '">' + l + '</div>').join('') +
  '</div>';
}

/* --------------------------------------------------------------------------
   FATURA
   -------------------------------------------------------------------------- */
function invoiceDoc(saleId) {
  const sale = saleById(saleId);
  if (!sale) { toast(t('e_no_record'), 'warning'); return; }

  const c  = customerById(sale.customerId);
  const st = saleTotals(sale);
  const status = saleStatus(sale);
  const pays = PAYMENTS.filter((p) => p.saleId === sale.id).slice().sort((a, b) => a.date - b.date);
  const staff = staffById(sale.staffId);

  const rows = sale.items.map((it, i) => {
    const p = productById(it.pid);
    return '<tr>' +
      '<td class="c">' + num(i + 1) + '</td>' +
      '<td><b>' + esc(p ? p.name : '—') + '</b>' +
        '<span class="sheet-sku">' + esc(p ? p.sku : '') + ' · ' + esc(p ? catLabel(p.cat) : '') + '</span></td>' +
      '<td class="e">' + num(it.qty) + '</td>' +
      '<td class="e">' + money(it.price) + '</td>' +
      '<td class="e"><b>' + money(it.qty * it.price) + '</b></td>' +
    '</tr>';
  }).join('');

  const payRows = pays.length
    ? pays.map((p) =>
        '<tr><td>' + fmtDate(p.date) + '</td><td>' + esc(methodLabel(p.method)) + '</td>' +
        '<td class="e"><b>' + money(p.amount) + '</b></td></tr>').join('')
    : '<tr><td colspan="3" class="sheet-empty">' + esc(t('inv_no_payments')) + '</td></tr>';

  const stamp = saleStamp(sale);

  openDoc(docShell(
    watermarkSvg(t('inv_copy')) +
    sheetHeader(t('inv_title'), [
      [t('inv_no'),   '<span class="mono">' + esc(sale.no) + '</span>'],
      [t('inv_date'), fmtDate(sale.date)],
      [t('inv_due'),  '<span class="' + (dueTone(sale.due, st.remaining) === 'danger' ? 'ink-danger'
                       : dueTone(sale.due, st.remaining) === 'warning' ? 'ink-warning' : '') + '">' +
                       fmtDate(sale.due) + '</span>']
    ]) +

    '<div class="sheet-parties">' +
      partyBlock(t('inv_seller'), [
        esc(bizName()),
        esc(bizAddr()),
        esc(t('inv_tax')) + ': ' + ltr(setting('tax')),
        ltr(setting('phone'))
      ]) +
      partyBlock(t('inv_buyer'), [
        esc(customerName(c)),
        esc(L(c.addr)),
        ltr(c.phone),
        ltr(c.email)
      ]) +
    '</div>' +

    '<table class="sheet-table">' +
      '<thead><tr>' +
        '<th class="c">' + esc(t('inv_no_col')) + '</th>' +
        '<th>' + esc(t('inv_desc')) + '</th>' +
        '<th class="e">' + esc(t('c_qty')) + '</th>' +
        '<th class="e">' + esc(t('inv_unit_price')) + '</th>' +
        '<th class="e">' + esc(t('inv_line_total')) + '</th>' +
      '</tr></thead><tbody>' + rows + '</tbody>' +
    '</table>' +

    '<div class="sheet-summary">' +
      '<div class="sheet-notes">' +
        '<div class="sheet-sub-h">' + esc(t('inv_payments')) + '</div>' +
        '<table class="sheet-mini"><tbody>' + payRows + '</tbody></table>' +
      '</div>' +
      '<div class="sheet-totals-wrap"><div class="sheet-totals">' +
        '<div class="stot"><span>' + esc(t('inv_subtotal')) + '</span><b>' + money(st.total) + '</b></div>' +
        '<div class="stot grand"><span>' + esc(t('inv_grand')) + '</span><b>' + money(st.total) + '</b></div>' +
        '<div class="stot"><span>' + esc(t('inv_paid')) + '</span><b class="ink-success">' + money(st.paid) + '</b></div>' +
        '<div class="stot balance"><span>' + esc(t('inv_balance')) + '</span>' +
          '<b class="' + (st.remaining > 0 ? 'ink-danger' : 'ink-success') + '">' + money(st.remaining) + '</b></div>' +
        '<div class="sheet-status ' + status.tone + '">' + esc(status.label) + '</div>' +
      '</div>' +
      '<div class="stamp-wrap">' + stampSvg(stamp.text, stamp.tone, fmtDate(sale.date)) + '</div></div>' +
    '</div>' +

    '<footer class="sheet-foot">' +
      '<div class="sheet-signs">' +
        '<div class="sign sign-seller"><span class="sign-line"></span>' + esc(t('inv_sign_seller')) +
          '<em>' + esc(staffName(staff)) + '</em>' +
          '<div class="seal-wrap">' + sealSvg() + '</div></div>' +
        '<div class="sign"><span class="sign-line"></span>' + esc(t('inv_sign_buyer')) +
          '<em>' + esc(customerName(c)) + '</em></div>' +
      '</div>' +
      verifyStrip(invoiceQrText(sale), invoiceCode(sale)) +
      '<p class="sheet-thanks">' + esc(t('inv_thanks')) + '</p>' +
      '<p class="sheet-legal">' + esc(t('inv_footer')) + '</p>' +
    '</footer>'
  ));
}

/* --------------------------------------------------------------------------
   TAHSİLAT FİŞİ
   -------------------------------------------------------------------------- */
function receiptDoc(paymentId) {
  const p = PAYMENTS.find((x) => x.id === paymentId);
  if (!p) { toast(t('e_no_record'), 'warning'); return; }

  const c = customerById(p.customerId);
  const sale = saleById(p.saleId);
  const st = sale ? saleTotals(sale) : null;

  openDoc(docShell(
    watermarkSvg(t('inv_copy')) +
    sheetHeader(t('inv_receipt'), [
      [t('inv_no'),   '<span class="mono">' + esc(sale ? sale.no : '—') + '</span>'],
      [t('inv_date'), fmtDate(p.date)],
      [t('m_method'), esc(methodLabel(p.method))]
    ]) +

    '<div class="sheet-parties">' +
      partyBlock(t('inv_seller'), [esc(bizName()), esc(bizAddr()), ltr(setting('phone'))]) +
      partyBlock(t('inv_buyer'),  [esc(customerName(c)), esc(L(c.addr)), ltr(c.phone)]) +
    '</div>' +

    '<div class="receipt-amount-wrap"><div class="receipt-amount">' +
      '<span>' + esc(t('inv_paid')) + '</span>' +
      '<strong>' + money(p.amount, true) + '</strong>' +
    '</div>' +
    '<div class="stamp-wrap">' + stampSvg(t('g_collected'), 'success', fmtDate(p.date)) + '</div></div>' +

    (st ? '<table class="sheet-table"><tbody>' +
      '<tr><td>' + esc(t('inv_grand')) + '</td><td class="e"><b>' + money(st.total) + '</b></td></tr>' +
      '<tr><td>' + esc(t('inv_paid')) + '</td><td class="e"><b class="ink-success">' + money(st.paid) + '</b></td></tr>' +
      '<tr><td>' + esc(t('inv_balance')) + '</td><td class="e"><b class="' +
        (st.remaining > 0 ? 'ink-danger' : 'ink-success') + '">' + money(st.remaining) + '</b></td></tr>' +
      '</tbody></table>' : '') +

    '<footer class="sheet-foot">' +
      '<div class="sheet-signs">' +
        '<div class="sign sign-seller"><span class="sign-line"></span>' + esc(t('inv_sign_seller')) +
          '<div class="seal-wrap">' + sealSvg() + '</div></div>' +
        '<div class="sign"><span class="sign-line"></span>' + esc(t('inv_sign_buyer')) + '</div>' +
      '</div>' +
      verifyStrip(receiptQrText(p, sale), receiptCode(p, sale)) +
      '<p class="sheet-legal">' + esc(t('inv_footer')) + '</p>' +
    '</footer>'
  ));
}
/* --------------------------------------------------------------------------
   GARANTİ BELGESİ

   Satılan cihazların seri numarası, garanti süresi ve bitiş tarihi; şartlar;
   mühür, kaşe ve doğrulama karekodu faturadakiyle aynı sistemden gelir.
   -------------------------------------------------------------------------- */
function warrantyDoc(saleId) {
  const sale = saleById(saleId);
  if (!sale) { toast(t('e_no_record'), 'warning'); return; }

  const items = warrantyItems(sale);
  if (!items.length) { toast(t('wf_none'), 'info'); return; }

  const c = customerById(sale.customerId);
  const staff = staffById(sale.staffId);
  const end = warrantyEnd(sale);
  const valid = end >= TODAY;
  const left = daysBetween(TODAY, end);

  const rows = items.map((x, i) =>
    '<tr>' +
      '<td class="c">' + num(i + 1) + '</td>' +
      '<td><b>' + esc(x.product ? x.product.name : '—') + '</b>' +
        '<span class="sheet-sku">' + esc(x.product ? x.product.sku : '') + ' · ' +
        esc(x.product ? catLabel(x.product.cat) : '') +
        (x.qty > 1 ? ' · ' + esc(t('c_qty')) + ' ' + num(x.qty) : '') + '</span></td>' +
      '<td class="wr-serial">' + (x.serial
        ? '<span class="mono">' + esc(x.serial) + '</span>'
        : '<span class="sheet-empty">' + esc(t('wr_no_serial')) + '</span>') + '</td>' +
      '<td class="c">' + esc(t('wr_months', { n: num(x.months) })) + '</td>' +
      '<td class="e"><b>' + fmtDate(x.end) + '</b></td>' +
    '</tr>').join('');

  const bullets = (label, keys) =>
    '<div class="wr-term"><div class="sheet-sub-h">' + esc(label) + '</div><ul>' +
      keys.map((k) => '<li>' + esc(t(k)) + '</li>').join('') + '</ul></div>';

  openDoc(docShell(
    watermarkSvg(t('inv_copy')) +
    sheetHeader(t('wr_title'), [
      [t('wr_no'),    '<span class="mono">' + esc(sale.no) + '-G</span>'],
      [t('wr_start'), fmtDate(sale.date)],
      [t('wr_end'),   '<span class="' + (valid ? '' : 'ink-danger') + '">' + fmtDate(end) + '</span>']
    ]) +

    '<div class="sheet-parties">' +
      partyBlock(t('inv_seller'), [
        esc(bizName()),
        esc(bizAddr()),
        esc(t('inv_tax')) + ': ' + ltr(setting('tax')),
        ltr(setting('phone'))
      ]) +
      partyBlock(t('inv_buyer'), [
        esc(customerName(c)),
        esc(L(c.addr)),
        ltr(c.phone)
      ]) +
    '</div>' +

    '<table class="sheet-table">' +
      '<thead><tr>' +
        '<th class="c">' + esc(t('inv_no_col')) + '</th>' +
        '<th>' + esc(t('wr_device')) + '</th>' +
        '<th>' + esc(t('wr_serial')) + '</th>' +
        '<th class="c">' + esc(t('wr_period')) + '</th>' +
        '<th class="e">' + esc(t('wr_end')) + '</th>' +
      '</tr></thead><tbody>' + rows + '</tbody>' +
    '</table>' +

    '<div class="wr-status">' +
      '<p class="wr-left' + (valid ? '' : ' ink-danger') + '">' +
        esc(valid ? t('wr_days_left', { n: num(left) }) : t('wr_expired')) + '</p>' +
      '<div class="wr-stamp">' +
        stampSvg(valid ? t('wr_valid') : t('wr_expired'), valid ? 'success' : 'danger', fmtDate(end)) +
      '</div>' +
    '</div>' +

    '<section class="wr-terms">' +
      '<div class="sheet-sub-h wr-terms-h">' + esc(t('wr_terms')) + '</div>' +
      '<div class="wr-terms-grid">' +
        bullets(t('wr_covered'),  ['wr_covered_1', 'wr_covered_2', 'wr_covered_3']) +
        bullets(t('wr_excluded'), ['wr_excluded_1', 'wr_excluded_2', 'wr_excluded_3', 'wr_excluded_4']) +
      '</div>' +
      '<p class="wr-howto"><b>' + esc(t('wr_howto')) + ':</b> ' + esc(t('wr_howto_text')) + '</p>' +
    '</section>' +

    '<footer class="sheet-foot">' +
      '<div class="sheet-signs">' +
        '<div class="sign sign-seller"><span class="sign-line"></span>' + esc(t('wr_sign_shop')) +
          '<em>' + esc(staffName(staff)) + '</em>' +
          '<div class="seal-wrap">' + sealSvg() + '</div></div>' +
        '<div class="sign"><span class="sign-line"></span>' + esc(t('wr_sign_cust')) +
          '<em>' + esc(customerName(c)) + '</em></div>' +
      '</div>' +
      verifyStrip(warrantyQrText(sale), warrantyCode(sale)) +
      '<p class="sheet-legal">' + esc(t('wr_foot')) + '</p>' +
    '</footer>'
  ));
}
