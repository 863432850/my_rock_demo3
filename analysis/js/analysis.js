/**
 * 碳数据分析 · 同比分析
 */

var ORG_PATH = '河南钢铁集团有限公司 / 河南安钢周口钢铁有限责任公司';
var ORG_NAME = '河南安钢周口钢铁有限责任公司';
var ORG_TYPE = '企业';

var INDUSTRIES = ['钢铁'];
var CATEGORIES = ['炼钢'];
var SUBS = ['粗钢'];
var STANDARDS = ['全国-钢铁企业温室气体核算方法与报告指南'];
var INDICATORS = [
  { id: 'intensity', name: '单位粗钢碳排放量', unit: 'tCO2/t' },
  { id: 'total', name: '碳排放总量', unit: 'tCO2' },
];
var LEVELS = ['企业', '工序', '生产线'];
var LINE_BY_LEVEL = { '企业': '--', '工序': '--', '生产线': '炼钢产线1' };

var DEFAULTS = {
  grain: 'month',
  industry: '钢铁',
  category: '炼钢',
  sub: '粗钢',
  standard: STANDARDS[0],
  indicator: 'intensity',
  start: '2026-01',
  end: '2026-12',
  org: ORG_PATH,
  level: '企业',
};

/** 月度本期值：2026 对齐参考图（1 月 4.04、3 月冲高），其余月份补齐便于季/年切换 */
var RAW_CURRENT = {
  '2025-01': 3.88, '2025-02': 0, '2025-03': 30.40, '2025-04': 0,
  '2025-05': 0, '2025-06': 0, '2025-07': 0, '2025-08': 0,
  '2025-09': 0, '2025-10': 0, '2025-11': 0, '2025-12': 0,
  '2026-01': 4.04, '2026-02': 0, '2026-03': 32.16, '2026-04': 0,
  '2026-05': 0, '2026-06': 0, '2026-07': 0, '2026-08': 0,
  '2026-09': 0, '2026-10': 0, '2026-11': 0, '2026-12': 0,
};

var GRAIN_LABEL = { month: '月', quarter: '季', year: '年', ytd: '年累计' };

function pad(n) { return String(n).padStart(2, '0'); }

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function ymParts(ym) {
  var p = String(ym || '').split('-');
  return { y: Number(p[0]), m: Number(p[1]) };
}

function toYm(y, m) {
  return y + '-' + pad(m);
}

function prevYearYm(ym) {
  var p = ymParts(ym);
  return toYm(p.y - 1, p.m);
}

