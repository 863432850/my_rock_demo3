/**
 * 碳资产管理 · 人工登记申请
 */

// 演示数据
var DEMO_DATA = [
  {
    id: 'CA-2026-0001',
    enterpriseCategory: '非重点排放单位/其他',
    industry: '建材',
    market: '全国碳市场',
    source: '免费发放-预分配',
    execYear: '2025',
    cycle: '第二个履约周期21-22',
    assetType: '配额',
    product: '碳排放配额21',
    declaredQty: '1',
    issuedQty: '1',
    payableQty: '1',
    issueDate: '2026-07-26',
    applicant: '绿色推进部',
    phone: '18032500660',
    applyTime: '--',
    status: '待提交',
  },
];

var PAGE_SIZE = 10;

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
  var parts = String(str).split('-');
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

/* ===== 日期范围选择器组件 ===== */
function createDateRangePicker(pickerId, rangeInputId) {
  var picker = document.getElementById(pickerId);
  var rangeInput = document.getElementById(rangeInputId);

  var state = {
    visible: false,
    leftYear: new Date().getFullYear(),
    leftMonth: new Date().getMonth(),
    rightYear: null,
    rightMonth: null,
    startDate: null,
    endDate: null,
    selecting: 'start',
  };

  function syncRightMonth() {
    if (state.leftMonth === 11) {
      state.rightYear = state.leftYear + 1;
      state.rightMonth = 0;
    } else {
      state.rightYear = state.leftYear;
      state.rightMonth = state.leftMonth + 1;
    }
  }

  function render() {
    var dropdown = picker.querySelector('.ca-cal-dropdown');
    var title = dropdown.querySelector('.ca-cal-title');
    var panelLeft = dropdown.querySelector('.ca-cal-panel-left');
    var panelRight = dropdown.querySelector('.ca-cal-panel-right');
    var monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

    title.textContent = state.leftYear + '年 ' + monthNames[state.leftMonth] + ' - ' + monthNames[state.rightMonth];

    panelLeft.innerHTML = renderCalendarPanel(state.leftYear, state.leftMonth);
    panelRight.innerHTML = renderCalendarPanel(state.rightYear, state.rightMonth);

    bindDayClicks(panelLeft);
    bindDayClicks(panelRight);
  }

  function renderCalendarPanel(year, month) {
    var weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    var firstDayOfWeek = new Date(year, month, 1).getDay();
    var today = new Date();

    var html = '<div class="ca-cal-weekdays">';
    weekdays.forEach(function (w) {
      html += '<span>' + w + '</span>';
    });
    html += '</div>';

    html += '<div class="ca-cal-days">';
    for (var i = 0; i < firstDayOfWeek; i++) {
      html += '<div class="ca-cal-day empty"></div>';
    }
    for (var d = 1; d <= daysInMonth; d++) {
      var dayObj = { y: year, m: month, d: d };
      var classes = ['ca-cal-day'];

      if (year === today.getFullYear() && month === today.getMonth() && d === today.getDate()) {
        classes.push('today');
      }
      if (state.startDate && isSameDay(dayObj, state.startDate)) {
        classes.push('range-start');
      }
      if (state.endDate && isSameDay(dayObj, state.endDate)) {
        classes.push('range-end');
      }
      if (state.startDate && state.endDate && isInRange(dayObj, state.startDate, state.endDate)) {
        classes.push('in-range');
      }

      html += '<div class="' + classes.join(' ') + '" data-year="' + year + '" data-month="' + month + '" data-day="' + d + '">' + d + '</div>';
    }
    html += '</div>';
    return html;
  }

  function bindDayClicks(panel) {
    panel.querySelectorAll('.ca-cal-day:not(.empty)').forEach(function (el) {
      el.addEventListener('click', function () {
        handleDayClick(
          parseInt(el.getAttribute('data-year')),
          parseInt(el.getAttribute('data-month')),
          parseInt(el.getAttribute('data-day'))
        );
      });
    });
  }

  function handleDayClick(y, m, d) {
    var dayObj = { y: y, m: m, d: d };
    if (state.selecting === 'start') {
      state.startDate = dayObj;
      state.endDate = null;
      state.selecting = 'end';
    } else {
      if (isBefore(dayObj, state.startDate)) {
        state.endDate = state.startDate;
        state.startDate = dayObj;
      } else {
        state.endDate = dayObj;
      }
      state.selecting = 'start';
    }
    render();
  }

  function showDropdown() {
    syncRightMonth();
    state.visible = true;
    var dropdown = picker.querySelector('.ca-cal-dropdown');
    dropdown.innerHTML =
      '<div class="ca-cal-header">'
      + '<button type="button" class="ca-cal-nav" data-nav="prev-month"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg></button>'
      + '<span class="ca-cal-title"></span>'
      + '<button type="button" class="ca-cal-nav" data-nav="next-month"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></button>'
      + '</div>'
      + '<div class="ca-cal-body">'
      + '<div class="ca-cal-panel ca-cal-panel-left"></div>'
      + '<div class="ca-cal-panel ca-cal-panel-right"></div>'
      + '</div>'
      + '<div class="ca-cal-footer">'
      + '<button type="button" class="btn" data-cal="clear">清空</button>'
      + '<button type="button" class="btn ca-btn-primary" data-cal="confirm">确定</button>'
      + '</div>';
    dropdown.classList.add('show');
    render();

    dropdown.querySelector('[data-nav="prev-month"]').addEventListener('click', function () {
      if (state.leftMonth === 0) { state.leftYear--; state.leftMonth = 11; } else { state.leftMonth--; }
      syncRightMonth();
      render();
    });
    dropdown.querySelector('[data-nav="next-month"]').addEventListener('click', function () {
      if (state.leftMonth === 11) { state.leftYear++; state.leftMonth = 0; } else { state.leftMonth++; }
      syncRightMonth();
      render();
    });
    dropdown.querySelector('[data-cal="clear"]').addEventListener('click', function () {
      state.startDate = null;
      state.endDate = null;
      state.selecting = 'start';
      rangeInput.value = '';
      closeDropdown();
    });
    dropdown.querySelector('[data-cal="confirm"]').addEventListener('click', function () {
      if (state.startDate && state.endDate) {
        rangeInput.value = formatDate(state.startDate.y, state.startDate.m, state.startDate.d)
          + ' 至 ' + formatDate(state.endDate.y, state.endDate.m, state.endDate.d);
      }
      closeDropdown();
    });
  }

  function closeDropdown() {
    state.visible = false;
    var dropdown = picker.querySelector('.ca-cal-dropdown');
    dropdown.classList.remove('show');
    picker.classList.remove('is-open');
  }

  rangeInput.addEventListener('click', function (e) {
    e.stopPropagation();
    if (state.visible) {
      closeDropdown();
    } else {
      picker.classList.add('is-open');
      showDropdown();
    }
  });

  // 点击外部关闭
  document.addEventListener('click', function (e) {
    if (!picker.contains(e.target)) {
      closeDropdown();
    }
  });

  // 初始化年月为当前
  syncRightMonth();
}

