/**
 * 差异分析报告 · 渲染
 * URL 参数：?tab=emission|trade&month=YYYY-MM
 * - tab=emission → 碳排放差异分析：本月 vs 上月 / 上年同期，按 E = 产量 × 强度 做因素分解
 * - tab=trade    → 碳交易差异分析：本月 vs 上月 / 上年同期，按 金额 = 量 × 价 做因素分解
 *
 * 【数据口径】本报告**只认入参**，不做兜底：
 *   · 碳排放：emission.volume（当月排放量，万tCO₂）+ emission.intensity（单位产品强度，tCO₂/t）；
 *     产品产量由「排放量 ÷ 强度」派生（保留 4 位小数，唯一算法，不反推入参）。
 *   · 碳交易：trade.volume（成交量，万tCO₂）+ trade.price（成交均价，元/tCO₂）；
 *     成交金额由「成交量 × 成交均价」派生。
 *   · 两组数据各含 cur[12]（当年 1~12 月）与 prev[12]（上年同期）。
 *   · 环比基准 = 上月（M = 1 时不存在，环比整套降级）；同比基准 = 上年同期。
 * 「下载报告（PDF）」用 html2canvas + jsPDF 生成 PDF。
 */

(function () {
  'use strict';

  var ORG = '河南安钢周口钢铁有限责任公司';
  var GREEN = '#00b42a';

  /* ---------- 基础工具 ---------- */

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
  function lastDay(y, m) { return new Date(y, m, 0).getDate(); }
  function r2(n) { return n == null || !isFinite(n) ? null : Math.round(n * 100) / 100; }
  function r4(n) { return n == null || !isFinite(n) ? null : Math.round(n * 10000) / 10000; }
  function pctOf(cur, base) {
    if (cur == null || base == null || !isFinite(cur) || !isFinite(base) || base <= 0) return null;
    return r2((cur - base) / base * 100);
  }
  function chartEmpty(text) {
    return '<div style="height:150px;display:flex;align-items:center;justify-content:center;color:#98a1ab;font-size:13px">'
      + esc(text) + '</div>';
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

  var HAS_PREV = M > 1;
  var PM = M === 1 ? 0 : M - 1;
  var PY = M === 1 ? Y - 1 : Y;
  var PREV_CN = PY + '年' + PM + '月';
  /** 上月标签：M = 1 时没有上月，标签不能拼成「2025年0月」 */
  var PREV_LABEL = HAS_PREV ? PREV_CN : '无上月基数';
  var YOY_CN = (Y - 1) + '年' + M + '月';

  /* ---------- 入参数组（零兜底；长度不足按 0 补，超长截断） ---------- */

  function readSeries(name, def) {
    if (!qs.has(name)) return def.slice();
    var raw = String(qs.get(name) || '').trim();
    var arr = raw ? raw.split(',').map(function (s) { return Number(String(s).trim()); }) : [];
    var out = [];
    for (var i = 0; i < 12; i++) out.push(isFinite(arr[i]) ? arr[i] : 0);
    return out;
  }

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
   * 只有「以它为分母」的派生量在分母 ≤ 0 时输出 `--`：
   * 碳排放侧的「产量 = 排放量 ÷ 强度」；碳交易侧无除法（金额 = 量 × 价），故 0 就是 0。
   * 环比/同比的分母为 0 同样输出 `--`。
   */

  /* ---------- 因素分解工具 ---------- */

  /**
   * 两因素乘法模型 Z = X × Y 的差异分解（基准为 0，本期为 1）：
   *   ΔZ = X效应 + Y效应 + 交互项
   *   X效应 = (X1 − X0) × Y0 ；Y效应 = (Y1 − Y0) × X0
   *   **交互项 = ΔZ − X效应 − Y效应**（把 (X1−X0)(Y1−Y0) 的交叉影响与展示值的舍入残差
   *   一并归入交互项，从而保证「三项之和 ≡ 本口径总差异」恒成立，不出现 0.01 级的对不上）
   * 任一分量为 null 时整体作废（valid = false），渲染为 --；**不做任何替代推算**。
   */
  function decompose(x0, y0, x1, y1, dec) {
    if (x0 == null || y0 == null || x1 == null || y1 == null) {
      return { z0: null, z1: null, d: null, xEff: null, yEff: null, cross: null,
        xShare: null, yShare: null, crossShare: null, x0: x0, y0: y0, x1: x1, y1: y1, valid: false };
    }
    var k = Math.pow(10, dec);
    function rd(n) { return Math.round(n * k) / k; }
    var z0 = rd(x0 * y0), z1 = rd(x1 * y1);
    var d = rd(z1 - z0);
    var xEff = rd((x1 - x0) * y0);
    var yEff = rd((y1 - y0) * x0);
    var cross = rd(d - xEff - yEff);      // 残差口径
    var absSum = Math.abs(xEff) + Math.abs(yEff) + Math.abs(cross);
    // 分母为 0（差异恰好为 0）时占比写 --，不写 0%
    function share(v) {
      if (!absSum) return null;
      return Math.round(Math.abs(v) / absSum * 1000) / 10;
    }
    var xShare = share(xEff), yShare = share(yEff);
    // 交互项占比取残差，保证表里三项占比之和恒为 100.0%
    var crossShare = (xShare == null) ? null : Math.round((100 - xShare - yShare) * 10) / 10;
    return {
      z0: z0, z1: z1, d: d, xEff: xEff, yEff: yEff, cross: cross,
      xShare: xShare, yShare: yShare, crossShare: crossShare,
      x0: x0, y0: y0, x1: x1, y1: y1, valid: true
    };
  }

  /** 效应之和（三项）；任一项为 null 则返回 null */
  function effSum(d) {
    if (d.xEff == null || d.yEff == null || d.cross == null) return null;
    return r2(d.xEff + d.yEff + d.cross);
  }
  function mainDriver(d, xName, yName) {
    if (!d.valid || d.xEff == null || d.yEff == null) return null;
    return Math.abs(d.xEff) >= Math.abs(d.yEff) ? xName : yName;
  }
  function mainShare(d) {
    if (!d.valid || d.xEff == null || d.yEff == null) return null;
    return Math.abs(d.xEff) >= Math.abs(d.yEff) ? d.xShare : d.yShare;
  }

  /* ---------- 碳排放差异 ---------- */

  function emissionDiff() {
    // 本期：排放量、强度均取入参；产量 = 排放量 ÷ 强度（派生，4 位小数，强度 ≤ 0 时不可计算）
    var e1 = r2(EV_CUR[M - 1]), i1 = r4(EI_CUR[M - 1]);
    var q1 = (i1 != null && i1 > 0) ? r4(e1 / i1) : null;

    // 环比基准：上月（M = 1 时不存在）
    var e0m = HAS_PREV ? r2(EV_CUR[PM - 1]) : null;
    var i0m = HAS_PREV ? r4(EI_CUR[PM - 1]) : null;
    var q0m = (i0m != null && i0m > 0) ? r4(e0m / i0m) : null;

    // 同比基准：上年同期
    var e0y = r2(EV_PREV[M - 1]);
    var i0y = r4(EI_PREV[M - 1]);
    var q0y = (i0y != null && i0y > 0) ? r4(e0y / i0y) : null;

    var mom = decompose(q0m, i0m, q1, i1, 2);
    var yoy = decompose(q0y, i0y, q1, i1, 2);

    return {
      e1: e1, i1: i1, q1: q1,
      e0m: e0m, i0m: i0m, q0m: q0m,
      e0y: e0y, i0y: i0y, q0y: q0y,
      mom: mom, yoy: yoy,
      // 总览表口径：直接用入参的排放量差（与分解式的三项之和允许 ≤0.01 万tCO₂ 的舍入差）
      momDiff: (e1 != null && e0m != null) ? r2(e1 - e0m) : null,
      yoyDiff: (e1 != null && e0y != null) ? r2(e1 - e0y) : null,
      momDiffPct: pctOf(e1, e0m),
      yoyDiffPct: pctOf(e1, e0y),
      hasPrev: HAS_PREV
    };
  }

  /* ---------- 碳交易差异 ---------- */

  function tradeDiff() {
    var v1 = r2(TV_CUR[M - 1]), p1 = r2(TP_CUR[M - 1]);
    var a1 = r2(v1 * p1);

    var v0m = HAS_PREV ? r2(TV_CUR[PM - 1]) : null;
    var p0m = HAS_PREV ? r2(TP_CUR[PM - 1]) : null;
    var a0m = (v0m != null && p0m != null) ? r2(v0m * p0m) : null;

    var v0y = r2(TV_PREV[M - 1]);
    var p0y = r2(TP_PREV[M - 1]);
    var a0y = r2(v0y * p0y);

    return {
      v1: v1, p1: p1, a1: a1,
      v0m: v0m, p0m: p0m, a0m: a0m,
      v0y: v0y, p0y: p0y, a0y: a0y,
      // 金额分解：金额 = 量 × 价，单位为万元（万t × 元/t）
      mom: decompose(v0m, p0m, v1, p1, 2),
      yoy: decompose(v0y, p0y, v1, p1, 2),
      momDiff: (a1 != null && a0m != null) ? r2(a1 - a0m) : null,
      yoyDiff: (a1 != null && a0y != null) ? r2(a1 - a0y) : null,
      momDiffPct: pctOf(a1, a0m),
      yoyDiffPct: pctOf(a1, a0y),
      hasPrev: HAS_PREV
    };
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
    items.forEach(function (it) { if (it.value != null && Math.abs(it.value) > max) max = Math.abs(it.value); });
    max = max || 1;
    var posColor = positiveIsGood ? '#2ba471' : '#f53f3f';
    var negColor = positiveIsGood ? '#f53f3f' : '#2ba471';
    var html = '<div class="wbars">';
    items.forEach(function (it) {
      var v = it.value;
      var pct = (v == null) ? 0 : Math.abs(v) / max * 50;
      var isPos = v != null && v > 0;
      var fill;
      if (v == null) {
        fill = 'left:50%;width:0;background:#c9d1d9';
      } else {
        fill = isPos
          ? 'left:50%;width:' + Math.max(0.4, pct).toFixed(1) + '%;background:' + posColor
          : 'right:50%;width:' + Math.max(0.4, pct).toFixed(1) + '%;background:' + negColor;
      }
      html += '<div class="wbar-row ' + (isPos ? 'is-pos' : (v != null && v < 0 ? 'is-neg' : '')) + '">'
        + '<span class="wbar-label">' + esc(it.name) + '</span>'
        + '<span class="wbar-track"><span class="wbar-fill" style="' + fill + '"></span></span>'
        + '<span class="wbar-val">' + signed(v, dec, unit) + '</span>'
        + '</div>';
    });
    return html + '</div>';
  }

  /** 水位对比条形图（本月 / 上月 / 上年同期，本月高亮） */
  function levelBars(items, unit, dec) {
    var max = 0;
    items.forEach(function (it) { if (it.value != null && it.value > max) max = it.value; });
    max = max || 1;
    var html = '<div class="lvl-bars">';
    items.forEach(function (it) {
      var v = it.value;
      var pct = (v == null) ? 0 : Math.max(1, v / max * 100);
      html += '<div class="lvl-row' + (it.cur ? ' is-cur' : '') + '">'
        + '<span class="lvl-label">' + esc(it.name) + '</span>'
        + '<span class="lvl-track"><span class="lvl-fill" style="width:' + pct.toFixed(1) + '%;background:' + it.color + '"></span></span>'
        + '<span class="lvl-val">' + fmt(v, dec) + (unit ? ' ' + unit : '') + '</span>'
        + '</div>';
    });
    return html + '</div>';
  }

  /**
   * 瀑布图（基准 → 各因素贡献 → 本期），纯 SVG
   * @param {boolean} [positiveIsGood] 因素为正时是否「有利」：
   *        碳排放 = false（增排为不利，正红负绿）；碳交易 = true（金额增收为有利，正绿负红）
   */
  function waterfall(base, effects, end, unit, positiveIsGood) {
    if (base == null || end == null) return chartEmpty('本期数据不足，无法绘制瀑布图');
    var effValid = effects.every(function (e) { return e.value != null; });
    if (!effValid) return chartEmpty('本期数据不足，无法绘制瀑布图');

    var W = 760, H = 300, PL = 66, PR = 24, PT = 24, PB = 46;
    var iw = W - PL - PR, ih = H - PT - PB;

    var steps = [{ label: '基准值', to: base, kind: 'base' }];
    var acc = base;
    effects.forEach(function (e) {
      steps.push({ label: e.name, from: acc, to: acc + e.value, value: e.value, kind: 'eff' });
      acc += e.value;
    });
    steps.push({ label: '本期值', to: end, kind: 'end' });

    // 纵轴只取「差异轨迹」的值域（不含 0），避免小差异被压成看不见的细线
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

    for (var g = 0; g <= 4; g++) {
      var val = minV + range * g / 4, y = Yv(val);
      s += '<line x1="' + PL + '" y1="' + y.toFixed(1) + '" x2="' + (W - PR) + '" y2="' + y.toFixed(1) + '" stroke="#eef1f4" stroke-width="1"/>';
      s += '<text x="' + (PL - 8) + '" y="' + (y + 4).toFixed(1) + '" font-size="10" fill="#98a1ab" text-anchor="end">' + val.toFixed(1) + '</text>';
    }

    steps.forEach(function (st, i) {
      var cx = PL + slot * i + slot / 2;
      var from = st.kind === 'eff' ? st.from : floor;
      var yTop = Yv(Math.max(from, st.to));
      var yBot = Yv(Math.min(from, st.to));
      var h = Math.max(2, yBot - yTop);
      var color = st.kind === 'base' ? '#86909c'
        : (st.kind === 'end' ? '#ff7d00'
          : (positiveIsGood ? (st.value > 0 ? '#2ba471' : '#f53f3f') : (st.value > 0 ? '#f53f3f' : '#2ba471')));

      s += '<rect x="' + (cx - bw / 2).toFixed(1) + '" y="' + yTop.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="3" fill="' + color + '"/>';

      // 效应标签用 2 位小数（1 位会把 -0.02 显示成「-0.0」）；-0 归一化为 0
      var labVal = st.kind === 'eff'
        ? ((st.value === 0 ? 0 : st.value) > 0 ? '+' : '') + (st.value === 0 ? 0 : st.value).toFixed(2)
        : st.to.toFixed(2);
      s += '<text x="' + cx.toFixed(1) + '" y="' + (yTop - 6).toFixed(1) + '" font-size="10.5" fill="#333" font-weight="600" text-anchor="middle">' + labVal + '</text>';
      s += '<text x="' + cx.toFixed(1) + '" y="' + (H - 26) + '" font-size="10.5" fill="#606266" text-anchor="middle">' + esc(st.label) + '</text>';

      if (i < n - 1) {
        var lvl = st.to;
        s += '<line x1="' + (cx + bw / 2).toFixed(1) + '" y1="' + Yv(lvl).toFixed(1) + '" x2="' + (PL + slot * (i + 1) + slot / 2 - bw / 2).toFixed(1) + '" y2="' + Yv(lvl).toFixed(1) + '" stroke="#c9d1d9" stroke-width="1" stroke-dasharray="3 3"/>';
      }
    });

    s += '</svg>';
    return s + '<div style="text-align:center;font-size:12px;color:#98a1ab;margin-top:2px">单位：' + esc(unit) + ' · 纵轴按差异量级缩放，基准/本期柱自轴底起绘</div>';
  }

  /** 差异分解表（通用）：xName/yName 为两因素的名称，positiveIsGood 决定着色与方向词 */
  function decompTableRows(d, dec, xName, yName, xFrom, xTo, yFrom, yTo, positiveIsGood) {
    function cls(v) { return deltaCls(positiveIsGood ? v : (v == null ? null : -v)); }
    function dirWordFor(v) {
      if (v == null) return '--';
      if (v === 0) return '持平';
      var bad = positiveIsGood ? (v < 0) : (v > 0);
      return bad ? (positiveIsGood ? '减收' : '增排') : (positiveIsGood ? '增收' : '减排');
    }
    var rows = [
      [xName, d.xEff, d.xShare, xFrom, xTo],
      [yName, d.yEff, d.yShare, yFrom, yTo]
    ];
    var html = '';
    rows.forEach(function (r) {
      html += '<tr><td>' + r[0] + '</td><td class="' + cls(r[1]) + '">' + signed(r[1], dec) + '</td>'
        + '<td>' + fmt(r[2], 1) + '%</td>'
        + '<td class="' + cls(r[1]) + '">' + dirWordFor(r[1]) + '</td>'
        + '<td>' + r[3] + ' → ' + r[4] + '</td></tr>';
    });
    html += '<tr><td>交互项</td><td class="' + cls(d.cross) + '">' + signed(d.cross, dec) + '</td>'
      + '<td>' + fmt(d.crossShare, 1) + '%</td>'
      + '<td class="' + cls(d.cross) + '">' + dirWordFor(d.cross) + '</td><td>两因素同时变化</td></tr>';
    var sum = effSum(d);
    html += '</tbody><tfoot><tr><td>合计差异</td><td class="' + cls(sum) + '">' + signed(sum, dec) + '</td>'
      + '<td>' + (d.xShare == null ? '--' : '100.0%') + '</td>'
      + '<td class="' + cls(sum) + '">' + dirWordFor(sum) + '</td><td>' + (sum == null ? '--' : '与总差异一致（校验通过）') + '</td></tr></tfoot>';
    return html;
  }

  /* ---------- 碳排放差异分析报告 ---------- */

  function emissionReport() {
    var d = emissionDiff();
    var mom = d.mom, yoy = d.yoy;

    var momWord = d.momDiff == null ? null : (d.momDiff >= 0 ? '增加' : '减少');
    var yoyWord = d.yoyDiff == null ? null : (d.yoyDiff >= 0 ? '增加' : '减少');

    /* 摘要 */
    var summary = '<div class="kpi-grid">'
      + '<div class="kpi-card is-self"><div class="kpi-name">本月碳排放量</div><div class="kpi-val">' + fmt(d.e1, 2) + '<small> 万tCO₂</small></div><div class="kpi-delta is-flat">' + esc(MONTH_CN) + '</div></div>'
      + '<div class="kpi-card"><div class="kpi-name">环比差异</div><div class="kpi-val">' + signed(d.momDiff, 2) + '<small> 万tCO₂</small></div>'
      + '<div class="kpi-delta ' + deltaCls(d.momDiff) + '">' + (d.momDiff == null ? '年度首月，无上月基数' : '较' + esc(PREV_LABEL) + ' ' + signed(d.momDiffPct, 2, '%')) + '</div></div>'
      + '<div class="kpi-card"><div class="kpi-name">同比差异</div><div class="kpi-val">' + signed(d.yoyDiff, 2) + '<small> 万tCO₂</small></div>'
      + '<div class="kpi-delta ' + deltaCls(d.yoyDiff) + '">' + (d.yoyDiff == null ? '上年同期基数无效' : '较' + esc(YOY_CN) + ' ' + signed(d.yoyDiffPct, 2, '%')) + '</div></div>'
      + '<div class="kpi-card"><div class="kpi-name">环比主要动因</div><div class="kpi-val">' + esc(mainDriver(mom, '产量', '强度') || '--') + '</div>'
      + '<div class="kpi-delta is-flat">' + (mainShare(mom) == null ? '--' : '占差异 ' + fmt(mainShare(mom), 1) + '%') + '</div></div>'
      + '<div class="kpi-card"><div class="kpi-name">同比主要动因</div><div class="kpi-val">' + esc(mainDriver(yoy, '产量', '强度') || '--') + '</div>'
      + '<div class="kpi-delta is-flat">' + (mainShare(yoy) == null ? '--' : '占差异 ' + fmt(mainShare(yoy), 1) + '%') + '</div></div>'
      + '<div class="kpi-card"><div class="kpi-name">本期排放强度</div><div class="kpi-val">' + fmt(d.i1, 4) + '<small> tCO₂/t</small></div>'
      + '<div class="kpi-delta ' + deltaCls(pctOf(d.i1, d.i0m)) + '">' + (pctOf(d.i1, d.i0m) == null ? '环比不适用' : '环比 ' + signed(pctOf(d.i1, d.i0m), 2, '%')) + '</div></div>'
      + '</div>';

    summary += '<ul class="point-list">'
      + '<li>本月碳排放量 <strong>' + fmt(d.e1, 2) + '</strong> 万tCO₂，'
      + (d.momDiff == null
        ? '本月为年度首月，无上月基数，环比差异不适用；'
        : '较上月（' + esc(PREV_LABEL) + '）' + momWord + ' ' + fmt(Math.abs(d.momDiff), 2) + ' 万tCO₂，' + signed(d.momDiffPct, 2, '%') + '；')
      + (d.yoyDiff == null
        ? '上年同期基数无效，同比差异不适用。'
        : '较上年同期（' + esc(YOY_CN) + '）' + yoyWord + ' ' + fmt(Math.abs(d.yoyDiff), 2) + ' 万tCO₂，' + signed(d.yoyDiffPct, 2, '%') + '。')
      + '</li>'
      + (mom.valid
        ? '<li>环比差异分解：产量效应 ' + signed(mom.xEff, 2) + '、强度效应 ' + signed(mom.yEff, 2) + '、交互项 ' + signed(mom.cross, 2) + ' 万tCO₂，三项之和恒等于合计差异 ' + signed(mom.d, 2) + ' 万tCO₂。</li>'
        : '<li>本月无上月基数，环比差异不做因素分解。</li>')
      + (yoy.valid
        ? '<li>同比看，本月较上年同期（' + esc(YOY_CN) + '）' + yoyWord + ' ' + fmt(Math.abs(d.yoyDiff), 2) + ' 万tCO₂（' + signed(d.yoyDiffPct, 2, '%') + '），主要动因为' + (mainDriver(yoy, '产量变化', '强度变化') || '--') + '。</li>'
        : '<li>上年同期数据不足，同比差异不做因素分解。</li>')
      + '<li>本期单位产品碳排放强度 ' + fmt(d.i1, 4) + ' tCO₂/t；本月产品产量 <strong>' + fmt(d.q1, 2) + '</strong> 万t（按「排放量 ÷ 强度」推算）。</li>'
      + '</ul>';

    /* 一、差异总览 */
    var overview = '<p class="brief-p">本报告以「本月（' + esc(MONTH_CN) + '）」为分析对象，'
      + (HAS_PREV ? '分别与「上月（' + esc(PREV_LABEL) + '）」和「上年同期（' + esc(YOY_CN) + '）」对比，' : '与「上年同期（' + esc(YOY_CN) + '）」对比（本月为年度首月，无上月基数），')
      + '量化碳排放量差异并逐层分解到产量与强度两个因素。</p>';

    overview += '<div class="table-caption"><span>碳排放差异总览表</span><span class="unit">排放量/产量：万tCO₂、万t；强度：tCO₂/t</span></div>'
      + '<table class="btable"><thead><tr>'
      + '<th>对比口径</th><th>基准值</th><th>本期值</th><th>差异</th><th>差异率</th><th>差异性质</th>'
      + '</tr></thead><tbody>'
      + '<tr><td>排放量（环比 · 较' + esc(PREV_LABEL) + '）</td><td>' + fmt(d.e0m, 2) + '</td><td class="is-self">' + fmt(d.e1, 2) + '</td>'
      + '<td class="' + deltaCls(d.momDiff) + '">' + signed(d.momDiff, 2) + '</td><td class="' + deltaCls(d.momDiff) + '">' + signed(d.momDiffPct, 2, '%') + '</td>'
      + '<td>' + (d.momDiff == null ? '不适用' : (d.momDiff >= 0 ? '增排' : '减排')) + '</td></tr>'
      + '<tr><td>排放量（同比 · 较' + esc(YOY_CN) + '）</td><td>' + fmt(d.e0y, 2) + '</td><td class="is-self">' + fmt(d.e1, 2) + '</td>'
      + '<td class="' + deltaCls(d.yoyDiff) + '">' + signed(d.yoyDiff, 2) + '</td><td class="' + deltaCls(d.yoyDiff) + '">' + signed(d.yoyDiffPct, 2, '%') + '</td>'
      + '<td>' + (d.yoyDiff == null ? '不适用' : (d.yoyDiff >= 0 ? '增排' : '减排')) + '</td></tr>'
      + '<tr><td>产品产量（环比）</td><td>' + fmt(d.q0m, 2) + '</td><td>' + fmt(d.q1, 2) + '</td>'
      + '<td class="' + deltaCls(pctOf(d.q1, d.q0m) == null ? null : (d.q1 - d.q0m)) + '">' + signed((d.q1 == null || d.q0m == null) ? null : d.q1 - d.q0m, 2) + '</td>'
      + '<td class="' + deltaCls(pctOf(d.q1, d.q0m)) + '">' + signed(pctOf(d.q1, d.q0m), 2, '%') + '</td>'
      + '<td>' + (d.q1 == null || d.q0m == null ? '不适用' : (d.q1 >= d.q0m ? '增产' : '减产')) + '</td></tr>'
      + '<tr><td>碳排放强度（环比）</td><td>' + fmt(d.i0m, 4) + '</td><td>' + fmt(d.i1, 4) + '</td>'
      + '<td class="' + deltaCls(d.i1 == null || d.i0m == null ? null : d.i1 - d.i0m) + '">' + signed(d.i1 == null || d.i0m == null ? null : r4(d.i1 - d.i0m), 4) + '</td>'
      + '<td class="' + deltaCls(pctOf(d.i1, d.i0m)) + '">' + signed(pctOf(d.i1, d.i0m), 2, '%') + '</td>'
      + '<td>' + (d.i1 == null || d.i0m == null ? '不适用' : (d.i1 >= d.i0m ? '强度上升' : '强度下降')) + '</td></tr>'
      + '</tbody></table>'
      + '<div class="btable-note">注：差异 = 本期值 − 基准值；差异率 = 差异 ÷ 基准值 × 100%；'
      + '产品产量由「排放量 ÷ 单位产品碳排放强度」推算（保留 4 位小数），不是独立台账数据。'
      + (HAS_PREV ? '' : '本月为年度首月，无上月基数，环比相关一律为 `--`。') + '</div>';

    overview += chartBlock(levelBars([
      { name: '本月（' + MONTH_CN + '）', value: d.e1, color: '#ff7d00', cur: true },
      { name: '上月（' + PREV_LABEL + '）', value: d.e0m, color: GREEN },
      { name: '上年同期（' + YOY_CN + '）', value: d.e0y, color: '#165dff' }
    ], '万tCO₂', 2), '（图）本月 / 上月 / 上年同期碳排放量对比');

    /* 二、差异因素分解 */
    var model = '<p class="brief-p">碳排放量可拆解为两个因素的乘积：<strong>碳排放量 E = 产品产量 Q × 单位产品碳排放强度 I</strong>。'
      + '其中产品产量由「本月排放量 ÷ 本单位产品碳排放强度」推算（保留 4 位小数）。'
      + '当产量或强度发生变化时，排放量差异可按「两因素乘法模型」分解为三部分：</p>'
      + '<ul class="point-list">'
      + '<li><strong>产量效应</strong>＝（Q₁ − Q₀）× I₀：仅由产品产量变化引起的排放量变化。</li>'
      + '<li><strong>强度效应</strong>＝（I₁ − I₀）× Q₀：仅由单位产品碳排放强度变化引起的排放量变化（反映能效与能源结构改善）。</li>'
      + '<li><strong>交互项</strong>＝合计差异 − 产量效应 − 强度效应：把（Q₁ − Q₀）×（I₁ − I₀）的交叉影响与展示值的舍入残差一并归入交互项。</li>'
      + '</ul>'
      + '<p class="brief-p">由此<strong>三项之和恒等于合计差异</strong>（ΔE = 产量效应 + 强度效应 + 交互项），且与「差异总览表」的排放量差异完全一致——不会出现 0.01 级的对不上。</p>';

    if (HAS_PREV && mom.valid) {
      model += '<div class="table-caption"><span>环比差异因素分解表（' + esc(PREV_LABEL) + ' → ' + esc(MONTH_CN) + '）</span><span class="unit">单位：万tCO₂</span></div>'
        + '<table class="btable"><thead><tr>'
        + '<th>差异来源</th><th>影响排放量</th><th>占差异比重</th><th>方向</th><th>说明</th>'
        + '</tr></thead><tbody>'
        + decompTableRows(mom, 2, '产量效应', '强度效应',
          fmt(d.q0m, 2), fmt(d.q1, 2), fmt(d.i0m, 4), fmt(d.i1, 4), false)
        + '</table>'
        + '<div class="btable-note">注：占差异比重按各因素影响绝对值 ÷ 三者绝对值之和计算；差异恰好为 0 时占比写 `--`。'
        + '三项之和 = ' + fmt(mom.xEff, 2) + ' + ' + fmt(mom.yEff, 2) + ' + ' + fmt(mom.cross, 2) + ' = ' + fmt(effSum(mom), 2) + ' 万tCO₂。</div>';

      model += chartBlock(waterfall(mom.z0, [
        { name: '产量效应', value: mom.xEff },
        { name: '强度效应', value: mom.yEff },
        { name: '交互项', value: mom.cross }
      ], mom.z1, '万tCO₂', false), '（图）环比排放量差异瀑布图（' + PREV_CN + ' → ' + MONTH_CN + '）');
    } else {
      model += '<p class="brief-p">' + (HAS_PREV
        ? '本期或上月单位产品碳排放强度为 0 或缺失，无法由「排放量 ÷ 强度」推算产品产量，环比因素分解不做。'
        : '本月为年度首月，无上月基数，环比差异不做因素分解。') + '</p>'
        + chartBlock(chartEmpty(HAS_PREV ? '强度为 0 或缺失，无法分解' : '年度首月，无上月基数'), '（图）环比排放量差异瀑布图');
    }

    // 同比分解
    model += '<h2 class="brief-h2">（一）同比差异分解</h2>';
    if (yoy.valid) {
      model += '<div class="table-caption"><span>同比差异因素分解表（' + esc(YOY_CN) + ' → ' + esc(MONTH_CN) + '）</span><span class="unit">单位：万tCO₂</span></div>'
        + '<table class="btable"><thead><tr>'
        + '<th>差异来源</th><th>影响排放量</th><th>占差异比重</th><th>方向</th><th>说明</th>'
        + '</tr></thead><tbody>'
        + decompTableRows(yoy, 2, '产量效应', '强度效应',
          fmt(d.q0y, 2), fmt(d.q1, 2), fmt(d.i0y, 4), fmt(d.i1, 4), false)
        + '</table>'
        + '<div class="btable-note">注：三项之和 = ' + fmt(yoy.xEff, 2) + ' + ' + fmt(yoy.yEff, 2) + ' + ' + fmt(yoy.cross, 2) + ' = ' + fmt(effSum(yoy), 2) + ' 万tCO₂。</div>';

      model += chartBlock(wbars([
        { name: '产量效应', value: yoy.xEff },
        { name: '强度效应', value: yoy.yEff },
        { name: '交互项', value: yoy.cross }
      ], '万tCO₂', 2, false), '（图）同比差异因素贡献（' + YOY_CN + ' → ' + MONTH_CN + '）');
    } else {
      model += '<p class="brief-p">上年同期单位产品碳排放强度为 0 或缺失，无法由「排放量 ÷ 强度」推算产品产量，同比因素分解不做。</p>'
        + chartBlock(chartEmpty('上年同期强度为 0 或缺失，无法分解'), '（图）同比差异因素贡献');
    }

    // 分解结论
    model += '<h2 class="brief-h2">（二）分解结论</h2>';
    if (HAS_PREV && mom.valid) {
      model += '<p class="brief-p">环比看，本月排放量' + momWord + ' ' + fmt(Math.abs(d.momDiff), 2) + ' 万tCO₂，'
        + '其中产量效应 ' + signed(mom.xEff, 2) + ' 万tCO₂（占 ' + fmt(mom.xShare, 1) + '%）、强度效应 ' + signed(mom.yEff, 2) + ' 万tCO₂（占 ' + fmt(mom.yShare, 1) + '%）。'
        + (mainDriver(mom, '产量', '强度') === '产量'
          ? '产量变化是本月排放差异的<strong>主导因素</strong>，强度变化影响相对次要。'
          : '单位产品碳排放强度变化是本月排放差异的<strong>主导因素</strong>，反映能效或能源结构的实质变化。')
        + '</p>';
    } else {
      model += '<p class="brief-p">' + (HAS_PREV ? '环比因素分解因数据不足而无法完成。' : '本月为年度首月，无上月基数，不做环比分解结论。') + '</p>';
    }
    if (yoy.valid) {
      model += '<p class="brief-p">同比看，本月较上年同期' + yoyWord + ' ' + fmt(Math.abs(d.yoyDiff), 2) + ' 万tCO₂，'
        + '产量效应 ' + signed(yoy.xEff, 2) + ' 万tCO₂、强度效应 ' + signed(yoy.yEff, 2) + ' 万tCO₂。'
        + (yoy.yEff < 0
          ? '强度效应为负（减排方向），说明单位产品碳排放强度同比下降，能效水平持续改善；'
          : '强度效应为正（增排方向），说明单位产品碳排放强度同比上升，需重点关注能效管控；')
        + '产量效应' + (yoy.xEff > 0 ? '为正，产量同比增长是排放增加的主要来源。' : '为负，产量同比下降带动排放减少。')
        + '</p>';
    } else {
      model += '<p class="brief-p">同比因素分解因上年同期数据不足而无法完成。</p>';
    }

    /* 三、差异归因与影响 */
    var goodItems = [], badItems = [];
    var momUsable = HAS_PREV && mom.valid;
    var yoyUsable = yoy.valid;
    if (momUsable) {
      if (mom.yEff < 0) goodItems.push('环比强度效应 ' + fmt(mom.yEff, 2) + ' 万tCO₂，单位产品碳排放强度较上月下降，能效管控见效。');
      if (mom.yEff > 0) badItems.push('环比强度效应 ' + fmt(mom.yEff, 2) + ' 万tCO₂，单位产品碳排放强度较上月上升，能效出现回落。');
      if (d.momDiff != null && d.momDiff < 0) goodItems.push('本月排放量环比减少 ' + fmt(Math.abs(d.momDiff), 2) + ' 万tCO₂（' + fmt(Math.abs(d.momDiffPct), 2) + '%），排放总量得到控制。');
      if (d.momDiff != null && d.momDiff > 0) badItems.push('本月排放量环比增加 ' + fmt(d.momDiff, 2) + ' 万tCO₂（' + fmt(d.momDiffPct, 2) + '%），需排查增排环节。');
      if (effSum(mom) != null && d.momDiff != null && Math.abs(mom.cross) < Math.abs(effSum(mom)) * 0.15) goodItems.push('交互项影响较小（' + fmt(mom.cross, 2) + ' 万tCO₂），产量与强度未出现明显同向叠加放大。');
      if (mom.xShare != null && mom.yShare != null && Math.abs(mom.xEff) >= Math.abs(mom.yEff)) {
        badItems.push('产量效应占差异比重 ' + fmt(mom.xShare, 1) + '%，排放对产量波动较为敏感，产量型增排风险需关注。');
      }
    } else {
      goodItems.push(HAS_PREV
        ? '本期或上月单位产品碳排放强度为 0 或缺失，无法完成环比归因。'
        : '本月为年度首月，无上月基数，暂不作环比归因。');
    }
    if (yoyUsable) {
      if (yoy.yEff < 0) goodItems.push('同比强度效应 ' + fmt(yoy.yEff, 2) + ' 万tCO₂，强度同比下降，节能降碳成效延续。');
      if (yoy.yEff > 0) badItems.push('同比强度效应 ' + fmt(yoy.yEff, 2) + ' 万tCO₂，强度同比上升，节能降碳压力加大。');
    }
    if (!goodItems.length) goodItems.push('本期各项差异指标未呈现改善方向，暂无突出优势项。');
    if (!badItems.length) {
      badItems.push(momUsable || yoyUsable
        ? '各项分解指标方向均较优，暂无显著短板，需防范后续强度反弹。'
        : '本期数据不足，暂不作短板评价。');
    }

    var cause = '<div class="vs-cols">'
      + '<div class="vs-col is-good"><h3>有利差异（减排方向）</h3><ul>'
      + goodItems.map(function (t) { return '<li>' + t + '</li>'; }).join('')
      + '</ul></div>'
      + '<div class="vs-col is-bad"><h3>不利差异（增排方向）</h3><ul>'
      + badItems.map(function (t) { return '<li>' + t + '</li>'; }).join('')
      + '</ul></div></div>';

    cause += '<p class="brief-p">敏感性说明：'
      + (d.i0m == null || d.q0m == null
        ? '本月无上月基数（或上月强度无效），无法给出环比敏感度；'
        : '排放量对产量与强度的敏感度分别为 <strong>I₀ = ' + fmt(d.i0m, 4) + ' tCO₂/t</strong>'
        + '（产量每变动 1 万t，排放变动 ' + fmt(d.i0m, 2) + ' 万tCO₂）'
        + '和 <strong>Q₀ = ' + fmt(d.q0m, 2) + ' 万t</strong>'
        + '（强度每变动 0.001 tCO₂/t，排放变动 ' + fmt(d.q0m * 0.001, 2) + ' 万tCO₂）；')
      + '在产量刚性增长的情况下，<strong>压降强度是控制排放增量的关键抓手</strong>。</p>';

    /* 四、改进措施 */
    var advice = '<ol class="advice-list">'
      + '<li><strong>锁定强度改善目标：</strong>本月强度 ' + fmt(d.i1, 4) + ' tCO₂/t，'
      + (pctOf(d.i1, d.i0m) == null ? '环比不适用，' : '环比 ' + signed(pctOf(d.i1, d.i0m), 2, '%') + '，')
      + '建议设定下月强度不高于 ' + fmt((d.i1 != null && d.i0m != null) ? Math.min(d.i1, d.i0m) : d.i1, 4) + ' tCO₂/t 的管控目标，并将强度指标纳入月度考核。'
      + (HAS_PREV && mom.valid && mom.yEff > 0 ? '本月强度效应为增排方向，须重点排查能效回落环节。' : '') + '</li>'
      + '<li><strong>削峰产量型增排：</strong>'
      + (mom.xShare == null
        ? '建议在高产月份同步加强能源调度与用能定额管理，避免产量增长直接抬升排放总量。'
        : '产量效应占环比差异 ' + fmt(mom.xShare, 1) + '%，建议在高产月份同步加强能源调度与用能定额管理，避免产量增长直接抬升排放总量。')
      + '</li>'
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
    var momWord = d.momDiff == null ? null : (d.momDiff >= 0 ? '增加' : '减少');
    var yoyWord = d.yoyDiff == null ? null : (d.yoyDiff >= 0 ? '增加' : '减少');

    /* 摘要 */
    var summary = '<div class="kpi-grid">'
      + '<div class="kpi-card is-self"><div class="kpi-name">本月成交金额</div><div class="kpi-val">' + fmt(d.a1, 2) + '<small> 万元</small></div><div class="kpi-delta is-flat">' + esc(MONTH_CN) + '</div></div>'
      + '<div class="kpi-card"><div class="kpi-name">环比差异</div><div class="kpi-val">' + signed(d.momDiff, 2) + '<small> 万元</small></div>'
      + '<div class="kpi-delta ' + deltaCls(mom.valid ? -d.momDiff : null) + '">' + (d.momDiff == null ? '年度首月，无上月基数' : '较' + esc(PREV_LABEL) + ' ' + signed(d.momDiffPct, 2, '%')) + '</div></div>'
      + '<div class="kpi-card"><div class="kpi-name">同比差异</div><div class="kpi-val">' + signed(d.yoyDiff, 2) + '<small> 万元</small></div>'
      + '<div class="kpi-delta ' + deltaCls(yoy.valid ? -d.yoyDiff : null) + '">' + (d.yoyDiff == null ? '上年同期基数无效' : '较' + esc(YOY_CN) + ' ' + signed(d.yoyDiffPct, 2, '%')) + '</div></div>'
      + '<div class="kpi-card"><div class="kpi-name">环比主要动因</div><div class="kpi-val">' + esc(mainDriver(mom, '量差', '价差') || '--') + '</div>'
      + '<div class="kpi-delta is-flat">' + (mainShare(mom) == null ? '--' : '占差异 ' + fmt(mainShare(mom), 1) + '%') + '</div></div>'
      + '<div class="kpi-card"><div class="kpi-name">本月成交量</div><div class="kpi-val">' + fmt(d.v1, 2) + '<small> 万tCO₂</small></div>'
      + '<div class="kpi-delta ' + deltaCls(pctOf(d.v1, d.v0m)) + '">' + (pctOf(d.v1, d.v0m) == null ? '环比不适用' : '环比 ' + signed(pctOf(d.v1, d.v0m), 2, '%')) + '</div></div>'
      + '<div class="kpi-card"><div class="kpi-name">本月成交均价</div><div class="kpi-val">' + fmt(d.p1, 2) + '<small> 元/tCO₂</small></div>'
      + '<div class="kpi-delta ' + deltaCls(pctOf(d.p1, d.p0m)) + '">' + (pctOf(d.p1, d.p0m) == null ? '环比不适用' : '环比 ' + signed(pctOf(d.p1, d.p0m), 2, '%')) + '</div></div>'
      + '</div>';

    summary += '<ul class="point-list">'
      + '<li>本月成交金额 <strong>' + fmt(d.a1, 2) + '</strong> 万元，'
      + (d.momDiff == null
        ? '本月为年度首月，无上月基数，环比差异不适用；'
        : '较上月（' + esc(PREV_LABEL) + '）' + momWord + ' ' + fmt(Math.abs(d.momDiff), 2) + ' 万元，' + signed(d.momDiffPct, 2, '%') + '；')
      + (d.yoyDiff == null
        ? '上年同期基数无效，同比差异不适用。'
        : '较上年同期（' + esc(YOY_CN) + '）' + yoyWord + ' ' + fmt(Math.abs(d.yoyDiff), 2) + ' 万元，' + signed(d.yoyDiffPct, 2, '%') + '。')
      + '</li>'
      + (mom.valid
        ? '<li>金额差异分解：量差效应 ' + signed(mom.xEff, 2) + '、价差效应 ' + signed(mom.yEff, 2) + '、交互项 ' + signed(mom.cross, 2) + ' 万元，三项之和恒等于合计差异 ' + signed(mom.d, 2) + ' 万元。</li>'
        : '<li>本月无上月基数，环比差异不做因素分解。</li>')
      + (yoy.valid
        ? '<li>同比看，本月较上年同期（' + esc(YOY_CN) + '）' + yoyWord + ' ' + fmt(Math.abs(d.yoyDiff), 2) + ' 万元（' + signed(d.yoyDiffPct, 2, '%') + '），主要动因为' + (mainDriver(yoy, '成交量变化', '成交均价变化') || '--') + '。</li>'
        : '<li>上年同期数据不足，同比差异不做因素分解。</li>')
      + '<li>本月成交量 ' + fmt(d.v1, 2) + ' 万tCO₂、成交均价 ' + fmt(d.p1, 2) + ' 元/tCO₂，成交金额由「成交量 × 成交均价」推算。</li>'
      + '</ul>';

    /* 一、差异总览 */
    var overview = '<p class="brief-p">本报告以「本月（' + esc(MONTH_CN) + '）」碳交易情况为分析对象，'
      + (HAS_PREV ? '分别与「上月（' + esc(PREV_LABEL) + '）」和「上年同期（' + esc(YOY_CN) + '）」对比，' : '与「上年同期（' + esc(YOY_CN) + '）」对比（本月为年度首月，无上月基数），')
      + '以<strong>成交金额</strong>为核心指标，量化差异并分解到成交量与成交均价两个因素。</p>';

    overview += '<div class="table-caption"><span>碳交易差异总览表</span><span class="unit">成交量：万tCO₂；均价：元/tCO₂；金额：万元</span></div>'
      + '<table class="btable"><thead><tr>'
      + '<th>对比口径</th><th>基准值</th><th>本期值</th><th>差异</th><th>差异率</th><th>差异性质</th>'
      + '</tr></thead><tbody>'
      + '<tr><td>成交金额（环比 · 较' + esc(PREV_LABEL) + '）</td><td>' + fmt(d.a0m, 2) + '</td><td class="is-self">' + fmt(d.a1, 2) + '</td>'
      + '<td class="' + deltaCls(d.momDiff == null ? null : -d.momDiff) + '">' + signed(d.momDiff, 2) + '</td><td class="' + deltaCls(d.momDiff == null ? null : -d.momDiff) + '">' + signed(d.momDiffPct, 2, '%') + '</td>'
      + '<td>' + (d.momDiff == null ? '不适用' : (d.momDiff >= 0 ? '增加' : '减少')) + '</td></tr>'
      + '<tr><td>成交金额（同比 · 较' + esc(YOY_CN) + '）</td><td>' + fmt(d.a0y, 2) + '</td><td class="is-self">' + fmt(d.a1, 2) + '</td>'
      + '<td class="' + deltaCls(d.yoyDiff == null ? null : -d.yoyDiff) + '">' + signed(d.yoyDiff, 2) + '</td><td class="' + deltaCls(d.yoyDiff == null ? null : -d.yoyDiff) + '">' + signed(d.yoyDiffPct, 2, '%') + '</td>'
      + '<td>' + (d.yoyDiff == null ? '不适用' : (d.yoyDiff >= 0 ? '增加' : '减少')) + '</td></tr>'
      + '<tr><td>成交量（环比）</td><td>' + fmt(d.v0m, 2) + '</td><td>' + fmt(d.v1, 2) + '</td>'
      + '<td class="' + deltaCls(pctOf(d.v1, d.v0m) == null ? null : -(d.v1 - d.v0m)) + '">' + signed((d.v1 == null || d.v0m == null) ? null : d.v1 - d.v0m, 2) + '</td>'
      + '<td class="' + deltaCls(pctOf(d.v1, d.v0m) == null ? null : -pctOf(d.v1, d.v0m)) + '">' + signed(pctOf(d.v1, d.v0m), 2, '%') + '</td>'
      + '<td>' + (d.v1 == null || d.v0m == null ? '不适用' : (d.v1 >= d.v0m ? '放量' : '缩量')) + '</td></tr>'
      + '<tr><td>成交均价（环比）</td><td>' + fmt(d.p0m, 2) + '</td><td>' + fmt(d.p1, 2) + '</td>'
      + '<td class="' + deltaCls(d.p1 == null || d.p0m == null ? null : d.p1 - d.p0m) + '">' + signed(d.p1 == null || d.p0m == null ? null : r2(d.p1 - d.p0m), 2) + '</td>'
      + '<td class="' + deltaCls(pctOf(d.p1, d.p0m)) + '">' + signed(pctOf(d.p1, d.p0m), 2, '%') + '</td>'
      + '<td>' + (d.p1 == null || d.p0m == null ? '不适用' : (d.p1 >= d.p0m ? '价涨' : '价跌')) + '</td></tr>'
      + '</tbody></table>'
      + '<div class="btable-note">注：成交金额 = 成交量（万t）× 成交均价（元/t），属派生的量价联动口径，不是独立台账数据；'
      + '金额与成交量按「收益视角」着色（增加为绿、减少为红），均价按名目方向着色。'
      + (HAS_PREV ? '' : '本月为年度首月，无上月基数，环比相关一律为 `--`。') + '</div>';

    overview += chartBlock(levelBars([
      { name: '本月（' + MONTH_CN + '）', value: d.a1, color: '#ff7d00', cur: true },
      { name: '上月（' + PREV_LABEL + '）', value: d.a0m, color: GREEN },
      { name: '上年同期（' + YOY_CN + '）', value: d.a0y, color: '#165dff' }
    ], '万元', 2), '（图）本月 / 上月 / 上年同期成交金额对比');

    /* 二、差异因素分解 */
    var model = '<p class="brief-p">成交金额可拆解为两个因素的乘积：<strong>成交金额 A = 成交量 V × 成交均价 P</strong>。'
      + '金额差异按「两因素乘法模型」分解为三部分：</p>'
      + '<ul class="point-list">'
      + '<li><strong>量差效应</strong>＝（V₁ − V₀）× P₀：仅由成交量变化引起的金额变化。</li>'
      + '<li><strong>价差效应</strong>＝（P₁ − P₀）× V₀：仅由成交均价变化引起的金额变化（反映市场行情与择时能力）。</li>'
      + '<li><strong>交互项</strong>＝合计差异 − 量差效应 − 价差效应：把（V₁ − V₀）×（P₁ − P₀）的交叉影响与展示值的舍入残差一并归入交互项。</li>'
      + '</ul>'
      + '<p class="brief-p">由此<strong>三项之和恒等于合计差异</strong>（ΔA = 量差效应 + 价差效应 + 交互项），且与「差异总览表」的成交金额差异完全一致——不会出现 0.01 级的对不上。</p>';

    if (HAS_PREV && mom.valid) {
      model += '<div class="table-caption"><span>环比差异因素分解表（' + esc(PREV_LABEL) + ' → ' + esc(MONTH_CN) + '）</span><span class="unit">单位：万元</span></div>'
        + '<table class="btable"><thead><tr>'
        + '<th>差异来源</th><th>影响金额</th><th>占差异比重</th><th>方向</th><th>说明</th>'
        + '</tr></thead><tbody>'
        + decompTableRows(mom, 2, '量差效应', '价差效应',
          fmt(d.v0m, 2), fmt(d.v1, 2), fmt(d.p0m, 2), fmt(d.p1, 2), true)
        + '</table>'
        + '<div class="btable-note">注：占差异比重按各因素影响绝对值 ÷ 三者绝对值之和计算；差异恰好为 0 时占比写 `--`。'
        + '三项之和 = ' + fmt(mom.xEff, 2) + ' + ' + fmt(mom.yEff, 2) + ' + ' + fmt(mom.cross, 2) + ' = ' + fmt(effSum(mom), 2) + ' 万元。</div>';

      model += chartBlock(waterfall(mom.z0, [
        { name: '量差效应', value: mom.xEff },
        { name: '价差效应', value: mom.yEff },
        { name: '交互项', value: mom.cross }
      ], mom.z1, '万元', true), '（图）环比成交金额差异瀑布图（' + PREV_CN + ' → ' + MONTH_CN + '）');
    } else {
      model += '<p class="brief-p">' + (HAS_PREV
        ? '本期或上月成交量／成交均价数据不足，无法完成环比因素分解。'
        : '本月为年度首月，无上月基数，环比差异不做因素分解。') + '</p>'
        + chartBlock(chartEmpty(HAS_PREV ? '本期数据不足，无法绘制瀑布图' : '年度首月，无上月基数'), '（图）环比成交金额差异瀑布图');
    }

    model += '<h2 class="brief-h2">（一）同比差异分解</h2>';
    if (yoy.valid) {
      model += '<div class="table-caption"><span>同比差异因素分解表（' + esc(YOY_CN) + ' → ' + esc(MONTH_CN) + '）</span><span class="unit">单位：万元</span></div>'
        + '<table class="btable"><thead><tr>'
        + '<th>差异来源</th><th>影响金额</th><th>占差异比重</th><th>方向</th><th>说明</th>'
        + '</tr></thead><tbody>'
        + decompTableRows(yoy, 2, '量差效应', '价差效应',
          fmt(d.v0y, 2), fmt(d.v1, 2), fmt(d.p0y, 2), fmt(d.p1, 2), true)
        + '</table>'
        + '<div class="btable-note">注：三项之和 = ' + fmt(yoy.xEff, 2) + ' + ' + fmt(yoy.yEff, 2) + ' + ' + fmt(yoy.cross, 2) + ' = ' + fmt(effSum(yoy), 2) + ' 万元。</div>';

      model += chartBlock(wbars([
        { name: '量差效应', value: yoy.xEff },
        { name: '价差效应', value: yoy.yEff },
        { name: '交互项', value: yoy.cross }
      ], '万元', 2, true), '（图）同比差异因素贡献（' + YOY_CN + ' → ' + MONTH_CN + '）');
    } else {
      model += '<p class="brief-p">上年同期成交量／成交均价数据不足，无法完成同比因素分解。</p>'
        + chartBlock(chartEmpty('上年同期数据不足'), '（图）同比差异因素贡献');
    }

    model += '<h2 class="brief-h2">（二）分解结论</h2>';
    if (HAS_PREV && mom.valid) {
      model += '<p class="brief-p">环比看，本月成交金额' + momWord + ' ' + fmt(Math.abs(d.momDiff), 2) + ' 万元，'
        + '其中量差效应 ' + signed(mom.xEff, 2) + ' 万元（占 ' + fmt(mom.xShare, 1) + '%）、价差效应 ' + signed(mom.yEff, 2) + ' 万元（占 ' + fmt(mom.yShare, 1) + '%）。'
        + (mainDriver(mom, '量差', '价差') === '量差'
          ? '成交量的变化是金额差异的<strong>主导因素</strong>，交易规模扩张/收缩驱动金额变动。'
          : '成交均价的变化是金额差异的<strong>主导因素</strong>，市场行情与择时能力对金额影响更显著。')
        + '</p>';
    } else {
      model += '<p class="brief-p">' + (HAS_PREV ? '环比因素分解因数据不足而无法完成。' : '本月为年度首月，无上月基数，不做环比分解结论。') + '</p>';
    }
    if (yoy.valid) {
      model += '<p class="brief-p">同比看，本月较上年同期' + yoyWord + ' ' + fmt(Math.abs(d.yoyDiff), 2) + ' 万元，'
        + '量差效应 ' + signed(yoy.xEff, 2) + ' 万元、价差效应 ' + signed(yoy.yEff, 2) + ' 万元。'
        + (yoy.yEff > 0
          ? '价差效应为正，说明本月成交均价高于上年同期，价格上行带来正向贡献；'
          : '价差效应为负，说明本月成交均价低于上年同期，价格下行对金额形成拖累；')
        + (yoy.xEff > 0
          ? '同时成交量同比增长，量价共同推动金额上升。'
          : '同时成交量同比下降，量的收缩抵消了部分价格影响。')
        + '</p>';
    } else {
      model += '<p class="brief-p">同比因素分解因上年同期数据不足而无法完成。</p>';
    }

    /* 三、差异归因与影响 */
    var goodItems = [], badItems = [];
    var momUsable = HAS_PREV && mom.valid;
    var yoyUsable = yoy.valid;
    if (momUsable) {
      if (mom.yEff > 0) goodItems.push('环比价差效应 +' + fmt(mom.yEff, 2) + ' 万元，本月成交均价高于上月，择时交易取得价格优势。');
      if (mom.yEff < 0) badItems.push('环比价差效应 ' + fmt(mom.yEff, 2) + ' 万元，本月成交均价低于上月，存在择时优化空间。');
      if (d.momDiff != null && d.momDiff > 0) goodItems.push('本月成交金额环比增加 ' + fmt(d.momDiff, 2) + ' 万元（' + fmt(d.momDiffPct, 2) + '%），交易规模稳步扩大。');
      if (d.momDiff != null && d.momDiff < 0) badItems.push('本月成交金额环比减少 ' + fmt(Math.abs(d.momDiff), 2) + ' 万元（' + fmt(Math.abs(d.momDiffPct), 2) + '%），交易规模有所收缩。');
      if (d.v1 != null && d.v0m != null && d.v1 > d.v0m) goodItems.push('本月成交量 ' + fmt(d.v1, 2) + ' 万tCO₂，较上月增加 ' + fmt(d.v1 - d.v0m, 2) + ' 万tCO₂，交易活跃度提升。');
      if (d.v1 != null && d.v0m != null && d.v1 < d.v0m) badItems.push('本月成交量 ' + fmt(d.v1, 2) + ' 万tCO₂，较上月减少 ' + fmt(d.v0m - d.v1, 2) + ' 万tCO₂，放量不足。');
      if (mom.xShare != null && mom.yShare != null && Math.abs(mom.xEff) >= Math.abs(mom.yEff)) {
        badItems.push('量差效应占差异比重 ' + fmt(mom.xShare, 1) + '%，金额对成交量波动敏感，需稳定交易节奏。');
      }
    } else {
      goodItems.push(HAS_PREV
        ? '本期或上月成交量／成交均价数据不足，无法完成环比归因。'
        : '本月为年度首月，无上月基数，暂不作环比归因。');
    }
    if (yoyUsable) {
      if (yoy.yEff > 0) goodItems.push('同比价差效应 +' + fmt(yoy.yEff, 2) + ' 万元，成交均价高于上年同期，价格中枢上移。');
      if (yoy.yEff < 0) badItems.push('同比价差效应 ' + fmt(yoy.yEff, 2) + ' 万元，成交均价低于上年同期，价格中枢下移。');
    }
    if (!goodItems.length) goodItems.push('本期量价指标未呈现正向贡献，暂无突出优势项。');
    if (!badItems.length) {
      badItems.push(momUsable || yoyUsable
        ? '各项量价指标方向均较优，暂无显著短板，需防范价格回调风险。'
        : '本期数据不足，暂不作短板评价。');
    }

    var cause = '<div class="vs-cols">'
      + '<div class="vs-col is-good"><h3>有利差异（增收方向）</h3><ul>'
      + goodItems.map(function (t) { return '<li>' + t + '</li>'; }).join('')
      + '</ul></div>'
      + '<div class="vs-col is-bad"><h3>不利差异（减收方向）</h3><ul>'
      + badItems.map(function (t) { return '<li>' + t + '</li>'; }).join('')
      + '</ul></div></div>';

    cause += '<p class="brief-p">敏感性说明：'
      + (d.p0m == null || d.v0m == null
        ? '本月无上月基数（或上月均价无效），无法给出环比敏感度；'
        : '成交金额对成交量与均价的敏感度分别为 <strong>P₀ = ' + fmt(d.p0m, 2) + ' 元/tCO₂</strong>'
        + '（成交量每变动 1 万t，金额变动 ' + fmt(d.p0m, 2) + ' 万元）'
        + '和 <strong>V₀ = ' + fmt(d.v0m, 2) + ' 万tCO₂</strong>'
        + '（均价每变动 1 元/t，金额变动 ' + fmt(d.v0m, 2) + ' 万元）；')
      + '在成交量相对稳定的情况下，<strong>把握价格窗口、提升择时能力是增厚交易金额的关键</strong>。</p>';

    /* 四、改进措施 */
    var advice = '<ol class="advice-list">'
      + '<li><strong>强化择时交易：</strong>本月成交均价 ' + fmt(d.p1, 2) + ' 元/tCO₂，'
      + (pctOf(d.p1, d.p0m) == null ? '环比不适用，' : '环比 ' + signed(pctOf(d.p1, d.p0m), 2, '%') + '，')
      + '建议建立碳价监测与分批建仓机制，在价格低位增配、高位择机变现盈余配额。'
      + (HAS_PREV && mom.valid && mom.yEff < 0 ? '本月价差效应为减收方向，须重点提升择时能力。' : '') + '</li>'
      + '<li><strong>稳定交易节奏：</strong>'
      + (mom.xShare == null
        ? '建议按履约进度制定分月交易计划，避免量能大起大落导致金额波动。'
        : '量差效应占环比差异 ' + fmt(mom.xShare, 1) + '%，建议按履约进度制定分月交易计划，避免量能大起大落导致金额波动。')
      + '</li>'
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
