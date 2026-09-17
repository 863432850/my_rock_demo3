/**
 * 碳排放管理 · 月度数据填报（演示壳）
 * 当前完整复刻「化石燃料燃烧排放」页签界面 + 支撑材料添加弹层。
 */

var EMISSION_TABS = [
  { id: 'fossil', name: '化石燃料燃烧排放' },
  { id: 'power', name: '购入使用电力排放' },
  { id: 'summary', name: '生产数据及排放量汇总' },
  { id: 'aux', name: '辅助参数表填报' },
];

var VALUE_MODES = ['实测值', '缺省值', '计算值'];

var TERMINAL_TYPES = [
  { id: 'scanner', name: '高拍仪', desc: '纸质单据、台账影像采集' },
  { id: 'ocr', name: 'OCR电表', desc: '表盘图像识别抄表' },
  { id: 'infrared', name: '红外电表', desc: '红外通信直读日结数据' },
];

/** 远程终端日统计演示数据（2026年9月；高拍仪保留前两条，OCR/红外保留原第2、3条） */
var REMOTE_RECORDS = [
  { id: 'sc-0901-1', terminalId: 'scanner', date: '2026-09-01', time: '09:12', device: '高拍仪#A1', location: '发电车间资料室', online: true },
  { id: 'sc-0901-2', terminalId: 'scanner', date: '2026-09-01', time: '14:36', device: '高拍仪#A1', location: '化验室', online: true },
  { id: 'ocr-0902-1', terminalId: 'ocr', date: '2026-09-02', time: '08:18', device: 'OCR电表#12', location: '1#锅炉房', online: true },
  { id: 'ocr-0902-2', terminalId: 'ocr', date: '2026-09-02', time: '08:22', device: 'OCR电表#15', location: '2#锅炉房', online: true },
  { id: 'ir-0902-1', terminalId: 'infrared', date: '2026-09-02', time: '08:12', device: '红外电表#3', location: '汽机厂房', online: true },
  { id: 'ir-0902-2', terminalId: 'infrared', date: '2026-09-02', time: '08:15', device: '红外电表#3', location: '汽机厂房', online: true },
];

var REMOTE_DATE_MIN = '2026-09-01';
var REMOTE_DATE_MAX = '2026-09-30';

/** 演示数据：对齐截图中的天然气组 + 下一物料起始两行 */
var FOSSIL_DEMO = {
  line: '生产线1',
  source: '化石燃料燃烧排放-发电-2023',
  materials: [
    {
      name: '天然气',
      rows: [
        { param: '消耗量', mode: '实测值', value: '21', collect: '', unit: '10⁴Nm³', origin: '' },
        { param: '空气干燥基元素碳含量', mode: '实测值', value: '0', collect: '', unit: 'tC/t', origin: '' },
        { param: '收到基水分', mode: '实测值', value: '0', collect: '', unit: '%', origin: '' },
        { param: '空气干燥基水分', mode: '实测值', value: '0', collect: '', unit: '%', origin: '' },
        { param: '干燥基元素碳含量', mode: '实测值', value: '0', collect: '', unit: 'tC/t', origin: '' },
        { param: '低位发热量', mode: '缺省值', value: '389.31', collect: '', unit: 'GJ/10⁴Nm³', origin: '' },
        { param: '单位热值含碳量', mode: '缺省值', value: '0.01532', collect: '', unit: 'tC/GJ', origin: '' },
        { param: '碳氧化率', mode: '缺省值', value: '99', collect: '', unit: '%', origin: '' },
        { param: '收到基元素碳含量', mode: '计算值', value: '5.96', collect: '', unit: 'tC/t', origin: '' },
        { param: '化石燃料热量', mode: '计算值', value: '8175.51', collect: '', unit: 'GJ', origin: '' },
        { param: '化石燃料燃烧排放量', mode: '计算值', value: '454.33', collect: '', unit: 'tCO₂', origin: '' },
        { param: '化石燃料燃烧排放总量', mode: '计算值', value: '454.33', collect: '', unit: 'tCO₂', origin: '', spanMaterial: true },
      ],
    },
    {
      name: '柴油',
      rows: [
        { param: '消耗量', mode: '实测值', value: '45', collect: '', unit: '10⁴Nm³', origin: '' },
        { param: '空气干燥基元素碳含量', mode: '实测值', value: '0', collect: '', unit: 'tC/t', origin: '' },
      ],
    },
  ],
};

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatSize(bytes) {
  var n = Number(bytes) || 0;
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / (1024 * 1024)).toFixed(1) + ' MB';
}

