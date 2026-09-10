/* 碳目标业务逻辑（源自碳目标融合版，布局由 /js/app.js 提供） */
var __sharedInitLayout = window.initLayout;

const STORAGE_KEY = 'carbon-target-fusion-v1';

const SIDEBAR = [
  { id: 'create', name: '碳目标制定' },
  { id: 'approval', name: '碳目标审批' },
  { id: 'decompose', name: '碳目标分解' },
  { id: 'decompose-approval', name: '碳目标分解审批' },
  { id: 'adjust', name: '碳目标跟踪' },
  { id: 'adjust-config', name: '碳目标预警配置' },
];

const STATUS_MAP = {
  draft: { label: '编制中', cls: 'status-draft' },
  pending: { label: '待审核', cls: 'status-pending' },
  passed: { label: '已通过', cls: 'status-passed' },
  rejected: { label: '已驳回', cls: 'status-rejected' },
};

const DECOMPOSE_STATUS_MAP = {
  wait: { label: '待分解', cls: 'status-wait' },
  draft: { label: '编制中', cls: 'status-draft' },
  pending: { label: '待审核', cls: 'status-pending' },
  passed: { label: '已通过', cls: 'status-passed' },
  rejected: { label: '已驳回', cls: 'status-rejected' },
};

const SUBORDINATE_STATUS_MAP = {
  wait: { label: '待分解', cls: 'status-wait' },
  draft: { label: '编制中', cls: 'status-draft' },
  pending: { label: '待审核', cls: 'status-pending' },
  passed: { label: '已通过', cls: 'status-passed' },
  rejected: { label: '已驳回', cls: 'status-rejected' },
};

const SUBORDINATE_ENTERPRISES = [
  { id: 'ent-a', shortName: 'A钢铁', fullName: 'A钢铁有限公司' },
  { id: 'ent-b', shortName: 'B钢铁', fullName: 'B钢铁有限公司' },
  { id: 'ent-c', shortName: 'C特钢', fullName: 'C特种钢有限公司' },
];

/** 演示用：各目标下级单位状态序列（与 SUBORDINATE_ENTERPRISES 一一对应） */
const SUBORDINATE_DEMO_STATUS = {
  1: ['wait', 'wait', 'wait'],
  2: ['passed', 'passed', 'passed'],
  4: ['passed', 'pending', 'wait'],
  5: ['passed', 'passed', 'draft'],
  9: ['passed', 'passed', 'passed'],
  10: ['passed', 'pending', 'rejected'],
  11: ['wait', 'wait', 'wait'],
};

function normalizeSubordinateStatus(status) {
  if (status === 'unsubmitted') return 'wait';
  return SUBORDINATE_STATUS_MAP[status] ? status : 'wait';
}

function isSubordinateTrackable(row) {
  return !!(row && row.dimension === '年度' && row.decompose);
}

/** 编制状态已通过时，才展示下级进度相关列 */
function canShowSubordinateProgress(row) {
  return isSubordinateTrackable(row) && row.status === 'passed';
}

function buildSubordinatesForTarget(targetId) {
  var statuses = SUBORDINATE_DEMO_STATUS[targetId] || ['wait', 'wait', 'wait'];
  return SUBORDINATE_ENTERPRISES.map(function (ent, i) {
    var status = normalizeSubordinateStatus(statuses[i] || 'wait');
    return {
      id: ent.id,
      shortName: ent.shortName,
      fullName: ent.fullName,
      status: status,
      submittedAt: status === 'wait' ? '' : '2026-06-09 08:40:45',
    };
  });
}

function ensureSubordinates(row) {
  if (!isSubordinateTrackable(row)) return [];
  if (!Array.isArray(row.subordinates) || !row.subordinates.length) {
    row.subordinates = buildSubordinatesForTarget(row.id);
  } else {
    row.subordinates.forEach(function (s) {
      s.status = normalizeSubordinateStatus(s.status);
      if (s.status === 'wait') s.submittedAt = s.submittedAt || '';
    });
  }
  return row.subordinates;
}

function decomposeToSubLabel(row) {
  return row && row.decompose ? '是' : '否';
}

/** 下级目标制定情况汇总：仅年度、分解到下级且编制已通过时展示 */
function getSubordinateSummary(row) {
  if (!canShowSubordinateProgress(row)) {
    return { visible: false, completed: 0, total: 0, decomposed: false };
  }
  var list = ensureSubordinates(row);
  var completed = 0;
  var decomposed = false;
  list.forEach(function (s) {
    if (s.status === 'passed') {
      completed += 1;
      decomposed = true;
    }
  });
  return { visible: true, completed: completed, total: list.length, decomposed: decomposed };
}