/* ===== 表格渲染 ===== */
function renderTable(data) {
  var body = document.getElementById('ca-table-body');
  if (!data || !data.length) {
    body.innerHTML = '<tr><td colspan="18" class="ca-empty">暂无数据</td></tr>';
    renderPagination(0);
    return;
  }

  body.innerHTML = data.map(function (row, i) {
    var status = '<span class="ca-status"><span class="dot"></span>' + escapeHtml(row.status) + '</span>';
    return '<tr>'
      + '<td>' + (i + 1) + '</td>'
      + '<td>' + escapeHtml(row.enterpriseCategory) + '</td>'
      + '<td>' + escapeHtml(row.industry) + '</td>'
      + '<td>' + escapeHtml(row.market) + '</td>'
      + '<td>' + escapeHtml(row.source) + '</td>'
      + '<td>' + escapeHtml(row.execYear) + '</td>'
      + '<td>' + escapeHtml(row.cycle) + '</td>'
      + '<td>' + escapeHtml(row.assetType) + '</td>'
      + '<td>' + escapeHtml(row.product) + '</td>'
      + '<td>' + escapeHtml(row.declaredQty) + '</td>'
      + '<td>' + escapeHtml(row.issuedQty) + '</td>'
      + '<td>' + escapeHtml(row.payableQty) + '</td>'
      + '<td>' + escapeHtml(row.issueDate) + '</td>'
      + '<td>' + escapeHtml(row.applicant) + '</td>'
      + '<td>' + escapeHtml(row.phone) + '</td>'
      + '<td>' + escapeHtml(row.applyTime) + '</td>'
      + '<td>' + status + '</td>'
      + '<td>'
      + '<button type="button" class="op-btn" data-action="edit" data-id="' + escapeHtml(row.id) + '">编辑</button>'
      + '<button type="button" class="op-btn" data-action="submit" data-id="' + escapeHtml(row.id) + '">提交</button>'
      + '<button type="button" class="op-btn" data-action="delete" data-id="' + escapeHtml(row.id) + '">删除</button>'
      + '</td>'
      + '</tr>';
  }).join('');

  renderPagination(data.length);

  body.querySelectorAll('.op-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var action = btn.getAttribute('data-action');
      var id = btn.getAttribute('data-id');
      var row = DEMO_DATA.find(function (r) { return r.id === id; });
      if (action === 'edit') {
        openApplyModal(true, row);
      } else if (action === 'submit') {
        toast('提交成功（演示）');
      } else if (action === 'delete') {
        toast('删除成功（演示）');
      }
    });
  });
}

