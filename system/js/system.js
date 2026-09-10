/**
 * 系统管理 · 已办事件
 */

// 演示数据
var DEMO_DATA = [
  {
    id: 'EVT-2026-0001',
    title: '2025年度碳排放核查数据异常',
    type: '数据异常',
    handleTime: '2026-09-05',
    org: '河南安钢周口钢铁有限责任公司',
    initiator: '张工',
    code: 'SYS-20260905-001',
    status: '已办结',
  },
];

var PAGE_SIZE = 10;

// 日期选择器状态
var datePickerState = {
  visible: false,
  leftYear: new Date().getFullYear(),
  leftMonth: new Date().getMonth(), // 0-11
  rightYear: null,
  rightMonth: null,
  startDate: null,
  endDate: null,
  selecting: 'start', // 'start' or 'end'
};

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toast(msg) {
  var el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(function () { el.classList.remove('show'); }, 1800);
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function formatDate(y, m, d) {
  return y + '-' + pad(m + 1) + '-' + pad(d);
}

function parseDate(str) {
  var parts = str.split('-');
  return { y: parseInt(parts[0]), m: parseInt(parts[1]) - 1, d: parseInt(parts[2]) };
}

function isSameDay(d1, d2) {
  return d1.y === d2.y && d1.m === d2.m && d1.d === d2.d;
}

function isBefore(d1, d2) {
  if (d1.y !== d2.y) return d1.y < d2.y;
  if (d1.m !== d2.m) return d1.m < d2.m;
  return d1.d < d2.d;
}

function isInRange(day, start, end) {
  return !isBefore(day, start) && !isBefore(end, day);
}

// 日期选择器
function initDatePicker() {
  var input = document.getElementById('sys-date-range');
  var dropdown = document.getElementById('sys-date-picker');
  var monthTitle = document.getElementById('sys-date-month-title');
  var panelLeft = document.getElementById('sys-date-panel-left');
  var panelRight = document.getElementById('sys-date-panel-right');

  // 点击输入框显示/隐藏
  input.addEventListener('click', function (e) {
    e.stopPropagation();
    datePickerState.visible = !datePickerState.visible;
    if (datePickerState.visible) {
      // 初始化右侧月份为左侧+1
      if (datePickerState.leftMonth === 11) {
        datePickerState.rightYear = datePickerState.leftYear + 1;
        datePickerState.rightMonth = 0;
      } else {
        datePickerState.rightYear = datePickerState.leftYear;
        datePickerState.rightMonth = datePickerState.leftMonth + 1;
      }
      renderDatePicker();
      dropdown.classList.add('show');
    } else {
      dropdown.classList.remove('show');
    }
  });

  // 点击外部关闭
  document.addEventListener('click', function (e) {
    if (!dropdown.contains(e.target) && e.target !== input) {
      datePickerState.visible = false;
      dropdown.classList.remove('show');
    }
  });

  dropdown.addEventListener('click', function (e) {
    e.stopPropagation();
  });

  // 导航按钮
  document.getElementById('sys-date-prev-year').addEventListener('click', function () {
    datePickerState.leftYear--;
    if (datePickerState.leftMonth === 11) {
      datePickerState.rightYear = datePickerState.leftYear + 1;
      datePickerState.rightMonth = 0;
    } else {
      datePickerState.rightYear = datePickerState.leftYear;
      datePickerState.rightMonth = datePickerState.leftMonth + 1;
    }
    renderDatePicker();
  });

  document.getElementById('sys-date-prev-month').addEventListener('click', function () {
    if (datePickerState.leftMonth === 0) {
      datePickerState.leftYear--;
      datePickerState.leftMonth = 11;
    } else {
      datePickerState.leftMonth--;
    }
    if (datePickerState.leftMonth === 11) {
      datePickerState.rightYear = datePickerState.leftYear + 1;
      datePickerState.rightMonth = 0;
    } else {
      datePickerState.rightYear = datePickerState.leftYear;
      datePickerState.rightMonth = datePickerState.leftMonth + 1;
    }
    renderDatePicker();
  });

  document.getElementById('sys-date-next-month').addEventListener('click', function () {
    if (datePickerState.leftMonth === 11) {
      datePickerState.leftYear++;
      datePickerState.leftMonth = 0;
    } else {
      datePickerState.leftMonth++;
    }
    if (datePickerState.leftMonth === 11) {
      datePickerState.rightYear = datePickerState.leftYear + 1;
      datePickerState.rightMonth = 0;
    } else {
      datePickerState.rightYear = datePickerState.leftYear;
      datePickerState.rightMonth = datePickerState.leftMonth + 1;
    }
    renderDatePicker();
  });

  document.getElementById('sys-date-next-year').addEventListener('click', function () {
    datePickerState.leftYear++;
    if (datePickerState.leftMonth === 11) {
      datePickerState.rightYear = datePickerState.leftYear + 1;
      datePickerState.rightMonth = 0;
    } else {
      datePickerState.rightYear = datePickerState.leftYear;
      datePickerState.rightMonth = datePickerState.leftMonth + 1;
    }
    renderDatePicker();
  });

  // 清空
  document.getElementById('sys-date-clear').addEventListener('click', function () {
    datePickerState.startDate = null;
    datePickerState.endDate = null;
    datePickerState.selecting = 'start';
    input.value = '';
    datePickerState.visible = false;
    dropdown.classList.remove('show');
  });

  // 确定
  document.getElementById('sys-date-confirm').addEventListener('click', function () {
    if (datePickerState.startDate && datePickerState.endDate) {
      input.value = formatDate(datePickerState.startDate.y, datePickerState.startDate.m, datePickerState.startDate.d)
        + ' 至 '
        + formatDate(datePickerState.endDate.y, datePickerState.endDate.m, datePickerState.endDate.d);
    }
    datePickerState.visible = false;
    dropdown.classList.remove('show');
  });
}

function renderDatePicker() {
  var monthTitle = document.getElementById('sys-date-month-title');
  var panelLeft = document.getElementById('sys-date-panel-left');
  var panelRight = document.getElementById('sys-date-panel-right');

  var monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
  monthTitle.textContent = datePickerState.leftYear + '年 ' + monthNames[datePickerState.leftMonth] + ' - ' + monthNames[datePickerState.rightMonth];

  panelLeft.innerHTML = renderCalendarPanel(datePickerState.leftYear, datePickerState.leftMonth);
  panelRight.innerHTML = renderCalendarPanel(datePickerState.rightYear, datePickerState.rightMonth);

  // 绑定日期点击
  panelLeft.querySelectorAll('.system-date-picker-day:not(.empty)').forEach(function (dayEl) {
    dayEl.addEventListener('click', function () {
      var y = parseInt(dayEl.getAttribute('data-year'));
      var m = parseInt(dayEl.getAttribute('data-month'));
      var d = parseInt(dayEl.getAttribute('data-day'));
      handleDayClick(y, m, d);
    });
  });

  panelRight.querySelectorAll('.system-date-picker-day:not(.empty)').forEach(function (dayEl) {
    dayEl.addEventListener('click', function () {
      var y = parseInt(dayEl.getAttribute('data-year'));
      var m = parseInt(dayEl.getAttribute('data-month'));
      var d = parseInt(dayEl.getAttribute('data-day'));
      handleDayClick(y, m, d);
    });
  });
}

function renderCalendarPanel(year, month) {
  var weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  var daysInMonth = new Date(year, month + 1, 0).getDate();
  var firstDayOfWeek = new Date(year, month, 1).getDay(); // 0=Sunday
  var today = new Date();

  var html = '<div class="system-date-picker-weekdays">';
  weekdays.forEach(function (w) {
    html += '<span>' + w + '</span>';
  });
  html += '</div>';

  html += '<div class="system-date-picker-days">';

  // 填充空白
  for (var i = 0; i < firstDayOfWeek; i++) {
    html += '<div class="system-date-picker-day empty"></div>';
  }

  // 填充日期
  for (var d = 1; d <= daysInMonth; d++) {
    var dayObj = { y: year, m: month, d: d };
    var classes = ['system-date-picker-day'];

    if (year === today.getFullYear() && month === today.getMonth() && d === today.getDate()) {
      classes.push('today');
    }

    if (datePickerState.startDate && isSameDay(dayObj, datePickerState.startDate)) {
      classes.push('range-start');
    }
    if (datePickerState.endDate && isSameDay(dayObj, datePickerState.endDate)) {
      classes.push('range-end');
    }
    if (datePickerState.startDate && datePickerState.endDate && isInRange(dayObj, datePickerState.startDate, datePickerState.endDate)) {
      classes.push('in-range');
    }

    html += '<div class="' + classes.join(' ') + '" data-year="' + year + '" data-month="' + month + '" data-day="' + d + '">' + d + '</div>';
  }

  html += '</div>';
  return html;
}

function handleDayClick(y, m, d) {
  var dayObj = { y: y, m: m, d: d };

  if (datePickerState.selecting === 'start') {
    datePickerState.startDate = dayObj;
    datePickerState.endDate = null;
    datePickerState.selecting = 'end';
  } else {
    // 如果选择的日期在开始日期之前，交换
    if (isBefore(dayObj, datePickerState.startDate)) {
      datePickerState.endDate = datePickerState.startDate;
      datePickerState.startDate = dayObj;
    } else {
      datePickerState.endDate = dayObj;
    }
    datePickerState.selecting = 'start';
  }

  renderDatePicker();
}

function renderTable(data) {
  var body = document.getElementById('system-table-body');
  if (!data || !data.length) {
    body.innerHTML = '<tr><td colspan="8" class="system-empty">暂无数据</td></tr>';
    renderPagination(0);
    return;
  }

  body.innerHTML = data.map(function (row, i) {
    return '<tr>'
      + '<td>' + (i + 1) + '</td>'
      + '<td>' + escapeHtml(row.title) + '</td>'
      + '<td>' + escapeHtml(row.type) + '</td>'
      + '<td>' + escapeHtml(row.handleTime) + '</td>'
      + '<td>' + escapeHtml(row.org) + '</td>'
      + '<td>' + escapeHtml(row.initiator) + '</td>'
      + '<td>' + escapeHtml(row.code) + '</td>'
      + '<td>'
      + '<button type="button" class="op-btn" data-action="detail" data-id="' + escapeHtml(row.id) + '">详情</button>'
      + '<button type="button" class="op-btn" data-action="summary" data-id="' + escapeHtml(row.id) + '">总结</button>'
      + '</td>'
      + '</tr>';
  }).join('');

  renderPagination(data.length);

  // 绑定操作按钮
  body.querySelectorAll('.op-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var action = btn.getAttribute('data-action');
      var id = btn.getAttribute('data-id');
      var row = DEMO_DATA.find(function (r) { return r.id === id; });
      if (action === 'detail') {
        toast('详情功能待开发');
      } else if (action === 'summary') {
        openSummaryModal(row);
      }
    });
  });
}