const DEFAULT_TARGETS = [
  {
    id: 1, name: '2027年', dimension: '年度', range: '2027年', status: 'passed',
    updatedAt: '2026-08-24 15:55:34', submittedAt: '2026-08-20 10:00:00',
    decompose: true, decomposeStatus: 'wait',
    indicators: ['intensity', 'total'],
    remark: '',
  },
  {
    id: 2, name: '2024年度目标', dimension: '年度', range: '2024年', status: 'passed',
    updatedAt: '2024-03-12 16:21:08', submittedAt: '2024-03-10 09:00:00',
    decompose: true, decomposeStatus: 'passed', indicators: ['intensity', 'total', 'energy'],
    planImported: true, remark: '集团下达年度强度与总量双控目标',
    decomposeUpdateHistory: [
      { time: '2026-07-28 16:47:09', operator: 'zkgtadmin', version: 'V2', summary: '变更焦化工序1～3月的目标', reason: '根据生产计划调整一季度目标' },
      { time: '2026-07-28 16:39:03', operator: 'zkgtadmin', version: 'V1', summary: '变更了焦化工序1～4月份的目标', reason: '修正分解数据' },
    ],
  },
  { id: 3, name: '2023年6月项目目标', dimension: '月度', range: '2023年6月', status: 'pending', updatedAt: '2023-06-18 11:05:33', submittedAt: '2023-06-18 11:05:33', remark: '' },
  { id: 4, name: '2025年度碳达峰路径目标', dimension: '年度', range: '2025年', status: 'passed', updatedAt: '2025-01-08 09:12:40', submittedAt: '2025-01-06 16:20:00', decompose: true, decomposeStatus: 'draft', indicators: ['intensity', 'total'], remark: '' },
  {
    id: 5, name: '2026年', dimension: '年度', range: '2026年', status: 'passed',
    updatedAt: '2026-08-24 15:55:34', submittedAt: '2026-08-01 09:00:00',
    decompose: true, decomposeStatus: 'passed',
    indicators: ['intensity', 'total', 'energy'],
    remark: '',
  },
  { id: 6, name: '2024年12月冲刺目标', dimension: '月度', range: '2024年12月', status: 'passed', updatedAt: '2024-12-02 10:44:19', submittedAt: '2024-12-01 18:10:00', remark: '' },
  { id: 7, name: '2028年中长期目标', dimension: '年度', range: '2028年', status: 'pending', updatedAt: '2026-04-21 08:55:01', submittedAt: '2026-04-21 08:55:01', remark: '' },
  { id: 8, name: '2023年新目标', dimension: '年度', range: '2023年', status: 'rejected', updatedAt: '2023-09-04 17:26:50', submittedAt: '2023-09-01 11:20:00', remark: '指标口径与集团要求不一致' },
  {
    id: 9,
    name: '2026年年目标',
    dimension: '年度',
    range: '2026年',
    status: 'passed',
    updatedAt: '2026-08-20 14:30:00',
    submittedAt: '2026-08-01 09:00:00',
    decompose: true,
    decomposeStatus: 'passed',
    planImported: true,
    demoUpdate: true,
    indicators: ['intensity', 'total', 'energy'],
    remark: '演示：分解已通过，可进行目标更新；本月及以后可改，本月以前只读',
    decomposeUpdateHistory: [
      { time: '2026-07-28 16:47:09', operator: 'zkgtadmin', version: 'V2', summary: '变更焦化工序8～12月的目标', reason: '根据生产计划调整下半年目标' },
      { time: '2026-07-28 16:39:03', operator: 'zkgtadmin', version: 'V1', summary: '变更了焦化工序8～12月份的目标', reason: '修正下半年分解数据' },
    ],
  },
  {
    id: 10,
    name: '2026年度分解审核演示',
    dimension: '年度',
    range: '2026年',
    status: 'passed',
    updatedAt: '2026-08-22 11:20:00',
    submittedAt: '2026-08-10 09:00:00',
    decompose: true,
    decomposeStatus: 'pending',
    decomposeSubmittedAt: '2026-08-22 11:20:00',
    planImported: true,
    indicators: ['intensity', 'total', 'energy'],
    remark: '分解审批待审核演示数据',
  },
  {
    id: 11,
    name: '目标场景1-年度-分解到下级',
    dimension: '年度',
    range: '2026年',
    status: 'draft',
    updatedAt: '2026-08-27 09:10:00',
    decompose: true,
    decomposeStatus: 'wait',
    planImported: true,
    demoScene: 'annual-decompose',
    indicators: ['total', 'intensity', 'energy'],
    remark: '演示：年度目标由下级企业分解到月度',
  },
  {
    id: 12,
    name: '目标场景2-年度-不分解',
    dimension: '年度',
    range: '2026年',
    status: 'draft',
    updatedAt: '2026-08-27 09:12:00',
    decompose: false,
    planImported: true,
    demoScene: 'annual-self',
    indicators: ['total', 'intensity', 'energy'],
    remark: '演示：年度目标由集团直接分解到月度',
  },
  {
    id: 13,
    name: '目标场景3-月度-不分解',
    dimension: '月度',
    range: '2026年8月',
    status: 'draft',
    updatedAt: '2026-08-27 09:14:00',
    decompose: false,
    planImported: true,
    demoScene: 'monthly-self',
    indicators: ['total', 'intensity', 'energy'],
    remark: '演示：月度目标无需下级分解',
  },
  {
    id: 14,
    name: '2026年8月目标',
    dimension: '月度',
    range: '2026年8月',
    status: 'passed',
    updatedAt: '2026-08-20 16:40:00',
    submittedAt: '2026-08-18 10:00:00',
    decompose: false,
    planImported: true,
    demoScene: 'monthly-passed',
    indicators: ['total', 'intensity', 'energy'],
    remark: '演示：月度已通过，可进行目标更新',
  },
];

function pad(n) { return String(n).padStart(2, '0'); }

function nowText() {
  const d = new Date();
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
    + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
}

