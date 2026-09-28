/**
 * 碳排放半年度报告 · 列表页
 *
 * 每年只有两份报告：上半年（1~6 月）、下半年（7~12 月），故渲染两张卡片。
 * 卡片样式与「碳排放异动分析」列表页完全一致：
 *   卡头（报表名）→ 期间标题 + 数据期间（精确到月）→ 查看报告。
 *
 * 数据全部来自 js/semiannual-data.js（唯一数据源）。
 * 报告期未结束的半年（如 2026 下半年仅积累到 9 月）整卡置灰，不可点击。
 */
(function () {
  'use strict';

  if (!document.querySelector('.report-page')) return;

  var D = window.SA_DATA, S = window.SA;
  var esc = S.esc;

  /** 2026-01-01 → 2026-01（数据期间只显示到月） */
  function toMonth(iso) { return String(iso || '').slice(0, 7); }

  /** 期间标题：2026 年上半年 */
  function periodLabel(d) { return d.year + ' 年' + d.halfName; }

  /** 数据期间：2026-01 至 2026-06 */
  function periodRange(d) { return '数据期间：' + toMonth(d.start) + ' 至 ' + toMonth(d.end); }

  function initSemiannualPage() {
    initLayout('semiannual', { moduleId: 'report', pageTitle: '碳排放半年度报告' });

    var state = { year: D.CURRENT_YEAR };

    var yearSel = document.getElementById('sa-year');
    var cardsEl = document.getElementById('sa-cards');

    D.YEARS.forEach(function (y) {
      var opt = document.createElement('option');
      opt.value = String(y);
      opt.textContent = String(y) + ' 年';
      yearSel.appendChild(opt);
    });
    yearSel.value = String(D.CURRENT_YEAR);

    /* ---------- 卡片 ---------- */

    function cardShell(d, inner, disabled) {
      return '<div class="report-card' + (disabled ? ' is-disabled' : '') + '">'
        + '<div class="report-card-head">碳排放半年度报告</div>'
        + '<div class="report-card-body">'
        + '<div class="report-card-month">' + esc(periodLabel(d)) + '</div>'
        + '<div class="report-card-range">' + esc(periodRange(d)) + '</div>'
        + '</div>'
        + '<div class="report-card-foot">' + inner + '</div>'
        + '</div>';
    }

    function renderCards() {
      var html = '';
      [1, 2].forEach(function (half) {
        var d = S.buildHalf(state.year, half);
        if (d.complete) {
          html += cardShell(d,
            '<button type="button" class="report-link" data-view-year="' + d.year + '" data-view-half="' + half + '">查看报告</button>',
            false);
        } else {
          html += cardShell(d, '<span class="report-link">查看报告</span>', true);
        }
      });
      cardsEl.innerHTML = html;
    }

    /* ---------- 交互 ---------- */

    document.getElementById('btn-sa-search').addEventListener('click', function () {
      state.year = Number(yearSel.value) || D.CURRENT_YEAR;
      renderCards();
      toast('查询完成');
    });

    document.getElementById('btn-sa-reset').addEventListener('click', function () {
      yearSel.value = String(D.CURRENT_YEAR);
      state.year = D.CURRENT_YEAR;
      renderCards();
      toast('已重置');
    });

    yearSel.addEventListener('change', function () {
      state.year = Number(yearSel.value) || D.CURRENT_YEAR;
      renderCards();
    });

    cardsEl.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('[data-view-year]') : null;
      if (!btn) return;
      location.href = 'semiannual-report.html'
        + '?year=' + encodeURIComponent(btn.getAttribute('data-view-year'))
        + '&half=' + encodeURIComponent(btn.getAttribute('data-view-half'));
    });

    renderCards();
  }

  initSemiannualPage();
})();
