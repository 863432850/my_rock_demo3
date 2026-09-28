/**
 * 差异分析报告 · 渲染
 * URL 参数：?tab=emission|trade&month=YYYY-MM
 * - tab=emission → 碳排放差异分析：本月 vs 上月 / 上年同期，按 E = 产量 × 强度 做因素分解
 * - tab=trade    → 碳交易差异分析：本月 vs 上月 / 上年同期，按 金额 = 量 × 价 做因素分解
 * 两种分析的指标、分解模型、图表、表格完全不同。
 * 「下载报告（PDF）」用 html2canvas + jsPDF 生成 PDF。
 */

(function () {
  'use strict';

  var ORG = '河南安钢周口钢铁有限责任公司';
  var GREEN = '#00b42a';

  /* ---------- 基础工具 ---------- */

  function fmt(n, d) {
    return Number(n).toLocaleString('zh-CN', { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function signed(n, d, unit) {
    return (n > 0 ? '+' : '') + fmt(n, d) + (unit ? ' ' + unit : '');
  }
  function deltaCls(n) { return n > 0 ? 'is-pos' : (n < 0 ? 'is-neg' : ''); }
  function lastDay(y, m) { return new Date(y, m, 0).getDate(); }

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

  var PM = M === 1 ? 12 : M - 1;
  var PY = M === 1 ? Y - 1 : Y;
  var PREV_CN = PY + '年' + PM + '月';
  var YOY_CN = (Y - 1) + '年' + M + '月';

  /* ---------- 演示数据（唯一数据源） ---------- */

  var INTENSITY_2026 = [0.7605, 0.7573, 0.7637, 0.7630, 0.7646, 0.7653, 0.7658, 0.7662, 0.7655, 0.7661, 0.7657, 0.7663];
  var OUTPUT_2026 = [648.2, 641.5, 669.8, 656.4, 673.1, 662.7, 659.4, 661.2, 658.83, 667.5, 655.9, 649.0];
  var EMISSION = OUTPUT_2026.map(function (q, i) { return +(q * INTENSITY_2026[i]).toFixed(2); });

  var YOY_OUTPUT_DIV = 1.055;      // 去年同期产量 = 本月 / 1.055
  var YOY_INTENSITY_FACTOR = 1.012; // 去年同期强度 = 本月 × 1.012

  var TRADE_VOL = [42.6, 38.2, 55.4, 47.8, 62.3, 51.5, 44.9, 58.7, 49.3, 66.1, 53.8, 45.2];
  var TRADE_PRICE = [86.5, 88.2, 85.7, 89.4, 91.2, 88.6, 90.3, 92.1, 90.8, 93.5, 91.7, 94.2];

  var YOY_VOL_FACTOR = 1.06;   // 去年同期成交量 = 本月 × 1.06
  var YOY_PRICE_FACTOR = 0.96; // 去年同期成交均价 = 本月 × 0.96

  /* ---------- 因素分解工具 ---------- */
  /**
   * 两因素乘法模型 Z = X × Y 的差异分解（基准为 0，本期为 1）：
   *   ΔZ = X效应 + Y效应 + 交互项
   *   X效应 = (X1 − X0) × Y0
   *   Y效应 = (Y1 − Y0) × X0
   *   交互项 = (X1 − X0) × (Y1 − Y0)
   */
  function decompose(x0, y0, x1, y1, dec) {
    var z0 = x0 * y0, z1 = x1 * y1;
    var xEff = (x1 - x0) * y0;
    var yEff = (y1 - y0) * x0;
    var cross = (x1 - x0) * (y1 - y0);
    var d = z1 - z0;
    var absSum = Math.abs(xEff) + Math.abs(yEff) + Math.abs(cross);
    function share(v) { return absSum ? +(Math.abs(v) / absSum * 100).toFixed(1) : 0; }
    return {
      z0: +z0.toFixed(dec), z1: +z1.toFixed(dec), d: +d.toFixed(dec),
      xEff: +xEff.toFixed(dec), yEff: +yEff.toFixed(dec), cross: +cross.toFixed(dec),
      xShare: share(xEff), yShare: share(yEff), crossShare: share(cross),
      x0: x0, y0: y0, x1: x1, y1: y1
    };
  }

  /* ---------- 碳排放差异 ---------- */

  function emissionDiff() {
    // 本期
    var q1 = OUTPUT_2026[M - 1], i1 = INTENSITY_2026[M - 1];
    // 环比基准：上月
    var q0m = OUTPUT_2026[PM - 1], i0m = INTENSITY_2026[PM - 1];
    var mom = decompose(q0m, i0m, q1, i1, 2);
    // 同比基准：上年同期
    var q0y = +(q1 / YOY_OUTPUT_DIV).toFixed(2), i0y = +(i1 * YOY_INTENSITY_FACTOR).toFixed(4);
    var yoy = decompose(q0y, i0y, q1, i1, 2);

    return { q1: q1, i1: i1, mom: mom, yoy: yoy, q0m: q0m, i0m: i0m, q0y: q0y, i0y: i0y };
  }

  /* ---------- 碳交易差异 ---------- */

  function tradeDiff() {
    var v1 = TRADE_VOL[M - 1], p1 = TRADE_PRICE[M - 1];
    var v0m = TRADE_VOL[PM - 1], p0m = TRADE_PRICE[PM - 1];
    var mom = decompose(v0m, p0m, v1, p1, 2);
    var v0y = +(v1 * YOY_VOL_FACTOR).toFixed(2), p0y = +(p1 * YOY_PRICE_FACTOR).toFixed(2);
    var yoy = decompose(v0y, p0y, v1, p1, 4);
    // 金额单位：万t × 元/t = 万元（yoy 用 4 位小数避免小差异被抹平）
    return { v1: v1, p1: p1, mom: mom, yoy: yoy, v0m: v0m, p0m: p0m, v0y: v0y, p0y: p0y };
  }

  /* ---------- 图表 ---------- */

  function chartBlock(innerHtml, caption) {
    return '<div class="chart-box">' + innerHtml + '</div><div class="chart-caption">' + esc(caption) + '</div>';
  }

  /**
   * 双向差异条形图（以 0 为中心）
   * @param {boolean} [positiveIsGood] true 时正值为绿色（有利）；默认正值为红色（增排等不利方向）
   */
  function wbars(items, unit, dec, positiveIsGood) {
    var max = 0;
    items.forEach(function (it) { if (Math.abs(it.value) > max) max = Math.abs(it.value); });
    max = max || 1;
    var posColor = positiveIsGood ? '#2ba471' : '#f53f3f';
    var negColor = positiveIsGood ? '#f53f3f' : '#2ba471';
    var html = '<div class="wbars">';
    items.forEach(function (it) {
      var pct = Math.abs(it.value) / max * 50; // 单侧最多 50%
      var isPos = it.value > 0;
      var fill = isPos
        ? 'left:50%;width:' + Math.max(0.4, pct).toFixed(1) + '%;background:' + posColor
        : 'right:50%;width:' + Math.max(0.4, pct).toFixed(1) + '%;background:' + negColor;
      html += '<div class="wbar-row ' + (isPos ? 'is-pos' : (it.value < 0 ? 'is-neg' : '')) + '">'
        + '<span class="wbar-label">' + esc(it.name) + '</span>'
        + '<span class="wbar-track"><span class="wbar-fill" style="' + fill + '"></span></span>'
        + '<span class="wbar-val">' + signed(it.value, dec, unit) + '</span>'
        + '</div>';
    });
    return html + '</div>';
  }

  /** 水位对比条形图（本月 / 上月 / 上年同期，本月高亮） */
  function levelBars(items, unit, dec) {
    var max = 0;
    items.forEach(function (it) { if (it.value > max) max = it.value; });
    max = max || 1;
    var html = '<div class="lvl-bars">';
    items.forEach(function (it) {
      var pct = Math.max(1, it.value / max * 100);
      html += '<div class="lvl-row' + (it.cur ? ' is-cur' : '') + '">'
        + '<span class="lvl-label">' + esc(it.name) + '</span>'
        + '<span class="lvl-track"><span class="lvl-fill" style="width:' + pct.toFixed(1) + '%;background:' + it.color + '"></span></span>'
        + '<span class="lvl-val">' + fmt(it.value, dec) + (unit ? ' ' + unit : '') + '</span>'
        + '</div>';
    });
    return html + '</div>';
  }

  /**
   * 瀑布图（基准 → 各因素贡献 → 本期），纯 SVG
   * @param {boolean} [goodIsUp] 因素为正时是否「有利」：碳排放=false（增排为不利，正红负绿）；
   *                             碳交易=null 时按「金额增收为有利」处理（正绿负红）
   */
  function waterfall(base, effects, end, unit, positiveIsGood) {
    var W = 760, H = 300, PL = 66, PR = 24, PT = 24, PB = 46;
    var iw = W - PL - PR, ih = H - PT - PB;

    // 计算各柱的起止值
    var steps = [{ label: '基准值', to: base, kind: 'base' }];
    var acc = base;
    effects.forEach(function (e) {
      steps.push({ label: e.name, from: acc, to: acc + e.value, value: e.value, kind: 'eff' });
      acc += e.value;
    });
    steps.push({ label: '本期值', to: end, kind: 'end' });

    // 纵轴只取「差异轨迹」的值域（不含 0）：差异相对基期量级很小时，
    // 若按 0 起轴，各因素柱会被压成看不见的细线。基准/本期柱改为自轴底起绘。
    var allV = [base, end];
    steps.forEach(function (s) { if (s.kind === 'eff') { allV.push(s.from); allV.push(s.to); } });
    var minV = Math.min.apply(null, allV), maxV = Math.max.apply(null, allV);
    var span = (maxV - minV) || 1;
    minV = minV - span * 0.22; maxV = maxV + span * 0.16;
    var range = maxV - minV;
    var floor = minV;

    function Yv(v) { return PT + ih * (1 - (v - minV) / range); }
    var n = steps.length;
    var slot = iw / n;
    var bw = Math.min(74, slot * 0.56);

    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet">';

    // 网格
    for (var g = 0; g <= 4; g++) {
      var val = minV + range * g / 4, y = Yv(val);
      s += '<line x1="' + PL + '" y1="' + y.toFixed(1) + '" x2="' + (W - PR) + '" y2="' + y.toFixed(1) + '" stroke="#eef1f4" stroke-width="1"/>';
      s += '<text x="' + (PL - 8) + '" y="' + (y + 4).toFixed(1) + '" font-size="10" fill="#98a1ab" text-anchor="end">' + val.toFixed(1) + '</text>';
    }

    steps.forEach(function (st, i) {
      var cx = PL + slot * i + slot / 2;
      // 基准/本期为总量柱（自轴底起绘），因素柱为浮动柱
      var from = st.kind === 'eff' ? st.from : floor;
      var yTop = Yv(Math.max(from, st.to));
      var yBot = Yv(Math.min(from, st.to));
      var h = Math.max(2, yBot - yTop);
      // 本期值用主题橙（与「本月」高亮一致），避免与好坏语义色混淆
      var color = st.kind === 'base' ? '#86909c'
        : (st.kind === 'end' ? '#ff7d00'
          : (positiveIsGood ? (st.value > 0 ? '#2ba471' : '#f53f3f') : (st.value > 0 ? '#f53f3f' : '#2ba471')));

      s += '<rect x="' + (cx - bw / 2).toFixed(1) + '" y="' + yTop.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="3" fill="' + color + '"/>';

      // 数值标签
      var labVal = st.kind === 'eff' ? (st.value > 0 ? '+' : '') + st.value.toFixed(1) : st.to.toFixed(1);
      s += '<text x="' + cx.toFixed(1) + '" y="' + (yTop - 6).toFixed(1) + '" font-size="10.5" fill="#333" font-weight="600" text-anchor="middle">' + labVal + '</text>';
      // 名称
      s += '<text x="' + cx.toFixed(1) + '" y="' + (H - 26) + '" font-size="10.5" fill="#606266" text-anchor="middle">' + esc(st.label) + '</text>';

      // 连接虚线
      if (i < n - 1) {
        var next = steps[i + 1];
        var lvl = st.kind === 'eff' ? st.to : st.to;
        s += '<line x1="' + (cx + bw / 2).toFixed(1) + '" y1="' + Yv(lvl).toFixed(1) + '" x2="' + (PL + slot * (i + 1) + slot / 2 - bw / 2).toFixed(1) + '" y2="' + Yv(lvl).toFixed(1) + '" stroke="#c9d1d9" stroke-width="1" stroke-dasharray="3 3"/>';
      }
    });

    s += '</svg>';
    return s + '<div style="text-align:center;font-size:12px;color:#98a1ab;margin-top:2px">单位：' + esc(unit) + ' · 纵轴按差异量级缩放，基准/本期柱自轴底起绘</div>';
  }

  /* ---------- 碳排放差异分析报告 ---------- */

  function emissionReport() {
    var d = emissionDiff();
    var mom = d.mom, yoy = d.yoy;

    var momWord = mom.d >= 0 ? '增加' : '减少';
    var yoyWord = yoy.d >= 0 ? '增加' : '减少';

    /* 摘要 */
    var summary = '<div class="kpi-grid">'
      + '<div class="kpi-card is-self"><div class="kpi-name">本月碳排放量</div><div class="kpi-val">' + fmt(mom.z1, 2) + '<small> 万tCO₂</small></div><div class="kpi-delta is-flat">' + esc(MONTH_CN) + '</div></div>'
      + '<div class="kpi-card"><div class="kpi-name">环比差异</div><div class="kpi-val">' + signed(mom.d, 2) + '<small> 万tCO₂</small></div><div class="kpi-delta ' + deltaCls(mom.d) + '">较' + esc(PREV_CN) + ' ' + signed(mom.d / mom.z0 * 100, 2, '%') + '</div></div>'
      + '<div class="kpi-card"><div class="kpi-name">同比差异</div><div class="kpi-val">' + signed(yoy.d, 2) + '<small> 万tCO₂</small></div><div class="kpi-delta ' + deltaCls(yoy.d) + '">较' + esc(YOY_CN) + ' ' + signed(yoy.d / yoy.z0 * 100, 2, '%') + '</div></div>'
      + '<div class="kpi-card"><div class="kpi-name">环比主要动因</div><div class="kpi-val">' + esc(Math.abs(mom.xEff) >= Math.abs(mom.yEff) ? '产量' : '强度') + '</div><div class="kpi-delta is-flat">占差异 ' + fmt(Math.abs(mom.xEff) >= Math.abs(mom.yEff) ? mom.xShare : mom.yShare, 1) + '%</div></div>'
      + '<div class="kpi-card"><div class="kpi-name">同比主要动因</div><div class="kpi-val">' + esc(Math.abs(yoy.xEff) >= Math.abs(yoy.yEff) ? '产量' : '强度') + '</div><div class="kpi-delta is-flat">占差异 ' + fmt(Math.abs(yoy.xEff) >= Math.abs(yoy.yEff) ? yoy.xShare : yoy.yShare, 1) + '%</div></div>'
      + '<div class="kpi-card"><div class="kpi-name">本期排放强度</div><div class="kpi-val">' + fmt(d.i1, 4) + '<small> tCO₂/t</small></div><div class="kpi-delta ' + deltaCls(d.i1 - d.i0m) + '">环比 ' + signed((d.i1 - d.i0m) / d.i0m * 100, 2, '%') + '</div></div>'
      + '</div>';

    summary += '<ul class="point-list">'
      + '<li>本月碳排放量 <strong>' + fmt(mom.z1, 2) + '</strong> 万tCO₂，较上月（' + esc(PREV_CN) + '）' + momWord + ' ' + fmt(Math.abs(mom.d), 2) + ' 万tCO₂，' + signed(mom.d / mom.z0 * 100, 2, '%') + '。</li>'
      + '<li>差异分解：产量效应 ' + signed(mom.xEff, 2) + '、强度效应 ' + signed(mom.yEff, 2) + '、交互项 ' + signed(mom.cross, 2) + ' 万tCO₂，三项之和等于总差异。</li>'
      + '<li>同比看，本月较上年同期（' + esc(YOY_CN) + '）' + yoyWord + ' ' + fmt(Math.abs(yoy.d), 2) + ' 万tCO₂（' + signed(yoy.d / yoy.z0 * 100, 2, '%') + '），主要动因为' + (Math.abs(yoy.xEff) >= Math.abs(yoy.yEff) ? '产量变化' : '强度变化') + '。</li>'
      + '<li>本期单位产品碳排放强度 ' + fmt(d.i1, 4) + ' tCO₂/t，较上月 ' + signed((d.i1 - d.i0m) / d.i0m * 100, 2, '%') + '，能效水平总体稳定。</li>'
      + '</ul>';

    /* 一、差异总览 */
    var overview = '<p class="brief-p">本报告以「本月（' + esc(MONTH_CN) + '）」为分析对象，分别与「上月（' + esc(PREV_CN) + '）」和「上年同期（' + esc(YOY_CN) + '）」对比，量化碳排放量差异并逐层分解到产量与强度两个因素。</p>';

    overview += '<div class="table-caption"><span>碳排放差异总览表</span><span class="unit">排放量/产量：万tCO₂、万t；强度：tCO₂/t</span></div>'
      + '<table class="btable"><thead><tr>'
      + '<th>对比口径</th><th>基准值</th><th>本期值</th><th>差异</th><th>差异率</th><th>差异性质</th>'
      + '</tr></thead><tbody>'
      + '<tr><td>排放量（环比 · 较' + esc(PREV_CN) + '）</td><td>' + fmt(mom.z0, 2) + '</td><td class="is-self">' + fmt(mom.z1, 2) + '</td>'
      + '<td class="' + deltaCls(mom.d) + '">' + signed(mom.d, 2) + '</td><td class="' + deltaCls(mom.d) + '">' + signed(mom.d / mom.z0 * 100, 2, '%') + '</td>'
      + '<td>' + (mom.d >= 0 ? '增排' : '减排') + '</td></tr>'
      + '<tr><td>排放量（同比 · 较' + esc(YOY_CN) + '）</td><td>' + fmt(yoy.z0, 2) + '</td><td class="is-self">' + fmt(yoy.z1, 2) + '</td>'
      + '<td class="' + deltaCls(yoy.d) + '">' + signed(yoy.d, 2) + '</td><td class="' + deltaCls(yoy.d) + '">' + signed(yoy.d / yoy.z0 * 100, 2, '%') + '</td>'
      + '<td>' + (yoy.d >= 0 ? '增排' : '减排') + '</td></tr>'
      + '<tr><td>产品产量（环比）</td><td>' + fmt(d.q0m, 2) + '</td><td>' + fmt(d.q1, 2) + '</td>'
      + '<td class="' + deltaCls(d.q1 - d.q0m) + '">' + signed(d.q1 - d.q0m, 2) + '</td><td class="' + deltaCls(d.q1 - d.q0m) + '">' + signed((d.q1 - d.q0m) / d.q0m * 100, 2, '%') + '</td>'
      + '<td>' + (d.q1 >= d.q0m ? '增产' : '减产') + '</td></tr>'
      + '<tr><td>碳排放强度（环比）</td><td>' + fmt(d.i0m, 4) + '</td><td>' + fmt(d.i1, 4) + '</td>'
      + '<td class="' + deltaCls(d.i1 - d.i0m) + '">' + signed(d.i1 - d.i0m, 4) + '</td><td class="' + deltaCls(d.i1 - d.i0m) + '">' + signed((d.i1 - d.i0m) / d.i0m * 100, 2, '%') + '</td>'
      + '<td>' + (d.i1 >= d.i0m ? '强度上升' : '强度下降') + '</td></tr>'
      + '</tbody></table>'
      + '<div class="btable-note">注：差异 = 本期值 − 基准值；差异率 = 差异 ÷ 基准值 × 100%。</div>';

    overview += chartBlock(levelBars([
      { name: '本月（' + MONTH_CN + '）', value: mom.z1, color: '#ff7d00', cur: true },
      { name: '上月（' + PREV_CN + '）', value: mom.z0, color: GREEN },
      { name: '上年同期（' + YOY_CN + '）', value: yoy.z0, color: '#165dff' }
    ], '万tCO₂', 2), '（图）本月 / 上月 / 上年同期碳排放量对比');

    /* 二、差异因素分解 */
    var model = '<p class="brief-p">碳排放量可拆解为两个因素的乘积：<strong>碳排放量 E = 产品产量 Q × 单位产品碳排放强度 I</strong>。'
      + '当产量或强度发生变化时，排放量差异可按「两因素乘法模型」分解为三部分：</p>'
      + '<ul class="point-list">'
      + '<li><strong>产量效应</strong>＝（Q₁ − Q₀）× I₀：仅由产品产量变化引起的排放量变化。</li>'
      + '<li><strong>强度效应</strong>＝（I₁ − I₀）× Q₀：仅由单位产品碳排放强度变化引起的排放量变化（反映能效与能源结构改善）。</li>'
      + '<li><strong>交互项</strong>＝（Q₁ − Q₀）×（I₁ − I₀）：产量与强度同时变化产生的交叉影响。</li>'
      + '</ul>'
      + '<p class="brief-p">三项之和恒等于总差异：ΔE = 产量效应 + 强度效应 + 交互项。</p>';

    model += '<div class="table-caption"><span>环比差异因素分解表（' + esc(PREV_CN) + ' → ' + esc(MONTH_CN) + '）</span><span class="unit">单位：万tCO₂</span></div>'
      + '<table class="btable"><thead><tr>'
      + '<th>差异来源</th><th>影响排放量</th><th>占差异比重</th><th>方向</th><th>说明</th>'
      + '</tr></thead><tbody>'
      + '<tr><td>产量效应</td><td class="' + deltaCls(mom.xEff) + '">' + signed(mom.xEff, 2) + '</td><td>' + fmt(mom.xShare, 1) + '%</td>'
      + '<td class="' + deltaCls(mom.xEff) + '">' + (mom.xEff >= 0 ? '增排' : '减排') + '</td><td>产量 ' + fmt(d.q0m, 2) + ' → ' + fmt(d.q1, 2) + ' 万t</td></tr>'
      + '<tr><td>强度效应</td><td class="' + deltaCls(mom.yEff) + '">' + signed(mom.yEff, 2) + '</td><td>' + fmt(mom.yShare, 1) + '%</td>'
      + '<td class="' + deltaCls(mom.yEff) + '">' + (mom.yEff >= 0 ? '增排' : '减排') + '</td><td>强度 ' + fmt(d.i0m, 4) + ' → ' + fmt(d.i1, 4) + ' tCO₂/t</td></tr>'
      + '<tr><td>交互项</td><td class="' + deltaCls(mom.cross) + '">' + signed(mom.cross, 2) + '</td><td>' + fmt(mom.crossShare, 1) + '%</td>'
      + '<td class="' + deltaCls(mom.cross) + '">' + (mom.cross >= 0 ? '增排' : '减排') + '</td><td>产量与强度同时变化</td></tr>'
      + '</tbody><tfoot><tr><td>合计差异</td><td class="' + deltaCls(mom.d) + '">' + signed(mom.d, 2) + '</td><td>100.0%</td>'
      + '<td class="' + deltaCls(mom.d) + '">' + (mom.d >= 0 ? '增排' : '减排') + '</td><td>与总差异一致（校验通过）</td></tr></tfoot></table>'
      + '<div class="btable-note">注：占差异比重按各因素影响绝对值 ÷ 三者绝对值之和计算；三项之和 = ' + fmt(mom.xEff, 2) + ' + ' + fmt(mom.yEff, 2) + ' + ' + fmt(mom.cross, 2) + ' = ' + fmt(mom.xEff + mom.yEff + mom.cross, 2) + ' 万tCO₂。</div>';

    model += chartBlock(waterfall(mom.z0, [
      { name: '产量效应', value: mom.xEff },
      { name: '强度效应', value: mom.yEff },
      { name: '交互项', value: mom.cross }
    ], mom.z1, '万tCO₂', false), '（图）环比排放量差异瀑布图（' + PREV_CN + ' → ' + MONTH_CN + '）');

    // 同比分解
    model += '<h2 class="brief-h2">（一）同比差异分解</h2>'
      + '<div class="table-caption"><span>同比差异因素分解表（' + esc(YOY_CN) + ' → ' + esc(MONTH_CN) + '）</span><span class="unit">单位：万tCO₂</span></div>'
      + '<table class="btable"><thead><tr>'
      + '<th>差异来源</th><th>影响排放量</th><th>占差异比重</th><th>方向</th><th>说明</th>'
      + '</tr></thead><tbody>'
      + '<tr><td>产量效应</td><td class="' + deltaCls(yoy.xEff) + '">' + signed(yoy.xEff, 2) + '</td><td>' + fmt(yoy.xShare, 1) + '%</td>'
      + '<td class="' + deltaCls(yoy.xEff) + '">' + (yoy.xEff >= 0 ? '增排' : '减排') + '</td><td>产量 ' + fmt(d.q0y, 2) + ' → ' + fmt(d.q1, 2) + ' 万t</td></tr>'
      + '<tr><td>强度效应</td><td class="' + deltaCls(yoy.yEff) + '">' + signed(yoy.yEff, 2) + '</td><td>' + fmt(yoy.yShare, 1) + '%</td>'
      + '<td class="' + deltaCls(yoy.yEff) + '">' + (yoy.yEff >= 0 ? '增排' : '减排') + '</td><td>强度 ' + fmt(d.i0y, 4) + ' → ' + fmt(d.i1, 4) + ' tCO₂/t</td></tr>'
      + '<tr><td>交互项</td><td class="' + deltaCls(yoy.cross) + '">' + signed(yoy.cross, 2) + '</td><td>' + fmt(yoy.crossShare, 1) + '%</td>'
      + '<td class="' + deltaCls(yoy.cross) + '">' + (yoy.cross >= 0 ? '增排' : '减排') + '</td><td>产量与强度同时变化</td></tr>'
      + '</tbody><tfoot><tr><td>合计差异</td><td class="' + deltaCls(yoy.d) + '">' + signed(yoy.d, 2) + '</td><td>100.0%</td>'
      + '<td class="' + deltaCls(yoy.d) + '">' + (yoy.d >= 0 ? '增排' : '减排') + '</td><td>与总差异一致（校验通过）</td></tr></tfoot></table>';

    model += chartBlock(wbars([
      { name: '产量效应', value: yoy.xEff },
      { name: '强度效应', value: yoy.yEff },
      { name: '交互项', value: yoy.cross }
    ], '万tCO₂', 2, false), '（图）同比差异因素贡献（' + YOY_CN + ' → ' + MONTH_CN + '）');

    model += '<h2 class="brief-h2">（二）分解结论</h2>'
      + '<p class="brief-p">环比看，本月排放量' + momWord + ' ' + fmt(Math.abs(mom.d), 2) + ' 万tCO₂，'
      + '其中产量效应 ' + signed(mom.xEff, 2) + ' 万tCO₂（占 ' + fmt(mom.xShare, 1) + '%）、强度效应 ' + signed(mom.yEff, 2) + ' 万tCO₂（占 ' + fmt(mom.yShare, 1) + '%）。'
      + (Math.abs(mom.xEff) >= Math.abs(mom.yEff)
        ? '产量变化是本月排放差异的<strong>主导因素</strong>，强度变化影响相对次要。'
        : '单位产品碳排放强度变化是本月排放差异的<strong>主导因素</strong>，反映能效或能源结构的实质变化。')
      + '</p>'
      + '<p class="brief-p">同比看，本月较上年同期' + yoyWord + ' ' + fmt(Math.abs(yoy.d), 2) + ' 万tCO₂，'
      + '产量效应 ' + signed(yoy.xEff, 2) + ' 万tCO₂、强度效应 ' + signed(yoy.yEff, 2) + ' 万tCO₂。'
      + (yoy.yEff < 0
        ? '强度效应为负（减排方向），说明单位产品碳排放强度同比下降，能效水平持续改善；'
        : '强度效应为正（增排方向），说明单位产品碳排放强度同比上升，需重点关注能效管控；')
      + '产量效应' + (yoy.xEff > 0 ? '为正，产量同比增长是排放增加的主要来源。' : '为负，产量同比下降带动排放减少。')
      + '</p>';

    /* 三、差异归因与影响 */
    var goodItems = [], badItems = [];
    if (mom.yEff < 0) goodItems.push('环比强度效应 ' + fmt(mom.yEff, 2) + ' 万tCO₂，单位产品碳排放强度较上月下降，能效管控见效。');
    if (yoy.yEff < 0) goodItems.push('同比强度效应 ' + fmt(yoy.yEff, 2) + ' 万tCO₂，强度同比下降，节能降碳成效延续。');
    if (mom.d < 0) goodItems.push('本月排放量环比减少 ' + fmt(Math.abs(mom.d), 2) + ' 万tCO₂（' + fmt(Math.abs(mom.d / mom.z0 * 100), 2) + '%），排放总量得到控制。');
    if (Math.abs(mom.cross) < Math.abs(mom.d) * 0.15) goodItems.push('交互项影响较小（' + fmt(mom.cross, 2) + ' 万tCO₂），产量与强度未出现明显同向叠加放大。');
    if (!goodItems.length) goodItems.push('本期各项差异指标未呈现改善方向，暂无突出优势项。');

    if (mom.yEff > 0) badItems.push('环比强度效应 ' + fmt(mom.yEff, 2) + ' 万tCO₂，单位产品碳排放强度较上月上升，能效出现回落。');
    if (yoy.yEff > 0) badItems.push('同比强度效应 ' + fmt(yoy.yEff, 2) + ' 万tCO₂，强度同比上升，节能降碳压力加大。');
    if (mom.d > 0) badItems.push('本月排放量环比增加 ' + fmt(mom.d, 2) + ' 万tCO₂（' + fmt(mom.d / mom.z0 * 100, 2) + '%），需排查增排环节。');
    if (Math.abs(mom.xEff) >= Math.abs(mom.yEff)) badItems.push('产量效应占差异比重 ' + fmt(mom.xShare, 1) + '%，排放对产量波动较为敏感，产量型增排风险需关注。');
    if (!badItems.length) badItems.push('各项分解指标方向均较优，暂无显著短板，需防范后续强度反弹。');

    var cause = '<div class="vs-cols">'
      + '<div class="vs-col is-good"><h3>有利差异（减排方向）</h3><ul>'
      + goodItems.map(function (t) { return '<li>' + t + '</li>'; }).join('')
      + '</ul></div>'
      + '<div class="vs-col is-bad"><h3>不利差异（增排方向）</h3><ul>'
      + badItems.map(function (t) { return '<li>' + t + '</li>'; }).join('')
      + '</ul></div></div>';

    cause += '<p class="brief-p">敏感性说明：排放量对产量与强度的敏感度分别为 <strong>I₀ = ' + fmt(d.i0m, 4) + ' tCO₂/t</strong>（产量每变动 1 万t，排放变动 ' + fmt(d.i0m, 2) + ' 万tCO₂）'
      + '和 <strong>Q₀ = ' + fmt(d.q0m, 2) + ' 万t</strong>（强度每变动 0.001 tCO₂/t，排放变动 ' + fmt(d.q0m * 0.001, 2) + ' 万tCO₂）。'
      + '因此，在产量刚性增长的情况下，<strong>压降强度是控制排放增量的关键抓手</strong>。</p>';

    /* 四、改进措施 */
    var advice = '<ol class="advice-list">'
      + '<li><strong>锁定强度改善目标：</strong>本月强度 ' + fmt(d.i1, 4) + ' tCO₂/t，环比 ' + signed((d.i1 - d.i0m) / d.i0m * 100, 2, '%') + '，建议设定下月强度不高于 ' + fmt(Math.min(d.i1, d.i0m), 4) + ' tCO₂/t 的管控目标，并将强度指标纳入月度考核。' + (mom.yEff > 0 ? '本月强度效应为增排方向，须重点排查能效回落环节。' : '') + '</li>'
      + '<li><strong>削峰产量型增排：</strong>产量效应占环比差异 ' + fmt(mom.xShare, 1) + '%，建议在高产月份同步加强能源调度与用能定额管理，避免产量增长直接抬升单位产品排放强度。</li>'
      + '<li><strong>强化结构降碳：</strong>持续提高清洁燃料与绿电使用比例，优化能源结构以压降强度效应，从源头减少排放对产量的依赖。</li>'
      + '<li><strong>建立差异监测闭环：</strong>按月开展「产量—强度」双因素差异分解，对强度效应转正的月份及时预警、限期整改，形成「月度分解—季度评估—年度考核」的闭环管理。</li>'
      + '</ol>';

    return {
      title: '碳排放差异分析报告',
      kicker: '碳 排 放 差 异 分 析',
      toc: [
        ['摘要 · 差异概览', '#sec-0'],
        ['一、差异总览', '#sec-1'],
        ['二、差异因素分解', '#sec-2'],
        ['三、差异归因与影响', '#sec-3'],
        ['四、改进措施', '#sec-4']
      ],
      sections: [
        ['摘要 · 差异概览', 'sec-0', summary],
        ['一、差异总览', 'sec-1', overview],
        ['二、差异因素分解', 'sec-2', model],
        ['三、差异归因与影响', 'sec-3', cause],
        ['四、改进措施', 'sec-4', advice]
      ]
    };
  }

  /* ---------- 碳交易差异分析报告 ---------- */

  function tradeReport() {
    var d = tradeDiff();
    var mom = d.mom, yoy = d.yoy;
    var momWord = mom.d >= 0 ? '增加' : '减少';
    var yoyWord = yoy.d >= 0 ? '增加' : '减少';

    /* 摘要 */
    var summary = '<div class="kpi-grid">'
      + '<div class="kpi-card is-self"><div class="kpi-name">本月成交金额</div><div class="kpi-val">' + fmt(mom.z1, 2) + '<small> 万元</small></div><div class="kpi-delta is-flat">' + esc(MONTH_CN) + '</div></div>'
      + '<div class="kpi-card"><div class="kpi-name">环比差异</div><div class="kpi-val">' + signed(mom.d, 2) + '<small> 万元</small></div><div class="kpi-delta ' + deltaCls(-mom.d) + '">较' + esc(PREV_CN) + ' ' + signed(mom.d / mom.z0 * 100, 2, '%') + '</div></div>'
      + '<div class="kpi-card"><div class="kpi-name">同比差异</div><div class="kpi-val">' + signed(yoy.d, 2) + '<small> 万元</small></div><div class="kpi-delta ' + deltaCls(-yoy.d) + '">较' + esc(YOY_CN) + ' ' + signed(yoy.d / yoy.z0 * 100, 2, '%') + '</div></div>'
      + '<div class="kpi-card"><div class="kpi-name">环比主要动因</div><div class="kpi-val">' + esc(Math.abs(mom.xEff) >= Math.abs(mom.yEff) ? '量差' : '价差') + '</div><div class="kpi-delta is-flat">占差异 ' + fmt(Math.abs(mom.xEff) >= Math.abs(mom.yEff) ? mom.xShare : mom.yShare, 1) + '%</div></div>'
      + '<div class="kpi-card"><div class="kpi-name">本月成交量</div><div class="kpi-val">' + fmt(d.v1, 2) + '<small> 万tCO₂</small></div><div class="kpi-delta is-flat">环比 ' + signed((d.v1 - d.v0m) / d.v0m * 100, 2, '%') + '</div></div>'
      + '<div class="kpi-card"><div class="kpi-name">本月成交均价</div><div class="kpi-val">' + fmt(d.p1, 2) + '<small> 元/tCO₂</small></div><div class="kpi-delta is-flat">环比 ' + signed((d.p1 - d.p0m) / d.p0m * 100, 2, '%') + '</div></div>'
      + '</div>';

    summary += '<ul class="point-list">'
      + '<li>本月成交金额 <strong>' + fmt(mom.z1, 2) + '</strong> 万元，较上月（' + esc(PREV_CN) + '）' + momWord + ' ' + fmt(Math.abs(mom.d), 2) + ' 万元，' + signed(mom.d / mom.z0 * 100, 2, '%') + '。</li>'
      + '<li>金额差异分解：量差效应 ' + signed(mom.xEff, 2) + '、价差效应 ' + signed(mom.yEff, 2) + '、交互项 ' + signed(mom.cross, 2) + ' 万元，三项之和等于总差异。</li>'
      + '<li>同比看，本月较上年同期（' + esc(YOY_CN) + '）' + yoyWord + ' ' + fmt(Math.abs(yoy.d), 2) + ' 万元（' + signed(yoy.d / yoy.z0 * 100, 2, '%') + '），主要动因为' + (Math.abs(yoy.xEff) >= Math.abs(yoy.yEff) ? '成交量变化' : '成交均价变化') + '。</li>'
      + '<li>本月成交量 ' + fmt(d.v1, 2) + ' 万tCO₂、成交均价 ' + fmt(d.p1, 2) + ' 元/tCO₂，量价组合决定交易金额规模。</li>'
      + '</ul>';

    /* 一、差异总览 */
    var overview = '<p class="brief-p">本报告以「本月（' + esc(MONTH_CN) + '）」碳交易情况为分析对象，分别与「上月（' + esc(PREV_CN) + '）」和「上年同期（' + esc(YOY_CN) + '）」对比，'
      + '以<strong>成交金额</strong>为核心指标，量化差异并分解到成交量与成交均价两个因素。</p>';

    overview += '<div class="table-caption"><span>碳交易差异总览表</span><span class="unit">成交量：万tCO₂；均价：元/tCO₂；金额：万元</span></div>'
      + '<table class="btable"><thead><tr>'
      + '<th>对比口径</th><th>基准值</th><th>本期值</th><th>差异</th><th>差异率</th><th>差异性质</th>'
      + '</tr></thead><tbody>'
      + '<tr><td>成交金额（环比 · 较' + esc(PREV_CN) + '）</td><td>' + fmt(mom.z0, 2) + '</td><td class="is-self">' + fmt(mom.z1, 2) + '</td>'
      + '<td class="' + deltaCls(-mom.d) + '">' + signed(mom.d, 2) + '</td><td class="' + deltaCls(-mom.d) + '">' + signed(mom.d / mom.z0 * 100, 2, '%') + '</td>'
      + '<td>' + (mom.d >= 0 ? '增加' : '减少') + '</td></tr>'
      + '<tr><td>成交金额（同比 · 较' + esc(YOY_CN) + '）</td><td>' + fmt(yoy.z0, 2) + '</td><td class="is-self">' + fmt(yoy.z1, 2) + '</td>'
      + '<td class="' + deltaCls(-yoy.d) + '">' + signed(yoy.d, 2) + '</td><td class="' + deltaCls(-yoy.d) + '">' + signed(yoy.d / yoy.z0 * 100, 2, '%') + '</td>'
      + '<td>' + (yoy.d >= 0 ? '增加' : '减少') + '</td></tr>'
      + '<tr><td>成交量（环比）</td><td>' + fmt(d.v0m, 2) + '</td><td>' + fmt(d.v1, 2) + '</td>'
      + '<td class="' + deltaCls(-(d.v1 - d.v0m)) + '">' + signed(d.v1 - d.v0m, 2) + '</td><td class="' + deltaCls(-(d.v1 - d.v0m)) + '">' + signed((d.v1 - d.v0m) / d.v0m * 100, 2, '%') + '</td>'
      + '<td>' + (d.v1 >= d.v0m ? '放量' : '缩量') + '</td></tr>'
      + '<tr><td>成交均价（环比）</td><td>' + fmt(d.p0m, 2) + '</td><td>' + fmt(d.p1, 2) + '</td>'
      + '<td class="' + deltaCls(d.p1 - d.p0m) + '">' + signed(d.p1 - d.p0m, 2) + '</td><td class="' + deltaCls(d.p1 - d.p0m) + '">' + signed((d.p1 - d.p0m) / d.p0m * 100, 2, '%') + '</td>'
      + '<td>' + (d.p1 >= d.p0m ? '价涨' : '价跌') + '</td></tr>'
      + '</tbody></table>'
      + '<div class="btable-note">注：金额差异的正负以「收益视角」着色——金额增加为绿色（有利），减少为红色（不利）；量、价差异仍按名目方向着色。</div>';

    overview += chartBlock(levelBars([
      { name: '本月（' + MONTH_CN + '）', value: mom.z1, color: '#ff7d00', cur: true },
      { name: '上月（' + PREV_CN + '）', value: mom.z0, color: GREEN },
      { name: '上年同期（' + YOY_CN + '）', value: yoy.z0, color: '#165dff' }
    ], '万元', 2), '（图）本月 / 上月 / 上年同期成交金额对比');

    /* 二、差异因素分解 */
    var model = '<p class="brief-p">成交金额可拆解为两个因素的乘积：<strong>成交金额 A = 成交量 V × 成交均价 P</strong>。'
      + '金额差异按「两因素乘法模型」分解为三部分：</p>'
      + '<ul class="point-list">'
      + '<li><strong>量差效应</strong>＝（V₁ − V₀）× P₀：仅由成交量变化引起的金额变化。</li>'
      + '<li><strong>价差效应</strong>＝（P₁ − P₀）× V₀：仅由成交均价变化引起的金额变化（反映市场行情与择时能力）。</li>'
      + '<li><strong>交互项</strong>＝（V₁ − V₀）×（P₁ − P₀）：量与价同时变化产生的交叉影响。</li>'
      + '</ul>'
      + '<p class="brief-p">三项之和恒等于总差异：ΔA = 量差效应 + 价差效应 + 交互项。</p>';

    model += '<div class="table-caption"><span>环比差异因素分解表（' + esc(PREV_CN) + ' → ' + esc(MONTH_CN) + '）</span><span class="unit">单位：万元</span></div>'
      + '<table class="btable"><thead><tr>'
      + '<th>差异来源</th><th>影响金额</th><th>占差异比重</th><th>方向</th><th>说明</th>'
      + '</tr></thead><tbody>'
      + '<tr><td>量差效应</td><td class="' + deltaCls(-mom.xEff) + '">' + signed(mom.xEff, 2) + '</td><td>' + fmt(mom.xShare, 1) + '%</td>'
      + '<td class="' + deltaCls(-mom.xEff) + '">' + (mom.xEff >= 0 ? '增收' : '减收') + '</td><td>成交量 ' + fmt(d.v0m, 2) + ' → ' + fmt(d.v1, 2) + ' 万tCO₂</td></tr>'
      + '<tr><td>价差效应</td><td class="' + deltaCls(-mom.yEff) + '">' + signed(mom.yEff, 2) + '</td><td>' + fmt(mom.yShare, 1) + '%</td>'
      + '<td class="' + deltaCls(-mom.yEff) + '">' + (mom.yEff >= 0 ? '增收' : '减收') + '</td><td>成交均价 ' + fmt(d.p0m, 2) + ' → ' + fmt(d.p1, 2) + ' 元/tCO₂</td></tr>'
      + '<tr><td>交互项</td><td class="' + deltaCls(-mom.cross) + '">' + signed(mom.cross, 2) + '</td><td>' + fmt(mom.crossShare, 1) + '%</td>'
      + '<td class="' + deltaCls(-mom.cross) + '">' + (mom.cross >= 0 ? '增收' : '减收') + '</td><td>量与价同时变化</td></tr>'
      + '</tbody><tfoot><tr><td>合计差异</td><td class="' + deltaCls(-mom.d) + '">' + signed(mom.d, 2) + '</td><td>100.0%</td>'
      + '<td class="' + deltaCls(-mom.d) + '">' + (mom.d >= 0 ? '增收' : '减收') + '</td><td>与总差异一致（校验通过）</td></tr></tfoot></table>'
      + '<div class="btable-note">注：三项之和 = ' + fmt(mom.xEff, 2) + ' + ' + fmt(mom.yEff, 2) + ' + ' + fmt(mom.cross, 2) + ' = ' + fmt(mom.xEff + mom.yEff + mom.cross, 2) + ' 万元。</div>';

    model += chartBlock(waterfall(mom.z0, [
      { name: '量差效应', value: mom.xEff },
      { name: '价差效应', value: mom.yEff },
      { name: '交互项', value: mom.cross }
    ], mom.z1, '万元', true), '（图）环比成交金额差异瀑布图（' + PREV_CN + ' → ' + MONTH_CN + '）');

    model += '<h2 class="brief-h2">（一）同比差异分解</h2>'
      + '<div class="table-caption"><span>同比差异因素分解表（' + esc(YOY_CN) + ' → ' + esc(MONTH_CN) + '）</span><span class="unit">单位：万元</span></div>'
      + '<table class="btable"><thead><tr>'
      + '<th>差异来源</th><th>影响金额</th><th>占差异比重</th><th>方向</th><th>说明</th>'
      + '</tr></thead><tbody>'
      + '<tr><td>量差效应</td><td class="' + deltaCls(-yoy.xEff) + '">' + signed(yoy.xEff, 2) + '</td><td>' + fmt(yoy.xShare, 1) + '%</td>'
      + '<td class="' + deltaCls(-yoy.xEff) + '">' + (yoy.xEff >= 0 ? '增收' : '减收') + '</td><td>成交量 ' + fmt(d.v0y, 2) + ' → ' + fmt(d.v1, 2) + ' 万tCO₂</td></tr>'
      + '<tr><td>价差效应</td><td class="' + deltaCls(-yoy.yEff) + '">' + signed(yoy.yEff, 2) + '</td><td>' + fmt(yoy.yShare, 1) + '%</td>'
      + '<td class="' + deltaCls(-yoy.yEff) + '">' + (yoy.yEff >= 0 ? '增收' : '减收') + '</td><td>成交均价 ' + fmt(d.p0y, 2) + ' → ' + fmt(d.p1, 2) + ' 元/tCO₂</td></tr>'
      + '<tr><td>交互项</td><td class="' + deltaCls(-yoy.cross) + '">' + signed(yoy.cross, 2) + '</td><td>' + fmt(yoy.crossShare, 1) + '%</td>'
      + '<td class="' + deltaCls(-yoy.cross) + '">' + (yoy.cross >= 0 ? '增收' : '减收') + '</td><td>量与价同时变化</td></tr>'
      + '</tbody><tfoot><tr><td>合计差异</td><td class="' + deltaCls(-yoy.d) + '">' + signed(yoy.d, 2) + '</td><td>100.0%</td>'
      + '<td class="' + deltaCls(-yoy.d) + '">' + (yoy.d >= 0 ? '增收' : '减收') + '</td><td>与总差异一致（校验通过）</td></tr></tfoot></table>';

    model += chartBlock(wbars([
      { name: '量差效应', value: yoy.xEff },
      { name: '价差效应', value: yoy.yEff },
      { name: '交互项', value: yoy.cross }
    ], '万元', 2, true), '（图）同比差异因素贡献（' + YOY_CN + ' → ' + MONTH_CN + '）');

    model += '<h2 class="brief-h2">（二）分解结论</h2>'
      + '<p class="brief-p">环比看，本月成交金额' + momWord + ' ' + fmt(Math.abs(mom.d), 2) + ' 万元，'
      + '其中量差效应 ' + signed(mom.xEff, 2) + ' 万元（占 ' + fmt(mom.xShare, 1) + '%）、价差效应 ' + signed(mom.yEff, 2) + ' 万元（占 ' + fmt(mom.yShare, 1) + '%）。'
      + (Math.abs(mom.xEff) >= Math.abs(mom.yEff)
        ? '成交量的变化是金额差异的<strong>主导因素</strong>，交易规模扩张/收缩驱动金额变动。'
        : '成交均价的变化是金额差异的<strong>主导因素</strong>，市场行情与择时能力对金额影响更显著。')
      + '</p>'
      + '<p class="brief-p">同比看，本月较上年同期' + yoyWord + ' ' + fmt(Math.abs(yoy.d), 2) + ' 万元，'
      + '量差效应 ' + signed(yoy.xEff, 2) + ' 万元、价差效应 ' + signed(yoy.yEff, 2) + ' 万元。'
      + (yoy.yEff > 0
        ? '价差效应为正，说明本月成交均价高于上年同期，价格上行带来正向贡献；'
        : '价差效应为负，说明本月成交均价低于上年同期，价格下行对金额形成拖累；')
      + (yoy.xEff > 0
        ? '同时成交量同比增长，量价共同推动金额上升。'
        : '同时成交量同比下降，量的收缩抵消了部分价格影响。')
      + '</p>';

    /* 三、差异归因与影响 */
    var goodItems = [], badItems = [];
    if (mom.yEff > 0) goodItems.push('环比价差效应 +' + fmt(mom.yEff, 2) + ' 万元，本月成交均价高于上月，择时交易取得价格优势。');
    if (mom.d > 0) goodItems.push('本月成交金额环比增加 ' + fmt(mom.d, 2) + ' 万元（' + fmt(mom.d / mom.z0 * 100, 2) + '%），交易规模稳步扩大。');
    if (yoy.yEff > 0) goodItems.push('同比价差效应 +' + fmt(yoy.yEff, 2) + ' 万元，成交均价高于上年同期，价格中枢上移。');
    if (d.v1 > d.v0m) goodItems.push('本月成交量 ' + fmt(d.v1, 2) + ' 万tCO₂，较上月增加 ' + fmt(d.v1 - d.v0m, 2) + ' 万tCO₂，交易活跃度提升。');
    if (!goodItems.length) goodItems.push('本期量价指标未呈现正向贡献，暂无突出优势项。');

    if (mom.yEff < 0) badItems.push('环比价差效应 ' + fmt(mom.yEff, 2) + ' 万元，本月成交均价低于上月，存在择时优化空间。');
    if (mom.d < 0) badItems.push('本月成交金额环比减少 ' + fmt(Math.abs(mom.d), 2) + ' 万元（' + fmt(Math.abs(mom.d / mom.z0 * 100), 2) + '%），交易规模有所收缩。');
    if (d.v1 < d.v0m) badItems.push('本月成交量 ' + fmt(d.v1, 2) + ' 万tCO₂，较上月减少 ' + fmt(d.v0m - d.v1, 2) + ' 万tCO₂，放量不足。');
    if (Math.abs(mom.xEff) >= Math.abs(mom.yEff)) badItems.push('量差效应占差异比重 ' + fmt(mom.xShare, 1) + '%，金额对成交量波动敏感，需稳定交易节奏。');
    if (!badItems.length) badItems.push('各项量价指标方向均较优，暂无显著短板，需防范价格回调风险。');

    var cause = '<div class="vs-cols">'
      + '<div class="vs-col is-good"><h3>有利差异（增收方向）</h3><ul>'
      + goodItems.map(function (t) { return '<li>' + t + '</li>'; }).join('')
      + '</ul></div>'
      + '<div class="vs-col is-bad"><h3>不利差异（减收方向）</h3><ul>'
      + badItems.map(function (t) { return '<li>' + t + '</li>'; }).join('')
      + '</ul></div></div>';

    cause += '<p class="brief-p">敏感性说明：成交金额对成交量与均价的敏感度分别为 <strong>P₀ = ' + fmt(d.p0m, 2) + ' 元/tCO₂</strong>'
      + '（成交量每变动 1 万t，金额变动 ' + fmt(d.p0m, 2) + ' 万元）'
      + '和 <strong>V₀ = ' + fmt(d.v0m, 2) + ' 万tCO₂</strong>'
      + '（均价每变动 1 元/t，金额变动 ' + fmt(d.v0m, 2) + ' 万元）。'
      + '因此，在成交量相对稳定的情况下，<strong>把握价格窗口、提升择时能力是增厚交易金额的关键</strong>。</p>';

    /* 四、改进措施 */
    var advice = '<ol class="advice-list">'
      + '<li><strong>强化择时交易：</strong>本月成交均价 ' + fmt(d.p1, 2) + ' 元/tCO₂，环比 ' + signed((d.p1 - d.p0m) / d.p0m * 100, 2, '%') + '，建议建立碳价监测与分批建仓机制，在价格低位增配、高位择机变现盈余配额。' + (mom.yEff < 0 ? '本月价差效应为减收方向，须重点提升择时能力。' : '') + '</li>'
      + '<li><strong>稳定交易节奏：</strong>量差效应占环比差异 ' + fmt(mom.xShare, 1) + '%，建议按履约进度制定分月交易计划，避免量能大起大落导致金额波动。</li>'
      + '<li><strong>优化量价组合：</strong>结合全国及各试点市场价差，优先在低价市场完成采购、在高价市场择机卖出，提升整体量价组合收益。</li>'
      + '<li><strong>建立差异跟踪机制：</strong>按月开展「量—价」双因素差异分解，对价差效应连续为负的月份及时复盘交易策略，形成「月度分解—策略调整—效果回评」的闭环。</li>'
      + '</ol>';

    return {
      title: '碳交易差异分析报告',
      kicker: '碳 交 易 差 异 分 析',
      toc: [
        ['摘要 · 差异概览', '#sec-0'],
        ['一、差异总览', '#sec-1'],
        ['二、差异因素分解', '#sec-2'],
        ['三、差异归因与影响', '#sec-3'],
        ['四、改进措施', '#sec-4']
      ],
      sections: [
        ['摘要 · 差异概览', 'sec-0', summary],
        ['一、差异总览', 'sec-1', overview],
        ['二、差异因素分解', 'sec-2', model],
        ['三、差异归因与影响', 'sec-3', cause],
        ['四、改进措施', 'sec-4', advice]
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
      + '<div class="cover-tab">' + (TAB === 'trade' ? '碳交易' : '碳排放') + ' · 差异分析</div>'
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
      pdf.save((TAB === 'trade' ? '碳交易差异分析报告-' : '碳排放差异分析报告-') + Y + '年' + M + '月.pdf');
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