function mergeTargets(stored) {
  var defaultById = {};
  DEFAULT_TARGETS.forEach(function (d) { defaultById[d.id] = d; });

  var merged = stored.map(function (row) {
    var def = defaultById[row.id];
    if (!def) return row;
    var out = Object.assign({}, row);
    if (def.decompose != null && !def.demoScene) out.decompose = def.decompose;
    if (def.indicators && !def.demoScene) out.indicators = def.indicators.slice();
    if (def.decomposeStatus != null && !def.demoScene) out.decomposeStatus = def.decomposeStatus;
    if (def.planImported != null) out.planImported = def.planImported;
    if (def.demoUpdate != null) out.demoUpdate = def.demoUpdate;
    if (def.remark != null && def.demoUpdate) out.remark = def.remark;
    if (def.decomposeUpdateHistory && (!out.decomposeUpdateHistory || !out.decomposeUpdateHistory.length)) {
      out.decomposeUpdateHistory = def.decomposeUpdateHistory.map(function (h) { return Object.assign({}, h); });
    }
    if (def.demoUpdate) {
      out.name = def.name;
      out.dimension = def.dimension;
      out.range = def.range;
      out.status = 'passed';
      out.decompose = true;
      out.decomposeStatus = 'passed';
      out.demoUpdate = true;
      out.decomposeValues = null;
      if (def.remark) out.remark = def.remark;
    }
    if (def.demoScene) {
      out.name = def.name;
      out.dimension = def.dimension;
      out.range = def.range;
      out.decompose = def.decompose;
      out.demoScene = def.demoScene;
      out.planImported = true;
      if (!out.indicators || !out.indicators.length) out.indicators = def.indicators.slice();
      if (out.status == null) out.status = 'draft';
      if (def.demoScene === 'monthly-passed') out.status = 'passed';
    }
    if (isSubordinateTrackable(out) && (!out.subordinates || !out.subordinates.length)) {
      out.subordinates = buildSubordinatesForTarget(out.id);
    }
    return out;
  });

  DEFAULT_TARGETS.forEach(function (def) {
    if (!merged.some(function (r) { return r.id === def.id; })) {
      var copy = Object.assign({}, def);
      if (isSubordinateTrackable(copy)) {
        copy.subordinates = buildSubordinatesForTarget(copy.id);
      }
      merged.push(copy);
    }
  });

  return orderDemoScenesFirst(merged);
}

function orderDemoScenesFirst(list) {
  var order = {
    'monthly-passed': 0,
    'annual-decompose': 1,
    'annual-self': 2,
    'monthly-self': 3,
  };
  var scenes = list.filter(function (r) { return r.demoScene; }).sort(function (a, b) {
    return (order[a.demoScene] != null ? order[a.demoScene] : 9) - (order[b.demoScene] != null ? order[b.demoScene] : 9);
  });
  var rest = list.filter(function (r) { return !r.demoScene; });
  return scenes.concat(rest);
}

function loadTargets() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) return mergeTargets(parsed);
    }
  } catch (e) { /* ignore */ }
  return orderDemoScenesFirst(DEFAULT_TARGETS.map(function (x) {
    var copy = Object.assign({}, x);
    if (isSubordinateTrackable(copy)) {
      copy.subordinates = buildSubordinatesForTarget(copy.id);
    }
    return copy;
  }));
}

