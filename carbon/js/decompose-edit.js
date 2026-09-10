function getQuery(name) {
  var params = new URLSearchParams(window.location.search);
  return params.get(name);
}

function decomposePageTitle(row) {
  var y = rangeYear(row.range);
  return (y || row.name || '碳目标') + '年碳目标分解详情';
}

function initDecomposeEditPage() {
  var id = getQuery('id') ? Number(getQuery('id')) : null;
  var mode = getQuery('mode') || 'detail';
  var list = loadTargets();
  var row = list.find(function (x) { return x.id === id; });

  if (!row || !isDecomposeTarget(row)) {
    toast('未找到可分解的碳目标');
    setTimeout(function () { location.href = 'decompose.html'; }, 800);
    return;
  }

  var editable = mode === 'edit' && (row.decomposeStatus || 'wait') !== 'pending';
  initLayout('decompose');

  document.getElementById('page-title').textContent = decomposePageTitle(row);
  document.title = '碳目标分解详情 · 碳目标管理';
  document.getElementById('edit-footer').classList.toggle('hidden', !editable);
  document.getElementById('btn-avg').classList.toggle('hidden', !editable);

  var year = rangeYear(row.range);
  document.getElementById('ro-name').textContent = row.name || '--';
  document.getElementById('ro-dimension').textContent = row.dimension || '--';
  document.getElementById('ro-year').textContent = year || '--';

  var files = row.files || [];
  document.getElementById('ro-files').innerHTML = files.map(function (f) {
    return '<div class="file-item"><span>' + f.name + '</span></div>';
  }).join('');

  var indicators = selectedIndicatorsByIds(row.indicators);
  document.getElementById('indicator-tbody').innerHTML = indicators.map(function (ind, i) {
    return '<tr><td>' + (i + 1) + '</td><td>' + ind.name + '</td><td>' + ind.unit + '</td></tr>';
  }).join('');

  if (!row.decomposeValues) row.decomposeValues = {};

  var state = {
    activeInd: indicators[0] ? indicators[0].id : '',
    collapsed: {},
    values: JSON.parse(JSON.stringify(row.decomposeValues)),
  };

  function ensureNode(indId, nodeId) {
    if (!state.values[nodeId]) state.values[nodeId] = {};
    if (!state.values[nodeId][indId]) {
      state.values[nodeId][indId] = { months: ['', '', '', '', '', '', '', '', '', '', '', ''] };
    }
    if (!state.values[nodeId][indId].months || state.values[nodeId][indId].months.length !== 12) {
      state.values[nodeId][indId].months = ['', '', '', '', '', '', '', '', '', '', '', ''];
    }
    return state.values[nodeId][indId];
  }

  function renderTabs() {
    document.getElementById('indicator-tabs').innerHTML = indicators.map(function (ind) {
      return '<button type="button" class="indicator-tab' + (state.activeInd === ind.id ? ' active' : '') + '" data-ind="' + ind.id + '">' + ind.name + '</button>';
    }).join('');
  }

  function renderTable() {
    var indId = state.activeInd;
    if (!indId) return;
    var thead = '<thead><tr>'
      + '<th class="col-serial">序号</th>'
      + '<th class="col-node">组织节点名称</th>'
      + '<th class="col-annual">年度目标值</th>';
    for (var m = 1; m <= 12; m++) thead += '<th class="col-month">' + m + '月</th>';
    thead += '<th class="col-op">操作</th></tr></thead>';

    var body = '<tbody>';
    DECOMPOSE_ORG_NODES.forEach(function (node) {
      if (decomposeIsHidden(node, state.collapsed)) return;
      var serial = decomposeNodeSerial(node);
      var hasChildren = DECOMPOSE_ORG_NODES.some(function (n) { return n.parent === node.id; });
      var isCollapsed = !!state.collapsed[node.id];
      var toggle = hasChildren
        ? '<button type="button" class="node-toggle" data-toggle="' + node.id + '">' + (isCollapsed ? '+' : '−') + '</button>'
        : '<span class="node-toggle empty">·</span>';
      var cell = ensureNode(indId, node.id);
      var annual = annualTargetFor(row, node.id, indId);
      var annualCell = '<span class="num-cell annual-readonly">' + (annual === '' ? '--' : annual) + '</span>';

      var monthCells = '';
      for (var mi = 0; mi < 12; mi++) {
        var mv = cell.months[mi] || '';
        monthCells += editable
          ? '<td><input class="month-input" data-node="' + node.id + '" data-month="' + mi + '" value="' + mv + '" placeholder="请输入" /></td>'
          : '<td class="num-cell">' + (mv === '' ? '--' : mv) + '</td>';
      }

      body += '<tr class="row-' + node.level + '">'
        + '<td>' + serial + '</td>'
        + '<td class="node-cell' + orgIndentClass(node.level) + '">' + toggle + node.name + '</td>'
        + '<td>' + annualCell + '</td>'
        + monthCells
        + '<td><button type="button" class="op-link" data-chart="' + node.id + '">查看图表</button></td>'
        + '</tr>';
    });
    body += '</tbody>';
    document.getElementById('decompose-table').innerHTML = thead + body;
  }

  function collectValues() {
    document.querySelectorAll('#decompose-table .month-input').forEach(function (input) {
      var nodeId = input.dataset.node;
      var cell = ensureNode(state.activeInd, nodeId);
      if (input.dataset.month != null) cell.months[Number(input.dataset.month)] = input.value.trim();
    });
  }

  function hasMonthData(indId) {
    return DECOMPOSE_ORG_NODES.some(function (node) {
      var cell = ensureNode(indId, node.id);
      return cell.months.some(function (m) { return m != null && String(m).trim() !== ''; });
    });
  }

  function applyAvgDistribution() {
    var decimals = avgDecimalsForInd(state.activeInd);
    DECOMPOSE_ORG_NODES.forEach(function (node) {
      var cell = ensureNode(state.activeInd, node.id);
      var annual = parseFloat(annualTargetFor(row, node.id, state.activeInd));
      if (isNaN(annual) || !annual) return;
      var avg = (annual / 12).toFixed(decimals);
      for (var i = 0; i < 12; i++) cell.months[i] = avg;
    });
    renderTable();
    toast('已按全年平均分配');
  }

  function persist(status) {
    collectValues();
    row.decomposeValues = JSON.parse(JSON.stringify(state.values));
    row.updatedAt = nowText();
    if (status) row.decomposeStatus = status;
    saveTargets(list);
  }

  renderTabs();
  renderTable();

  document.getElementById('indicator-tabs').addEventListener('click', function (e) {
    var tab = e.target.closest('[data-ind]');
    if (!tab) return;
    collectValues();
    state.activeInd = tab.dataset.ind;
    renderTabs();
    renderTable();
  });

  document.getElementById('decompose-table').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-toggle]');
    if (btn) {
      collectValues();
      state.collapsed[btn.dataset.toggle] = !state.collapsed[btn.dataset.toggle];
      renderTable();
      return;
    }
    var chart = e.target.closest('[data-chart]');
    if (chart) toast('图表预览功能开发中');
  });

  document.getElementById('decompose-table').addEventListener('input', function (e) {
    if (!e.target.classList.contains('month-input')) return;
    var nodeId = e.target.dataset.node;
    var cell = ensureNode(state.activeInd, nodeId);
    if (e.target.dataset.month != null) cell.months[Number(e.target.dataset.month)] = e.target.value.trim();
  });

  document.getElementById('btn-avg').addEventListener('click', function () {
    collectValues();
    if (hasMonthData(state.activeInd)) {
      openModal('avg-confirm-modal');
      return;
    }
    applyAvgDistribution();
  });

  document.getElementById('btn-avg-cancel').addEventListener('click', function () {
    closeModal('avg-confirm-modal');
  });
  document.getElementById('btn-avg-close').addEventListener('click', function () {
    closeModal('avg-confirm-modal');
  });
  document.getElementById('btn-avg-confirm').addEventListener('click', function () {
    closeModal('avg-confirm-modal');
    applyAvgDistribution();
  });
  document.getElementById('avg-confirm-modal').addEventListener('click', function (e) {
    if (e.target.id === 'avg-confirm-modal') closeModal('avg-confirm-modal');
  });

  document.getElementById('btn-back').addEventListener('click', function () {
    var fromId = getQuery('from');
    if (fromId) location.href = 'subordinate.html?id=' + fromId;
    else location.href = 'decompose.html';
  });

  document.querySelectorAll('[data-collapse]').forEach(function (head) {
    head.addEventListener('click', function () {
      head.closest('.section-card').classList.toggle('collapsed');
    });
  });

  if (!editable) return;

  document.getElementById('btn-save').addEventListener('click', function () {
    var ds = row.decomposeStatus || 'wait';
    persist(ds === 'passed' ? 'passed' : 'draft');
    toast('已保存');
  });

  document.getElementById('btn-submit').addEventListener('click', function () {
    persist('pending');
    toast('已提交审核');
    setTimeout(function () { location.href = 'decompose.html'; }, 700);
  });
}

if (document.body.dataset.page === 'decompose-edit') initDecomposeEditPage();