function modeOptions(selected) {
  return VALUE_MODES.map(function (m) {
    return '<option value="' + escapeHtml(m) + '"' + (m === selected ? ' selected' : '') + '>'
      + escapeHtml(m) + '</option>';
  }).join('');
}

function terminalName(id) {
  var t = TERMINAL_TYPES.find(function (x) { return x.id === id; });
  return t ? t.name : id;
}

function remoteSearchText(rec) {
  return [rec.device, rec.location, rec.id].join(' ');
}

function snapshotRemote(rec) {
  return {
    id: rec.id,
    terminalId: rec.terminalId,
    device: rec.device,
    date: rec.date,
    time: rec.time,
    location: rec.location || '',
    online: true,
  };
}

/** 列表「记录时间」：高拍仪显示具体时间；OCR/红外电表显示整月范围（如 2026年9月） */
function remoteTimeLabel(rec) {
  if (!rec) return '-';
  if (rec.terminalId === 'scanner') {
    return String(rec.date || '').slice(5) + ' ' + (rec.time || '');
  }
  var parts = String(rec.date || '').split('-');
  if (parts.length < 2) return rec.date || '-';
  return parts[0] + '年' + Number(parts[1]) + '月';
}

function detectPreviewKind(name, mime) {
  var n = String(name || '').toLowerCase();
  var m = String(mime || '').toLowerCase();
  if (m.indexOf('image/') === 0 || /\.(png|jpe?g|gif|webp|bmp)$/.test(n)) return 'image';
  if (m === 'application/pdf' || /\.pdf$/.test(n)) return 'pdf';
  if (m.indexOf('text/') === 0 || /\.(txt|md|csv|json|log)$/.test(n)) return 'text';
  return 'generic';
}

function displayFileName(item) {
  if (!item) return '文件预览';
  if (item.type === 'local') return item.fileName || item.label || '本地文件';
  return (item.label || '远程记录') + '.pdf';
}

function buildFlatRows() {
  var list = [];
  FOSSIL_DEMO.materials.forEach(function (mat, mi) {
    mat.rows.forEach(function (row, ri) {
      list.push({
        rowId: 'r-' + mi + '-' + ri,
        material: mat.name,
        param: row.param,
        mode: row.mode,
        value: row.value,
        collect: row.collect,
        unit: row.unit,
        origin: row.origin,
        attachments: [],
      });
    });
  });
  return list;
}