function saveTargets(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function rangeYear(range) {
  const m = String(range || '').match(/(\d{4})/);
  return m ? Number(m[1]) : null;
}

function rangeMonth(range) {
  const m = String(range || '').match(/(\d{1,2})月/);
  return m ? Number(m[1]) : null;
}

function auditPageTitle(row) {
  var y = rangeYear(row.range);
  var m = rangeMonth(row.range);
  if (row.dimension === '月度' && y && m) return y + '年-' + m + '月碳目标审核';
  if (y) return y + '年碳目标审核';
  return (row.name || '碳目标') + '审核';
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

/** 文档保存 API：需通过 npm start 启动本地服务后才可写入代码包 */



function closeModal(id) {
  var el = document.getElementById(id);
  if (el) el.classList.remove('show');
}

function openModal(id) {
  var el = document.getElementById(id);
  if (el) el.classList.add('show');
}

function yearOptions(selected, placeholder) {
  var html = placeholder ? '<option value="">' + placeholder + '</option>' : '';
  for (var y = 2020; y <= 2035; y++) {
    html += '<option value="' + y + '"' + (String(selected) === String(y) ? ' selected' : '') + '>' + y + '年</option>';
  }
  return html;
}

function monthOptions(selected) {
  var html = '';
  for (var m = 1; m <= 12; m++) {
    html += '<option value="' + m + '"' + (Number(selected) === m ? ' selected' : '') + '>' + m + '月</option>';
  }
  return html;
}


window.initLayout = function (activeId, opts) {
  opts = opts || {};
  opts.moduleId = 'carbon';
  var map = {
    create: 'create',
    approval: 'create',
    decompose: 'create',
    'decompose-approval': 'create',
    adjust: 'create',
    'adjust-config': 'create',
  };
  var sid = map[activeId] || activeId || 'create';
  if (typeof __sharedInitLayout !== 'function') {
    console.error('shared initLayout missing: load /js/app.js first');
    return;
  }
  return __sharedInitLayout(sid, opts);
};




function actionsFor(row) {
  if (row.status === 'draft' || row.status === 'rejected') {
    return [
      { key: 'edit', label: '编辑' },
      { key: 'delete', label: '删除', danger: true },
      { key: 'submit', label: '提交' },
    ];
  }
  if (row.status === 'pending') {
    return [{ key: 'detail', label: '详情' }];
  }
  var actions = [{ key: 'detail', label: '详情' }];
  if (row.status === 'passed' && row.dimension === '月度') {
    actions.push({ key: 'update', label: '目标更新' });
  }
  return actions;
}

function initCreatePage() {
  initLayout('create');

  var state = {
    list: loadTargets(),
    page: 1,
    pageSize: 10,
  };

  var startEl = document.getElementById('filter-start');
  var endEl = document.getElementById('filter-end');
  var nameEl = document.getElementById('filter-name');
  var statusEl = document.getElementById('filter-status');
  var tbody = document.getElementById('table-body');
  var pager = document.getElementById('pager');

  startEl.innerHTML = yearOptions('', '开始年份');
  endEl.innerHTML = yearOptions('', '结束年份');

  function filtered() {
    var start = startEl.value ? Number(startEl.value) : null;
    var end = endEl.value ? Number(endEl.value) : null;
    var name = (nameEl.value || '').trim();
    var status = statusEl.value;
    return state.list.filter(function (row) {
      var y = rangeYear(row.range);
      if (start && (y == null || y < start)) return false;
      if (end && (y == null || y > end)) return false;
      if (name && row.name.indexOf(name) === -1) return false;
      if (status && row.status !== status) return false;
      return true;
    });
  }

  function render() {
    var rows = filtered();
    var total = rows.length;
    var pages = Math.max(1, Math.ceil(total / state.pageSize));
    if (state.page > pages) state.page = pages;
    var start = (state.page - 1) * state.pageSize;
    var pageRows = rows.slice(start, start + state.pageSize);

    if (!pageRows.length) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="10">暂无数据</td></tr>';
    } else {
      tbody.innerHTML = pageRows.map(function (row, idx) {
        var st = STATUS_MAP[row.status] || STATUS_MAP.draft;
        var sub = getSubordinateSummary(row);
        var subProgress = sub.visible
          ? '<button type="button" class="sub-progress-link" data-act="subordinate" data-id="' + row.id + '">'
            + sub.completed + '(' + sub.total + ')</button>'
          : '--';
        var subDecomposed = sub.visible && sub.decomposed ? '是' : '--';
        var ops = actionsFor(row).map(function (op) {
          return '<button type="button" class="op-link' + (op.danger ? ' danger' : '') + '" data-act="' + op.key + '" data-id="' + row.id + '">' + op.label + '</button>';
        }).join('');
        return '<tr>'
          + '<td class="col-index">' + (start + idx + 1) + '</td>'
          + '<td>' + row.name + '</td>'
          + '<td>' + row.dimension + '</td>'
          + '<td>' + row.range + '</td>'
          + '<td>' + decomposeToSubLabel(row) + '</td>'
          + '<td><span class="status-text ' + st.cls + '">' + st.label + '</span></td>'
          + '<td>' + subProgress + '</td>'
          + '<td>' + subDecomposed + '</td>'
          + '<td>' + row.updatedAt + '</td>'
          + '<td class="col-action"><div class="op-links">' + ops + '</div></td>'
          + '</tr>';
      }).join('');
    }

    var btns = '';
    btns += '<span>共 ' + total + ' 条</span>';
    btns += '<button type="button" class="pager-btn" data-page="' + (state.page - 1) + '" ' + (state.page <= 1 ? 'disabled' : '') + '>上一页</button>';
    for (var p = 1; p <= pages; p++) {
      btns += '<button type="button" class="pager-btn' + (p === state.page ? ' active' : '') + '" data-page="' + p + '">' + p + '</button>';
    }
    btns += '<button type="button" class="pager-btn" data-page="' + (state.page + 1) + '" ' + (state.page >= pages ? 'disabled' : '') + '>下一页</button>';
    pager.innerHTML = btns;
  }

  function persist() { saveTargets(state.list); render(); }

  function findRow(id) {
    return state.list.find(function (x) { return x.id === Number(id); });
  }

  document.getElementById('btn-search').addEventListener('click', function () {
    state.page = 1;
    render();
  });

  document.getElementById('btn-reset').addEventListener('click', function () {
    startEl.value = '';
    endEl.value = '';
    nameEl.value = '';
    statusEl.value = '';
    state.page = 1;
    render();
  });

  document.getElementById('btn-add').addEventListener('click', function () {
    location.href = 'create.html';
  });

  tbody.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-act]');
    if (!btn) return;
    var row = findRow(btn.dataset.id);
    if (!row) return;
    var act = btn.dataset.act;
    if (act === 'edit') location.href = 'create.html?id=' + row.id;
    else if (act === 'delete') {
      if (!confirm('确认删除「' + row.name + '」？')) return;
      state.list = state.list.filter(function (x) { return x.id !== row.id; });
      toast('已删除');
      persist();
    } else if (act === 'submit') {
      if (!confirm('确认提交「' + row.name + '」进入审批？')) return;
      row.status = 'pending';
      row.updatedAt = nowText();
      row.submittedAt = nowText();
      toast('已提交，待审核');
      persist();
    } else if (act === 'detail') {
      location.href = 'create.html?id=' + row.id + '&mode=detail';
    } else if (act === 'update') {
      location.href = 'create.html?id=' + row.id + '&mode=update';
    } else if (act === 'subordinate') {
      location.href = 'subordinate.html?id=' + row.id;
    }
  });

  pager.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-page]');
    if (!btn || btn.disabled) return;
    var p = Number(btn.dataset.page);
    if (!p) return;
    state.page = p;
    render();
  });

  nameEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      state.page = 1;
      render();
    }
  });

  document.querySelectorAll('.modal-overlay').forEach(function (ov) {
    ov.addEventListener('click', function (e) {
      if (e.target === ov) ov.classList.remove('show');
    });
  });

  render();
}

