/**
 * 平台壳：一级模块注册表
 * 新增一级模块时：
 * 1. 在 MODULES 追加 { id, name, home, getSidebar }
 * 2. getSidebar 只需配置业务菜单；「整体流程图 / 需求说明」会自动挂上
 * 3. 新建 js/docs/{id}/doc-defaults.js 与 assets/{id}/（可先空着，保存时服务会写入）
 */
const PLATFORM_NAME = '绿色低碳管理平台';

function docsSidebarGroup(moduleId) {
  return {
    id: 'docs',
    name: '流程&需求说明',
    items: [
      { id: 'flowchart', name: '整体流程图', href: 'flowchart.html?module=' + moduleId },
      { id: 'requirements', name: '需求说明/注意事项', href: 'requirements.html?module=' + moduleId },
    ],
  };
}

/** 一级模块列表：后续新增模块按此结构追加即可 */
const MODULES = [
  {
    id: 'verify',
    name: '核查管理',
    home: 'index.html',
    getSidebar: function () {
      return [
        {
          id: 'biz',
          name: '业务界面',
          items: [
            { id: 'verify-fill', name: '核查数据管理', href: 'index.html' },
          ],
        },
        docsSidebarGroup('verify'),
      ];
    },
  },
  {
    id: 'carbon',
    name: '碳目标管理',
    home: 'carbon/index.html',
    getSidebar: function () {
      return [
        {
          id: 'biz',
          name: '业务界面',
          items: [
            { id: 'create', name: '碳目标制定', href: 'carbon/index.html' },
          ],
        },
        docsSidebarGroup('carbon'),
      ];
    },
  },
  {
    id: 'emission',
    name: '碳排放管理',
    home: 'emission/index.html',
    getSidebar: function () {
      return [
        {
          id: 'biz',
          name: '业务界面',
          items: [
            { id: 'monthly-fill', name: '月度数据填报-填报', href: 'emission/index.html' },
          ],
        },
        docsSidebarGroup('emission'),
      ];
    },
  },
  {
    id: 'analysis',
    name: '碳数据分析',
    home: 'analysis/index.html',
    getSidebar: function () {
      return [
        {
          id: 'biz',
          name: '业务界面',
          items: [
            { id: 'yoy', name: '同比分析', href: 'analysis/index.html' },
            { id: 'mom', name: '环比分析', href: 'analysis/mom.html' },
          ],
        },
        docsSidebarGroup('analysis'),
      ];
    },
  },
  {
    id: 'carbon-asset',
    name: '碳资产管理',
    home: 'carbon-asset/index.html',
    getSidebar: function () {
      return [
        {
          id: 'biz',
          name: '业务界面',
          items: [
            { id: 'manual-register', name: '人工登记申请', href: 'carbon-asset/index.html' },
            { id: 'fulfillment', name: '履约申请', href: 'carbon-asset/fulfillment.html' },
            { id: 'freeze', name: '碳资产冻结管理', href: 'carbon-asset/freeze.html' },
            // 分析类界面暂未启用（文件保留在 carbon-asset/ 下，需要时取消注释即可）
            // { id: 'analysis-register', name: '碳资产登记分析', href: 'carbon-asset/analysis-register.html' },
            // { id: 'analysis-trade', name: '碳资产交易分析', href: 'carbon-asset/analysis-trade.html' },
            // { id: 'analysis-performance', name: '碳履约分析', href: 'carbon-asset/analysis-performance.html' },
          ],
        },
        docsSidebarGroup('carbon-asset'),
      ];
    },
  },
  {
    id: 'system',
    name: '系统管理',
    home: 'system/index.html',
    getSidebar: function () {
      return [
        {
          id: 'biz',
          name: '业务界面',
          items: [
            { id: 'done-events', name: '已办事件', href: 'system/index.html' },
          ],
        },
        docsSidebarGroup('system'),
      ];
    },
  },
];

function getModule(moduleId) {
  return MODULES.find(function (m) { return m.id === moduleId; }) || MODULES[0];
}

function getDocModuleId() {
  try {
    var id = new URLSearchParams(location.search).get('module');
    if (id && MODULES.some(function (m) { return m.id === id; })) return id;
  } catch (e) { /* ignore */ }
  return 'verify';
}

function docsStorageKeys(moduleId) {
  moduleId = moduleId || 'verify';
  return {
    flowchart: 'docs-flowchart-' + moduleId + '-v1',
    flowchartCleared: 'docs-flowchart-cleared-' + moduleId,
    requirements: 'docs-requirements-' + moduleId + '-v1',
  };
}

function docsApiPath(moduleId, kind) {
  return '/api/docs/' + encodeURIComponent(moduleId) + '/' + kind;
}

function flattenSidebar(groups) {
  var items = [];
  (groups || []).forEach(function (group) {
    (group.items || []).forEach(function (item) { items.push(item); });
  });
  return items;
}