function renderPagination(total) {
  var el = document.getElementById('system-pagination');
  var totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  el.innerHTML =
    '<span>共 ' + total + ' 条</span>'
    + '<select><option>10条/页</option><option>20条/页</option><option>50条/页</option></select>'
    + '<button class="page-btn disabled" disabled>&lt;</button>'
    + '<button class="page-btn active">1</button>'
    + '<button class="page-btn disabled" disabled>&gt;</button>'
    + '<span class="page-info">前往 <input type="text" value="1" /> 页</span>';
}

// 总结弹窗
var summaryModal = document.getElementById('summary-modal');

function openSummaryModal(row) {
  document.getElementById('summary-title').value = row.title;
  document.getElementById('summary-process').value = '';
  document.getElementById('summary-shortcoming').value = '';
  document.getElementById('summary-suggestion').value = '';
  summaryModal.classList.add('show');
}

function closeSummaryModal() {
  summaryModal.classList.remove('show');
}

document.getElementById('btn-summary-close').addEventListener('click', closeSummaryModal);
document.getElementById('btn-summary-cancel').addEventListener('click', closeSummaryModal);
document.getElementById('btn-summary-ok').addEventListener('click', function () {
  var process = document.getElementById('summary-process').value.trim();
  var shortcoming = document.getElementById('summary-shortcoming').value.trim();
  var suggestion = document.getElementById('summary-suggestion').value.trim();
  if (!process && !shortcoming && !suggestion) {
    toast('请至少填写一项内容');
    return;
  }
  closeSummaryModal();
  toast('总结已保存');
});

summaryModal.addEventListener('click', function (e) {
  if (e.target === summaryModal) closeSummaryModal();
});

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape' && summaryModal.classList.contains('show')) {
    closeSummaryModal();
  }
});

// 查询 / 重置
document.getElementById('btn-sys-search').addEventListener('click', function () {
  renderTable(DEMO_DATA);
  toast('查询完成');
});

document.getElementById('btn-sys-reset').addEventListener('click', function () {
  document.getElementById('sys-title').value = '';
  document.getElementById('sys-type').value = '';
  document.getElementById('sys-date-range').value = '';
  document.getElementById('sys-org').value = '';
  document.getElementById('sys-initiator').value = '';
  document.getElementById('sys-code').value = '';
  datePickerState.startDate = null;
  datePickerState.endDate = null;
  datePickerState.selecting = 'start';
  renderTable(DEMO_DATA);
  toast('已重置');
});

document.getElementById('btn-sys-export').addEventListener('click', function () {
  toast('已导出（演示）');
});

// 初始化
initLayout('done-events', { moduleId: 'system' });
initDatePicker();
renderTable(DEMO_DATA);