function initApprovalPage() {
  initLayout('approval');

  var state = {
    list: loadTargets(),
    page: 1,
    pageSize: 10,
    tab: 'pending',
  };

  var startEl = document.getElementById('filter-start');
  var endEl = document.getElementById('filter-end');
  var nameEl = document.getElementById('filter-name');
  var tbody = document.getElementById('table-body');
  var pager = document.getElementById('pager');
  var tabPending = document.getElementById('tab-pending');
  var tabDone = document.getElementById('tab-done');

  startEl.innerHTML = yearOptions('', '开始年份');
  endEl.innerHTML = yearOptions('', '结束年份');

  function byFilter(row) {
    var start = startEl.value ? Number(startEl.value) : null;
    var end = endEl.value ? Number(endEl.value) : null;
    var name = (nameEl.value || '').trim();
    var y = rangeYear(row.range);
    if (start && (y == null || y < start)) return false;
    if (end && (y == null || y > end)) return false;
    if (name && row.name.indexOf(name) === -1) return false;
    return true;
  }

  function counts() {
    var rows = state.list.filter(byFilter);
    return {
      pending: rows.filter(function (r) { return r.status === 'pending'; }).length,
      done: rows.filter(function (r) { return r.status === 'passed' || r.status === 'rejected'; }).length,
    };
  }

  function filtered() {
    return state.list.filter(function (row) {
      if (!byFilter(row)) return false;
      if (state.tab === 'pending') return row.status === 'pending';
      return row.status === 'passed' || row.status === 'rejected';
    });
  }

  function renderTabs() {
    var c = counts();
    tabPending.textContent = '待审核(' + c.pending + ')';
    tabDone.textContent = '已审核(' + c.done + ')';
    tabPending.classList.toggle('active', state.tab === 'pending');
    tabDone.classList.toggle('active', state.tab === 'done');
  }

  function render() {
    renderTabs();
    var rows = filtered();
    var total = rows.length;
    var pages = Math.max(1, Math.ceil(total / state.pageSize));
    if (state.page > pages) state.page = pages;
    var start = (state.page - 1) * state.pageSize;
    var pageRows = rows.slice(start, start + state.pageSize);

    if (!pageRows.length) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="7">暂无数据</td></tr>';
    } else {
      tbody.innerHTML = pageRows.map(function (row, idx) {
        var st = STATUS_MAP[row.status] || STATUS_MAP.pending;
        var ops = '<button type="button" class="op-link" data-act="detail" data-id="' + row.id + '">详情</button>';
        if (state.tab === 'pending') {
          ops += '<button type="button" class="op-link" data-act="audit" data-id="' + row.id + '">审核</button>';
        }
        return '<tr>'
          + '<td class="col-index">' + (start + idx + 1) + '</td>'
          + '<td>' + row.name + '</td>'
          + '<td>' + row.dimension + '</td>'
          + '<td>' + row.range + '</td>'
          + '<td>' + (row.submittedAt || row.updatedAt || '--') + '</td>'
          + '<td><span class="status-text ' + st.cls + '">' + st.label + '</span></td>'
          + '<td class="col-action"><div class="op-links">' + ops + '</div></td>'
          + '</tr>';
      }).join('');
    }

    var btns = '';
    btns += '<span>共 ' + total + ' 条</span>';
    btns += '<button type="button" class="pager-btn" data-page="' + (state.page - 1) + '" ' + (state.page <= 1 ? 'disabled' : '') + '>上一页</button>';
    for (var p = 1; p <= pages; p++) {
      btns += '<button type="button" class="pager-btn' + (p === state.page ? ' active' : '') + '" data-page="' + p + '">' + p + '</button>';
    }
    btns += '<button type="button" class="pager-btn" data-page="' + (state.page + 1) + '" ' + (state.page >= pages ? 'disabled' : '') + '>下一页</button>';
    pager.innerHTML = btns;
  }

  function goView(row, mode) {
    location.href = 'view.html?id=' + row.id + '&mode=' + mode + '&from=approval';
  }

  document.getElementById('btn-search').addEventListener('click', function () {
    state.page = 1;
    render();
  });

  document.getElementById('btn-reset').addEventListener('click', function () {
    startEl.value = '';
    endEl.value = '';
    nameEl.value = '';
    state.page = 1;
    render();
  });

  tabPending.addEventListener('click', function () {
    state.tab = 'pending';
    state.page = 1;
    render();
  });

  tabDone.addEventListener('click', function () {
    state.tab = 'done';
    state.page = 1;
    render();
  });

  tbody.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-act]');
    if (!btn) return;
    var row = state.list.find(function (x) { return x.id === Number(btn.dataset.id); });
    if (!row) return;
    if (btn.dataset.act === 'detail') goView(row, 'detail');
    else if (btn.dataset.act === 'audit') goView(row, 'audit');
  });

  pager.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-page]');
    if (!btn || btn.disabled) return;
    var p = Number(btn.dataset.page);
    if (!p) return;
    state.page = p;
    render();
  });

  nameEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      state.page = 1;
      render();
    }
  });

  render();
}

function isDecomposeTarget(row) {
  return row.status === 'passed' && row.dimension === '年度' && row.decompose !== false;
}

function decomposeActionsFor(row) {
  var ds = row.decomposeStatus || 'wait';
  if (ds === 'wait') {
    return [{ key: 'detail', label: '详情' }, { key: 'start', label: '开始分解' }];
  }
  if (ds === 'passed') {
    return [{ key: 'detail', label: '详情' }, { key: 'update', label: '目标更新' }];
  }
  if (ds === 'draft' || ds === 'rejected') {
    return [{ key: 'detail', label: '详情' }, { key: 'start', label: '开始分解' }];
  }
  return [{ key: 'detail', label: '详情' }];
}

