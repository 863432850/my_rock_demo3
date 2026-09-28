/**
 * 双碳简报 · 报告渲染（按 docx 模板复刻）
 * - URL 参数：?month=2026-06（缺省取当前演示月）
 * - 封面企业名固定为当前企业；年月随参数动态变化
 * - 6 月数据与《2025-06双碳简报》模板一致，其余月份按同口径滚动演算（演示）
 * - 「下载报告」将当前报告 + 内联样式打包为独立 HTML 文件
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
  /** 可复现伪随机（按年月子 Leopold 稳定） */
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

  /* ---------- 年累计明细数据（1-6 月同模板，7-12 月按趋势延展） ---------- */

  var SERIES = {
    total: { // 碳排放总量（万t）
      cur: [212.47, 422.89, 812.09, 1369.79, 1987.13, 2547.61, 3122.81, 3720.91, 4287.31, 4876.21, 5447.51, 6058.01],
      prev: [199.38, 314.34, 712.01, 1342.22, 1933.17, 2345.35, 2758.17, 3188.17, 3593.17, 4038.17, 4458.17, 4918.17],
      priorDec: 5173.27, dec: 2
    },
    intensity: { // 单位产品碳排放强度（tCO₂/t）
      cur: [0.7605, 0.7573, 0.7637, 0.7630, 0.7646, 0.7653, 0.7658, 0.7662, 0.7655, 0.7661, 0.7657, 0.7663],
      prev: [0.7413, 0.7224, 0.7441, 0.7510, 0.7565, 0.7590, 0.7602, 0.7611, 0.7608, 0.7615, 0.7612, 0.7618],
      priorDec: 0.7591, dec: 4
    },
    rawWt: { // 原料替代率·Wt用量法（%）
      cur: [6.53, 6.95, 6.11, 5.59, 5.24, 5.15, 5.02, 4.91, 4.85, 4.78, 4.72, 4.66],
      prev: [10.14, 12.99, 9.94, 8.86, 8.28, 7.88, 7.55, 7.32, 7.11, 6.95, 6.81, 6.68],
      priorDec: 7.67, dec: 2
    },
    rawCc: { // 原料替代率·CC成分法（%）
      cur: [6.16, 6.86, 5.81, 5.23, 4.71, 4.54, 4.42, 4.33, 4.25, 4.18, 4.12, 4.06],
      prev: [9.67, 13.49, 9.53, 7.52, 6.60, 6.14, 5.85, 5.62, 5.44, 5.28, 5.14, 5.01],
      priorDec: 5.87, dec: 2
    },
    fuelTsr: { // 燃料替代率·TSR热量替代（%）
      cur: [16.85, 15.00, 14.65, 13.78, 13.91, 13.77, 13.66, 13.52, 13.41, 13.28, 13.17, 13.05],
      prev: [11.98, 11.93, 11.76, 11.54, 11.59, 11.46, 11.32, 11.21, 11.08, 10.97, 10.85, 10.74],
      priorDec: 12.50, dec: 2
    },
    fuelCs: { // 燃料替代率·CS燃煤替代（%）
      cur: [11.47, 10.98, 11.12, 10.88, 11.20, 11.04, 10.95, 10.82, 10.71, 10.61, 10.52, 10.44],
      prev: [9.93, 9.37, 8.90, 8.41, 8.46, 8.35, 8.22, 8.11, 8.02, 7.94, 7.85, 7.77],
      priorDec: 9.16, dec: 2
    }
  };

  /** 目标达成率（%，6 月与模板一致，其余月按时间进度推演） */
  var ACHIEVE = {
    total: [8.01, 16.02, 24.15, 32.20, 40.12, 48.05, 56.32, 64.58, 72.41, 80.66, 88.73, 97.05],
    intensity: [93.20, 94.15, 95.02, 96.10, 97.05, 97.99, 98.42, 98.71, 98.95, 99.12, 99.30, 99.48],
    raw: [11.92, 23.85, 35.78, 47.70, 59.63, 71.53, 76.20, 80.15, 84.02, 87.66, 91.20, 94.58],
    fuel: [10.51, 21.02, 31.53, 42.04, 52.55, 63.06, 68.10, 72.85, 77.30, 81.62, 85.90, 90.12]
  };

  /** 生成 1..M 月年累计明细行（本期/同期/同比/环期/环比） */
  function cumRows(key) {
    var s = SERIES[key];
    var rows = [];
    for (var i = 0; i < M; i++) {
      var cur = s.cur[i];
      var prev = s.prev[i];
      var ring = i === 0 ? s.priorDec : s.cur[i - 1];
      rows.push({
        t: Y + '-' + pad2(i + 1),
        cur: cur,
        prev: prev,
        yoyDiff: cur - prev,
        yoy: (cur - prev) / prev * 100,
        ring: ring,
        momDiff: cur - ring,
        mom: (cur - ring) / ring * 100
      });
    }
    return rows;
  }

  /* ---------- SVG 折线图 ---------- */

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

    // 网格 + Y 轴刻度
    for (var g = 0; g <= 4; g++) {
      var gv = min + (max - min) * g / 4;
      var gy = y(gv);
      out += '<line x1="' + P.l + '" y1="' + gy + '" x2="' + (W - P.r) + '" y2="' + gy + '" stroke="' + (g === 0 ? '#c9cdd4' : '#eef1f4') + '"/>';
      out += '<text x="' + (P.l - 8) + '" y="' + (gy + 4) + '" font-size="10.5" fill="#98a1ab" text-anchor="end">' + fmt(gv, dec) + '</text>';
    }
    // X 轴标签
    labels.forEach(function (lb, i) {
      out += '<text x="' + x(i) + '" y="' + (H - 10) + '" font-size="10.5" fill="#98a1ab" text-anchor="middle">' + esc(lb) + '</text>';
    });
    // 图例
    var lx = W - P.r;
    for (var li = series.length - 1; li >= 0; li--) {
      var name = series[li].name;
      var w = name.length * 11 + 26;
      lx -= w;
      out += '<rect x="' + lx + '" y="8" width="14" height="4" rx="2" fill="' + series[li].color + '"/>';
      out += '<text x="' + (lx + 19) + '" y="14" font-size="11" fill="#606266">' + esc(name) + '</text>';
    }
    // 折线 + 数据点
    series.forEach(function (s) {
      var pts = [];
      s.values.forEach(function (v, i) { if (v != null) pts.push(x(i) + ',' + y(v)); });
      out += '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + s.color + '" stroke-width="2" stroke-linejoin="round"/>';
      s.values.forEach(function (v, i) {
        if (v == null) return;
        out += '<circle cx="' + x(i) + '" cy="' + y(v) + '" r="3" fill="#fff" stroke="' + s.color + '" stroke-width="2"/>';
      });
    });
    return out + '</svg>';
  }

  /* ---------- 横向条形图（HTML） ---------- */

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

  function donut(items, centerLabel) {
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
      svg += '<circle cx="90" cy="90" r="' + R + '" fill="none" stroke="' + PALETTE[i % PALETTE.length] + '" stroke-width="30"'
        + ' stroke-dasharray="' + len + ' ' + (C - len) + '" stroke-dashoffset="' + (-acc * C) + '" transform="rotate(-90 90 90)"/>';
      acc += frac;
    });
    svg += '<text x="90" y="86" font-size="12" fill="#8a9199" text-anchor="middle">' + esc(centerLabel || '总量') + '</text>'
      + '<text x="90" y="106" font-size="15" font-weight="700" fill="#1a1a1a" text-anchor="middle">' + fmt(total, 2) + '</text></svg>';

    var legend = '<ul class="donut-legend">';
    items.forEach(function (it, i) {
      legend += '<li><span class="dot" style="background:' + PALETTE[i % PALETTE.length] + '"></span>'
        + esc(it.name) + '<span class="val">' + fmt(it.value, 2) + ' 万t（' + (it.value / total * 100).toFixed(2) + '%）</span></li>';
    });
    return '<div class="donut-wrap">' + svg + legend + '</ul></div>';
  }

  /* ---------- 年累计明细表 ---------- */

  function cumTable(caption, unit, key) {
    var rows = cumRows(key);
    var dec = SERIES[key].dec;
    var html = '<div class="table-caption"><span>' + esc(caption) + '</span><span class="unit">单位：' + esc(unit) + '</span></div>'
      + '<table class="btable"><thead><tr>'
      + '<th>时间</th><th>本期</th><th>同期</th><th>同比变化值</th><th>同比(%)</th><th>环期</th><th>环比变化值</th><th>环比(%)</th>'
      + '</tr></thead><tbody>';
    rows.forEach(function (r) {
      function num(v, signed) {
        var cls = v > 0 ? 'is-pos' : (v < 0 ? 'is-neg' : '');
        var txt = (signed && v > 0 ? '+' : '') + fmt(v, dec);
        return '<td class="' + cls + '">' + txt + '</td>';
      }
      html += '<tr><td>' + r.t + '</td>'
        + '<td>' + fmt(r.cur, dec) + '</td>'
        + '<td>' + fmt(r.prev, dec) + '</td>'
        + num(r.yoyDiff, true) + num(r.yoy, true)
        + '<td>' + fmt(r.ring, dec) + '</td>'
        + num(r.momDiff, true) + num(r.mom, true)
        + '</tr>';
    });
    return html + '</tbody></table>';
  }

  function chartBlock(svgHtml, caption) {
    return '<div class="chart-box">' + svgHtml + '</div><div class="chart-caption">' + esc(caption) + '</div>';
  }

  function trendChart(caption, key, unit) {
    var rows = cumRows(key);
    var labels = rows.map(function (r) { return r.t; });
    var svg = lineChart(labels, [
      { name: '本期（' + Y + '）', color: GREEN, values: rows.map(function (r) { return r.cur; }) },
      { name: '同期（' + (Y - 1) + '）', color: '#165dff', values: rows.map(function (r) { return r.prev; }) }
    ], { decimals: SERIES[key].dec });
    return chartBlock(svg, caption + '（单位：' + unit + '）');
  }

  /* ---------- 碳市场行情（按月份种子生成的演示行情） ---------- */

  function marketData() {
    var days = [];
    for (var d = 1; d <= lastDay(Y, M); d++) {
      var w = new Date(Y, M - 1, d).getDay();
      if (w !== 0 && w !== 6) days.push(d);
    }
    var rnd = mulberry32(Y * 100 + M);
    var markets = [
      { name: '全国碳市场', base: 95, vol: 220 },
      { name: '上海碳市场', base: 70, vol: 24 },
      { name: '北京碳市场', base: 105, vol: 8 },
      { name: '广东碳市场', base: 42, vol: 30 },
      { name: '湖北碳市场', base: 40, vol: 26 },
      { name: '重庆碳市场', base: 38, vol: 6 },
      { name: '天津碳市场', base: 36, vol: 5 },
      { name: '福建碳市场', base: 30, vol: 4 }
    ];
    markets.forEach(function (mk) {
      var price = mk.base + (rnd() - 0.5) * 6;
      mk.daily = [];
      days.forEach(function (d) {
        var open = price + (rnd() - 0.5) * 1.6;
        var close = open + (rnd() - 0.5) * 2.2;
        var high = Math.max(open, close) + rnd() * 1.3;
        var low = Math.min(open, close) - rnd() * 1.3;
        var avg = (open + close + high + low) / 4;
        var vol = mk.vol * (0.35 + rnd());
        mk.daily.push({ d: d, open: open, close: close, high: high, low: low, avg: avg, vol: vol });
        price = close;
      });
      mk.volTotal = 0; mk.amtTotal = 0;
      mk.daily.forEach(function (r) {
        mk.volTotal += r.vol;
        mk.amtTotal += r.avg * r.vol; // 万t × 元/t = 万元
      });
      mk.avgPrice = mk.amtTotal / mk.volTotal;
    });
    return { days: days, markets: markets };
  }

  var market = marketData();
  var cna = market.markets[0]; // 全国碳市场

  function marketChart() {
    var labels = cna.daily.map(function (r) { return pad2(M) + '-' + pad2(r.d); });
    var ch1 = chartBlock(lineChart(labels, [
      { name: '开盘价', color: '#165dff', values: cna.daily.map(function (r) { return +r.open.toFixed(2); }) },
      { name: '收盘价', color: GREEN, values: cna.daily.map(function (r) { return +r.close.toFixed(2); }) }
    ]), '01、开盘价与收盘价（元/吨）');
    var ch2 = chartBlock(lineChart(labels, [
      { name: '最高价', color: '#f53f3f', values: cna.daily.map(function (r) { return +r.high.toFixed(2); }) },
      { name: '最低价', color: '#0fc6c2', values: cna.daily.map(function (r) { return +r.low.toFixed(2); }) }
    ]), '02、最高价与最低价（元/吨）');
    var ch3 = chartBlock(lineChart(labels, [
      { name: '日成交均价', color: '#ff7d00', values: cna.daily.map(function (r) { return +r.avg.toFixed(2); }) }
    ]), '03、日成交均价（元/吨）');
    return ch1 + ch2 + ch3;
  }

  function marketTable() {
    var html = '<table class="btable"><thead><tr>'
      + '<th>碳市场</th><th>交易量（万吨）</th><th>交易额（万元）</th><th>日均价（元/吨）</th>'
      + '<th>开盘价波动范围（元/吨）</th><th>最高价（元/吨）</th><th>最低价（元/吨）</th><th>收盘价波动范围（元/吨）</th>'
      + '</tr></thead><tbody>';
    market.markets.forEach(function (mk) {
      var opens = mk.daily.map(function (r) { return r.open; });
      var closes = mk.daily.map(function (r) { return r.close; });
      html += '<tr><td>' + esc(mk.name) + '</td>'
        + '<td>' + fmt(mk.volTotal, 2) + '</td>'
        + '<td>' + fmt(mk.amtTotal, 2) + '</td>'
        + '<td>' + fmt(mk.avgPrice, 2) + '</td>'
        + '<td>' + fmt(Math.min.apply(null, opens), 2) + ' ~ ' + fmt(Math.max.apply(null, opens), 2) + '</td>'
        + '<td>' + fmt(Math.max.apply(null, mk.daily.map(function (r) { return r.high; })), 2) + '</td>'
        + '<td>' + fmt(Math.min.apply(null, mk.daily.map(function (r) { return r.low; })), 2) + '</td>'
        + '<td>' + fmt(Math.min.apply(null, closes), 2) + ' ~ ' + fmt(Math.max.apply(null, closes), 2) + '</td></tr>';
    });
    return html + '</tbody></table><div class="btable-note">“--”表示该区间内无成交数据。</div>';
  }

  /* ---------- 文案区块 ---------- */

  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  /** 本月排放量（当月值，非累计） */
  function monthEmission() {
    return M === 1 ? SERIES.total.cur[0] : SERIES.total.cur[M - 1] - SERIES.total.cur[M - 2];
  }

  /** 同比/环比小字（涨红跌绿，与明细表口径一致） */
  function deltaHtml(pct, label) {
    var cls = pct > 0 ? 'is-pos' : (pct < 0 ? 'is-neg' : 'is-flat');
    var arrow = pct > 0 ? '▲' : (pct < 0 ? '▼' : '—');
    return '<div class="kpi-delta ' + cls + '">' + label + ' ' + arrow + ' ' + (pct > 0 ? '+' : '') + fmt(pct, 2) + '%</div>';
  }

  /** 摘要 · 核心指标概览（KPI 卡 + 本月要点 + 排放结构） */
  function summaryHtml() {
    var tRows = cumRows('total');
    var tLast = tRows[tRows.length - 1];
    var iLast = cumRows('intensity')[M - 1];
    var rLast = cumRows('rawWt')[M - 1];
    var fLast = cumRows('fuelTsr')[M - 1];

    var inc = monthEmission();
    var incPrev = M === 1 ? null : (M === 2 ? SERIES.total.cur[0] : SERIES.total.cur[M - 2] - SERIES.total.cur[M - 3]);
    var incMom = incPrev ? (inc - incPrev) / incPrev * 100 : 0;

    var forecast = SERIES.total.cur[M - 1] / M * 12;
    var gap = 16655.53 - forecast;

    var html = '<div class="kpi-grid">'
      + '<div class="kpi-card"><div class="kpi-name">本月碳排放量</div><div class="kpi-val">' + fmt(inc, 2) + '<small> 万t</small></div>' + (M === 1 ? '<div class="kpi-delta is-flat">全年开局基线</div>' : deltaHtml(incMom, '环比')) + '</div>'
      + '<div class="kpi-card"><div class="kpi-name">年累计碳排放量</div><div class="kpi-val">' + fmt(tLast.cur, 2) + '<small> 万t</small></div>' + deltaHtml(tLast.yoy, '同比') + '</div>'
      + '<div class="kpi-card"><div class="kpi-name">碳排放强度</div><div class="kpi-val">' + fmt(iLast.cur, 4) + '<small> tCO₂/t</small></div>' + deltaHtml(iLast.yoy, '同比') + '</div>'
      + '<div class="kpi-card"><div class="kpi-name">原料替代率（Wt 用量法）</div><div class="kpi-val">' + fmt(rLast.cur, 2) + '<small> %</small></div>' + deltaHtml(rLast.yoy, '同比') + '</div>'
      + '<div class="kpi-card"><div class="kpi-name">燃料替代率（TSR 热量替代）</div><div class="kpi-val">' + fmt(fLast.cur, 2) + '<small> %</small></div>' + deltaHtml(fLast.yoy, '同比') + '</div>'
      + '<div class="kpi-card"><div class="kpi-name">配额盈缺（全年预测口径）</div><div class="kpi-val">' + fmt(gap, 2) + '<small> 万t</small></div><div class="kpi-delta is-neg">盈余，碳资产总体充裕</div></div>'
      + '</div>';

    // 本月要点 + 排放结构
    var rnd = mulberry32(Y * 100 + M + 55);
    var directShare = 0.60 + rnd() * 0.08;
    var direct = inc * directShare;
    var indirect = inc - direct;
    html += '<div class="summary-cols"><div class="col-left"><h3>本月要点</h3><ul class="point-list">'
      + '<li>本月碳排放量 <strong>' + fmt(inc, 2) + '</strong> 万t' + (M === 1 ? '，为全年开局基线' : '，环比 ' + (incMom > 0 ? '+' : '') + fmt(incMom, 2) + '%') + '；年累计排放 <strong>' + fmt(tLast.cur, 2) + '</strong> 万t，同比 ' + (tLast.yoy > 0 ? '+' : '') + fmt(tLast.yoy, 2) + '%。</li>'
      + '<li>碳排放强度 <strong>' + fmt(iLast.cur, 4) + '</strong> tCO₂/t，目标达成率 ' + fmt(ACHIEVE.intensity[M - 1], 2) + '%，强度控制总体平稳。</li>'
      + '<li>原料替代率（Wt）' + fmt(rLast.cur, 2) + '%、燃料替代率（TSR）' + fmt(fLast.cur, 2) + '%，替代水平同比仍有提升空间。</li>'
      + '<li>按全年预测口径测算，配额盈余约 <strong>' + fmt(gap, 2) + '</strong> 万t，履约压力总体可控。</li>'
      + '</ul></div>'
      + '<div class="col-right"><h3>本月排放结构</h3>'
      + donut([
        { name: '直接排放（燃料燃烧、工业过程）', value: +direct.toFixed(2) },
        { name: '间接排放（外购电力、热力）', value: +indirect.toFixed(2) }
      ], '本月排放(万t)')
      + '</div></div>';
    return html;
  }

  /** 五、月度分析与工作建议 */
  function analysisHtml() {
    var tLast = cumRows('total')[M - 1];
    var rLast = cumRows('rawWt')[M - 1];
    var fLast = cumRows('fuelTsr')[M - 1];
    var trendWord = tLast.yoy > 0 ? '高于' : '低于';

    var html = '<h2 class="brief-h2">（一）月度分析</h2><ul class="point-list">'
      + '<li><strong>排放走势：</strong>本月年累计排放量 ' + fmt(tLast.cur, 2) + ' 万t，' + trendWord + '去年同期 ' + fmt(Math.abs(tLast.yoy), 2) + '%，'
      + (tLast.yoy > 0 ? '主要受生产负荷提升影响，需关注后续月度排放增量。' : '排放管控成效持续显现。') + '</li>'
      + '<li><strong>强度与目标：</strong>碳排放强度目标达成率 ' + fmt(ACHIEVE.intensity[M - 1], 2) + '%，总量目标达成率 ' + fmt(ACHIEVE.total[M - 1], 2) + '%，'
      + (ACHIEVE.total[M - 1] >= M / 12 * 100 ? '总体符合时间进度要求。' : '总量进度略慢于时间进度，下半年需加强管控。') + '</li>'
      + '<li><strong>减排结构：</strong>原料替代率同比 ' + (rLast.yoy > 0 ? '+' : '') + fmt(rLast.yoy, 2) + '%、燃料替代率同比 ' + (fLast.yoy > 0 ? '+' : '') + fmt(fLast.yoy, 2) + '%，替代原料、替代燃料推广仍需加快。</li>'
      + '<li><strong>碳资产与交易：</strong>本月全国碳市场日均成交价 ' + fmt(cna.avgPrice, 2) + ' 元/t，配额处于盈余状态，可结合行情择机开展交易，盘活碳资产。</li>'
      + '</ul>';

    html += '<h2 class="brief-h2">（二）下月工作建议</h2><ol class="advice-list">'
      + '<li>加强重点用能设备与主要工序的能耗、排放月度监测，完善碳排放数据台账与质量控制，确保数据真实、准确、可追溯。</li>'
      + '<li>持续优化原料、燃料结构，提高替代原料与替代燃料使用比例，进一步降低单位产品碳排放强度。</li>'
      + '<li>扩大绿电、绿证采购规模，推进厂区分布式光伏等清洁能源项目建设，降低间接排放占比。</li>'
      + '<li>密切跟踪全国碳市场行情，结合配额盈缺状况合理安排交易节奏，提前谋划年度履约工作。</li>'
      + '<li>推进节能技术改造与余热、余压回收利用，深入挖掘各工序节能降碳潜力。</li>'
      + '</ol>';
    return html;
  }

  function tradeOverviewHtml() {
    var buyVol = M < 8 ? 0 : +(0.1 * (M - 7)).toFixed(2);
    var sellVol = +Math.max(0, 0.30 + (M - 6) * 0.05).toFixed(2);
    var buyAmt = +(buyVol * cna.avgPrice).toFixed(2);
    var sellAmt = +(sellVol * cna.avgPrice).toFixed(2);
    var html = '<p class="brief-p">' + Y + '年碳资产交易买入：交易总量 <strong>' + fmt(buyVol, 2) + '</strong> 万t，交易总额：<strong>' + fmt(buyAmt, 2) + '</strong> 万元；'
      + '其中大宗协议交易总量：' + fmt(0, 2) + ' 万t，挂牌交易：' + fmt(buyVol, 2) + ' 万t；</p>'
      + '<p class="brief-p">' + Y + '年碳资产交易卖出：交易总量 <strong>' + fmt(sellVol, 2) + '</strong> 万t，交易总额：<strong>' + fmt(sellAmt, 2) + '</strong> 万元；'
      + '其中大宗协议交易总量：' + fmt(0, 2) + ' 万t，挂牌交易：' + fmt(sellVol, 2) + ' 万t。</p>';
    html += chartBlock(hbars([
      { name: '买入 · 挂牌交易', value: buyVol, color: '#165dff' },
      { name: '买入 · 大宗协议', value: 0, color: '#94bfff' },
      { name: '卖出 · 挂牌交易', value: sellVol, color: GREEN },
      { name: '卖出 · 大宗协议', value: 0, color: '#86e3a6' }
    ], '万t'), '碳交易买入 / 卖出统计（' + Y + ' 年累计）');
    return html;
  }

  function quotaHtml() {
    var totalRow = SERIES.total.cur[M - 1];
    var intenRow = SERIES.intensity.cur[M - 1];
    var output = totalRow / intenRow; // 产品产量（万t）
    var forecast = totalRow / M * 12;  // 全年预测排放量
    var issued = 16655.53;
    var gap = issued - forecast;
    var gapAmt = gap * cna.avgPrice / 100; // 万t×元/t=万元 → 保留口径：万元
    var html = '<p class="brief-p">' + Y + '年累计排放量：<strong>' + fmt(totalRow, 2) + '</strong> 万t，年累计产品产量：<strong>' + fmt(output, 2) + '</strong> 万t，'
      + '年累计单位产品碳排放强度：<strong>' + fmt(intenRow, 4) + '</strong> tCO₂/t。</p>'
      + '<p class="brief-p">' + Y + '年配额核发量：' + fmt(issued, 2) + ' 万t，全年排放量预测：' + fmt(forecast, 2) + ' 万t。</p>'
      + '<p class="brief-p">' + Y + '年配额盈缺量：<strong>' + fmt(gap, 2) + '</strong> 万t（盈余），按本月日均价测算盈缺额约 ' + fmt(gapAmt, 2) + ' 万元。</p>'
      + '<p class="brief-p">当前账户：4,039.12 万t；配额：4,039.05 万t，比例：100.00%；自愿减排量：0.07 万t，比例：0.00%。</p>';
    html += chartBlock(hbars([
      { name: '配额核发量', value: issued, color: '#165dff' },
      { name: '全年预测排放量', value: +forecast.toFixed(2), color: '#ff7d00' },
      { name: '配额盈缺量', value: +gap.toFixed(2), color: GREEN }
    ], '万t'), '（图）配额盈缺');
    return html;
  }

  function assetStructureHtml() {
    var items = [
      { name: '全国碳市场', value: 4028.51 },
      { name: '北京碳市场', value: 5.63 },
      { name: '天津碳市场', value: 4.91 },
      { name: 'CCER 碳市场', value: 0.07 },
      { name: '重庆碳市场', value: 0.00 }
    ];
    var html = '<ol class="brief-ol">'
      + '<li>当前碳资产总量：4,039.12 万t，碳资产总额：0.00 万元。</li>'
      + '<li>CCER 碳市场：碳资产总量：0.07 万t，碳资产总额 0.00 万元。</li>'
      + '<li>重庆碳市场：碳资产总量：0.00 万t，碳资产总额 0.00 万元。</li>'
      + '<li>全国碳市场：碳资产总量：4,028.51 万t，碳资产总额 0.00 万元。</li>'
      + '<li>北京碳市场：碳资产总量：5.63 万t，碳资产总额 0.00 万元。</li>'
      + '<li>天津碳市场：碳资产总量：4.91 万t，碳资产总额 0.00 万元。</li>'
      + '</ol>';
    html += chartBlock(donut(items, '碳资产总量'), '（图）碳资产结构（单位：万t）');
    return html;
  }

  function ccerHtml() {
    var hasTrade = M % 2 === 1; // 演示：单月有成交、双月无成交（6 月与模板一致为“--”）
    if (!hasTrade) {
      return '<p class="brief-p">成交均价为 --。</p><p class="brief-p">成交总量为 --。</p>'
        + chartBlock(hbars([{ name: 'CCER 成交总量', value: 0, color: '#722ed1' }], '万t'), '（图）CCER 成交情况（本月无成交）');
    }
    var rnd = mulberry32(Y * 100 + M + 77);
    var avg = 58 + rnd() * 22;
    var vol = 2 + rnd() * 12;
    return '<p class="brief-p">成交均价为 <strong>' + fmt(avg, 2) + '</strong> 元/吨。</p>'
      + '<p class="brief-p">成交总量为 <strong>' + fmt(vol, 2) + '</strong> 万t。</p>'
      + chartBlock(hbars([{ name: 'CCER 成交总量', value: +vol.toFixed(2), color: '#722ed1' }], '万t'), '（图）CCER 成交情况');
  }

  /* ---------- 报告组装 ---------- */

  function buildReport() {
    var dateRange = Y + '-' + pad2(M) + '-01 至 ' + Y + '-' + pad2(M) + '-' + lastDay(Y, M);

    // 封面
    var html = '<div class="brief-page brief-cover-wrap"><div class="brief-cover">'
      + '<div class="cover-kicker">双 碳 管 理 月 度 简 报</div>'
      + '<h1>' + esc(ORG) + '<br/>双碳管理月度简报</h1>'
      + '<div class="cover-month">' + esc(MONTH_CN) + '</div>'
      + '<div class="cover-line"></div>'
      + '<div class="cover-foot">数据期间：' + dateRange + '</div>'
      + '</div></div>';

    // 目录
    html += '<div class="brief-page brief-toc"><h2>目&nbsp;&nbsp;录</h2><ol>'
      + '<li class="toc-l1"><a href="#sec-0">摘要 · 本月核心指标概览</a></li>'
      + '<li class="toc-l1"><a href="#sec-1">一、碳排放</a></li>'
      + '<li class="toc-l2"><a href="#sec-1-1">（一）碳排放总量</a></li>'
      + '<li class="toc-l2"><a href="#sec-1-2">（二）碳排放强度</a></li>'
      + '<li class="toc-l1"><a href="#sec-2">二、碳减排</a></li>'
      + '<li class="toc-l2"><a href="#sec-2-1">（一）原料替代率</a></li>'
      + '<li class="toc-l2"><a href="#sec-2-2">（二）燃料替代率</a></li>'
      + '<li class="toc-l1"><a href="#sec-3">三、碳资产</a></li>'
      + '<li class="toc-l2"><a href="#sec-3-1">（一）配额盈缺</a></li>'
      + '<li class="toc-l2"><a href="#sec-3-2">（二）碳资产结构</a></li>'
      + '<li class="toc-l1"><a href="#sec-4">四、碳交易</a></li>'
      + '<li class="toc-l2"><a href="#sec-4-1">（一）交易概览</a></li>'
      + '<li class="toc-l2"><a href="#sec-4-2">（二）碳市场行情</a></li>'
      + '<li class="toc-l1"><a href="#sec-5">五、月度分析与工作建议</a></li>'
      + '</ol></div>';

    // 正文
    html += '<div class="brief-page">'

      // 摘要
      + '<h1 class="brief-h1" id="sec-0">摘要 · 本月核心指标概览</h1>'
      + summaryHtml()

      // 一、碳排放
      + '<h1 class="brief-h1" id="sec-1">一、碳排放</h1>'
      + '<h2 class="brief-h2" id="sec-1-1">（一）碳排放总量</h2>'
      + '<p class="brief-p">目标达成率：<strong>' + fmt(ACHIEVE.total[M - 1], 2) + '%</strong></p>'
      + trendChart('（图）碳排放总量趋势', 'total', '万t')
      + cumTable('碳排放总量明细表（年累计）', '万t', 'total')

      + '<h2 class="brief-h2" id="sec-1-2">（二）碳排放强度</h2>'
      + '<p class="brief-p">目标达成率：<strong>' + fmt(ACHIEVE.intensity[M - 1], 2) + '%</strong>。</p>'
      + trendChart('（图）碳排放强度趋势', 'intensity', 'tCO₂/t')
      + cumTable('碳排放强度明细表（年累计）', 'tCO₂/t', 'intensity')

      // 二、碳减排
      + '<h1 class="brief-h1" id="sec-2">二、碳减排</h1>'
      + '<h2 class="brief-h2" id="sec-2-1">（一）原料替代率</h2>'
      + '<p class="brief-p">目标达成率：<strong>' + fmt(ACHIEVE.raw[M - 1], 2) + '%</strong>，'
      + '年累计值（Wt 用量法）：<strong>' + fmt(SERIES.rawWt.cur[M - 1], 2) + ' %</strong>，'
      + '年累计值（CC 成分法）：<strong>' + fmt(SERIES.rawCc.cur[M - 1], 2) + ' %</strong>，'
      + '目标值（Wt 用量法）：-- %；年累计替代原料用量：' + fmt(Math.max(0, (M - 6) * 0.02), 2) + ' 万t。</p>'
      + trendChart('（图）原料替代率（Wt 用量法）趋势', 'rawWt', '%')
      + cumTable('原料替代率（Wt 用量法）明细表（年累计）', '%', 'rawWt')
      + trendChart('（图）原料替代率（CC 成分法）趋势', 'rawCc', '%')
      + cumTable('原料替代率（CC 成分法）明细表（年累计）', '%', 'rawCc')

      + '<h2 class="brief-h2" id="sec-2-2">（二）燃料替代率</h2>'
      + '<p class="brief-p">目标达成率：<strong>' + fmt(ACHIEVE.fuel[M - 1], 2) + '%</strong>，'
      + '年累计值（TSR 热量替代）：<strong>' + fmt(SERIES.fuelTsr.cur[M - 1], 2) + ' %</strong>，'
      + '年累计值（CS 燃煤替代）：<strong>' + fmt(SERIES.fuelCs.cur[M - 1], 2) + ' %</strong>，'
      + '目标值（TSR 热量替代）：-- %；年累计替代燃料用量（含煤矸石）：' + fmt(Math.max(0, (M - 6) * 0.03), 2) + ' 万t。</p>'
      + trendChart('（图）燃料替代率（TSR 热量替代）趋势', 'fuelTsr', '%')
      + cumTable('燃料替代率（TSR 热量替代）明细表（年累计）', '%', 'fuelTsr')
      + trendChart('（图）燃料替代率（CS 燃煤替代）趋势', 'fuelCs', '%')
      + cumTable('燃料替代率（CS 燃煤替代）明细表（年累计）', '%', 'fuelCs')

      // 三、碳资产
      + '<h1 class="brief-h1" id="sec-3">三、碳资产</h1>'
      + '<h2 class="brief-h2" id="sec-3-1">（一）配额盈缺</h2>'
      + quotaHtml()
      + '<h2 class="brief-h2" id="sec-3-2">（二）碳资产结构</h2>'
      + assetStructureHtml()

      // 四、碳交易
      + '<h1 class="brief-h1" id="sec-4">四、碳交易</h1>'
      + '<h2 class="brief-h2" id="sec-4-1">（一）交易概览</h2>'
      + tradeOverviewHtml()

      + '<h2 class="brief-h2" id="sec-4-2">（二）碳市场行情</h2>'
      + '<p class="brief-p">数据来源于各碳市场，每日数据更新；</p>'
      + '<p class="brief-p">数据获取范围 ' + dateRange + '，共有 <strong>' + market.days.length + '</strong> 个交易日</p>'
      + marketTable()
      + '<p class="brief-p">详细报告如下：</p>'
      + '<p class="brief-p"><strong>全国碳市场</strong></p>'
      + marketChart()
      + '<p class="brief-p"><strong>地方碳市场</strong></p>'
      + chartBlock(hbars(market.markets.slice(1).map(function (mk, i) {
        return { name: mk.name, value: +mk.volTotal.toFixed(2), color: PALETTE[(i + 1) % PALETTE.length] };
      }), '万t'), '（图）地方碳市场成交量（本月累计）')
      + '<p class="brief-p"><strong>CCER 成交情况</strong></p>'
      + ccerHtml()

      // 五、月度分析与工作建议
      + '<h1 class="brief-h1" id="sec-5">五、月度分析与工作建议</h1>'
      + analysisHtml()
      + '</div>';

    return html;
  }

  /* ---------- 下载（PDF） ---------- */

  /**
   * 用 html2canvas 把各报告页渲染为画布，按 A4 高度切片后写入 jsPDF。
   * 本地 vendor 库缺失时降级为浏览器打印（可另存 PDF）。
   */
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
      pdf.save('双碳管理月度简报-' + Y + '年' + M + '月.pdf');
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
  document.getElementById('bt-title').textContent = ORG + '双碳管理月度简报（' + MONTH_CN + '）';
  document.title = '双碳管理月度简报-' + Y + '年' + M + '月';
  document.getElementById('btn-download').addEventListener('click', download);
})();
