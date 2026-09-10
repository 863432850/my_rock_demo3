/**
 * 碳履约分析
 * 支持：趋势 / 均值 / 极值 / 同比 / 构成 / 分布 六维分析
 * 复用 charts.js
 * 数据模型：趋势图展示完整履约年度序列(2021-2026)，KPI/构成/分布/预警按所选年度聚焦
 */
(function () {
  'use strict';

  var MARKETS = ['全国碳市场', 'CCER碳市场', '北京碳市场', '天津碳市场', '重庆碳市场', '福建碳市场', '湖北碳市场'];
  var METHODS = ['配额清缴', 'CCER清缴', '货币清缴'];
  var STATUSES = ['已完成', '部分完成', '未完成'];
  var YEARS = ['2021', '2022', '2023', '2024', '2025', '2026'];

  // 每个碳市场的履约总体：应缴量基准、清缴比例、方式占比
  var META = {
    '全国碳市场': { due: 18000, ratio: 0.95, method: { '配额清缴': 0.6, 'CCER清缴': 0.3, '货币清缴': 0.1 } },
    'CCER碳市场': { due: 4200, ratio: 0.9, method: { 'CCER清缴': 0.85, '货币清缴': 0.15 } },
    '北京碳市场': { due: 2600, ratio: 0.92, method: { '配额清缴': 0.5, 'CCER清缴': 0.4, '货币清缴': 0.1 } },
    '天津碳市场': { due: 2200, ratio: 0.88, method: { '配额清缴': 0.55, 'CCER清缴': 0.35, '货币清缴': 0.1 } },
    '重庆碳市场': { due: 1900, ratio: 0.9, method: { '配额清缴': 0.6, 'CCER清缴': 0.3, '货币清缴': 0.1 } },
    '福建碳市场': { due: 1700, ratio: 0.91, method: { '配额清缴': 0.65, 'CCER清缴': 0.3, '货币清缴': 0.05 } },
    '湖北碳市场': { due: 2400, ratio: 0.93, method: { '配额清缴': 0.62, 'CCER清缴': 0.3, '货币清缴': 0.08 } },
  };

  var ORGS = [
    '河南安钢周口钢铁有限责任公司', '河南钢铁集团有限公司', '安阳钢铁集团', '南阳汉冶特钢', '舞阳钢铁',
    '信阳钢铁', '安钢集团冷轧', '济源钢铁', '洛阳中重铸锻', '平煤神马',
  ];

  /** 年度系数：应缴量随年份增长（趋势有上升态势） */
  function yearScale(year) {
    return 0.72 + (Number(year) - 2021) * 0.09; // 2021:0.72 ... 2026:1.17
  }

  /** 生成履约明细。mode='year' 只生成所选年度；mode='all' 生成全部年度（用于趋势） */
  function buildRows(query, mode) {
    var years = mode === 'all' ? YEARS : [query.year];
    var rows = [];

    years.forEach(function (year) {
      MARKETS.forEach(function (market, mi) {
        if (query.market !== '全部' && market !== query.market) return;
        var meta = META[market];
        var marketDue = meta.due * yearScale(year);
        var orgCount = 4 + (mi % 3);
        for (var o = 0; o < orgCount; o++) {
          var org = ORGS[(o + mi) % ORGS.length];
          var w = 0.6 + ((o * 37 + mi * 13) % 40) / 100;
          var due = Math.round(marketDue * w / (orgCount * 1.2));
          var ratio = meta.ratio - (((o * 11 + mi * 7) % 12) / 100);
          if (ratio < 0.7) ratio = 0.7;
          var cleared = Math.round(due * ratio);
          var gap = due - cleared;
          var rate = due > 0 ? cleared / due : 0;
          var method = pickMethod(meta.method, o);
          var status = gap <= 0 ? '已完成' : (gap < due * 0.3 ? '部分完成' : '未完成');

          rows.push({
            year: year, market: market, org: org,
            due: due, cleared: cleared, gap: gap, rate: rate,
            method: method, status: status, cycle: year + '年度履约',
          });
        }
      });
    });

    if (query.method !== '全部') rows = rows.filter(function (r) { return r.method === query.method; });
    if (query.status !== '全部') rows = rows.filter(function (r) { return r.status === query.status; });
    return rows;
  }

  function pickMethod(methodMap, seed) {
    var keys = Object.keys(methodMap);
    var v = (seed * 7) % 10;
    var acc = 0;
    for (var i = 0; i < keys.length; i++) {
      acc += methodMap[keys[i]] * 10;
      if (v < acc) return keys[i];
    }
    return keys[keys.length - 1];
  }

  /** 趋势序列：period=按年度逐年 / market=按碳市场 */
  function trendSeries(rows, grain) {
    var groups = {};
    rows.forEach(function (r) {
      var key, label, sort;
      if (grain === 'market') {
        key = r.market; label = shortMarket(r.market); sort = MARKETS.indexOf(r.market);
      } else {
        key = r.year; label = r.year + '年'; sort = Number(r.year);
      }
      if (!groups[key]) groups[key] = { key: key, label: label, due: 0, cleared: 0, sort: sort };
      groups[key].due += r.due;
      groups[key].cleared += r.cleared;
    });
    var arr = Object.keys(groups).map(function (k) { return groups[k]; }).sort(function (a, b) { return a.sort - b.sort; });
    if (arr.length) {
      var max = arr.reduce(function (a, b) { return b.cleared > a.cleared ? b : a; });
      var min = arr.reduce(function (a, b) { return b.cleared < a.cleared ? b : a; });
      arr.forEach(function (g) { g.isMax = g.key === max.key; g.isMin = g.key === min.key; });
    }
    return arr;
  }

  /** 同比：始终按「所选年度 vs 上一年度」各市场清缴量对比（跨年趋势用） */
  function yoySeries(rows, grain, curYear) {
    curYear = curYear || '2026';
    var lastYear = String(Number(curYear) - 1);
    var cur = {}, last = {};
    rows.forEach(function (r) {
      var buck = r.year === curYear ? cur : (r.year === lastYear ? last : null);
      if (!buck) return;
      if (!buck[r.market]) buck[r.market] = { label: shortMarket(r.market), val: 0 };
      buck[r.market].val += r.cleared;
    });
    var out = [];
    MARKETS.forEach(function (mk) {
      var c = cur[mk];
      if (!c) return;
      var l = last[mk];
      out.push({ label: c.label, current: c.val, last: l ? l.val : 0 });
    });
    return out;
  }

  function shortMarket(name) { return name.replace(/碳市场/g, ''); }

  function mixByMethod(rows) {
    var map = {};
    rows.forEach(function (r) {
      if (!map[r.method]) map[r.method] = 0;
      map[r.method] += r.cleared;
    });
    return Object.keys(map).map(function (k) { return { label: k, value: map[k] }; }).sort(function (a, b) { return b.value - a.value; });
  }

  function distByMarket(rows) {
    var map = {};
    rows.forEach(function (r) {
      if (!map[r.market]) map[r.market] = 0;
      map[r.market] += r.cleared;
    });
    return Object.keys(map).map(function (k) { return { label: k, value: map[k] }; }).sort(function (a, b) { return b.value - a.value; });
  }

  function topOrgs(rows, n) {
    var map = {};
    rows.forEach(function (r) {
      if (!map[r.org]) map[r.org] = 0;
      map[r.org] += r.cleared;
    });
    return Object.keys(map).map(function (k) { return { label: k, value: map[k] }; })
      .sort(function (a, b) { return b.value - a.value; }).slice(0, n || 5);
  }

  function alertRows(rows) {
    return rows.filter(function (r) { return r.rate < 0.85; })
      .sort(function (a, b) { return a.rate - b.rate; });
  }

  // ---- 渲染 ----
  function esc(s) { return caChart.esc(s); }
  function fmt(v) { return caChart.fmt(v); }
  function fmtPct(n, d) { return caChart.fmtPct(n, d == null ? 1 : d); }

  function fillSelect(el, options, selected) {
    el.innerHTML = options.map(function (o) {
      var v = typeof o === 'string' ? o : o.id;
      var l = typeof o === 'string' ? o : o.name;
      return '<option value="' + esc(v) + '"' + (v === selected ? ' selected' : '') + '>' + esc(l) + '</option>';
    }).join('');
  }

  function init() {
    initLayout('analysis-performance', { moduleId: 'carbon-asset', pageTitle: '碳履约分析' });

    var state = { grain: 'period' };
    var cardRows = [];   // 用于 KPI/构成/分布/机构/预警（按年度聚焦）
    var trendRows = [];  // 用于趋势/同比（完整跨年序列）

    var yearSel = document.getElementById('f-year');
    var marketSel = document.getElementById('f-market');
    var methodSel = document.getElementById('f-method');
    var statusSel = document.getElementById('f-status');
    fillSelect(yearSel, YEARS.slice().reverse(), '2026');
    fillSelect(marketSel, ['全部'].concat(MARKETS), '全部');
    fillSelect(methodSel, ['全部'].concat(METHODS), '全部');
    fillSelect(statusSel, ['全部'].concat(STATUSES), '全部');

    function readForm() {
      return {
        year: yearSel.value, market: marketSel.value,
        method: methodSel.value, status: statusSel.value,
      };
    }

    function apply() {
      var q = readForm();
      cardRows = buildRows(q, 'year');
      trendRows = buildRows(q, 'all'); // 跨年
      assignKpis(cardRows, q);
      renderTrend(document.getElementById('f-trend-chart'), document.getElementById('f-trend-insights'), trendSeries(trendRows, state.grain));
      renderYoy(document.getElementById('f-yoy-chart'), yoySeries(trendRows, state.grain, q.year));
      renderMix(document.getElementById('f-mix-chart'), mixByMethod(cardRows));
      renderDist(document.getElementById('f-dist-chart'), distByMarket(cardRows));
      renderOrg(document.getElementById('f-org-chart'), topOrgs(cardRows, 5));
      renderAlert(document.getElementById('f-alert-body'), alertRows(cardRows));
      renderGrain();
    }

    function renderTrend(chartEl, insightEl, series) {
      if (!series.length) { chartEl.innerHTML = '<div class="ca-empty">暂无数据</div>'; renderInsights(insightEl, []); return; }
      var dueData = series.map(function (s) { return { label: s.label, value: s.due }; });
      var clearedData = series.map(function (s) { return { label: s.label, value: s.cleared, isMax: s.isMax, isMin: s.isMin }; });
      chartEl.innerHTML = caChart.line({
        title: '', series: [
          { name: '应缴量', color: '#fa8c16', data: dueData },
          { name: '清缴量', color: '#00a854', data: clearedData },
        ], unit: 'tCO₂', width: 960, height: 300, showMean: true,
      });
      renderInsights(insightEl, series);
    }

    function renderInsights(el, series) {
      var cleared = series.map(function (s) { return s.cleared; });
      if (!cleared.length) { el.innerHTML = ''; return; }
      var stat = caChart.statInsight(cleared, 'tCO₂');
      var maxPt = series.find(function (s) { return s.isMax; });
      var minPt = series.find(function (s) { return s.isMin; });
      var totalDue = series.reduce(function (a, s) { return a + s.due; }, 0);
      var totalClear = series.reduce(function (a, s) { return a + s.cleared; }, 0);
      var rate = totalDue > 0 ? totalClear / totalDue : 0;
      el.innerHTML =
        '<div class="ca-insight"><div class="ca-insight-label">峰值清缴</div><div class="ca-insight-value">' + fmt(stat.max) + '<span class="unit">tCO₂</span></div><div class="ca-insight-desc">' + esc(maxPt.label) + '</div></div>'
        + '<div class="ca-insight is-lite"><div class="ca-insight-label">谷值清缴</div><div class="ca-insight-value">' + fmt(stat.min) + '<span class="unit">tCO₂</span></div><div class="ca-insight-desc">' + esc(minPt.label) + '</div></div>'
        + '<div class="ca-insight"><div class="ca-insight-label">平均清缴</div><div class="ca-insight-value">' + fmt(stat.mean) + '<span class="unit">tCO₂</span></div><div class="ca-insight-desc">区间平均</div></div>'
        + '<div class="ca-insight is-warn"><div class="ca-insight-label">综合履约率</div><div class="ca-insight-value">' + fmtPct(rate, 1) + '</div><div class="ca-insight-desc">清缴 / 应缴合计</div></div>';
    }

    function renderYoy(el, list) {
      if (!list.length) { el.innerHTML = '<div class="ca-empty">暂无数据</div>'; return; }
      el.innerHTML = caChart.groupBar({
        title: '清缴量同比（本年度 vs 上年度）',
        groups: list.map(function (r) { return { label: r.label, current: r.current, last: r.last }; }),
        unit: 'tCO₂', currentName: '当年', lastName: '上年', width: 520, height: 280,
      });
    }

    function renderMix(el, items) {
      if (!items.length) { el.innerHTML = '<div class="ca-empty">暂无数据</div>'; return; }
      var c = caChart.PALETTE;
      var colored = items.map(function (it, i) { return { label: it.label, value: it.value, color: c[i % c.length] }; });
      el.innerHTML = caChart.donut({ title: '', items: colored, size: 300, thickness: 26, unit: 'tCO₂', centerTitle: '清缴量', centerValue: items.reduce(function (a, b) { return a + b.value; }, 0) });
    }

    function renderDist(el, items) {
      if (!items.length) { el.innerHTML = '<div class="ca-empty">暂无数据</div>'; return; }
      var c = caChart.PALETTE;
      var colored = items.map(function (it, i) { return { label: it.label, value: it.value, color: c[i % c.length] }; });
      el.innerHTML = caChart.hBar({ title: '', items: colored, unit: 'tCO₂', width: 440, height: 250, barH: 22, gap: 12 });
    }

    function renderOrg(el, items) {
      if (!items.length) { el.innerHTML = '<div class="ca-empty">暂无数据</div>'; return; }
      var c = caChart.PALETTE;
      var colored = items.map(function (it, i) {
        return { label: it.label.replace(/有限责任公司|集团|公司/g, ''), value: it.value, color: c[i % c.length] };
      });
      el.innerHTML = caChart.hBar({ title: '', items: colored, unit: 'tCO₂', width: 440, height: 250, barH: 22, gap: 12 });
    }

    function renderAlert(el, list) {
      if (!list.length) { el.innerHTML = '<tr><td colspan="8" class="ca-empty">暂无缺口预警，全部机构履约良好</td></tr>'; return; }
      el.innerHTML = list.slice(0, 12).map(function (r) {
        var tag = r.rate < 0.7
          ? '<span class="ca-tag b-red">高</span>'
          : '<span class="ca-tag b-orange">中</span>';
        return '<tr>'
          + '<td>' + esc(r.org) + '</td>'
          + '<td>' + esc(r.cycle) + '</td>'
          + '<td>' + esc(r.market) + '</td>'
          + '<td class="is-num">' + fmt(r.due) + '</td>'
          + '<td class="is-num">' + fmt(r.cleared) + '</td>'
          + '<td class="is-num" style="color:var(--danger);font-weight:600;">' + fmt(r.gap) + '</td>'
          + '<td>' + fmtPct(r.rate, 1) + '</td>'
          + '<td>' + tag + '</td>'
          + '</tr>';
      }).join('');
    }

    function assignKpis(rs, q) {
      var totalClear = rs.reduce(function (a, r) { return a + r.cleared; }, 0);
      var totalDue = rs.reduce(function (a, r) { return a + r.due; }, 0);
      var totalGap = rs.reduce(function (a, r) { return a + r.gap; }, 0);
      var rate = totalDue > 0 ? totalClear / totalDue : 0;
      var orgs = new Set(rs.map(function (r) { return r.org; })).size;
      document.getElementById('k-clear').innerHTML = fmt(totalClear) + '<span class="unit">tCO₂</span>';
      document.getElementById('k-clear-sub').textContent = rs.length ? (q.year + '年度 · ' + rs[0].market + '等') : '--';
      document.getElementById('k-gap').innerHTML = fmt(totalGap) + '<span class="unit">tCO₂</span>';
      document.getElementById('k-gap-sub').textContent = '应缴 - 清缴';
      document.getElementById('k-rate').innerHTML = fmtPct(rate, 1);
      document.getElementById('k-orgs').innerHTML = fmt(orgs) + '<span class="unit">家</span>';
      document.getElementById('k-orgs-sub').textContent = '纳入统计机构数';
    }

    function renderGrain() {
      document.querySelectorAll('.ca-grain-tab').forEach(function (b) {
        b.classList.toggle('active', b.getAttribute('data-grain') === state.grain);
      });
    }

    document.querySelectorAll('.ca-grain-tab').forEach(function (b) {
      b.addEventListener('click', function () { state.grain = b.getAttribute('data-grain'); apply(); });
    });

    document.getElementById('f-search').addEventListener('click', function () { apply(); toast('查询完成'); });
    document.getElementById('f-reset').addEventListener('click', function () {
      yearSel.value = '2026'; marketSel.value = '全部'; methodSel.value = '全部'; statusSel.value = '全部';
      state.grain = 'period'; apply(); toast('已重置');
    });

    apply();
  }

  if (document.querySelector('.ca-page')) init();
})();