function initDecomposePage() {
  initLayout('decompose');

  var state = {
    list: loadTargets(),
    page: 1,
    pageSize: 10,
  };

  var startEl = document.getElementById('filter-start');
  var endEl = document.getElementById('filter-end');
  var nameEl = document.getElementById('filter-name');
  var statusEl = document.getElementById('filter-status');
  var tbody = document.getElementById('table-body');
  var pager = document.getElementById('pager');

  startEl.innerHTML = yearOptions('', '开始年份');
  endEl.innerHTML = yearOptions('', '结束年份');

  function filtered() {
    var start = startEl.value ? Number(startEl.value) : null;
    var end = endEl.value ? Number(endEl.value) : null;
    var name = (nameEl.value || '').trim();
    var ds = statusEl.value;
    return state.list.filter(function (row) {
      if (!isDecomposeTarget(row)) return false;
      var y = rangeYear(row.range);
      if (start && (y == null || y < start)) return false;
      if (end && (y == null || y > end)) return false;
      if (name && row.name.indexOf(name) === -1) return false;
      if (ds && (row.decomposeStatus || 'wait') !== ds) return false;
      return true;
    }).sort(function (a, b) {
      var aw = a.demoUpdate ? 0 : 1;
      var bw = b.demoUpdate ? 0 : 1;
      return aw - bw;
    });
  }

  function render() {
    var rows = filtered();
    var total = rows.length;
    var pages = Math.max(1, Math.ceil(total / state.pageSize));
    if (state.page > pages) state.page = pages;
    var start = (state.page - 1) * state.pageSize;
    var pageRows = rows.slice(start, start + state.pageSize);

    if (!pageRows.length) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="7">暂无数据</td></tr>';
    } else {
      tbody.innerHTML = pageRows.map(function (row, idx) {
        var ds = row.decomposeStatus || 'wait';
        var st = DECOMPOSE_STATUS_MAP[ds] || DECOMPOSE_STATUS_MAP.wait;
        var ops = decomposeActionsFor(row).map(function (op) {
          return '<button type="button" class="op-link" data-act="' + op.key + '" data-id="' + row.id + '">' + op.label + '</button>';
        }).join('');
        return '<tr>'
          + '<td class="col-index">' + (start + idx + 1) + '</td>'
          + '<td>' + row.name + '</td>'
          + '<td>' + row.dimension + '</td>'
          + '<td>' + row.range + '</td>'
          + '<td>' + row.updatedAt + '</td>'
          + '<td><span class="status-text ' + st.cls + '">' + st.label + '</span></td>'
          + '<td class="col-action"><div class="op-links">' + ops + '</div></td>'
          + '</tr>';
      }).join('');
    }

    var btns = '';
    btns += '<span>共 ' + total + ' 条</span>';
    btns += '<button type="button" class="pager-btn" data-page="' + (state.page - 1) + '" ' + (state.page <= 1 ? 'disabled' : '') + '>上一页</button>';
    for (var p = 1; p <= pages; p++) {
      btns += '<button type="button" class="pager-btn' + (p === state.page ? ' active' : '') + '" data-page="' + p + '">' + p + '</button>';
    }
    btns += '<button type="button" class="pager-btn" data-page="' + (state.page + 1) + '" ' + (state.page >= pages ? 'disabled' : '') + '>下一页</button>';
    pager.innerHTML = btns;
  }

  function findRow(id) {
    return state.list.find(function (x) { return x.id === Number(id); });
  }

  document.getElementById('btn-search').addEventListener('click', function () {
    state.page = 1;
    render();
  });

  document.getElementById('btn-reset').addEventListener('click', function () {
    startEl.value = '';
    endEl.value = '';
    nameEl.value = '';
    statusEl.value = '';
    state.page = 1;
    render();
  });

  tbody.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-act]');
    if (!btn) return;
    var row = findRow(btn.dataset.id);
    if (!row) return;
    var act = btn.dataset.act;
    if (act === 'detail') {
      location.href = 'decompose-edit.html?id=' + row.id + '&mode=detail';
    } else if (act === 'start') {
      location.href = 'decompose-edit.html?id=' + row.id + '&mode=edit';
    } else if (act === 'update') {
      location.href = 'decompose-update.html?id=' + row.id;
    }
  });

  pager.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-page]');
    if (!btn || btn.disabled) return;
    var p = Number(btn.dataset.page);
    if (!p) return;
    state.page = p;
    render();
  });

  nameEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      state.page = 1;
      render();
    }
  });

  render();
}

function isDecomposeApprovalTarget(row) {
  var ds = row.decomposeStatus || 'wait';
  return isDecomposeTarget(row) && (ds === 'pending' || ds === 'passed' || ds === 'rejected');
}

