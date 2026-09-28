/**
 * 报告/报表管理 · 碳排放异动分析（演示）
 * 年历卡片视图：每年 12 张卡片
 * - 已发生月份（<= 当前月）：「查看报告」，打开对应月份的异动分析报告页
 * - 未发生月份（> 当前月）：整卡置灰，不可操作
 */

var REPORT_ORG = '河南安钢周口钢铁有限责任公司';
var CURRENT_YEAR = 2026;
var CURRENT_MONTH = 9; // 演示口径：当前日期 2026-09-26

var ALL_MONTHS = [];
for (var i = 1; i <= 12; i++) ALL_MONTHS.push(CURRENT_YEAR + '-' + String(i).padStart(2, '0'));

function pad2(n) { return String(n).padStart(2, '0'); }
function lastDay(y, m) { return new Date(y, m, 0).getDate(); }

function monthLabel(m) {
  var parts = String(m || '').split('-');
  return parts.length === 2 ? parts[0] + ' 年第 ' + Number(parts[1]) + ' 月' : m;
}

function monthRange(m) {
  var parts = m.split('-');
  return '{' + parts[0] + '-' + pad2(Number(parts[1])) + '-01|' + parts[0] + '-' + pad2(Number(parts[1])) + '-' + lastDay(Number(parts[0]), Number(parts[1])) + '}';
}

function escapeReportHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 打开异动分析报告页（按月渲染的完整 HTML 报告，可下载 PDF） */
function openAnomalyPage(month) {
  location.href = 'anomaly-report.html?month=' + encodeURIComponent(month);
}

function initAnomalyPage() {
  initLayout('emission-anomaly', { moduleId: 'report', pageTitle: '碳排放异动分析' });

  var state = { year: CURRENT_YEAR };
  var cardsEl = document.getElementById('report-cards');

  function happened(month) {
    var parts = month.split('-');
    var y = Number(parts[0]), m = Number(parts[1]);
    return y < CURRENT_YEAR || (y === CURRENT_YEAR && m <= CURRENT_MONTH);
  }

  function cardShell(month, inner, disabled) {
    return '<div class="report-card' + (disabled ? ' is-disabled' : '') + '" data-month="' + month + '">'
      + '<div class="report-card-head">碳排放异动分析</div>'
      + '<div class="report-card-body">'
      + '<div class="report-card-month">' + escapeReportHtml(monthLabel(month)) + '</div>'
      + '<div class="report-card-range">' + escapeReportHtml(monthRange(month)) + '</div>'
      + '</div>'
      + '<div class="report-card-foot">' + inner + '</div>'
      + '</div>';
  }

  function renderCards() {
    var html = '';
    ALL_MONTHS.forEach(function (month) {
      var parts = month.split('-');
      if (Number(parts[0]) !== state.year) return;

      if (happened(month)) {
        html += cardShell(month, '<button type="button" class="report-link" data-view="' + month + '">查看报告</button>', false);
      } else {
        html += cardShell(month, '<span class="report-link">查看报告</span>', true);
      }
    });
    cardsEl.innerHTML = html;
  }

  document.getElementById('btn-report-search').addEventListener('click', function () {
    state.year = Number(document.getElementById('report-year').value) || CURRENT_YEAR;
    renderCards();
    toast('查询完成');
  });

  document.getElementById('btn-report-reset').addEventListener('click', function () {
    document.getElementById('report-year').value = String(CURRENT_YEAR);
    state = { year: CURRENT_YEAR };
    renderCards();
    toast('已重置');
  });

  cardsEl.addEventListener('click', function (e) {
    var view = e.target.closest('[data-view]');
    if (view) { openAnomalyPage(view.getAttribute('data-view')); return; }
  });

  renderCards();
}

if (document.querySelector('.report-page')) initAnomalyPage();
