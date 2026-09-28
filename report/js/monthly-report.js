/**
 * 碳月报（月度报表）· 渲染
 * URL 参数：?tab=emission|trade&month=YYYY-MM
 * - tab=emission → 碳排放月度报表（排放量 / 强度 / 结构 / 趋势 / 明细）
 * - tab=trade    → 碳交易月度报表（成交量 / 均价 / 金额 / 持仓 / 行情）
 * 两种报表内容、目录、图表、表格完全不同。
 * 「下载报告（PDF）」用 html2canvas + jsPDF 生成 PDF。
 */

(function () {
  'use strict';

  var ORG = '河南安钢周口钢铁有限责任公司';
  var GREEN = '#00b42a';

  /* ---------- 基础工具 ---------- */

  function lastDay(y, m) { return new Date(y, m, 0).getDate(); }
  function fmt(n, d) {
    return Number(n).toLocaleString('zh-CN', { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function signed(n, d, unit) {
    var s = (n > 0 ? '+' : '') + fmt(n, d);
    return s + (unit ? ' ' + unit : '');
  }
  function deltaCls(n) { return n > 0 ? 'is-pos' : (n < 0 ? 'is-neg' : ''); }

  /* ---------- 入参 ---------- */

  var qs = new URLSearchParams(location.search);
  var TAB = qs.get('tab') === 'trade' ? 'trade' : 'emission';
  var MONTH = qs.get('month') || '2026-09';
  var parts = MONTH.split('-');
  var Y = parseInt(parts[0], 10) || 2026;
  var M = parseInt(parts[1], 10) || 9;
  if (M < 1 || M > 12) M = 9;
  var MONTH_CN = Y + '年' + M + '月';
  ORG = qs.get('company') || ORG;

  /** 上一月（跨年回退） */
  var PM = M === 1 ? 12 : M - 1;
  var PY = M === 1 ? Y - 1 : Y;
  var PREV_CN = PY + '年' + PM + '月';
  var YOY_CN = (Y - 1) + '年' + M + '月';

  /* ---------- 演示数据（唯一数据源） ---------- */

  // 2026 年逐月单位产品碳排放强度（tCO₂/t），与双碳管理月度简报同源
  var INTENSITY_2026 = [0.7605, 0.7573, 0.7637, 0.7630, 0.7646, 0.7653, 0.7658, 0.7662, 0.7655, 0.7661, 0.7657, 0.7663];

  // 2026 年逐月产品产量（万t），全年合计 ≈ 7904 万t，与平台年产量口径一致
  var OUTPUT_2026 = [648.2, 641.5, 669.8, 656.4, 673.1, 662.7, 659.4, 661.2, 658.83, 667.5, 655.9, 649.0];

  // 月度排放量（万tCO₂）= 当月产量 × 当月强度
  var EMISSION = OUTPUT_2026.map(function (q, i) { return +(q * INTENSITY_2026[i]).toFixed(2); });

  // 月度产量同比系数（去年同期产量约为本月的 1/1.055）
  var YOY_OUTPUT_DIV = 1.055;
  // 年度强度改善系数（去年同期强度比本月高 1.2%）
  var YOY_INTENSITY_FACTOR = 1.012;

  // 排放源结构占比（通用口径，非行业特定）：直接排放 62%、间接 38%
  var SRC_RATIO = {
    '化石燃料燃烧（直接）': 0.44,
    '工业生产过程（直接）': 0.18,
    '外购电力（间接）': 0.26,
    '外购热力（间接）': 0.12
  };
  var SRC_COLORS = ['#00b42a', '#165dff', '#ff7d00', '#722ed1'];

  // 碳交易逐月数据（万tCO₂ / 元·tCO₂⁻¹）
  var TRADE_VOL = [42.6, 38.2, 55.4, 47.8, 62.3, 51.5, 44.9, 58.7, 49.3, 66.1, 53.8, 45.2];
  var TRADE_PRICE = [86.5, 88.2, 85.7, 89.4, 91.2, 88.6, 90.3, 92.1, 90.8, 93.5, 91.7, 94.2];

  // 本月持仓（万tCO₂）：配额 + CCER
  var HOLD_ALLOWANCE = 120.4;
  var HOLD_CCER = 18.6;

  // 全国碳市场参考行情（本月）
  var MARKET_ROWS = [
    ['全国碳排放权交易市场（CEA）', 90.8, 8.9, 172.5],
    ['上海环境能源交易所', 90.2, 6.4, 68.3],
    ['北京绿色交易所', 92.6, 3.1, 24.7],
    ['广东碳排放权交易所', 88.4, 12.6, 41.2],
    ['湖北碳排放权交易中心', 87.1, 7.8, 19.6],
    ['天津排放权交易所', 89.3, 2.4, 9.8],
    ['深圳排放权交易所', 93.5, 1.9, 6.2],
    ['重庆碳排放权交易中心', 86.2, 4.2, 11.4]
  ];

  // 本月成交明细（逐笔演示）
  var DEAL_ROWS = [
    ['2026-09-03', '买入', 'CEA（配额）', 18.5, 89.6, '履约补仓'],
    ['2026-09-08', '卖出', 'CEA（配额）', 6.2, 91.4, '盈余变现'],
    ['2026-09-12', '买入', 'CCER', 5.4, 68.5, '低成本抵销'],
    ['2026-09-17', '卖出', 'CEA（配额）', 4.8, 92.8, '择机交易'],
    ['2026-09-22', '买入', 'CEA（配额）', 9.6, 90.1, '储备建仓'],
    ['2026-09-26', '买入', 'CCER', 4.8, 70.2, '低成本抵销']
  ];

  /* ---------- 派生指标 ---------- */

  /** 碳排放月末指标 */
  function emissionMetrics() {
    var cur = EMISSION[M - 1];
    var prev = EMISSION[PM - 1];
    var isCrossYear = (M === 1);
    // 去年同期：产量按 1/1.055 折算、强度按 +1.2% 折算（去年强度更高）
    var yoyOutput = +(OUTPUT_2026[M - 1] / YOY_OUTPUT_DIV).toFixed(2);
    var yoyIntensity = INTENSITY_2026[M - 1] * YOY_INTENSITY_FACTOR;
    var yoy = +(yoyOutput * yoyIntensity).toFixed(2);

    var curIntensity = INTENSITY_2026[M - 1];
    var prevIntensity = INTENSITY_2026[PM - 1];

    return {
      cur: cur,
      prev: prev,
      yoy: yoy,
      curIntensity: curIntensity,
      prevIntensity: prevIntensity,
      yoyIntensity: +yoyIntensity.toFixed(4),
      output: OUTPUT_2026[M - 1],
      prevOutput: OUTPUT_2026[PM - 1],
      yoyOutput: yoyOutput,
      momEmission: +(cur - prev).toFixed(2),
      momEmissionPct: +((cur - prev) / prev * 100).toFixed(2),
      yoyEmissionDiff: +(cur - yoy).toFixed(2),
      yoyEmissionPct: +((cur - yoy) / yoy * 100).toFixed(2),
      momIntensityPct: +((curIntensity - prevIntensity) / prevIntensity * 100).toFixed(2),
      yoyIntensityPct: +((curIntensity - yoyIntensity) / yoyIntensity * 100).toFixed(2),
      isCrossYear: isCrossYear
    };
  }

  /** 碳交易月末指标 */
  function tradeMetrics() {
    var volCur = TRADE_VOL[M - 1], volPrev = TRADE_VOL[PM - 1];
    var prCur = TRADE_PRICE[M - 1];
    var prPrev = TRADE_PRICE[PM - 1];
    var amtCur = +(volCur * prCur).toFixed(2);   // 万元 = 万t × 元/t
    var amtPrev = +(volPrev * prPrev).toFixed(2);

    // 去年同期：量 ×1.06、价 ×0.96（演示口径，折算出更高量、更低价的去年结构）
    var volYoy = +(volCur * 1.06).toFixed(2);
    var prYoy = +(prCur * 0.96).toFixed(2);
    var amtYoy = +(volYoy * prYoy).toFixed(2);

    var holdTotal = +(HOLD_ALLOWANCE + HOLD_CCER).toFixed(1);
    var holdValue = +(holdTotal * prCur).toFixed(2);

    // 年累计成交量（截至本月）
    var cumVol = 0;
    for (var i = 0; i < M; i++) cumVol += TRADE_VOL[i];
    cumVol = +cumVol.toFixed(2);

    return {
      volCur: volCur, volPrev: volPrev, volYoy: volYoy,
      prCur: prCur, prPrev: prPrev, prYoy: prYoy,
      amtCur: amtCur, amtPrev: amtPrev, amtYoy: amtYoy,
      holdAllowance: HOLD_ALLOWANCE, holdCCER: HOLD_CCER,
      holdTotal: holdTotal, holdValue: holdValue, cumVol: cumVol,
      volMomPct: +((volCur - volPrev) / volPrev * 100).toFixed(2),
      volYoyPct: +((volCur - volYoy) / volYoy * 100).toFixed(2),
      prMomPct: +((prCur - prPrev) / prPrev * 100).toFixed(2),
      prYoyPct: +((prCur - prYoy) / prYoy * 100).toFixed(2),
      amtMomPct: +((amtCur - amtPrev) / amtPrev * 100).toFixed(2),
      amtYoyPct: +((amtCur - amtYoy) / amtYoy * 100).toFixed(2)
    };
  }

  /* ---------- 图表 ---------- */

  function chartBlock(innerHtml, caption) {
    return '<div class="chart-box">' + innerHtml + '</div><div class="chart-caption">' + esc(caption) + '</div>';
  }

  /** 横向条形图（最大值归一） */
  function cmpBars(items, unit, dec) {
    var max = 0;
    items.forEach(function (it) { if (it.value > max) max = it.value; });
    max = max || 1;
    var html = '<div class="hbars">';
    items.forEach(function (it) {
      var pct = Math.max(0.5, it.value / max * 100);
      html += '<div class="hbar-row' + (it.self ? ' is-self' : '') + '">'
        + '<span class="hbar-label">' + esc(it.name) + '</span>'
        + '<span class="hbar-track"><span class="hbar-fill" style="width:' + pct.toFixed(1) + '%;background:' + it.color + '"></span></span>'
        + '<span class="hbar-val">' + fmt(it.value, dec) + (unit ? ' ' + unit : '') + '</span>'
        + '</div>';
    });
    return html + '</div>';
  }

  /** 结构条形图（总和归一，数值后带占比） */
  function structBars(items, unit, dec) {
    var total = 0;
    items.forEach(function (it) { total += it.value; });
    total = total || 1;
    var html = '<div class="hbars">';
    items.forEach(function (it) {
      var pct = it.value / total * 100;
      html += '<div class="hbar-row">'
        + '<span class="hbar-label">' + esc(it.name) + '</span>'
        + '<span class="hbar-track"><span class="hbar-fill" style="width:' + pct.toFixed(1) + '%;background:' + it.color + '"></span></span>'
        + '<span class="hbar-val">' + fmt(it.value, dec) + (unit ? ' ' + unit : '') + '（' + pct.toFixed(1) + '%）</span>'
        + '</div>';
    });
    return html + '</div>';
  }

  /** 12 月折线图（纯 SVG），高亮当前月 */
  function lineChart(values, unit) {
    var W = 760, H = 240, PL = 52, PR = 18, PT = 18, PB = 34;
    var iw = W - PL - PR, ih = H - PT - PB;
    var min = Math.min.apply(null, values), max = Math.max.apply(null, values);
    var span = (max - min) || 1;
    min = min - span * 0.15; max = max + span * 0.15;
    var range = max - min;

    function X(i) { return PL + iw * i / 11; }
    function Yv(v) { return PT + ih * (1 - (v - min) / range); }

    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet">';

    // Y 轴网格 + 刻度
    for (var g = 0; g <= 4; g++) {
      var val = min + range * g / 4;
      var y = Yv(val);
      s += '<line x1="' + PL + '" y1="' + y.toFixed(1) + '" x2="' + (W - PR) + '" y2="' + y.toFixed(1) + '" stroke="#eef1f4" stroke-width="1"/>';
      s += '<text x="' + (PL - 8) + '" y="' + (y + 4).toFixed(1) + '" font-size="10" fill="#98a1ab" text-anchor="end">' + val.toFixed(1) + '</text>';
    }
    // X 轴标签
    for (var i = 0; i < 12; i++) {
      s += '<text x="' + X(i).toFixed(1) + '" y="' + (H - 12) + '" font-size="10" fill="#98a1ab" text-anchor="middle">' + (i + 1) + '月</text>';
    }
    // 折线
    var pts = values.map(function (v, i) { return X(i).toFixed(1) + ',' + Yv(v).toFixed(1); }).join(' ');
    s += '<polyline points="' + pts + '" fill="none" stroke="' + GREEN + '" stroke-width="2.2" stroke-linejoin="round"/>';
    // 数据点 + 当前月高亮
    values.forEach(function (v, i) {
      var isCur = (i === M - 1);
      s += '<circle cx="' + X(i).toFixed(1) + '" cy="' + Yv(v).toFixed(1) + '" r="' + (isCur ? 5 : 3) + '" fill="' + (isCur ? '#ff7d00' : '#fff') + '" stroke="' + (isCur ? '#ff7d00' : GREEN) + '" stroke-width="2"/>';
      if (isCur) {
        s += '<text x="' + X(i).toFixed(1) + '" y="' + (Yv(v) - 12).toFixed(1) + '" font-size="11" fill="#b25f00" font-weight="700" text-anchor="middle">' + fmt(v, 2) + '</text>';
      }
    });
    s += '</svg>';
    return s;
  }

  /* ---------- 碳排放月报 ---------- */

  function emissionReport() {
    var d = emissionMetrics();

    /* 摘要 */
    var annualEmission = 0;
    for (var i = 0; i < M; i++) annualEmission += EMISSION[i];
    annualEmission = +annualEmission.toFixed(2);

    var summary = '<div class="kpi-grid">'
      + '<div class="kpi-card is-self"><div class="kpi-name">本月碳排放量</div><div class="kpi-val">' + fmt(d.cur, 2) + '<small> 万tCO₂</small></div><div class="kpi-delta ' + deltaCls(d.momEmissionPct) + '">环比 ' + signed(d.momEmissionPct, 2, '%') + '</div></div>'
      + '<div class="kpi-card"><div class="kpi-name">年累计排放量</div><div class="kpi-val">' + fmt(annualEmission, 2) + '<small> 万tCO₂</small></div><div class="kpi-delta is-flat">截至 ' + esc(MONTH_CN) + '</div></div>'
      + '<div class="kpi-card"><div class="kpi-name">单位产品碳排放强度</div><div class="kpi-val">' + fmt(d.curIntensity, 4) + '<small> tCO₂/t</small></div><div class="kpi-delta ' + deltaCls(d.momIntensityPct) + '">环比 ' + signed(d.momIntensityPct, 2, '%') + '</div></div>'
      + '<div class="kpi-card"><div class="kpi-name">本月产品产量</div><div class="kpi-val">' + fmt(d.output, 2) + '<small> 万t</small></div><div class="kpi-delta is-flat">月度产量口径</div></div>'
      + '<div class="kpi-card"><div class="kpi-name">直接排放占比</div><div class="kpi-val">' + fmt(62, 1) + '<small> %</small></div><div class="kpi-delta is-neg">燃料燃烧 + 生产过程</div></div>'
      + '<div class="kpi-card"><div class="kpi-name">间接排放占比</div><div class="kpi-val">' + fmt(38, 1) + '<small> %</small></div><div class="kpi-delta is-flat">外购电力 + 外购热力</div></div>'
      + '</div>';

    summary += '<ul class="point-list">'
      + '<li>本月碳排放量 <strong>' + fmt(d.cur, 2) + '</strong> 万tCO₂，环比' + (d.momEmissionPct >= 0 ? '上升' : '下降') + ' ' + fmt(Math.abs(d.momEmissionPct), 2) + '%，同比' + (d.yoyEmissionPct >= 0 ? '上升' : '下降') + ' ' + fmt(Math.abs(d.yoyEmissionPct), 2) + '%。</li>'
      + '<li>单位产品碳排放强度 <strong>' + fmt(d.curIntensity, 4) + '</strong> tCO₂/t，环比' + (d.momIntensityPct >= 0 ? '上升' : '下降') + ' ' + fmt(Math.abs(d.momIntensityPct), 2) + '%。</li>'
      + '<li>年累计排放量 <strong>' + fmt(annualEmission, 2) + '</strong> 万tCO₂，按当前强度推演全年排放约 ' + fmt(annualEmission / M * 12, 2) + ' 万tCO₂。</li>'
      + '<li>排放结构以直接排放为主（占比 62.0%），其中化石燃料燃烧占 ' + fmt(44, 1) + '%，是减排重点方向。</li>'
      + '</ul>';

    /* 一、月度排放概况 */
    var overview = '<p class="brief-p">本月为 ' + esc(MONTH_CN) + '，企业产品产量 ' + fmt(d.output, 2) + ' 万t，碳排放量 ' + fmt(d.cur, 2) + ' 万tCO₂，单位产品碳排放强度 ' + fmt(d.curIntensity, 4) + ' tCO₂/t。与上月（' + esc(PREV_CN) + '）及上年同期（' + esc(YOY_CN) + '）对比如下表。</p>';

    overview += '<div class="table-caption"><span>月度排放对比表</span><span class="unit">排放量：万tCO₂；强度：tCO₂/t；产量：万t</span></div>'
      + '<table class="btable"><thead><tr>'
      + '<th>指标</th><th>本月（' + esc(MONTH_CN) + '）</th><th>上月（' + esc(PREV_CN) + '）</th><th>环比</th><th>上年同期（' + esc(YOY_CN) + '）</th><th>同比</th>'
      + '</tr></thead><tbody>'
      + '<tr><td>碳排放量</td><td class="is-self">' + fmt(d.cur, 2) + '</td><td>' + fmt(d.prev, 2) + '</td>'
      + '<td class="' + deltaCls(d.momEmissionPct) + '">' + signed(d.momEmissionPct, 2, '%') + '</td>'
      + '<td>' + fmt(d.yoy, 2) + '</td><td class="' + deltaCls(d.yoyEmissionPct) + '">' + signed(d.yoyEmissionPct, 2, '%') + '</td></tr>'
      + '<tr><td>单位产品碳排放强度</td><td class="is-self">' + fmt(d.curIntensity, 4) + '</td><td>' + fmt(d.prevIntensity, 4) + '</td>'
      + '<td class="' + deltaCls(d.momIntensityPct) + '">' + signed(d.momIntensityPct, 2, '%') + '</td>'
      + '<td>' + fmt(d.yoyIntensity, 4) + '</td><td class="' + deltaCls(d.yoyIntensityPct) + '">' + signed(d.yoyIntensityPct, 2, '%') + '</td></tr>'
      + '</tbody></table>'
      + '<div class="btable-note">注：环比 =（本月 − 上月）÷ 上月 × 100%；同比 =（本月 − 上年同期）÷ 上年同期 × 100%；单位产品碳排放强度按当月产品产量口径计算。</div>';

    overview += chartBlock(cmpBars([
      { name: '本月（' + MONTH_CN + '）', value: d.cur, color: '#ff7d00', self: true },
      { name: '上月（' + PREV_CN + '）', value: d.prev, color: GREEN },
      { name: '上年同期（' + YOY_CN + '）', value: d.yoy, color: '#165dff' }
    ], '万tCO₂', 2), '（图）本月 / 上月 / 上年同期碳排放量对比');

    /* 二、排放结构分析 */
    var structItems = [];
    var srcNames = Object.keys(SRC_RATIO);
    srcNames.forEach(function (name, i) {
      structItems.push({ name: name, value: +(d.cur * SRC_RATIO[name]).toFixed(2), color: SRC_COLORS[i] });
    });
    var directSum = 0, indirectSum = 0;
    srcNames.forEach(function (name) {
      var v = d.cur * SRC_RATIO[name];
      if (name.indexOf('直接') >= 0) directSum += v; else indirectSum += v;
    });

    var struct = '<p class="brief-p">本月碳排放按排放源拆解如下：直接排放（化石燃料燃烧、工业生产过程）合计 <strong>' + fmt(directSum, 2) + '</strong> 万tCO₂，占 ' + fmt(directSum / d.cur * 100, 1) + '%；间接排放（外购电力、外购热力）合计 <strong>' + fmt(indirectSum, 2) + '</strong> 万tCO₂，占 ' + fmt(indirectSum / d.cur * 100, 1) + '%。</p>'
      + chartBlock(structBars(structItems, '万tCO₂', 2), '（图）本月碳排放源结构分布（' + MONTH_CN + '）')
      + '<ul class="point-list">'
      + '<li><strong>化石燃料燃烧</strong>是最大排放源，本月 ' + fmt(d.cur * SRC_RATIO['化石燃料燃烧（直接）'], 2) + ' 万tCO₂，占比 ' + fmt(SRC_RATIO['化石燃料燃烧（直接）'] * 100, 1) + '%，可通过燃料替代与能效提升压降。</li>'
      + '<li><strong>外购电力</strong>本月 ' + fmt(d.cur * SRC_RATIO['外购电力（间接）'], 2) + ' 万tCO₂，占比 ' + fmt(SRC_RATIO['外购电力（间接）'] * 100, 1) + '%，绿电采购与绿证消纳是主要改善路径。</li>'
      + '<li><strong>工业生产过程</strong>本月 ' + fmt(d.cur * SRC_RATIO['工业生产过程（直接）'], 2) + ' 万tCO₂，占比 ' + fmt(SRC_RATIO['工业生产过程（直接）'] * 100, 1) + '%，与产量高度相关，需通过原料替代与工艺优化降低。</li>'
      + '<li><strong>外购热力</strong>本月 ' + fmt(d.cur * SRC_RATIO['外购热力（间接）'], 2) + ' 万tCO₂，占比 ' + fmt(SRC_RATIO['外购热力（间接）'] * 100, 1) + '%，建议提升余热回收利用率。</li>'
      + '</ul>';

    /* 三、月度趋势回顾 */
    var trend = '<p class="brief-p">下图为 ' + Y + ' 年 1~12 月碳排放量走势（橙点为当前月 ' + M + ' 月）。全年度各月排放量介于 ' + fmt(Math.min.apply(null, EMISSION), 2) + ' ~ ' + fmt(Math.max.apply(null, EMISSION), 2) + ' 万tCO₂ 之间，整体波动平稳。</p>'
      + chartBlock(lineChart(EMISSION), '（图）' + Y + ' 年逐月碳排放量走势（万tCO₂）');

    trend += '<ul class="point-list">'
      + '<li>本月排放量 ' + fmt(d.cur, 2) + ' 万tCO₂，在全年逐月序列中位列第 ' + (EMISSION.map(function (v, i) { return { v: v, i: i }; }).sort(function (a, b) { return b.v - a.v; }).map(function (o) { return o.i; }).indexOf(M - 1) + 1) + ' 位。</li>'
      + '<li>全年排放量最高月为 ' + (EMISSION.indexOf(Math.max.apply(null, EMISSION)) + 1) + ' 月（' + fmt(Math.max.apply(null, EMISSION), 2) + ' 万tCO₂），最低月为 ' + (EMISSION.indexOf(Math.min.apply(null, EMISSION)) + 1) + ' 月（' + fmt(Math.min.apply(null, EMISSION), 2) + ' 万tCO₂）。</li>'
      + '<li>月度间排放量差异主要来自产品产量的季节波动，单位产品碳排放强度全年保持在 ' + fmt(Math.min.apply(null, INTENSITY_2026), 4) + ' ~ ' + fmt(Math.max.apply(null, INTENSITY_2026), 4) + ' tCO₂/t 区间。</li>'
      + '</ul>';

    /* 四、数据明细 */
    var detail = '<div class="table-caption"><span>本月排放数据明细（按排放源）</span><span class="unit">排放量：万tCO₂</span></div>'
      + '<table class="btable"><thead><tr>'
      + '<th>排放源</th><th>排放类型</th><th>本月排放量</th><th>占比</th><th>上月排放量</th><th>环比</th>'
      + '</tr></thead><tbody>';
    srcNames.forEach(function (name) {
      var cur = d.cur * SRC_RATIO[name];
      var prev = d.prev * SRC_RATIO[name];
      var mom = +((cur - prev) / prev * 100).toFixed(2);
      detail += '<tr><td>' + esc(name.replace(/（.*?）/, '')) + '</td>'
        + '<td>' + esc(name.indexOf('直接') >= 0 ? '直接排放' : '间接排放') + '</td>'
        + '<td>' + fmt(cur, 2) + '</td><td>' + fmt(SRC_RATIO[name] * 100, 1) + '%</td>'
        + '<td>' + fmt(prev, 2) + '</td><td class="' + deltaCls(mom) + '">' + signed(mom, 2, '%') + '</td></tr>';
    });
    detail += '</tbody><tfoot><tr><td>合计</td><td>—</td><td>' + fmt(d.cur, 2) + '</td><td>100.0%</td><td>' + fmt(d.prev, 2) + '</td>'
      + '<td class="' + deltaCls(d.momEmissionPct) + '">' + signed(d.momEmissionPct, 2, '%') + '</td></tr></tfoot></table>'
      + '<div class="btable-note">注：各排放源环比按「本月排放量 − 上月排放量 ÷ 上月排放量 × 100%」计算；排放类型分为直接排放（范围一）与间接排放（范围二）。</div>';

    var advice = '<ol class="advice-list">'
      + '<li><strong>紧盯强度指标：</strong>本月单位产品碳排放强度 ' + fmt(d.curIntensity, 4) + ' tCO₂/t，环比' + (d.momIntensityPct >= 0 ? '上升' : '下降') + ' ' + fmt(Math.abs(d.momIntensityPct), 2) + '%，建议将强度纳入月度绩效考核，防止反弹。</li>'
      + '<li><strong>压降燃料燃烧排放：</strong>化石燃料燃烧占本月排放 ' + fmt(SRC_RATIO['化石燃料燃烧（直接）'] * 100, 1) + '%，建议提高清洁燃料替代比例、优化燃烧控制，持续降低单位产品燃料消耗。</li>'
      + '<li><strong>提升绿电消纳：</strong>外购电力占本月排放 ' + fmt(SRC_RATIO['外购电力（间接）'] * 100, 1) + '%，建议扩大绿电采购与分布式光伏自发自用规模，降低外购电力排放因子。</li>'
      + '<li><strong>完善计量台账：</strong>按排放源逐月核对活动数据与排放因子，确保月度排放数据可追溯、可核证，为年度履约与核查打好基础。</li>'
      + '</ol>';

    return {
      title: '碳排放月报',
      kicker: '碳 排 放 月 报',
      toc: [
        ['摘要 · 本月核心指标概览', '#sec-0', 'l1'],
        ['一、月度排放概况', '#sec-1', 'l1'],
        ['二、排放结构分析', '#sec-2', 'l1'],
        ['三、月度趋势回顾', '#sec-3', 'l1'],
        ['四、数据明细', '#sec-4', 'l1']
      ],
      sections: [
        ['摘要 · 本月核心指标概览', 'sec-0', summary],
        ['一、月度排放概况', 'sec-1', overview],
        ['二、排放结构分析', 'sec-2', struct],
        ['三、月度趋势回顾', 'sec-3', trend],
        ['四、数据明细', 'sec-4', detail],
        ['五、本月工作建议', 'sec-5', advice]
      ]
    };
  }

  /* ---------- 碳交易月报 ---------- */

  function tradeReport() {
    var d = tradeMetrics();

    /* 摘要 */
    var summary = '<div class="kpi-grid">'
      + '<div class="kpi-card is-self"><div class="kpi-name">本月成交量</div><div class="kpi-val">' + fmt(d.volCur, 2) + '<small> 万tCO₂</small></div><div class="kpi-delta ' + deltaCls(d.volMomPct >= 0 ? 1 : -1) + '">环比 ' + signed(d.volMomPct, 2, '%') + '</div></div>'
      + '<div class="kpi-card"><div class="kpi-name">本月成交均价</div><div class="kpi-val">' + fmt(d.prCur, 2) + '<small> 元/tCO₂</small></div><div class="kpi-delta ' + deltaCls(-d.prMomPct) + '">环比 ' + signed(d.prMomPct, 2, '%') + '</div></div>'
      + '<div class="kpi-card"><div class="kpi-name">本月成交金额</div><div class="kpi-val">' + fmt(d.amtCur, 2) + '<small> 万元</small></div><div class="kpi-delta is-flat">量价联动口径</div></div>'
      + '<div class="kpi-card"><div class="kpi-name">年累计成交量</div><div class="kpi-val">' + fmt(d.cumVol, 2) + '<small> 万tCO₂</small></div><div class="kpi-delta is-flat">截至 ' + esc(MONTH_CN) + '</div></div>'
      + '<div class="kpi-card"><div class="kpi-name">期末持仓量</div><div class="kpi-val">' + fmt(d.holdTotal, 1) + '<small> 万tCO₂</small></div><div class="kpi-delta is-flat">配额 ' + fmt(d.holdAllowance, 1) + ' + CCER ' + fmt(d.holdCCER, 1) + '</div></div>'
      + '<div class="kpi-card"><div class="kpi-name">期末持仓市值</div><div class="kpi-val">' + fmt(d.holdValue, 2) + '<small> 万元</small></div><div class="kpi-delta is-neg">按本月均价折算</div></div>'
      + '</div>';

    summary += '<ul class="point-list">'
      + '<li>本月碳市场成交 <strong>' + fmt(d.volCur, 2) + '</strong> 万tCO₂，成交均价 <strong>' + fmt(d.prCur, 2) + '</strong> 元/tCO₂，成交金额 ' + fmt(d.amtCur, 2) + ' 万元。</li>'
      + '<li>成交量环比' + (d.volMomPct >= 0 ? '增加' : '减少') + ' ' + fmt(Math.abs(d.volMomPct), 2) + '%，同比' + (d.volYoyPct >= 0 ? '增加' : '减少') + ' ' + fmt(Math.abs(d.volYoyPct), 2) + '%。</li>'
      + '<li>成交均价环比' + (d.prMomPct >= 0 ? '上涨' : '下跌') + ' ' + fmt(Math.abs(d.prMomPct), 2) + '%，价格整体处于全国碳市场合理区间。</li>'
      + '<li>期末持仓 ' + fmt(d.holdTotal, 1) + ' 万tCO₂，市值 ' + fmt(d.holdValue, 2) + ' 万元，可覆盖年度履约需求并保留一定交易弹性。</li>'
      + '</ul>';

    /* 一、交易概况 */
    var overview = '<p class="brief-p">本月为 ' + esc(MONTH_CN) + '，企业通过全国碳排放权交易市场及区域试点市场开展配额与 CCER 交易，累计成交 ' + fmt(d.volCur, 2) + ' 万tCO₂，成交金额 ' + fmt(d.amtCur, 2) + ' 万元，成交均价 ' + fmt(d.prCur, 2) + ' 元/tCO₂。与上月及上年同期对比如下表。</p>';

    overview += '<div class="table-caption"><span>月度交易对比表</span><span class="unit">成交量：万tCO₂；均价：元/tCO₂；金额：万元</span></div>'
      + '<table class="btable"><thead><tr>'
      + '<th>指标</th><th>本月（' + esc(MONTH_CN) + '）</th><th>上月（' + esc(PREV_CN) + '）</th><th>环比</th><th>上年同期（' + esc(YOY_CN) + '）</th><th>同比</th>'
      + '</tr></thead><tbody>'
      + '<tr><td>成交量</td><td class="is-self">' + fmt(d.volCur, 2) + '</td><td>' + fmt(d.volPrev, 2) + '</td>'
      + '<td class="' + deltaCls(-d.volMomPct) + '">' + signed(d.volMomPct, 2, '%') + '</td>'
      + '<td>' + fmt(d.volYoy, 2) + '</td><td class="' + deltaCls(-d.volYoyPct) + '">' + signed(d.volYoyPct, 2, '%') + '</td></tr>'
      + '<tr><td>成交均价</td><td class="is-self">' + fmt(d.prCur, 2) + '</td><td>' + fmt(d.prPrev, 2) + '</td>'
      + '<td class="' + deltaCls(d.prMomPct) + '">' + signed(d.prMomPct, 2, '%') + '</td>'
      + '<td>' + fmt(d.prYoy, 2) + '</td><td class="' + deltaCls(d.prYoyPct) + '">' + signed(d.prYoyPct, 2, '%') + '</td></tr>'
      + '<tr><td>成交金额</td><td class="is-self">' + fmt(d.amtCur, 2) + '</td><td>' + fmt(d.amtPrev, 2) + '</td>'
      + '<td class="' + deltaCls(-d.amtMomPct) + '">' + signed(d.amtMomPct, 2, '%') + '</td>'
      + '<td>' + fmt(d.amtYoy, 2) + '</td><td class="' + deltaCls(-d.amtYoyPct) + '">' + signed(d.amtYoyPct, 2, '%') + '</td></tr>'
      + '</tbody></table>'
      + '<div class="btable-note">注：成交金额 = 成交量（万t）× 成交均价（元/t），单位为万元；环比、同比算法同排放报表。</div>';

    overview += chartBlock(cmpBars([
      { name: '本月（' + MONTH_CN + '）', value: d.amtCur, color: '#ff7d00', self: true },
      { name: '上月（' + PREV_CN + '）', value: d.amtPrev, color: GREEN },
      { name: '上年同期（' + YOY_CN + '）', value: d.amtYoy, color: '#165dff' }
    ], '万元', 2), '（图）本月 / 上月 / 上年同期成交金额对比');

    /* 二、成交明细 */
    var detail = '<div class="table-caption"><span>本月成交明细</span><span class="unit">数量：万tCO₂；价格：元/tCO₂</span></div>'
      + '<table class="btable"><thead><tr>'
      + '<th>成交日期</th><th>交易方向</th><th>交易品种</th><th>数量</th><th>成交均价</th><th>成交金额（万元）</th><th>交易用途</th>'
      + '</tr></thead><tbody>';
    var sumAmt = 0;
    DEAL_ROWS.forEach(function (r) {
      var amt = +(r[3] * r[4]).toFixed(2);
      sumAmt += amt;
      detail += '<tr><td>' + esc(r[0]) + '</td>'
        + '<td class="' + (r[1] === '买入' ? 'is-pos' : 'is-neg') + '">' + esc(r[1]) + '</td>'
        + '<td>' + esc(r[2]) + '</td><td>' + fmt(r[3], 2) + '</td><td>' + fmt(r[4], 2) + '</td>'
        + '<td>' + fmt(amt, 2) + '</td><td>' + esc(r[5]) + '</td></tr>';
    });
    detail += '</tbody><tfoot><tr><td colspan="5">合计</td><td>' + fmt(sumAmt, 2) + '</td><td>—</td></tr></tfoot></table>'
      + '<div class="btable-note">注：成交明细为演示数据；买入用于履约补仓与储备建仓，卖出为盈余配额择机变现。</div>';

    /* 三、持仓与资产 */
    var hold = '<p class="brief-p">截至目前，企业碳资产持仓合计 <strong>' + fmt(d.holdTotal, 1) + '</strong> 万tCO₂，按本月成交均价 ' + fmt(d.prCur, 2) + ' 元/tCO₂ 折算，持仓市值约 <strong>' + fmt(d.holdValue, 2) + '</strong> 万元。持仓结构如下。</p>'
      + chartBlock(structBars([
        { name: 'CEA（配额）', value: d.holdAllowance, color: GREEN },
        { name: 'CCER', value: d.holdCCER, color: '#165dff' }
      ], '万tCO₂', 1), '（图）期末碳资产持仓结构（' + MONTH_CN + '）');

    hold += '<ul class="point-list">'
      + '<li>配额持仓 ' + fmt(d.holdAllowance, 1) + ' 万tCO₂，占总持仓 ' + fmt(d.holdAllowance / d.holdTotal * 100, 1) + '%，是履约与交易的主要资产。</li>'
      + '<li>CCER 持仓 ' + fmt(d.holdCCER, 1) + ' 万tCO₂，占总持仓 ' + fmt(d.holdCCER / d.holdTotal * 100, 1) + '%，具备低成本抵销优势。</li>'
      + '<li>本月成交量 ' + fmt(d.volCur, 2) + ' 万tCO₂，约占期末持仓的 ' + fmt(d.volCur / d.holdTotal * 100, 1) + '%，交易活跃度适中。</li>'
      + '</ul>';

    /* 四、市场行情 */
    var market = '<p class="brief-p">本月全国及各区域试点碳市场行情如下表，为企业后续交易择时提供参考。</p>'
      + '<div class="table-caption"><span>主要碳市场行情一览（' + esc(MONTH_CN) + '）</span><span class="unit">均价：元/tCO₂；成交量/成交额：万t / 百万元</span></div>'
      + '<table class="btable"><thead><tr>'
      + '<th>市场名称</th><th>成交均价</th><th>成交量</th><th>成交额</th><th>较上月</th>'
      + '</tr></thead><tbody>';
    MARKET_ROWS.forEach(function (r, i) {
      var chg = +((i % 2 === 0 ? 1 : -1) * (0.5 + (i % 3) * 0.7)).toFixed(2);
      market += '<tr><td>' + esc(r[0]) + '</td><td class="is-self">' + fmt(r[1], 2) + '</td>'
        + '<td>' + fmt(r[2], 1) + '</td><td>' + fmt(r[3], 1) + '</td>'
        + '<td class="' + deltaCls(chg) + '">' + signed(chg, 2, '%') + '</td></tr>';
    });
    market += '</tbody></table>'
      + '<div class="btable-note">注：行情数据为演示数据；「较上月」为各市场成交均价环比涨跌幅。</div>';

    market += chartBlock(lineChart(TRADE_PRICE, '元/tCO₂'), '（图）2026 年逐月成交均价走势（元/tCO₂）');

    var advice = '<ol class="advice-list">'
      + '<li><strong>把握价格窗口：</strong>本月成交均价 ' + fmt(d.prCur, 2) + ' 元/tCO₂，环比' + (d.prMomPct >= 0 ? '上涨' : '下跌') + ' ' + fmt(Math.abs(d.prMomPct), 2) + '%，建议建立价格监测机制，在低位建仓、高位择机变现盈余配额。</li>'
      + '<li><strong>优化量价节奏：</strong>本月成交量 ' + fmt(d.volCur, 2) + ' 万tCO₂，建议按履约进度分月平滑采购，避免期末集中购碳推高成本。</li>'
      + '<li><strong>用好 CCER 抵销：</strong>CCER 价格低于配额价，建议在合规比例内提高 CCER 抵销使用比例，降低整体履约成本。</li>'
      + '<li><strong>盘活存量资产：</strong>期末持仓市值 ' + fmt(d.holdValue, 2) + ' 万元，建议在保障履约的前提下，审慎开展碳质押等碳金融业务，提升资产流动性与收益。</li>'
      + '</ol>';

    return {
      title: '碳交易月报',
      kicker: '碳 交 易 月 报',
      toc: [
        ['摘要 · 本月核心指标概览', '#sec-0', 'l1'],
        ['一、交易概况', '#sec-1', 'l1'],
        ['二、成交明细', '#sec-2', 'l1'],
        ['三、持仓与资产', '#sec-3', 'l1'],
        ['四、市场行情', '#sec-4', 'l1']
      ],
      sections: [
        ['摘要 · 本月核心指标概览', 'sec-0', summary],
        ['一、交易概况', 'sec-1', overview],
        ['二、成交明细', 'sec-2', detail],
        ['三、持仓与资产', 'sec-3', hold],
        ['四、市场行情', 'sec-4', market],
        ['五、本月交易建议', 'sec-5', advice]
      ]
    };
  }

  /* ---------- 报告组装 ---------- */

  function buildReport(cfg) {
    var dateRange = MONTH + '-01 至 ' + MONTH + '-' + lastDay(Y, M);

    var html = '<div class="brief-page brief-cover-wrap"><div class="brief-cover">'
      + '<div class="cover-kicker">' + esc(cfg.kicker) + '</div>'
      + '<h1>' + esc(ORG) + '<br/>' + esc(cfg.title) + '</h1>'
      + '<div class="cover-month">' + esc(MONTH_CN) + '</div>'
      + '<div class="cover-tab">' + (TAB === 'trade' ? '碳交易' : '碳排放') + ' · 月度报表</div>'
      + '<div class="cover-line"></div>'
      + '<div class="cover-foot">数据期间：' + dateRange + '</div>'
      + '</div></div>';

    html += '<div class="brief-page brief-toc"><h2>目&nbsp;&nbsp;录</h2><ol>';
    cfg.toc.forEach(function (t) {
      html += '<li class="toc-' + t[2] + '"><a href="' + t[1] + '">' + esc(t[0]) + '</a></li>';
    });
    html += '<li class="toc-l1"><a href="#sec-5">五、' + (TAB === 'trade' ? '本月交易建议' : '本月工作建议') + '</a></li>';
    html += '</ol></div>';

    html += '<div class="brief-page">';
    cfg.sections.forEach(function (s, i) {
      html += '<h1 class="brief-h1" id="' + s[1] + '">' + esc(s[0]) + '</h1>' + s[2];
    });
    html += '</div>';

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
      pdf.save((TAB === 'trade' ? '碳交易月报-' : '碳排放月报-') + Y + '年' + M + '月.pdf');
    }).catch(function (err) {
      if (window.console) console.error('PDF 生成失败，降级为打印：', err);
      window.print();
    }).then(function () {
      btn.disabled = false;
      btn.innerHTML = oldText;
    });
  }

  /* ---------- 启动 ---------- */

  var cfg = TAB === 'trade' ? tradeReport() : emissionReport();
  document.getElementById('brief-root').innerHTML = buildReport(cfg);
  document.getElementById('bt-title').textContent = ORG + cfg.title + '（' + MONTH_CN + '）';
  document.title = cfg.title + '-' + MONTH;
  document.getElementById('btn-download').addEventListener('click', download);
})();
