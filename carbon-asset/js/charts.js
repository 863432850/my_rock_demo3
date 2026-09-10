/**
 * 碳资产管理 · 共享 SVG 图表引擎
 * -----------------------------------------------------
 * 纯离线 SVG 渲染，不依赖 ECharts / Chart.js / 任何 CDN。
 * 提供 6 类灵活图表，对应需求「趋势 / 均值 / 分布 / 极值 / 同比环比 / 构成」：
 *   - chart.line():      折线趋势（趋势 + 均值虚线 + 极值标注）
 *   - chart.groupBar():  分组柱状（同比 / 环比）
 *   - chart.hBar():      横向条形（分布 / 排名）
 *   - chart.donut():     环形图（构成 / 占比）
 *   - chart.gauge():     环形进度（量完达成率、履约率）
 * 数据与颜色尽量沿袭平台绿色主色，图表标题需带【明细弹窗】。
 */
(function (global) {
  'use strict';

  var C = {
    primary: '#00a854',      // 绿
    primaryDark: '#00964c',
    info: '#1890ff',         // 蓝
    warning: '#fa8c16',      // 橙
    danger: '#f5222d',       // 红
    text: '#303133',
    textSec: '#606266',
    textMuted: '#909399',
    grid: '#eef1f4',
    halo: '#e8f8ee',
    axis: '#dcdfe6',
  };

  var PALETTE = ['#00a854', '#1890ff', '#fa8c16', '#f5222d', '#722ed1', '#13c2c2',
    '#eb2f96', '#fadb14', '#2f54eb', '#52c41a'];

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  function isNil(v) { return v == null || isNaN(v); }

  /** 数字格式化：千分位 + 可指定小数 */
  function fmt(n, decimals) {
    if (isNil(n)) return '--';
    decimals = decimals == null ? 0 : decimals;
    var neg = n < 0;
    var s = Math.abs(Number(n));
    var str = s.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    return (neg ? '-' : '') + str;
  }

  /** 万元格式化：数值(元) → 万元 */
  function fmtWan(n, decimals) {
    if (isNil(n)) return '--';
    return fmt(n / 10000, decimals == null ? 2 : decimals) + ' 万';
  }

  /** 百分数：0~1 或已是百分值都转成百分比字符串 */
  function fmtPct(n, decimals) {
    if (isNil(n)) return '--';
    decimals = decimals == null ? 1 : decimals;
    var v = Math.abs(n) > 1 ? n : n * 100;
    return fmt(v, decimals) + '%';
  }

  function scaleMax(values) {
    var max = 0;
    values.forEach(function (v) { if (!isNil(v) && Math.abs(v) > max) max = Math.abs(v); });
    if (max <= 0) return 1;
    return niceMax(max);
  }

  function niceMax(max) {
    var exp = Math.pow(10, Math.floor(Math.log10(max)));
    var f = max / exp;
    var nf;
    if (f <= 1) nf = 1; else if (f <= 2) nf = 2; else if (f <= 2.5) nf = 2.5;
    else if (f <= 4) nf = 4; else if (f <= 5) nf = 5; else if (f <= 8) nf = 8; else nf = 10;
    return nf * exp;
  }

  // ============================================================
  // 1) 折线趋势（趋势 + 均值虚线 + 极值标注）
  //    支持多序列。均值线只对第一条序列绘制。
  // ============================================================
  function line(opts) {
    var series = opts.series;            // [{ name, color, data:[{label, value}] }]
    var width = opts.width || 620;
    var height = opts.height || 300;
    var unit = opts.unit || '';
    var padL = opts.padL != null ? opts.padL : 46;
    var padR = opts.padR != null ? opts.padR : 16;
    var padT = opts.padT != null ? opts.padT : 30;
    var padB = opts.padB != null ? opts.padB : 28;
    var showMean = opts.showMean !== false;
    var showLegend = opts.showLegend !== false;

    var labels = [];
    var allVals = [];
    series.forEach(function (s) {
      (s.data || []).forEach(function (pt) {
        if (labels.indexOf(pt.label) < 0) labels.push(pt.label);
        allVals.push(pt.value);
      });
    });
    var max = scaleMax(allVals);
    var plotW = width - padL - padR;
    var plotH = height - padT - padB;

    function x(i) { return padL + (labels.length <= 1 ? plotW / 2 : plotW * i / (labels.length - 1)); }
    function y(v) { return padT + plotH - (v / max) * plotH; }

    var out = [];
    out.push('<svg viewBox="0 0 ' + width + ' ' + height + '" class="ca-chart" preserveAspectRatio="xMidYMid meet">');
    out.push('<defs><marker id="cbArrow" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">'
      + '<path d="M0,0 L8,4.5 L0,9 z" fill="' + C.textMuted + '"/></marker></defs>');

    // 标题 + 单位
    if (opts.title) {
      out.push('<text x="' + padL + '" y="' + (padT - 12) + '" class="ca-title">' + esc(opts.title) + '</text>');
    }

    // 均值线（第一条序列）
    var mean = null;
    if (showMean && series.length && series[0].data.length) {
      var sum = 0; var cnt = 0;
      series[0].data.forEach(function (pt) { if (!isNil(pt.value)) { sum += pt.value; cnt++; } });
      if (cnt) mean = sum / cnt;
    }

    // 横向网格 + 左轴刻度
    var ticks = 5;
    for (var t = 0; t <= ticks; t++) {
      var tv = max * t / ticks;
      var ty = y(tv);
      out.push('<line x1="' + padL + '" y1="' + ty + '" x2="' + (width - padR) + '" y2="' + ty + '" class="ca-grid"/>');
      out.push('<text x="' + (padL - 6) + '" y="' + (ty + 4) + '" class="ca-axis" text-anchor="end">' + fmt(tv) + '</text>');
    }

    // 序列折线
    series.forEach(function (s, si) {
      var color = s.color || PALETTE[si % PALETTE.length];
      var pts = s.data || [];
      var d = '';
      pts.forEach(function (pt, i) {
        if (isNil(pt.value)) return;
        var px = x(i), py = y(pt.value);
        d += (i === 0 ? 'M' : 'L') + px + ' ' + py;
      });
      if (d) {
        out.push('<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="ca-line"/>');
      }
      pts.forEach(function (pt, i) {
        if (isNil(pt.value)) return;
        var px = x(i), py = y(pt.value);
        out.push('<circle cx="' + px + '" cy="' + py + '" r="3.2" fill="' + color + '" class="ca-dot">'
          + '<title>' + esc(pt.label) + ' · ' + esc(s.name) + '：' + fmt(pt.value) + (unit ? ' ' + unit : '') + '</title></circle>');
        // 极值标注：只对第一条序列，标最大值
        if (si === 0 && pt.isMax) {
          out.push('<text x="' + px + '" y="' + (py - 8) + '" class="ca-extreme" text-anchor="middle">↑' + fmt(pt.value) + '</text>');
        }
        if (si === 0 && pt.isMin) {
          out.push('<text x="' + px + '" y="' + (py + 14) + '" class="ca-extreme is-min" text-anchor="middle">↓' + fmt(pt.value) + '</text>');
        }
      });
    });

    // 均值虚线
    if (mean != null) {
      var my = y(mean);
      out.push('<line x1="' + padL + '" y1="' + my + '" x2="' + (width - padR) + '" y2="' + my + '" class="ca-mean" stroke-dasharray="6 4"/>');
      out.push('<text x="' + (width - padR - 4) + '" y="' + (my - 5) + '" class="ca-mean-label" text-anchor="end">均值 ' + fmt(mean) + '</text>');
    }

    // x 轴标签
    labels.forEach(function (lb, i) {
      var px = x(i);
      var lbl = lb;
      if (opts.xLabelFmt) lbl = opts.xLabelFmt(lb);
      if (labels.length > 8 && lbl.length > 4) lbl = lbl.slice(0, 4);
      out.push('<text x="' + px + '" y="' + (height - 6) + '" class="ca-xlabel" text-anchor="middle">' + esc(lbl) + '</text>');
    });

    // 图例
    if (showLegend && series.length > 1) {
      var lx = padL; var ly = 12;
      series.forEach(function (s, si) {
        var color = s.color || PALETTE[si % PALETTE.length];
        out.push('<rect x="' + lx + '" y="' + (ly - 6) + '" width="12" height="3" rx="1.5" fill="' + color + '"/>');
        out.push('<text x="' + (lx + 16) + '" y="' + ly + '" class="ca-legend">' + esc(s.name) + '</text>');
        lx += 16 + s.name.length * 7 + 14;
      });
    }

    out.push('</svg>');
    return out.join('');
  }

  // ============================================================
  // 2) 分组柱状（同比 / 环比）
  // ============================================================
  function groupBar(opts) {
    var groups = opts.groups;           // [{ label, current, last }]
    var width = opts.width || 620;
    var height = opts.height || 300;
    var unit = opts.unit || '';
    var padL = opts.padL != null ? opts.padL : 48;
    var padR = opts.padR != null ? opts.padR : 16;
    var padT = opts.padT != null ? opts.padT : 30;
    var padB = opts.padB != null ? opts.padB : 28;
    var curName = opts.currentName || '本期';
    var lastName = opts.lastName || '同期';

    var max = scaleMax(groups.map(function (g) { return Math.max(g.current || 0, g.last || 0); }));
    var plotW = width - padL - padR;
    var plotH = height - padT - padB;
    var n = groups.length;
    var groupW = plotW / Math.max(n, 1);
    var barW = Math.max(8, Math.min(26, groupW * 0.28));

    function y(v) { return padT + plotH - (v / max) * plotH; }

    var out = [];
    out.push('<svg viewBox="0 0 ' + width + ' ' + height + '" class="ca-chart" preserveAspectRatio="xMidYMid meet">');
    if (opts.title) out.push('<text x="' + padL + '" y="' + (padT - 12) + '" class="ca-title">' + esc(opts.title) + '</text>');

    for (var t = 0; t <= 5; t++) {
      var tv = max * t / 5;
      var ty = y(tv);
      out.push('<line x1="' + padL + '" y1="' + ty + '" x2="' + (width - padR) + '" y2="' + ty + '" class="ca-grid"/>');
      out.push('<text x="' + (padL - 6) + '" y="' + (ty + 4) + '" class="ca-axis" text-anchor="end">' + fmt(tv) + '</text>');
    }

    groups.forEach(function (g, i) {
      var cx = padL + groupW * i + groupW / 2;
      var x1 = cx - barW - 2;
      var x2 = cx + 2;
      var hCur = (g.current / max) * plotH;
      var hLast = (g.last / max) * plotH;
      // 本期
      out.push('<rect x="' + x1 + '" y="' + (padT + plotH - hCur) + '" width="' + barW + '" height="' + hCur + '" rx="2" class="ca-bar-cur">'
        + '<title>' + esc(g.label) + ' · ' + esc(curName) + '：' + fmt(g.current) + (unit ? ' ' + unit : '') + '</title></rect>');
      // 同期
      out.push('<rect x="' + x2 + '" y="' + (padT + plotH - hLast) + '" width="' + barW + '" height="' + hLast + '" rx="2" class="ca-bar-last">'
        + '<title>' + esc(g.label) + ' · ' + esc(lastName) + '：' + fmt(g.last) + (unit ? ' ' + unit : '') + '</title></rect>');
      out.push('<text x="' + cx + '" y="' + (height - 6) + '" class="ca-xlabel" text-anchor="middle">' + esc(g.label) + '</text>');
    });

    out.push('<rect x="' + padL + '" y="' + 12 + '" width="12" height="3" rx="1.5" fill="' + C.primary + '"/>');
    out.push('<text x="' + (padL + 16) + '" y="' + 15 + '" class="ca-legend">' + esc(curName) + '</text>');
    out.push('<rect x="' + (padL + 16 + curName.length * 7 + 18) + '" y="' + 12 + '" width="12" height="3" rx="1.5" fill="' + C.info + '"/>');
    out.push('<text x="' + (padL + 16 + curName.length * 7 + 52) + '" y="' + 15 + '" class="ca-legend">' + esc(lastName) + '</text>');

    out.push('</svg>');
    return out.join('');
  }

  // ============================================================
  // 3) 横向条形（分布 / 排名）
  // ============================================================
  function hBar(opts) {
    var items = opts.items;             // [{ label, value, color? }]
    var width = opts.width || 620;
    var height = opts.height || null;
    var unit = opts.unit || '';
    var barH = opts.barH || 20;
    var gap = opts.gap || 10;
    var padT = opts.padT != null ? opts.padT : 30;
    var padB = opts.padB != null ? opts.padB : 10;
    var padL = opts.padL != null ? opts.padL : 98;
    var padR = opts.padR != null ? opts.padR : 56;
    var showValue = opts.showValue !== false;

    var n = items.length;
    if (height == null) height = padT + padB + n * (barH + gap);
    var max = scaleMax(items.map(function (it) { return it.value; }));
    var plotW = width - padL - padR;
    var labelW = padL - 12;

    function y(i) { return padT + i * (barH + gap) + barH / 2; }

    var out = [];
    out.push('<svg viewBox="0 0 ' + width + ' ' + height + '" class="ca-chart" preserveAspectRatio="xMidYMid meet">');
    if (opts.title) out.push('<text x="' + padL + '" y="' + (padT - 12) + '" class="ca-title">' + esc(opts.title) + '</text>');

    items.forEach(function (it, i) {
      var color = it.color || PALETTE[i % PALETTE.length];
      var bw = max > 0 ? (it.value / max) * plotW : 0;
      var ry = y(i);
      // 网格线
      out.push('<line x1="' + padL + '" y1="' + ry + '" x2="' + (padL + plotW) + '" y2="' + ry + '" class="ca-grid-light"/>');
      // 标签（左对齐，若过长则截断）
      var lbl = it.label;
      if (lbl.length > 8) lbl = lbl.slice(0, 8) + '…';
      out.push('<text x="' + (padL - 8) + '" y="' + (ry + 4) + '" class="ca-hlabel" text-anchor="end">' + esc(lbl) + '</text>');
      // 条
      out.push('<rect x="' + padL + '" y="' + (ry - barH / 2) + '" width="' + bw + '" height="' + barH + '" rx="' + (barH / 2) + '" fill="' + color + '" opacity="0.85">'
        + '<title>' + esc(it.label) + '：' + fmt(it.value) + (unit ? ' ' + unit : '') + '</title></rect>');
      // 数值
      if (showValue) {
        out.push('<text x="' + (padL + bw + 8) + '" y="' + (ry + 4) + '" class="ca-hvalue">' + fmt(it.value) + '</text>');
      }
      // 占比（可选）
      if (opts.showPct) {
        var total = items.reduce(function (s, x) { return s + (x.value || 0); }, 0);
        var p = total > 0 ? (it.value / total * 100) : 0;
        out.push('<text x="' + (width - padR + 4) + '" y="' + (ry + 4) + '" class="ca-hpct" text-anchor="start">' + fmtPct(p, 1) + '</text>');
      }
    });

    out.push('</svg>');
    return out.join('');
  }

  // ============================================================
  // 4) 环形图（构成 / 占比）——「环 + 右侧图例」布局，避免多扇区标签重叠
  // ============================================================
  function donut(opts) {
    var items = opts.items;             // [{ label, value, color? }]
    var unit = opts.unit || '';
    var thickness = opts.thickness || 22;
    var total = items.reduce(function (s, it) { return s + (it.value || 0); }, 0);
    var centerTitle = opts.centerTitle || '';
    var centerValue = opts.centerValue != null ? opts.centerValue : total;

    // 高度由 size 控制（兼容旧调用），宽度 = 环 + 图例
    var height = opts.size || 280;
    var ringSize = Math.min(height, 240);
    var pad = opts.pad != null ? opts.pad : 8;
    var cx = ringSize / 2;
    var cy = height / 2;
    var radius = (ringSize - thickness) / 2 - pad;
    var legendX = ringSize + 6;
    var legendW = 150;
    var width = ringSize + legendW + 18;

    var out = [];
    out.push('<svg viewBox="0 0 ' + width + ' ' + height + '" class="ca-chart ca-donut" preserveAspectRatio="xMidYMid meet">');

    var start = -Math.PI / 2;
    var shown = 0;

    items.forEach(function (it, i) {
      var color = it.color || PALETTE[i % PALETTE.length];
      var v = it.value || 0;
      var frac = total > 0 ? v / total : 0;
      var segStart = start + (shown / (total || 1)) * 2 * Math.PI;
      var segLen = frac * 2 * Math.PI;
      var midDeg = segStart + segLen / 2;
      var x1 = cx + radius * Math.cos(segStart);
      var y1 = cy + radius * Math.sin(segStart);
      var x2 = cx + radius * Math.cos(segStart + segLen);
      var y2 = cy + radius * Math.sin(segStart + segLen);
      var large = (segLen > Math.PI) ? 1 : 0;
      if (v > 0) {
        out.push('<path d="M' + x1.toFixed(2) + ' ' + y1.toFixed(2)
          + ' A' + radius + ' ' + radius + ' 0 ' + large + ' 1 ' + x2.toFixed(2) + ' ' + y2.toFixed(2)
          + '" fill="none" stroke="' + color + '" stroke-width="' + thickness + '" class="ca-arc">'
          + '<title>' + esc(it.label) + '：' + fmt(v) + (unit ? ' ' + unit : '') + '（' + fmtPct(frac * 100, 1) + '）</title></path>');
      }
      shown += v;
    });

    // 中心文本
    out.push('<text x="' + cx + '" y="' + (cy - 6) + '" class="ca-donut-center-title" text-anchor="middle">' + esc(centerTitle) + '</text>');
    out.push('<text x="' + cx + '" y="' + (cy + 18) + '" class="ca-donut-center-value" text-anchor="middle">' + fmt(centerValue) + (unit ? '<tspan class="ca-donut-unit">' + esc(unit) + '</tspan>' : '') + '</text>');

    // 右侧图例
    var rowH = Math.min(28, (height - 20) / Math.max(items.length, 1));
    if (rowH < 20) rowH = 20;
    var startY = height / 2 - (items.length - 1) * rowH / 2;
    items.forEach(function (it, i) {
      var color = it.color || PALETTE[i % PALETTE.length];
      var ly = startY + i * rowH;
      var pct = total > 0 ? (it.value / total * 100) : 0;
      out.push('<rect x="' + legendX + '" y="' + (ly - 5) + '" width="10" height="10" rx="2" fill="' + color + '"/>');
      var lbl = it.label.length > 7 ? it.label.slice(0, 7) + '…' : it.label;
      out.push('<text x="' + (legendX + 16) + '" y="' + (ly + 4) + '" class="ca-donut-label">' + esc(lbl) + '</text>');
      out.push('<text x="' + (legendX + legendW) + '" y="' + (ly + 4) + '" class="ca-donut-value" text-anchor="end">' + fmtPct(pct, 1) + '</text>');
    });

    out.push('</svg>');
    return out.join('');
  }

  // ============================================================
  // 5) 环形进度 / 仪表（达成率、履约率）
  // ============================================================
  function gauge(opts) {
    var value = opts.value;             // 0~1
    var size = opts.size || 190;
    var label = opts.label || '完成率';
    var unit = opts.unit || '2.5万';
    var thickness = opts.thickness || 18;
    var cx = size / 2, cy = size / 2;
    var radius = (size - thickness) / 2 - (opts.pad || 0);
    var start = -Math.PI / 2;
    var pct = clamp(isNil(value) ? 0 : value, 0, 1);
    var color = opts.color || (pct >= 1 ? C.primary : (pct >= 0.8 ? C.info : C.warning));
    var track = '#eef1f4';

    var out = [];
    out.push('<svg viewBox="0 0 ' + size + ' ' + size + '" class="ca-chart ca-gauge" preserveAspectRatio="xMidYMid meet">');
    // 底轨
    var circ = 2 * Math.PI * radius;
    out.push('<circle cx="' + cx + '" cy="' + cy + '" r="' + radius + '" fill="none" stroke="' + track + '" stroke-width="' + thickness + '"/>');
    // 进度弧
    var dash = circ * pct;
    out.push('<circle cx="' + cx + '" cy="' + cy + '" r="' + radius + '" fill="none" stroke="' + color + '" stroke-width="' + thickness + '" stroke-dasharray="' + dash + ' ' + circ + '" stroke-linecap="round" transform="rotate(0 ' + cx + ' ' + cy + ')"/>');
    // 中心
    out.push('<text x="' + cx + '" y="' + (cy + 4) + '" class="ca-gauge-value" text-anchor="middle">' + fmtPct(pct, 0) + '</text>');
    out.push('<text x="' + cx + '" y="' + (cy + 26) + '" class="ca-gauge-label" text-anchor="middle">' + esc(label) + '</text>');
    out.push('</svg>');
    return out.join('');
  }

  // ============================================================
  // 极值 / 摘要卡片（趋势图中最大值、最小值、均值、波动）
  // ============================================================
  function statInsight(values, unit) {
    var nums = values.filter(function (v) { return !isNil(v); });
    if (!nums.length) return { max: null, min: null, mean: null, span: null };
    var max = Math.max.apply(null, nums);
    var min = Math.min.apply(null, nums);
    var mean = nums.reduce(function (s, v) { return s + v; }, 0) / nums.length;
    return { max: max, min: min, mean: mean, span: unit };
  }

  // helpers
  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  global.caChart = {
    line: line,
    groupBar: groupBar,
    hBar: hBar,
    donut: donut,
    gauge: gauge,
    statInsight: statInsight,
    fmt: fmt,
    fmtWan: fmtWan,
    fmtPct: fmtPct,
    PALETTE: PALETTE,
    colors: C,
    esc: esc,
    niceMax: niceMax,
  };
})(window);