function renderPagination(total) {
  var el = document.getElementById('ca-pagination');
  el.innerHTML =
    '<span>共 ' + total + ' 条</span>'
    + '<select><option>10条/页</option><option>20条/页</option><option>50条/页</option></select>'
    + '<button class="page-btn disabled" disabled>&lt;</button>'
    + '<button class="page-btn active">1</button>'
    + '<button class="page-btn disabled" disabled>&gt;</button>'
    + '<span class="page-info">前往 <input type="text" value="1" /> 页</span>';
}

/* ===== 全屏发起申请 ===== */
var applyModal = document.getElementById('ca-apply-modal');

function openApplyModal(isEdit, row) {
  if (row) {
    document.getElementById('apply-exec-year').value = row.execYear;
    document.getElementById('apply-declared').value = row.declaredQty;
    document.getElementById('apply-count').value = row.issuedQty;
    document.getElementById('apply-issue-date').value = row.issueDate;
    document.getElementById('apply-applicant').value = row.applicant;
    document.getElementById('apply-phone').value = row.phone;
  } else {
    document.getElementById('apply-exec-year').value = '';
    document.getElementById('apply-declared').value = '1';
    document.getElementById('apply-count').value = '1';
    document.getElementById('apply-issue-date').value = '';
    document.getElementById('apply-applicant').value = '绿色推进部';
    document.getElementById('apply-phone').value = '18032500660';
  }
  applyModal.classList.add('show');
}

function closeApplyModal() {
  applyModal.classList.remove('show');
}

document.getElementById('ca-apply-back').addEventListener('click', closeApplyModal);

document.getElementById('btn-apply-save').addEventListener('click', function () {
  closeApplyModal();
  toast('已保存');
});

document.getElementById('btn-apply-submit').addEventListener('click', function () {
  var execYear = document.getElementById('apply-exec-year').value.trim();
  if (!execYear) {
    toast('请选择履约执行年份');
    return;
  }
  closeApplyModal();
  toast('发起申请已提交');
});

// 数量增减（通用）
document.querySelectorAll('.ca-apply-count-field button[data-step]').forEach(function (btn) {
  btn.addEventListener('click', function () {
    var targetId = btn.getAttribute('data-target');
    var input = document.getElementById(targetId);
    var step = btn.getAttribute('data-step');
    var val = Number(input.value) || 0;
    if (step === 'increment') {
      input.value = val + 1;
    } else {
      var next = val - 1;
      input.value = next < 0 ? 0 : next;
    }
  });
});

document.getElementById('apply-attach').addEventListener('click', function () {
  toast('选择文件（演示）');
});

/* ===== 查询 / 重置 ===== */
document.getElementById('btn-ca-search').addEventListener('click', function () {
  renderTable(DEMO_DATA);
  toast('查询完成');
});

document.getElementById('btn-ca-reset').addEventListener('click', function () {
  var ids = ['ca-enterprise-category', 'ca-industry', 'ca-market', 'ca-source', 'ca-cycle',
    'ca-exec-year', 'ca-asset-type', 'ca-product'];
  ids.forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('ca-issue-range').value = '';
  document.getElementById('ca-apply-range').value = '';
  renderTable(DEMO_DATA);
  toast('已重置');
});

document.getElementById('btn-ca-apply').addEventListener('click', function () {
  openApplyModal(false, null);
});

/* ===== 初始化 ===== */
initLayout('manual-register', { moduleId: 'carbon-asset' });
createDateRangePicker('ca-issue-picker', 'ca-issue-range');
createDateRangePicker('ca-apply-picker', 'ca-apply-range');
renderTable(DEMO_DATA);
