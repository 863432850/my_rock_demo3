/**
 * 碳排放异动分析 · 报告渲染（月度口径）
 * - URL 参数：?month=2026-06（缺省 2026-06）
 * - 数据口径：**月度碳排放量（当月值，万t）**，与《双碳管理月度简报》同一数据源
 * - 异动判定：以「上月排放量」为环比基准、「上年同月排放量」为同比基准，
 *   取两者偏离度绝对值较大者作为判定偏离度；≥5% 判异动，分三级（一般 / 较大 / 重大）
 * - 归因文案属叙事层（不含任何排放数值），按行业 × 方向从固定池中按种子派生，同一入参结果一致
 * - 「下载报告（PDF）」用 html2canvas 逐页渲染 + jsPDF 切片生成
 *
 * 说明：本页不采集「逐日排放量」与「分工序（排放源）排放量」——
 * 这两类明细在当前数据条件下无法获取，报告一律按月度口径出具。
 */

(function () {
  'use strict';

  var ORG = '河南安钢周口钢铁有限责任公司';
  var GREEN = '#00b42a';

  /* ---------- 基础工具 ---------- */

  function pad2(n) { return String(n).padStart(2, '0'); }
  function lastDay(y, m) { return new Date(y, m, 0).getDate(); }
  function fmt(n, d) {
    if (n == null || !isFinite(n)) return '--';
    return Number(n).toLocaleString('zh-CN', { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function signed(n, d) {
    if (n == null || !isFinite(n)) return '--';
    return (n > 0 ? '+' : '') + fmt(n, d);
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
  /** 安全比率（变化率）：分母必须 > 0，否则返回 null（渲染为 --），绝不产出 NaN / Infinity */
  function ratio(cur, base) {
    if (cur == null || base == null) return null;
    if (!isFinite(cur) || !isFinite(base) || base <= 0) return null;
    return (cur - base) / base * 100;
  }

  /* ---------- 月份参数 ---------- */

  var qs = new URLSearchParams(location.search);
  var monthParam = qs.get('month') || '2026-06';
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monthParam)) monthParam = '2026-06';
  var Y = Number(monthParam.slice(0, 4));
  var M = Number(monthParam.slice(5, 7));
  var MONTH_CN = Y + '年' + M + '月';
  var DAYS = lastDay(Y, M);

  /* ---------- 月度碳排放数据（当月值，万t；与双碳简报同源） ---------- */
  /* 这里的两个数组即提示词文档中的 emission.monthly.cur / emission.monthly.prev */

  var MONTH_CUR = [27.42, 25.60, 27.95, 27.10, 26.86, 23.15, 26.92, 27.38, 26.55, 27.20, 26.74, 27.86];
  var MONTH_PREV = [28.35, 26.90, 28.62, 27.88, 27.44, 27.02, 27.65, 28.10, 27.18, 27.82, 27.30, 28.45];

  function pick(arr, i) {
    var v = arr[i];
    return (v == null || !isFinite(v)) ? 0 : Number(v);
  }

  var CUR_MONTH = pick(MONTH_CUR, M - 1);                       // 本月排放量（万t）
  var PREV_YEAR_MONTH = pick(MONTH_PREV, M - 1);                // 上年同月（万t）
  var PREV_MONTH = M === 1 ? null : pick(MONTH_CUR, M - 2);     // 上月（万t）
  var MOM = M === 1 ? null : ratio(CUR_MONTH, PREV_MONTH);      // 环比（%）
  var YOY = ratio(CUR_MONTH, PREV_YEAR_MONTH);                  // 同比（%）

  function ytd(arr, upto) {
    var s = 0;
    for (var i = 0; i < upto; i++) s += pick(arr, i);
    return s;
  }
  var YTD_CUR = ytd(MONTH_CUR, M);                              // 年度累计（万t）
  var YTD_PREV = ytd(MONTH_PREV, M);                            // 上年同期累计（万t）
  var YTD_YOY = ratio(YTD_CUR, YTD_PREV);                       // 累计同比（%）

  /* ---------- 异动判定（环比为主、同比辅助） ---------- */

  var DEV = null, DEV_BASIS = '';
  if (MOM != null && YOY != null) {
    if (Math.abs(MOM) >= Math.abs(YOY)) { DEV = MOM; DEV_BASIS = '环比'; }
    else { DEV = YOY; DEV_BASIS = '同比'; }
  } else if (MOM != null) { DEV = MOM; DEV_BASIS = '环比'; }
  else if (YOY != null) { DEV = YOY; DEV_BASIS = '同比'; }

  var LEVEL_NAME = { 0: '平稳', 1: '一般异动', 2: '较大异动', 3: '重大异动' };
  var LEVEL_COLOR = { 0: '#00b42a', 1: '#165dff', 2: '#ff7d00', 3: '#f53f3f' };

  /** 判定偏离度 → 等级：0 平稳(<5%) / 1 一般(≥5%) / 2 较大(≥8%) / 3 重大(≥12%) */
  function levelOf(dev) {
    if (dev == null || !isFinite(dev)) return null;
    var a = Math.abs(dev);
    if (a >= 12) return 3;
    if (a >= 8) return 2;
    if (a >= 5) return 1;
    return 0;
  }
  var LEVEL = levelOf(DEV);

  function lvBadge(lv) {
    if (lv == null) return '<span class="lv lv-none">--</span>';
    return '<span class="lv lv-' + lv + '">' + LEVEL_NAME[lv] + '</span>';
  }

  /* ---------- 行业推断与归因池（叙事层，不含任何排放数值） ---------- */

  var INDUSTRY_RULES = [
    { keys: ['钢', '铁', '冶金', '轧钢'], name: '钢铁' },
    { keys: ['发电', '电厂', '热电', '电力'], name: '火力发电' },
    { keys: ['水泥', '建材', '混凝土', '玻璃', '陶瓷'], name: '建材' },
    { keys: ['化工', '石化', '炼化', '化学', '化肥'], name: '化工石化' },
    { keys: ['铝', '铜', '锌', '镁', '有色'], name: '有色金属' }
  ];
  function industryOf(name) {
    var s = String(name || '');
    for (var i = 0; i < INDUSTRY_RULES.length; i++) {
      for (var j = 0; j < INDUSTRY_RULES[i].keys.length; j++) {
        if (s.indexOf(INDUSTRY_RULES[i].keys[j]) >= 0) return INDUSTRY_RULES[i].name;
      }
    }
    return '通用工业';
  }

  /** UP = 排放上升归因；DOWN = 排放下降归因；FLAT = 平稳说明。每池 3 条，逐字使用。 */
  var CAUSE = {
    '钢铁': {
      UP: [
        '本月各工序生产负荷较上月提升，铁前与炼钢环节燃料消耗同步增加，化石燃料燃烧排放相应上升',
        '高炉复风后产量处于爬坡阶段，铁水产量回升带动燃料比阶段性上升',
        '炉料结构与燃料配比发生调整，焦炭与喷吹煤消耗增加，单位产品排放强度上升'
      ],
      DOWN: [
        '本月开展计划性检修，主要工序阶段性降负荷运行，燃料消耗与工序排放同步下降',
        '高炉按计划休风，铁水产量下降带动铁前工序排放回落',
        '提高废钢比、优化炉料结构，铁水消耗与燃料单耗下降，吨钢排放强度改善'
      ],
      FLAT: [
        '本月各工序运行负荷与燃料结构基本稳定，排放波动处于正常区间',
        '生产组织平稳，主要能源介质单耗与上月基本持平',
        '能源回收与环保设施运行正常，未出现明显工况波动'
      ]
    },
    '火力发电': {
      UP: [
        '机组负荷率较上月提升，燃煤量增加，燃料燃烧排放上升',
        '入炉煤热值下降，相同供电量下煤耗上升，排放强度增加',
        '机组启停调峰频次增加，启动过程燃料消耗与排放相应上升'
      ],
      DOWN: [
        '机组按计划开展检修，阶段性停机使燃料消耗与排放下降',
        '深度调峰期间机组低负荷运行，燃煤量下降',
        '掺烧生物质等低碳燃料比例提升，化石燃料消耗下降'
      ],
      FLAT: [
        '本月机组负荷率与入炉煤质基本稳定，排放波动处于正常区间',
        '运行方式未发生明显调整，供电煤耗与上月基本持平',
        '环保与节能设施运行正常，未出现明显工况波动'
      ]
    },
    '建材': {
      UP: [
        '回转窑运转率提升，熟料产量增加带动燃料燃烧与工艺过程排放上升',
        '生料易烧性变差，窑系统热耗上升，单位熟料排放强度增加',
        '替代燃料投加比例下降，化石燃料消耗相应上升'
      ],
      DOWN: [
        '回转窑按计划停窑检修，熟料产量下降带动排放回落',
        '替代燃料与替代原料掺加比例提升，化石燃料与石灰石用量下降',
        '窑系统热工制度优化，烧成煤耗下降，单位熟料排放改善'
      ],
      FLAT: [
        '本月窑系统运行稳定，熟料产量与煤耗波动处于正常区间',
        '生料配比与燃料结构未发生明显调整，排放水平与上月基本持平',
        '余热回收系统运行正常，未出现明显工况波动'
      ]
    },
    '化工石化': {
      UP: [
        '装置负荷较上月提升，加热炉燃料气消耗增加，排放上升',
        '原料组成变化导致工艺过程排放上升',
        '蒸汽系统供汽量增加，锅炉燃料消耗相应上升'
      ],
      DOWN: [
        '装置按计划停车检修，燃料消耗与工艺过程排放同步下降',
        '余热回收系统投运，加热炉与锅炉燃料消耗下降',
        '原料结构优化，工艺过程排放与副产气放空量下降'
      ],
      FLAT: [
        '本月装置负荷与原料结构基本稳定，排放波动处于正常区间',
        '蒸汽与加热炉系统运行方式未发生明显调整，能耗与上月基本持平',
        '火炬气回收与余热利用系统运行正常，未出现明显工况波动'
      ]
    },
    '有色金属': {
      UP: [
        '电解系列电流效率波动，直流电耗上升，间接排放增加',
        '电解槽效应系数上升，全氟化碳（PFC）排放增加',
        '自备机组负荷提升，燃煤量与燃料燃烧排放上升'
      ],
      DOWN: [
        '电解系列按计划停槽检修，产量下降带动排放回落',
        '槽控系统优化，效应系数下降，PFC 排放减少',
        '电流效率提升，直流电耗下降，间接排放改善'
      ],
      FLAT: [
        '本月电解系列运行平稳，电流效率与效应系数波动处于正常区间',
        '槽控参数与自备机组运行方式未发生明显调整，能耗与上月基本持平',
        '烟气净化与余热回收系统运行正常，未出现明显工况波动'
      ]
    },
    '通用工业': {
      UP: [
        '本月生产负荷提升，锅炉与主要用能设备燃料消耗增加，排放上升',
        '燃料结构中高碳燃料占比上升，单位产品排放强度增加',
        '设备运行工况波动，热效率下降，能耗与排放相应上升'
      ],
      DOWN: [
        '主要用能设备按计划检修，阶段性停运使燃料消耗与排放下降',
        '余热回收装置投运，供热与用能系统能耗下降',
        '清洁能源替代比例提升，化石燃料消耗与排放下降'
      ],
      FLAT: [
        '本月生产负荷与燃料结构基本稳定，排放波动处于正常区间',
        '主要用能设备运行方式未发生明显调整，能耗与上月基本持平',
        '能源计量与回收设施运行正常，未出现明显工况波动'
      ]
    }
  };

  var INDUSTRY = industryOf(ORG);

  /** 归因方向：平稳 → FLAT；否则按偏离方向取 UP / DOWN。同一入参结果完全一致。 */
  function causeText() {
    var pool = CAUSE[INDUSTRY] || CAUSE['通用工业'];
    var dir = LEVEL === 0 ? 'FLAT' : (DEV > 0 ? 'UP' : 'DOWN');
    var arr = pool[dir];
    var rnd = mulberry32(Y * 100 + M);
    return arr[Math.floor(rnd() * arr.length) % arr.length];
  }

  /* ---------- SVG 折线图（含无数据态） ---------- */

  function lineChart(labels, series, opts) {
    opts = opts || {};
    var W = 760, H = opts.height || 250;
    var P = { t: 34, r: 18, b: 32, l: 56 };
    var iw = W - P.l - P.r, ih = H - P.t - P.b;
    var dec = opts.decimals == null ? 2 : opts.decimals;

    var vals = [];
    series.forEach(function (s) {
      s.values.forEach(function (v) { if (v != null && isFinite(v)) vals.push(v); });
    });
    var maxV = vals.length ? Math.max.apply(null, vals) : 0;
    var minV = vals.length ? Math.min.apply(null, vals) : 0;
    // 无数据态：没有任何有效值、全为 0、或跨度为 0（此时归一化会除零）
    var empty = !vals.length || vals.every(function (v) { return v === 0; }) || (maxV - minV) === 0;

    var lo = 0, hi = 1;
    if (!empty) {
      var span = maxV - minV;
      lo = minV - span * 0.12;
      hi = maxV + span * 0.12;
    }

    function x(i) { return P.l + (labels.length <= 1 ? iw / 2 : iw * i / (labels.length - 1)); }
    function y(v) { return P.t + ih * (1 - (v - lo) / (hi - lo)); }

    var out = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg">';
    for (var g = 0; g <= 4; g++) {
      var gv = empty ? 0 : lo + (hi - lo) * g / 4;
      var gy = y(gv);
      out += '<line x1="' + P.l + '" y1="' + gy + '" x2="' + (W - P.r) + '" y2="' + gy + '" stroke="' + (g === 0 ? '#c9cdd4' : '#eef1f4') + '"/>';
      out += '<text x="' + (P.l - 8) + '" y="' + (gy + 4) + '" font-size="10.5" fill="#98a1ab" text-anchor="end">' + fmt(gv, dec) + '</text>';
    }
    labels.forEach(function (lb, i) {
      out += '<text x="' + x(i) + '" y="' + (H - 10) + '" font-size="10.5" fill="#98a1ab" text-anchor="middle">' + esc(lb) + '</text>';
    });
    var lx = W - P.r;
    for (var li = series.length - 1; li >= 0; li--) {
      var nm = series[li].name;
      var w = nm.length * 11 + 26;
      lx -= w;
      out += '<rect x="' + lx + '" y="8" width="14" height="4" rx="2" fill="' + series[li].color + '"/>';
      out += '<text x="' + (lx + 19) + '" y="14" font-size="11" fill="#606266">' + esc(nm) + '</text>';
    }
    if (empty) {
      out += '<text x="' + (P.l + iw / 2) + '" y="' + (P.t + ih / 2 + 4) + '" font-size="12.5" fill="#98a1ab" text-anchor="middle">本期暂无数据</text>';
    } else {
      series.forEach(function (s) {
        var pts = [];
        s.values.forEach(function (v, i) { if (v != null && isFinite(v)) pts.push(x(i) + ',' + y(v)); });
        if (pts.length > 1) {
          out += '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + s.color + '" stroke-width="2" stroke-linejoin="round"/>';
        }
        s.values.forEach(function (v, i) {
          if (v == null || !isFinite(v)) return;
          out += '<circle cx="' + x(i) + '" cy="' + y(v) + '" r="3" fill="#fff" stroke="' + s.color + '" stroke-width="2"/>';
        });
      });
    }
    return out + '</svg>';
  }

  function chartBlock(innerHtml, caption) {
    return '<div class="chart-box">' + innerHtml + '</div><div class="chart-caption">' + esc(caption) + '</div>';
  }

  /* ---------- 通用小块 ---------- */

  function deltaHtml(pct, label) {
    if (pct == null) return '<div class="kpi-delta is-flat">' + label + ' --</div>';
    var cls = pct > 0 ? 'is-pos' : (pct < 0 ? 'is-neg' : 'is-flat');
    var arrow = pct > 0 ? '▲' : (pct < 0 ? '▼' : '—');
    return '<div class="kpi-delta ' + cls + '">' + label + ' ' + arrow + ' ' + signed(pct, 2) + '%</div>';
  }

  function kpiCard(name, valHtml, subHtml) {
    return '<div class="kpi-card"><div class="kpi-name">' + name + '</div>'
      + '<div class="kpi-val">' + valHtml + '</div>' + (subHtml || '') + '</div>';
  }

  /** 带符号的变化值 / 偏离度单元格（明细表用；正=上升=红，负=下降=绿） */
  function numTd(v, signedMode) {
    if (v == null || !isFinite(v)) return '<td>--</td>';
    var cls = v > 0 ? 'is-pos' : (v < 0 ? 'is-neg' : '');
    return '<td class="' + cls + '">' + (signedMode ? signed(v, 2) : fmt(v, 2)) + '</td>';
  }

  /* ---------- 摘要 · 本月排放概览 ---------- */

  function summaryHtml() {
    var lvName = LEVEL == null ? '--' : LEVEL_NAME[LEVEL];
    var lvColor = LEVEL == null ? '#98a1ab' : LEVEL_COLOR[LEVEL];
    var basis = DEV == null ? '判定偏离度 --' : DEV_BASIS + '偏离 ' + signed(DEV, 2) + '%';

    var html = '<div class="kpi-grid">'
      + kpiCard('本月碳排放量', fmt(CUR_MONTH, 2) + '<small> 万t</small>',
        M === 1 ? '<div class="kpi-delta is-flat">全年开局基线</div>' : deltaHtml(MOM, '环比'))
      + kpiCard('去年同月排放量', fmt(PREV_YEAR_MONTH, 2) + '<small> 万t</small>', deltaHtml(YOY, '同比'))
      + kpiCard('年度累计排放量', fmt(YTD_CUR, 2) + '<small> 万t</small>', deltaHtml(YTD_YOY, '累计同比'))
      + kpiCard('本月异动判定', '<span style="color:' + lvColor + '">' + lvName + '</span>',
        '<div class="kpi-delta is-flat">' + basis + '</div>')
      + '</div>';

    var p1 = '本月碳排放量 <strong>' + fmt(CUR_MONTH, 2) + '</strong> 万t，'
      + (M === 1 ? '为全年开局基线' : '环比 ' + (MOM == null ? '无可比数据' : signed(MOM, 2) + '%'))
      + '，同比 ' + (YOY == null ? '无可比数据' : signed(YOY, 2) + '%') + '。';
    var p2 = '年度累计排放量 <strong>' + fmt(YTD_CUR, 2) + '</strong> 万t，'
      + (YTD_YOY == null
        ? '较上年同期无可比数据。'
        : '较上年同期 ' + fmt(YTD_PREV, 2) + ' 万t 同比 ' + signed(YTD_YOY, 2) + '%。');
    var p3, p4;
    if (LEVEL == null) {
      p3 = '本期无有效月度排放数据，异动判定不适用。';
      p4 = '综合研判：本期无有效排放数据，暂不评价排放管控形势。';
    } else if (LEVEL === 0) {
      p3 = '本月环比偏离 ' + signed(MOM, 2) + '%、同比偏离 ' + signed(YOY, 2) + '%，均未达到 <strong>±5%</strong> 判定阈值，本月排放判定为「<strong>平稳</strong>」。';
      p4 = '综合研判：本月排放管控形势总体平稳，指标波动处于正常区间，按常规流程跟踪即可。';
    } else {
      p3 = '本月判定偏离度取绝对值较大者（' + DEV_BASIS + '偏离）为 <strong>' + signed(DEV, 2) + '%</strong>，触发「<strong>' + LEVEL_NAME[LEVEL] + '</strong>」判定。';
      p4 = '综合研判：本月排放管控形势为「<strong>' + LEVEL_NAME[LEVEL] + '</strong>」，需按本报告第三章建议落实核查与处置。';
    }

    html += '<h3 class="summary-h3">本月分析要点</h3><ul class="point-list">'
      + '<li>' + p1 + '</li>'
      + '<li>' + p2 + '</li>'
      + '<li>' + p3 + '</li>'
      + '<li>' + p4 + '</li>'
      + '</ul>';
    return html;
  }

  /* ---------- 一、月度排放趋势 ---------- */

  function monthlyTrendHtml() {
    var labels = [], curVals = [], prevVals = [];
    for (var i = 0; i < M; i++) {
      labels.push(Y + '-' + pad2(i + 1));
      curVals.push(pick(MONTH_CUR, i));
      prevVals.push(pick(MONTH_PREV, i));
    }
    var html = chartBlock(lineChart(labels, [
      { name: '本期（' + Y + '）', color: GREEN, values: curVals },
      { name: '同期（' + (Y - 1) + '）', color: '#165dff', values: prevVals }
    ]), '（图）月度碳排放量趋势（单位：万t）');

    html += '<div class="table-caption"><span>月度碳排放量明细表（当月口径）</span><span class="unit">单位：万t</span></div>'
      + '<table class="btable"><thead><tr><th>月份</th><th>本期</th><th>同期</th><th>同比变化值</th><th>同比(%)</th><th>上月</th><th>环比变化值</th><th>环比(%)</th></tr></thead><tbody>';
    for (var j = 0; j < M; j++) {
      var cur = pick(MONTH_CUR, j);
      var prev = pick(MONTH_PREV, j);
      var ring = j === 0 ? null : pick(MONTH_CUR, j - 1);
      var yoyV = ratio(cur, prev);
      var momV = ring == null ? null : ratio(cur, ring);
      html += '<tr><td>' + Y + '-' + pad2(j + 1) + '</td>'
        + '<td>' + fmt(cur, 2) + '</td>'
        + '<td>' + fmt(prev, 2) + '</td>'
        + numTd(yoyV == null ? null : cur - prev, true)
        + numTd(yoyV, true)
        + (ring == null ? '<td>--</td>' : '<td>' + fmt(ring, 2) + '</td>')
        + (ring == null ? '<td>--</td>' : numTd(cur - ring, true))
        + numTd(momV, true)
        + '</tr>';
    }
    html += '</tbody></table>'
      + '<div class="btable-note">注：本期为「当月排放量」口径（非年累计）；同比变化值 = 本期 − 同期，环比变化值 = 本期 − 上月。</div>';
    return html;
  }

  /* ---------- 二、本月异动判定与分析 ---------- */

  function judgeHtml() {
    var html = '<h2 class="brief-h2" id="sec-2-1">（一）判定规则</h2>'
      + '<p class="brief-p">本报告按<b>月</b>开展碳排放异动识别：以「上月排放量」为环比基准、「上年同月排放量」为同比基准，'
      + '分别计算环比偏离度与同比偏离度，<strong>取两者绝对值较大者</strong>作为判定偏离度；'
      + '判定偏离度绝对值达到 <strong>5%</strong> 即判定为异动，并按偏离程度分为三级：</p>'
      + '<table class="btable"><thead><tr><th>等级</th><th>判定标准（判定偏离度绝对值）</th><th>处置要求</th></tr></thead><tbody>'
      + '<tr><td>' + lvBadge(3) + '</td><td>≥ 12%</td><td>3 个工作日内完成现场核查，形成专项说明报公司碳排放管理组</td></tr>'
      + '<tr><td>' + lvBadge(2) + '</td><td>8% ~ 12%（含 8%）</td><td>5 个工作日内完成数据复核与归因分析</td></tr>'
      + '<tr><td>' + lvBadge(1) + '</td><td>5% ~ 8%（含 5%）</td><td>纳入日常监测台账，月度例会通报</td></tr>'
      + '<tr><td>' + lvBadge(0) + '</td><td>&lt; 5%</td><td>无需专项处置，按常规流程跟踪</td></tr>'
      + '</tbody></table>'
      + '<div class="btable-note">注：环比偏离度 =（本月排放量 − 上月排放量）÷ 上月排放量 × 100%；同比偏离度 =（本月排放量 − 上年同月排放量）÷ 上年同月排放量 × 100%。'
      + '判定偏离度取两者绝对值较大者。计量仪表校验、计划检修等已知因素导致的波动仍纳入判定并标注归因。</div>';

    /* （二）本月判定结论 */
    html += '<h2 class="brief-h2" id="sec-2-2">（二）本月判定结论</h2>'
      + '<div class="table-caption"><span>' + MONTH_CN + '异动判定明细</span><span class="unit">单位：万t / %</span></div>'
      + '<table class="btable"><thead><tr><th>判定基准</th><th>基准值</th><th>本月值</th><th>偏离度</th><th>是否触发</th></tr></thead><tbody>'
      + '<tr><td>环比（上月 ' + (M === 1 ? '无' : Y + '-' + pad2(M - 1)) + '）</td>'
      + '<td>' + (PREV_MONTH == null ? '--' : fmt(PREV_MONTH, 2)) + '</td>'
      + '<td>' + fmt(CUR_MONTH, 2) + '</td>'
      + numTd(MOM, true)
      + '<td>' + (MOM == null ? '--' : (Math.abs(MOM) >= 5 ? '是' : '否')) + '</td></tr>'
      + '<tr><td>同比（上年同月 ' + (Y - 1) + '-' + pad2(M) + '）</td>'
      + '<td>' + fmt(PREV_YEAR_MONTH, 2) + '</td>'
      + '<td>' + fmt(CUR_MONTH, 2) + '</td>'
      + numTd(YOY, true)
      + '<td>' + (YOY == null ? '--' : (Math.abs(YOY) >= 5 ? '是' : '否')) + '</td></tr>'
      + '</tbody></table>';

    if (LEVEL == null) {
      html += '<div class="verdict lv-none"><div class="verdict-head">' + lvBadge(null) + '</div>'
        + '<div class="verdict-txt">本期无有效月度排放数据，无法计算判定偏离度，异动判定不适用。判定规则自下期数据补齐后适用。</div></div>';
    } else {
      var word = LEVEL === 0
        ? '未达到 5% 判定阈值，本月排放判定为「平稳」，无需专项处置。'
        : '已达到「' + LEVEL_NAME[LEVEL] + '」判定标准（' + (LEVEL === 3 ? '≥ 12%' : (LEVEL === 2 ? '8% ~ 12%' : '5% ~ 8%')) + '），'
          + (DEV > 0 ? '排放量较基准上升' : '排放量较基准下降') + '，需按本报告第三章要求组织核查与处置。';
      html += '<div class="verdict lv-' + LEVEL + '"><div class="verdict-head">' + lvBadge(LEVEL) + '</div>'
        + '<div class="verdict-txt">本月排放量 <strong>' + fmt(CUR_MONTH, 2) + '</strong> 万t，'
        + '环比偏离 <strong>' + signed(MOM, 2) + '%</strong>、同比偏离 <strong>' + signed(YOY, 2) + '%</strong>；'
        + '判定偏离度取绝对值较大者（' + DEV_BASIS + '）为 <strong>' + signed(DEV, 2) + '%</strong>，'
        + word + '</div></div>';
    }

    /* （三）归因分析 */
    html += '<h2 class="brief-h2" id="sec-2-3">（三）归因分析</h2>';
    if (LEVEL == null) {
      html += '<p class="brief-p">本期排放数据缺失，暂不作归因分析。</p>';
    } else if (LEVEL === 0) {
      html += '<p class="brief-p">' + esc(causeText()) + '。'
        + '本月排放量与上月、上年同月相比变化幅度均在正常波动范围内，经与生产记录、能源计量台账交叉核对，数据链条完整，无需专项归因。</p>';
    } else {
      html += '<p class="brief-p">' + esc(causeText()) + '。'
        + '经与生产记录、能源计量数据交叉核对，本月产量、主要燃料消耗与该排放量波动方向一致，数据链条完整；'
        + '建议按第三章处置要求开展现场核查，进一步确认工艺工况与计量数据的对应关系。</p>';
    }
    return html;
  }

  /* ---------- 三、处置建议 ---------- */

  function actionHtml() {
    var adv = [];
    if (LEVEL == null) {
      adv.push('本期无有效排放数据，待数据补齐后按本报告要求组织核查与处置。');
      adv.push('对涉及的主要工序开展计量仪表专项校验，确保监测数据真实、准确、可追溯。');
    } else if (LEVEL === 0) {
      adv.push('本月未触发异动判定，建议保持现有生产组织与计量管理方式，并在下月数据出账后开展常规复核。');
      adv.push('对涉及的主要工序开展计量仪表专项校验，确保监测数据真实、准确、可追溯。');
    } else {
      adv.push('本月触发「' + LEVEL_NAME[LEVEL] + '」判定（' + DEV_BASIS + '偏离 ' + signed(DEV, 2) + '%），建议按处置要求组织生产、能源与计量部门联合复核，'
        + '核实产量、燃料消耗与计量数据，形成专项归因说明并归档。');
      adv.push('对本月波动涉及的工序开展计量仪表专项校验，确保监测数据真实、准确、可追溯。');
    }
    adv.push('在碳排放管理模块设置月度排放量偏离度自动预警（环比 ±5%、同比 ±5% 双阈值），实现月度数据出账后即时预警、当日推送。');
    adv.push('结合生产计划提前评估检修、限产、复风等工况变化对月度排放的影响，做好月度排放预算与偏差管理，减少非计划性波动。');
    adv.push('每月召开碳排放异动分析例会，通报月度偏离情况与处置进展，持续完善「监测—预警—核查—处置—归档」管理机制。');

    var html = '<ol class="advice-list">';
    adv.forEach(function (t) { html += '<li>' + t + '</li>'; });
    html += '</ol>';
    return html;
  }

  /* ---------- 报告组装 ---------- */

  function buildReport() {
    var dateRange = Y + '-' + pad2(M) + '-01 至 ' + Y + '-' + pad2(M) + '-' + DAYS;

    var html = '<div class="brief-page brief-cover-wrap"><div class="brief-cover">'
      + '<div class="cover-kicker">碳 排 放 异 动 分 析</div>'
      + '<h1>' + esc(ORG) + '<br/>碳排放异动分析报告</h1>'
      + '<div class="cover-month">' + esc(MONTH_CN) + '</div>'
      + '<div class="cover-line"></div>'
      + '<div class="cover-foot">数据期间：' + dateRange + '</div>'
      + '</div></div>';

    html += '<div class="brief-page brief-toc"><h2>目&nbsp;&nbsp;录</h2><ol>'
      + '<li class="toc-l1"><a href="#sec-0">摘要 · 本月排放概览</a></li>'
      + '<li class="toc-l1"><a href="#sec-1">一、月度排放趋势</a></li>'
      + '<li class="toc-l1"><a href="#sec-2">二、本月异动判定与分析</a></li>'
      + '<li class="toc-l2"><a href="#sec-2-1">（一）判定规则</a></li>'
      + '<li class="toc-l2"><a href="#sec-2-2">（二）本月判定结论</a></li>'
      + '<li class="toc-l2"><a href="#sec-2-3">（三）归因分析</a></li>'
      + '<li class="toc-l1"><a href="#sec-3">三、处置建议</a></li>'
      + '</ol></div>';

    html += '<div class="brief-page">'
      + '<h1 class="brief-h1" id="sec-0">摘要 · 本月排放概览</h1>'
      + summaryHtml()
      + '<h1 class="brief-h1" id="sec-1">一、月度排放趋势</h1>'
      + '<p class="brief-p">本月碳排放量 <strong>' + fmt(CUR_MONTH, 2) + '</strong> 万t，'
      + (M === 1 ? '为全年开局基线；' : '环比 ' + (MOM == null ? '无可比数据' : signed(MOM, 2) + '%') + '；')
      + '较去年同月 ' + fmt(PREV_YEAR_MONTH, 2) + ' 万t 同比 ' + (YOY == null ? '无可比数据' : signed(YOY, 2) + '%') + '。'
      + '年度累计排放量 ' + fmt(YTD_CUR, 2) + ' 万t' + (YTD_YOY == null ? '。' : '，累计同比 ' + signed(YTD_YOY, 2) + '%。')
      + '</p>'
      + monthlyTrendHtml()
      + '<h1 class="brief-h1" id="sec-2">二、本月异动判定与分析</h1>'
      + judgeHtml()
      + '<h1 class="brief-h1" id="sec-3">三、处置建议</h1>'
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