function initDecomposeApprovalPage() {
  initLayout('decompose-approval');

  var state = {
    list: loadTargets(),
    page: 1,
    pageSize: 10,
    tab: 'pending',
  };

  var startEl = document.getElementById('filter-start');
  var endEl = document.getElementById('filter-end');
  var nameEl = document.getElementById('filter-name');
  var tbody = document.getElementById('table-body');
  var pager = document.getElementById('pager');
  var tabPending = document.getElementById('tab-pending');
  var tabDone = document.getElementById('tab-done');

  startEl.innerHTML = yearOptions('', '开始年份');
  endEl.innerHTML = yearOptions('', '结束年份');

  function byFilter(row) {
    if (!isDecomposeApprovalTarget(row)) return false;
    var start = startEl.value ? Number(startEl.value) : null;
    var end = endEl.value ? Number(endEl.value) : null;
    var name = (nameEl.value || '').trim();
    var y = rangeYear(row.range);
    if (start && (y == null || y < start)) return false;
    if (end && (y == null || y > end)) return false;
    if (name && row.name.indexOf(name) === -1) return false;
    return true;
  }

  function counts() {
    var rows = state.list.filter(byFilter);
    return {
      pending: rows.filter(function (r) { return r.decomposeStatus === 'pending'; }).length,
      done: rows.filter(function (r) {
        return r.decomposeStatus === 'passed' || r.decomposeStatus === 'rejected';
      }).length,
    };
  }

  function filtered() {
    return state.list.filter(function (row) {
      if (!byFilter(row)) return false;
      if (state.tab === 'pending') return row.decomposeStatus === 'pending';
      return row.decomposeStatus === 'passed' || row.decomposeStatus === 'rejected';
    });
  }

  function renderTabs() {
    var c = counts();
    tabPending.textContent = '待审核(' + c.pending + ')';
    tabDone.textContent = '已审核(' + c.done + ')';
    tabPending.classList.toggle('active', state.tab === 'pending');
    tabDone.classList.toggle('active', state.tab === 'done');
  }

  function render() {
    renderTabs();
    var rows = filtered();
    var total = rows.length;
    var pages = Math.max(1, Math.ceil(total / state.pageSize));
    if (state.page > pages) state.page = pages;
    var start = (state.page - 1) * state.pageSize;
    var pageRows = rows.slice(start, start + state.pageSize);

    if (!pageRows.length) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="7">暂无数据</td></tr>';
    } else {
      tbody.innerHTML = pageRows.map(function (row, idx) {
        var st = DECOMPOSE_STATUS_MAP[row.decomposeStatus] || DECOMPOSE_STATUS_MAP.pending;
        var ops = state.tab === 'pending'
          ? '<button type="button" class="op-link" data-act="audit" data-id="' + row.id + '">审核</button>'
          : '<button type="button" class="op-link" data-act="detail" data-id="' + row.id + '">详情</button>';
        return '<tr>'
          + '<td class="col-index">' + (start + idx + 1) + '</td>'
          + '<td>' + row.name + '</td>'
          + '<td>' + row.dimension + '</td>'
          + '<td>' + row.range + '</td>'
          + '<td>' + (row.decomposeSubmittedAt || row.submittedAt || row.updatedAt || '--') + '</td>'
          + '<td><span class="status-text ' + st.cls + '">' + st.label + '</span></td>'
          + '<td class="col-action"><div class="op-links">' + ops + '</div></td>'
          + '</tr>';
      }).join('');
    }

    var btns = '';
    btns += '<span>共 ' + total + ' 条</span>';
    btns += '<button type="button" class="pager-btn" data-page="' + (state.page - 1) + '" ' + (state.page <= 1 ? 'disabled' : '') + '>上一页</button>';
    for (var p = 1; p <= pages; p++) {
      btns += '<button type="button" class="pager-btn' + (p === state.page ? ' active' : '') + '" data-page="' + p + '">' + p + '</button>';
    }
    btns += '<button type="button" class="pager-btn" data-page="' + (state.page + 1) + '" ' + (state.page >= pages ? 'disabled' : '') + '>下一页</button>';
    pager.innerHTML = btns;
  }

  document.getElementById('btn-search').addEventListener('click', function () {
    state.page = 1;
    render();
  });

  document.getElementById('btn-reset').addEventListener('click', function () {
    startEl.value = '';
    endEl.value = '';
    nameEl.value = '';
    state.page = 1;
    render();
  });

  tabPending.addEventListener('click', function () {
    state.tab = 'pending';
    state.page = 1;
    render();
  });

  tabDone.addEventListener('click', function () {
    state.tab = 'done';
    state.page = 1;
    render();
  });

  tbody.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-act]');
    if (!btn) return;
    var row = state.list.find(function (x) { return x.id === Number(btn.dataset.id); });
    if (!row) return;
    location.href = 'decompose-audit.html?id=' + row.id + '&mode=' + btn.dataset.act;
  });

  pager.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-page]');
    if (!btn || btn.disabled) return;
    var p = Number(btn.dataset.page);
    if (!p) return;
    state.page = p;
    render();
  });

  nameEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      state.page = 1;
      render();
    }
  });

  render();
}

