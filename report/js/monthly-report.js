/**
 * 碳月报（月度报表）· 渲染
 * URL 参数：?tab=emission|trade&month=YYYY-MM
 * - tab=emission → 碳排放月度报表（排放量 / 强度 / 产量 / 趋势）
 * - tab=trade    → 碳交易月度报表（成交量 / 均价 / 金额 / 趋势）
 * 两种报表内容、目录、图表、表格完全不同。
 *
 * 【数据口径】本报表**只认入参**，不做兜底：
 *   · 碳排放：emission.volume（本月排放量，万tCO₂）+ emission.intensity（单位产品强度，tCO₂/t），
 *     各含 cur[12]（当年 1~12 月）与 prev[12]（上年同期）；产品产量由「排放量 ÷ 强度」派生。
 *   · 碳交易：trade.volume（成交量，万tCO₂）+ trade.price（成交均价，元/tCO₂），同样 cur[12] / prev[12]；
 *     成交金额由「成交量 × 成交均价」派生。
 *   · 排放源结构（化石燃料燃烧 / 生产过程 / 外购电力 / 外购热力）与逐笔成交台账、各交易所行情
 *     在实际业务中拿不到，本报表**没有**对应章节。
 *
 * 「下载报告（PDF）」用 html2canvas + jsPDF 生成 PDF。
 */

