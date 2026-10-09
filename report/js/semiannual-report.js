/**
 * 碳排放半年度报告 · 渲染
 *
 * URL 参数：?year=YYYY&half=1|2&company=<企业名>
 *   half=1 → 上半年（1—6 月）；half=2 → 下半年（7—12 月）
 *
 * 报告结构（数据可得性收缩后）：
 *   封面 / 目录 / 正文三张 A4 纸面；
 *   正文 = 摘要 · 核心指标概览 + 一、报告概述 + 二、逐月排放与强度走势。
 *   物料级明细（化石燃料各物料、过程排放各物料、含碳产品隐含排放）与工序级排放量
 *   在当前数据条件下无法获取，报告已删除对应章节。
 *
 * 全部数值来自入参 emission（逐月排放量与单位强度），详见 report/js/semiannual-data.js。
 * 图表为纯 SVG 折线 + 纯 HTML/CSS 表格（不引入图表库）。
 * 「下载报告（PDF）」用 html2canvas + jsPDF 生成 PDF，失败降级为打印。
 */
(function () {
  'use strict';

  var D = window.SA_DATA, S = window.SA;
  var fmt = S.fmt, esc = S.esc, signed = S.signed;
  var GREEN = '#00b42a';

  /** 2026-01-01 → 2026-01（数据期间只显示到月） */
  function toMonth(iso) { return String(iso || '').slice(0, 7); }

  function deltaCls(n) {
    if (n == null || !isFinite(n)) return 'is-flat';
    return n > 0 ? 'is-pos' : (n < 0 ? 'is-neg' : 'is-flat');
  }

  /**
   * 同比措辞。上年同期缺失或为 0 时 yoyXxxPct 为 null，
   * 此时必须输出「无上年同期数据，不计算同比」而不是靠 `null >= 0` 误判成「上升 0.00%」。
   */
  function yoyPhrase(pct) {
    if (pct == null || isNaN(pct)) return '无上年同期数据，不计算同比';
    return '较上年同期' + (pct >= 0 ? '上升' : '下降') + ' ' + fmt(Math.abs(pct), 2) + '%';
  }

  /** KPI 卡上的同比角标；无上年数据时写 `同比 --`，不出现「同比 — %」这种半截文案 */
  function yoyKpi(pct) {
    return (pct == null || isNaN(pct)) ? '同比 --' : '同比 ' + signed(pct, 2, '%');
  }

  /* ---------- 入参 ---------- */

  var qs = new URLSearchParams(location.search);
  var YEAR = parseInt(qs.get('year'), 10);
  if (!YEAR || isNaN(YEAR)) YEAR = D.INPUT.year;
  var HALF = qs.get('half') === '2' ? 2 : (qs.get('half') === '1' ? 1 : D.INPUT.half);
  var ORG = qs.get('company') || D.INPUT.companyName;

  var input = {
    companyName: ORG,
    year: D.INPUT.year,          // 入参年 = 数据所属年份，不由 URL 覆盖
    half: HALF,
    emission: D.INPUT.emission
  };

  var d = S.buildHalf(YEAR, HALF, input);
  var PERIOD_CN = YEAR + '年' + (HALF === 1 ? '1—6月' : '7—12月');

  /** 报告期是否一个月的数都没有：整篇进入「无有效数据」态 */
  var EMPTY = d.availableCount === 0;

  var availMonths = d.months.filter(function (m) { return m.has; });
  var emSorted = availMonths.slice().sort(function (a, b) { return b.emission - a.emission; });
  var maxM = emSorted[0] || null;
  var minM = emSorted[emSorted.length - 1] || null;

  var intSorted = availMonths
    .filter(function (m) { return m.intensity != null; })
    .sort(function (a, b) { return a.intensity - b.intensity; });
  var bestInt = intSorted[0] || null;
  var worstInt = intSorted[intSorted.length - 1] || null;

  /** 强度走势判断：首月 vs 末月 */
  var trendWord = (function () {
    var pts = availMonths.filter(function (m) { return m.intensity != null; });
    if (pts.length < 2) return '强度走势暂不可判';
    var first = pts[0].intensity, last = pts[pts.length - 1].intensity;
    if (last < first) return '强度总体呈下降走势';
    if (last > first) return '强度总体呈上升走势';
    return '强度总体保持平稳';
  })();

  /* ---------- 图表：折线（纯 SVG） ---------- */

  /**
   * N 点折线图
   * @param {Array}  points [{ label, value, has, isCur }]
   * @param {string} unit   纵轴单位
   * @param {number} dec    刻度小数位
   */
  function lineChartN(points, unit, dec) {
    var W = 760, H = 250, PL = 66, PR = 24, PT = 26, PB = 38;
    var iw = W - PL - PR, ih = H - PT - PB;
    var n = points.length;

    var avail = points.filter(function (p) { return p.has && p.value != null; });
    if (!avail.length) {
      return '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet">'
        + '<text x="' + (W / 2) + '" y="' + (H / 2) + '" font-size="13" fill="#98a1ab" text-anchor="middle">本期暂无数据</text>'
        + '</svg>';
    }

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

    // 横轴标签（未发生月份仍保留灰色标签）
    points.forEach(function (p, i) {
      s += '<text x="' + X(i).toFixed(1) + '" y="' + (H - 14) + '" font-size="10.5" fill="'
        + (p.has ? '#98a1ab' : '#d0d5db') + '" text-anchor="middle">' + esc(p.label) + '</text>';
    });

    // 折线（仅连已发生且有值的月份）
    var idx = [];
    points.forEach(function (p, i) { if (p.has && p.value != null) idx.push(i); });
    if (idx.length > 1) {
      var pts = idx.map(function (i) { return X(i).toFixed(1) + ',' + Yv(points[i].value).toFixed(1); }).join(' ');
      s += '<polyline points="' + pts + '" fill="none" stroke="' + GREEN + '" stroke-width="2.2" stroke-linejoin="round"/>';
    }

    // 数据点 + 报告期末月高亮
    points.forEach(function (p, i) {
      if (!p.has || p.value == null) return;
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

  /* ---------- 摘要 · 核心指标概览 ---------- */

  var summary = (function () {
    var html = '<div class="kpi-grid">'
      + '<div class="kpi-card is-self"><div class="kpi-name">' + esc(d.halfName) + '累计排放量</div>'
      + '<div class="kpi-val">' + fmt(d.totalEmission, 2) + '<small> 万tCO₂</small></div>'
      + '<div class="kpi-delta ' + deltaCls(d.yoyEmissionPct) + '">' + yoyKpi(d.yoyEmissionPct) + '</div></div>'

      + '<div class="kpi-card"><div class="kpi-name">月均排放量</div>'
      + '<div class="kpi-val">' + fmt(d.avgEmission, 2) + '<small> 万tCO₂/月</small></div>'
      + '<div class="kpi-delta is-flat">按 ' + d.availableCount + ' 个月平均</div></div>'

      + '<div class="kpi-card is-self"><div class="kpi-name">单位' + esc(d.product) + '碳排放量</div>'
      + '<div class="kpi-val">' + fmt(d.unitIntensity, 4) + '<small> ' + esc(d.intUnit) + '</small></div>'
      + '<div class="kpi-delta ' + deltaCls(d.yoyIntensityPct) + '">' + yoyKpi(d.yoyIntensityPct) + '</div></div>'
      + '</div>';

    html += '<ul class="point-list">'
      + '<li>' + PERIOD_CN + '企业层级累计碳排放量 <strong>' + fmt(d.totalEmission, 2) + '</strong> 万tCO₂，'
      + yoyPhrase(d.yoyEmissionPct) + '。</li>'
      + '<li>单位' + esc(d.product) + '碳排放量 <strong>' + fmt(d.unitIntensity, 4) + '</strong> ' + esc(d.intUnit) + '，'
      + yoyPhrase(d.yoyIntensityPct)
      + (d.yoyIntensityPct == null ? '。' : '，是本期减排成效的核心体现。') + '</li>';

    if (EMPTY) {
      html += '<li>本期未提供逐月排放数据，排放量区间与高低月份暂不可判。</li>'
        + '<li>报告期共 0 个月已发生，数据补齐后即可生成逐月走势分析。</li>';
    } else {
      html += '<li>逐月排放量介于 ' + fmt(minM.emission, 2) + ' ~ ' + fmt(maxM.emission, 2)
        + ' 万tCO₂ 之间，最高月为 ' + esc(maxM.label) + '，最低月为 ' + esc(minM.label) + '。</li>'
        + '<li>报告期共 <strong>' + d.availableCount + '</strong> 个月已发生，'
        + esc(trendWord) + '，逐月数据以企业月度碳排放核算台账为准。</li>';
    }

    html += '</ul>';
    return html;
  })();

  /* ---------- 一、报告概述 ---------- */

  var overview = (function () {
    var rows = [
      ['核算主体', esc(ORG)],
      ['核算边界', '企业层级：法人边界内的化石燃料燃烧排放、过程排放与含碳产品隐含排放'],
      ['报告期', esc(PERIOD_CN) + '（' + esc(d.rangeText) + '）']
    ];
    var html = '<p class="brief-p">本报告为 ' + esc(ORG) + ' ' + esc(YEAR + ' 年' + d.halfName) + '碳排放核算结果，'
      + '核算边界为企业层级，报告期 ' + esc(d.rangeText)
      + '，共 ' + d.availableCount + ' 个月。核算基准信息如下。</p>'
      + '<table class="kv-table"><tbody>';
    rows.forEach(function (r) {
      html += '<tr><th>' + esc(r[0]) + '</th><td>' + r[1] + '</td></tr>';
    });
    html += '</tbody></table>';

    html += '<div class="brief-h2">（一）核算口径说明</div>'
      + '<ul class="point-list">'
      + '<li><strong>报告期排放量</strong>为报告期内各月实际排放量的累计，只统计<strong>已发生月份</strong>；'
      + '报告期尚未发生的月份不计入合计，也不参与占比。</li>'
      + '<li><strong>单位' + esc(d.product) + '碳排放量</strong>按报告期累计口径给出，'
      + '由企业报告期核算结果直接获得，<strong>不是各月强度的算术平均</strong>。</li>'
      + '<li>逐月排放量与强度均取企业月度碳排放核算台账数据；未经第三方核查的月度数据不作为对外披露口径。</li>'
      + '</ul>';

    return html;
  })();

  /* ---------- 二、逐月排放与强度走势 ---------- */

  var trendSection = (function () {
    var emPoints = d.months.map(function (m) {
      return {
        label: m.label,
        value: m.emission,
        has: m.has,
        isCur: m.has && m.no === (HALF === 1 ? 6 : 12)
      };
    });
    var intPoints = d.months.map(function (m) {
      return {
        label: m.label,
        value: m.intensity,
        has: m.has && m.intensity != null,
        isCur: m.has && m.intensity != null && m.no === (HALF === 1 ? 6 : 12)
      };
    });

    var html;
    if (EMPTY) {
      html = '<p class="brief-p">本期未提供逐月排放数据，暂不作走势分析。'
        + '逐月数据补齐后即可自动生成排放量与强度走势图。</p>';
    } else {
      html = '<p class="brief-p">' + esc(PERIOD_CN) + '逐月排放量介于 '
        + fmt(minM.emission, 2) + ' ~ ' + fmt(maxM.emission, 2) + ' 万tCO₂ 之间，'
        + '单位' + esc(d.product) + '碳排放量介于 ' + fmt(bestInt ? bestInt.intensity : null, 4) + ' ~ '
        + fmt(worstInt ? worstInt.intensity : null, 4) + ' ' + esc(d.intUnit) + ' 之间，'
        + '整体呈<strong>排放量随生产负荷波动</strong>的走势，' + esc(trendWord) + '。</p>';
    }

    html += chartBlock(lineChartN(emPoints, '万tCO₂', 1),
      '（图 1）' + esc(PERIOD_CN) + '逐月碳排放量走势（万tCO₂）');

    html += chartBlock(lineChartN(intPoints, d.intUnit, 4),
      '（图 2）' + esc(PERIOD_CN) + '逐月单位' + esc(d.product) + '碳排放量走势（' + esc(d.intUnit) + '）');

    html += '<div class="table-caption"><span>逐月生产与排放数据表（' + esc(PERIOD_CN) + '）</span>'
      + '<span class="unit">强度：' + esc(d.intUnit) + '；排放量：万tCO₂</span></div>'
      + '<table class="btable"><thead><tr>'
      + '<th>月份</th><th>单位' + esc(d.product) + '碳排放量（' + esc(d.intUnit) + '）</th>'
      + '<th>碳排放量（万tCO₂）</th><th>占报告期累计比重</th>'
      + '</tr></thead><tbody>';

    d.months.forEach(function (m) {
      // 报告期尚未发生的月份显示占位符，不计入合计与占比
      if (!m.has) {
        html += '<tr class="is-empty"><td>' + esc(m.label) + '</td>'
          + '<td>—</td><td>—</td><td>—</td></tr>';
        return;
      }
      var share = d.totalEmission > 0 ? fmt(m.emission / d.totalEmission * 100, 2) + '%' : '--';
      html += '<tr><td>' + esc(m.label) + '</td>'
        + '<td>' + fmt(m.intensity, 4) + '</td>'
        + '<td>' + fmt(m.emission, 2) + '</td>'
        + '<td>' + share + '</td></tr>';
    });

    html += '</tbody><tfoot>'
      + '<tr><td>合计</td>'
      + '<td>' + fmt(d.unitIntensity, 4) + '</td>'
      + '<td>' + fmt(d.totalEmission, 2) + '</td>'
      + '<td>' + (d.totalEmission > 0 ? '100.00%' : '--') + '</td></tr>'
      + '</tfoot></table>'
      + '<div class="btable-note">注：合计栏的「单位' + esc(d.product) + '碳排放量」为报告期累计口径，'
      + '非各月强度的算术平均；「占报告期累计比重」按各月排放量 ÷ 报告期累计排放量计算。</div>';

    if (EMPTY) {
      html += '<ul class="point-list">'
        + '<li>本期无有效逐月排放数据，暂不作趋势分析。</li>'
        + '</ul>';
    } else {
      html += '<ul class="point-list">'
        + '<li>排放量最高月为 ' + esc(maxM.label) + '（' + fmt(maxM.emission, 2) + ' 万tCO₂），'
        + '最低月为 ' + esc(minM.label) + '（' + fmt(minM.emission, 2) + ' 万tCO₂），'
        + '月度波动主要来自生产负荷变化。</li>';

      if (bestInt && worstInt && availMonths.length > 1 && bestInt.no !== worstInt.no) {
        var firstI = availMonths[0].intensity, lastI = availMonths[availMonths.length - 1].intensity;
        var dropTxt = (firstI != null && lastI != null && firstI !== 0)
          ? '，累计' + (lastI < firstI ? '下降' : '上升') + ' '
            + fmt(Math.abs((lastI - firstI) / firstI * 100), 2) + '%'
          : '';
        html += '<li>单位' + esc(d.product) + '碳排放量由 ' + esc(availMonths[0].label) + ' 的 '
          + fmt(firstI, 4) + ' ' + esc(d.intUnit) + ' 变为 ' + esc(availMonths[availMonths.length - 1].label) + ' 的 '
          + fmt(lastI, 4) + ' ' + esc(d.intUnit) + dropTxt + '。</li>'
          + '<li>强度最优月为 ' + esc(bestInt.label) + '（' + fmt(bestInt.intensity, 4) + ' ' + esc(d.intUnit) + '），'
          + '最差月为 ' + esc(worstInt.label) + '（' + fmt(worstInt.intensity, 4) + ' ' + esc(d.intUnit) + '）。</li>';
      } else {
        html += '<li>报告期已发生月份不足两个月，强度走势与最优/最差月暂不可判。</li>';
      }

      html += '</ul>';
    }

    return html;
  })();

  /* ---------- 组装 ---------- */

  function buildReport() {
    var toc = [
      ['摘要 · 核心指标概览', '#sec-0'],
      ['一、报告概述', '#sec-1'],
      ['二、逐月排放与强度走势', '#sec-2']
    ];

    var sections = [
      ['sec-0', '摘要 · 核心指标概览', summary],
      ['sec-1', '一、报告概述', overview],
      ['sec-2', '二、逐月排放与强度走势', trendSection]
    ];

    var html = '<div class="brief-page brief-cover-wrap"><div class="brief-cover">'
      + '<div class="cover-kicker">碳 排 放 半 年 度 报 告</div>'
      + '<h1>' + esc(ORG) + '<br/>碳排放半年度报告</h1>'
      + '<div class="cover-month">' + esc(PERIOD_CN) + '</div>'
      + '<div class="cover-tab">碳排放 · 半年度报告</div>'
      + '<div class="cover-line"></div>'
      + '<div class="cover-foot">数据期间：' + esc(d.rangeText) + '</div>'
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
