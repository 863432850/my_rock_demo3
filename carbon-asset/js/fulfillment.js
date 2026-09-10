/**
 * 碳资产管理 · 履约申请
 */

// 演示数据
var FF_STATE = {
  market: '全国碳市场',
  industry: '建材',
  cycle: '第五个履约周期25',
  dueQty: 12000,    // 当前应清缴配额量（吨）
  clearedQty: 8600, // 累计清缴配额量（吨）
  balance: -3400,   // 账户余额 = 应缴 - 累计清缴，小于 0，触发预警
  plan: [],
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

function fmtQty(n) {
  return (Number(n) || 0).toLocaleString();
}

// 渲染目标卡片
function renderGoalCards() {
  document.getElementById('ff-due').innerHTML = fmtQty(FF_STATE.dueQty) + ' tCO<sub>2</sub>';
  document.getElementById('ff-cleared').innerHTML = fmtQty(FF_STATE.clearedQty) + ' tCO<sub>2</sub>';
  document.getElementById('ff-balance').innerHTML = fmtQty(FF_STATE.balance) + ' tCO<sub>2</sub>';
}

// 渲染履约方案表格
function renderPlan() {
  var body = document.getElementById('ff-plan-body');
  if (!FF_STATE.plan.length) {
    body.innerHTML = '<tr><td colspan="4">暂无数据</td></tr>';
    return;
  }
  body.innerHTML = FF_STATE.plan.map(function (row, i) {
    return '<tr>'
      + '<td>' + escapeHtml(row.industry) + '</td>'
      + '<td>' + escapeHtml(row.product) + '</td>'
      + '<td>' + fmtQty(row.qty) + '</td>'
      + '<td><button type="button" class="op-btn" data-del="' + i + '">删除</button></td>'
      + '</tr>';
  }).join('');

  body.querySelectorAll('[data-del]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      FF_STATE.plan.splice(Number(btn.getAttribute('data-del')), 1);
      renderPlan();
    });
  });
}

// 推送履约预警
function pushWarning() {
  if (FF_STATE.balance < 0) {
    toast('推送成功');
  } else {
    toast('账户余额充足，无需预警');
  }
}

// 智能履约寻优
function optimizePlan() {
  toast('正在为履约方案做智能寻优（演示）');
}

// 返回
document.getElementById('btn-ff-back').addEventListener('click', function () {
  window.location.href = '/carbon-asset/index.html';
});

// 保存
document.getElementById('btn-ff-save').addEventListener('click', function () {
  toast('已保存');
});

// 发起申请
document.getElementById('btn-ff-submit').addEventListener('click', function () {
  toast('发起申请已提交');
});

// 附件
document.getElementById('ff-attach').addEventListener('click', function () {
  toast('选择文件（演示）');
});

// 导出示例
document.querySelector('.ff-plan-actions .tips').addEventListener('click', function () {
  toast('导出示例（演示）');
});

// 推送履约预警（账户余额上方按钮）
document.getElementById('btn-ff-warn').addEventListener('click', pushWarning);

// 智能履约寻优（履约方案区右侧按钮）
document.getElementById('btn-ff-optimize').addEventListener('click', optimizePlan);

// 初始化
initLayout('fulfillment', { moduleId: 'carbon-asset' });
renderGoalCards();
renderPlan();