(function () {
  'use strict';

  var ORG = '河南安钢周口钢铁有限责任公司';
  var GREEN = '#00b42a';

  /* ---------- 基础工具 ---------- */

  function lastDay(y, m) { return new Date(y, m, 0).getDate(); }
  /** 数值格式化：null / NaN / Infinity 一律输出 --；并把 -0 归一化为 0（避免显示「-0.0」） */
  function fmt(n, d) {
    if (n == null || !isFinite(n)) return '--';
    if (n === 0) n = 0;
    return Number(n).toLocaleString('zh-CN', { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function signed(n, d, unit) {
    if (n == null || !isFinite(n)) return '--';
    if (n === 0) n = 0;
    return (n > 0 ? '+' : '') + fmt(n, d) + (unit ? ' ' + unit : '');
  }
  function deltaCls(n) { return n == null ? '' : (n > 0 ? 'is-pos' : (n < 0 ? 'is-neg' : '')); }
  /** 小数舍入（避免浮点尾差） */
  function r2(n) { return n == null || !isFinite(n) ? null : Math.round(n * 100) / 100; }
  function r4(n) { return n == null || !isFinite(n) ? null : Math.round(n * 10000) / 10000; }
  /** 环比/同比百分比：分母必须 > 0，否则 null */
  function pctOf(cur, base) {
    if (cur == null || base == null || !isFinite(cur) || !isFinite(base) || base <= 0) return null;
    return r2((cur - base) / base * 100);
  }
  /** 不含数据的图区占位（不引新样式类，用行内样式） */
  function chartEmpty(text) {
    return '<div style="height:150px;display:flex;align-items:center;justify-content:center;color:#98a1ab;font-size:13px">'
      + esc(text) + '</div>';
  }
  function isAllZero(arr) {
    for (var i = 0; i < arr.length; i++) { if (arr[i]) return false; }
    return true;
  }

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

  /** 上一月（跨年回退）；**M = 1 时没有上月基数**，环比整体不适用 */
  var HAS_PREV = M > 1;
  var PM = M === 1 ? 0 : M - 1;
  var PY = M === 1 ? Y - 1 : Y;
  var PREV_CN = PY + '年' + PM + '月';
  /** 上月标签：M = 1 时没有上月，标签不能拼成「2025年0月」 */
  var PREV_LABEL = HAS_PREV ? PREV_CN : '无上月基数';
  var YOY_CN = (Y - 1) + '年' + M + '月';

  /* ---------- 入参数组（零兜底；长度不足按 0 补，超长截断） ---------- */

  /**
   * 读 12 元素数组：`?name=1,2,3,...`
   * - 参数**缺失** → 用默认示例值
   * - 参数**存在但为空** → 12 个 0（即"本期无数据"）
   * - 元素非数字 → 按 0
   * - **严禁**用最后一个已有值向后外推
   */
  function readSeries(name, def) {
    if (!qs.has(name)) return def.slice();
    var raw = String(qs.get(name) || '').trim();
    var arr = raw ? raw.split(',').map(function (s) { return Number(String(s).trim()); }) : [];
    var out = [];
    for (var i = 0; i < 12; i++) out.push(isFinite(arr[i]) ? arr[i] : 0);
    return out;
  }

  // 默认示例（演示口径，量级与《碳排放异动分析报告》一致）
  var DEF_EV_CUR = [26.84, 24.62, 27.15, 26.38, 26.12, 25.83, 26.47, 26.90, 25.76, 26.31, 25.94, 26.68];
  var DEF_EV_PREV = [27.79, 25.48, 28.06, 27.28, 27.02, 26.72, 27.38, 27.83, 26.65, 27.22, 26.84, 27.60];
  var DEF_EI_CUR = [0.7605, 0.7573, 0.7637, 0.7630, 0.7646, 0.7653, 0.7658, 0.7662, 0.7655, 0.7661, 0.7657, 0.7663];
  var DEF_EI_PREV = [0.7696, 0.7664, 0.7729, 0.7722, 0.7738, 0.7745, 0.7750, 0.7754, 0.7747, 0.7753, 0.7749, 0.7755];

  var DEF_TV_CUR = [4.62, 3.85, 5.94, 4.78, 6.73, 5.31, 4.47, 6.12, 5.03, 7.24, 5.58, 4.41];
  var DEF_TV_PREV = [4.90, 4.08, 6.30, 5.07, 7.13, 5.63, 4.74, 6.49, 5.33, 7.67, 5.91, 4.67];
  var DEF_TP_CUR = [86.5, 88.2, 85.7, 89.4, 91.2, 88.6, 90.3, 92.1, 90.8, 93.5, 91.7, 94.2];
  var DEF_TP_PREV = [83.04, 84.67, 82.27, 85.82, 87.55, 85.06, 86.69, 88.42, 87.17, 89.76, 88.03, 90.43];

  var EV_CUR = readSeries('evCur', DEF_EV_CUR);
  var EV_PREV = readSeries('evPrev', DEF_EV_PREV);
  var EI_CUR = readSeries('eiCur', DEF_EI_CUR);
  var EI_PREV = readSeries('eiPrev', DEF_EI_PREV);
  var TV_CUR = readSeries('tvCur', DEF_TV_CUR);
  var TV_PREV = readSeries('tvPrev', DEF_TV_PREV);
  var TP_CUR = readSeries('tpCur', DEF_TP_CUR);
  var TP_PREV = readSeries('tpPrev', DEF_TP_PREV);

  /**
   * 零兜底：入参数列一律**给 0 就显示 0**（缺位按 0）。
   * 只有「以它为分母」的派生量在分母 ≤ 0 时输出 `--`（本报表里是「产量 = 排放量 ÷ 强度」）。
   * 环比/同比的分母为 0 同样输出 `--`。
   */

  /* ---------- 派生指标 ---------- */

  /** 碳排放月末指标 */
  function emissionMetrics() {
    var E1 = r2(EV_CUR[M - 1]);
    var I1 = r4(EI_CUR[M - 1]);

    // 年累计排放量（截至本月；入参给 0 就是 0）
    var cum = 0;
    for (var i = 0; i < M; i++) cum += EV_CUR[i];
    cum = r2(cum);

    // 上月基准：M = 1 时不存在
    var E0m = HAS_PREV ? r2(EV_CUR[PM - 1]) : null;
    var I0m = HAS_PREV ? r4(EI_CUR[PM - 1]) : null;
    // 上年同期基准
    var E0y = r2(EV_PREV[M - 1]);
    var I0y = r4(EI_PREV[M - 1]);

    // 产品产量 = 排放量 ÷ 强度（唯一算法；强度 ≤ 0 时不可计算 → --）
    var output = (I1 != null && I1 > 0) ? r4(E1 / I1) : null;
    var prevOutput = (I0m != null && I0m > 0) ? r4(E0m / I0m) : null;
    var yoyOutput = (I0y != null && I0y > 0) ? r4(E0y / I0y) : null;

    return {
      cur: E1, curIntensity: I1, cum: cum,
      prev: E0m, prevIntensity: I0m,
      yoy: E0y, yoyIntensity: I0y,
      output: output, prevOutput: prevOutput, yoyOutput: yoyOutput,
      momEmissionDiff: (E1 != null && E0m != null) ? r2(E1 - E0m) : null,
      yoyEmissionDiff: (E1 != null && E0y != null) ? r2(E1 - E0y) : null,
      momEmissionPct: pctOf(E1, E0m),
      yoyEmissionPct: pctOf(E1, E0y),
      momIntensityPct: pctOf(I1, I0m),
      yoyIntensityPct: pctOf(I1, I0y),
      hasPrev: HAS_PREV
    };
  }

  /** 碳交易月末指标 */
  function tradeMetrics() {
    var V1 = r2(TV_CUR[M - 1]);
    var P1 = r2(TP_CUR[M - 1]);
    var amtCur = (V1 != null && P1 != null) ? r2(V1 * P1) : null;

    var cumVol = 0;
    for (var i = 0; i < M; i++) cumVol += TV_CUR[i];
    cumVol = r2(cumVol);

    var V0m = HAS_PREV ? r2(TV_CUR[PM - 1]) : null;
    var P0m = HAS_PREV ? r2(TP_CUR[PM - 1]) : null;
    var amtPrev = (V0m != null && P0m != null) ? r2(V0m * P0m) : null;

    var V0y = r2(TV_PREV[M - 1]);
    var P0y = r2(TP_PREV[M - 1]);
    var amtYoy = (V0y != null && P0y != null) ? r2(V0y * P0y) : null;

    return {
      volCur: V1, prCur: P1, amtCur: amtCur, cumVol: cumVol,
      volPrev: V0m, prPrev: P0m, amtPrev: amtPrev,
      volYoy: V0y, prYoy: P0y, amtYoy: amtYoy,
      momAmtDiff: (amtCur != null && amtPrev != null) ? r2(amtCur - amtPrev) : null,
      yoyAmtDiff: (amtCur != null && amtYoy != null) ? r2(amtCur - amtYoy) : null,
      volMomPct: pctOf(V1, V0m),
      volYoyPct: pctOf(V1, V0y),
      prMomPct: pctOf(P1, P0m),
      prYoyPct: pctOf(P1, P0y),
      amtMomPct: pctOf(amtCur, amtPrev),
      amtYoyPct: pctOf(amtCur, amtYoy),
      hasPrev: HAS_PREV
    };
  }

  /* ---------- 图表 ---------- */

  function chartBlock(innerHtml, caption) {
    return '<div class="chart-box">' + innerHtml + '</div><div class="chart-caption">' + esc(caption) + '</div>';
  }

  /** 横向条形图（最大值归一） */
  function cmpBars(items, unit, dec) {
    var max = 0;
    items.forEach(function (it) { if (it.value != null && it.value > max) max = it.value; });
    max = max || 1;
    var html = '<div class="hbars">';
    items.forEach(function (it) {
      var v = it.value;
      var pct = (v == null) ? 0 : Math.max(0.5, v / max * 100);
      html += '<div class="hbar-row' + (it.self ? ' is-self' : '') + '">'
        + '<span class="hbar-label">' + esc(it.name) + '</span>'
        + '<span class="hbar-track"><span class="hbar-fill" style="width:' + pct.toFixed(1) + '%;background:' + it.color + '"></span></span>'
        + '<span class="hbar-val">' + fmt(v, dec) + (unit ? ' ' + unit : '') + '</span>'
        + '</div>';
    });
    return html + '</div>';
  }

  /** 12 月折线图（纯 SVG），高亮当前月；全零序列走无数据态 */
  function lineChart(values, unit) {
    if (isAllZero(values)) return chartEmpty('本期暂无数据');

    var W = 760, H = 240, PL = 52, PR = 18, PT = 18, PB = 34;
    var iw = W - PL - PR, ih = H - PT - PB;
    var min = Math.min.apply(null, values), max = Math.max.apply(null, values);
    var span = (max - min) || 1;
    min = min - span * 0.15; max = max + span * 0.15;
    var range = max - min;

    function X(i) { return PL + iw * i / 11; }
    function Yv(v) { return PT + ih * (1 - (v - min) / range); }

    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet">';

    for (var g = 0; g <= 4; g++) {
      var val = min + range * g / 4;
      var y = Yv(val);
      s += '<line x1="' + PL + '" y1="' + y.toFixed(1) + '" x2="' + (W - PR) + '" y2="' + y.toFixed(1) + '" stroke="#eef1f4" stroke-width="1"/>';
      s += '<text x="' + (PL - 8) + '" y="' + (y + 4).toFixed(1) + '" font-size="10" fill="#98a1ab" text-anchor="end">' + val.toFixed(1) + '</text>';
    }
    for (var i = 0; i < 12; i++) {
      s += '<text x="' + X(i).toFixed(1) + '" y="' + (H - 12) + '" font-size="10" fill="#98a1ab" text-anchor="middle">' + (i + 1) + '月</text>';
    }
    var pts = values.map(function (v, i) { return X(i).toFixed(1) + ',' + Yv(v).toFixed(1); }).join(' ');
    s += '<polyline points="' + pts + '" fill="none" stroke="' + GREEN + '" stroke-width="2.2" stroke-linejoin="round"/>';
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

  /** 摘要卡「说明行」 */
  function deltaLine(pct, flatText) {
    if (pct == null) return '<div class="kpi-delta is-flat">' + esc(flatText || '--') + '</div>';
    return '<div class="kpi-delta ' + deltaCls(pct) + '">环比 ' + signed(pct, 2, '%') + '</div>';
  }
  /** 「环比上升/下降 x%」成文片段；不可计算时给替代文案 */
  function momPhrase(pct, flatText) {
    if (pct == null) return esc(flatText || '环比不适用');
    return '环比' + (pct >= 0 ? '上升' : '下降') + ' ' + fmt(Math.abs(pct), 2) + '%';
  }
  function yoyPhrase(pct, flatText) {
    if (pct == null) return esc(flatText || '同比不适用');
    return '同比' + (pct >= 0 ? '上升' : '下降') + ' ' + fmt(Math.abs(pct), 2) + '%';
  }

  /* ---------- 碳排放月报 ---------- */

  function emissionReport() {
    var d = emissionMetrics();

    /* 摘要 */
    var summary = '<div class="kpi-grid">'
      + '<div class="kpi-card is-self"><div class="kpi-name">本月碳排放量</div><div class="kpi-val">' + fmt(d.cur, 2) + '<small> 万tCO₂</small></div>'
      + deltaLine(d.momEmissionPct, HAS_PREV ? '--' : '年度首月，无上月基数') + '</div>'
      + '<div class="kpi-card"><div class="kpi-name">年累计排放量</div><div class="kpi-val">' + fmt(d.cum, 2) + '<small> 万tCO₂</small></div><div class="kpi-delta is-flat">截至 ' + esc(MONTH_CN) + '</div></div>'
      + '<div class="kpi-card"><div class="kpi-name">单位产品碳排放强度</div><div class="kpi-val">' + fmt(d.curIntensity, 4) + '<small> tCO₂/t</small></div>'
      + deltaLine(d.momIntensityPct, HAS_PREV ? '--' : '年度首月，无上月基数') + '</div>'
      + '<div class="kpi-card"><div class="kpi-name">本月产品产量</div><div class="kpi-val">' + fmt(d.output, 2) + '<small> 万t</small></div><div class="kpi-delta is-flat">按「排放量 ÷ 强度」推算</div></div>'
      + '<div class="kpi-card"><div class="kpi-name">环比排放变化</div><div class="kpi-val">' + signed(d.momEmissionDiff, 2) + '<small> 万tCO₂</small></div>'
      + deltaLine(d.momEmissionPct, HAS_PREV ? '--' : '年度首月，无上月基数') + '</div>'
      + '<div class="kpi-card"><div class="kpi-name">同比排放变化</div><div class="kpi-val">' + signed(d.yoyEmissionDiff, 2) + '<small> 万tCO₂</small></div>'
      + deltaLine(d.yoyEmissionPct, '上年同期基数无效') + '</div>'
      + '</div>';

    summary += '<ul class="point-list">'
      + '<li>本月碳排放量 <strong>' + fmt(d.cur, 2) + '</strong> 万tCO₂，' + momPhrase(d.momEmissionPct, HAS_PREV ? '环比不适用' : '本月为年度首月，无上月基数') + '，' + yoyPhrase(d.yoyEmissionPct, '上年同期基数无效') + '。</li>'
      + '<li>单位产品碳排放强度 <strong>' + fmt(d.curIntensity, 4) + '</strong> tCO₂/t，' + momPhrase(d.momIntensityPct, HAS_PREV ? '环比不适用' : '本月为年度首月，无上月基数') + '，' + yoyPhrase(d.yoyIntensityPct, '上年同期基数无效') + '。</li>'
      + '<li>本月产品产量 <strong>' + fmt(d.output, 2) + '</strong> 万t（按「本月排放量 ÷ 本月强度」推算）。</li>'
      + '<li>年累计排放量 <strong>' + fmt(d.cum, 2) + '</strong> 万tCO₂，按当前进度推演全年约 ' + fmt(M > 0 ? d.cum / M * 12 : null, 2) + ' 万tCO₂。</li>'
      + '</ul>';

    /* 一、月度排放概况 */
    var overview = '<p class="brief-p">本月为 ' + esc(MONTH_CN) + '，企业碳排放量 ' + fmt(d.cur, 2) + ' 万tCO₂，单位产品碳排放强度 ' + fmt(d.curIntensity, 4) + ' tCO₂/t，对应产品产量 ' + fmt(d.output, 2) + ' 万t。与上月（' + esc(PREV_LABEL) + '）及上年同期（' + esc(YOY_CN) + '）对比如下表。</p>';

    overview += '<div class="table-caption"><span>月度排放对比表</span><span class="unit">排放量：万tCO₂；强度：tCO₂/t；产量：万t</span></div>'
      + '<table class="btable"><thead><tr>'
      + '<th>指标</th><th>本月（' + esc(MONTH_CN) + '）</th><th>上月（' + esc(PREV_LABEL) + '）</th><th>环比</th><th>上年同期（' + esc(YOY_CN) + '）</th><th>同比</th>'
      + '</tr></thead><tbody>'
      + '<tr><td>碳排放量</td><td class="is-self">' + fmt(d.cur, 2) + '</td><td>' + fmt(d.prev, 2) + '</td>'
      + '<td class="' + deltaCls(d.momEmissionPct) + '">' + signed(d.momEmissionPct, 2, '%') + '</td>'
      + '<td>' + fmt(d.yoy, 2) + '</td><td class="' + deltaCls(d.yoyEmissionPct) + '">' + signed(d.yoyEmissionPct, 2, '%') + '</td></tr>'
      + '<tr><td>单位产品碳排放强度</td><td class="is-self">' + fmt(d.curIntensity, 4) + '</td><td>' + fmt(d.prevIntensity, 4) + '</td>'
      + '<td class="' + deltaCls(d.momIntensityPct) + '">' + signed(d.momIntensityPct, 2, '%') + '</td>'
      + '<td>' + fmt(d.yoyIntensity, 4) + '</td><td class="' + deltaCls(d.yoyIntensityPct) + '">' + signed(d.yoyIntensityPct, 2, '%') + '</td></tr>'
      + '<tr><td>产品产量</td><td class="is-self">' + fmt(d.output, 2) + '</td><td>' + fmt(d.prevOutput, 2) + '</td>'
      + '<td class="' + deltaCls(pctOf(d.output, d.prevOutput)) + '">' + signed(pctOf(d.output, d.prevOutput), 2, '%') + '</td>'
      + '<td>' + fmt(d.yoyOutput, 2) + '</td><td class="' + deltaCls(pctOf(d.output, d.yoyOutput)) + '">' + signed(pctOf(d.output, d.yoyOutput), 2, '%') + '</td></tr>'
      + '</tbody></table>'
      + '<div class="btable-note">注：环比 =（本月 − 上月）÷ 上月 × 100%；同比 =（本月 − 上年同期）÷ 上年同期 × 100%；'
      + '产品产量由「排放量 ÷ 单位产品碳排放强度」推算（保留 4 位小数），不是独立台账数据。'
      + (HAS_PREV ? '' : '本月为年度首月，无上月基数，环比相关一律为 `--`。') + '</div>';

    overview += chartBlock(cmpBars([
      { name: '本月（' + MONTH_CN + '）', value: d.cur, color: '#ff7d00', self: true },
      { name: '上月（' + PREV_LABEL + '）', value: d.prev, color: GREEN },
      { name: '上年同期（' + YOY_CN + '）', value: d.yoy, color: '#165dff' }
    ], '万tCO₂', 2), '（图）本月 / 上月 / 上年同期碳排放量对比');

    /* 二、月度趋势回顾 */
    var trend = '<p class="brief-p">下图为 ' + Y + ' 年 1~12 月碳排放量走势（橙点为当前月 ' + M + ' 月）。'
      + (isAllZero(EV_CUR)
        ? '本期未提供逐月排放量数据，趋势暂不可绘制。'
        : '全年度各月排放量介于 ' + fmt(Math.min.apply(null, EV_CUR), 2) + ' ~ ' + fmt(Math.max.apply(null, EV_CUR), 2) + ' 万tCO₂ 之间。')
      + '</p>'
      + chartBlock(lineChart(EV_CUR), '（图）' + Y + ' 年逐月碳排放量走势（万tCO₂）');

    trend += '<ul class="point-list">'
      + '<li>本月排放量 ' + fmt(d.cur, 2) + ' 万tCO₂，在全年逐月序列中位列第 ' + (EV_CUR.map(function (v, i) { return { v: v, i: i }; }).sort(function (a, b) { return b.v - a.v; }).map(function (o) { return o.i; }).indexOf(M - 1) + 1) + ' 位。</li>'
      + '<li>全年排放量最高月为 ' + (EV_CUR.indexOf(Math.max.apply(null, EV_CUR)) + 1) + ' 月（' + fmt(Math.max.apply(null, EV_CUR), 2) + ' 万tCO₂），最低月为 ' + (EV_CUR.indexOf(Math.min.apply(null, EV_CUR)) + 1) + ' 月（' + fmt(Math.min.apply(null, EV_CUR), 2) + ' 万tCO₂）。</li>'
      + '<li>月度间排放量差异主要来自产品产量的季节波动；单位产品碳排放强度全年保持在 ' + fmt(Math.min.apply(null, EI_CUR), 4) + ' ~ ' + fmt(Math.max.apply(null, EI_CUR), 4) + ' tCO₂/t 区间。</li>'
      + '</ul>';

    /* 三、本月工作建议 */
    var advice = '<ol class="advice-list">'
      + '<li><strong>紧盯强度指标：</strong>本月单位产品碳排放强度 ' + fmt(d.curIntensity, 4) + ' tCO₂/t，' + momPhrase(d.momIntensityPct, '环比不适用') + '，建议将强度纳入月度绩效考核，防止反弹。</li>'
      + '<li><strong>分析排放波动：</strong>本月排放量 ' + momPhrase(d.momEmissionPct, '环比不适用') + '、' + yoyPhrase(d.yoyEmissionPct, '同比不适用') + '，'
      + '建议对照《碳排放差异分析报告》核查产量与强度各自的贡献，定位波动主因。</li>'
      + '<li><strong>推进能效降碳：</strong>聚焦燃料替代、余热余压回收与绿电消纳，持续压降单位产品碳排放强度，从源头减少排放对产量的依赖。</li>'
      + '<li><strong>完善计量台账：</strong>按月核对活动数据与排放因子，确保月度排放量、产品产量与强度三项数据可追溯、可核证，为年度履约与核查打好基础。</li>'
      + '</ol>';

    return {
      title: '碳排放月报',
      kicker: '碳 排 放 月 报',
      toc: [
        ['摘要 · 本月核心指标概览', '#sec-0'],
        ['一、月度排放概况', '#sec-1'],
        ['二、月度趋势回顾', '#sec-2'],
        ['三、本月工作建议', '#sec-3']
      ],
      sections: [
        ['摘要 · 本月核心指标概览', 'sec-0', summary],
        ['一、月度排放概况', 'sec-1', overview],
        ['二、月度趋势回顾', 'sec-2', trend],
        ['三、本月工作建议', 'sec-3', advice]
      ]
    };
  }

  /* ---------- 碳交易月报 ---------- */

  function tradeReport() {
    var d = tradeMetrics();

    /* 摘要 */
    var summary = '<div class="kpi-grid">'
      + '<div class="kpi-card is-self"><div class="kpi-name">本月成交量</div><div class="kpi-val">' + fmt(d.volCur, 2) + '<small> 万tCO₂</small></div>'
      + deltaLine(d.volMomPct, HAS_PREV ? '--' : '年度首月，无上月基数') + '</div>'
      + '<div class="kpi-card"><div class="kpi-name">本月成交均价</div><div class="kpi-val">' + fmt(d.prCur, 2) + '<small> 元/tCO₂</small></div>'
      + deltaLine(d.prMomPct, HAS_PREV ? '--' : '年度首月，无上月基数') + '</div>'
      + '<div class="kpi-card"><div class="kpi-name">本月成交金额</div><div class="kpi-val">' + fmt(d.amtCur, 2) + '<small> 万元</small></div><div class="kpi-delta is-flat">按「成交量 × 成交均价」推算</div></div>'
      + '<div class="kpi-card"><div class="kpi-name">年累计成交量</div><div class="kpi-val">' + fmt(d.cumVol, 2) + '<small> 万tCO₂</small></div><div class="kpi-delta is-flat">截至 ' + esc(MONTH_CN) + '</div></div>'
      + '<div class="kpi-card"><div class="kpi-name">环比金额变化</div><div class="kpi-val">' + signed(d.momAmtDiff, 2) + '<small> 万元</small></div>'
      + deltaLine(d.amtMomPct, HAS_PREV ? '--' : '年度首月，无上月基数') + '</div>'
      + '<div class="kpi-card"><div class="kpi-name">同比金额变化</div><div class="kpi-val">' + signed(d.yoyAmtDiff, 2) + '<small> 万元</small></div>'
      + deltaLine(d.amtYoyPct, '上年同期基数无效') + '</div>'
      + '</div>';

    summary += '<ul class="point-list">'
      + '<li>本月碳市场成交 <strong>' + fmt(d.volCur, 2) + '</strong> 万tCO₂，成交均价 <strong>' + fmt(d.prCur, 2) + '</strong> 元/tCO₂，成交金额 ' + fmt(d.amtCur, 2) + ' 万元。</li>'
      + '<li>成交量 ' + momPhrase(d.volMomPct, HAS_PREV ? '环比不适用' : '本月为年度首月，无上月基数') + '，' + yoyPhrase(d.volYoyPct, '上年同期基数无效') + '。</li>'
      + '<li>成交均价 ' + momPhrase(d.prMomPct, HAS_PREV ? '环比不适用' : '本月为年度首月，无上月基数') + '，' + yoyPhrase(d.prYoyPct, '上年同期基数无效') + '。</li>'
      + '<li>年累计成交量 <strong>' + fmt(d.cumVol, 2) + '</strong> 万tCO₂，按当前进度推演全年约 ' + fmt(M > 0 ? d.cumVol / M * 12 : null, 2) + ' 万tCO₂。</li>'
      + '</ul>';

    /* 一、交易概况 */
    var overview = '<p class="brief-p">本月为 ' + esc(MONTH_CN) + '，企业通过全国碳排放权交易市场及区域试点市场开展配额与 CCER 交易，'
      + '成交 ' + fmt(d.volCur, 2) + ' 万tCO₂，成交均价 ' + fmt(d.prCur, 2) + ' 元/tCO₂，成交金额 ' + fmt(d.amtCur, 2) + ' 万元。与上月及上年同期对比如下表。</p>';

    overview += '<div class="table-caption"><span>月度交易对比表</span><span class="unit">成交量：万tCO₂；均价：元/tCO₂；金额：万元</span></div>'
      + '<table class="btable"><thead><tr>'
      + '<th>指标</th><th>本月（' + esc(MONTH_CN) + '）</th><th>上月（' + esc(PREV_LABEL) + '）</th><th>环比</th><th>上年同期（' + esc(YOY_CN) + '）</th><th>同比</th>'
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
      + '<div class="btable-note">注：成交金额 = 成交量（万t）× 成交均价（元/t），单位为万元，属派生的量价联动口径，不是独立台账数据；'
      + '「金额/成交量」行的着色按「收益视角」——增加为绿、减少为红；均价行按名目方向着色。'
      + (HAS_PREV ? '' : '本月为年度首月，无上月基数，环比相关一律为 `--`。') + '</div>';

    overview += chartBlock(cmpBars([
      { name: '本月（' + MONTH_CN + '）', value: d.amtCur, color: '#ff7d00', self: true },
      { name: '上月（' + PREV_LABEL + '）', value: d.amtPrev, color: GREEN },
      { name: '上年同期（' + YOY_CN + '）', value: d.amtYoy, color: '#165dff' }
    ], '万元', 2), '（图）本月 / 上月 / 上年同期成交金额对比');

    /* 二、月度趋势回顾 */
    var trend = '<p class="brief-p">下图为 ' + Y + ' 年 1~12 月成交量与成交均价走势（橙点为当前月 ' + M + ' 月）。</p>'
      + chartBlock(lineChart(TV_CUR), '（图）' + Y + ' 年逐月成交量走势（万tCO₂）')
      + chartBlock(lineChart(TP_CUR), '（图）' + Y + ' 年逐月成交均价走势（元/tCO₂）');

    trend += '<ul class="point-list">'
      + '<li>本月成交量 ' + fmt(d.volCur, 2) + ' 万tCO₂，在全年逐月成交序列中位列第 ' + (TV_CUR.map(function (v, i) { return { v: v, i: i }; }).sort(function (a, b) { return b.v - a.v; }).map(function (o) { return o.i; }).indexOf(M - 1) + 1) + ' 位。</li>'
      + '<li>全年成交量最高月为 ' + (TV_CUR.indexOf(Math.max.apply(null, TV_CUR)) + 1) + ' 月（' + fmt(Math.max.apply(null, TV_CUR), 2) + ' 万tCO₂），最低月为 ' + (TV_CUR.indexOf(Math.min.apply(null, TV_CUR)) + 1) + ' 月（' + fmt(Math.min.apply(null, TV_CUR), 2) + ' 万tCO₂）。</li>'
      + '<li>成交均价全年保持在 ' + fmt(Math.min.apply(null, TP_CUR), 2) + ' ~ ' + fmt(Math.max.apply(null, TP_CUR), 2) + ' 元/tCO₂ 区间，价格中枢整体平稳。</li>'
      + '</ul>';

    /* 三、本月交易建议 */
    var advice = '<ol class="advice-list">'
      + '<li><strong>把握价格窗口：</strong>本月成交均价 ' + fmt(d.prCur, 2) + ' 元/tCO₂，' + momPhrase(d.prMomPct, '环比不适用') + '，'
      + '建议建立碳价监测与分批建仓机制，在价格低位增配、高位择机变现盈余配额。</li>'
      + '<li><strong>优化量价节奏：</strong>本月成交量 ' + fmt(d.volCur, 2) + ' 万tCO₂，' + momPhrase(d.volMomPct, '环比不适用') + '，'
      + '建议按履约进度制定分月交易计划，避免期末集中购碳推高成本，也避免量能大起大落放大金额波动。</li>'
      + '<li><strong>用好 CCER 抵销：</strong>CCER 成交价通常低于配额价，建议在合规抵销比例内提高 CCER 使用比例，降低整体履约成本。</li>'
      + '<li><strong>建立差异跟踪机制：</strong>按月开展「量—价」双因素差异分解（见《碳交易差异分析报告》），对价差效应连续为负的月份及时复盘交易策略，形成「月度分解—策略调整—效果回评」的闭环。</li>'
      + '</ol>';

    return {
      title: '碳交易月报',
      kicker: '碳 交 易 月 报',
      toc: [
        ['摘要 · 本月核心指标概览', '#sec-0'],
        ['一、交易概况', '#sec-1'],
        ['二、月度趋势回顾', '#sec-2'],
        ['三、本月交易建议', '#sec-3']
      ],
      sections: [
        ['摘要 · 本月核心指标概览', 'sec-0', summary],
        ['一、交易概况', 'sec-1', overview],
        ['二、月度趋势回顾', 'sec-2', trend],
        ['三、本月交易建议', 'sec-3', advice]
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
      html += '<li class="toc-l1"><a href="' + t[1] + '">' + esc(t[0]) + '</a></li>';
    });
    html += '</ol></div>';

    html += '<div class="brief-page">';
    cfg.sections.forEach(function (s) {
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