function initEmissionFillPage() {
  initLayout('monthly-fill', { moduleId: 'emission', pageTitle: '月度数据填报-填报' });

  var flatRows = buildFlatRows();
  var activeTab = 'fossil';

  var attachState = {
    rowId: '',
    source: 'local',
    terminalId: 'scanner',
    dateStart: REMOTE_DATE_MIN,
    dateEnd: REMOTE_DATE_MAX,
    keyword: '',
    localFiles: [],
    selectedRemoteIds: {},
  };

  var previewState = {
    zoom: 1,
    item: null,
    rowId: '',
  };

  function getRow(rowId) {
    return flatRows.find(function (r) { return r.rowId === rowId; });
  }

  function findAttachment(rowId, aid) {
    var row = getRow(rowId);
    if (!row) return null;
    return row.attachments.find(function (a) { return a.id === aid; }) || null;
  }

  function selectedRemoteCount() {
    return Object.keys(attachState.selectedRemoteIds).filter(function (k) {
      return attachState.selectedRemoteIds[k];
    }).length;
  }

  function updateAttachCount() {
    var n = attachState.localFiles.length + selectedRemoteCount();
    document.getElementById('emission-attach-count').textContent = '已选 ' + n + ' 项';
  }

  function revokePreviewUrl(item) {
    if (item && item.previewUrl && String(item.previewUrl).indexOf('blob:') === 0) {
      try { URL.revokeObjectURL(item.previewUrl); } catch (e) { /* ignore */ }
    }
  }

  function renderAttachChips(row) {
    if (!row.attachments.length) return '';
    return '<div class="emission-attach-chips">'
      + row.attachments.map(function (item) {
        return '<span class="emission-attach-chip">'
          + '<button type="button" class="emission-chip-open" data-row="' + escapeHtml(row.rowId)
          + '" data-aid="' + escapeHtml(item.id) + '" title="点击预览">'
          + '<em>' + escapeHtml(item.label) + '</em>'
          + '</button>'
          + '<button type="button" class="emission-chip-del" data-row="' + escapeHtml(row.rowId)
          + '" data-aid="' + escapeHtml(item.id) + '" title="删除">×</button>'
          + '</span>';
      }).join('')
      + '</div>';
  }

  function renderRemotePreviewDoc(item) {
    var rec = item.remote || {};
    return '<div class="emission-preview-stage" style="transform:scale(' + previewState.zoom + ')">'
      + '<div class="emission-preview-doc">'
      + '<div class="emission-preview-doc-badge">远程终端日统计</div>'
      + '<h1>' + escapeHtml(terminalName(rec.terminalId || item.terminalId)) + '日结记录</h1>'
      + '<p class="emission-preview-doc-sub">记录编号 ' + escapeHtml(rec.id || item.id) + '</p>'
      + '<table class="emission-preview-meta">'
      + '<tr><th>终端名称</th><td>' + escapeHtml(rec.device || '-') + '</td></tr>'
      + '<tr><th>安装位置</th><td>' + escapeHtml(rec.location || '-') + '</td></tr>'
      + '<tr><th>统计日期</th><td>' + escapeHtml(rec.date || '-') + '</td></tr>'
      + '<tr><th>记录时间</th><td>' + escapeHtml(remoteTimeLabel(rec)) + '</td></tr>'
      + '<tr><th>终端状态</th><td>在线</td></tr>'
      + '</table>'
      + '<p class="emission-preview-doc-note">演示预览：远程终端日统计记录详情页，正式环境可对接原始影像或抄表报文。</p>'
      + '</div></div>';
  }

  function renderGenericPreviewDoc(item) {
    return '<div class="emission-preview-stage" style="transform:scale(' + previewState.zoom + ')">'
      + '<div class="emission-preview-doc">'
      + '<div class="emission-preview-doc-badge">支撑材料</div>'
      + '<h1>' + escapeHtml(item.fileName || item.label) + '</h1>'
      + '<table class="emission-preview-meta">'
      + '<tr><th>来源</th><td>' + (item.type === 'local' ? '本地电脑' : '远程终端') + '</td></tr>'
      + '<tr><th>文件名</th><td>' + escapeHtml(item.fileName || item.label) + '</td></tr>'
      + '<tr><th>大小</th><td>' + escapeHtml(item.sizeText || '-') + '</td></tr>'
      + '<tr><th>类型</th><td>' + escapeHtml(item.mime || '未知') + '</td></tr>'
      + '</table>'
      + '<p class="emission-preview-doc-note">演示环境暂不渲染该格式正文，正式环境可接入在线预览服务。</p>'
      + '</div></div>';
  }

  function fillPreviewBody(html) {
    document.getElementById('emission-preview-body').innerHTML = html;
  }

  function applyPreviewZoom() {
    var stage = document.querySelector('#emission-preview-body .emission-preview-stage');
    if (stage) stage.style.transform = 'scale(' + previewState.zoom + ')';
    var iframe = document.querySelector('#emission-preview-body .emission-preview-iframe');
    if (iframe) iframe.style.transform = 'scale(' + previewState.zoom + ')';
    var img = document.querySelector('#emission-preview-body .emission-preview-image');
    if (img) img.style.transform = 'scale(' + previewState.zoom + ')';
  }

  function openPreview(rowId, aid) {
    var item = findAttachment(rowId, aid);
    if (!item) return;
    previewState.item = item;
    previewState.rowId = rowId;
    previewState.zoom = 1;
    document.getElementById('emission-preview-filename').textContent = displayFileName(item);
    document.getElementById('emission-preview-page').textContent = '1 / 1';
    document.getElementById('emission-preview-modal').classList.add('show');

    if (item.type === 'remote') {
      fillPreviewBody(renderRemotePreviewDoc(item));
      return;
    }

    var kind = item.previewKind || detectPreviewKind(item.fileName, item.mime);
    if (kind === 'image' && item.previewUrl) {
      fillPreviewBody(
        '<div class="emission-preview-media">'
        + '<img class="emission-preview-image" src="' + escapeHtml(item.previewUrl)
        + '" alt="' + escapeHtml(item.fileName || '') + '" />'
        + '</div>'
      );
      return;
    }
    if (kind === 'pdf' && item.previewUrl) {
      fillPreviewBody(
        '<div class="emission-preview-media">'
        + '<iframe class="emission-preview-iframe" src="' + escapeHtml(item.previewUrl)
        + '#toolbar=0" title="PDF 预览"></iframe>'
        + '</div>'
      );
      return;
    }
    if (kind === 'text' && item.file) {
      fillPreviewBody('<div class="emission-preview-media"><div class="emission-preview-text">加载中…</div></div>');
      var reader = new FileReader();
      reader.onload = function () {
        var text = String(reader.result || '');
        fillPreviewBody(
          '<div class="emission-preview-stage" style="transform:scale(' + previewState.zoom + ')">'
          + '<pre class="emission-preview-text">' + escapeHtml(text) + '</pre>'
          + '</div>'
        );
      };
      reader.onerror = function () {
        fillPreviewBody(renderGenericPreviewDoc(item));
      };
      reader.readAsText(item.file);
      return;
    }
    fillPreviewBody(renderGenericPreviewDoc(item));
  }

  function closePreview() {
    document.getElementById('emission-preview-modal').classList.remove('show');
    document.getElementById('emission-preview-body').innerHTML = '';
    previewState.item = null;
    previewState.rowId = '';
    previewState.zoom = 1;
  }

  function renderFossilTable() {
    var body = document.getElementById('emission-table-body');
    if (!body) return;

    var totalRows = flatRows.length;
    var html = '';
    var lineWritten = false;
    var sourceWritten = false;
    var materialCounts = {};
    FOSSIL_DEMO.materials.forEach(function (mat) {
      materialCounts[mat.name] = mat.rows.length;
    });
    var materialWritten = {};

    flatRows.forEach(function (row) {
      html += '<tr data-row="' + escapeHtml(row.rowId) + '">';
      if (!lineWritten) {
        html += '<td class="is-merged" rowspan="' + totalRows + '">' + escapeHtml(FOSSIL_DEMO.line) + '</td>';
        lineWritten = true;
      }
      if (!sourceWritten) {
        html += '<td class="is-merged emission-source-cell" rowspan="' + totalRows + '">'
          + escapeHtml(FOSSIL_DEMO.source) + '</td>';
        sourceWritten = true;
      }
      if (!materialWritten[row.material]) {
        html += '<td class="is-merged" rowspan="' + materialCounts[row.material] + '">'
          + escapeHtml(row.material) + '</td>';
        materialWritten[row.material] = true;
      }
      html += '<td class="emission-param-cell">' + escapeHtml(row.param) + '</td>';
      html += '<td><select class="emission-select" data-field="mode">' + modeOptions(row.mode) + '</select></td>';
      html += '<td><input class="emission-input" data-field="value" type="text" value="'
        + escapeHtml(row.value) + '" /></td>';
      html += '<td><input class="emission-input" data-field="collect" type="text" value="'
        + escapeHtml(row.collect) + '" /></td>';
      html += '<td>' + escapeHtml(row.unit) + '</td>';
      html += '<td><input class="emission-input emission-input-wide" data-field="origin" type="text" value="'
        + escapeHtml(row.origin) + '" /></td>';
      html += '<td class="emission-support-cell">'
        + '<div class="emission-support-inner">'
        + renderAttachChips(row)
        + '<button type="button" class="emission-file-btn" data-row="' + escapeHtml(row.rowId) + '">+ 添加文件</button>'
        + '</div></td>';
      html += '</tr>';
    });

    body.innerHTML = html;
  }

  function renderTabs(tabId) {
    var wrap = document.getElementById('emission-sheet-tabs');
    wrap.innerHTML = EMISSION_TABS.map(function (tab) {
      return '<button type="button" class="emission-sheet-tab'
        + (tab.id === tabId ? ' active' : '')
        + '" data-tab="' + tab.id + '">' + escapeHtml(tab.name) + '</button>';
    }).join('');
  }

  function showTab(tabId) {
    activeTab = tabId;
    renderTabs(tabId);
    var isFossil = tabId === 'fossil';
    document.getElementById('emission-sheet-panel').classList.toggle('hidden', !isFossil);
    document.getElementById('emission-tab-placeholder').classList.toggle('hidden', isFossil);
    if (isFossil) renderFossilTable();
  }

  function setAttachSource(source) {
    attachState.source = source;
    document.querySelectorAll('.emission-source-btn').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.source === source);
    });
    document.getElementById('attach-pane-local').classList.toggle('hidden', source !== 'local');
    document.getElementById('attach-pane-remote').classList.toggle('hidden', source !== 'remote');
    // 远程终端：改为逐条「获取数据」，不再提供确认添加按钮
    document.getElementById('btn-attach-confirm').classList.toggle('hidden', source === 'remote');
    updateAttachCount();
  }

  function renderLocalList() {
    var el = document.getElementById('emission-local-list');
    if (!attachState.localFiles.length) {
      el.innerHTML = '';
      return;
    }
    el.innerHTML = attachState.localFiles.map(function (f, idx) {
      return '<div class="emission-local-item">'
        + '<span class="emission-local-name" title="' + escapeHtml(f.name) + '">' + escapeHtml(f.name) + '</span>'
        + '<span class="emission-local-meta">' + escapeHtml(f.sizeText) + '</span>'
        + '<button type="button" class="emission-local-del" data-idx="' + idx + '">移除</button>'
        + '</div>';
    }).join('');
  }

  function renderTerminalCards() {
    var el = document.getElementById('emission-terminal-cards');
    el.innerHTML = TERMINAL_TYPES.map(function (t) {
      return '<button type="button" class="emission-terminal-card'
        + (t.id === attachState.terminalId ? ' active' : '')
        + '" data-terminal="' + t.id + '">'
        + '<strong>' + escapeHtml(t.name) + '</strong>'
        + '<span>' + escapeHtml(t.desc) + '</span>'
        + '</button>';
    }).join('');
  }

  function syncRemoteDateInputs() {
    var startEl = document.getElementById('emission-remote-date-start');
    var endEl = document.getElementById('emission-remote-date-end');
    startEl.min = REMOTE_DATE_MIN;
    startEl.max = REMOTE_DATE_MAX;
    endEl.min = REMOTE_DATE_MIN;
    endEl.max = REMOTE_DATE_MAX;
    startEl.value = attachState.dateStart;
    endEl.value = attachState.dateEnd;
  }

  function normalizeDateRange() {
    if (attachState.dateStart && attachState.dateEnd && attachState.dateStart > attachState.dateEnd) {
      var tmp = attachState.dateStart;
      attachState.dateStart = attachState.dateEnd;
      attachState.dateEnd = tmp;
      syncRemoteDateInputs();
    }
  }

  function filteredRemoteRecords() {
    var kw = String(attachState.keyword || '').trim().toLowerCase();
    return REMOTE_RECORDS.filter(function (r) {
      if (r.terminalId !== attachState.terminalId) return false;
      if (attachState.dateStart && r.date < attachState.dateStart) return false;
      if (attachState.dateEnd && r.date > attachState.dateEnd) return false;
      if (!kw) return true;
      return remoteSearchText(r).toLowerCase().indexOf(kw) !== -1;
    });
  }

  function renderRemoteBody() {
    var body = document.getElementById('emission-remote-body');
    var list = filteredRemoteRecords();
    if (!list.length) {
      body.innerHTML = '<tr><td colspan="5" class="emission-remote-empty">该时间范围内暂无匹配记录</td></tr>';
      return;
    }
    body.innerHTML = list.map(function (r) {
      return '<tr>'
        + '<td>' + escapeHtml(r.device) + '</td>'
        + '<td>' + escapeHtml(r.location || '-') + '</td>'
        + '<td><span class="emission-remote-status is-online"><i></i>在线</span></td>'
        + '<td>' + escapeHtml(remoteTimeLabel(r)) + '</td>'
        + '<td><button type="button" class="emission-remote-fetch" data-id="' + escapeHtml(r.id) + '">获取数据</button></td>'
        + '</tr>';
    }).join('');
  }

  function openAttachModal(rowId) {
    attachState.rowId = rowId;
    attachState.source = 'local';
    attachState.terminalId = 'scanner';
    attachState.dateStart = REMOTE_DATE_MIN;
    attachState.dateEnd = REMOTE_DATE_MAX;
    attachState.keyword = '';
    attachState.localFiles = [];
    attachState.selectedRemoteIds = {};
    document.getElementById('emission-remote-keyword').value = '';
    document.getElementById('emission-local-files').value = '';
    setAttachSource('local');
    renderLocalList();
    renderTerminalCards();
    syncRemoteDateInputs();
    renderRemoteBody();
    updateAttachCount();
    document.getElementById('emission-attach-modal').classList.add('show');
  }

  function closeAttachModal() {
    document.getElementById('emission-attach-modal').classList.remove('show');
    attachState.rowId = '';
  }

  function confirmAttach() {
    var row = getRow(attachState.rowId);
    if (!row) return;
    var added = 0;
    var exist = {};
    row.attachments.forEach(function (a) { exist[a.id] = true; });

    attachState.localFiles.forEach(function (f) {
      var id = 'local-' + f.name + '-' + f.size + '-' + f.lastModified;
      if (exist[id]) return;
      var mime = f.mime || (f.file && f.file.type) || '';
      var previewKind = detectPreviewKind(f.name, mime);
      var previewUrl = '';
      if (f.file && (previewKind === 'image' || previewKind === 'pdf')) {
        previewUrl = URL.createObjectURL(f.file);
      }
      row.attachments.push({
        id: id,
        type: 'local',
        label: '本地 · ' + f.name,
        fileName: f.name,
        mime: mime,
        sizeText: f.sizeText,
        previewKind: previewKind,
        previewUrl: previewUrl,
        file: f.file || null,
      });
      exist[id] = true;
      added += 1;
    });

    Object.keys(attachState.selectedRemoteIds).forEach(function (rid) {
      if (!attachState.selectedRemoteIds[rid] || exist[rid]) return;
      var rec = REMOTE_RECORDS.find(function (r) { return r.id === rid; });
      if (!rec) return;
      var label = terminalName(rec.terminalId) + ' · ' + remoteTimeLabel(rec);
      // 同标签多条时带时间区分
      if (row.attachments.some(function (a) { return a.label === label; })) {
        label = label + ' ' + rec.time;
      }
      row.attachments.push({
        id: rec.id,
        type: 'remote',
        terminalId: rec.terminalId,
        label: label,
        fileName: label + '.pdf',
        previewKind: 'remote',
        remote: snapshotRemote(rec),
      });
      exist[rec.id] = true;
      added += 1;
    });

    closeAttachModal();
    renderFossilTable();
    toast(added ? ('已添加 ' + added + ' 项支撑材料') : '未选择新的材料');
  }

  showTab('fossil');

  document.getElementById('emission-sheet-tabs').addEventListener('click', function (e) {
    var btn = e.target.closest('.emission-sheet-tab');
    if (!btn) return;
    showTab(btn.dataset.tab);
  });

  document.getElementById('btn-tab-more').addEventListener('click', function () {
    toast('更多页签演示中');
  });

  document.getElementById('btn-emission-back').addEventListener('click', function () {
    toast('演示页：暂无上级列表可返回');
  });

  document.getElementById('btn-emission-update').addEventListener('click', function () {
    toast('已更新（演示）');
  });

  document.getElementById('btn-emission-calc').addEventListener('click', function () {
    toast('一键计算完成（演示）');
  });

  document.getElementById('btn-emission-save').addEventListener('click', function () {
    toast('已保存（演示）');
  });

  document.getElementById('btn-emission-next').addEventListener('click', function () {
    toast('已进入下一步（演示）');
  });

  document.getElementById('emission-table-body').addEventListener('click', function (e) {
    var del = e.target.closest('.emission-chip-del');
    if (del) {
      e.preventDefault();
      e.stopPropagation();
      var row = getRow(del.getAttribute('data-row'));
      var aid = del.getAttribute('data-aid');
      if (!row) return;
      var removed = row.attachments.find(function (a) { return a.id === aid; });
      revokePreviewUrl(removed);
      row.attachments = row.attachments.filter(function (a) { return a.id !== aid; });
      if (previewState.item && previewState.item.id === aid) closePreview();
      renderFossilTable();
      toast('已移除支撑材料');
      return;
    }
    var openBtn = e.target.closest('.emission-chip-open');
    if (openBtn) {
      e.preventDefault();
      openPreview(openBtn.getAttribute('data-row'), openBtn.getAttribute('data-aid'));
      return;
    }
    var btn = e.target.closest('.emission-file-btn');
    if (!btn) return;
    openAttachModal(btn.getAttribute('data-row'));
  });

  document.getElementById('emission-table-body').addEventListener('change', function (e) {
    var tr = e.target.closest('tr[data-row]');
    if (!tr) return;
    var row = getRow(tr.getAttribute('data-row'));
    if (!row) return;
    var field = e.target.getAttribute('data-field');
    if (!field) return;
    row[field] = e.target.value;
  });

  document.getElementById('emission-attach-source').addEventListener('click', function (e) {
    var btn = e.target.closest('.emission-source-btn');
    if (!btn) return;
    setAttachSource(btn.dataset.source);
  });

  document.getElementById('emission-local-files').addEventListener('change', function () {
    var files = Array.prototype.slice.call(this.files || []);
    files.forEach(function (file) {
      var key = file.name + '|' + file.size + '|' + file.lastModified;
      var exists = attachState.localFiles.some(function (f) {
        return f.name + '|' + f.size + '|' + f.lastModified === key;
      });
      if (exists) return;
      attachState.localFiles.push({
        name: file.name,
        size: file.size,
        sizeText: formatSize(file.size),
        lastModified: file.lastModified,
        mime: file.type || '',
        file: file,
      });
    });
    this.value = '';
    renderLocalList();
    updateAttachCount();
  });

  document.getElementById('emission-local-list').addEventListener('click', function (e) {
    var btn = e.target.closest('.emission-local-del');
    if (!btn) return;
    var idx = Number(btn.getAttribute('data-idx'));
    attachState.localFiles.splice(idx, 1);
    renderLocalList();
    updateAttachCount();
  });

  document.getElementById('emission-terminal-cards').addEventListener('click', function (e) {
    var card = e.target.closest('.emission-terminal-card');
    if (!card) return;
    attachState.terminalId = card.getAttribute('data-terminal');
    renderTerminalCards();
    renderRemoteBody();
  });

  document.getElementById('emission-remote-date-start').addEventListener('change', function () {
    attachState.dateStart = this.value || REMOTE_DATE_MIN;
    normalizeDateRange();
    renderRemoteBody();
  });
  document.getElementById('emission-remote-date-end').addEventListener('change', function () {
    attachState.dateEnd = this.value || REMOTE_DATE_MAX;
    normalizeDateRange();
    renderRemoteBody();
  });

  document.getElementById('emission-remote-keyword').addEventListener('input', function () {
    attachState.keyword = this.value;
    renderRemoteBody();
  });

  document.getElementById('emission-remote-body').addEventListener('click', function (e) {
    var btn = e.target.closest('.emission-remote-fetch');
    if (!btn) return;
    var id = btn.getAttribute('data-id');
    // 获取数据：选中该条记录并走确认流程（添加到支撑材料列表 + 关闭弹窗）
    attachState.selectedRemoteIds = {};
    attachState.selectedRemoteIds[id] = true;
    confirmAttach();
  });

  document.getElementById('btn-attach-close').addEventListener('click', closeAttachModal);
  document.getElementById('btn-attach-cancel').addEventListener('click', closeAttachModal);
  document.getElementById('btn-attach-confirm').addEventListener('click', confirmAttach);

  document.getElementById('emission-attach-modal').addEventListener('click', function (e) {
    if (e.target === this) closeAttachModal();
  });

  document.getElementById('btn-preview-close').addEventListener('click', closePreview);
  document.getElementById('emission-preview-modal').addEventListener('click', function (e) {
    if (e.target === this) closePreview();
  });
  document.getElementById('btn-preview-zoom-in').addEventListener('click', function () {
    previewState.zoom = Math.min(1.8, Math.round((previewState.zoom + 0.1) * 10) / 10);
    applyPreviewZoom();
  });
  document.getElementById('btn-preview-zoom-out').addEventListener('click', function () {
    previewState.zoom = Math.max(0.6, Math.round((previewState.zoom - 0.1) * 10) / 10);
    applyPreviewZoom();
  });
  document.getElementById('btn-preview-fit').addEventListener('click', function () {
    previewState.zoom = 1;
    applyPreviewZoom();
  });
  document.getElementById('btn-preview-prev').addEventListener('click', function () {
    toast('当前预览仅 1 页');
  });
  document.getElementById('btn-preview-next').addEventListener('click', function () {
    toast('当前预览仅 1 页');
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (document.getElementById('emission-preview-modal').classList.contains('show')) {
      closePreview();
      return;
    }
    if (document.getElementById('emission-attach-modal').classList.contains('show')) {
      closeAttachModal();
    }
  });
}

if (document.querySelector('.emission-fill')) initEmissionFillPage();
