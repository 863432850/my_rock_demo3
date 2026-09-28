/**
 * 碳排放异动分析 · 报告渲染
 * - URL 参数：?month=2026-06（缺省取当前演示月）
 * - 封面企业名固定为当前企业；年月随参数动态变化
 * - 月度排放量与「双碳管理月度简报」同一数据源（平台口径一致）
 * - 日级排放与异动事件按「年×100+月」为种子稳定生成（演示），同一月份多次打开结果一致
 * - 「下载报告（PDF）」用 html2canvas 逐页渲染 + jsPDF 切片生成
 */

(function () {
  'use strict';

  var ORG = '河南安钢周口钢铁有限责任公司';
  var GREEN = '#00b42a';
  var PALETTE = ['#00b42a', '#165dff', '#ff7d00', '#f53f3f', '#722ed1', '#0fc6c2', '#86909c', '#ffb01f'];

  /* ---------- 基础工具 ---------- */

  function pad2(n) { return String(n).padStart(2, '0'); }
  function lastDay(y, m) { return new Date(y, m, 0).getDate(); }
  function fmt(n, d) {
    return Number(n).toLocaleString('zh-CN', { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  /** 可复现伪随机（同一 seed 多次生成结果一致） */
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- 月份参数 ---------- */

  var qs = new URLSearchParams(location.search);
  var monthParam = qs.get('month') || '2026-06';
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monthParam)) monthParam = '2026-06';
  var Y = Number(monthParam.slice(0, 4));
  var M = Number(monthParam.slice(5, 7));
  var MONTH_CN = Y + '年' + M + '月';
  var DAYS = lastDay(Y, M);

  /* ---------- 月度排放数据（与双碳简报同源：年累计，万t） ---------- */

  var CUM_CUR = [212.47, 422.89, 812.09, 1369.79, 1987.13, 2547.61, 3122.81, 3720.91, 4287.31, 4876.21, 5447.51, 6058.01];
  var CUM_PREV = [199.38, 314.34, 712.01, 1342.22, 1933.17, 2345.35, 2758.17, 3188.17, 3593.17, 4038.17, 4458.17, 4918.17];

  /** 当月排放量（万t，非累计） */
  function monthVal(cum, i) { return +(i === 0 ? cum[0] : cum[i] - cum[i - 1]).toFixed(2); }

  var CUR_MONTH = monthVal(CUM_CUR, M - 1);                       // 本月排放量（万t）
  var PREV_YEAR_MONTH = monthVal(CUM_PREV, M - 1);                // 去年同月（万t）
  var PREV_MONTH = M === 1 ? null : monthVal(CUM_CUR, M - 2);     // 上月（万t）
  var YOY = (CUR_MONTH - PREV_YEAR_MONTH) / PREV_YEAR_MONTH * 100;
  var MOM = PREV_MONTH ? (CUR_MONTH - PREV_MONTH) / PREV_MONTH * 100 : 0;

  /* ---------- 排放源与归因 ---------- */

  var SOURCES = [
    { name: '高炉炼铁', share: 0.42 },
    { name: '自备电厂', share: 0.16 },
    { name: '烧结工序', share: 0.14 },
    { name: '转炉炼钢', share: 0.12 },
    { name: '轧钢工序', share: 0.08 },
    { name: '外购电力（间接）', share: 0.08 }
  ];

  var CAUSE_UP = [
    '高炉休风复风后产量爬坡，燃料消耗短时上升',
    '焦炭配比上调，燃料结构变化推高排放',
    '烧结机临时提产，固体燃料消耗增加',
    '订单集中交付，工序满负荷运行',
    '外购电量增加，间接排放上升',
    '环保设施短时旁路运行'
  ];
  var CAUSE_DOWN = [
    '工序计划检修，降负荷运行',
    '高炉按计划休风',
    '绿电使用比例提升，间接排放下降',
    '余热回收装置投运，能源效率提升',
    '产量临时调减'
  ];

  /* ---------- 日级排放与异动生成（种子 = Y*100+M，稳定可复现） ---------- */

  /** 生成指定月份的日排放与异动清单 */
  function genMonth(y, m) {
    var days = lastDay(y, m);
    var total = monthVal(CUM_CUR, m - 1);            // 万t
    var base = total * 10000 / days;                  // 月日均（t）
    var rnd = mulberry32(y * 100 + m);

    // 正常日：±5% 噪声
    var daily = [];
    for (var d = 1; d <= days; d++) {
      daily.push(base * (0.95 + rnd() * 0.10));
    }

    // 注入异动：4-7 天，偏离度 15.5%-38%，70% 向上
    var count = 4 + Math.floor(rnd() * 4);
    var used = {};
    var events = [];
    for (var k = 0; k < count; k++) {
      var day = 1 + Math.floor(rnd() * days);
      while (used[day]) day = day % days + 1;
      used[day] = true;

      var up = rnd() < 0.7;
      var dev = (15.5 + rnd() * 22.5) * (up ? 1 : -1); // 偏离度 %
      daily[day - 1] = base * (1 + dev / 100);

      // 按权重抽取排放源
      var roll = rnd(), acc = 0, src = SOURCES[0].name;
      for (var s = 0; s < SOURCES.length; s++) {
        acc += SOURCES[s].share;
        if (roll <= acc) { src = SOURCES[s].name; break; }
      }

      var absDev = Math.abs(dev);
      var level = absDev >= 30 ? 3 : (absDev >= 22 ? 2 : 1);
      var causes = up ? CAUSE_UP : CAUSE_DOWN;
      var cause = causes[Math.floor(rnd() * causes.length)];

      events.push({
        day: day,
        source: src,
        amount: daily[day - 1],
        base: base,
        dev: dev,
        level: level,
        cause: cause
      });
    }
    events.sort(function (a, b) { return a.day - b.day; });
    return { days: days, base: base, daily: daily, events: events, total: total };
  }

  var DATA = genMonth(Y, M);
  var PREV_DATA = M === 1 ? null : genMonth(Y, M - 1);

  var LEVEL_NAME = { 1: '一般', 2: '较大', 3: '重大' };
  var LEVEL_COLOR = { 1: '#165dff', 2: '#ff7d00', 3: '#f53f3f' };

  function levelCount(lv) {
    return DATA.events.filter(function (e) { return e.level === lv; }).length;
  }

  /** 综合预警级别：有重大→重点关注；较大≥2→关注；否则→平稳 */
  function warnLevel() {
    if (levelCount(3) > 0) return { name: '重点关注', cls: 'is-pos' };
    if (levelCount(2) >= 2) return { name: '关注', cls: 'is-pos' };
    return { name: '总体平稳', cls: 'is-neg' };
  }

  /* ---------- SVG 折线图（通用） ---------- */

  function lineChart(labels, series, opts) {
    opts = opts || {};
    var W = 760, H = opts.height || 250;
    var P = { t: 34, r: 18, b: 32, l: 56 };
    var iw = W - P.l - P.r, ih = H - P.t - P.b;
    var dec = opts.decimals == null ? 2 : opts.decimals;

    var min = Infinity, max = -Infinity;
    series.forEach(function (s) {
      s.values.forEach(function (v) {
        if (v == null) return;
        if (v < min) min = v;
        if (v > max) max = v;
      });
    });
    if (!isFinite(min)) { min = 0; max = 1; }
    var span = max - min || Math.abs(max) || 1;
    min -= span * 0.12; max += span * 0.12;

    function x(i) { return P.l + (labels.length <= 1 ? iw / 2 : iw * i / (labels.length - 1)); }
    function y(v) { return P.t + ih * (1 - (v - min) / (max - min)); }

    var out = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg">';
    for (var g = 0; g <= 4; g++) {
      var gv = min + (max - min) * g / 4;
      var gy = y(gv);
      out += '<line x1="' + P.l + '" y1="' + gy + '" x2="' + (W - P.r) + '" y2="' + gy + '" stroke="' + (g === 0 ? '#c9cdd4' : '#eef1f4') + '"/>';
      out += '<text x="' + (P.l - 8) + '" y="' + (gy + 4) + '" font-size="10.5" fill="#98a1ab" text-anchor="end">' + fmt(gv, dec) + '</text>';
    }
    labels.forEach(function (lb, i) {
      out += '<text x="' + x(i) + '" y="' + (H - 10) + '" font-size="10.5" fill="#98a1ab" text-anchor="middle">' + esc(lb) + '</text>';
    });
    var lx = W - P.r;
    for (var li = series.length - 1; li >= 0; li--) {
      var name = series[li].name;
      var w = name.length * 11 + 26;
      lx -= w;
      out += '<rect x="' + lx + '" y="8" width="14" height="4" rx="2" fill="' + series[li].color + '"/>';
      out += '<text x="' + (lx + 19) + '" y="14" font-size="11" fill="#606266">' + esc(name) + '</text>';
    }
    series.forEach(function (s) {
      var pts = [];
      s.values.forEach(function (v, i) { if (v != null) pts.push(x(i) + ',' + y(v)); });
      out += '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + s.color + '" stroke-width="2" stroke-linejoin="round"'
        + (s.dash ? ' stroke-dasharray="6 4"' : '') + '/>';
      s.values.forEach(function (v, i) {
        if (v == null) return;
        out += '<circle cx="' + x(i) + '" cy="' + y(v) + '" r="3" fill="#fff" stroke="' + s.color + '" stroke-width="2"/>';
      });
    });
    return out + '</svg>';
  }

  /* ---------- 日排放趋势图（含基线 + 异动点标红） ---------- */

  function dailyChart() {
    var labels = DATA.daily.map(function (_, i) { return pad2(M) + '-' + pad2(i + 1); });
    var svg = lineChart(labels, [
      { name: '日排放量', color: GREEN, values: DATA.daily.map(function (v) { return +v.toFixed(0); }) },
      { name: '月日均基线', color: '#86909c', values: DATA.daily.map(function () { return +DATA.base.toFixed(0); }), dash: true }
    ], { decimals: 0, height: 260 });

    // 在折线图基础上叠加异动标注点（简化：用独立说明替代逐点定位）
    return '<div class="chart-box">' + svg + '</div>'
      + '<div class="chart-caption">（图）' + MONTH_CN + '日排放量趋势（单位：t；红字日期为异动日：'
      + DATA.events.map(function (e) { return pad2(M) + '-' + pad2(e.day); }).join('、') + '）</div>';
  }

  /* ---------- 横向条形图 ---------- */

  function hbars(items, unit) {
    var max = 0;
    items.forEach(function (it) { if (it.value > max) max = it.value; });
    max = max || 1;
    var html = '<div class="hbars">';
    items.forEach(function (it, i) {
      var pct = Math.max(0.5, it.value / max * 100);
      var color = it.color || PALETTE[i % PALETTE.length];
      html += '<div class="hbar-row">'
        + '<span class="hbar-label">' + esc(it.name) + '</span>'
        + '<span class="hbar-track"><span class="hbar-fill" style="width:' + pct.toFixed(1) + '%;background:' + color + '"></span></span>'
        + '<span class="hbar-val">' + fmt(it.value, it.dec == null ? 2 : it.dec) + (unit ? ' ' + unit : '') + '</span>'
        + '</div>';
    });
    return html + '</div>';
  }

  /* ---------- 环形图 ---------- */

  function donut(items, centerLabel, unitName) {
    var total = 0;
    items.forEach(function (it) { total += it.value; });
    total = total || 1;
    var R = 70, C = 2 * Math.PI * R, acc = 0;
    var svg = '<svg viewBox="0 0 180 180" xmlns="http://www.w3.org/2000/svg">'
      + '<circle cx="90" cy="90" r="' + R + '" fill="none" stroke="#f2f4f7" stroke-width="30"/>';
    items.forEach(function (it, i) {
      var frac = it.value / total;
      if (frac <= 0) return;
      var len = Math.max(frac * C - 1.5, 0.8);
      svg += '<circle cx="90" cy="90" r="' + R + '" fill="none" stroke="' + (it.color || PALETTE[i % PALETTE.length]) + '" stroke-width="30"'
        + ' stroke-dasharray="' + len + ' ' + (C - len) + '" stroke-dashoffset="' + (-acc * C) + '" transform="rotate(-90 90 90)"/>';
      acc += frac;
    });
    svg += '<text x="90" y="86" font-size="12" fill="#8a9199" text-anchor="middle">' + esc(centerLabel || '总量') + '</text>'
      + '<text x="90" y="106" font-size="15" font-weight="700" fill="#1a1a1a" text-anchor="middle">' + fmt(total, total >= 100 ? 0 : 2) + '</text></svg>';

    var legend = '<ul class="donut-legend">';
    items.forEach(function (it, i) {
      legend += '<li><span class="dot" style="background:' + (it.color || PALETTE[i % PALETTE.length]) + '"></span>'
        + esc(it.name) + '<span class="val">' + fmt(it.value, it.dec == null ? 2 : it.dec) + ' ' + (unitName || '') + '（' + (it.value / total * 100).toFixed(2) + '%）</span></li>';
    });
    return '<div class="donut-wrap">' + svg + legend + '</ul></div>';
  }

  function chartBlock(innerHtml, caption) {
    return '<div class="chart-box">' + innerHtml + '</div><div class="chart-caption">' + esc(caption) + '</div>';
  }

  /* ---------- 文案区块 ---------- */

  function deltaHtml(pct, label) {
    var cls = pct > 0 ? 'is-pos' : (pct < 0 ? 'is-neg' : 'is-flat');
    var arrow = pct > 0 ? '▲' : (pct < 0 ? '▼' : '—');
    return '<div class="kpi-delta ' + cls + '">' + label + ' ' + arrow + ' ' + (pct > 0 ? '+' : '') + fmt(pct, 2) + '%</div>';
  }

  function lvBadge(lv) {
    return '<span class="lv lv-' + lv + '">' + LEVEL_NAME[lv] + '</span>';
  }

  /** 摘要 · 本月异动概览 */
  function summaryHtml() {
    var maxDev = 0;
    DATA.events.forEach(function (e) { if (Math.abs(e.dev) > Math.abs(maxDev)) maxDev = e.dev; });
    var warn = warnLevel();
    var upDays = DATA.events.filter(function (e) { return e.dev > 0; }).length;

    var html = '<div class="kpi-grid">'
      + '<div class="kpi-card"><div class="kpi-name">本月碳排放量</div><div class="kpi-val">' + fmt(CUR_MONTH, 2) + '<small> 万t</small></div>' + (M === 1 ? '<div class="kpi-delta is-flat">全年开局基线</div>' : deltaHtml(MOM, '环比')) + '</div>'
      + '<div class="kpi-card"><div class="kpi-name">去年同月排放量</div><div class="kpi-val">' + fmt(PREV_YEAR_MONTH, 2) + '<small> 万t</small></div>' + deltaHtml(YOY, '同比') + '</div>'
      + '<div class="kpi-card"><div class="kpi-name">月日均排放量</div><div class="kpi-val">' + fmt(DATA.base, 0) + '<small> t/日</small></div><div class="kpi-delta is-flat">异动判定基线</div></div>'
      + '<div class="kpi-card"><div class="kpi-name">本月异动天数</div><div class="kpi-val">' + DATA.events.length + '<small> 天</small></div><div class="kpi-delta is-flat">向上异动 ' + upDays + ' 天 / 向下 ' + (DATA.events.length - upDays) + ' 天</div></div>'
      + '<div class="kpi-card"><div class="kpi-name">最大偏离度</div><div class="kpi-val">' + (maxDev > 0 ? '+' : '') + fmt(maxDev, 1) + '<small> %</small></div><div class="kpi-delta ' + (maxDev > 0 ? 'is-pos' : 'is-neg') + '">' + (maxDev > 0 ? '向上偏离' : '向下偏离') + '</div></div>'
      + '<div class="kpi-card"><div class="kpi-name">综合预警级别</div><div class="kpi-val">' + warn.name + '</div><div class="kpi-delta ' + warn.cls + '">重大 ' + levelCount(3) + ' 起 / 较大 ' + levelCount(2) + ' 起 / 一般 ' + levelCount(1) + ' 起</div></div>'
      + '</div>';

    html += '<div class="summary-cols"><div class="col-left"><h3>本月异动要点</h3><ul class="point-list">'
      + '<li>本月碳排放量 <strong>' + fmt(CUR_MONTH, 2) + '</strong> 万t，环比 ' + (M === 1 ? '—（年初基线）' : (MOM > 0 ? '+' : '') + fmt(MOM, 2) + '%') + '，同比 ' + (YOY > 0 ? '+' : '') + fmt(YOY, 2) + '%。</li>'
      + '<li>全月共识别排放异动 <strong>' + DATA.events.length + '</strong> 天，其中重大 ' + levelCount(3) + ' 起、较大 ' + levelCount(2) + ' 起、一般 ' + levelCount(1) + ' 起。</li>'
      + '<li>最大偏离发生在 <strong>' + pad2(M) + '-' + pad2(topEvent().day) + '</strong>（' + esc(topEvent().source) + '），偏离月日均基线 ' + (topEvent().dev > 0 ? '+' : '') + fmt(topEvent().dev, 1) + '%。</li>'
      + '<li>综合研判：本月排放管控形势为「<strong>' + warn.name + '</strong>」，' + (warn.name === '总体平稳' ? '各项异动均在可控范围内。' : '需按本报告第五章建议落实核查与处置。') + '</li>'
      + '</ul></div>'
      + '<div class="col-right"><h3>异动等级分布</h3>'
      + donut([
        { name: '重大异动', value: levelCount(3), color: LEVEL_COLOR[3], dec: 0 },
        { name: '较大异动', value: levelCount(2), color: LEVEL_COLOR[2], dec: 0 },
        { name: '一般异动', value: levelCount(1), color: LEVEL_COLOR[1], dec: 0 }
      ], '异动(天)', '天')
      + '</div></div>';
    return html;
  }

  function topEvent() {
    var top = DATA.events[0];
    DATA.events.forEach(function (e) { if (Math.abs(e.dev) > Math.abs(top.dev)) top = e; });
    return top;
  }

  /** 一、（一）月度排放趋势：月度表 + 图 */
  function monthlyTrendHtml() {
    var labels = [], curVals = [], prevVals = [];
    for (var i = 0; i < M; i++) {
      labels.push(Y + '-' + pad2(i + 1));
      curVals.push(monthVal(CUM_CUR, i));
      prevVals.push(monthVal(CUM_PREV, i));
    }
    var html = chartBlock(lineChart(labels, [
      { name: '本期（' + Y + '）', color: GREEN, values: curVals },
      { name: '同期（' + (Y - 1) + '）', color: '#165dff', values: prevVals }
    ]), '（图）月度碳排放量趋势（单位：万t）');

    html += '<div class="table-caption"><span>月度碳排放量明细表（当月口径）</span><span class="unit">单位：万t</span></div>'
      + '<table class="btable"><thead><tr><th>月份</th><th>本期</th><th>同期</th><th>同比变化值</th><th>同比(%)</th><th>上月</th><th>环比变化值</th><th>环比(%)</th></tr></thead><tbody>';
    for (var j = 0; j < M; j++) {
      var cur = monthVal(CUM_CUR, j);
      var prev = monthVal(CUM_PREV, j);
      var ring = j === 0 ? null : monthVal(CUM_CUR, j - 1);
      function num(v, signed) {
        if (v == null) return '<td>--</td>';
        var cls = v > 0 ? 'is-pos' : (v < 0 ? 'is-neg' : '');
        return '<td class="' + cls + '">' + (signed && v > 0 ? '+' : '') + fmt(v, 2) + '</td>';
      }
      html += '<tr><td>' + Y + '-' + pad2(j + 1) + '</td>'
        + '<td>' + fmt(cur, 2) + '</td>'
        + '<td>' + fmt(prev, 2) + '</td>'
        + num(cur - prev, true)
        + num((cur - prev) / prev * 100, true)
        + (ring == null ? '<td>--</td>' : '<td>' + fmt(ring, 2) + '</td>')
        + (ring == null ? '<td>--</td>' : num(cur - ring, true))
        + (ring == null ? '<td>--</td>' : num((cur - ring) / ring * 100, true))
        + '</tr>';
    }
    html += '</tbody></table>';
    return html;
  }

  /** 一、（二）异动判定规则 */
  function ruleHtml() {
    var upper = DATA.base * 1.15, lower = DATA.base * 0.85;
    var html = '<p class="brief-p">本报告按日开展碳排放异动识别：以当月日排放量均值 <strong>' + fmt(DATA.base, 0) + '</strong> t/日为基线，'
      + '当日排放量偏离基线 <strong>±15%</strong>（即超出 ' + fmt(lower, 0) + ' ~ ' + fmt(upper, 0) + ' t/日区间）时判定为异动，并按偏离程度分为三级：</p>'
      + '<table class="btable"><thead><tr><th>等级</th><th>判定标准（偏离度绝对值）</th><th>处置要求</th></tr></thead><tbody>'
      + '<tr><td>' + lvBadge(3) + '</td><td>≥ 30%</td><td>24 小时内完成现场核查，形成专项说明报公司碳排放管理组</td></tr>'
      + '<tr><td>' + lvBadge(2) + '</td><td>22% ~ 30%（含 22%）</td><td>3 个工作日内完成数据复核与归因分析</td></tr>'
      + '<tr><td>' + lvBadge(1) + '</td><td>15% ~ 22%（含 15%）</td><td>纳入日常监测台账，月度例会通报</td></tr>'
      + '</tbody></table>'
      + '<div class="btable-note">注：偏离度 =（当日排放量 − 月日均排放量）÷ 月日均排放量 × 100%；计量仪表校验、计划检修等已知因素导致的波动仍纳入清单并标注归因。</div>';
    return html;
  }

  /** 二、本月异动清单 */
  function eventTableHtml() {
    var html = '<div class="table-caption"><span>' + MONTH_CN + '碳排放异动清单</span><span class="unit">共 ' + DATA.events.length + ' 起，单位：t</span></div>'
      + '<table class="btable"><thead><tr>'
      + '<th>序号</th><th>日期</th><th>排放源</th><th>当日排放量</th><th>月日均基线</th><th>偏离度</th><th>等级</th><th>初步归因</th>'
      + '</tr></thead><tbody>';
    DATA.events.forEach(function (e, i) {
      html += '<tr><td>' + (i + 1) + '</td>'
        + '<td>' + Y + '-' + pad2(M) + '-' + pad2(e.day) + '</td>'
        + '<td>' + esc(e.source) + '</td>'
        + '<td>' + fmt(e.amount, 0) + '</td>'
        + '<td>' + fmt(e.base, 0) + '</td>'
        + '<td class="' + (e.dev > 0 ? 'is-pos' : 'is-neg') + '">' + (e.dev > 0 ? '+' : '') + fmt(e.dev, 1) + '%</td>'
        + '<td>' + lvBadge(e.level) + '</td>'
        + '<td style="text-align:left">' + esc(e.cause) + '</td></tr>';
    });
    return html + '</tbody></table>';
  }

  /** 三、排放源结构分析 */
  function sourceHtml() {
    var rnd = mulberry32(Y * 100 + M + 9);
    var items = SOURCES.map(function (s) {
      var jitter = 0.92 + rnd() * 0.16;
      return { name: s.name, value: +(CUR_MONTH * s.share * jitter).toFixed(2) };
    });
    var html = '<p class="brief-p">本月各排放源排放结构如下（按工序归集，合计 ' + fmt(CUR_MONTH, 2) + ' 万t）：</p>'
      + chartBlock(donut(items, '本月排放(万t)', '万t'), '（图）' + MONTH_CN + '排放源结构（单位：万t）');

    if (PREV_DATA) {
      html += '<p class="brief-p">与上月对比：</p>'
        + chartBlock(hbars(items.map(function (it) {
          var prevVal = +(PREV_MONTH * SOURCES.filter(function (s) { return s.name === it.name; })[0].share).toFixed(2);
          return { name: it.name + '（上月 ' + fmt(prevVal, 2) + '）', value: it.value, dec: 2 };
        }), '万t'), '（图）各排放源本月排放量（条内数值为本月，标签括注上月，单位：万t）');
    }
    return html;
  }

  /** 四、重点异动事件详析（偏离度 Top3） */
  function topEventsHtml() {
    var tops = DATA.events.slice().sort(function (a, b) { return Math.abs(b.dev) - Math.abs(a.dev); }).slice(0, 3);
    var html = '';
    tops.forEach(function (e, i) {
      var dir = e.dev > 0 ? '异常升高' : '异常下降';
      var impact = Math.abs(e.amount - e.base);
      html += '<div class="event-card lv-' + e.level + '">'
        + '<div class="ev-title">事件 ' + (i + 1) + '：' + Y + '-' + pad2(M) + '-' + pad2(e.day) + ' ' + esc(e.source) + '排放量' + dir + ' ' + lvBadge(e.level) + '</div>'
        + '<div class="ev-row"><b>异动表现：</b>当日排放量 ' + fmt(e.amount, 0) + ' t，较月日均基线 ' + fmt(e.base, 0) + ' t ' + (e.dev > 0 ? '增加' : '减少') + ' ' + fmt(impact, 0) + ' t，偏离度 ' + (e.dev > 0 ? '+' : '') + fmt(e.dev, 1) + '%。</div>'
        + '<div class="ev-row"><b>归因分析：</b>' + esc(e.cause) + '。经与生产记录、能源计量数据交叉核对，当日产量、主要燃料消耗与该排放源排放波动方向一致，数据链条完整。</div>'
        + '<div class="ev-row"><b>影响评估：</b>该异动对全月排放总量的影响约 ' + fmt(impact / 10000, 2) + ' 万t（占月总量 ' + fmt(impact / (CUR_MONTH * 10000) * 100, 2) + '%），' + (e.level === 3 ? '影响显著，需重点跟踪后续走势。' : '对月度总量影响有限。') + '</div>'
        + '</div>';
    });
    return html;
  }

  /** 五、处置建议与闭环跟踪 */
  function actionHtml() {
    var html = '<h2 class="brief-h2">（一）上月异动处置闭环情况</h2>';
    if (!PREV_DATA) {
      html += '<p class="brief-p">本月为年度首个报告月，无上月异动处置跟踪数据。</p>';
    } else {
      var prevCount = PREV_DATA.events.length;
      var closed = Math.max(0, prevCount - (levelCount(3) > 1 ? 1 : 0)); // 演示：基本全部闭环
      var rate = prevCount ? closed / prevCount * 100 : 100;
      html += '<table class="btable"><thead><tr><th>月份</th><th>异动数（起）</th><th>已闭环（起）</th><th>闭环率</th><th>主要处置措施</th></tr></thead><tbody>'
        + '<tr><td>' + Y + '-' + pad2(M - 1) + '</td><td>' + prevCount + '</td><td>' + closed + '</td>'
        + '<td class="' + (rate >= 95 ? 'is-neg' : 'is-pos') + '">' + fmt(rate, 1) + '%</td>'
        + '<td style="text-align:left">现场核查、计量仪表校验、生产参数复核、归因说明归档</td></tr>'
        + '</tbody></table>';
    }

    html += '<h2 class="brief-h2">（二）本月处置与下月工作建议</h2><ol class="advice-list">'
      + '<li>对本报告列出的 ' + levelCount(3) + ' 起重大异动，24 小时内组织现场核查，核实生产工况、燃料消耗与计量数据，形成专项归因说明并归档。</li>'
      + '<li>对较大及以上异动涉及的排放源（' + esc(topEvent().source) + ' 等）开展计量仪表专项校验，确保监测数据真实、准确、可追溯。</li>'
      + '<li>将高频异动工序纳入重点监控清单，在碳排放管理模块设置日排放量 ±15% 自动预警阈值，实现异动当日发现、当日推送。</li>'
      + '<li>结合生产计划提前评估检修、休风等工况变化对排放的影响，做好月度排放预算与偏差管理，减少非计划性波动。</li>'
      + '<li>每月召开碳排放异动分析例会，通报异动清单与处置进展，跟踪闭环率，持续完善「监测—预警—核查—处置—归档」管理机制。</li>'
      + '</ol>';
    return html;
  }

  /* ---------- 报告组装 ---------- */

  function buildReport() {
    var dateRange = Y + '-' + pad2(M) + '-01 至 ' + Y + '-' + pad2(M) + '-' + DAYS;

    // 封面
    var html = '<div class="brief-page brief-cover-wrap"><div class="brief-cover">'
      + '<div class="cover-kicker">碳 排 放 异 动 分 析</div>'
      + '<h1>' + esc(ORG) + '<br/>碳排放异动分析报告</h1>'
      + '<div class="cover-month">' + esc(MONTH_CN) + '</div>'
      + '<div class="cover-line"></div>'
      + '<div class="cover-foot">数据期间：' + dateRange + '</div>'
      + '</div></div>';

    // 目录
    html += '<div class="brief-page brief-toc"><h2>目&nbsp;&nbsp;录</h2><ol>'
      + '<li class="toc-l1"><a href="#sec-0">摘要 · 本月异动概览</a></li>'
      + '<li class="toc-l1"><a href="#sec-1">一、排放总览与异动判定</a></li>'
      + '<li class="toc-l2"><a href="#sec-1-1">（一）月度排放趋势</a></li>'
      + '<li class="toc-l2"><a href="#sec-1-2">（二）异动判定规则</a></li>'
      + '<li class="toc-l1"><a href="#sec-2">二、本月异动清单</a></li>'
      + '<li class="toc-l1"><a href="#sec-3">三、排放源结构分析</a></li>'
      + '<li class="toc-l1"><a href="#sec-4">四、重点异动事件详析</a></li>'
      + '<li class="toc-l1"><a href="#sec-5">五、处置建议与闭环跟踪</a></li>'
      + '</ol></div>';

    // 正文
    html += '<div class="brief-page">'

      // 摘要
      + '<h1 class="brief-h1" id="sec-0">摘要 · 本月异动概览</h1>'
      + summaryHtml()

      // 一、排放总览与异动判定
      + '<h1 class="brief-h1" id="sec-1">一、排放总览与异动判定</h1>'
      + '<h2 class="brief-h2" id="sec-1-1">（一）月度排放趋势</h2>'
      + '<p class="brief-p">本月碳排放量 <strong>' + fmt(CUR_MONTH, 2) + '</strong> 万t，'
      + (M === 1 ? '为全年开局基线；' : '环比 ' + (MOM > 0 ? '+' : '') + fmt(MOM, 2) + '%；')
      + '较去年同月 ' + fmt(PREV_YEAR_MONTH, 2) + ' 万t 同比 ' + (YOY > 0 ? '+' : '') + fmt(YOY, 2) + '%。日排放趋势与基线对照如下：</p>'
      + dailyChart()
      + monthlyTrendHtml()

      + '<h2 class="brief-h2" id="sec-1-2">（二）异动判定规则</h2>'
      + ruleHtml()

      // 二、本月异动清单
      + '<h1 class="brief-h1" id="sec-2">二、本月异动清单</h1>'
      + '<p class="brief-p">按上述判定规则，' + MONTH_CN + '共识别排放异动 <strong>' + DATA.events.length + '</strong> 起，清单如下：</p>'
      + eventTableHtml()

      // 三、排放源结构分析
      + '<h1 class="brief-h1" id="sec-3">三、排放源结构分析</h1>'
      + sourceHtml()

      // 四、重点异动事件详析
      + '<h1 class="brief-h1" id="sec-4">四、重点异动事件详析</h1>'
      + '<p class="brief-p">选取偏离度最大的 3 起异动事件详析如下：</p>'
      + topEventsHtml()

      // 五、处置建议与闭环跟踪
      + '<h1 class="brief-h1" id="sec-5">五、处置建议与闭环跟踪</h1>'
      + actionHtml()

      + '</div>';

    return html;
  }

  /* ---------- 下载（PDF） ---------- */

  function download() {
    if (!(window.jspdf && window.jspdf.jsPDF && window.html2canvas)) {
      window.print();
      return;
    }
    var btn = document.getElementById('btn-download');
    var oldText = btn.innerHTML;
    btn.disabled = true;
    btn.textContent = '正在生成 PDF…';

    var pdf = new window.jspdf.jsPDF('p', 'mm', 'a4');
    var PAGE_W = 210, PAGE_H = 297;
    var pages = document.querySelectorAll('#brief-root .brief-page');
    var first = true;

    var chain = Promise.resolve();
    pages.forEach(function (el) {
      chain = chain.then(function () {
        return window.html2canvas(el, { scale: 2, backgroundColor: '#ffffff', logging: false }).then(function (canvas) {
          var pxPerMm = canvas.width / PAGE_W;
          var sliceH = Math.floor(PAGE_H * pxPerMm);
          var y = 0;
          while (y < canvas.height) {
            var h = Math.min(sliceH, canvas.height - y);
            var part = document.createElement('canvas');
            part.width = canvas.width;
            part.height = h;
            var ctx = part.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, part.width, part.height);
            ctx.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
            if (!first) pdf.addPage();
            first = false;
            pdf.addImage(part.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, PAGE_W, h / pxPerMm);
            y += h;
          }
        });
      });
    });

    chain.then(function () {
      pdf.save('碳排放异动分析报告-' + Y + '年' + M + '月.pdf');
    }).catch(function (err) {
      if (window.console) console.error('PDF 生成失败，降级为打印：', err);
      window.print();
    }).then(function () {
      btn.disabled = false;
      btn.innerHTML = oldText;
    });
  }

  /* ---------- 启动 ---------- */

  document.getElementById('brief-root').innerHTML = buildReport();
  document.getElementById('bt-title').textContent = ORG + '碳排放异动分析报告（' + MONTH_CN + '）';
  document.title = '碳排放异动分析报告-' + Y + '年' + M + '月';
  document.getElementById('btn-download').addEventListener('click', download);
})();
