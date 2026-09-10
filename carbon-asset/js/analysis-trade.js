/**
 * 碳资产交易分析
 * 支持：趋势 / 均值 / 极值 / 同比 / 构成 / 分布 六维分析
 * 复用 charts.js
 */
(function () {
  'use strict';

  var MARKETS = ['全国碳市场', 'CCER碳市场', '北京碳市场', '天津碳市场', '重庆碳市场', '福建碳市场', '湖北碳市场'];
  var DIRS = ['买入', '卖出'];
  var TYPES = ['配额', 'CCER', '减排量'];

  // 每市场每月的基准成交量(tCO₂)；价格(元/t)用于算成交额
  var BASE = {
    '全国碳市场': { vol: 2600, price: 92 },
    'CCER碳市场': { vol: 1200, price: 68 },
    '北京碳市场': { vol: 480, price: 110 },
    '天津碳市场': { vol: 420, price: 96 },
    '重庆碳市场': { vol: 380, price: 88 },
    '福建碳市场': { vol: 330, price: 82 },
    '湖北碳市场': { vol: 450, price: 90 },
  };
  // 月权重
  var W = [1.0, 0.9, 1.15, 1.3, 1.05, 0.85, 0.8, 0.95, 1.2, 1.1, 0.9, 1.0];
  var WSUM = W.reduce(function (a, b) { return a + b; }, 0);

  function pad(n) { return String(n).padStart(2, '0'); }
  function ym(y, m) { return y + '-' + pad(m); }

  function yearFactor(year) { return year === '2026' ? 1.0 : 0.82; }

  /** 某年月某市场的成交记录：买入量 + 卖出量(略少)、市场价 */
  function monthVol(market, y, m) {
    var b = BASE[market];
    var f = yearFactor(y) * (W[m - 1] / WSUM);
    return Math.round(b.vol * f);
  }

  function marketPrice(market, y, m) {
    var b = BASE[market];
    // 价格随年略微变化
    return Math.round(b.price * yearFactor(y) * (0.9 + (m % 3) * 0.05));
  }

  function buildRows(query) {
    var rows = [];
    var sy = Number(query.start.slice(0, 4)), sm = Number(query.start.slice(5, 7));
    var ey = Number(query.end.slice(0, 4)), em = Number(query.end.slice(5, 7));
    var y = sy, m = sm;
    while (y < ey || (y === ey && m <= em)) {
      MARKETS.forEach(function (market) {
        if (query.market !== '全部' && market !== query.market) return;
        // 该市场类型
        var type = market === 'CCER碳市场' ? 'CCER' : '配额';
        if (query.type !== '全部' && type !== query.type) return;
        var tVol = monthVol(market, y, m);
        var price = marketPrice(market, y, m);
        // 买入 55% / 卖出 45%
        var buy = Math.round(tVol * 0.55);
        var sell = tVol - buy;
        if (query.dir === '买入' || query.dir === '全部') {
          rows.push({ y: y, m: m, ym: ym(y, m), year: String(y), market: market, type: type, dir: '买入', vol: buy, price: price, amount: buy * price });
        }
        if (query.dir === '卖出' || query.dir === '全部') {
          rows.push({ y: y, m: m, ym: ym(y, m), year: String(y), market: market, type: type, dir: '卖出', vol: sell, price: price, amount: sell * price });
        }
      });
      m += 1; if (m > 12) { m = 1; y += 1; }
    }
    return rows;
  }

  /** 趋势序列：成交量(主轴) + 成交额(万元，另一序列但同一轴为演示) */
  function trendSeries(rows, grain) {
    var groups = {};
    rows.forEach(function (r) {
      var key = r.ym, label = r.y + '年' + r.m + '月', sort = r.y * 100 + r.m;
      if (grain === 'quarter') {
        var q = Math.ceil(r.m / 3);
        key = r.y + '-Q' + q; label = r.y + '年Q' + q;
      }
      if (!groups[key]) groups[key] = { key: key, label: label, vol: 0, amount: 0, sort: sort };
      groups[key].vol += r.vol;
      groups[key].amount += r.amount;
    });
    var arr = Object.keys(groups).map(function (k) { return groups[k]; }).sort(function (a, b) { return a.sort - b.sort; });
    if (arr.length) {
      var max = arr.reduce(function (a, b) { return b.vol > a.vol ? b : a; });
      var min = arr.reduce(function (a, b) { return b.vol < a.vol ? b : a; });
      arr.forEach(function (g) { g.isMax = g.key === max.key; g.isMin = g.key === min.key; });
    }
    return arr;
  }

  function yoySeries(rows, grain) {
    var cur = {}, last = {};
    rows.forEach(function (r) {
      var buck = r.year === '2026' ? cur : last;
      var key = r.ym, label = r.y + '年' + r.m + '月', sort = r.y * 100 + r.m;
      if (grain === 'quarter') {
        var q = Math.ceil(r.m / 3);
        key = r.y + '-Q' + q; label = r.y + '年Q' + q;
      }
      if (!buck[key]) buck[key] = { key: key, label: label, vol: 0, sort: sort };
      buck[key].vol += r.vol;
    });
    var out = [];
    Object.keys(cur).forEach(function (k) {
      var c = cur[k];
      var q = grain === 'quarter' ? (c.label.match(/Q(\d)/) ? Number(c.label.match(/Q(\d)/)[1]) : null) : null;
      var lastKey = grain === 'quarter'
        ? (Number(c.label.slice(0, 4)) - 1) + '-Q' + q
        : String(Number(c.label.slice(0, 4)) - 1) + '-' + c.label.slice(5);
      var l = last[lastKey];
      out.push({ label: c.label, current: c.vol, last: l ? l.vol : 0, sort: c.sort });
    });
    return out.sort(function (a, b) { return a.sort - b.sort; });
  }

  function mixByMarket(rows) {
    var map = {};
    rows.forEach(function (r) {
      if (!map[r.market]) map[r.market] = 0;
      map[r.market] += r.vol;
    });
    return Object.keys(map).map(function (k) { return { label: k, value: map[k] }; }).sort(function (a, b) { return b.value - a.value; });
  }

  function mixByDir(rows) {
    var map = {};
    rows.forEach(function (r) {
      if (!map[r.dir]) map[r.dir] = 0;
      map[r.dir] += r.vol;
    });
    return Object.keys(map).map(function (k) { return { label: k, value: map[k] }; });
  }

  function extremeTable(rows, grain) {
    // 先聚合到粒度，找回量最大的市场明细
    var trends = trendSeries(rows, grain);
    if (!trends.length) return [];
    var maxT = trends.reduce(function (a, b) { return b.vol > a.vol ? b : a; });
    var minT = trends.reduce(function (a, b) { return b.vol < a.vol ? b : a; });
    // 取最大/最小的市场子集展示
    return [
      { kind: '峰值', meta: maxT, rows: rows.filter(function (r) { return matchGrain(r, maxT, grain); }) },
      { kind: '谷值', meta: minT },
    ];
  }

  function matchGrain(r, meta, grain) {
    var key = grain === 'quarter' ? (r.y + '-Q' + Math.ceil(r.m / 3)) : r.ym;
    return key === meta.key;
  }

  function renderExtremeTable(el, rows, grain) {
    var trends = trendSeries(rows, grain);
    if (!trends.length) { el.innerHTML = '<tr><td colspan="7" class="ca-empty">暂无数据</td></tr>'; return; }
    var maxT = trends.reduce(function (a, b) { return b.vol > a.vol ? b : a; });
    var minT = trends.reduce(function (a, b) { return b.vol < a.vol ? b : a; });
    var picks = [maxT, minT];
    var out = [];
    picks.forEach(function (t) {
      var sub = rows.filter(function (r) { return matchGrain(r, t, grain); });
      var tag = t.key === maxT.key
        ? '<span class="ca-tag b-red">峰值</span>'
        : '<span class="ca-tag b-blue">谷值</span>';
      sub.sort(function (a, b) { return b.vol - a.vol; });
      sub.forEach(function (r, i) {
        out.push('<tr>'
          + '<td>' + esc(t.label) + '</td>'
          + '<td>' + esc(r.market) + '</td>'
          + '<td>' + esc(r.dir) + '</td>'
          + '<td class="is-num">' + fmt(r.vol) + '</td>'
          + '<td class="is-num">' + fmt(r.amount) + '</td>'
          + '<td class="is-num">' + fmt(r.price) + '</td>'
          + '<td>' + tag + '</td>'
          + '</tr>');
      });
    });
    el.innerHTML = out.join('');
  }

  // ---- 渲染 ----
  function esc(s) { return caChart.esc(s); }
  function fmt(v) { return caChart.fmt(v); }
  function fmtWan(v) { return caChart.fmtWan(v, 2); }
  function fmtPct(n, d) { return caChart.fmtPct(n, d == null ? 1 : d); }

  function fillSelect(el, options, selected) {
    el.innerHTML = options.map(function (o) {
      var v = typeof o === 'string' ? o : o.id;
      var l = typeof o === 'string' ? o : o.name;
      return '<option value="' + esc(v) + '"' + (v === selected ? ' selected' : '') + '>' + esc(l) + '</option>';
    }).join('');
  }

  function shortLabel(label) {
    var m = label.match(/(\d{4})年(?:(\d+)月|Q(\d))/);
    if (!m) return label;
    var y = m[1].slice(2);
    return m[3] ? y + 'Q' + m[3] : y + '-' + m[2];
  }

  function init() {
    initLayout('analysis-trade', { moduleId: 'carbon-asset', pageTitle: '碳资产交易分析' });
    var state = { grain: 'month' };
    var rows = [];

    var marketSel = document.getElementById('t-market');
    var dirSel = document.getElementById('t-dir');
    var typeSel = document.getElementById('t-type');
    fillSelect(marketSel, ['全部'].concat(MARKETS), '全部');
    fillSelect(dirSel, ['全部'].concat(DIRS), '全部');
    fillSelect(typeSel, ['全部'].concat(TYPES), '全部');

    var startEl = document.getElementById('t-start');
    var endEl = document.getElementById('t-end');
    startEl.value = '2025-01';
    endEl.value = '2026-12';

    function readForm() {
      return {
        market: marketSel.value, dir: dirSel.value, type: typeSel.value,
        start: startEl.value || '2025-01', end: endEl.value || '2026-12',
      };
    }
    function normalizeRange(q) {
      if (q.start > q.end) { var t = q.start; q.start = q.end; q.end = t; }
      startEl.value = q.start; endEl.value = q.end;
    }

    function apply() {
      var q = readForm();
      normalizeRange(q);
      rows = buildRows(q);
      assignKpis(rows, q);
      renderTrend(document.getElementById('t-trend-chart'), document.getElementById('t-trend-insights'), trendSeries(rows, state.grain));
      renderYoy(document.getElementById('t-yoy-chart'), yoySeries(rows, state.grain));
      renderMix(document.getElementById('t-mix-chart'), mixByMarket(rows));
      renderDist(document.getElementById('t-dist-chart'), mixByMarket(rows));
      renderDir(document.getElementById('t-dir-chart'), mixByDir(rows));
      renderExtremeTable(document.getElementById('t-extreme-body'), rows, state.grain);
      renderGrain();
    }

    function renderTrend(chartEl, insightEl, series) {
      if (!series.length) { chartEl.innerHTML = '<div class="ca-empty">暂无数据</div>'; renderInsights(insightEl, []); return; }
      var volData = series.map(function (s) { return { label: s.label, value: s.vol, isMax: s.isMax, isMin: s.isMin }; });
      var amtData = series.map(function (s) { return { label: s.label, value: +(s.amount / 10000).toFixed(2) }; });
      chartEl.innerHTML = caChart.line({
        title: '', series: [
          { name: '成交量', color: '#00a854', data: volData },
          { name: '成交额(万元)', color: '#1890ff', data: amtData },
        ], unit: 'tCO₂', width: 960, height: 300, showMean: true, xLabelFmt: shortLabel,
      });
      renderInsights(insightEl, series);
    }

    function renderInsights(el, series) {
      var vals = series.map(function (s) { return s.vol; });
      if (!vals.length) { el.innerHTML = ''; return; }
      var stat = caChart.statInsight(vals, 'tCO₂');
      var maxPt = series.find(function (s) { return s.isMax; });
      var minPt = series.find(function (s) { return s.isMin; });
      el.innerHTML =
        '<div class="ca-insight"><div class="ca-insight-label">峰值成交量</div><div class="ca-insight-value">' + fmt(stat.max) + '<span class="unit">tCO₂</span></div><div class="ca-insight-desc">' + esc(maxPt.label) + '</div></div>'
        + '<div class="ca-insight is-lite"><div class="ca-insight-label">谷值成交量</div><div class="ca-insight-value">' + fmt(stat.min) + '<span class="unit">tCO₂</span></div><div class="ca-insight-desc">' + esc(minPt.label) + '</div></div>'
        + '<div class="ca-insight"><div class="ca-insight-label">月均成交量</div><div class="ca-insight-value">' + fmt(stat.mean) + '<span class="unit">tCO₂</span></div><div class="ca-insight-desc">区间平均</div></div>'
        + '<div class="ca-insight is-warn"><div class="ca-insight-label">区间总成交额</div><div class="ca-insight-value">' + fmtWan(series.reduce(function (a, s) { return a + s.amount; }, 0)) + '</div><div class="ca-insight-desc">全部市场合计</div></div>';
    }

    function renderYoy(el, list) {
      if (!list.length) { el.innerHTML = '<div class="ca-empty">暂无数据</div>'; return; }
      el.innerHTML = caChart.groupBar({
        title: '成交量同比（本期 vs 上年同期）',
        groups: list.map(function (r) { return { label: shortLabel(r.label), current: r.current, last: r.last }; }),
        unit: 'tCO₂', currentName: '本期', lastName: '同期', width: 520, height: 280,
      });
    }

    function renderMix(el, items) {
      if (!items.length) { el.innerHTML = '<div class="ca-empty">暂无数据</div>'; return; }
      var c = caChart.PALETTE;
      var colored = items.map(function (it, i) { return { label: it.label, value: it.value, color: c[i % c.length] }; });
      el.innerHTML = caChart.donut({ title: '', items: colored, size: 300, thickness: 26, unit: 'tCO₂', centerTitle: '成交总量', centerValue: items.reduce(function (a, b) { return a + b.value; }, 0) });
    }

    function renderDist(el, items) {
      if (!items.length) { el.innerHTML = '<div class="ca-empty">暂无数据</div>'; return; }
      var c = caChart.PALETTE;
      var colored = items.map(function (it, i) { return { label: it.label, value: it.value, color: c[i % c.length] }; });
      el.innerHTML = caChart.hBar({ title: '', items: colored, unit: 'tCO₂', width: 440, height: 250, barH: 22, gap: 12 });
    }

    function renderDir(el, items) {
      if (!items.length) { el.innerHTML = '<div class="ca-empty">暂无数据</div>'; return; }
      var colorMap = { '买入': '#00a854', '卖出': '#1890ff' };
      var colored = items.map(function (it) { return { label: it.label, value: it.value, color: colorMap[it.label] || '#722ed1' }; });
      el.innerHTML = caChart.donut({ title: '', items: colored, size: 300, thickness: 26, unit: 'tCO₂', centerTitle: '买卖方向', centerValue: items.reduce(function (a, b) { return a + b.value; }, 0) });
    }

    function assignKpis(rs, q) {
      var totalVol = rs.reduce(function (a, r) { return a + r.vol; }, 0);
      var totalAmt = rs.reduce(function (a, r) { return a + r.amount; }, 0);
      var count = rs.length;
      var price = totalVol > 0 ? totalAmt / totalVol : 0;
      var months = new Set(rs.map(function (r) { return r.ym; })).size;
      var avgVol = months > 0 ? totalVol / months : 0;
      document.getElementById('k-count').innerHTML = fmt(count) + '<span class="unit">笔</span>';
      document.getElementById('k-vol').innerHTML = fmt(totalVol) + '<span class="unit">tCO₂</span>';
      document.getElementById('k-vol-sub').textContent = rs.length ? (rs[0].market + '等 · ' + months + '期') : '--';
      document.getElementById('k-amount').innerHTML = fmtWan(totalAmt, 2) + '<span class="unit">元(万元)</span>';
      document.getElementById('k-amount-sub').textContent = '全部市场累计';
      document.getElementById('k-price').innerHTML = fmt(price) + '<span class="unit">元/t</span>';
      document.getElementById('k-price-sub').textContent = '加权平均';
    }

    function renderGrain() {
      document.querySelectorAll('.ca-grain-tab').forEach(function (b) {
        b.classList.toggle('active', b.getAttribute('data-grain') === state.grain);
      });
    }

    document.querySelectorAll('.ca-grain-tab').forEach(function (b) {
      b.addEventListener('click', function () { state.grain = b.getAttribute('data-grain'); apply(); });
    });

    document.getElementById('t-search').addEventListener('click', function () { apply(); toast('查询完成'); });
    document.getElementById('t-reset').addEventListener('click', function () {
      marketSel.value = '全部'; dirSel.value = '全部'; typeSel.value = '全部';
      startEl.value = '2025-01'; endEl.value = '2026-12'; state.grain = 'month';
      apply(); toast('已重置');
    });

    apply();
  }

  if (document.querySelector('.ca-page')) init();
})();
