/**
 * 企业碳资产冻结管理 v2
 * 核心：体现「可用资产实时变动」
 *  - 顶部三卡片实时计算：总持有量 / 总已冻结 / 总可用量
 *  - 资产列表按【碳市场】合并展示，一个碳市场一条数据
 *  - 冻结弹窗，冻结后全局实时刷新（顶部卡片 + 列表 + 行状态）
 */

// 资产池（按 碳市场 聚合，一个市场一条数据），frozen 会随冻结操作更新
var AV_ASSETS = [
  { market: '全国碳市场', name: '全国碳排放配额CEA', total: 18000, frozen: 2000 },
  { market: 'CCER碳市场', name: '中国核证自愿减排量CCER', total: 9000, frozen: 3000 },
  { market: '北京碳市场', name: '北京碳排放配额BEA', total: 5000, frozen: 0 },
  { market: '天津碳市场', name: '天津碳排放配额TEA', total: 4000, frozen: 1500 },
  { market: '重庆碳市场', name: '重庆碳排放配额CQEA', total: 3500, frozen: 0 },
  { market: '福建碳市场', name: '福建碳排放配额FJEA', total: 3000, frozen: 800 },
  { market: '湖北碳市场', name: '湖北碳排放配额HBEA', total: 4500, frozen: 0 },
];

// 冻结/解冻流水日志（按 市场 记录多条，type: freeze | unfreeze）
var AV_FROZEN_LOG = {
  '全国碳市场': [
    { type: 'freeze', qty: 2000, reason: '司法保全', date: '2026-08-14' },
  ],
  'CCER碳市场': [
    { type: 'freeze', qty: 3000, reason: '担保质押', date: '2026-08-26' },
  ],
  '天津碳市场': [
    { type: 'freeze', qty: 1500, reason: '司法保全', date: '2026-08-20' },
  ],
  '福建碳市场': [
    { type: 'freeze', qty: 800, reason: '担保质押', date: '2026-08-02' },
  ],
};

function avKey(a) { return a.market; }

function avFmt(n) { return (Number(n) || 0).toLocaleString(); }

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function toast(msg) {
  var el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(function () { el.classList.remove('show'); }, 1800);
}

// 获取资产状态标签
function statusOf(a) {
  var available = a.total - a.frozen;
  if (a.frozen <= 0 || available <= 0) {
    if (available <= 0 && a.total > 0) return { cls: 'frozen', text: '全部冻结' };
    return { cls: 'avail', text: '全部可用' };
  }
  return { cls: 'partial', text: '部分冻结' };
}

// 计算全局汇总
function computeSummary() {
  var total = 0, frozen = 0;
  AV_ASSETS.forEach(function (a) {
    total += a.total;
    frozen += a.frozen;
  });
  return { total: total, frozen: frozen, usable: total - frozen };
}

// 渲染顶部三卡片（实时）
function renderSummary() {
  var s = computeSummary();
  document.getElementById('sum-total').innerHTML = avFmt(s.total) + '<span class="unit">tCO₂</span>';
  document.getElementById('sum-frozen').innerHTML = avFmt(s.frozen) + '<span class="unit">tCO₂</span>';
  document.getElementById('sum-usable').innerHTML = avFmt(s.usable) + '<span class="unit">tCO₂</span>';
}

// 渲染资产列表（一个碳市场一条数据）
function renderList() {
  var body = document.getElementById('av-list-body');
  if (!AV_ASSETS.length) {
    body.innerHTML = '<tr><td colspan="6" class="av-empty">暂无资产</td></tr>';
    return;
  }

  var html = AV_ASSETS.map(function (a, i) {
    var avail = a.total - a.frozen;
    var st = statusOf(a);
    var frozenDis = avail <= 0 ? ' disabled' : '';
    var unfreezeDis = a.frozen <= 0 ? ' disabled' : '';
    return '<tr>'
      + '<td>'
      + '<div class="av-asset-cell">'
      + '<span class="av-asset-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h10M7 14h6"/></svg></span>'
      + '<span>'
      + '<div class="av-asset-name">' + esc(a.market) + '</div>'
      + '</span>'
      + '</div>'
      + '</td>'
      + '<td class="av-num" style="text-align:right;">' + avFmt(a.total) + '</td>'
      + '<td class="av-num" style="text-align:right;color:var(--primary);font-weight:600;">' + avFmt(avail) + '</td>'
      + '<td class="av-num" style="text-align:right;color:var(--warning);">' + avFmt(a.frozen) + '</td>'
      + '<td><span class="av-tag ' + st.cls + '"><span class="tag-dot"></span>' + st.text + '</span></td>'
      + '<td><div class="av-ops">'
      + '<button type="button" class="av-btn av-btn-frozen" data-fz="' + i + '"' + frozenDis + '>'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>冻结</button>'
      + '<button type="button" class="av-btn av-btn-unfreeze" data-ufz="' + i + '"' + unfreezeDis + '>'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.7-1.5"/></svg>解冻</button>'
      + '<button type="button" class="av-btn av-btn-detail" data-vi="' + i + '">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>查看明细</button>'
      + '</div></td>'
      + '</tr>';
  }).join('');

  body.innerHTML = html;

  // 绑定冻结
  body.querySelectorAll('[data-fz]').forEach(function (btn) {
    btn.addEventListener('click', function () { openFreeze(Number(btn.getAttribute('data-fz'))); });
  });
  // 绑定解冻
  body.querySelectorAll('[data-ufz]').forEach(function (btn) {
    btn.addEventListener('click', function () { openUnfreeze(Number(btn.getAttribute('data-ufz'))); });
  });
  // 绑定查看明细
  body.querySelectorAll('[data-vi]').forEach(function (btn) {
    btn.addEventListener('click', function () { openDetail(Number(btn.getAttribute('data-vi'))); });
  });
}