function eachMonth(start, end) {
  var a = ymParts(start);
  var b = ymParts(end);
  var list = [];
  var y = a.y;
  var m = a.m;
  while (y < b.y || (y === b.y && m <= b.m)) {
    list.push(toYm(y, m));
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return list;
}

function rawValue(ym) {
  var n = RAW_CURRENT[ym];
  return n == null ? 0 : n;
}

function yoyOf(current, last) {
  if (!last) return 0;
  return (current - last) / Math.abs(last) * 100;
}

function fmtNum(n) {
  return (Number(n) || 0).toFixed(2);
}

function fillSelect(el, options, selected) {
  el.innerHTML = options.map(function (opt) {
    var value = typeof opt === 'string' ? opt : opt.id;
    var label = typeof opt === 'string' ? opt : opt.name;
    return '<option value="' + escapeHtml(value) + '"'
      + (value === selected ? ' selected' : '') + '>'
      + escapeHtml(label) + '</option>';
  }).join('');
}

function monthLabel(ym) {
  var p = ymParts(ym);
  return p.y + '年' + p.m + '月';
}

function quarterOf(ym) {
  return Math.ceil(ymParts(ym).m / 3);
}

function quarterKey(ym) {
  var p = ymParts(ym);
  return p.y + '-Q' + quarterOf(ym);
}

function quarterLabel(key) {
  var p = String(key).split('-Q');
  return p[0] + '年' + p[1] + '季度';
}

function yearLabel(y) {
  return y + '年';
}

function indicatorMeta(id) {
  return INDICATORS.find(function (x) { return x.id === id; }) || INDICATORS[0];
}

function scaleMax(values, nice) {
  var max = 0;
  values.forEach(function (v) {
    if (v > max) max = v;
  });
  if (max <= 0) return nice || 1;
  var pad = max * 1.15;
  if (nice && pad < nice) return nice;
  var step = Math.pow(10, Math.floor(Math.log10(pad)));
  return Math.ceil(pad / step) * step;
}

function buildRows(query) {
  var months = eachMonth(query.start, query.end);
  var indicator = indicatorMeta(query.indicator);
  var factor = indicator.id === 'total' ? 1280 : 1;
  var line = LINE_BY_LEVEL[query.level] || '--';
  var groups = [];
  var map = {};

  function add(key, label, ym, current, last) {
    if (!map[key]) {
      map[key] = { key: key, label: label, current: 0, last: 0, sort: ym };
      groups.push(map[key]);
    }
    map[key].current += current;
    map[key].last += last;
  }

  months.forEach(function (ym) {
    var current = rawValue(ym) * factor;
    var last = rawValue(prevYearYm(ym)) * factor;
    if (query.grain === 'month') {
      add(ym, monthLabel(ym), ym, current, last);
    } else if (query.grain === 'quarter') {
      add(quarterKey(ym), quarterLabel(quarterKey(ym)), ym, current, last);
    } else if (query.grain === 'year') {
      var y = String(ymParts(ym).y);
      add(y, yearLabel(y), y + '-01', current, last);
    } else {
      add(ym, monthLabel(ym), ym, current, last);
    }
  });

  if (query.grain === 'ytd') {
    var runC = 0;
    var runL = 0;
    var lastYear = '';
    groups.forEach(function (g) {
      var y = String(g.sort).slice(0, 4);
      if (y !== lastYear) { runC = 0; runL = 0; lastYear = y; }
      runC += g.current;
      runL += g.last;
      g.current = runC;
      g.last = runL;
    });
  }

  return groups.map(function (g, i) {
    return {
      index: i + 1,
      time: g.label,
      orgType: ORG_TYPE,
      orgName: ORG_NAME,
      level: query.level,
      line: line,
      indicator: indicator.name,
      unit: indicator.unit,
      current: g.current,
      last: g.last,
      yoy: yoyOf(g.current, g.last),
    };
  });
}

function axisTicks(max, count) {
  var n = count || 5;
  var ticks = [];
  for (var i = 0; i <= n; i++) ticks.push(max * i / n);
  return ticks;
}

function renderChart(rows, unit, grain) {
  var el = document.getElementById('analysis-chart');
  if (!rows.length) {
    el.innerHTML = '<div class="analysis-chart-empty">暂无统计数据</div>';
    return;
  }

  var w = 980;
  var h = 248;
  var padL = 52;
  var padR = 48;
  var padT = 18;
  var padB = 36;
  var plotW = w - padL - padR;
  var plotH = h - padT - padB;
  var leftMax = scaleMax(rows.map(function (r) { return Math.max(r.current, r.last); }), 40);
  var yoyAbs = scaleMax(rows.map(function (r) { return Math.abs(r.yoy); }), 1);
  var rightMax = yoyAbs;
  var rightMin = 0;
  var hasNeg = rows.some(function (r) { return r.yoy < 0; });
  if (hasNeg) {
    rightMin = -yoyAbs;
    rightMax = yoyAbs;
  }
  var rightSpan = rightMax - rightMin || 1;
  var gap = plotW / rows.length;
  var barW = Math.max(6, Math.min(16, gap * 0.22));

  function xCenter(i) {
    return padL + gap * i + gap / 2;
  }
  function yLeft(v) {
    return padT + plotH - (v / leftMax) * plotH;
  }
  function yRight(v) {
    return padT + plotH - ((v - rightMin) / rightSpan) * plotH;
  }
  function xLabel(row) {
    if (grain === 'month' || grain === 'ytd') {
      var m = String(row.time).match(/(\d+)月/);
      return m ? m[1] + '月' : row.time;
    }
    if (grain === 'quarter') {
      var q = String(row.time).match(/(\d+)季度/);
      return q ? q[1] + '季度' : row.time;
    }
    return row.time;
  }

  var leftTicks = axisTicks(leftMax, 4);
  var rightTicks = axisTicks(rightSpan, 4).map(function (t) { return rightMin + t; });

  var svg = [];
  svg.push('<svg viewBox="0 0 ' + w + ' ' + h + '" class="analysis-svg" preserveAspectRatio="xMidYMid meet">');
  svg.push('<text x="8" y="14" class="analysis-axis-unit">单位: ' + escapeHtml(unit) + '</text>');
  svg.push('<text x="' + (w - 8) + '" y="14" class="analysis-axis-unit" text-anchor="end">单位: %</text>');

  leftTicks.forEach(function (t) {
    var y = yLeft(t);
    svg.push('<line x1="' + padL + '" y1="' + y + '" x2="' + (w - padR) + '" y2="' + y + '" class="analysis-grid" />');
    svg.push('<text x="' + (padL - 8) + '" y="' + (y + 4) + '" class="analysis-axis-label" text-anchor="end">' + fmtNum(t) + '</text>');
  });
  rightTicks.forEach(function (t) {
    var y = yRight(t);
    svg.push('<text x="' + (w - padR + 8) + '" y="' + (y + 4) + '" class="analysis-axis-label">' + fmtNum(t) + '</text>');
  });

  var points = [];
  rows.forEach(function (r, i) {
    var cx = xCenter(i);
    var x1 = cx - barW - 1;
    var x2 = cx + 1;
    var yC = yLeft(r.current);
    var yL = yLeft(r.last);
    var hC = Math.max(0, padT + plotH - yC);
    var hL = Math.max(0, padT + plotH - yL);
    svg.push('<rect x="' + x1 + '" y="' + yC + '" width="' + barW + '" height="' + hC + '" rx="1" class="analysis-bar-current">');
    svg.push('<title>本期 ' + r.time + ': ' + fmtNum(r.current) + ' ' + unit + '</title></rect>');
    svg.push('<rect x="' + x2 + '" y="' + yL + '" width="' + barW + '" height="' + hL + '" rx="1" class="analysis-bar-last">');
    svg.push('<title>同期 ' + r.time + ': ' + fmtNum(r.last) + ' ' + unit + '</title></rect>');
    points.push({ x: cx, y: yRight(r.yoy), v: r.yoy, time: r.time });
    svg.push('<text x="' + cx + '" y="' + (h - 10) + '" class="analysis-x-label" text-anchor="middle">' + escapeHtml(xLabel(r)) + '</text>');
  });

  if (points.length) {
    var d = points.map(function (p, i) {
      return (i === 0 ? 'M' : 'L') + p.x + ' ' + p.y;
    }).join(' ');
    svg.push('<path d="' + d + '" class="analysis-yoy-line" />');
    points.forEach(function (p) {
      svg.push('<circle cx="' + p.x + '" cy="' + p.y + '" r="3.5" class="analysis-yoy-dot">');
      svg.push('<title>同比增长 ' + p.time + ': ' + fmtNum(p.v) + '%</title></circle>');
    });
  }

  svg.push('</svg>');
  el.innerHTML = svg.join('');
}

function yoyWarnIcon() {
  return '<span class="diff-warn" title="同比增长超过设定阈值">'
    + '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">'
    + '<path fill="currentColor" d="M12 3L1.5 21h21L12 3zm0 5.5c.55 0 1 .4 1 .9v4.2c0 .5-.45.9-1 .9s-1-.4-1-.9V9.4c0-.5.45-.9 1-.9zm0 8.5a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2z"/>'
    + '</svg></span>';
}

function renderYoyCell(yoy, threshold) {
  var exceed = Number(yoy) > Number(threshold);
  return '<td class="analysis-yoy-cell' + (exceed ? ' is-yoy-exceed' : '') + '">'
    + '<div class="diff-cell-inner">'
    + '<span class="diff-warn-slot">' + (exceed ? yoyWarnIcon() : '') + '</span>'
    + '<span class="diff-value">' + fmtNum(yoy) + '</span>'
    + '</div></td>';
}

function visibleRows(rows, tableOrg) {
  return rows.filter(function (r) {
    return !tableOrg || tableOrg === r.orgName;
  });
}

function renderTable(rows, tableOrg, threshold) {
  var body = document.getElementById('analysis-table-body');
  var list = visibleRows(rows, tableOrg);
  if (!list.length) {
    body.innerHTML = '<tr><td colspan="11" class="analysis-empty">暂无匹配数据</td></tr>';
    return;
  }
  body.innerHTML = list.map(function (r, i) {
    return '<tr>'
      + '<td>' + (i + 1) + '</td>'
      + '<td>' + escapeHtml(r.time) + '</td>'
      + '<td>' + escapeHtml(r.orgType) + '</td>'
      + '<td>' + escapeHtml(r.orgName) + '</td>'
      + '<td>' + escapeHtml(r.level) + '</td>'
      + '<td>' + escapeHtml(r.line) + '</td>'
      + '<td>' + escapeHtml(r.indicator) + '</td>'
      + '<td>' + escapeHtml(r.unit) + '</td>'
      + '<td class="is-num">' + fmtNum(r.current) + '</td>'
      + '<td class="is-num">' + fmtNum(r.last) + '</td>'
      + renderYoyCell(r.yoy, threshold)
      + '</tr>';
  }).join('');
}

function initAnalysisPage() {
  initLayout('yoy', { moduleId: 'analysis', pageTitle: '同比分析' });

  var query = Object.assign({}, DEFAULTS);
  var rows = [];
  var threshold = 5;
  var thresholdModal = document.getElementById('an-threshold-modal');
  var thresholdInput = document.getElementById('an-threshold-input');

  function currentTableOrg() {
    return document.getElementById('an-table-org').value;
  }

  function paintTable() {
    renderTable(rows, currentTableOrg(), threshold);
  }

  function readForm() {
    return {
      grain: query.grain,
      industry: document.getElementById('an-industry').value,
      category: document.getElementById('an-category').value,
      sub: document.getElementById('an-sub').value,
      standard: document.getElementById('an-standard').value,
      indicator: document.getElementById('an-indicator').value,
      start: document.getElementById('an-start').value || DEFAULTS.start,
      end: document.getElementById('an-end').value || DEFAULTS.end,
      org: document.getElementById('an-org').value,
      level: document.getElementById('an-level').value,
    };
  }

  function writeForm(state) {
    document.getElementById('an-industry').value = state.industry;
    document.getElementById('an-category').value = state.category;
    document.getElementById('an-sub').value = state.sub;
    document.getElementById('an-standard').value = state.standard;
    document.getElementById('an-indicator').value = state.indicator;
    document.getElementById('an-start').value = state.start;
    document.getElementById('an-end').value = state.end;
    document.getElementById('an-org').value = state.org;
    document.getElementById('an-level').value = state.level;
  }

  function normalizeRange(state) {
    if (state.start && state.end && state.start > state.end) {
      var tmp = state.start;
      state.start = state.end;
      state.end = tmp;
    }
  }

  function applyQuery() {
    query = readForm();
    query.grain = query.grain || DEFAULTS.grain;
    normalizeRange(query);
    writeForm(query);
    rows = buildRows(query);
    var unit = indicatorMeta(query.indicator).unit;
    renderChart(rows, unit, query.grain);
    paintTable();
  }

  function renderGrain() {
    document.querySelectorAll('.analysis-grain-tab').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-grain') === query.grain);
    });
  }

  fillSelect(document.getElementById('an-industry'), INDUSTRIES, DEFAULTS.industry);
  fillSelect(document.getElementById('an-category'), CATEGORIES, DEFAULTS.category);
  fillSelect(document.getElementById('an-sub'), SUBS, DEFAULTS.sub);
  fillSelect(document.getElementById('an-standard'), STANDARDS, DEFAULTS.standard);
  fillSelect(document.getElementById('an-indicator'), INDICATORS, DEFAULTS.indicator);
  fillSelect(document.getElementById('an-org'), [ORG_PATH], DEFAULTS.org);
  fillSelect(document.getElementById('an-level'), LEVELS, DEFAULTS.level);
  fillSelect(document.getElementById('an-table-org'), [ORG_NAME], ORG_NAME);
  writeForm(DEFAULTS);
  renderGrain();
  applyQuery();

  document.getElementById('analysis-grain').addEventListener('click', function (e) {
    var btn = e.target.closest('.analysis-grain-tab');
    if (!btn) return;
    query.grain = btn.getAttribute('data-grain');
    renderGrain();
    applyQuery();
  });

  document.getElementById('btn-an-search').addEventListener('click', function () {
    applyQuery();
    toast('查询完成');
  });

  document.getElementById('btn-an-reset').addEventListener('click', function () {
    query = Object.assign({}, DEFAULTS);
    writeForm(query);
    renderGrain();
    applyQuery();
    toast('已重置');
  });

  document.getElementById('an-table-org').addEventListener('change', function () {
    paintTable();
  });

  function openThresholdModal() {
    thresholdInput.value = String(threshold);
    thresholdModal.classList.add('show');
    thresholdInput.focus();
    thresholdInput.select();
  }

  function closeThresholdModal() {
    thresholdModal.classList.remove('show');
  }

  document.getElementById('btn-an-threshold').addEventListener('click', openThresholdModal);
  document.getElementById('btn-an-threshold-close').addEventListener('click', closeThresholdModal);
  document.getElementById('btn-an-threshold-cancel').addEventListener('click', closeThresholdModal);
  document.getElementById('btn-an-threshold-ok').addEventListener('click', function () {
    var val = Number(thresholdInput.value);
    if (isNaN(val) || val < 0 || val > 100) {
      toast('请输入 0~100 之间的阈值');
      return;
    }
    threshold = val;
    closeThresholdModal();
    paintTable();
    toast('同比阈值已设为 ' + val + '%');
  });
  thresholdModal.addEventListener('click', function (e) {
    if (e.target === thresholdModal) closeThresholdModal();
  });

  document.getElementById('btn-an-push').addEventListener('click', function () {
    toast('已将同比超阈值数据推送至消息中心');
  });

  document.getElementById('btn-an-export').addEventListener('click', function () {
    toast('已导出（演示）');
  });

  document.getElementById('btn-an-layout').addEventListener('click', function () {
    document.getElementById('analysis-chart-card').classList.toggle('is-collapsed');
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && thresholdModal.classList.contains('show')) {
      closeThresholdModal();
    }
  });
}

if (document.querySelector('.analysis-page')) initAnalysisPage();
