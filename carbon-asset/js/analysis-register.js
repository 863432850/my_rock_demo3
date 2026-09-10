/**
 * 碳资产登记分析
 * 支持：趋势 / 均值 / 极值 / 同比 / 构成 / 分布 六维分析
 * 复用共享图表引擎 charts.js（离线 SVG，无外部依赖）
 */
(function () {
  'use strict';

  var MARKETS = ['全国碳市场', 'CCER碳市场', '北京碳市场', '天津碳市场', '重庆碳市场', '福建碳市场', '湖北碳市场'];
  var TYPES = ['配额', 'CCER', '减排量'];
  var STATUSES = ['已通过', '待审核', '已驳回'];

  // 市场 -> 类型映射
  var MARKET_TYPES = {
    '全国碳市场': ['配额'],
    'CCER碳市场': ['CCER'],
    '北京碳市场': ['配额'],
    '天津碳市场': ['配额'],
    '重庆碳市场': ['配额'],
    '福建碳市场': ['配额'],
    '湖北碳市场': ['配额'],
  };

  // 各市场各类型的月度登记量（tCO₂）——按【市场+类型】为维度，2025 / 2026 两期，覆盖 1~12 月
  // 结构: { market, type, base2026, base2025, pattern[] }
  // 用两组基数分别驱动 2026 与 2025，避免硬编码 12 个月，方便趋势/环比/极值
  var BASE = [
    { market: '全国碳市场', type: '配额', y26: 4200, y25: 3600 },
    { market: 'CCER碳市场', type: 'CCER', y26: 1600, y25: 900 },
    { market: '北京碳市场', type: '配额', y26: 700, y25: 640 },
    { market: '天津碳市场', type: '配额', y26: 620, y25: 560 },
    { market: '重庆碳市场', type: '配额', y26: 540, y25: 500 },
    { market: '福建碳市场', type: '配额', y26: 480, y25: 430 },
    { market: '湖北碳市场', type: '配额', y26: 660, y25: 600 },
  ];

  // 月度权重（体现季节性波动，用于生成 1~12 月的月值）
  var W = [0.9, 1.05, 1.2, 1.0, 0.85, 0.8, 0.95, 1.1, 1.25, 1.05, 0.9, 0.95];
  // 市场分布权重（构成图用）
  var M_W = { '全国碳市场': 0.4, 'CCER碳市场': 0.18, '北京碳市场': 0.09, '天津碳市场': 0.08, '重庆碳市场': 0.07, '福建碳市场': 0.06, '湖北碳市场': 0.12 };

  function pad(n) { return String(n).padStart(2, '0'); }
  function ym(y, m) { return y + '-' + pad(m); }

  // 归一化权重 1~12 月
  var WSUM = W.reduce(function (a, b) { return a + b; }, 0);

  /** 生成某市场某类型在某个年度的 12 个月登记量数组 */
  function yearSeries(base, year) {
    var key = year === '2026' ? base.y26 : base.y25;
    return W.map(function (w) { return Math.round(key * w / WSUM); });
  }

  /** 查询区间内的月度明细行：{ y, m, ym, market, type, value, status, count } */
  function buildDetail(query) {
    var rows = [];
    var start = query.start, end = query.end;
    // 逐月遍历
    var sy = Number(start.slice(0, 4)), sm = Number(start.slice(5, 7));
    var ey = Number(end.slice(0, 4)), em = Number(end.slice(5, 7));
    var y = sy, m = sm;
    while (y < ey || (y === ey && m <= em)) {
      var key = ym(y, m);
      var year = String(y);
      BASE.forEach(function (b) {
        // 该市场类型是否匹配筛选
        if (query.market !== '全部' && b.market !== query.market) return;
        if (query.type !== '全部' && b.type !== query.type) return;
        var series = yearSeries(b, year);
        var value = series[m - 1];
        // 状态随机生成为已通过(70%) / 待审核(20%) / 已驳回(10%)
        var status = pickStatus(b.market, key, m);
        rows.push({
          y: y, m: m, ym: key, year: year, market: b.market, type: b.type,
          value: value, count: Math.max(1, Math.round(value / 40)),
          status: status,
        });
      });
      m += 1;
      if (m > 12) { m = 1; y += 1; }
    }
    // 应用状态筛选
    if (query.status !== '全部') rows = rows.filter(function (r) { return r.status === query.status; });
    return rows;
  }

  function pickStatus(market, key, m) {
    // 用稳定哈希让状态可复现
    var hash = 0;
    var s = market + key;
    for (var i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) % 1000;
    var v = hash + m * 17;
    if (v % 10 < 7) return '已通过';
    if (v % 10 < 9) return '待审核';
    return '已驳回';
  }

  /** 按统计粒度聚合 → 趋势序列 [{ym, label, value, isMax, isMin}] */
  function trendSeries(detail, grain) {
    var groups = {};
    detail.forEach(function (r) {
      var key = r.ym;
      var label = r.y + '年' + r.m + '月';
      if (grain === 'quarter') {
        var q = Math.ceil(r.m / 3);
        key = r.y + '-Q' + q;
        label = r.y + '年Q' + q;
      }
      if (!groups[key]) groups[key] = { key: key, label: label, value: 0, sort: r.y * 100 + r.m };
      groups[key].value += r.value;
    });
    var arr = Object.keys(groups).map(function (k) { return groups[k]; })
      .sort(function (a, b) { return a.sort - b.sort; });
    // 标记极值
    if (arr.length) {
      var max = arr.reduce(function (a, b) { return b.value > a.value ? b : a; });
      var min = arr.reduce(function (a, b) { return b.value < a.value ? b : a; });
      arr.forEach(function (g) {
        g.isMax = g.key === max.key;
        g.isMin = g.key === min.key;
      });
    }
    return arr;
  }

  /** 同比：本期(2026) vs 同期(2025)，按粒度聚合，label 取本期月份 */
  function yoySeries(detail, grain) {
    var cur = {}, last = {};
    detail.forEach(function (r) {
      var buck = r.year === '2026' ? cur : last;
      var key = r.ym, label = r.y + '年' + r.m + '月', sort = r.y * 100 + r.m;
      if (grain === 'quarter') {
        var q = Math.ceil(r.m / 3);
        key = r.y + '-Q' + q; label = r.y + '年Q' + q;
      }
      if (!buck[key]) buck[key] = { key: key, label: label, value: 0, sort: sort };
      buck[key].value += r.value;
    });
    // 合并：本期为主，取同期(去年同月/同季)
    var rows = [];
    Object.keys(cur).forEach(function (k) {
      var c = cur[k];
      var q = grain === 'quarter' ? (c.label.match(/Q(\d)/) ? Number(c.label.match(/Q(\d)/)[1]) : null) : null;
      var lastKey = grain === 'quarter'
        ? (Number(c.label.slice(0, 4)) - 1) + '-Q' + q
        : String(Number(c.label.slice(0, 4)) - 1) + '-' + c.label.slice(5);
      var l = last[lastKey];
      rows.push({ label: c.label, current: c.value, last: l ? l.value : 0, sort: c.sort });
    });
    return rows.sort(function (a, b) { return a.sort - b.sort; });
  }

  /** 构成：按市场合计 */
  function mixByMarket(detail) {
    var map = {};
    detail.forEach(function (r) {
      if (!map[r.market]) map[r.market] = 0;
      map[r.market] += r.value;
    });
    return Object.keys(map).map(function (k) { return { label: k, value: map[k] }; })
      .sort(function (a, b) { return b.value - a.value; });
  }

  /** 分布：按市场合计，横向条形 */
  function distByMarket(detail) {
    var map = {};
    detail.forEach(function (r) {
      if (!map[r.market]) map[r.market] = 0;
      map[r.market] += r.value;
    });
    return Object.keys(map).map(function (k) { return { label: k, value: map[k] }; })
      .sort(function (a, b) { return b.value - a.value; });
  }

  // ---- 渲染辅助 ----
  function esc(s) { return caChart.esc(s); }
  function fmt(v) { return caChart.fmt(v); }

  function fillSelect(el, options, selected) {
    el.innerHTML = options.map(function (o) {
      var v = typeof o === 'string' ? o : o.id;
      var l = typeof o === 'string' ? o : o.name;
      return '<option value="' + esc(v) + '"' + (v === selected ? ' selected' : '') + '>' + esc(l) + '</option>';
    }).join('');
  }

  function fmtPct(n, d) { return caChart.fmtPct(n, d == null ? 1 : d); }

  function renderTrend(chartEl, insightEl, series) {
    if (!series.length) { chartEl.innerHTML = '<div class="ca-empty">暂无数据</div>'; return; }
    var data = series.map(function (s) {
      return { label: s.label, value: s.value, isMax: s.isMax, isMin: s.isMin };
    });
    chartEl.innerHTML = caChart.line({
      title: '',
      series: [{ name: '登记量', color: '#00a854', data: data }],
      unit: 'tCO₂', width: 960, height: 300, showMean: true,
    });
    // 极值/均值 insights
    var vals = series.map(function (s) { return s.value; });
    var stat = caChart.statInsight(vals, 'tCO₂');
    var maxPt = series.find(function (s) { return s.isMax; });
    var minPt = series.find(function (s) { return s.isMin; });
    var total = vals.reduce(function (a, b) { return a + b; }, 0);
    insightEl.innerHTML =
      '<div class="ca-insight"><div class="ca-insight-label">峰值</div><div class="ca-insight-value">' + fmt(stat.max) + '<span class="unit">tCO₂</span></div><div class="ca-insight-desc">' + esc(maxPt.label) + '</div></div>'
      + '<div class="ca-insight is-lite"><div class="ca-insight-label">谷值</div><div class="ca-insight-value">' + fmt(stat.min) + '<span class="unit">tCO₂</span></div><div class="ca-insight-desc">' + esc(minPt.label) + '</div></div>'
      + '<div class="ca-insight"><div class="ca-insight-label">均值</div><div class="ca-insight-value">' + fmt(stat.mean) + '<span class="unit">tCO₂</span></div><div class="ca-insight-desc">区间平均登记量</div></div>'
      + '<div class="ca-insight is-warn"><div class="ca-insight-label">区间总量</div><div class="ca-insight-value">' + fmt(total) + '<span class="unit">tCO₂</span></div><div class="ca-insight-desc">共 ' + series.length + ' 个统计期</div></div>';
  }

  function renderYoy(el, rows) {
    if (!rows.length) { el.innerHTML = '<div class="ca-empty">暂无数据</div>'; return; }
    el.innerHTML = caChart.groupBar({
      title: '登记量同比（本期 vs 上年同期）',
      groups: rows.map(function (r) { return { label: shortLabel(r.label), current: r.current, last: r.last }; }),
      unit: 'tCO₂', currentName: '本期', lastName: '同期', width: 520, height: 280,
    });
  }

  function shortLabel(label) {
    // "2026年1月" → "26-1"，"2026年Q1" → "26Q1"
    var m = label.match(/(\d{4})年(?:(\d+)月|Q(\d))/);
    if (!m) return label;
    var y = m[1].slice(2);
    return m[3] ? y + 'Q' + m[3] : y + '-' + m[2];
  }

  function renderMix(el, items) {
    if (!items.length) { el.innerHTML = '<div class="ca-empty">暂无数据</div>'; return; }
    var colors = caChart.PALETTE;
    var colored = items.map(function (it, i) {
      return { label: it.label, value: it.value, color: colors[i % colors.length] };
    });
    el.innerHTML = caChart.donut({
      title: '',
      items: colored, size: 300, thickness: 26, unit: 'tCO₂',
      centerTitle: '登记总量', centerValue: items.reduce(function (a, b) { return a + b.value; }, 0),
    });
  }

  function renderDist(el, items) {
    if (!items.length) { el.innerHTML = '<div class="ca-empty">暂无数据</div>'; return; }
    var colors = caChart.PALETTE;
    var colored = items.map(function (it, i) {
      return { label: it.label, value: it.value, color: colors[i % colors.length] };
    });
    el.innerHTML = caChart.hBar({
      title: '', items: colored, unit: 'tCO₂', width: 900, height: 250, barH: 22, gap: 12,
    });
  }

  function renderTable(el, detail) {
    // 按市场+时间聚合展示
    var map = {};
    detail.forEach(function (r) {
      var key = r.market + '|' + r.ym;
      if (!map[key]) map[key] = { ym: r.ym, market: r.market, type: r.type, count: 0, value: 0, passed: 0, pending: 0, rejected: 0 };
      map[key].count += r.count;
      map[key].value += r.value;
      if (r.status === '已通过') map[key].passed += r.value;
      if (r.status === '待审核') map[key].pending += r.value;
      if (r.status === '已驳回') map[key].rejected += r.value;
    });
    var rows = Object.keys(map).map(function (k) { return map[k]; })
      .sort(function (a, b) { return b.ym.localeCompare(a.ym) || a.market.localeCompare(b.market); });

    if (!rows.length) { el.innerHTML = '<tr><td colspan="7" class="ca-empty">暂无匹配数据</td></tr>'; return; }
    el.innerHTML = rows.map(function (r, i) {
      var yoy = 0; // 同比占位
      return '<tr>'
        + '<td>' + esc(r.ym.replace('-', '年') + '月') + '</td>'
        + '<td>' + esc(r.market) + '</td>'
        + '<td>' + esc(r.type) + '</td>'
        + '<td>' + fmt(r.count) + '</td>'
        + '<td class="is-num">' + fmt(r.value) + '</td>'
        + '<td class="is-num">' + (i % 5) + '.' + (i % 10) + '</td>'
        + '<td>' + statusTag(r) + '</td>'
        + '</tr>';
    }).join('');
  }

  function statusTag(r) {
    if (r.passed >= r.value * 0.9) return '<span class="ca-tag b-green">已通过</span>';
    if (r.pending > 0 && r.pending >= r.rejected) return '<span class="ca-tag b-orange">待审核</span>';
    return '<span class="ca-tag b-red">已驳回</span>';
  }

  // ---- 初始化 ----
  function init() {
    initLayout('analysis-register', { moduleId: 'carbon-asset', pageTitle: '碳资产登记分析' });

    var state = { grain: 'month' };
    var detail = [];

    var marketSel = document.getElementById('r-market');
    var typeSel = document.getElementById('r-type');
    fillSelect(marketSel, ['全部'].concat(MARKETS), '全部');
    fillSelect(typeSel, ['全部'].concat(TYPES), '全部');
    fillSelect(document.getElementById('r-status'), ['全部'].concat(STATUSES), '全部');

    // 日期默认：2025-01 ~ 2026-12
    var startEl = document.getElementById('r-start');
    var endEl = document.getElementById('r-end');
    startEl.value = '2025-01';
    endEl.value = '2026-12';

    function readForm() {
      return {
        market: marketSel.value,
        type: typeSel.value,
        status: document.getElementById('r-status').value,
        start: startEl.value || '2025-01',
        end: endEl.value || '2026-12',
      };
    }

    function normalizeRange(q) {
      if (q.start > q.end) { var t = q.start; q.start = q.end; q.end = t; }
      startEl.value = q.start; endEl.value = q.end;
    }

    function apply() {
      var q = readForm();
      normalizeRange(q);
      detail = buildDetail(q);

      assignKpis(detail);
      renderTrend(document.getElementById('r-trend-chart'), document.getElementById('r-trend-insights'), trendSeries(detail, state.grain));
      renderYoy(document.getElementById('r-yoy-chart'), yoySeries(detail, state.grain));
      renderMix(document.getElementById('r-mix-chart'), mixByMarket(detail));
      renderDist(document.getElementById('r-dist-chart'), distByMarket(detail));
      renderTable(document.getElementById('r-table-body'), detail);
      renderGrain();
    }

    function assignKpis(d) {
      var total = d.reduce(function (a, r) { return a + r.value; }, 0);
      var count = d.reduce(function (a, r) { return a + r.count; }, 0);
      var passed = d.filter(function (r) { return r.status === '已通过'; }).reduce(function (a, r) { return a + r.value; }, 0);
      var rate = total > 0 ? passed / total : 0;
      // 月均 = 总量 / 覆盖月份数
      var months = new Set(d.map(function (r) { return r.ym; })).size;
      var avg = months > 0 ? total / months : 0;
      document.getElementById('k-registers').innerHTML = fmt(count) + '<span class="unit">笔</span>';
      document.getElementById('k-amount').innerHTML = fmt(total) + '<span class="unit">tCO₂</span>';
      var amtSub = d.length ? (d[0].market + '等 · ' + months + '期') : '--';
      document.getElementById('k-amount-sub').textContent = amtSub;
      document.getElementById('k-rate').innerHTML = fmtPct(rate, 1);
      document.getElementById('k-avg').innerHTML = fmt(avg) + '<span class="unit">tCO₂/月</span>';
    }

    function renderGrain() {
      document.querySelectorAll('.ca-grain-tab').forEach(function (b) {
        b.classList.toggle('active', b.getAttribute('data-grain') === state.grain);
      });
    }

    document.querySelectorAll('.ca-grain-tab').forEach(function (b) {
      b.addEventListener('click', function () {
        state.grain = b.getAttribute('data-grain');
        apply();
      });
    });

    document.getElementById('r-search').addEventListener('click', function () {
      apply();
      toast('查询完成');
    });

    document.getElementById('r-reset').addEventListener('click', function () {
      marketSel.value = '全部';
      typeSel.value = '全部';
      document.getElementById('r-status').value = '全部';
      startEl.value = '2025-01';
      endEl.value = '2026-12';
      state.grain = 'month';
      apply();
      toast('已重置');
    });

    apply();
  }

  if (document.querySelector('.ca-page')) init();
})();
