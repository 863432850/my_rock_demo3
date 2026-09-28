/**
 * 报告/报表管理 · 碳月报及差异分析（演示）
 * 两个页签：碳排放 / 碳交易
 * - 每个页签下按年度展示 12 张月份卡片（卡片样式参考双碳管理月度简报）
 * - 每张卡片两个按钮：
 *   · 月度报表 → monthly-report.html?tab=&month=YYYY-MM
 *   · 差异分析 → diff-report.html?tab=&month=YYYY-MM
 * - 未发生月份（> 当前月）整卡置灰，不可操作
 */

var MONTHLY_CURRENT_YEAR = 2026;
var MONTHLY_CURRENT_MONTH = 9; // 演示口径：当前日期 2026-09-26
var MONTHLY_YEARS = [2026, 2025, 2024, 2023, 2022];

/** 两个页签的展示配置 */
var MONTHLY_TABS = {
  emission: { key: 'emission', name: '碳排放', head: '碳排放月报' },
  trade: { key: 'trade', name: '碳交易', head: '碳交易月报' }
};

function mpPad2(n) { return String(n).padStart(2, '0'); }
function mpLastDay(y, m) { return new Date(y, m, 0).getDate(); }

/** 2026-03 → 「2026 年第 3 月」 */
function monthLabel(month) {
  var parts = String(month || '').split('-');
  return parts.length === 2 ? parts[0] + ' 年第 ' + Number(parts[1]) + ' 月' : month;
}

/** 2026-03 → 「2026-03-01 至 2026-03-31」 */
function monthRangeText(month) {
  var parts = String(month || '').split('-');
  if (parts.length !== 2) return month;
  var y = Number(parts[0]), m = Number(parts[1]);
  return y + '-' + mpPad2(m) + '-01 至 ' + y + '-' + mpPad2(m) + '-' + mpLastDay(y, m);
}

function escapeMonthlyHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function initMonthlyPage() {
  initLayout('monthly', { moduleId: 'report', pageTitle: '碳月报及差异分析' });

  var state = { tab: 'emission', year: MONTHLY_CURRENT_YEAR };
  var cardsEl = document.getElementById('monthly-cards');
  var yearSel = document.getElementById('monthly-year');

  /* ---------- 年度下拉 ---------- */
  MONTHLY_YEARS.forEach(function (y) {
    var opt = document.createElement('option');
    opt.value = String(y);
    opt.textContent = String(y);
    yearSel.appendChild(opt);
  });
  yearSel.value = String(MONTHLY_CURRENT_YEAR);

  /** 是否已发生：往年全部发生；当年 <= 当前月 */
  function happened(month) {
    var parts = month.split('-');
    var y = Number(parts[0]), m = Number(parts[1]);
    return y < MONTHLY_CURRENT_YEAR || (y === MONTHLY_CURRENT_YEAR && m <= MONTHLY_CURRENT_MONTH);
  }

  /* ---------- 卡片渲染 ---------- */
  function renderCards() {
    var tab = MONTHLY_TABS[state.tab];
    var html = '';

    for (var m = 1; m <= 12; m++) {
      var month = state.year + '-' + mpPad2(m);
      var disabled = !happened(month);

      var foot;
      if (disabled) {
        foot = '<span class="report-link">月度报表</span>'
          + '<span class="foot-divider"></span>'
          + '<span class="report-link">差异分析</span>';
      } else {
        foot = '<button type="button" class="report-link" data-report="monthly" data-month="' + month + '">月度报表</button>'
          + '<span class="foot-divider"></span>'
          + '<button type="button" class="report-link" data-report="diff" data-month="' + month + '">差异分析</button>';
      }

      html += '<div class="report-card' + (disabled ? ' is-disabled' : '') + '" data-month="' + month + '">'
        + '<div class="report-card-head">' + escapeMonthlyHtml(tab.head) + '</div>'
        + '<div class="report-card-body">'
        + '<div class="report-card-month">' + escapeMonthlyHtml(monthLabel(month)) + '</div>'
        + '<div class="report-card-range">' + escapeMonthlyHtml(monthRangeText(month)) + '</div>'
        + '</div>'
        + '<div class="report-card-foot">' + foot + '</div>'
        + '</div>';
    }

    cardsEl.innerHTML = html;
  }

  /* ---------- 页签切换 ---------- */
  var tabEmission = document.getElementById('tab-emission');
  var tabTrade = document.getElementById('tab-trade');

  function switchTab(which) {
    var isEmission = which === 'emission';
    state.tab = isEmission ? 'emission' : 'trade';
    tabEmission.classList.toggle('is-active', isEmission);
    tabTrade.classList.toggle('is-active', !isEmission);
    tabEmission.setAttribute('aria-selected', isEmission ? 'true' : 'false');
    tabTrade.setAttribute('aria-selected', isEmission ? 'false' : 'true');
    renderCards();
  }

  tabEmission.addEventListener('click', function () { switchTab('emission'); });
  tabTrade.addEventListener('click', function () { switchTab('trade'); });

  /* ---------- 查询 / 重置 ---------- */
  document.getElementById('btn-monthly-search').addEventListener('click', function () {
    state.year = Number(yearSel.value) || MONTHLY_CURRENT_YEAR;
    renderCards();
    toast('查询完成');
  });

  document.getElementById('btn-monthly-reset').addEventListener('click', function () {
    yearSel.value = String(MONTHLY_CURRENT_YEAR);
    state.tab = 'emission';
    state.year = MONTHLY_CURRENT_YEAR;
    tabEmission.classList.add('is-active');
    tabTrade.classList.remove('is-active');
    tabEmission.setAttribute('aria-selected', 'true');
    tabTrade.setAttribute('aria-selected', 'false');
    renderCards();
    toast('已重置');
  });

  /* ---------- 卡片按钮（事件委托） ---------- */
  cardsEl.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('[data-report]') : null;
    if (!btn) return;
    var kind = btn.getAttribute('data-report');
    var month = btn.getAttribute('data-month');
    var page = kind === 'diff' ? 'diff-report.html' : 'monthly-report.html';
    location.href = page
      + '?tab=' + encodeURIComponent(state.tab)
      + '&month=' + encodeURIComponent(month);
  });

  renderCards();
}

if (document.querySelector('.monthly-page')) initMonthlyPage();
