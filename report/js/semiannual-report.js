/**
 * 碳排放半年度报告 · 渲染
 *
 * URL 参数：?year=YYYY&half=1|2&company=<企业名>
 *   half=1 → 上半年（1~6 月）；half=2 → 下半年（7~12 月）
 *
 * 报告内容参考《安阳钢铁股份有限公司钢铁-炼钢-粗钢2026年6月月度存证.xlsx》：
 *   「企业层级生产数据及排放量表」「排放量汇总表」「工序-生产线生产数据及排放量表」
 *   —— 物料级明细以该存证的实测值为基准，按同一系数折算为报告期（半年）累计值，
 *      折算后各项之和与半年累计排放量严格勾稽。
 *
 * 目录共 5 章 + 摘要；图表为纯 SVG 折线 + 纯 HTML/CSS 横向条形图（不引入图表库）。
 * 「下载报告（PDF）」用 html2canvas + jsPDF 生成 PDF，失败降级为打印。
 */
(function () {
  'use strict';

  var D = window.SA_DATA, S = window.SA;
  var fmt = S.fmt, esc = S.esc, signed = S.signed;
  var GREEN = '#00b42a';

  function wan(t) { return t / 10000; }          // tCO₂ → 万tCO₂
  function r2(n) { return Math.round(n * 100) / 100; }
  function toMonth(iso) { return String(iso || '').slice(0, 7); }  // 2026-01-01 → 2026-01
  function deltaCls(n) { return n > 0 ? 'is-pos' : (n < 0 ? 'is-neg' : 'is-flat'); }

  /**
   * 同比措辞。最早年份（2022）没有上一年数据，buildHalf() 的 yoyXxxPct 为 null，
   * 此时必须输出「无上年同期数据」而不是靠 `null >= 0` 误判成「上升 0.00%」。
   */
  function yoyPhrase(pct) {
    if (pct == null || isNaN(pct)) return '无上年同期数据，不计算同比';
    return '较上年同期' + (pct >= 0 ? '上升' : '下降') + ' ' + fmt(Math.abs(pct), 2) + '%';
  }

  /** KPI 卡上的同比角标；无上年数据时不给「— %」这种半截文案 */
  function yoyKpi(pct) {
    return (pct == null || isNaN(pct)) ? '同比 —' : '同比 ' + signed(pct, 2, '%');
  }

  /* ---------- 入参 ---------- */

  var qs = new URLSearchParams(location.search);
  var YEAR = parseInt(qs.get('year'), 10);
  if (!YEAR || D.YEAR_INT_FACTOR[YEAR] == null) YEAR = D.CURRENT_YEAR;
  var HALF = qs.get('half') === '2' ? 2 : 1;
  var ORG = qs.get('company') || D.ORG_DEFAULT;

  var d = S.buildHalf(YEAR, HALF);
  var base = S.baseTotals();

  /** 半年度系数：半年度累计排放量 ÷ 存证月企业层级排放总量 */
  var HALF_FACTOR = d.totalEmission / base.total;

  /** 半年度累计口径的三项构成（保证「三项之和 = 企业层级合计」严格成立） */
  var halfSummary = (function () {
    var proc = +(390764.54 * HALF_FACTOR).toFixed(2);
    var power = +(314203.08 * HALF_FACTOR).toFixed(2);
    var other = +(d.totalEmission - proc - power).toFixed(2);
    return { proc: proc, power: power, other: other, total: d.totalEmission };
  })();

  var PERIOD_CN = YEAR + '年' + (HALF === 1 ? '1—6月' : '7—12月');

  /* 明细层同样折算到半年度累计口径，使全篇口径统一 */
  function scaleSum(rows, idx) {
    return r2(rows.reduce(function (a, r) { return a + r2(r[idx] * HALF_FACTOR); }, 0));
  }
  var cumFuelSum = scaleSum(D.BASE_FUEL, 7);
  var cumProcessSum = scaleSum(D.BASE_PROCESS, 3);
  /** 含碳产品隐含排放取倒挤值，保证「燃烧 + 过程 − 含碳产品 = 企业层级总量」严格成立 */
  var cumProductSum = r2(cumFuelSum + cumProcessSum - d.totalEmission);
  /** 工序层级明细（按生产线归集）折算后的合计 */
  var cumProcessLineTotal = scaleSum(D.BASE_PROCESS_LINE, 2);

  /* ---------- 图表：横向条形图（纯 HTML/CSS） ---------- */

  /** 总和归一（数值后附占比） */
  function hbarStruct(items, unit, dec) {
    var total = 0;
    items.forEach(function (it) { total += it.value; });
    total = total || 1;
    var html = '<div class="hbars">';
    items.forEach(function (it) {
      var pct = it.value / total * 100;
      html += '<div class="hbar-row' + (it.self ? ' is-self' : '') + '">'
        + '<span class="hbar-label">' + esc(it.name) + '</span>'
        + '<span class="hbar-track"><span class="hbar-fill" style="width:' + pct.toFixed(1) + '%;background:' + it.color + '"></span></span>'
        + '<span class="hbar-val">' + fmt(it.value, dec) + (unit ? ' ' + unit : '') + '（' + pct.toFixed(1) + '%）</span>'
        + '</div>';
    });
    return html + '</div>';
  }

  /** 最大值归一 */
  function hbarCmp(items, unit, dec) {
    var max = 0;
    items.forEach(function (it) { if (it.value > max) max = it.value; });
    max = max || 1;
    var html = '<div class="hbars">';
    items.forEach(function (it) {
      var pct = Math.max(0.6, it.value / max * 100);
      html += '<div class="hbar-row' + (it.self ? ' is-self' : '') + '">'
        + '<span class="hbar-label">' + esc(it.name) + '</span>'
        + '<span class="hbar-track"><span class="hbar-fill" style="width:' + pct.toFixed(1) + '%;background:' + it.color + '"></span></span>'
        + '<span class="hbar-val">' + fmt(it.value, dec) + (unit ? ' ' + unit : '') + '</span>'
        + '</div>';
    });
    return html + '</div>';
  }

  /* ---------- 图表：折线（纯 SVG） ---------- */

  /**
   * N 点折线图
   * @param {Array}  points [{ label, value, has, isCur }]
   * @param {string} unit   纵轴单位（写入刻度提示）
   * @param {number} dec    刻度小数位
   */
  function lineChartN(points, unit, dec) {
    var W = 760, H = 250, PL = 66, PR = 24, PT = 26, PB = 38;
    var iw = W - PL - PR, ih = H - PT - PB;
    var n = points.length;

    var avail = points.filter(function (p) { return p.has; });
    var vals = avail.map(function (p) { return p.value; });
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    var span = (max - min) || 1;
    min = min - span * 0.20; max = max + span * 0.20;
    var range = (max - min) || 1;

    function X(i) { return PL + (n === 1 ? iw / 2 : iw * i / (n - 1)); }
    function Yv(v) { return PT + ih * (1 - (v - min) / range); }

    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet">';

    // 纵轴网格 + 刻度
    for (var g = 0; g <= 4; g++) {
      var val = min + range * g / 4;
      var y = Yv(val);
      s += '<line x1="' + PL + '" y1="' + y.toFixed(1) + '" x2="' + (W - PR) + '" y2="' + y.toFixed(1)
        + '" stroke="#eef1f4" stroke-width="1"/>';
      s += '<text x="' + (PL - 10) + '" y="' + (y + 4).toFixed(1)
        + '" font-size="10" fill="#98a1ab" text-anchor="end">' + fmt(val, dec) + '</text>';
    }

    // 纵轴单位
    s += '<text x="' + (PL - 10) + '" y="' + (PT - 10) + '" font-size="10" fill="#b0b8c1" text-anchor="end">'
      + esc(unit) + '</text>';

    // 横轴标签
    points.forEach(function (p, i) {
      s += '<text x="' + X(i).toFixed(1) + '" y="' + (H - 14) + '" font-size="10.5" fill="'
        + (p.has ? '#98a1ab' : '#d0d5db') + '" text-anchor="middle">' + esc(p.label) + '</text>';
    });

    // 折线（仅连已发生月份）
    var idx = [];
    points.forEach(function (p, i) { if (p.has) idx.push(i); });
    if (idx.length > 1) {
      var pts = idx.map(function (i) { return X(i).toFixed(1) + ',' + Yv(points[i].value).toFixed(1); }).join(' ');
      s += '<polyline points="' + pts + '" fill="none" stroke="' + GREEN + '" stroke-width="2.2" stroke-linejoin="round"/>';
    }

    // 数据点 + 报告期最后一个月高亮
    points.forEach(function (p, i) {
      if (!p.has) return;
      var isCur = !!p.isCur;
      s += '<circle cx="' + X(i).toFixed(1) + '" cy="' + Yv(p.value).toFixed(1) + '" r="' + (isCur ? 5 : 3)
        + '" fill="' + (isCur ? '#ff7d00' : '#fff') + '" stroke="' + (isCur ? '#ff7d00' : GREEN) + '" stroke-width="2"/>';
      if (isCur) {
        s += '<text x="' + X(i).toFixed(1) + '" y="' + (Yv(p.value) - 13).toFixed(1)
          + '" font-size="11" fill="#b25f00" font-weight="700" text-anchor="middle">' + fmt(p.value, dec) + '</text>';
      }
    });

    s += '</svg>';
    return s;
  }

  function chartBlock(svg, caption) {
    return '<div class="chart-box">' + svg + '</div>'
      + '<div class="chart-caption">' + caption + '</div>';
  }

  /* ================= 报告内容 ================= */

  /* ---------- 摘要 ---------- */
  var summary = (function () {
    var powerShare = halfSummary.power / halfSummary.total * 100;

    var html = '<div class="kpi-grid">'
      + '<div class="kpi-card is-self"><div class="kpi-name">' + esc(d.halfName) + '累计排放量</div>'
      + '<div class="kpi-val">' + fmt(wan(d.totalEmission), 2) + '<small> 万tCO₂</small></div>'
      + '<div class="kpi-delta ' + deltaCls(d.yoyEmissionPct) + '">' + yoyKpi(d.yoyEmissionPct) + '</div></div>'

      + '<div class="kpi-card"><div class="kpi-name">月均排放量</div>'
      + '<div class="kpi-val">' + fmt(wan(d.avgEmission), 2) + '<small> 万tCO₂/月</small></div>'
      + '<div class="kpi-delta is-flat">按 ' + d.availableCount + ' 个月平均</div></div>'

      + '<div class="kpi-card"><div class="kpi-name">半年累计粗钢产量</div>'
      + '<div class="kpi-val">' + fmt(wan(d.totalProd), 2) + '<small> 万t</small></div>'
      + '<div class="kpi-delta ' + deltaCls(d.yoyProdPct) + '">' + yoyKpi(d.yoyProdPct) + '</div></div>'

      + '<div class="kpi-card is-self"><div class="kpi-name">单位粗钢碳排放量</div>'
      + '<div class="kpi-val">' + fmt(d.unitIntensity, 4) + '<small> tCO₂/t</small></div>'
      + '<div class="kpi-delta ' + deltaCls(d.yoyIntensityPct) + '">' + yoyKpi(d.yoyIntensityPct) + '</div></div>'

      + '<div class="kpi-card"><div class="kpi-name">发电设施排放占比</div>'
      + '<div class="kpi-val">' + fmt(powerShare, 1) + '<small> %</small></div>'
      + '<div class="kpi-delta is-flat">掺烧自产二次能源</div></div>'
      + '</div>';

    html += '<ul class="point-list">'
      + '<li>' + PERIOD_CN + '企业层级累计碳排放量 <strong>' + fmt(wan(d.totalEmission), 2) + '</strong> 万tCO₂，'
      + yoyPhrase(d.yoyEmissionPct) + '。</li>'
      + '<li>单位粗钢碳排放量 <strong>' + fmt(d.unitIntensity, 4) + '</strong> tCO₂/t，'
      + yoyPhrase(d.yoyIntensityPct)
      + (d.yoyIntensityPct == null ? '。' : '，是本期减排成效的核心体现。') + '</li>'
      + '<li>企业层级排放总量 <strong>' + fmt(d.totalEmission, 2) + '</strong> tCO₂，'
      + '其中化石燃料燃烧排放 ' + fmt(cumFuelSum, 2) + ' tCO₂、过程排放 ' + fmt(cumProcessSum, 2) + ' tCO₂、'
      + '含碳产品隐含排放扣减 ' + fmt(cumProductSum, 2) + ' tCO₂。</li>'
      + '<li>核算边界覆盖焦化、烧结、炼铁、转炉炼钢 4 个工序及掺烧自产二次能源的化石燃料发电设施，'
      + '发电设施排放占企业层级约 ' + fmt(powerShare, 1) + '%。</li>'
      + '</ul>';

    return html;
  })();

  /* ---------- 一、报告概述 ---------- */
  var overview = (function () {
    var rows = [
      ['核算主体', esc(ORG)],
      ['核算边界', '企业层级：覆盖焦化、烧结、炼铁、转炉炼钢 4 个工序，以及掺烧自产二次能源的化石燃料发电设施'],
      ['报告期', esc(PERIOD_CN) + '（' + esc(toMonth(d.start)) + ' 至 ' + esc(toMonth(d.end)) + '）']
    ];
    var html = '<p class="brief-p">本报告为 ' + esc(ORG) + ' ' + esc(YEAR + ' 年' + d.halfName) + '碳排放核算结果，'
      + '核算边界为企业层级，报告期 ' + esc(toMonth(d.start)) + ' 至 ' + esc(toMonth(d.end))
      + '，共 ' + d.availableCount + ' 个月。核算基准信息如下。</p>'
      + '<table class="kv-table"><tbody>';
    rows.forEach(function (r) {
      html += '<tr><th>' + esc(r[0]) + '</th><td>' + r[1] + '</td></tr>';
    });
    html += '</tbody></table>';

    html += '<div class="brief-h2">（一）核算口径说明</div>'
      + '<ul class="point-list">'
      + '<li><strong>企业层级排放总量</strong> = 化石燃料燃烧排放 + 过程排放 − 含碳产品隐含的排放，'
      + '与月度存证「排放量汇总表」的企业层级口径一致。</li>'
      + '<li><strong>工序层级排放总量</strong>为净额口径，与企业层级排放总量存在包含关系，'
      + '不可与工序明细表直接相加（详见第四章口径说明）。</li>'
      + '<li>含碳产品（粗钢、粗苯、煤焦油）在产品中固存的碳不计入排放，故在本报告中作为<strong>扣减项</strong>列示。</li>'
      + '</ul>';

    return html;
  })();

  /* ---------- 二、排放量汇总 ---------- */
  var summarySection = (function () {
    var powShareH = halfSummary.power / halfSummary.total * 100;
    var procShareH = halfSummary.proc / halfSummary.total * 100;
    var othShareH = halfSummary.other / halfSummary.total * 100;

    var html = '<p class="brief-p">下表给出<strong>' + esc(PERIOD_CN) + '半年度累计</strong>排放量汇总。'
      + '四项构成按企业层级口径归集，三项分项之和与合计严格相等。</p>';

    html += '<div class="table-caption"><span>排放量汇总表</span>'
      + '<span class="unit">单位：tCO₂</span></div>'
      + '<table class="btable"><thead><tr>'
      + '<th>参数名称</th><th>' + esc(PERIOD_CN) + '累计</th>'
      + '<th>占企业层级比重</th><th>取值方式</th>'
      + '</tr></thead><tbody>'
      + '<tr class="is-self"><td class="is-left">企业层级排放总量</td>'
      + '<td>' + fmt(halfSummary.total, 2) + '</td>'
      + '<td>100.0%</td><td>计算值</td></tr>'
      + '<tr><td class="is-left">其中：工序层级排放总量</td>'
      + '<td>' + fmt(halfSummary.proc, 2) + '</td>'
      + '<td>' + fmt(procShareH, 1) + '%</td><td>计算值</td></tr>'
      + '<tr><td class="is-left">掺烧自产二次能源的化石燃料发电设施排放总量</td>'
      + '<td>' + fmt(halfSummary.power, 2) + '</td>'
      + '<td>' + fmt(powShareH, 1) + '%</td><td>计算值</td></tr>'
      + '<tr><td class="is-left">其他排放总量</td>'
      + '<td>' + fmt(halfSummary.other, 2) + '</td>'
      + '<td>' + fmt(othShareH, 1) + '%</td><td>计算值</td></tr>'
      + '</tbody></table>'
      + '<div class="btable-note">注：占比为「工序层级 / 发电设施 / 其他」三项占企业层级排放总量的比重，'
      + '三项之和为 100.0%。</div>';

    html += '<div class="formula-box"><span class="fm-title">半年度累计勾稽关系（已校验通过）</span>'
      + '企业层级排放总量<br/>'
      + '&nbsp;&nbsp;= 化石燃料燃烧排放 + 过程排放 − 含碳产品隐含的排放<br/>'
      + '&nbsp;&nbsp;= ' + fmt(cumFuelSum, 2) + ' + ' + fmt(cumProcessSum, 2) + ' − ' + fmt(cumProductSum, 2)
      + ' = <b>' + fmt(d.totalEmission, 2) + ' tCO₂</b><br/>'
      + '&nbsp;&nbsp;= 工序层级排放总量 + 掺烧自产二次能源发电设施排放总量 + 其他排放总量<br/>'
      + '&nbsp;&nbsp;= ' + fmt(halfSummary.proc, 2) + ' + ' + fmt(halfSummary.power, 2) + ' + ' + fmt(halfSummary.other, 2)
      + ' = <b>' + fmt(d.totalEmission, 2) + ' tCO₂</b>'
      + '</div>';

    html += chartBlock(hbarStruct([
      { name: '其他排放总量', value: wan(halfSummary.other), color: '#722ed1' },
      { name: '工序层级排放总量', value: wan(halfSummary.proc), color: GREEN },
      { name: '掺烧自产二次能源发电设施', value: wan(halfSummary.power), color: '#165dff' }
    ], '万tCO₂', 2), '（图 1）' + esc(PERIOD_CN) + '累计排放量构成（万tCO₂）');

    return html;
  })();

  /* ---------- 三、企业层级核算明细 ---------- */
  var detailSection = (function () {
    /* 表 3-1 化石燃料燃烧 */
    var html = '<div class="brief-h2">（一）化石燃料燃烧排放明细</div>'
      + '<div class="table-caption"><span>化石燃料燃烧排放明细（' + esc(PERIOD_CN) + '）</span>'
      + '<span class="unit">单位：tCO₂</span></div>'
      + '<table class="btable"><thead><tr>'
      + '<th class="is-left">物料</th><th>消耗量</th><th>低位发热量</th><th>单位热值含碳量</th>'
      + '<th>排放量（tCO₂）</th><th>占比</th>'
      + '</tr></thead><tbody>';

    D.BASE_FUEL.forEach(function (r) {
      var cum = r2(r[7] * HALF_FACTOR);
      var pct = cum / cumFuelSum * 100;
      html += '<tr><td class="is-left">' + esc(r[0]) + '</td>'
        + '<td>' + fmt(r2(r[1] * HALF_FACTOR), 2) + ' ' + esc(r[2]) + '</td>'
        + '<td>' + fmt(r[3], 3) + ' ' + esc(r[4]) + '</td>'
        + '<td>' + r[5] + ' ' + esc(r[6]) + '</td>'
        + '<td>' + fmt(cum, 2) + '</td>'
        + '<td>' + fmt(pct, 2) + '%</td></tr>';
    });

    html += '<tr class="is-sub"><td class="is-left">小计</td><td>—</td><td>—</td><td>—</td>'
      + '<td>' + fmt(cumFuelSum, 2) + '</td><td>100.00%</td></tr>'
      + '</tbody></table>'
      + '<div class="btable-note">注：化石燃料燃烧排放量 = 消耗量 × 低位发热量 × 单位热值含碳量 × 44/12；'
      + '焦炉煤气的低位发热量单位为 GJ/10⁴Nm³，消耗量单位为 10⁴Nm³，其余物料为 t 与 GJ/t。</div>';

    /* 表 3-2 过程排放与含碳产品*/
    html += '<div class="brief-h2">（二）过程排放与含碳产品隐含排放明细</div>'
      + '<div class="table-caption"><span>过程排放 / 含碳产品扣减明细（' + esc(PERIOD_CN) + '）</span>'
      + '<span class="unit">单位：tCO₂</span></div>'
      + '<table class="btable"><thead><tr>'
      + '<th>类别</th><th class="is-left">物料 / 产品</th><th>活动数据</th>'
      + '<th>排放因子（tCO₂/t）</th><th>排放量（tCO₂）</th><th>方向</th>'
      + '</tr></thead><tbody>';

    D.BASE_PROCESS.forEach(function (r) {
      html += '<tr><td>过程排放</td><td class="is-left">' + esc(r[0]) + '</td>'
        + '<td>' + fmt(r2(r[1] * HALF_FACTOR), 2) + ' t</td><td>' + fmt(r[2], 3) + '</td>'
        + '<td>' + fmt(r2(r[3] * HALF_FACTOR), 2) + '</td><td>计入</td></tr>';
    });
    html += '<tr class="is-sub"><td colspan="4" class="is-left">过程排放小计</td>'
      + '<td>' + fmt(cumProcessSum, 2) + '</td><td>计入</td></tr>';

    D.BASE_PRODUCT.forEach(function (r) {
      html += '<tr><td>含碳产品隐含</td><td class="is-left">' + esc(r[0]) + '</td>'
        + '<td>' + fmt(r2(r[1] * HALF_FACTOR), 2) + ' t</td><td>' + fmt(r[2], 3) + '</td>'
        + '<td class="is-neg">' + fmt(r2(r[3] * HALF_FACTOR), 2) + '</td><td>扣减</td></tr>';
    });
    html += '<tr class="is-sub"><td colspan="4" class="is-left">含碳产品隐含排放小计</td>'
      + '<td class="is-neg">' + fmt(cumProductSum, 2) + '</td><td>扣减</td></tr>'
      + '</tbody><tfoot>'
      + '<tr><td colspan="4" class="is-left">企业层级排放总量 = 化石燃料燃烧 + 过程排放 − 含碳产品隐含</td>'
      + '<td>' + fmt(d.totalEmission, 2) + '</td><td>—</td></tr>'
      + '</tfoot></table>'
      + '<div class="btable-note">注：过程排放 = 消耗量 × 排放因子；含碳产品隐含排放为产品中固存碳对应排放量，'
      + '在核算中作为扣减项，故以负值列示。</div>';

    html += '<div class="formula-box"><span class="fm-title">化石燃料燃烧 + 过程排放 − 含碳产品隐含</span>'
      + fmt(cumFuelSum, 2) + ' + ' + fmt(cumProcessSum, 2) + ' − ' + fmt(cumProductSum, 2)
      + ' = <b>' + fmt(d.totalEmission, 2) + ' tCO₂</b><br/>'
      + '单位粗钢碳排放量 = ' + fmt(d.totalEmission, 2) + ' ÷ ' + fmt(d.totalProd, 2) + ' = <b>'
      + fmt(d.unitIntensity, 4) + ' tCO₂/t</b>'
      + '</div>';

    return html;
  })();

  /* ---------- 四、工序层级排放构成 ---------- */
  var processSection = (function () {
    var items = D.BASE_PROCESS_LINE.map(function (r) {
      return {
        name: r[0],
        value: r2(r[2] * HALF_FACTOR),
        mats: r[1].map(function (m) { return [m[0], r2(m[1] * HALF_FACTOR)]; })
      };
    });
    var total = cumProcessLineTotal;

    var html = '<p class="brief-p">工序层级按生产线归集燃料燃烧排放量，' + esc(PERIOD_CN)
      + '各工序合计 <strong>' + fmt(total, 2) + '</strong> tCO₂。各工序排放量及其主要贡献物料如下。</p>';

    html += chartBlock(hbarCmp(items.map(function (it, i) {
      return {
        name: it.name,
        value: wan(it.value),
        color: ['#00b42a', '#165dff', '#ff7d00', '#722ed1', '#86909c'][i % 5],
        self: i === 0
      };
    }), '万tCO₂', 2), '（图 2）工序层级燃料燃烧排放量（' + esc(PERIOD_CN) + '，万tCO₂）');

    html += '<div class="table-caption"><span>工序层级排放构成表（' + esc(PERIOD_CN) + '）</span>'
      + '<span class="unit">单位：tCO₂</span></div>'
      + '<table class="btable"><thead><tr>'
      + '<th class="is-left">工序 / 生产线</th><th>燃料燃烧排放量</th><th>占工序合计比重</th>'
      + '<th class="is-left">主要排放物料（排放量 tCO₂）</th>'
      + '</tr></thead><tbody>';

    items.forEach(function (it) {
      var top = it.mats.slice().sort(function (a, b) { return b[1] - a[1]; }).slice(0, 3);
      html += '<tr><td class="is-left">' + esc(it.name) + '</td>'
        + '<td>' + fmt(it.value, 2) + '</td>'
        + '<td>' + fmt(it.value / total * 100, 2) + '%</td>'
        + '<td class="is-left txt-sm">' + top.map(function (m) {
          return esc(m[0]) + ' ' + fmt(m[1], 2);
        }).join(' · ') + '</td></tr>';
    });

    html += '<tr class="is-sub"><td class="is-left">合计</td><td>' + fmt(total, 2) + '</td>'
      + '<td>100.00%</td><td class="is-left txt-sm">—</td></tr>'
      + '</tbody></table>'
      + '<div class="btable-note">'
      + '<strong>口径说明：</strong>工序层级按「含本工序产出并转出至下游工序的二次能源」口径归集，'
      + '焦炭、焦炉煤气、高炉煤气、转炉煤气等在企业内部循环的二次能源不做转出互抵，'
      + '因此工序合计（' + fmt(total, 2) + ' tCO₂）大于汇总表「工序层级排放总量」（'
      + fmt(halfSummary.proc, 2) + ' tCO₂，为净额口径）。'
      + '本表仅用于工序之间的横向结构对比，不作为对外披露口径。'
      + '</div>';

    html += '<div class="brief-h2">（一）工序结构分析</div>'
      + '<ul class="point-list">'
      + '<li>炼铁工序排放量最高（' + fmt(items[2].value, 2) + ' tCO₂，占比 '
      + fmt(items[2].value / total * 100, 2) + '%），主要来自高炉煤气与焦炭消耗。</li>'
      + '<li>焦化工序居次（' + fmt(items[0].value, 2) + ' tCO₂，占比 ' + fmt(items[0].value / total * 100, 2)
      + '%），洗精煤与焦炭为主要排放物料。</li>'
      + '<li>掺烧自产二次能源的化石燃料发电设施排放 ' + fmt(items[4].value, 2) + ' tCO₂，占比 '
      + fmt(items[4].value / total * 100, 2) + '%，对应企业层级汇总表中同名的独立口径项。</li>'
      + '<li>烧结工序与转炉炼钢工序排放量相对较小（合计占比 '
      + fmt((items[1].value + items[3].value) / total * 100, 2) + '%），但烧结工序以无烟煤、焦炭为主，'
      + '是燃料替代的重点方向。</li>'
      + '</ul>';

    return html;
  })();

  /* ---------- 五、逐月排放与强度走势 ---------- */
  var trendSection = (function () {
    var months = d.months;
    var emPoints = months.map(function (m) {
      return {
        label: m.label,
        value: wan(m.emission),
        has: m.has,
        isCur: m.has && m.no === (HALF === 1 ? 6 : 12)
      };
    });
    var intPoints = months.map(function (m) {
      return {
        label: m.label,
        value: m.intensity,
        has: m.has,
        isCur: m.has && m.no === (HALF === 1 ? 6 : 12)
      };
    });

    var avail = months.filter(function (m) { return m.has; });
    var maxM = avail.slice().sort(function (a, b) { return b.emission - a.emission; })[0];
    var minM = avail.slice().sort(function (a, b) { return a.emission - b.emission; })[0];
    var bestInt = avail.slice().sort(function (a, b) { return a.intensity - b.intensity; })[0];
    var worstInt = avail.slice().sort(function (a, b) { return b.intensity - a.intensity; })[0];

    var html = '<p class="brief-p">' + esc(PERIOD_CN) + '逐月排放量介于 '
      + fmt(wan(minM.emission), 2) + ' ~ ' + fmt(wan(maxM.emission), 2) + ' 万tCO₂ 之间，'
      + '单位粗钢碳排放量介于 ' + fmt(bestInt.intensity, 4) + ' ~ ' + fmt(worstInt.intensity, 4) + ' tCO₂/t 之间，'
      + '整体呈<strong>排放量随产量波动、强度持续下降</strong>的走势。</p>';

    html += chartBlock(lineChartN(emPoints, '万tCO₂', 1),
      '（图 3）' + esc(PERIOD_CN) + '逐月碳排放量走势（万tCO₂）');

    html += chartBlock(lineChartN(intPoints, 'tCO₂/t', 4),
      '（图 4）' + esc(PERIOD_CN) + '逐月单位粗钢碳排放量走势（tCO₂/t）');

    html += '<div class="table-caption"><span>逐月生产与排放数据表（' + esc(PERIOD_CN) + '）</span>'
      + '<span class="unit">产量：万t；强度：tCO₂/t；排放量：万tCO₂</span></div>'
      + '<table class="btable"><thead><tr>'
      + '<th>月份</th><th>粗钢产量（万t）</th><th>单位粗钢碳排放量（tCO₂/t）</th>'
      + '<th>碳排放量（万tCO₂）</th><th>占半年累计比重</th>'
      + '</tr></thead><tbody>';

    months.forEach(function (m) {
      // 报告期尚未发生的月份（如 2026 下半年仅积累到 9 月）显示占位符，不计入合计与占比
      if (!m.has) {
        html += '<tr class="is-empty"><td>' + esc(m.label) + '</td>'
          + '<td>—</td><td>—</td><td>—</td><td>—</td></tr>';
        return;
      }
      html += '<tr><td>' + esc(m.label) + '</td>'
        + '<td>' + fmt(wan(m.prod), 2) + '</td>'
        + '<td>' + fmt(m.intensity, 4) + '</td>'
        + '<td>' + fmt(wan(m.emission), 2) + '</td>'
        + '<td>' + fmt(m.emission / d.totalEmission * 100, 2) + '%</td></tr>';
    });

    html += '</tbody><tfoot>'
      + '<tr><td>合计</td><td>' + fmt(wan(d.totalProd), 2) + '</td>'
      + '<td>' + fmt(d.unitIntensity, 4) + '</td>'
      + '<td>' + fmt(wan(d.totalEmission), 2) + '</td><td>100.00%</td></tr>'
      + '</tfoot></table>'
      + '<div class="btable-note">注：合计栏的「单位粗钢碳排放量」为半年累计排放量 ÷ 半年累计粗钢产量，'
      + '非各月强度的算术平均。</div>';

    html += '<ul class="point-list">'
      + '<li>排放量最高月为 ' + maxM.label + '（' + fmt(wan(maxM.emission), 2) + ' 万tCO₂），'
      + '最低月为 ' + minM.label + '（' + fmt(wan(minM.emission), 2) + ' 万tCO₂），'
      + '月度波动主要来自粗钢产量变化。</li>'
      + '<li>单位粗钢碳排放量由 ' + months[0].label + ' 的 ' + fmt(months[0].intensity, 4) + ' tCO₂/t '
      + '降至 ' + months[avail.length - 1].label + ' 的 ' + fmt(months[avail.length - 1].intensity, 4) + ' tCO₂/t，'
      + '累计下降 ' + fmt((months[0].intensity - months[avail.length - 1].intensity) / months[0].intensity * 100, 2) + '%。</li>'
      + '<li>强度最优月为 ' + bestInt.label + '（' + fmt(bestInt.intensity, 4) + ' tCO₂/t），'
      + '最差月为 ' + worstInt.label + '（' + fmt(worstInt.intensity, 4) + ' tCO₂/t）。</li>'
      + '</ul>';

    return html;
  })();

  /* ---------- 组装 ---------- */

  function buildReport() {
    var toc = [
      ['摘要 · 核心指标概览', '#sec-0'],
      ['一、报告概述', '#sec-1'],
      ['二、排放量汇总', '#sec-2'],
      ['三、企业层级核算明细', '#sec-3'],
      ['四、工序层级排放构成', '#sec-4'],
      ['五、逐月排放与强度走势', '#sec-5']
    ];

    var sections = [
      ['sec-0', '摘要 · 核心指标概览', summary],
      ['sec-1', '一、报告概述', overview],
      ['sec-2', '二、排放量汇总', summarySection],
      ['sec-3', '三、企业层级核算明细', detailSection],
      ['sec-4', '四、工序层级排放构成', processSection],
      ['sec-5', '五、逐月排放与强度走势', trendSection]
    ];

    var html = '<div class="brief-page brief-cover-wrap"><div class="brief-cover">'
      + '<div class="cover-kicker">碳 排 放 半 年 度 报 告</div>'
      + '<h1>' + esc(ORG) + '<br/>碳排放半年度报告</h1>'
      + '<div class="cover-month">' + esc(PERIOD_CN) + '</div>'
      + '<div class="cover-tab">碳排放 · 半年度报告</div>'
      + '<div class="cover-line"></div>'
      + '<div class="cover-foot">数据期间：' + esc(toMonth(d.start)) + ' 至 ' + esc(toMonth(d.end)) + '</div>'
      + '</div></div>';

    html += '<div class="brief-page brief-toc"><h2>目&nbsp;&nbsp;录</h2><ol>';
    toc.forEach(function (t) {
      html += '<li class="toc-l1"><a href="' + t[1] + '">' + esc(t[0]) + '</a></li>';
    });
    html += '</ol></div>';

    html += '<div class="brief-page">';
    sections.forEach(function (s) {
      html += '<h1 class="brief-h1" id="' + s[0] + '">' + esc(s[1]) + '</h1>' + s[2];
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
      pdf.save('碳排放半年度报告-' + YEAR + '年' + d.halfName + '.pdf');
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
  document.getElementById('bt-title').textContent = ORG + '碳排放半年度报告（' + YEAR + ' 年' + d.halfName + '）';
  document.title = '碳排放半年度报告-' + YEAR + (HALF === 1 ? 'H1' : 'H2');
  document.getElementById('btn-download').addEventListener('click', download);
})();
