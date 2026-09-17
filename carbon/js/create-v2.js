/**
 * 碳目标制定 V2（新原型界面）
 *
 * 用法：页面里放一个占位容器 <div data-tv2-slot></div>，脚本会自动把 V2 界面挂载进去；
 * 若页面已有 #tv2-section（旧写法：直接写死在 HTML 里），也会兼容识别。
 * 因此 carbon/index.html（碳目标制定列表页）与 carbon/create.html（新增向导页）共用同一份源码。
 *
 * 类名统一 tv2- 前缀，不与 create.js / carbon-biz.js 共享状态，不读写 localStorage。
 */
(function () {
  'use strict';

  var STEPS = [
    { n: 1, label: '碳指标' },
    { n: 2, label: '任务清单' },
    { n: 3, label: '目标分解与评估' },
    { n: 4, label: '编制范围确认' },
  ];

  /** V2 界面 HTML 模板（唯一一份源码，避免多页面重复维护） */
  function template() {
    return ''
      + '<section class="tv2-section" id="tv2-section">'
      + '<div class="tv2-canvas">'
      /* 顶栏 */
      + '<div class="tv2-topbar">'
      + '<button type="button" class="tv2-back" id="tv2-back" title="返回">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>'
      + '</button>'
      + '<span class="tv2-topbar-title">碳目标制定</span>'
      + '</div>'
      /* 步骤条 */
      + '<div class="tv2-card tv2-stepper-card"><div class="tv2-stepper" id="tv2-stepper">'
      + STEPS.map(function (s) {
        return '<div class="tv2-step' + (s.n === 1 ? ' active' : '') + '" data-step="' + s.n + '">'
          + '<span class="tv2-step-dot">' + s.n + '</span>'
          + '<span class="tv2-step-label">' + s.label + '</span>'
          + '</div>';
      }).join('')
      + '</div></div>'
      /* 碳指标 */
      + '<div class="tv2-card">'
      + '<div class="tv2-card-title">碳指标</div>'
      + '<div class="tv2-field-grid">'
      + '<div class="tv2-field">'
      + '<label><span class="tv2-req">*</span>碳目标名称</label>'
      + '<div class="tv2-input-wrap">'
      + '<input type="text" id="tv2-name" maxlength="20" value="1" />'
      + '<span class="tv2-char-count"><span id="tv2-name-count">1</span> / 20</span>'
      + '</div></div>'
      + '<div class="tv2-field">'
      + '<label><span class="tv2-req">*</span>碳目标年度</label>'
      + '<div class="tv2-input-wrap">'
      + '<span class="tv2-calendar-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">'
      + '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg></span>'
      + '<input type="text" id="tv2-year" class="tv2-has-icon" value="2029" readonly />'
      + '</div></div>'
      + '<div class="tv2-field tv2-field-attach">'
      + '<div class="tv2-attach-hint">附件（请最多上传五个不超过100MB的文件，支持.pdf,.docx,.xlsx,.xls格式）</div>'
      + '<button type="button" class="tv2-add-file" id="tv2-add-file">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">'
      + '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 9v6M9 12h6"/></svg>添加文件</button>'
      + '<input type="file" id="tv2-file-input" class="hidden" accept=".pdf,.docx,.xlsx,.xls" multiple />'
      + '<div class="tv2-file-list" id="tv2-file-list"></div>'
      + '</div></div></div>'
      /* 碳指标配置 */
      + '<div class="tv2-card">'
      + '<div class="tv2-cfg-head">'
      + '<div class="tv2-cfg-title">'
      + '<span class="tv2-cfg-title-text">碳指标配置</span>'
      + '<span class="tv2-cfg-sub"><i class="tv2-info-icon">i</i>年度碳目标考核指标</span>'
      + '</div>'
      + '<div class="tv2-cfg-actions">'
      + '<button type="button" class="tv2-btn tv2-btn-solid" id="tv2-fullscreen">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">'
      + '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>全屏</button>'
      + '<button type="button" class="tv2-btn tv2-btn-solid" id="tv2-indicator-config">指标配置</button>'
      + '<button type="button" class="tv2-btn tv2-btn-solid" id="tv2-optimize">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">'
      + '<path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9z"/><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z"/></svg>智能减排寻优</button>'
      + '</div></div>'
      + '<div class="tv2-table-wrap" id="tv2-table-wrap">'
      + '<table class="tv2-table"><thead><tr>'
      + '<th class="tv2-th-index">序号</th><th>指标名称</th><th>单位</th><th>年度预测值</th>'
      + '<th>年度规划值</th><th>年度目标值</th><th>操作</th>'
      + '</tr></thead><tbody id="tv2-indicator-body"></tbody></table>'
      + '</div></div>'
      /* 底部操作 */
      + '<div class="tv2-footer">'
      + '<button type="button" class="tv2-btn tv2-btn-soft" id="tv2-save">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">'
      + '<path d="M5 4h11l3 3v13H5z"/><path d="M9 4v5h6V4M9 20v-6h6v6"/></svg>保存</button>'
      + '<button type="button" class="tv2-btn tv2-btn-solid" id="tv2-next">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">'
      + '<path d="M5 12h13M13 6l6 6-6 6"/></svg>下一步</button>'
      + '</div>'
      + '</div><!-- /.tv2-canvas -->'
      + '</section>';
  }

  /** 找到（或创建）V2 容器：优先占位符，其次已写死的 #tv2-section */
  function resolveSection() {
    var slots = document.querySelectorAll('[data-tv2-slot]');
    if (slots.length) {
      var slot = slots[0];
      slot.innerHTML = template();
      var sec = slot.querySelector('#tv2-section');
      /* 占位符带 data-tv2-standalone 时，V2 是页面唯一内容，去掉与上方旧内容的分隔虚线 */
      if (sec && slot.hasAttribute('data-tv2-standalone')) sec.classList.add('tv2-standalone');
      return sec;
    }
    return document.getElementById('tv2-section');
  }

  var SECTION = resolveSection();
  if (!SECTION) return;

  /* ---------------- 数据（取自设计稿） ---------------- */

  /** 当前表格展示的指标行 */
  var ROWS = [
    { id: 'total',     name: '碳排放总量',           unit: 't',         predict: '27677437', plan: '76172322', goal: '1' },
    { id: 'clinker',   name: '熟料碳排放强度',       unit: 'tCO2/t',    predict: '0.7511',   plan: '0.789',    goal: '2' },
    { id: 'raw',       name: '原料替代率',           unit: '%',         predict: '6.02',     plan: '7.2',      goal: '3' },
    { id: 'fuel',      name: '燃料替代率',           unit: '%',         predict: '12.10',    plan: '13',       goal: '4' },
    { id: 'clinkerE',  name: '熟料单位产品综合能耗', unit: 'kgce/tcl',  predict: '—',        plan: '99.76',    goal: '2' },
  ];

  /** 指标配置弹窗可选项 */
  var ALL_INDICATORS = [
    { id: 'total',    name: '碳排放总量',           unit: 't',        logic: '统计期内企业碳排放总量' },
    { id: 'clinker',  name: '熟料碳排放强度',       unit: 'tCO2/t',   logic: '碳排放总量 ÷ 熟料产量' },
    { id: 'raw',      name: '原料替代率',           unit: '%',        logic: '替代原料用量 ÷ 原料总用量 × 100%' },
    { id: 'fuel',     name: '燃料替代率',           unit: '%',        logic: '替代燃料热值 ÷ 燃料总热值 × 100%' },
    { id: 'clinkerE', name: '熟料单位产品综合能耗', unit: 'kgce/tcl', logic: '综合能耗 ÷ 熟料产量' },
    { id: 'power',    name: '单位产品电耗',         unit: 'kWh/t',    logic: '总用电量 ÷ 水泥产量' },
    { id: 'dust',     name: '颗粒物排放浓度',       unit: 'mg/m³',    logic: '在线监测折算浓度' },
  ];

  /** 历史趋势演示数据（近 6 年） */
  var TREND_YEARS = ['2024', '2025', '2026', '2027', '2028', '2029'];
  var TREND_DATA = {
    total:    [31204500, 30118700, 29440800, 28733000, 28164400, 27677437],
    clinker:  [0.8214, 0.8062, 0.7931, 0.7818, 0.7669, 0.7511],
    raw:      [3.10, 3.86, 4.52, 5.08, 5.61, 6.02],
    fuel:     [6.40, 7.55, 8.90, 10.12, 11.24, 12.10],
    clinkerE: [104.20, 102.85, 101.60, 100.74, 100.12, 99.76],
    power:    [86.40, 84.90, 83.60, 82.10, 81.30, 80.55],
    dust:     [12.40, 11.60, 10.85, 10.20, 9.60, 9.05],
  };

  var activeIds = ROWS.map(function (r) { return r.id; });
  var draftIds = [];

  var FULL_VALUE = {};   // 指标 id -> { predict, plan, goal }
  ROWS.forEach(function (r) { FULL_VALUE[r.id] = r; });
  [['power', '—', '81.30', ''],
   ['dust', '—', '9.05', '']].forEach(function (t) {
    FULL_VALUE[t[0]] = { id: t[0], predict: t[1], plan: t[2], goal: t[3] };
  });

  function indicatorById(id) {
    return ALL_INDICATORS.filter(function (i) { return i.id === id; })[0];
  }

  function currentRows() {
    return activeIds.map(function (id) {
      var ind = indicatorById(id);
      var val = FULL_VALUE[id] || { predict: '—', plan: '—', goal: '' };
      return {
        id: id,
        name: ind ? ind.name : id,
        unit: ind ? ind.unit : '',
        predict: val.predict,
        plan: val.plan,
        goal: val.goal,
      };
    });
  }

  /* ---------------- 表格渲染 ---------------- */

  var tbody = SECTION.querySelector('#tv2-indicator-body');

  function renderTable() {
    if (!tbody) return;
    var rows = currentRows();
    var html = rows.map(function (r, i) {
      var predictCls = r.predict === '—' ? 'tv2-td-pred tv2-td-none' : 'tv2-td-pred';
      return '<tr data-id="' + r.id + '">'
        + '<td>' + (i + 1) + '</td>'
        + '<td>' + r.name + '</td>'
        + '<td>' + r.unit + '</td>'
        + '<td class="' + predictCls + '">' + r.predict + '</td>'
        + '<td class="tv2-td-plan">' + r.plan + '</td>'
        + '<td><input class="tv2-goal-input" type="text" value="' + r.goal + '" data-id="' + r.id + '" /></td>'
        + '<td><button type="button" class="tv2-link" data-trend="' + r.id + '">历史趋势</button></td>'
        + '</tr>';
    }).join('');

    // 补一行空行，还原设计稿中表格下方的留白
    html += '<tr class="tv2-filler">'
      + '<td></td><td></td><td></td><td></td><td></td><td></td><td></td>'
      + '</tr>';

    tbody.innerHTML = html;
  }

  /* ---------------- 轻量弹窗 ---------------- */

  var openMask = null;

  function ensureMask() {
    var el = document.getElementById('tv2-mask');
    if (!el) {
      el = document.createElement('div');
      el.id = 'tv2-mask';
      el.className = 'tv2-modal-mask';
      document.body.appendChild(el);
    }
    return el;
  }

  function openModal(opts) {
    var mask = ensureMask();
    mask.innerHTML =
      '<div class="tv2-modal' + (opts.wide ? ' tv2-modal-wide' : '') + '" role="dialog" aria-modal="true">'
      + '<div class="tv2-modal-head"><h3>' + opts.title + '</h3>'
      + '<button type="button" class="tv2-modal-close" data-tv2-close>×</button></div>'
      + '<div class="tv2-modal-body">' + opts.body + '</div>'
      + (opts.foot ? '<div class="tv2-modal-foot">' + opts.foot + '</div>' : '')
      + '</div>';
    mask.classList.add('show');
    openMask = mask;
    if (typeof opts.onOpen === 'function') opts.onOpen(mask);
  }

  function closeModal() {
    if (openMask) {
      openMask.classList.remove('show');
      openMask.innerHTML = '';
      openMask = null;
    }
  }

  /* ---------------- 指标配置弹窗 ---------------- */

  function openIndicatorConfig() {
    draftIds = activeIds.slice();

    var body = '<table class="tv2-pick-table"><thead><tr>'
      + '<th style="width:44px"><input type="checkbox" data-tv2-all /></th>'
      + '<th style="width:52px">序号</th>'
      + '<th>指标名称</th><th style="width:120px">单位</th><th>计算逻辑</th>'
      + '</tr></thead><tbody>'
      + ALL_INDICATORS.map(function (ind, i) {
        var checked = draftIds.indexOf(ind.id) !== -1 ? ' checked' : '';
        return '<tr>'
          + '<td><input type="checkbox" data-tv2-pick="' + ind.id + '"' + checked + ' /></td>'
          + '<td>' + (i + 1) + '</td>'
          + '<td>' + ind.name + '</td>'
          + '<td>' + ind.unit + '</td>'
          + '<td style="color:#606266">' + ind.logic + '</td>'
          + '</tr>';
      }).join('')
      + '</tbody></table>';

    var foot = '<button type="button" class="tv2-btn" data-tv2-cancel>取消</button>'
      + '<button type="button" class="tv2-btn tv2-btn-solid" data-tv2-ok>确认</button>';

    openModal({
      title: '指标配置',
      body: body,
      foot: foot,
      onOpen: function (mask) {
        var all = mask.querySelector('[data-tv2-all]');
        all.checked = draftIds.length === ALL_INDICATORS.length;

        mask.addEventListener('change', function (e) {
          var one = e.target.closest ? e.target.closest('[data-tv2-pick]') : null;
          if (one) {
            var id = one.getAttribute('data-tv2-pick');
            var idx = draftIds.indexOf(id);
            if (one.checked && idx === -1) draftIds.push(id);
            if (!one.checked && idx !== -1) draftIds.splice(idx, 1);
            all.checked = draftIds.length === ALL_INDICATORS.length;
          } else if (e.target === all) {
            draftIds = all.checked ? ALL_INDICATORS.map(function (i) { return i.id; }) : [];
            mask.querySelectorAll('[data-tv2-pick]').forEach(function (cb) {
              cb.checked = all.checked;
            });
          }
        });

        mask.addEventListener('click', function (e) {
          if (e.target.closest('[data-tv2-ok]')) {
            if (!draftIds.length) {
              if (typeof toast === 'function') toast('请至少选择一个指标');
              return;
            }
            activeIds = draftIds.slice();
            renderTable();
            closeModal();
            if (typeof toast === 'function') toast('指标配置已更新');
          }
        });
      },
    });
  }

  /* ---------------- 历史趋势弹窗 ---------------- */

  function trendSvg(values, color) {
    var W = 680, H = 200, PL = 74, PR = 16, PT = 16, PB = 28;
    var min = Math.min.apply(null, values);
    var max = Math.max.apply(null, values);
    var span = max - min || 1;
    var innerW = W - PL - PR;
    var innerH = H - PT - PB;

    // Y 轴刻度压缩显示，避免长数字（如 31204500）溢出绘图区左侧
    function fmtAxis(v) {
      var abs = Math.abs(v);
      if (abs >= 1000000) return (v / 1000000).toFixed(2) + 'M';
      if (abs >= 10000) return (v / 10000).toFixed(1) + '万';
      if (abs >= 1000) return Math.round(v).toString();
      return Number(v.toFixed(3)).toString();
    }

    var pts = values.map(function (v, i) {
      var x = PL + (innerW * i) / (values.length - 1);
      var y = PT + innerH - ((v - min) / span) * innerH;
      return [Number(x.toFixed(1)), Number(y.toFixed(1))];
    });

    var line = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0] + ' ' + p[1]; }).join(' ');

    var grid = '';
    for (var g = 0; g <= 4; g++) {
      var gy = PT + (innerH * g) / 4;
      var gv = (max - (span * g) / 4);
      grid += '<line x1="' + PL + '" y1="' + gy + '" x2="' + (W - PR) + '" y2="' + gy
        + '" stroke="#e8ebef" stroke-width="1"/>'
        + '<text x="' + (PL - 8) + '" y="' + (gy + 4) + '" text-anchor="end" font-size="10" fill="#9aa1a9">'
        + fmtAxis(gv) + '</text>';
    }

    var labels = TREND_YEARS.map(function (y, i) {
      var x = PL + (innerW * i) / (TREND_YEARS.length - 1);
      return '<text x="' + x + '" y="' + (H - 8) + '" text-anchor="middle" font-size="10" fill="#9aa1a9">' + y + '</text>';
    }).join('');

    var dots = pts.map(function (p) {
      return '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="3.5" fill="#fff" stroke="' + color + '" stroke-width="2"/>';
    }).join('');

    return '<svg class="tv2-trend-chart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">'
      + grid + labels
      + '<path d="' + line + '" fill="none" stroke="' + color + '" stroke-width="2.5" stroke-linejoin="round"/>'
      + dots
      + '</svg>';
  }

  function openTrend(id) {
    var ind = indicatorById(id);
    if (!ind) return;
    var values = TREND_DATA[id];
    if (!values) {
      if (typeof toast === 'function') toast('暂无该指标的历史数据');
      return;
    }

    var body = '<div class="tv2-trend-meta">指标：' + ind.name + '（' + ind.unit + '）　统计范围：近 6 年</div>'
      + trendSvg(values, '#00b42a')
      + '<div class="tv2-trend-legend"><span><i style="background:#00b42a"></i>历史值</span></div>'
      + '<table class="tv2-trend-table"><thead><tr><th>年度</th>'
      + TREND_YEARS.map(function (y) { return '<th>' + y + '年</th>'; }).join('')
      + '</tr></thead><tbody><tr><td>数值</td>'
      + values.map(function (v) { return '<td>' + v + '</td>'; }).join('')
      + '</tr></tbody></table>';

    openModal({ title: '历史趋势 · ' + ind.name, body: body, wide: true });
  }

  /* ---------------- 名称字数 ---------------- */

  function bindNameCount() {
    var input = SECTION.querySelector('#tv2-name');
    var out = SECTION.querySelector('#tv2-name-count');
    if (!input || !out) return;
    function sync() { out.textContent = input.value.length; }
    input.addEventListener('input', sync);
    sync();
  }

  /* ---------------- 添加文件 ---------------- */

  function bindFiles() {
    var addBtn = SECTION.querySelector('#tv2-add-file');
    var fileInput = SECTION.querySelector('#tv2-file-input');
    var list = SECTION.querySelector('#tv2-file-list');
    if (!addBtn || !fileInput || !list) return;

    var files = [];

    function render() {
      list.innerHTML = files.map(function (f, i) {
        return '<div class="tv2-file-item">'
          + '<span>' + f.name + '</span>'
          + '<button type="button" data-tv2-rm="' + i + '">删除</button>'
          + '</div>';
      }).join('');
    }

    addBtn.addEventListener('click', function () { fileInput.click(); });

    fileInput.addEventListener('change', function () {
      Array.prototype.slice.call(fileInput.files).forEach(function (f) {
        if (files.length >= 5) {
          if (typeof toast === 'function') toast('最多上传 5 个文件');
          return;
        }
        files.push({ name: f.name, size: f.size });
      });
      fileInput.value = '';
      render();
    });

    list.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('[data-tv2-rm]') : null;
      if (!btn) return;
      files.splice(Number(btn.getAttribute('data-tv2-rm')), 1);
      render();
    });
  }

  /* ---------------- 全屏 ---------------- */

  function bindFullscreen() {
    var btn = SECTION.querySelector('#tv2-fullscreen');
    var canvas = SECTION.querySelector('.tv2-canvas');
    if (!btn || !canvas) return;

    btn.addEventListener('click', function () {
      var on = canvas.classList.toggle('tv2-fullscreen');
      btn.innerHTML = on
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">'
          + '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>退出全屏'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">'
          + '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>全屏';
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && canvas.classList.contains('tv2-fullscreen')) {
        canvas.classList.remove('tv2-fullscreen');
        btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">'
          + '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>全屏';
      }
    });
  }

  /* ---------------- 步骤条 ---------------- */

  function bindStepper() {
    var stepper = SECTION.querySelector('#tv2-stepper');
    if (!stepper) return;

    var labels = ['碳指标', '任务清单', '目标分解与评估', '编制范围确认'];

    function go(step) {
      var steps = stepper.querySelectorAll('.tv2-step');
      Array.prototype.forEach.call(steps, function (el, i) {
        el.classList.toggle('active', i + 1 === step);
        el.classList.toggle('done', i + 1 < step);
      });
      if (typeof toast === 'function') toast('已切换到：' + labels[step - 1]);
    }

    stepper.addEventListener('click', function (e) {
      var el = e.target.closest ? e.target.closest('.tv2-step') : null;
      if (!el) return;
      go(Number(el.getAttribute('data-step')));
    });

    window.__tv2GoStep__ = go;
  }

  /* ---------------- 全局点击代理（弹窗关闭 / 表格内按钮） ---------------- */

  function bindDelegates() {
    document.addEventListener('click', function (e) {
      if (!e.target.closest) return;

      if (e.target.closest('[data-tv2-close]') || e.target.closest('[data-tv2-cancel]')) {
        closeModal();
        return;
      }
      if (e.target.classList && e.target.classList.contains('tv2-modal-mask')) {
        closeModal();
        return;
      }

      var trendBtn = e.target.closest('[data-trend]');
      if (trendBtn) {
        openTrend(trendBtn.getAttribute('data-trend'));
      }
    });
  }

  /* ---------------- 底部按钮 ---------------- */

  function bindFooter() {
    var save = SECTION.querySelector('#tv2-save');
    var next = SECTION.querySelector('#tv2-next');
    var back = SECTION.querySelector('#tv2-back');
    var cfg = SECTION.querySelector('#tv2-indicator-config');

    if (save) {
      save.addEventListener('click', function () {
        if (typeof toast === 'function') toast('V2：草稿已保存（原型演示）');
      });
    }
    if (next) {
      next.addEventListener('click', function () {
        if (typeof window.__tv2GoStep__ === 'function') {
          window.__tv2GoStep__(2);
        } else if (typeof toast === 'function') {
          toast('V2：进入下一步（原型演示）');
        }
      });
    }
    if (back) {
      back.addEventListener('click', function () {
        if (typeof toast === 'function') toast('V2：返回碳目标列表（原型演示）');
      });
    }
    if (cfg) cfg.addEventListener('click', openIndicatorConfig);

    var optimize = SECTION.querySelector('#tv2-optimize');
    if (optimize) {
      optimize.addEventListener('click', function () {
        if (typeof toast === 'function') toast('V2：智能减排寻优（原型演示）');
      });
    }
  }

  /* ---------------- 初始化 ---------------- */

  renderTable();
  bindNameCount();
  bindFiles();
  bindFullscreen();
  bindStepper();
  bindDelegates();
  bindFooter();
})();