/* ===== 冻结弹窗 ===== */
var currentFreezeIdx = -1;
var freezeModal = document.getElementById('av-freeze-modal');

function openFreeze(idx) {
  currentFreezeIdx = idx;
  var a = AV_ASSETS[idx];
  document.getElementById('afz-name').textContent = a.name;
  document.getElementById('afz-cycle').textContent = a.market;
  document.getElementById('afz-available').innerHTML = avFmt(a.total - a.frozen) + '<span class="unit">tCO₂</span>';
  document.getElementById('afz-qty').value = '';
  document.getElementById('afz-reason').value = '';
  updateFreezePreview();
  freezeModal.classList.add('show');
}

function closeFreeze() { freezeModal.classList.remove('show'); }

function updateFreezePreview() {
  var a = AV_ASSETS[currentFreezeIdx];
  if (!a) { return; }
  var avail = a.total - a.frozen;
  var qty = Number(document.getElementById('afz-qty').value) || 0;
  var preview = document.getElementById('afz-preview');
  var val = document.getElementById('afz-after');
  if (qty > 0) {
    var after = Math.max(0, avail - qty);
    preview.classList.remove('waiting');
    val.innerHTML = avFmt(after) + '<span class="unit">tCO₂</span>';
  } else {
    preview.classList.add('waiting');
    val.textContent = '--';
  }
}

// 确认冻结
function confirmFreeze() {
  var a = AV_ASSETS[currentFreezeIdx];
  var avail = a.total - a.frozen;
  var qty = Number(document.getElementById('afz-qty').value) || 0;
  var reason = document.getElementById('afz-reason').value.trim();
  if (qty <= 0) { toast('请输入有效的冻结数量'); return; }
  if (qty > avail) { toast('冻结数量不能超过可用余额'); return; }
  if (!reason) { toast('请填写冻结原因'); return; }

  // 更新资产冻结量
  a.frozen += qty;
  // 记录流水
  var log = AV_FROZEN_LOG[avKey(a)];
  if (!log) { log = []; AV_FROZEN_LOG[avKey(a)] = log; }
  log.push({ type: 'freeze', qty: qty, reason: reason, date: new Date().toISOString().slice(0, 10) });

  closeFreeze();
  // 全局实时刷新
  renderSummary();
  renderList();
  toast('冻结成功');
}

/* ===== 解冻弹窗 ===== */
var currentUnfreezeIdx = -1;
var unfreezeModal = document.getElementById('av-unfreeze-modal');

function openUnfreeze(idx) {
  currentUnfreezeIdx = idx;
  var a = AV_ASSETS[idx];
  document.getElementById('auf-name').textContent = a.name;
  document.getElementById('auf-cycle').textContent = a.market;
  document.getElementById('auf-frozen').innerHTML = avFmt(a.frozen) + '<span class="unit">tCO₂</span>';
  document.getElementById('auf-qty').value = '';
  document.getElementById('auf-reason').value = '';
  updateUnfreezePreview();
  unfreezeModal.classList.add('show');
}

function closeUnfreeze() { unfreezeModal.classList.remove('show'); }

function updateUnfreezePreview() {
  var a = AV_ASSETS[currentUnfreezeIdx];
  if (!a) { return; }
  var avail = a.total - a.frozen;
  var qty = Number(document.getElementById('auf-qty').value) || 0;
  var preview = document.getElementById('auf-preview');
  var val = document.getElementById('auf-after');
  if (qty > 0) {
    var after = avail + qty;
    preview.classList.remove('waiting');
    val.innerHTML = avFmt(after) + '<span class="unit">tCO₂</span>';
  } else {
    preview.classList.add('waiting');
    val.textContent = '--';
  }
}