function findSidebarItem(groups, id) {
  var items = flattenSidebar(groups);
  return items.find(function (s) { return s.id === id; }) || items[0];
}

function pad(n) { return String(n).padStart(2, '0'); }

function nowText() {
  const d = new Date();
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
    + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
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

/** 文档保存 API：需通过 npm start 启动本地服务后才可写入代码包 */
function docsApi(pathname, options) {
  options = options || {};
  return fetch(pathname, {
    method: options.method || 'GET',
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
  }).then(function (res) {
    return res.json().catch(function () {
      return { ok: false, message: '服务响应异常' };
    }).then(function (data) {
      if (!res.ok || data.ok === false) {
        var err = new Error((data && data.message) || ('请求失败 ' + res.status));
        err.status = res.status;
        err.data = data;
        throw err;
      }
      return data;
    });
  });
}

function checkDocsServer(moduleId) {
  moduleId = moduleId || getDocModuleId();
  return docsApi(docsApiPath(moduleId, 'status')).then(function () {
    return true;
  }).catch(function () {
    return false;
  });
}

function docsServerRequiredTip() {
  return '请先在项目目录执行 npm start 启动本地服务，保存才会写入代码包文件';
}

/**
 * @param {string} activeId 侧栏菜单 id
 * @param {{ moduleId?: string, pageTitle?: string }} opts
 */
/** 每个一级模块自动挂上流程图 / 需求说明，避免后续新增模块漏配 */
function withDocsSidebar(moduleId, groups) {
  groups = (groups || []).slice();
  var hasDocs = groups.some(function (g) { return g.id === 'docs'; });
  if (!hasDocs) groups.push(docsSidebarGroup(moduleId));
  return groups;
}

/**
 * 文档页按 ?module= 动态加载 js/docs/{module}/doc-defaults.js，再加载页面脚本
 */
function loadModuleDocDefaults(thenSrc) {
  var id = getDocModuleId();
  var s = document.createElement('script');
  s.src = 'js/docs/' + encodeURIComponent(id) + '/doc-defaults.js';
  function next() {
    var page = document.createElement('script');
    page.src = thenSrc;
    document.body.appendChild(page);
  }
  s.onload = next;
  s.onerror = next;
  document.body.appendChild(s);
}

function initLayout(activeId, opts) {
  opts = opts || {};
  var moduleId = opts.moduleId || 'verify';
  var mod = getModule(moduleId);
  var groups = typeof mod.getSidebar === 'function' ? mod.getSidebar() : [];
  groups = withDocsSidebar(mod.id, groups);
  var item = findSidebarItem(groups, activeId);
  var pageTitle = opts.pageTitle || (item && item.name) || mod.name;

  var header = document.getElementById('app-header');
  if (header) {
    header.innerHTML =
      '<div class="app-logo">'
      + '<div class="logo-mark"><svg width="16" height="16" viewBox="0 0 24 24" fill="none">'
      + '<path d="M12 3c4 3 7 7 7 11a7 7 0 1 1-14 0c0-4 3-8 7-11z" fill="#fff" opacity="0.95"/>'
      + '</svg></div>'
      + '<span>' + PLATFORM_NAME + '</span>'
      + '</div>'
      + '<nav class="app-topnav">'
      + MODULES.map(function (m) {
        return '<a href="' + m.home + '" class="' + (m.id === moduleId ? 'active' : '') + '">' + m.name + '</a>';
      }).join('')
      + '</nav>'
      + '<div class="app-header-right">'
      + '<span>管理员</span>'
      + '<div class="app-avatar">管</div>'
      + '</div>';
  }

  var menu = document.getElementById('sidebar-menu');
  if (menu) {
    menu.innerHTML = groups.map(function (group) {
      var items = (group.items || []).map(function (s) {
        var active = s.id === activeId ? ' active' : '';
        return '<a class="sidebar-item' + active + '" href="' + s.href + '">' + s.name + '</a>';
      }).join('');
      return '<div class="sidebar-group">'
        + '<div class="sidebar-group-title">' + group.name + '</div>'
        + items
        + '</div>';
    }).join('');
  }

  var crumb = document.getElementById('breadcrumb');
  if (crumb) {
    crumb.innerHTML =
      '<a href="' + mod.home + '">' + mod.name + '</a>'
      + '<span class="sep">/</span>'
      + '<span class="current">' + pageTitle + '</span>';
  }

  document.title = pageTitle + ' · ' + mod.name;
}

/** 兼容旧常量：默认指向核查模块文档 key（流程图页会按 module 覆盖） */
var FLOWCHART_KEY = docsStorageKeys('verify').flowchart;
var FLOWCHART_CLEARED_KEY = docsStorageKeys('verify').flowchartCleared;
var REQUIREMENTS_KEY = docsStorageKeys('verify').requirements;