function initSubordinatePage() {
  initLayout('create', { pageTitle: '下级目标制定情况' });

  var params = new URLSearchParams(location.search);
  var targetId = Number(params.get('id'));
  var list = loadTargets();
  var target = list.find(function (x) { return x.id === targetId; });

  if (!target || !canShowSubordinateProgress(target)) {
    toast('未找到可查看的下级目标数据');
    setTimeout(function () { location.href = 'index.html'; }, 800);
    return;
  }

  ensureSubordinates(target);
  saveTargets(list);

  var state = {
    target: target,
    list: target.subordinates.slice(),
    page: 1,
    pageSize: 10,
    tab: 'all',
  };

  var nameEl = document.getElementById('filter-short-name');
  var tbody = document.getElementById('table-body');
  var pager = document.getElementById('pager');
  var tabsEl = document.getElementById('status-tabs');

  function countByStatus() {
    var counts = { all: state.list.length, wait: 0, draft: 0, pending: 0, passed: 0, rejected: 0 };
    state.list.forEach(function (row) {
      var key = normalizeSubordinateStatus(row.status);
      if (counts[key] != null) counts[key] += 1;
    });
    return counts;
  }

  function renderTabs() {
    var counts = countByStatus();
    var tabs = [
      { key: 'all', label: '全部' },
      { key: 'wait', label: '待分解' },
      { key: 'draft', label: '编制中' },
      { key: 'pending', label: '待审核' },
      { key: 'passed', label: '已通过' },
      { key: 'rejected', label: '已驳回' },
    ];
    tabsEl.innerHTML = tabs.map(function (t) {
      return '<button type="button" class="status-tab' + (state.tab === t.key ? ' active' : '')
        + '" data-tab="' + t.key + '">' + t.label + '(' + counts[t.key] + ')</button>';
    }).join('');
  }

  function filtered() {
    var name = (nameEl.value || '').trim();
    return state.list.filter(function (row) {
      if (state.tab !== 'all' && normalizeSubordinateStatus(row.status) !== state.tab) return false;
      if (name && row.shortName.indexOf(name) === -1 && row.fullName.indexOf(name) === -1) return false;
      return true;
    });
  }

  function render() {
    renderTabs();
    var rows = filtered();
    var total = rows.length;
    var pages = Math.max(1, Math.ceil(total / state.pageSize));
    if (state.page > pages) state.page = pages;
    var start = (state.page - 1) * state.pageSize;
    var pageRows = rows.slice(start, start + state.pageSize);

    if (!pageRows.length) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="6">暂无数据</td></tr>';
    } else {
      tbody.innerHTML = pageRows.map(function (row, idx) {
        var st = SUBORDINATE_STATUS_MAP[normalizeSubordinateStatus(row.status)] || SUBORDINATE_STATUS_MAP.wait;
        return '<tr>'
          + '<td class="col-index">' + (start + idx + 1) + '</td>'
          + '<td>' + row.shortName + '</td>'
          + '<td>' + row.fullName + '</td>'
          + '<td><span class="status-text ' + st.cls + '">' + st.label + '</span></td>'
          + '<td>' + (row.submittedAt || '--') + '</td>'
          + '<td class="col-action"><div class="op-links">'
          + '<button type="button" class="op-link" data-act="detail" data-id="' + row.id + '">详情</button>'
          + '</div></td>'
          + '</tr>';
      }).join('');
    }

    var btns = '';
    btns += '<span>共 ' + total + ' 条</span>';
    btns += '<select class="pager-size" id="pager-size">'
      + '<option value="10"' + (state.pageSize === 10 ? ' selected' : '') + '>10条/页</option>'
      + '<option value="20"' + (state.pageSize === 20 ? ' selected' : '') + '>20条/页</option>'
      + '</select>';
    btns += '<button type="button" class="pager-btn" data-page="' + (state.page - 1) + '" ' + (state.page <= 1 ? 'disabled' : '') + '>‹</button>';
    btns += '<button type="button" class="pager-btn active" data-page="' + state.page + '">' + state.page + '</button>';
    btns += '<button type="button" class="pager-btn" data-page="' + (state.page + 1) + '" ' + (state.page >= pages ? 'disabled' : '') + '>›</button>';
    btns += '<span class="pager-jump">前往 <input type="number" id="pager-jump" min="1" max="' + pages + '" value="' + state.page + '" /> 页</span>';
    pager.innerHTML = btns;
  }

  document.getElementById('btn-back').addEventListener('click', function () {
    location.href = 'index.html';
  });

  document.getElementById('btn-search').addEventListener('click', function () {
    state.page = 1;
    render();
  });

  document.getElementById('btn-reset').addEventListener('click', function () {
    nameEl.value = '';
    state.tab = 'all';
    state.page = 1;
    render();
  });

  document.getElementById('btn-urge').addEventListener('click', function () {
    var pending = state.list.filter(function (r) {
      var st = normalizeSubordinateStatus(r.status);
      return st === 'wait' || st === 'draft' || st === 'rejected';
    });
    if (!pending.length) {
      toast('当前无需催办的下级单位');
      return;
    }
    toast('已向 ' + pending.length + ' 家未完成单位发送催办');
  });

  tabsEl.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-tab]');
    if (!btn) return;
    state.tab = btn.dataset.tab;
    state.page = 1;
    render();
  });

  tbody.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-act]');
    if (!btn) return;
    var row = state.list.find(function (x) { return x.id === btn.dataset.id; });
    if (!row) return;
    if (btn.dataset.act === 'detail') {
      location.href = 'decompose-edit.html?id=' + state.target.id
        + '&mode=detail&ent=' + encodeURIComponent(row.id)
        + '&from=' + state.target.id;
    }
  });

  pager.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-page]');
    if (!btn || btn.disabled) return;
    var p = Number(btn.dataset.page);
    if (!p) return;
    state.page = p;
    render();
  });

  pager.addEventListener('change', function (e) {
    if (e.target.id === 'pager-size') {
      state.pageSize = Number(e.target.value) || 10;
      state.page = 1;
      render();
    }
  });

  pager.addEventListener('keydown', function (e) {
    if (e.target.id === 'pager-jump' && e.key === 'Enter') {
      var p = Number(e.target.value);
      var pages = Math.max(1, Math.ceil(filtered().length / state.pageSize));
      if (p >= 1 && p <= pages) {
        state.page = p;
        render();
      }
    }
  });

  nameEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      state.page = 1;
      render();
    }
  });

  render();
}