// 确认解冻
function confirmUnfreeze() {
  var a = AV_ASSETS[currentUnfreezeIdx];
  var qty = Number(document.getElementById('auf-qty').value) || 0;
  var reason = document.getElementById('auf-reason').value.trim();
  if (qty <= 0) { toast('请输入有效的解冻数量'); return; }
  if (qty > a.frozen) { toast('解冻数量不能超过当前已冻结量'); return; }
  if (!reason) { toast('请填写解冻原因'); return; }

  // 更新资产冻结量
  a.frozen -= qty;
  // 记录流水
  var log = AV_FROZEN_LOG[avKey(a)];
  if (!log) { log = []; AV_FROZEN_LOG[avKey(a)] = log; }
  log.push({ type: 'unfreeze', qty: qty, reason: reason, date: new Date().toISOString().slice(0, 10) });

  closeUnfreeze();
  // 全局实时刷新
  renderSummary();
  renderList();
  toast('解冻成功');
}

/* ===== 查看明细弹窗 ===== */
var detailModal = document.getElementById('av-detail-modal');

function openDetail(idx) {
  var a = AV_ASSETS[idx];
  var log = AV_FROZEN_LOG[avKey(a)] || [];
  document.getElementById('detail-title').textContent = a.market + ' · 冻结/解冻流水';
  var listEl = document.getElementById('detail-list');
  if (!log.length) {
    listEl.innerHTML = '<div class="av-empty" style="padding:24px;">暂无记录</div>';
  } else {
    listEl.innerHTML = log.map(function (l, i) {
      var isFreeze = l.type !== 'unfreeze';
      var numCls = isFreeze ? 'av-detail-num-freeze' : 'av-detail-num-unfreeze';
      var numText = isFreeze ? '冻' : '解';
      return '<div class="av-detail-item">'
        + '<div class="av-detail-left">'
        + '<span class="av-detail-num ' + numCls + '">' + numText + '</span>'
        + '<div>'
        + '<div class="av-detail-qty">' + (isFreeze ? '+' : '-') + avFmt(l.qty) + ' tCO₂</div>'
        + '<div class="av-detail-sub">' + (isFreeze ? '冻结原因：' : '解冻原因：') + esc(l.reason || '--') + '</div>'
        + '</div>'
        + '</div>'
        + '<span class="av-detail-date">' + esc(l.date || '--') + '</span>'
        + '</div>';
    }).join('');
  }
  detailModal.classList.add('show');
}

function closeDetail() { detailModal.classList.remove('show'); }

/* ===== 事件绑定 ===== */
document.querySelectorAll('[data-close="freeze"]').forEach(function (b) {
  b.addEventListener('click', closeFreeze);
});
document.querySelectorAll('[data-close="unfreeze"]').forEach(function (b) {
  b.addEventListener('click', closeUnfreeze);
});
document.querySelectorAll('[data-close="detail"]').forEach(function (b) {
  b.addEventListener('click', closeDetail);
});
document.querySelectorAll('[data-ok="freeze"]').forEach(function (b) {
  b.addEventListener('click', confirmFreeze);
});
document.querySelectorAll('[data-ok="unfreeze"]').forEach(function (b) {
  b.addEventListener('click', confirmUnfreeze);
});
document.querySelectorAll('.av-qty-field button[data-step]').forEach(function (btn) {
  btn.addEventListener('click', function () {
    var step = btn.getAttribute('data-step');
    var isUn = btn.getAttribute('data-un') === '1';
    var input = document.getElementById(isUn ? 'auf-qty' : 'afz-qty');
    var val = Number(input.value) || 0;
    input.value = (step === 'plus') ? (val + 100) : (val - 100 < 0 ? 0 : val - 100);
    if (isUn) updateUnfreezePreview();
    else updateFreezePreview();
  });
});
document.getElementById('afz-qty').addEventListener('input', updateFreezePreview);
document.getElementById('afz-reason').addEventListener('input', function () {
  var v = this.value.trim();
  var btn = document.querySelector('[data-ok="freeze"]');
  if (btn) { btn.style.opacity = v ? '1' : '0.5'; }
});
document.getElementById('auf-qty').addEventListener('input', updateUnfreezePreview);
document.getElementById('auf-reason').addEventListener('input', function () {
  var v = this.value.trim();
  var btn = document.querySelector('[data-ok="unfreeze"]');
  if (btn) { btn.style.opacity = v ? '1' : '0.5'; }
});

// 初始化
initLayout('freeze', { moduleId: 'carbon-asset' });
renderSummary();
renderList();
